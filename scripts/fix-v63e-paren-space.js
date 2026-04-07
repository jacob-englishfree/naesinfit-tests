#!/usr/bin/env node
// V63-E 자동수정: 어형변환 passage/stem에서 "( word )" → "(word)" 공백 제거
// validate regex가 "[\(\[][A-Za-z]"를 찾으므로 공백 있으면 miss
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
    const typeNorm = (q.type || '').trim();
    if (!typeNorm.includes('어형')) continue;

    // Fix passage: "( word )" → "(word)"
    const passage = (q.passage || '').toString();
    const fixedPassage = passage.replace(/\(\s+([A-Za-z][A-Za-z\s\-']*?)\s+\)/g, '($1)');
    if (fixedPassage !== passage) {
      q.passage = fixedPassage;
      mutated = true;
      fixed++;
    }

    // Fix stem too
    const stem = (q.stem || '').toString();
    const fixedStem = stem.replace(/\(\s+([A-Za-z][A-Za-z\s\-']*?)\s+\)/g, '($1)');
    if (fixedStem !== stem) {
      q.stem = fixedStem;
      mutated = true;
    }
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);
console.log(`\n━━━ V63-E 공백 자동수정 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
