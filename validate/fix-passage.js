#!/usr/bin/env node
/**
 * fix-passage.js — passage 길이 자동 조정
 *
 * V63/V66/V74/V75/V77/V78: passage 문장 수를 유형별 권장 범위로 조정
 * fullPassage에서 적절한 구간을 추출하여 passage를 재설정
 *
 * Usage:
 *   node validate/fix-passage.js --all
 *   node validate/fix-passage.js --dry-run --all
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function findJsonFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '_passages' && entry.name !== 'node_modules') {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
      results.push(full);
    }
  }
  return results;
}

function countSentences(text) {
  const clean = (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean.match(/[.!?]+(?=\s|$)/g) || []).length;
}

function splitSentences(text) {
  // HTML 태그 보존하면서 문장 분리
  const clean = (text || '').replace(/<br\s*\/?>/gi, '\n');
  // 문장 단위 분리 (마침표/물음표/느낌표 뒤 공백)
  const parts = clean.split(/(?<=[.!?])\s+/);
  return parts.filter(p => p.trim().length > 0);
}

function extractPassage(fullPassage, targetSentences, q) {
  if (!fullPassage || fullPassage.trim().length === 0) return null;

  const sentences = splitSentences(fullPassage);
  if (sentences.length <= targetSentences) {
    // 전체 passage가 목표보다 작거나 같으면 전체 사용
    return fullPassage;
  }

  // 문항에 특정 키워드가 있으면 그 근처에서 추출
  const stem = (q.stem || '').replace(/<[^>]+>/g, '').toLowerCase();
  const wa = typeof q.wa === 'string' ? q.wa.toLowerCase() : '';
  const ans = (q.ch && q.ch[((q.ans || 1) - 1)]) || '';
  const ansLower = ans.replace(/^[①②③④⑤]\s*/, '').toLowerCase();

  // 정답/오답 키워드가 포함된 문장 찾기
  let bestStart = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sent = sentences[i].toLowerCase();
    if ((ansLower && sent.includes(ansLower)) || (wa && sent.includes(wa))) {
      // 이 문장을 중심으로 추출
      bestStart = Math.max(0, i - Math.floor(targetSentences / 2));
      break;
    }
  }

  // 범위 초과 방지
  bestStart = Math.min(bestStart, sentences.length - targetSentences);
  bestStart = Math.max(0, bestStart);

  const selected = sentences.slice(bestStart, bestStart + targetSentences);
  return selected.join(' ');
}

// 유형별 적정 문장 수
const TYPE_TARGETS = {
  // V74: 어형변환 2~4문장
  '어형 변환': 3,
  '어형 변환 (서술형)': 3,
  '어형변환': 3,

  // V75: (A)(B)(C) 5~8문장
  '(A)(B)(C) 조합형': 6,

  // V78: 동의어/반의어 3~5문장
  '동의어 고르기': 4,
  '반의어 고르기': 4,
  '영영풀이 매칭': 4,

  // V77: 내용일치 5~10문장
  '내용이해': 7,
  '내용일치': 7,
  '내용불일치': 7,
  'T/F': 7,
  'TF': 7,

  // V66: 빈칸형 5문장+
  '빈칸추론': 6,
  '빈칸 추론': 6,
  '빈칸 문맥 완성': 6,
  '빈칸 어휘 완성': 6,

  // V63: 일반 — 최소 3문장
  '문맥상 부적절한 어휘': 5,
  '부적절': 5,
};

// 너무 짧은 기준
const MIN_SENTENCES = {
  '어형 변환': 2, '어형 변환 (서술형)': 2, '어형변환': 2,
  '(A)(B)(C) 조합형': 5,
  '동의어 고르기': 3, '반의어 고르기': 3, '영영풀이 매칭': 3,
  '내용이해': 5, '내용일치': 5, '내용불일치': 5, 'T/F': 5, 'TF': 5,
  '빈칸추론': 5, '빈칸 추론': 5, '빈칸 문맥 완성': 5, '빈칸 어휘 완성': 5,
  '문맥상 부적절한 어휘': 3, '부적절': 3,
};

