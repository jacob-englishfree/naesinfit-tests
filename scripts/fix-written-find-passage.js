#!/usr/bin/env node
// V-WRITTEN-FIND-PASSAGE 자동수정: "본문에서 찾아" stem인데 wa가 passage에 없음
// 해결: passage의 _____ 빈칸을 wa(정답)로 복원 → 학생이 본문에서 찾을 수 있게
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const FIND_RE = /본문에서\s*찾아|본문에서\s*골라|지문에서\s*찾아|지문에서\s*골라/;

let scanned = 0, fixed = 0, skipped = 0;
const skipList = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) processFile(p);
  }
}

function processFile(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  if (!data || !Array.isArray(data.questions)) return;

  const fileFP = (data.fullPassage || data.passage || '').toString().trim();

  let mutated = false;
  for (const q of data.questions) {
    scanned++;
    if (q.fmt !== 'written') continue;
    const wa = (q.wa || '').toString().trim();
    if (!wa) continue;
    const stem = (q.stem || '').toString();
    if (!FIND_RE.test(stem)) continue;

    // Check if wa is missing from visible passage
    const passage = (q.passage || '').toString();
    const passageClean = passage.replace(/<[^>]+>/g, '').toLowerCase();
    if (passageClean.includes(wa.toLowerCase())) continue; // already visible

    // Strategy 1: passage has _____ → replace with wa
    if (passage.includes('_____') || passage.includes('__________')) {
      const blankRe = /_{5,}/;
      q.passage = passage.replace(blankRe, wa);
      mutated = true;
      fixed++;
      continue;
    }

    // Strategy 2: passage empty → use fullPassage (should contain wa)
    const fp = (q.fullPassage || fileFP || '').toString().trim();
    if (fp && fp.toLowerCase().includes(wa.toLowerCase())) {
      q.passage = fp;
      mutated = true;
      fixed++;
      continue;
    }

    skipped++;
    skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (wa="${wa}" not in passage or fullPassage, no blank found)`);
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);

console.log(`\n━━━ V-WRITTEN-FIND-PASSAGE 자동수정 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
console.log(`skipped: ${skipped}`);
if (skipped > 0) {
  fs.writeFileSync(path.join(__dirname, '..', 'reports', 'vwfp-skipped.txt'), skipList.join('\n') + '\n');
}
