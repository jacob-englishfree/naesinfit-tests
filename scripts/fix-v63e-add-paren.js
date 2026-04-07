#!/usr/bin/env node
// V63-E 자동수정 2차: 어형변환 passage에 괄호가 전혀 없는 케이스
// wa(정답 변환형)에서 원형(stem form) 추출 → passage에서 정확히 매칭 → [원형]으로 교체
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
let scanned = 0, fixed = 0, skipped = 0;
const skipList = [];

// Simple stemming: remove common suffixes to get base form
function guessBase(wa) {
  wa = wa.trim();
  // Common transformations (reverse)
  const rules = [
    [/tion$/i, 'te'],      // automation → automate
    [/sion$/i, 'de'],      // explosion → explode
    [/ment$/i, ''],        // achievement → achieve
    [/ness$/i, ''],        // happiness → happy→happi (unreliable)
    [/ity$/i, ''],         // creativity → creative→creativ
    [/ance$/i, ''],        // importance → important→import
    [/ence$/i, ''],        // independence → independent→independ
    [/ous$/i, ''],         // dangerous → danger
    [/ive$/i, ''],         // creative → creat
    [/ful$/i, ''],         // beautiful → beauti
    [/less$/i, ''],        // careless → care
    [/ly$/i, ''],          // recently → recent
    [/ing$/i, ''],         // expressing → express
    [/ed$/i, ''],          // surprised → surpris
    [/er$/i, ''],          // bigger → bigg
    [/est$/i, ''],         // biggest → bigg
    [/es$/i, ''],          // watches → watch
    [/s$/i, ''],           // runs → run
  ];
  // Return candidates
  const candidates = [wa]; // wa itself might be in passage
  for (const [re, repl] of rules) {
    if (re.test(wa)) {
      const base = wa.replace(re, repl);
      if (base.length >= 3) candidates.push(base);
    }
  }
  return [...new Set(candidates)];
}

function escReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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
    const stem = (q.stem || '').toString();
    if (!(stem.includes('괄호 안의') || stem.includes('괄호 속의') || stem.includes('괄호안의'))) continue;
    const passage = (q.passage || '').toString();
    // Already has brackets/parens?
    if (/[\(\[][A-Za-z]/.test(passage) || /[\(\[][A-Za-z]/.test(stem)) continue;
    const wa = (q.wa || '').toString().trim();
    if (!wa) {
      skipped++;
      skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (no wa)`);
      continue;
    }
    // Try to find base form in passage
    const candidates = guessBase(wa);
    let found = false;
    for (const cand of candidates) {
      const re = new RegExp(`\\b${escReg(cand)}\\b`, 'i');
      if (re.test(passage)) {
        // Replace first occurrence with [cand]
        q.passage = passage.replace(re, `[${cand.toLowerCase()}]`);
        mutated = true;
        fixed++;
        found = true;
        break;
      }
    }
    if (!found) {
      skipped++;
      skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (no match: wa="${wa}", tried: ${candidates.join(',')})`);
    }
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);
console.log(`\n━━━ V63-E 괄호 삽입 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
console.log(`skipped: ${skipped}`);
if (skipped > 0) {
  fs.writeFileSync(path.join(__dirname, '..', 'reports', 'v63e-skipped.txt'), skipList.join('\n') + '\n');
  console.log(`→ reports/v63e-skipped.txt`);
}
