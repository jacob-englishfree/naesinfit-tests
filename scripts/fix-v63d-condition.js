#!/usr/bin/env node
// V63-D 자동수정: 영작 서술형 stem에 "조건: N단어 사용" 추가
// N = q.wa의 단어 수
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');

let scanned = 0, fixed = 0, noWa = 0;
const noWaList = [];

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
    if (!(typeNorm === '영작' || stem.includes('영작'))) continue;
    if (stem.includes('조건') || stem.includes('사용할 것') || stem.includes('사용하여')) continue;

    const wa = (q.wa || '').toString().trim();
    if (!wa) {
      noWa++;
      noWaList.push(`${path.relative(ROOT, file)} :: Q${q.id || '?'}`);
      continue;
    }
    // count words in wa (English-only)
    const wordCount = (wa.match(/[A-Za-z']+/g) || []).length;
    if (wordCount === 0) {
      noWa++;
      noWaList.push(`${path.relative(ROOT, file)} :: Q${q.id || '?'} (wa not English)`);
      continue;
    }

    // append condition to stem
    const condition = ` (조건: ${wordCount}단어 사용)`;
    q.stem = stem.trimEnd() + condition;
    mutated = true;
    fixed++;
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);

console.log(`\n━━━ V63-D 자동수정 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
console.log(`wa 없음 (재출제): ${noWa}`);
if (noWa > 0) {
  fs.writeFileSync(
    path.join(__dirname, '..', 'reports', 'v63d-no-wa.txt'),
    noWaList.join('\n') + '\n'
  );
  console.log(`→ reports/v63d-no-wa.txt`);
}
