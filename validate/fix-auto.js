#!/usr/bin/env node
/**
 * fix-auto.js — A7/F10-B/C18 자동 수정
 *
 * A7: 정답 3연속 → 중간 문항의 선지+정답 스왑
 * F10-B: accept에 소문자 변형 없음 → 자동 추가
 * C18: 선지 중복 → 오답 선지 교체
 *
 * Usage:
 *   node validate/fix-auto.js --all
 *   node validate/fix-auto.js --dry-run --all
 *   node validate/fix-auto.js data/모의고사/고1/3월
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

// ── A7: 정답 3연속 수정 ──
// 중간 문항(2번째)의 선지를 스왑하여 정답 번호 변경
function fixA7(questions) {
  const fixes = [];
  const mcQuestions = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');

  for (let i = 0; i < mcQuestions.length - 2; i++) {
    if (mcQuestions[i].ans === mcQuestions[i + 1].ans && mcQuestions[i + 1].ans === mcQuestions[i + 2].ans) {
      const mid = mcQuestions[i + 1];
      const ch = mid.ch;
      if (!ch || ch.length < 2) continue;

      const oldAns = mid.ans;
      const ansIdx = oldAns - 1;
      const hasMarker = ch.some(c => /^[①②③④⑤]/.test((c || '').trim()));

      // 스왑 대상 선택
      let swapIdx = -1;
      const candidates = ch.map((_, idx) => idx).filter(idx => idx !== ansIdx);
      for (const ci of candidates) {
        const newAns = ci + 1;
        if (newAns !== mcQuestions[i].ans && newAns !== mcQuestions[i + 2].ans) {
          swapIdx = ci;
          break;
        }
      }
      if (swapIdx === -1) swapIdx = candidates[0];
      if (swapIdx === -1) continue;

      if (hasMarker) {
        // 마커 문항: 마커 유지, 내용만 교체
        const markers = ['①', '②', '③', '④', '⑤'];
        const stripMarker = s => (s || '').replace(/^[①②③④⑤]\s*/, '').trim();
        const contentA = stripMarker(ch[ansIdx]);
        const contentB = stripMarker(ch[swapIdx]);
        ch[ansIdx] = `${markers[ansIdx]} ${contentB}`;
        ch[swapIdx] = `${markers[swapIdx]} ${contentA}`;
      } else {
        // 일반 문항: 선지 통째로 스왑
        const tmp = ch[ansIdx];
        ch[ansIdx] = ch[swapIdx];
        ch[swapIdx] = tmp;
      }
      mid.ans = swapIdx + 1;

      // det 업데이트 — analysis의 ✅/❌ 마커 스왑
      if (mid.det) {
        if (mid.det.analysis) {
          const lines = mid.det.analysis.split('\n');
          if (lines[ansIdx] && lines[swapIdx]) {
            const tmp = lines[ansIdx];
            lines[ansIdx] = lines[swapIdx];
            lines[swapIdx] = tmp;
            mid.det.analysis = lines.join('\n');
          }
        }
        if (mid.det.korean) {
          const markers = ['①', '②', '③', '④', '⑤'];
          mid.det.korean = mid.det.korean
            .replace(markers[ansIdx], '__TEMP__')
            .replace(markers[swapIdx], markers[ansIdx])
            .replace('__TEMP__', markers[swapIdx]);
        }
      }

      fixes.push({
        qId: mid.id,
        type: 'A7',
        detail: `ans ${oldAns}→${mid.ans} (ch[${ansIdx + 1}]↔ch[${swapIdx + 1}] 스왑)`
      });
    }
  }
  return fixes;
}

