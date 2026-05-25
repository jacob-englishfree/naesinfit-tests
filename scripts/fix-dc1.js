#!/usr/bin/env node
/**
 * fix-dc1.js — DC-1 수정: det.analysis의 ←정답 마커를 ans와 일치시킴
 *
 * DC-1: det.analysis에서 ←정답이 표시된 마커 번호 ≠ ans
 * 수정: ans를 기준으로 det.analysis의 ←정답 위치를 옮김
 * - 기존 ←정답 제거
 * - ans에 해당하는 마커 라인에 ←정답 추가
 * - ✅/❌ 아이콘도 ans 기준으로 재배치
 */

const fs = require('fs');
const path = require('path');

const MARKERS = ['①', '②', '③', '④', '⑤'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.error('Usage: node fix-dc1.js <file.json or dir> [--dry-run]');
  process.exit(1);
}

function collectFiles(p) {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    let result = [];
    for (const e of fs.readdirSync(p)) {
      result = result.concat(collectFiles(path.join(p, e)));
    }
    return result;
  }
  if (p.endsWith('단어.json') || p.endsWith('워크북.json') || p.endsWith('퀴즈.json')) {
    return [p];
  }
  return [];
}

function findDetAnswerMarker(analysis) {
  if (!analysis) return null;
  // Find which marker has ←정답 or — 정답
  for (let i = 0; i < MARKERS.length; i++) {
    const m = MARKERS[i];
    // Check if this marker's line has ←정답
    const re = new RegExp(m + '[^\\n]*(?:←\\s*정답|—\\s*정답)');
    if (re.test(analysis)) return i + 1; // 1-indexed
  }
  return null;
}

function fixAnalysis(analysis, ans) {
  if (!analysis) return analysis;

  // Remove existing ←정답 / — 정답
  let fixed = analysis.replace(/\s*←\s*정답/g, '').replace(/\s*—\s*정답/g, '');

  // Split into lines
  const lines = fixed.split('\n');
  const ansMarker = MARKERS[ans - 1];

  const newLines = lines.map(line => {
    const trimmed = line.trim();

    // Find which marker this line belongs to
    let lineMarker = null;
    for (const m of MARKERS) {
      if (trimmed.includes(m)) {
        lineMarker = m;
        break;
      }
    }

    if (!lineMarker) return line;

    // Fix ✅/❌ icons
    let newLine = line;
    if (lineMarker === ansMarker) {
      // This should be the answer line — add ←정답, ensure ❌
      newLine = newLine.replace(/✅\s*/, '❌ ');
      if (!newLine.includes('←정답')) {
        newLine = newLine.trimEnd() + ' ←정답';
      }
    } else {
      // This should NOT be the answer — ensure ✅, remove ←정답
      newLine = newLine.replace(/❌\s*/, '✅ ');
    }

    return newLine;
  });

  return newLines.join('\n');
}

let fileList = [];
for (const f of files) fileList = fileList.concat(collectFiles(f));
fileList.sort();

let totalFixed = 0, fixedFiles = 0;

for (const filePath of fileList) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { continue; }
  if (!data.questions) continue;

  let modified = false;
  const fixes = [];

  for (const q of data.questions) {
    if (q.fmt !== 'mc' || !q.det || !q.det.analysis) continue;

    const detAnsMarker = findDetAnswerMarker(q.det.analysis);
    if (detAnsMarker === null) continue;
    if (detAnsMarker === q.ans) continue; // Already correct

    fixes.push(`Q${q.id}: det ←정답=${MARKERS[detAnsMarker-1]}(${detAnsMarker}) → ${MARKERS[q.ans-1]}(${q.ans})`);

    q.det.analysis = fixAnalysis(q.det.analysis, q.ans);
    modified = true;
    totalFixed++;
  }

  if (modified) {
    fixedFiles++;
    if (dryRun) {
      console.log(`[WOULD FIX] ${filePath}`);
    } else {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`[FIXED] ${filePath}`);
    }
    for (const f of fixes) console.log(`  ${f}`);
  }
}

console.log(`\n=== 결과 ===`);
console.log(`총 파일: ${fileList.length}, 수정: ${fixedFiles}, 총 수정 문항: ${totalFixed}`);
if (dryRun) console.log('(DRY RUN)');
