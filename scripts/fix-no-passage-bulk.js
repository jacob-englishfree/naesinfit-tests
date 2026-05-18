#!/usr/bin/env node
/**
 * Fix S-NO-PASSAGE and S-WRITTEN-NO-PASSAGE:
 * Restore passage from fullPassage for questions where passage was set to null.
 * Blanks out written answer (wa) if it would be exposed.
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
  const fp = data.fullPassage || '';
  if (!fp) return;

  let changed = false;
  for (const q of data.questions) {
    const p = q.passage;
    const type = (q.type || '').trim();

    // Skip types that don't need passage
    if (/영영풀이|다의어|순서배열|글순서|문장삽입|어순배열/.test(type)) continue;

    // Fix: passage is null/empty but fullPassage exists
    const hasNoPassage = !p || (typeof p === 'string' && p.trim() === '');
    if (!hasNoPassage) continue;

    const wa = q.wa || '';
    let newPassage = fp;

    // If written type and wa is in fullPassage, blank it out
    if (q.fmt === 'written' && wa && wa.length >= 4 && fp.toLowerCase().includes(wa.toLowerCase())) {
      try {
        const re = new RegExp(escRE(wa), 'gi');
        newPassage = fp.replace(re, '____');
      } catch (e) {
        // regex escape failed, just use fullPassage
      }
    }

    // Apply overlay if exists
    if (q.overlay) {
      if (q.overlay.blank && newPassage.includes(q.overlay.blank)) {
        newPassage = newPassage.replace(q.overlay.blank, '____________________');
      }
      if (q.overlay.underline && newPassage.includes(q.overlay.underline) && !newPassage.includes('<u>' + q.overlay.underline + '</u>')) {
        newPassage = newPassage.replace(q.overlay.underline, '<u>' + q.overlay.underline + '</u>');
      }
    }

    q.passage = newPassage;
    changed = true;
    fixed++;
  }

  if (changed) {
    filesFixed++;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}

walk(DATA_DIR);
console.log(`S-NO-PASSAGE/S-WRITTEN-NO-PASSAGE 수정: ${fixed}건 in ${filesFixed} files`);
