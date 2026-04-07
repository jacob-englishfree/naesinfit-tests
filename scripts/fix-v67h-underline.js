#!/usr/bin/env node
// V67-H 자동수정: 함축의미 추론 stem의 <b>구절</b>을 추출해서 passage에서 <u>감쌈
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
let scanned = 0, fixed = 0, skipped = 0;
const skipList = [];

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
    const stem0 = (q.stem || '').toString();
    const isFn = (typeNorm === '함축의미 추론' || typeNorm === '함축의미추론');
    const isV67 = stem0.includes('밑줄 친') || stem0.includes('밑줄친');
    if (!isFn && !isV67) continue;
    const passage = (q.passage || '').toString();
    if (passage.includes('<u>') || passage.includes('<b>')) continue;
    if (passage.trim().length < 10) continue;

    const stem = (q.stem || '').toString();
    // Extract <b>...</b> or '...' from stem
    let target = '';
    const bMatch = stem.match(/<b>([^<]+)<\/b>/);
    if (bMatch) target = bMatch[1].trim();
    else {
      // Try single quoted phrase
      const qMatch = stem.match(/['"]([A-Za-z][A-Za-z\s,.\-'?!]+?)['"]/);
      if (qMatch) target = qMatch[1].trim();
    }

    if (!target || target.length < 3) {
      skipped++;
      skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (no target in stem)`);
      continue;
    }

    // Find target in passage and wrap with <u>
    const re = new RegExp(escReg(target), 'i');
    if (!re.test(passage)) {
      skipped++;
      skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (target "${target.substring(0,40)}" not in passage)`);
      continue;
    }
    q.passage = passage.replace(re, (m) => `<u>${m}</u>`);
    mutated = true;
    fixed++;
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);
console.log(`\n━━━ V67-H 자동수정 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
console.log(`skipped: ${skipped}`);
if (skipped > 0) {
  fs.writeFileSync(path.join(__dirname, '..', 'reports', 'v67h-skipped.txt'), skipList.join('\n') + '\n');
}
