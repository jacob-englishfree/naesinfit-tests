#!/usr/bin/env node
/**
 * Fix S-WA-IN-PASSAGE: 서술형 wa가 passage에 노출 → ____ 로 교체
 * 면제: 찾기유형, 영작유형, 어형변환, 한영
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
let fixed = 0, filesFixed = 0;

function escRE(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() && !['_passages','reports','.git','node_modules'].includes(e.name)) walk(f);
    else if ((e.name === '워크북.json' || e.name === '퀴즈.json') && !e.name.includes('.blind') && !e.name.includes('.cross') && !e.name.includes('.prompt') && !e.name.includes('.response') && !e.name.includes('.adversarial')) processFile(f);
  }
}

function processFile(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  if (!data.questions || !Array.isArray(data.questions)) return;

  let changed = false;
  for (const q of data.questions) {
    if (q.fmt !== 'written') continue;
    const wa = q.wa;
    if (!wa || typeof wa !== 'string' || wa.trim().length < 4) continue;

    const type = (q.type || '').trim();
    const stem = q.stem || '';

    // Skip exempt types
    if (/영작|어형|한영/.test(type)) continue;
    if (/본문에서\s*찾아|본문\s*속|찾아\s*쓰시오|글에서\s*찾아/.test(stem)) continue;

    const passage = q.passage;
    if (!passage || typeof passage !== 'string') continue;

    const waNorm = wa.trim();
    if (!passage.includes(waNorm)) continue;

    // Replace wa in passage with blank
    try {
      q.passage = passage.replace(new RegExp(escRE(waNorm), 'g'), '____');
      changed = true;
      fixed++;
    } catch (e) { /* skip */ }
  }

  if (changed) {
    filesFixed++;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}

walk(DATA_DIR);
console.log(`S-WA-IN-PASSAGE 수정: ${fixed}건 in ${filesFixed} files`);
