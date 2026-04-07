#!/usr/bin/env node
// V61/V73 자동수정: 영작 서술형인데 passage 있음 → passage를 null로 비움
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');

let scanned = 0, fixed = 0;

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

  let mutated = false;
  for (const q of data.questions) {
    scanned++;
    if (q.fmt !== 'written') continue;
    const typeNorm = (q.type || '').trim();
    const stem = (q.stem || '').toString();
    // 영작 계열만
    if (!(typeNorm.includes('영작') || stem.includes('영작'))) continue;
    // passage가 있으면 null로
    const passage = (q.passage || '').toString().trim();
    if (!passage) continue;
    q.passage = null;
    mutated = true;
    fixed++;
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);

console.log(`\n━━━ V61/V73 자동수정 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed (passage→null): ${fixed}`);