// ── F10-B: accept 소문자 변형 추가 ──
function fixF10B(questions) {
  const fixes = [];

  questions.forEach(q => {
    if (q.fmt !== 'written') return;
    if (!q.wa || !q.accept) return;

    const wa = typeof q.wa === 'string' ? q.wa : (Array.isArray(q.wa) ? q.wa[0] : null);
    if (!wa) return;

    const waLower = wa.toLowerCase();
    const hasLower = q.accept.some(a => a === waLower);
    if (hasLower) return;

    // 소문자 변형 추가
    q.accept.push(waLower);

    // 마침표 없는 변형도 추가
    const noPeriod = waLower.replace(/\.\s*$/, '').trim();
    if (noPeriod !== waLower && !q.accept.includes(noPeriod)) {
      q.accept.push(noPeriod);
    }

    // 마침표 있는 변형도 추가
    if (!waLower.endsWith('.')) {
      const withPeriod = waLower + '.';
      if (!q.accept.includes(withPeriod)) {
        q.accept.push(withPeriod);
      }
    }

    fixes.push({
      qId: q.id,
      type: 'F10-B',
      detail: `accept에 "${waLower}" 추가`
    });
  });

  return fixes;
}

// ── C18: 선지 중복 제거 ──
function fixC18(questions) {
  const fixes = [];

  questions.forEach(q => {
    if (!q.ch || q.ch.length < 2) return;
    if (q.fmt !== 'mc') return;

    const chLower = q.ch.map(c => (c || '').trim().toLowerCase());
    const seen = new Map();
    const dupIndices = [];

    chLower.forEach((c, i) => {
      if (seen.has(c)) {
        dupIndices.push(i);
      } else {
        seen.set(c, i);
      }
    });

    if (dupIndices.length === 0) return;

    // 정답 선지는 건드리지 않음
    const ansIdx = (q.ans || 0) - 1;

    dupIndices.forEach(di => {
      if (di === ansIdx) return; // 정답이 중복이면 스킵 (수동 필요)

      const oldWord = q.ch[di];
      // 다른 단어로 교체: "X" → "X (alt)" 표시
      // 실제로는 재출제가 필요하지만, 일단 중복 표시
      q.ch[di] = oldWord + ' [중복-수정필요]';

      fixes.push({
        qId: q.id,
        type: 'C18',
        detail: `ch[${di + 1}] "${oldWord}" 중복 → 태깅`
      });
    });
  });

  return fixes;
}

function processFile(filePath, dryRun) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { path: filePath, fixes: [], error: e.message };
  }

  const questions = data.questions || [];
  const allFixes = [];

  // A7
  const a7 = fixA7(questions);
  allFixes.push(...a7);

  // F10-B
  const f10b = fixF10B(questions);
  allFixes.push(...f10b);

  // C18은 태깅만 (실제 수정은 위험)
  // const c18 = fixC18(questions);
  // allFixes.push(...c18);

  if (allFixes.length > 0 && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  return { path: filePath, fixes: allFixes };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(a => a !== '--dry-run');

  if (filteredArgs.length === 0) {
    console.error('Usage: node validate/fix-auto.js [--dry-run] <path|--all>');
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

  console.log(`${dryRun ? '[DRY-RUN] ' : ''}Scanning ${files.length} files...\n`);

  let totalA7 = 0, totalF10B = 0, totalC18 = 0, filesFixed = 0;

  files.forEach(f => {
    const result = processFile(f, dryRun);
    if (result.error || result.fixes.length === 0) return;

    filesFixed++;
    const relPath = path.relative(ROOT, f);
    console.log(`📝 ${relPath}`);
    result.fixes.forEach(fix => {
      if (fix.type === 'A7') { totalA7++; console.log(`  A7 Q${fix.qId}: ${fix.detail}`); }
      else if (fix.type === 'A7-SKIP') { console.log(`  A7 Q${fix.qId}: ⚠️ ${fix.reason}`); }
      else if (fix.type === 'F10-B') { totalF10B++; console.log(`  F10-B Q${fix.qId}: ${fix.detail}`); }
      else if (fix.type === 'C18') { totalC18++; console.log(`  C18 Q${fix.qId}: ${fix.detail}`); }
    });
  });

  console.log(`\n━━━ fix-auto 결과 ━━━`);
  console.log(`파일: ${files.length}개 스캔, ${filesFixed}개 수정`);
  console.log(`A7 (정답3연속 스왑): ${totalA7}건`);
  console.log(`F10-B (accept 소문자): ${totalF10B}건`);
  if (totalC18) console.log(`C18 (선지중복 태깅): ${totalC18}건`);
  if (dryRun) console.log(`\n⚠️ DRY-RUN 모드 — 실제 파일 변경 없음`);
}

main();
