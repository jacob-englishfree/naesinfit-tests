#!/usr/bin/env node
/**
 * S-TF-ORDER 수정
 * T/F 문항에서 ch=["F","T"]를 ch=["T","F"]로 변경하고 ans를 flip
 */
const fs = require('fs');

const targetFiles = process.argv.slice(2);
if (!targetFiles.length) { console.error('Usage: node fix-tf-order.js <file...>'); process.exit(1); }

let fixed = 0;
for (const jsonFile of targetFiles) {
  if (!fs.existsSync(jsonFile)) { console.log(`[SKIP] ${jsonFile} — not found`); continue; }
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  let changed = false;
  for (const q of data.questions || []) {
    if (!q.ch || q.ch.length !== 2) continue;
    const tf = q.ch.map(c => (c || '').trim().toUpperCase());
    if (tf[0] === 'F' && tf[1] === 'T') {
      // swap ch and flip ans
      q.ch = ['T', 'F'];
      q.ans = q.ans === 1 ? 2 : 1;  // if was 1 (F=wrong) → now 2 (F=wrong); if was 2 (T=correct) → now 1 (T=correct)
      changed = true;
      console.log(`  Q${q.id}: ch F→T swapped, ans=${q.ans}`);
    }
  }
  if (changed) {
    fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[FIXED] ${jsonFile}`);
    fixed++;
  } else {
    console.log(`[SKIP] ${jsonFile}`);
  }
}
console.log(`\n완료: ${fixed}개 수정`);
