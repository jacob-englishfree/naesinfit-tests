#!/usr/bin/env node
/**
 * fix-marker-ch.js — 마커형 문항의 ch 순서 복원
 *
 * fix-a6a7.js가 마커형 ch를 잘못 shuffle한 경우를 수정:
 * - ch = ["①","③","④","②"], ans=4 → ch = ["①","②","③","④"], ans=2
 * - 마커형: ch가 전부 ①②③④⑤인 문항
 *
 * 복원 후 A6/A7이 다시 깨질 수 있으므로, 이후 비마커형만 대상으로 A6/A7 재수정 필요
 */

const fs = require('fs');
const path = require('path');

const MARKERS = ['①', '②', '③', '④'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.error('Usage: node scripts/fix-marker-ch.js <file.json or dir> [--dry-run]');
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
    if (q.fmt !== 'mc' || !Array.isArray(q.ch) || q.ch.length !== 4) continue;

    // 마커형 체크: ch가 전부 ①②③④ 중 하나
    const isMarker = q.ch.every(c => typeof c === 'string' && /^[①②③④⑤]\s*$/.test(c.trim()));
    if (!isMarker) continue;

    // 이미 순서대로면 스킵
    const sorted = q.ch.map(c => c.trim());
    if (sorted[0] === '①' && sorted[1] === '②' && sorted[2] === '③' && sorted[3] === '④') continue;

    // 현재 정답 마커 = ch[ans-1]
    const answerMarker = q.ch[q.ans - 1].trim();
    const newAns = MARKERS.indexOf(answerMarker) + 1; // 1-indexed

    if (newAns < 1 || newAns > 4) {
      console.error(`  [ERROR] Q${q.id}: 정답 마커 ${answerMarker}을 찾을 수 없음`);
      continue;
    }

    fixes.push(`Q${q.id}: ch=[${sorted.join(',')}] ans=${q.ans} → ch=[①,②,③,④] ans=${newAns}`);

    q.ch = ['①', '②', '③', '④'];
    q.ans = newAns;
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
