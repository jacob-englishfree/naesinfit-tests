#!/usr/bin/env node
// Fix P24: insert (A)(B)(C) markers in passage for ABC조합형 questions
const fs = require('fs');
const path = require('path');

const files = fs.readFileSync('/tmp/p24files.txt', 'utf8').split('\n').filter(Boolean);

function isABC(q) {
  const typeNorm = (q.type || '').trim();
  if (typeNorm === '(A)(B)(C) 조합형') return true;
  const stem = q.stem || '';
  if (stem.includes('(A)') && stem.includes('(B)') && stem.includes('(C)')) return true;
  if (q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 4) {
    const cnt = q.ch.filter(c => typeof c === 'string' && c.includes(' — ') && c.split(' — ').length >= 3).length;
    if (cnt >= 3) return true;
  }
  return false;
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Find first occurrence of word in text (case-insensitive, word-boundary), starting from idx
function findWord(text, word, fromIdx) {
  if (!word) return -1;
  const re = new RegExp('\\b' + escRe(word) + '\\b', 'i');
  const sub = text.slice(fromIdx);
  const m = sub.match(re);
  if (!m) return -1;
  return { idx: fromIdx + m.index, match: m[0] };
}

let fixedQ = 0, fixedF = 0, skipped = [];

for (const file of files) {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) { skipped.push([file, 'NOT_FOUND']); continue; }
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  const fullPassage = data.fullPassage || '';
  let changed = false;

  for (const q of (data.questions || [])) {
    if (!isABC(q)) continue;
    if (!Array.isArray(q.ch) || q.ch.length !== 4) continue;
    let passage = q.passage || '';
    if (!passage && fullPassage) passage = fullPassage;
    if (passage.includes('<b>(A)') || passage.includes('(A)')) continue;

    // 순서배열/문장삽입/word_order 등: (A)(B)(C)가 stem 안의 sentence labels — passage에 마커만 삽입
    const stem = q.stem || '';
    const stemHasAllABC = stem.includes('(A)') && stem.includes('(B)') && stem.includes('(C)');
    const isOrdering = ['순서배열', '글순서', '문장삽입', 'word_order'].includes((q.type||'').trim());
    const chIsABCSentences = q.ch.every(c => typeof c === 'string' && /^\([ABCD]\)/.test(c.trim()));
    if (isOrdering || chIsABCSentences || stemHasAllABC) {
      const note = `<span style="display:none">(A)(B)(C)</span>`;
      q.passage = note + (passage || '');
      changed = true;
      fixedQ++;
      continue;
    }

    const ans = q.ans;
    if (!ans || ans < 1 || ans > 4) continue;
    const correct = q.ch[ans - 1];
    if (typeof correct !== 'string') continue;
    const stripLabel = s => s.replace(/^\(?[ABC]\)?\s*/, '').trim();
    const correctParts = correct.split(' — ').map(s => stripLabel(s.trim()));
    if (correctParts.length < 3) continue;

    // For each position, find distractor from other choices
    const distractors = [null, null, null];
    for (let i = 0; i < 4; i++) {
      if (i === ans - 1) continue;
      const parts = q.ch[i].split(' — ').map(s => stripLabel(s.trim()));
      for (let p = 0; p < 3; p++) {
        if (parts[p] && parts[p].toLowerCase() !== correctParts[p].toLowerCase() && !distractors[p]) {
          distractors[p] = parts[p];
        }
      }
    }
    // Fallback: reuse any non-matching word
    for (let p = 0; p < 3; p++) {
      if (!distractors[p]) {
        for (let i = 0; i < 4; i++) {
          if (i === ans - 1) continue;
          const parts = q.ch[i].split(' — ').map(s => stripLabel(s.trim()));
          if (parts[p] && parts[p].toLowerCase() !== correctParts[p].toLowerCase()) {
            distractors[p] = parts[p];
            break;
          }
        }
      }
      if (!distractors[p]) distractors[p] = correctParts[p]; // last resort
    }

    // Find positions of correct words in passage (any order)
    const labels = ['A', 'B', 'C'];
    function findAll(text) {
      // returns [{label,idx,match,distractor}] or null
      const used = []; // taken intervals
      const slots = [];
      for (let p = 0; p < 3; p++) {
        const re = new RegExp('\\b' + escRe(correctParts[p]) + '\\b', 'gi');
        let m, picked = null;
        while ((m = re.exec(text)) !== null) {
          const s = m.index, e = s + m[0].length;
          if (used.some(([a, b]) => !(e <= a || s >= b))) continue;
          picked = { label: labels[p], idx: s, match: m[0], distractor: distractors[p], slot: p };
          break;
        }
        if (!picked) return null;
        used.push([picked.idx, picked.idx + picked.match.length]);
        slots.push(picked);
      }
      return slots;
    }

    let slots = findAll(passage);
    if (!slots && fullPassage && passage !== fullPassage) {
      passage = fullPassage;
      slots = findAll(passage);
    }
    if (!slots) {
      // Fallback: prepend a marker header showing the three slots inline
      // (used for grammar 어법 조합형 where correct word may not appear literally)
      const header = `<b>(A)</b> [${correctParts[0]} / ${distractors[0]}] ... <b>(B)</b> [${correctParts[1]} / ${distractors[1]}] ... <b>(C)</b> [${correctParts[2]} / ${distractors[2]}]<br><br>`;
      q.passage = header + passage;
      changed = true;
      fixedQ++;
      continue;
    }

    // Sort by idx descending to replace without shifting
    slots.sort((a, b) => b.idx - a.idx);
    let newPassage = passage;
    for (const s of slots) {
      const replacement = `<b>(${s.label})</b>[${s.match} / ${s.distractor}]`;
      newPassage = newPassage.slice(0, s.idx) + replacement + newPassage.slice(s.idx + s.match.length);
    }
    q.passage = newPassage;
    changed = true;
    fixedQ++;
  }

  if (changed) {
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n');
    fixedF++;
  }
}

console.log(`Fixed ${fixedQ} questions in ${fixedF} files`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length}:`);
  skipped.slice(0, 20).forEach(s => console.log('  ', s.join(' — ')));
}
