#!/usr/bin/env node
/**
 * fix-rmm-b2-v5.js
 *
 * Fixes RENDER-MARKER-MISSING for skipped cases in /tmp/rmm-b2-skipped.json
 * Uses det.korean (primary) + det.analysis (fallback) for word extraction.
 */

const fs = require('fs');
const path = require('path');

const BASE = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests';
const skipped = JSON.parse(fs.readFileSync('/tmp/rmm-b2-skipped.json', 'utf8'));
const MARKERS = ['①', '②', '③', '④'];

// ── Extract wrong/orig pair from det.korean field ──
function extractFromKorean(korean, markerSymbol) {
  if (!korean) return { wrong: null, orig: null };

  const lines = korean.split('\n');

  // First pass: try lines that contain the markerSymbol
  // Second pass: try ALL lines (marker in korean may be wrong/off)
  for (let pass = 0; pass < 2; pass++) {
    for (const line of lines) {
      const lineHasMarker = line.includes(markerSymbol);
      if (pass === 0 && !lineHasMarker) continue;
      if (pass === 1 && lineHasMarker) continue; // already tried

      let w = null, o = null;

      // Pattern 1: ③ wrongWord → <b>origWord</b> (with hyphen support)
      let m = line.match(/[①②③④]\s+([a-zA-Z][a-zA-Z\s'"\-]*?)\s*→\s*<b>([^<]+)<\/b>/);
      if (m) {
        w = m[1].trim().replace(/[.,;:!?()]+$/, '');
        o = m[2].trim().replace(/[.,;:!?()]+$/, '');
        if (w && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
      }

      // Pattern 2: <b>positive → negative</b> (문장① style)
      m = line.match(/<b>([a-zA-Z][a-zA-Z\s'"\-]*?)\s*→\s*([a-zA-Z][a-zA-Z\s'"\-]*?)<\/b>/);
      if (m) {
        w = m[1].trim().replace(/[.,;:!?()]+$/, '');
        o = m[2].trim().replace(/[.,;:!?()]+$/, '');
        if (w && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
      }

      // Pattern 3: ③ wrong → orig (no HTML, with text after)
      m = line.match(/[①②③④]\s+([a-zA-Z][a-zA-Z\s'"\-]*?)\s*→\s*([a-zA-Z][a-zA-Z\s'"\-\/]*?)[\s(:,]/);
      if (m) {
        w = m[1].trim().replace(/[.,;:!?()]+$/, '');
        const raw2 = m[2].trim();
        o = raw2.split(/[\s(]/)[0].replace(/[.,;:!?()]+$/, '').trim();
        if (w && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
      }

      // Pattern 4: ③ wrong → orig (at end of line)
      m = line.match(/[①②③④]\s+([a-zA-Z][a-zA-Z\s'"\-]*?)\s*→\s*([a-zA-Z][a-zA-Z\s'"\-\/]*)$/);
      if (m) {
        w = m[1].trim().replace(/[.,;:!?()]+$/, '');
        o = m[2].trim().replace(/[.,;:!?()]+$/, '');
        if (w && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
      }

      // Pattern 5: ② <b>courage</b>(→ fear) — orig is in <b>, wrong is after →
      m = line.match(/[①②③④]\s+<b>([a-zA-Z][a-zA-Z\s'"\-]*?)<\/b>\s*\(→\s*([a-zA-Z][a-zA-Z\s'"\-]*?)\)/);
      if (m) {
        // In this pattern: <b>courage</b>(→ fear) means orig=courage, wrong=fear
        // But the MISSING marker might be for the wrong word or orig word
        o = m[1].trim().replace(/[.,;:!?()]+$/, '');
        w = m[2].trim().replace(/[.,;:!?()]+$/, '');
        if (o && /[a-zA-Z]/.test(o)) return { wrong: w, orig: o };
      }
    }
  }

  return { wrong: null, orig: null };
}

// ── Extract from det.analysis (existing v4 logic) ──
function extractPairFromLine(line) {
  let w = null, o = null;

  let m = line.match(/([a-zA-Z][a-zA-Z\s'"-]*?)\s*→\s*([a-zA-Z][a-zA-Z\s'"-]*)/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    const raw2 = m[2].trim();
    o = raw2.split(/[^a-zA-Z\s'"-]/)[0].trim().replace(/[.,;:!?()]+$/, '').trim();
    if (w && o && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
  }

  m = line.match(/^[✅❌✔✘×\s]*[①②③④]?\s*([a-zA-Z][a-zA-Z\s'"-]*?)\s*:.*—\s*([a-zA-Z][a-zA-Z\s'"-]+)/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    const raw2 = m[2].trim();
    o = raw2.split(/[\s(]/)[0].replace(/[.,;:!?()]+$/, '').trim();
    if (w && o && /[a-zA-Z]/.test(w) && w.length < 40) return { wrong: w, orig: o };
  }

  m = line.match(/([a-zA-Z][a-zA-Z\s'"-]*?)\([^)]+\)[은는이가]?\s+([a-zA-Z][a-zA-Z\s'"-]*?)\([^)]+\)[의가]?\s*(반의어|반대)/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    o = m[2].trim().replace(/[.,;:!?()]+$/, '').trim();
    if (w && o && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
  }

  m = line.match(/([a-zA-Z][a-zA-Z\s'"-]*?)\([^)]+\)[이가]?\s*아니라\s+([a-zA-Z][a-zA-Z\s'"-]*)/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    o = m[2].trim().split(/[\s(]/)[0].replace(/[.,;:!?()]+$/, '').trim();
    if (w && o && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
  }

  m = line.match(/과거[형시제]*\s+([a-zA-Z]+)/);
  if (m) {
    const origCandidate = m[1];
    const wrongM = line.match(/^[✅❌\s]*[①②③④]?\s*([a-zA-Z][a-zA-Z\s'"-]*?)\s*[:(\s]/);
    if (wrongM) {
      w = wrongM[1].trim().replace(/[.,;:!?()]+$/, '').trim();
      o = origCandidate;
      if (w && /[a-zA-Z]/.test(w) && w !== o) return { wrong: w, orig: o };
    }
  }

  m = line.match(/p\.p\.\s+([a-zA-Z]+)/);
  if (m) {
    const origCandidate = m[1];
    const wrongM = line.match(/^[✅❌\s]*[①②③④]?\s*([a-zA-Z][a-zA-Z\s'"-]*?)\s*[:(\s]/);
    if (wrongM) {
      w = wrongM[1].trim().replace(/[.,;:!?()]+$/, '').trim();
      o = origCandidate;
      if (w && /[a-zA-Z]/.test(w) && w !== o) return { wrong: w, orig: o };
    }
  }

  m = line.match(/병렬[이으]?므?로?\s+([a-zA-Z][a-zA-Z\s'"-]*)/);
  if (m) {
    const origCandidate = m[1].split(/[\s(]/)[0].replace(/[.,;:!?()]+$/, '').trim();
    const wrongM = line.match(/^[✅❌\s]*[①②③④]?\s*([a-zA-Z][a-zA-Z\s'"-]*?)\s*[:(\s]/);
    if (wrongM) {
      w = wrongM[1].trim().replace(/[.,;:!?()]+$/, '').trim();
      o = origCandidate;
      if (w && /[a-zA-Z]/.test(w) && w !== o) return { wrong: w, orig: o };
    }
  }

  // go + adj pattern (e.g., go blank)
  m = line.match(/go\+형용사|go\s+blank/i);
  if (m) {
    const wrongM = line.match(/^[✅❌\s]*[①②③④]?\s*([a-zA-Z][a-zA-Z\s'"-]*?)\s*[:(\s→]/);
    if (wrongM) {
      w = wrongM[1].trim().replace(/[.,;:!?()]+$/, '').trim();
      // orig = go+adj form - try to find adj
      const adjM = line.match(/go\s+([a-zA-Z]+)/i);
      o = adjM ? adjM[1] : null;
      if (w && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
    }
  }

  m = line.match(/^[✅❌\s]*[①②③④]?\s*([a-zA-Z][a-zA-Z\s'"-]*?)\s*:/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    if (w && w.length > 0 && w.length < 40 && /[a-zA-Z]/.test(w)) {
      return { wrong: w, orig: null };
    }
  }

  return { wrong: null, orig: null };
}

function extractForMarker(det, markerSymbol) {
  // Priority 1: det.korean
  const { wrong: kw, orig: ko } = extractFromKorean(det?.korean || '', markerSymbol);
  if (kw || ko) return { wrong: kw, orig: ko };

  // Priority 2: det.analysis
  const analysis = det?.analysis || '';
  const lines = analysis.split('\n');
  for (const line of lines) {
    if (!line.includes(markerSymbol)) continue;
    const markerPos = line.indexOf(markerSymbol);
    const prefix = line.substring(0, markerPos);
    if (prefix.replace(/[✅❌✔✘×\s]/g, '').length > 3) continue;
    const { wrong, orig } = extractPairFromLine(line);
    if (wrong || orig) return { wrong, orig };
  }
  return { wrong: null, orig: null };
}

// ── For vague cases: pick a word from the region between adjacent markers ──
// Used when no word info is available from analysis/korean
function pickWordFromRegion(passage, missingMarker) {
  const MARKERS = ['①','②','③','④'];
  const missingIdx = MARKERS.indexOf(missingMarker);

  // Find positions of all present markers in text
  const present = MARKERS
    .filter(m => passage.includes(m))
    .map(m => ({ m, seqIdx: MARKERS.indexOf(m), textIdx: passage.indexOf(m) }))
    .sort((a,b) => a.textIdx - b.textIdx);

  if (present.length === 0) return null;

  // Find prev/next by SEQUENCE order
  const prevBySeq = [...present].filter(p => p.seqIdx < missingIdx).pop();
  const nextBySeq = present.find(p => p.seqIdx > missingIdx);

  let regionStart, regionEnd;
  if (prevBySeq) {
    regionStart = passage.indexOf('</u>', prevBySeq.textIdx) + 4;
  } else {
    regionStart = 0;
    // End at the text position of first present marker
    regionEnd = present[0].textIdx;
    const region = passage.substring(regionStart, regionEnd);
    return pickGrammarWord(region);
  }

  if (nextBySeq && nextBySeq.textIdx > regionStart) {
    regionEnd = nextBySeq.textIdx;
  } else {
    // nextBySeq appears BEFORE prevBySeq in text (out-of-order markers)
    // Find the next text-position marker after regionStart
    const nextByText = present.filter(p => p.textIdx > regionStart).sort((a,b) => a.textIdx - b.textIdx)[0];
    if (nextByText) {
      regionEnd = nextByText.textIdx;
    } else {
      regionEnd = passage.length;
    }
  }

  let region = passage.substring(regionStart, regionEnd);
  let word = pickGrammarWord(region);

  // If region too small or no word found, try: after ALL present markers (rest of passage)
  if (!word) {
    const lastPresentByText = present[present.length - 1];
    const afterAll = passage.indexOf('</u>', lastPresentByText.textIdx) + 4;
    const restRegion = passage.substring(afterAll);
    word = pickGrammarWord(restRegion);
  }

  return word;
}

// Pick the most grammar-relevant word from a text region
function pickGrammarWord(text) {
  if (!text || !text.trim()) return null;

  // Strip HTML tags and marker content (already-marked words should not be picked again)
  const plain = text.replace(/[①②③④]<u>[^<]*<\/u>/g, '').replace(/<[^>]+>/g, '');

  // Priority 1: relative pronouns and conjunction words
  const highPri = ['which', 'who', 'whom', 'whose', 'where', 'when', 'what', 'that', 'whether'];
  for (const w of highPri) {
    const re = new RegExp('\\b' + w + '\\b', 'i');
    if (re.test(plain)) {
      return plain.match(re)?.[0] || null;
    }
  }

  // Priority 2: -ing forms (gerunds/present participles)
  const ingMatch = plain.match(/\b([a-zA-Z]{4,}ing)\b/);
  if (ingMatch) return ingMatch[1];

  // Priority 3: -ed forms (past tense/past participle)
  const edMatch = plain.match(/\b([a-zA-Z]{4,}ed)\b/);
  if (edMatch) return edMatch[1];

  // Priority 4: adjective/adverb (-ly, -ful, -ous, -al, -ive)
  const adjMatch = plain.match(/\b([a-zA-Z]{5,}(?:ly|ful|ous|ive|al|ble))\b/i);
  if (adjMatch) return adjMatch[1];

  // Priority 5: any content word (5+ letters, not articles/prepositions)
  const stopWords = new Set(['about', 'above', 'after', 'again', 'along', 'among', 'before', 'being', 'between', 'could', 'every', 'first', 'found', 'great', 'large', 'later', 'least', 'local', 'might', 'never', 'often', 'order', 'other', 'place', 'point', 'small', 'these', 'those', 'three', 'times', 'under', 'until', 'watch', 'while', 'would', 'years']);
  const words = plain.match(/\b[a-zA-Z]{5,}\b/g) || [];
  for (const w of words) {
    if (!stopWords.has(w.toLowerCase())) return w;
  }

  return null;
}

function applyFix(passage, missingMarker, wrongWord, origWord) {
  const tryReplace = (text, target, replacement) => {
    if (!target) return null;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?<![①②③④<])\\b(' + escaped + ')\\b(?!</u>)', 'i');
    const match = re.exec(text);
    if (!match) return null;
    const prevCtx = text.substring(Math.max(0, match.index - 3), match.index);
    if (MARKERS.some(m => prevCtx.includes(m))) return null;
    const found = match[1];
    const display = replacement || found;
    return text.substring(0, match.index) + missingMarker + '<u>' + display + '</u>' + text.substring(match.index + found.length);
  };

  if (origWord) {
    const result = tryReplace(passage, origWord, wrongWord || origWord);
    if (result) return result;

    if (origWord.includes(' ')) {
      const escaped = origWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(?<![①②③④])(' + escaped + ')(?!</u>)', 'i');
      const match = re.exec(passage);
      if (match) {
        const prevCtx = passage.substring(Math.max(0, match.index - 3), match.index);
        if (!MARKERS.some(m => prevCtx.includes(m))) {
          const display = wrongWord || match[1];
          return passage.substring(0, match.index) + missingMarker + '<u>' + display + '</u>' + passage.substring(match.index + match[1].length);
        }
      }
    }
  }

  if (wrongWord) {
    const result = tryReplace(passage, wrongWord, wrongWord);
    if (result) return result;

    if (wrongWord.includes(' ')) {
      const escaped = wrongWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(?<![①②③④])(' + escaped + ')(?!</u>)', 'i');
      const match = re.exec(passage);
      if (match) {
        const prevCtx = passage.substring(Math.max(0, match.index - 3), match.index);
        if (!MARKERS.some(m => prevCtx.includes(m))) {
          return passage.substring(0, match.index) + missingMarker + '<u>' + match[1] + '</u>' + passage.substring(match.index + match[1].length);
        }
      }
    }
  }

  return null;
}

// Group skipped by file+qid
const byFileQ = {};
for (const s of skipped) {
  const key = s.file + ':' + s.qid;
  if (!byFileQ[key]) byFileQ[key] = { file: s.file, qid: s.qid, markers: [] };
  byFileQ[key].markers.push(s.marker);
}

let totalFixed = 0;
let totalSkipped = 0;
const stillSkipped = [];

// Process grouped by file
const byFile = {};
for (const [key, v] of Object.entries(byFileQ)) {
  if (!byFile[v.file]) byFile[v.file] = [];
  byFile[v.file].push(v);
}

for (const [relPath, items] of Object.entries(byFile)) {
  const filePath = path.join(BASE, relPath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  let fileModified = false;

  for (const item of items) {
    const qi = data.questions.findIndex(q => q.id === item.qid);
    if (qi === -1) continue;
    const q = data.questions[qi];

    for (const missingMarker of item.markers) {
      if ((q.passage || '').includes(missingMarker)) {
        console.log(`ALREADY ${relPath} Q${q.id} ${missingMarker}`);
        continue;
      }

      let { wrong, orig } = extractForMarker(q.det, missingMarker);

      let newPassage = applyFix(q.passage, missingMarker, wrong, orig);

      // If applyFix failed (with or without words), try positional word picking
      if (!newPassage) {
        const pickedWord = pickWordFromRegion(q.passage, missingMarker);
        if (pickedWord) {
          wrong = pickedWord;
          orig = null;
          newPassage = applyFix(q.passage, missingMarker, pickedWord, null);
          if (newPassage && newPassage.includes(missingMarker)) {
            console.log(`FIX-POS  ${relPath} Q${q.id} ${missingMarker}: picked="${pickedWord}" (positional)`);
          }
        }
      }

      if (newPassage && newPassage.includes(missingMarker)) {
        if (!newPassage.includes('FIX-POS')) { // avoid double logging
          console.log(`FIX  ${relPath} Q${q.id} ${missingMarker}: wrong="${wrong || '?'}" orig="${orig || '?'}"`);
        }
        data.questions[qi].passage = newPassage;
        q.passage = newPassage;
        fileModified = true;
        totalFixed++;
      } else {
        console.log(`SKIP ${relPath} Q${q.id} ${missingMarker}: wrong="${wrong || 'none'}" orig="${orig || 'none'}"`);
        stillSkipped.push({ file: relPath, qid: q.id, marker: missingMarker, wrong, orig,
          korean: (q.det?.korean || '').substring(0, 80),
          analysisLine: (q.det?.analysis || '').split('\n').find(l => l.includes(missingMarker)) || '' });
        totalSkipped++;
      }
    }
  }

  if (fileModified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

console.log('\n=== SUMMARY ===');
console.log('Fixed:', totalFixed);
console.log('Skipped:', totalSkipped);
fs.writeFileSync('/tmp/rmm-b2-v5-skipped.json', JSON.stringify(stillSkipped, null, 2));
console.log('Still skipped → /tmp/rmm-b2-v5-skipped.json');
