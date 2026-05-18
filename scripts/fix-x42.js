#!/usr/bin/env node
/**
 * Fix X42: marker-type ans ↔ det.korean mismatch.
 * Strategy: for each X42 question, extract the "wrong word" from det.korean,
 * locate it in fullPassage, and rebuild passage with 4 underline markers where
 * marker[ans] wraps the wrong word. Other 3 markers wrap 3 distractor tokens
 * chosen from fullPassage (alphabetic tokens not equal to wrongWord).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MARKERS = ['①','②','③','④','⑤'];

// Returns { wrong, correct } — wrong is what the validator expects at marker[ans],
// correct is the original word in fullPassage that we substitute with wrong.
function extractWrongWord(korean, tip) {
  if (!korean) return null;
  korean = korean.replace(/<[^>]+>/g, '');
  if (tip) tip = tip.replace(/<[^>]+>/g, '');
  // Strongest source: tip with "correct ↔ wrong" or "wrong ↔ correct"
  // We detect which is which by checking the korean text for marker+word.
  function stripParen(s) { return s.replace(/\([^)]*\)/g, '').trim(); }

  // Pattern: "③ healed→broken" or "③ healed → broken"
  let m = korean.match(/^[①②③④⑤]\s*([a-zA-Z][a-zA-Z\s\-']{1,30}?)\s*[→↔]\s*([a-zA-Z][a-zA-Z\s\-']{1,30})/m);
  if (m) return { wrong: m[1].trim(), correct: m[2].trim() };
  // Pattern: "③ promoted: 원문 removed의 반의어"
  m = korean.match(/[①②③④⑤]\s*([a-zA-Z][a-zA-Z\s\-']{1,30}?)\s*[:：]\s*원문\s+([a-zA-Z][a-zA-Z\s\-']{1,30}?)의/);
  if (m) return { wrong: m[1].trim(), correct: m[2].trim() };
  // Pattern: "healed → broken" anywhere (ascii only)
  m = korean.match(/([a-zA-Z][a-zA-Z\s\-']{1,30}?)\s*[→↔]\s*([a-zA-Z][a-zA-Z\s\-']{1,30})/);
  if (m) return { wrong: m[1].trim(), correct: m[2].trim() };

  // Korean-narrative style: tip has "correct(한글) ↔ wrong(한글)" and korean has <b>wrongWord</b>
  if (tip) {
    const tm = tip.match(/([a-zA-Z][a-zA-Z\s\-']{1,30}?)(?:\([^)]*\))?\s*[↔→]\s*([a-zA-Z][a-zA-Z\s\-']{1,30}?)(?:\([^)]*\)|\s|$|\/)/);
    if (tm) {
      const a = stripParen(tm[1]);
      const b = stripParen(tm[2]);
      // Find which one appears as emphasized/bare word in korean
      // Prefer the one that literally appears in the korean string
      const ka = new RegExp('\\b' + a.replace(/\s+/g, '\\s+') + '\\b', 'i').test(korean);
      const kb = new RegExp('\\b' + b.replace(/\s+/g, '\\s+') + '\\b', 'i').test(korean);
      if (kb && !ka) return { wrong: b, correct: a };
      if (ka && !kb) return { wrong: a, correct: b };
      // Fallback: assume tip format is "correct ↔ wrong"
      return { wrong: b, correct: a };
    }
  }
  // Marker + single word only
  m = korean.match(/^[①②③④⑤]\s*([a-zA-Z][a-zA-Z\s\-']{1,30})\s*$/m);
  if (m) {
    const w = m[1].trim();
    // Use tip to find correct word: "broken↔healed"
    if (tip) {
      const tm = tip.match(/([a-zA-Z\s\-']+?)\s*[↔→]\s*([a-zA-Z\s\-']+)/);
      if (tm) {
        const a = tm[1].trim(), b = tm[2].trim();
        if (a.toLowerCase() === w.toLowerCase()) return { wrong: w, correct: b };
        if (b.toLowerCase() === w.toLowerCase()) return { wrong: w, correct: a };
      }
    }
    return { wrong: w, correct: null };
  }
  return null;
}

function stripMarkers(s) {
  return s.replace(/[①②③④⑤]\s*<u>([^<]+)<\/u>/g, '$1').replace(/<\/?u>/g, '');
}

// Find all occurrences (case-insensitive) of a phrase in plain text; return array of {start,end,matched}
function findOccurrences(plain, phrase) {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp('\\b' + esc + '\\b', 'gi');
  const out = [];
  let m;
  while ((m = re.exec(plain))) {
    out.push({ start: m.index, end: m.index + m[0].length, matched: m[0] });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

// Find tokens in plain text (alphabetic words of length >= 3) with positions
function tokenize(plain) {
  const re = /\b[a-zA-Z][a-zA-Z']{2,}\b/g;
  const out = [];
  let m;
  while ((m = re.exec(plain))) {
    out.push({ start: m.index, end: m.index + m[0].length, word: m[0] });
  }
  return out;
}

// Returns { passage, ans } or null
function rebuildPassage(fullPassage, wrongWord, correctWord, ans) {
  let plain = fullPassage;
  // Find the target location: prefer correctWord in fullPassage; if not found,
  // try wrongWord (some fullPassages already use wrongWord form).
  let target = null;
  let displayWord = wrongWord; // what will appear in <u>...</u>
  if (correctWord) {
    const occC = findOccurrences(plain, correctWord);
    if (occC.length > 0) {
      const t = occC[0];
      // Substitute correctWord with wrongWord at this position
      plain = plain.slice(0, t.start) + wrongWord + plain.slice(t.end);
      target = { start: t.start, end: t.start + wrongWord.length, matched: wrongWord };
    }
  }
  if (!target) {
    const occ = findOccurrences(plain, wrongWord);
    if (occ.length === 0) return null;
    target = occ[0];
    displayWord = target.matched;
  }

  // Pick 3 distractor tokens from fullPassage that do not overlap target
  // and are not equal (case-insensitive) to wrongWord's first word.
  const tokens = tokenize(plain).filter(t =>
    t.end <= target.start - 1 || t.start >= target.end + 1
  );
  const wrongLower = wrongWord.toLowerCase().split(/\s+/)[0];
  const distractorPool = tokens.filter(t => t.word.toLowerCase() !== wrongLower);
  if (distractorPool.length < 3) return null;

  // Spread: pick 3 distractors — spread evenly across passage
  // Split tokens into 3 buckets (before target, around, after) roughly
  const beforeTarget = distractorPool.filter(t => t.end <= target.start);
  const afterTarget = distractorPool.filter(t => t.start >= target.end);

  // We need 4 marker positions in sorted order. Target takes position = ans (1-indexed).
  // Pick distractor positions so that when sorted by start, target is at index (ans-1).
  let needBefore = ans - 1;
  let needAfter = 4 - ans;
  let newAns = ans;

  // If not enough on one side, shift ans to a feasible position
  const dedupeBefore0 = (() => {
    const seen = new Set([wrongLower]);
    const out = [];
    for (const t of beforeTarget) { const w = t.word.toLowerCase(); if (seen.has(w)) continue; seen.add(w); out.push(t); }
    return out;
  })();
  const dedupeAfter0 = (() => {
    const seen = new Set([wrongLower]);
    const out = [];
    for (const t of afterTarget) { const w = t.word.toLowerCase(); if (seen.has(w)) continue; seen.add(w); out.push(t); }
    return out;
  })();
  if (dedupeBefore0.length < needBefore || dedupeAfter0.length < needAfter) {
    const maxBefore = Math.min(3, dedupeBefore0.length);
    const minBefore = Math.max(0, 3 - dedupeAfter0.length);
    if (minBefore > maxBefore) return null;
    // Prefer closest to original ans
    let bestB = null, bestDist = Infinity;
    for (let b = minBefore; b <= maxBefore; b++) {
      const candidateAns = b + 1;
      const d = Math.abs(candidateAns - ans);
      if (d < bestDist) { bestDist = d; bestB = b; }
    }
    needBefore = bestB;
    needAfter = 3 - bestB;
    newAns = bestB + 1;
  }

  function pickSpread(arr, n) {
    if (n === 0) return [];
    if (arr.length === n) return arr.slice();
    const step = arr.length / n;
    const picked = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let idx = Math.floor(i * step + step / 2);
      while (used.has(idx) && idx < arr.length) idx++;
      if (idx >= arr.length) idx = arr.length - 1;
      used.add(idx);
      picked.push(arr[idx]);
    }
    return picked;
  }

  // Dedupe by word to avoid duplicate underlines confusing students
  function dedupeByWord(arr, excludeLower) {
    const seen = new Set(excludeLower ? [excludeLower] : []);
    const out = [];
    for (const t of arr) {
      const w = t.word.toLowerCase();
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(t);
    }
    return out;
  }

  const beforeClean = dedupeByWord(beforeTarget, wrongLower);
  const afterClean = dedupeByWord(afterTarget, wrongLower);
  if (beforeClean.length < needBefore || afterClean.length < needAfter) return null;

  const beforePicks = pickSpread(beforeClean, needBefore);
  const afterPicks = pickSpread(afterClean, needAfter);

  // Compose list of 4 items sorted by start
  const items = [...beforePicks, { ...target, word: target.matched }, ...afterPicks]
    .sort((a, b) => a.start - b.start);

  // Sanity: the target must end up at index (newAns - 1)
  const targetIdx = items.findIndex(it => it.start === target.start && it.end === target.end);
  if (targetIdx !== newAns - 1) return null;

  // Build the new passage string by splicing markers in reverse (so offsets stay valid)
  let out = plain;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const marker = MARKERS[i];
    const replacement = `${marker}<u>${plain.slice(it.start, it.end)}</u>`;
    out = out.slice(0, it.start) + replacement + out.slice(it.end);
  }
  return { passage: out, ans: newAns };
}

// Run validator and collect X42 errors per file
function getX42Errors() {
  const res = require('child_process').spawnSync('node', ['validate/validate.js', '--all'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024,
  });
  const output = (res.stdout || '') + '\n' + (res.stderr || '');
  const lines = output.split('\n');
  const errors = []; // {file, qid}
  let currentFile = null;
  for (const line of lines) {
    const fm = line.match(/^\[FAIL\]\s+(data\/[^\s]+\.json)/);
    if (fm) { currentFile = fm[1]; continue; }
    const em = line.match(/X42:\s*Q(\w+):/);
    if (em && currentFile) {
      errors.push({ file: currentFile, qid: em[1] });
    }
  }
  return errors;
}

function findQuestion(json, qid) {
  if (!Array.isArray(json.questions)) return null;
  // qid may be numeric string matching index+1 or q.id/q.no
  for (const q of json.questions) {
    if (String(q.id) === String(qid)) return q;
    if (String(q.no) === String(qid)) return q;
  }
  // Numeric fallback
  const n = parseInt(qid, 10);
  if (!Number.isNaN(n)) {
    // Try by q.id === `Q${n}` or 1-indexed position
    for (const q of json.questions) {
      if (q.id === `Q${n}`) return q;
    }
    if (n >= 1 && n <= json.questions.length) return json.questions[n - 1];
  }
  return null;
}

function main() {
  const errors = getX42Errors();
  console.log(`X42 errors found: ${errors.length}`);

  // Group by file
  const byFile = new Map();
  for (const e of errors) {
    if (!byFile.has(e.file)) byFile.set(e.file, []);
    byFile.get(e.file).push(e.qid);
  }

  let fixed = 0, skipped = 0;
  const skipLog = [];

  for (const [relFile, qids] of byFile) {
    const abs = path.join(ROOT, relFile);
    const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const fullPassage = json.fullPassage || '';
    if (!fullPassage) {
      skipped += qids.length;
      skipLog.push(`${relFile}: no fullPassage`);
      continue;
    }
    let changed = false;
    for (const qid of qids) {
      const q = findQuestion(json, qid);
      if (!q) { skipped++; skipLog.push(`${relFile} Q${qid}: not found`); continue; }
      const parsed = extractWrongWord(q.det && q.det.korean, q.det && q.det.tip);
      if (!parsed) { skipped++; skipLog.push(`${relFile} Q${qid}: no wrongWord`); continue; }
      const ans = q.ans;
      if (!ans || ans < 1 || ans > 4) { skipped++; skipLog.push(`${relFile} Q${qid}: bad ans ${ans}`); continue; }

      let result = rebuildPassage(fullPassage, parsed.wrong, parsed.correct, ans);
      // Fallback: if rebuild failed (e.g. neither word appears in fullPassage),
      // take current passage and swap the word at marker[ans] with wrongWord.
      if (!result && q.passage) {
        const mk = MARKERS[ans - 1];
        const re = new RegExp(mk + '\\s*<u>([^<]+)</u>');
        if (re.test(q.passage)) {
          const newP = q.passage.replace(re, `${mk}<u>${parsed.wrong}</u>`);
          result = { passage: newP, ans };
        }
      }
      if (!result) {
        skipped++;
        skipLog.push(`${relFile} Q${qid}: rebuild failed (wrong="${parsed.wrong}", correct="${parsed.correct}", ans=${ans})`);
        continue;
      }
      q.passage = result.passage;
      if (result.ans !== ans) q.ans = result.ans;
      fixed++;
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(abs, JSON.stringify(json, null, 2) + '\n');
    }
  }

  console.log(`Fixed: ${fixed}, Skipped: ${skipped}`);
  if (skipLog.length) {
    console.log('--- Skip details ---');
    for (const s of skipLog) console.log('  ' + s);
  }
}

main();