// 너무 긴 기준
const MAX_SENTENCES = {
  '어형 변환': 4, '어형 변환 (서술형)': 4, '어형변환': 4,
  '(A)(B)(C) 조합형': 8,
  '동의어 고르기': 5, '반의어 고르기': 5, '영영풀이 매칭': 5,
  '내용이해': 10, '내용일치': 10, '내용불일치': 10, 'T/F': 10, 'TF': 10,
};

function processFile(filePath, dryRun) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { path: filePath, fixes: [] };
  }

  const fixes = [];
  const fullPassage = data.fullPassage || '';
  if (!fullPassage || fullPassage.length < 50) return { path: filePath, fixes: [] };

  const fpSentCount = countSentences(fullPassage);

  (data.questions || []).forEach((q, i) => {
    const typeNorm = (q.type || '').trim();
    const passage = q.passage;

    // passage가 null이면 스킵 (의도적으로 없는 경우)
    if (passage === null || passage === undefined) return;

    const sentCount = countSentences(passage);
    const minReq = MIN_SENTENCES[typeNorm];
    const maxReq = MAX_SENTENCES[typeNorm];
    const target = TYPE_TARGETS[typeNorm];

    if (!target) return; // 대상 유형 아님

    let needsFix = false;
    let reason = '';

    if (minReq && sentCount < minReq) {
      needsFix = true;
      reason = `${sentCount}문장 < ${minReq}문장 (최소)`;
    } else if (maxReq && sentCount > maxReq) {
      needsFix = true;
      reason = `${sentCount}문장 > ${maxReq}문장 (최대)`;
    }

    if (!needsFix) return;

    // fullPassage에서 적정 길이 추출
    const newPassage = extractPassage(fullPassage, target, q);
    if (!newPassage) return;

    const newSentCount = countSentences(newPassage);

    // 개선이 없으면 스킵
    if (minReq && newSentCount < minReq) return;
    if (maxReq && newSentCount > maxReq) return;

    // (A)(B)(C) 문항은 passage에 빈칸 마커가 있으므로 단순 교체 위험
    if (typeNorm === '(A)(B)(C) 조합형' && passage.includes('(A)')) return;

    // 밑줄/빈칸이 있는 passage는 교체 위험
    if (passage.includes('<u>') || passage.includes('____') || passage.includes('<b>(')) return;

    fixes.push({
      qId: q.id || (i + 1),
      type: typeNorm,
      oldSent: sentCount,
      newSent: newSentCount,
      reason
    });

    if (!dryRun) {
      q.passage = newPassage;
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
    console.error('Usage: node validate/fix-passage.js [--dry-run] <path|--all>');
    process.exit(1);
  }

  let targetDir;
  if (filteredArgs[0] === '--all') {
    targetDir = path.join(ROOT, 'data');
  } else {
    targetDir = path.resolve(filteredArgs[0]);
    if (!fs.existsSync(targetDir)) targetDir = path.join(ROOT, 'data', filteredArgs[0]);
  }

  const files = fs.statSync(targetDir).isDirectory()
    ? findJsonFiles(targetDir) : [targetDir];

  console.log(`${dryRun ? '[DRY-RUN] ' : ''}Scanning ${files.length} files...\n`);

  let totalFixes = 0, filesFixed = 0;
  const byType = {};

  files.forEach(f => {
    const result = processFile(f, dryRun);
    if (result.fixes.length === 0) return;

    filesFixed++;
    const relPath = path.relative(ROOT, f);
    console.log(`📝 ${relPath}`);
    result.fixes.forEach(fix => {
      totalFixes++;
      byType[fix.type] = (byType[fix.type] || 0) + 1;
      console.log(`  Q${fix.qId} ${fix.type}: ${fix.oldSent}→${fix.newSent}문장 (${fix.reason})`);
    });
  });

  console.log(`\n━━━ fix-passage 결과 ━━━`);
  console.log(`파일: ${files.length}개 스캔, ${filesFixed}개 수정`);
  console.log(`총 수정: ${totalFixes}건`);
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => {
    console.log(`  ${t}: ${n}건`);
  });
  if (dryRun) console.log(`\n⚠️ DRY-RUN 모드 — 실제 파일 변경 없음`);
}

main();
