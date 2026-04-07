#!/usr/bin/env node
// P-SEN 자동수정: 동의어/반의어 stem에서 '단어' 따옴표 패턴을 <u>단어</u>로 교체
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');

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

  let mutated = false;
  for (const q of data.questions) {
    scanned++;
    const t = (q.type || '').trim();
    if (!(t.includes('동의어') || t.includes('반의어'))) continue;
    const stem = (q.stem || '').toString();
    if (stem.includes('<u>') || stem.includes('<b>') || stem.includes('밑줄 친') === false && !stem.includes('밑줄')) {
      // stem must mention "밑줄" to be safe
    }
    if (stem.includes('<u>') || stem.includes('<b>')) continue;
    // Already has 밑줄 text? we only need to add <u> around a word
    // Look for '<word>' pattern (single quotes) or "<word>"
    const match = stem.match(/['"]([A-Za-z][A-Za-z\s'-]*?)['"]/);
    if (!match) {
      skipped++;
      skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (no quoted word)`);
      continue;
    }
    const word = match[1];
    const replaced = stem.replace(match[0], `<u>${word}</u>`);
    q.stem = replaced;
    mutated = true;
    fixed++;
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);

console.log(`\n━━━ P-SEN 자동수정 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
console.log(`skipped (패턴불일치): ${skipped}`);
if (skipped > 0) {
  fs.writeFileSync(
    path.join(__dirname, '..', 'reports', 'psen-skipped.txt'),
    skipList.join('\n') + '\n'
  );
}
