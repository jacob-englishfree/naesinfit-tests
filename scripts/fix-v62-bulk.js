#!/usr/bin/env node
/**
 * Fix V62: stem mentions "빈칸" but passage has no ____ blank
 * Strategy: use overlay.blank or correct answer to create blank in passage
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
    const stem = q.stem || '';
    if (!(stem.includes('위 글의 빈칸') || stem.includes('위 빈칸') || stem.includes('빈칸에 들어갈') || stem.includes('빈 칸에 들어갈'))) continue;

    const passage = q.passage || '';
    if (passage.includes('____') || passage.includes('_____')) continue;
    if (passage.trim().length <= 10) continue;

    // Skip 찾기 types
    if (stem.includes('찾아 쓰시오') || stem.includes('찾아쓰시오') || stem.includes('본문에서 찾아')) continue;

    // Strategy 1: use overlay.blank
    if (q.overlay && q.overlay.blank) {
      const blank = q.overlay.blank;
      if (passage.includes(blank)) {
        q.passage = passage.replace(blank, '____________________');
        changed = true;
        fixed++;
        continue;
      }
    }

    // Strategy 2: use correct answer (for mc types)
    if (q.fmt === 'mc' && typeof q.ans === 'number' && Array.isArray(q.ch) && q.ch[q.ans - 1]) {
      let target = String(q.ch[q.ans - 1]).replace(/^[①②③④⑤]\s*/, '').trim();
      if (target.length >= 3 && passage.toLowerCase().includes(target.toLowerCase())) {
        try {
          q.passage = passage.replace(new RegExp(escRE(target), 'i'), '____________________');
          changed = true;
          fixed++;
        } catch (e) {}
        continue;
      }
    }

    // Strategy 3: use wa (for written types)
    if (q.fmt === 'written' && q.wa) {
      const wa = q.wa.trim();
      if (wa.length >= 3 && passage.toLowerCase().includes(wa.toLowerCase())) {
        try {
          q.passage = passage.replace(new RegExp(escRE(wa), 'i'), '____________________');
          changed = true;
          fixed++;
        } catch (e) {}
        continue;
      }
    }
  }

  if (changed) {
    filesFixed++;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}

walk(DATA_DIR);
console.log(`V62 수정: ${fixed}건 in ${filesFixed} files`);
