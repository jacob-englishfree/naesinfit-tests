#!/usr/bin/env node
/**
 * fix-det-analysis-batch.js v2 — det.analysis ✅/❌ 마커를 ans에 맞춰 수정
 *
 * 두 가지 컨벤션 자동 감지:
 *   Convention A: ✅=정답(1개), ❌=오답(나머지) — e.g., ✅ ② 정답 설명 / ❌ ① ... / ❌ ③ ...
 *   Convention B: ❌=정답(1개, 에러있는것), ✅=정상(나머지) — e.g., ❌ ① 오류 / ✅ ②③④ 올바름
 *
 * 감지 로직:
 *   - 단독 ✅ 1개 + 나머지 ❌ → Convention A
 *   - 단독 ❌ 1개 + 나머지 ✅ → Convention B
 *   - 그 외 → skip (ambiguous)
 *
 * ans는 건드리지 않고 det.analysis만 수정
 */

const fs = require('fs');
const path = require('path');

const MK = ['①', '②', '③', '④', '⑤'];
const MK_SET = new Set(MK);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const isAll = args.includes('--all');
const verbose = args.includes('--verbose');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.') && e.name !== 'node_modules') {
      out.push(...walk(path.join(dir, e.name)));
    } else if (['단어.json', '워크북.json', '퀴즈.json'].includes(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * 분석 텍스트에서 단독 마커 별 ✅/❌ 맵 추출
 * 그룹 마커(①②④)도 개별로 분해
 */
function parseMarkerMap(analysis) {
  const map = {}; // marker → '✅' or '❌'
  // 단독: ✅ ③ text  또는  ❌ ② text
  const singleRe = /([✅❌])\s*([①②③④⑤])(?![①②③④⑤])/g;
  let m;
  while ((m = singleRe.exec(analysis)) !== null) {
    map[m[2]] = m[1];
  }
  // 그룹: ❌ ①②④ text  또는  ✅ ①②④ text
  const groupRe = /([✅❌])\s*([①②③④⑤]{2,})/g;
  while ((m = groupRe.exec(analysis)) !== null) {
    for (const c of m[2]) {
      if (MK_SET.has(c) && !map[c]) {
        map[c] = m[1];
      }
    }
  }
  return map;
}

/**
 * 컨벤션 감지
 * Returns: 'A' (✅=answer), 'B' (❌=answer), or null (ambiguous)
 */
function detectConvention(markerMap) {
  const checks = Object.entries(markerMap).filter(([, v]) => v === '✅');
  const crosses = Object.entries(markerMap).filter(([, v]) => v === '❌');
  const total = checks.length + crosses.length;
  if (total < 2) return null;
  // 1 ✅ + 나머지 ❌ → Convention A
  if (checks.length === 1 && crosses.length >= 2) return 'A';
  // 1 ❌ + 나머지 ✅ → Convention B
  if (crosses.length === 1 && checks.length >= 2) return 'B';
  return null;
}

/**
 * 마커 스왑 (동일 컨벤션 내에서)
 * Convention A: ✅ wrongMarker → ✅ correctMarker, ❌ correctMarker → ❌ wrongMarker
 * Convention B: ❌ wrongMarker → ❌ correctMarker, ✅ correctMarker → ✅ wrongMarker
 */
function swapMarkers(analysis, oldAnswerMarker, correctMarker) {
  if (oldAnswerMarker === correctMarker) return null;

  let newAnalysis = analysis;
  const TEMP1 = '⟦SWAP1⟧';
  const TEMP2 = '⟦SWAP2⟧';

  // 단독 마커에서 스왑 시도
  const old1Re = new RegExp('(?<=[✅❌]\\s*)' + esc(oldAnswerMarker) + '(?![①②③④⑤])');
  const old2Re = new RegExp('(?<=[✅❌]\\s*)' + esc(correctMarker) + '(?![①②③④⑤])');

  const hasOld1 = old1Re.test(newAnalysis);
  const hasOld2 = old2Re.test(newAnalysis);

  if (hasOld1 && hasOld2) {
    // 둘 다 단독 마커로 존재 → 심볼 스왑
    newAnalysis = newAnalysis.replace(old1Re, TEMP1);
    newAnalysis = newAnalysis.replace(old2Re, TEMP2);
    newAnalysis = newAnalysis.replace(TEMP1, correctMarker);
    newAnalysis = newAnalysis.replace(TEMP2, oldAnswerMarker);
    return newAnalysis !== analysis ? newAnalysis : null;
  }

  if (hasOld1 && !hasOld2) {
    // correctMarker가 그룹에 있음 — 그룹에서 빼고 oldAnswerMarker를 그룹에 넣기
    return swapWithGroup(newAnalysis, oldAnswerMarker, correctMarker);
  }

  if (!hasOld1 && hasOld2) {
    // oldAnswerMarker가 그룹에 있음
    return swapWithGroup(newAnalysis, oldAnswerMarker, correctMarker);
  }

  // 둘 다 그룹에 있음 — 복잡, skip
  return null;
}

function swapWithGroup(analysis, oldMarker, correctMarker) {
  let newAnalysis = analysis;

  // 그룹에서 correctMarker 제거
  const groupRe = /([✅❌])\s*([①②③④⑤]{2,})/g;
  let m;
  let found = false;
  const tempAnalysis = newAnalysis;
  while ((m = groupRe.exec(tempAnalysis)) !== null) {
    if (m[2].includes(correctMarker)) {
      const remaining = m[2].split('').filter(c => c !== correctMarker).join('');
      // oldMarker도 그룹에 추가 (정렬)
      const withOld = (remaining + oldMarker).split('').filter(c => MK_SET.has(c));
      withOld.sort((a, b) => MK.indexOf(a) - MK.indexOf(b));
      const newGroup = withOld.join('');
      const replacement = `${m[1]} ${newGroup}`;
      newAnalysis = newAnalysis.substring(0, m.index) + replacement + newAnalysis.substring(m.index + m[0].length);

      // 단독 oldMarker를 correctMarker로 변경
      const singleOldRe = new RegExp('(?<=(?:✅|❌)\\s*)' + esc(oldMarker) + '(?![①②③④⑤])');
      newAnalysis = newAnalysis.replace(singleOldRe, correctMarker);
      found = true;
      break;
    }
  }

  if (!found) return null;
  return newAnalysis !== analysis ? newAnalysis : null;
}

function fixQuestion(q) {
  if (q.fmt !== 'mc') return null;
  if (!Array.isArray(q.ch) || typeof q.ans !== 'number') return null;
  if (!q.det || !q.det.analysis) return null;
  if (q.ans < 1 || q.ans > q.ch.length) return null;

  const analysis = q.det.analysis;
  const correctChoice = (q.ch[q.ans - 1] || '').trim();

  // 정답 마커 결정
  let correctMarker;
  if (MK_SET.has(correctChoice)) {
    correctMarker = correctChoice; // marker-ch
  } else {
    correctMarker = MK[q.ans - 1]; // non-marker-ch
  }

  // 현재 마커맵 파싱
  const markerMap = parseMarkerMap(analysis);
  if (!markerMap[correctMarker]) return null; // 정답 마커가 분석에 없음

  // 컨벤션 감지
  const conv = detectConvention(markerMap);
  if (!conv) return null; // ambiguous → skip

  // 현재 상태 검증
  if (conv === 'A') {
    // ✅ = answer. correctMarker에 ✅가 있어야 함
    if (markerMap[correctMarker] === '✅') return null; // 이미 OK
    // ✅가 잘못된 마커에 있음 → 스왑
    const currentAnswer = Object.entries(markerMap).find(([, v]) => v === '✅');
    if (!currentAnswer) return null;
    const result = swapMarkers(analysis, currentAnswer[0], correctMarker);
    return result ? { analysis: result, changed: true, conv: 'A' } : null;
  } else {
    // Convention B: ❌ = answer. correctMarker에 ❌가 있어야 함
    if (markerMap[correctMarker] === '❌') return null; // 이미 OK
    // ❌가 잘못된 마커에 있음 → 스왑
    const currentAnswer = Object.entries(markerMap).find(([, v]) => v === '❌');
    if (!currentAnswer) return null;
    const result = swapMarkers(analysis, currentAnswer[0], correctMarker);
    return result ? { analysis: result, changed: true, conv: 'B' } : null;
  }
}

// Main
const target = isAll ? path.resolve(__dirname, '..', 'data') : args.find(a => !a.startsWith('--'));
if (!target) {
  console.error('Usage: node scripts/fix-det-analysis-batch.js [--dry] [--verbose] <file|--all>');
  process.exit(1);
}

const files = isAll ? walk(target) : [path.resolve(target)];
console.log(`📝 ${files.length}개 파일 처리${dryRun ? ' (드라이런)' : ''}...`);

let totalFiles = 0, totalQuestions = 0;
let convAFixed = 0, convBFixed = 0;
const failedFiles = [];

for (const f of files) {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    const data = JSON.parse(raw);
    let fileFixed = 0;

    for (const q of data.questions || []) {
      const result = fixQuestion(q);
      if (result && result.changed) {
        q.det.analysis = result.analysis;
        fileFixed++;
        totalQuestions++;
        if (result.conv === 'A') convAFixed++;
        else convBFixed++;
      }
    }

    if (fileFixed > 0) {
      if (!dryRun) {
        fs.writeFileSync(f, JSON.stringify(data, null, 2));
      }
      totalFiles++;
      if (verbose && totalFiles <= 30) {
        console.log(`  ${dryRun ? 'WOULD FIX' : 'FIXED'} ${fileFixed}Q: ${path.relative(process.cwd(), f)}`);
      }
    }
  } catch (e) {
    failedFiles.push({ file: path.relative(process.cwd(), f), error: e.message });
  }
}

console.log(`\n━━━ 결과 ━━━`);
console.log(`  수정 파일: ${totalFiles}`);
console.log(`  수정 문항: ${totalQuestions}`);
console.log(`    Convention A (✅=answer): ${convAFixed}`);
console.log(`    Convention B (❌=answer): ${convBFixed}`);
if (failedFiles.length) {
  console.log(`  실패: ${failedFiles.length}`);
  if (verbose) failedFiles.slice(0, 10).forEach(f => console.log(`    ${f.file}: ${f.error}`));
}
if (dryRun) console.log(`  (드라이런 — 실제 쓰기 안 함)`);
