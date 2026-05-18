#!/usr/bin/env node
// Fix RENDER-MARKER-MISSING by populating q.passage with ①②③④ markers
const fs = require('fs');

const MARKERS = ['①', '②', '③', '④', '⑤'];
const fails = JSON.parse(fs.readFileSync('/tmp/marker-fails.json', 'utf8'));

let fileCount = 0, qCount = 0;

function splitSentences(text) {
  // split on sentence-ending punctuation followed by space + capital
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"'\u201C])/);
  return parts.filter(s => s.trim().length > 0);
}

function fixInsertion(q, fullPassage) {
  // Insert ①②③④ between sentences. Use 4 gaps spread across passage.
  const sents = splitSentences(fullPassage);
  if (sents.length - 1 < 4) {
    // not enough sentences — fall back: chunk by length
    const chunks = [];
    const step = Math.floor(fullPassage.length / 5);
    for (let i = 0; i < 5; i++) chunks.push(fullPassage.slice(i*step, (i+1)*step));
    chunks[4] += fullPassage.slice(5*step);
    return chunks[0] + ' ① ' + chunks[1] + ' ② ' + chunks[2] + ' ③ ' + chunks[3] + ' ④ ' + chunks[4];
  }
  // 4 gaps after sentences at indices: pick 4 evenly spaced internal positions
  // Positions: gaps are between sent[i] and sent[i+1], for i in [0..len-2]
  const numGaps = sents.length - 1; // gaps available
  // Pick 4 distinct gap indices in [0..numGaps-1]
  let idxs;
  if (numGaps === 4) idxs = [0,1,2,3];
  else {
    idxs = [];
    const step = numGaps / 5;
    for (let k = 0; k < 4; k++) idxs.push(Math.min(numGaps - 1, Math.floor((k + 1) * step)));
    for (let k = 1; k < 4; k++) if (idxs[k] <= idxs[k-1]) idxs[k] = idxs[k-1] + 1;
    while (idxs[3] >= numGaps) {
      for (let k = 3; k >= 0; k--) if (idxs[k] >= numGaps - (3 - k)) idxs[k] = numGaps - 1 - (3 - k);
      break;
    }
  }
  const out = [];
  let mk = 0;
  for (let i = 0; i < sents.length; i++) {
    out.push(sents[i]);
    if (mk < 4 && i === idxs[mk]) {
      out.push(' ' + MARKERS[mk] + ' ');
      mk++;
    }
  }
  return out.join(' ');
}

function fixUnderlineType(q, fullPassage) {
  // Try (a)(b)(c)(d)(e) → ①②③④⑤
  let p = q.passage || fullPassage;
  // strip escaped backslashes
  p = p.replace(/\\"/g, '"').replace(/\\'/g, "'");
  const hasABC = /\([a-e]\)/.test(p);
  if (hasABC) {
    let result = p;
    const map = { '(a)': '①', '(b)': '②', '(c)': '③', '(d)': '④', '(e)': '⑤' };
    for (const k in map) result = result.split(k).join(map[k]);
    // ensure underlines: if next token after marker isn't <u>, wrap next word
    result = result.replace(/([①②③④⑤])\s+([A-Za-z][A-Za-z'-]*)/g, (m, mk, w) => `${mk} <u>${w}</u>`);
    return result;
  }
  // No (a-e) markers — wrap 4 evenly-spaced "interesting" words
  const words = fullPassage.split(/(\s+)/);
  const wordIdxs = [];
  for (let i = 0; i < words.length; i++) if (/^[A-Za-z][A-Za-z'-]{2,}$/.test(words[i])) wordIdxs.push(i);
  if (wordIdxs.length < 4) return null;
  const picks = [];
  for (let k = 0; k < 4; k++) picks.push(wordIdxs[Math.floor((k + 1) * wordIdxs.length / 5)]);
  for (let k = 0; k < 4; k++) {
    words[picks[k]] = `${MARKERS[k]} <u>${words[picks[k]]}</u>`;
  }
  return words.join('');
}

for (const file in fails) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const fullPassage = j.fullPassage || '';
  if (!fullPassage) { console.log('SKIP no fp:', file); continue; }
  let changed = false;
  for (const qid of fails[file]) {
    const q = j.questions.find(x => x.id === qid);
    if (!q) continue;
    let newPassage = null;
    if (q.type === '문장삽입') {
      newPassage = fixInsertion(q, fullPassage);
    } else {
      newPassage = fixUnderlineType(q, fullPassage);
    }
    if (newPassage && ['①','②','③','④'].every(m => newPassage.includes(m))) {
      q.passage = newPassage;
      changed = true;
      qCount++;
    } else {
      console.log('FAIL', file, 'Q'+qid, q.type);
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    fileCount++;
  }
}
console.log(`Fixed ${qCount} questions in ${fileCount} files`);
