#!/usr/bin/env node
/**
 * fix-sem.js — SEM-3/SEM-4 자동 수정
 *
 * SEM-3: 어법 ch[] 순서를 passage <u> 밑줄 출현 순서로 재정렬
 * SEM-4: det "X→Y" 패턴에서 X가 있는 ch 인덱스로 ans 재설정
 *
 * Usage:
 *   node validate/fix-sem.js data/모의고사           # 모의고사 전체
 *   node validate/fix-sem.js data/모의고사/고1/3월   # 특정 경로
 *   node validate/fix-sem.js --all                   # 전체
 *   node validate/fix-sem.js --dry-run data/모의고사 # 미리보기만
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAMMAR_TYPES = ['어법', '어법 빈칸', '어법 밑줄형', '어법 빈칸형', '어법 5지선다'];

function findJsonFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '_passages') {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
      results.push(full);
    }
  }
  return results;
}

function extractUnderlines(passage) {
  const matches = passage.match(/<u>([^<]+)<\/u>/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/<\/?u>/g, '').trim());
}

// 탐욕적 매칭: 정확 매칭 우선, 이미 사용된 인덱스 제외
function matchChToUnderlines(chWords, underlineWords) {
  const chLower = chWords.map(c => (c || '').trim().toLowerCase());
  const ulLower = underlineWords.map(u => u.toLowerCase());
  const used = new Set();
  const mapping = new Array(chLower.length).fill(-1);

  // Pass 1: 정확 매칭
  chLower.forEach((c, ci) => {
    const idx = ulLower.findIndex((u, ui) => !used.has(ui) && u === c);
    if (idx !== -1) { mapping[ci] = idx; used.add(idx); }
  });

  // Pass 2: 포함 매칭
  chLower.forEach((c, ci) => {
    if (mapping[ci] !== -1) return;
    const idx = ulLower.findIndex((u, ui) => !used.has(ui) && (u.includes(c) || c.includes(u)));
    if (idx !== -1) { mapping[ci] = idx; used.add(idx); }
  });

  return mapping;
}

function fixSEM3(q, fullPassage) {
  const typeNorm = (q.type || '').trim();
  if (!GRAMMAR_TYPES.some(gt => typeNorm.includes(gt))) return null;

  const psg = q.passage || fullPassage || '';
  const underlines = extractUnderlines(psg);
  if (underlines.length < 2) return null;

  const ch = q.ch || [];
  if (ch.length === 0) return null;

  const mapping = matchChToUnderlines(ch, underlines);
  const matchedCount = mapping.filter(m => m !== -1).length;
  if (matchedCount < 2) return null; // 밑줄형 아닌 어법

  // 현재 순서 확인
  const validOrder = mapping.filter(m => m !== -1);
  let isOrdered = true;
  for (let j = 1; j < validOrder.length; j++) {
    if (validOrder[j] <= validOrder[j - 1]) { isOrdered = false; break; }
  }

  if (isOrdered) return null; // 이미 정렬됨

  // 밑줄 순서로 ch 재정렬
  const indexed = ch.map((c, i) => ({
    word: c,
    origIdx: i,
    ulIdx: mapping[i]
  }));

  // 밑줄에 매칭되는 것만 순서대로, 안 되는 것은 끝에
  const matched = indexed.filter(x => x.ulIdx !== -1).sort((a, b) => a.ulIdx - b.ulIdx);
  const unmatched = indexed.filter(x => x.ulIdx === -1);
  const reordered = [...matched, ...unmatched];

  const newCh = reordered.map(x => x.word);

  // ans 재매핑: 기존 정답 단어의 새 위치
  const oldAnsIdx = q.ans - 1; // 0-indexed
  if (oldAnsIdx < 0 || oldAnsIdx >= ch.length) return null;

  const ansWord = ch[oldAnsIdx];
  const newAnsIdx = newCh.findIndex(c => c === ansWord);
  const newAns = newAnsIdx + 1; // 1-indexed

  // det.analysis 마커 재정렬
  let newDet = q.det ? { ...q.det } : null;
  if (newDet && newDet.analysis) {
    const markers = ['①', '②', '③', '④', '⑤'];
    // 새 ch 순서에 맞게 analysis 재생성
    const lines = [];
    newCh.forEach((word, i) => {
      const marker = markers[i] || `(${i + 1})`;
      const isCorrect = (i + 1) !== newAns;
      const prefix = isCorrect ? '✅' : '❌';
      const suffix = isCorrect ? '적절' : '어법 오류';
      lines.push(`${prefix} ${marker} ${word}: ${suffix}`);
    });
    newDet = { ...newDet, analysis: lines.join('\n') };
  }

  // det.korean 재매핑
  if (newDet && newDet.korean) {
    const markers = ['①', '②', '③', '④', '⑤'];
    let korean = newDet.korean;
    // 기존 마커를 새 마커로 교체
    const oldMarker = markers[oldAnsIdx];
    const newMarker = markers[newAnsIdx];
    if (oldMarker && newMarker && oldMarker !== newMarker) {
      korean = korean.replace(oldMarker, newMarker);
    }
    newDet = { ...newDet, korean };
  }

  return {
    type: 'SEM-3',
    changes: {
      ch: { old: ch, new: newCh },
      ans: { old: q.ans, new: newAns },
      det: newDet
    }
  };
}

function fixSEM4(q) {
  if (!q.det || !q.det.korean) return null;
  if (typeof q.ans !== 'number') return null;

  const korean = q.det.korean;
  const arrowMatch = korean.match(/(\S+)\s*→\s*<b>([^<]+)<\/b>/);
  if (!arrowMatch) return null;

  const wrongWord = arrowMatch[1].replace(/[②③④①⑤]/g, '').trim().toLowerCase();
  const ch = (q.ch || []).map(c => (c || '').trim().toLowerCase());

  const wrongIdx = ch.findIndex(c => c === wrongWord || c.includes(wrongWord) || wrongWord.includes(c));
  if (wrongIdx === -1) return null;

  const expectedAns = wrongIdx + 1;
  if (q.ans === expectedAns) return null; // 이미 맞음

  return {
    type: 'SEM-4',
    changes: {
      ans: { old: q.ans, new: expectedAns }
    }
  };
}

function processFile(filePath, dryRun) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { path: filePath, fixes: [], error: e.message };
  }

  const fixes = [];
  const questions = data.questions || [];
  const fullPassage = data.fullPassage || '';

  questions.forEach((q, i) => {
    // SEM-3 먼저
    const sem3 = fixSEM3(q, fullPassage);
    if (sem3) {
      fixes.push({ qIdx: i, qId: q.id || (i + 1), ...sem3 });
      if (!dryRun) {
        q.ch = sem3.changes.ch.new;
        q.ans = sem3.changes.ans.new;
        if (sem3.changes.det) q.det = sem3.changes.det;
      }
    }

    // SEM-4 (SEM-3 수정 후 기준으로 체크)
    const sem4 = fixSEM4(q);
    if (sem4) {
      fixes.push({ qIdx: i, qId: q.id || (i + 1), ...sem4 });
      if (!dryRun) {
        q.ans = sem4.changes.ans.new;
      }
    }
  });

  if (fixes.length > 0 && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  return { path: filePath, fixes };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(a => a !== '--dry-run');

  if (filteredArgs.length === 0) {
    console.error('Usage: node validate/fix-sem.js [--dry-run] <path|--all>');
    process.exit(1);
  }

  let targetDir;
  if (filteredArgs[0] === '--all') {
    targetDir = path.join(ROOT, 'data');
  } else {
    targetDir = path.resolve(filteredArgs[0]);
    if (!fs.existsSync(targetDir)) {
      targetDir = path.join(ROOT, 'data', filteredArgs[0]);
    }
  }

  if (!fs.existsSync(targetDir)) {
    console.error(`Path not found: ${targetDir}`);
    process.exit(1);
  }

  const files = fs.statSync(targetDir).isDirectory()
    ? findJsonFiles(targetDir)
    : [targetDir];

  console.log(`${dryRun ? '[DRY-RUN] ' : ''}Scanning ${files.length} files...`);

  let totalSEM3 = 0, totalSEM4 = 0, filesFixed = 0;
  const sem1Files = [];

  files.forEach(f => {
    const result = processFile(f, dryRun);
    if (result.error) return;

    if (result.fixes.length > 0) {
      filesFixed++;
      const relPath = path.relative(ROOT, f);
      console.log(`\n📝 ${relPath}`);
      result.fixes.forEach(fix => {
        if (fix.type === 'SEM-3') {
          totalSEM3++;
          console.log(`  SEM-3 Q${fix.qId}: ch 재정렬 [${fix.changes.ch.old.join(',')}] → [${fix.changes.ch.new.join(',')}], ans ${fix.changes.ans.old}→${fix.changes.ans.new}`);
        } else if (fix.type === 'SEM-4') {
          totalSEM4++;
          console.log(`  SEM-4 Q${fix.qId}: ans ${fix.changes.ans.old}→${fix.changes.ans.new}`);
        }
      });
    }
  });

  console.log(`\n━━━ fix-sem 결과 ━━━`);
  console.log(`파일: ${files.length}개 스캔, ${filesFixed}개 수정`);
  console.log(`SEM-3 (ch↔밑줄 재정렬): ${totalSEM3}건`);
  console.log(`SEM-4 (det↔ans 재설정): ${totalSEM4}건`);
  if (dryRun) console.log(`\n⚠️ DRY-RUN 모드 — 실제 파일 변경 없음`);
}

main();
