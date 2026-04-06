#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', '모의고사', '고1', '3월_2026');
let totalFixed = 0;

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function fixFile(filePath) {
  let data;
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return 0; }
  const fp = data.fullPassage;
  if (!fp) return 0;
  let fixes = 0;

  for (const q of data.questions) {
    if (!q.stem) continue;

    // === Fix underline issues ===
    if (q.stem.includes('밑줄 친') && q.passage && !q.passage.includes('<u>')) {
      let word = null;

      // Extract from 'word' pattern
      const sq = q.stem.match(/['']([a-zA-Z]+)['']/);
      if (sq) word = sq[1];

      // Extract plain: "밑줄 친 WORD와/과/의"
      if (!word) {
        const pm = q.stem.match(/밑줄\s*친\s+([a-zA-Z][a-zA-Z]*)/);
        if (pm) word = pm[1];
      }

      // Extract from <b>
      if (!word) {
        const bm = q.stem.match(/<b>([a-zA-Z]+)<\/b>/);
        if (bm) word = bm[1];
      }

      if (word) {
        // Try to add <u> in passage
        const re = new RegExp('\\b' + esc(word) + '\\b', 'i');
        const m = q.passage.match(re);
        if (m) {
          q.passage = q.passage.replace(re, '<u>' + m[0] + '</u>');
          fixes++;
        } else {
          // Use fullPassage
          const fm = fp.match(re);
          if (fm) {
            q.passage = fp.replace(re, '<u>' + fm[0] + '</u>');
            fixes++;
          } else {
            // Word doesn't exist at all - remove "밑줄 친" from stem
            q.stem = q.stem.replace(/밑줄\s*친\s+/, '');
            fixes++;
          }
        }
      } else {
        // Can't extract word - remove "밑줄 친"
        q.stem = q.stem.replace(/밑줄\s*친\s+/, '');
        fixes++;
      }
    }

    // === Fix 영작 서술형 passage ===
    if (q.fmt === 'written' && q.passage && q.passage.length > 10) {
      if (q.stem && (
        q.stem.includes('어형을 변환') ||
        q.stem.includes('바꿔 쓰시오') ||
        q.stem.includes('알맞은 형태로') ||
        q.stem.includes('영작') ||
        q.stem.includes('영어로 바꿔') ||
        q.stem.includes('주어진 단어를')
      )) {
        q.passage = '';
        fixes++;
      }
    }

    // === Fix short 빈칸 passages ===
    if (['빈칸추론', '빈칸 어휘 완성'].includes(q.type) && q.fmt === 'mc') {
      const clean = (q.passage || '').replace(/<[^>]+>/g, ' ');
      const sents = clean.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
      if (sents < 5) {
        let np = fp;
        if (!np.includes('______')) {
          const ws = np.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 5 && /^[a-zA-Z]+$/.test(w));
          if (ws.length > 3) {
            np = np.replace(new RegExp('\\b' + esc(ws[Math.floor(ws.length/2)]) + '\\b'), '______');
          }
        }
        q.passage = np;
        fixes++;
      }
    }

    // === Fix 서술형 정답 노출 ===
    if (q.fmt === 'written' && q.wa && q.passage && q.passage.length > 10) {
      // If wa is multi-word and appears in passage, use fullPassage to dilute
      if (q.wa.length > 5 && q.passage.includes(q.wa)) {
        q.passage = fp;
        fixes++;
      }
    }
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    totalFixed += fixes;
  }
  return fixes;
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) {
      const n = fixFile(p);
      if (n > 0) console.log(`  ${n}x ${path.relative(BASE, p)}`);
    }
  }
}

console.log('=== Round 4 Fix ===\n');
walk(BASE);
console.log(`\n총 ${totalFixed}건`);
