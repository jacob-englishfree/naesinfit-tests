#!/usr/bin/env node
/**
 * fix-rmm-b2.js  v4 - Final
 *
 * Fixes RENDER-MARKER-MISSING: for each missing marker in passage,
 * extracts the wrong word + original word from det.analysis,
 * then replaces original word in passage with marker<u>wrongWord</u>.
 */

const fs = require('fs');
const path = require('path');

const BASE = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests';
const files = JSON.parse(fs.readFileSync('/tmp/rmm-b2.json', 'utf8'));
const MARKERS = ['①', '②', '③', '④'];

// ── Extract wrong word and original word from one analysis line ──
function extractPairFromLine(line) {
  let w = null, o = null;

  // 1. Pattern: A → B  (arrow)
  let m = line.match(/([a-zA-Z][a-zA-Z\s'"-]*?)\s*→\s*([a-zA-Z][a-zA-Z\s'"-]*)/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    const raw2 = m[2].trim();
    o = raw2.split(/[^a-zA-Z\s'"-]/)[0].trim().replace(/[.,;:!?()]+$/, '').trim();
    if (w && o && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
  }

  // 2. Pattern: wrongWord: ... — origWord  (dash after colon explanation)
  m = line.match(/^[✅❌✔✘×\s]*[①②③④]?\s*([a-zA-Z][a-zA-Z\s'"-]*?)\s*:.*—\s*([a-zA-Z][a-zA-Z\s'"-]+)/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    const raw2 = m[2].trim();
    o = raw2.split(/[\s(]/)[0].replace(/[.,;:!?()]+$/, '').trim();
    if (w && o && /[a-zA-Z]/.test(w) && w.length < 40) return { wrong: w, orig: o };
  }

  // 3. Pattern: X(Korean)는/이 Y(Korean)의 반의어 — extract both English
  m = line.match(/([a-zA-Z][a-zA-Z\s'"-]*?)\([^)]+\)[은는이가]?\s+([a-zA-Z][a-zA-Z\s'"-]*?)\([^)]+\)[의가]?\s*(반의어|반대)/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    o = m[2].trim().replace(/[.,;:!?()]+$/, '').trim();
    if (w && o && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
  }

  // 4. Pattern: X(Korean) 아니라/아닌 Y(Korean)
  m = line.match(/([a-zA-Z][a-zA-Z\s'"-]*?)\([^)]+\)[이가]?\s*아니라\s+([a-zA-Z][a-zA-Z\s'"-]*)/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    o = m[2].trim().split(/[\s(]/)[0].replace(/[.,;:!?()]+$/, '').trim();
    if (w && o && /[a-zA-Z]/.test(w)) return { wrong: w, orig: o };
  }

  // 5. Pattern: 과거시제/과거형/p.p. origWord (find wrong before)
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

  // 6. Pattern: 병렬로/병렬이므로 origWord
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

  // 7. Pattern: just wrong word (: followed by Korean explanation)
  m = line.match(/^[✅❌\s]*[①②③④]?\s*([a-zA-Z][a-zA-Z\s'"-]*?)\s*:/);
  if (m) {
    w = m[1].trim().replace(/[.,;:!?()]+$/, '').trim();
    if (w && w.length > 0 && w.length < 40 && /[a-zA-Z]/.test(w)) {
      return { wrong: w, orig: null };
    }
  }

  return { wrong: null, orig: null };
}

// Extract wrong/orig words for a marker from all analysis lines
function extractForMarker(analysis, markerSymbol) {
  if (!analysis) return { wrong: null, orig: null };
  const lines = analysis.split('\n');
  for (const line of lines) {
    if (!line.includes(markerSymbol)) continue;
    // Skip lines where marker appears in Korean part or is at the end of explanations
    const markerPos = line.indexOf(markerSymbol);
    // The marker should be early in the line (within first 10 chars after ✅❌ prefix)
    const prefix = line.substring(0, markerPos);
    if (prefix.replace(/[✅❌✔✘×\s]/g, '').length > 3) continue;

    const { wrong, orig } = extractPairFromLine(line);
    if (wrong || orig) return { wrong, orig };
  }
  return { wrong: null, orig: null };
}

// Find and replace original word in passage with marker<u>wrongWord</u>
function applyFix(passage, missingMarker, wrongWord, origWord) {
  const tryReplace = (text, target, replacement) => {
    if (!target) return null;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Not preceded by marker or <u
    const re = new RegExp('(?<![①②③④<])\\b(' + escaped + ')\\b(?!</u>)', 'i');
    const match = re.exec(text);
    if (!match) return null;
    // Check not inside existing marker
    const prevCtx = text.substring(Math.max(0, match.index - 3), match.index);
    if (MARKERS.some(m => prevCtx.includes(m))) return null;
    const found = match[1];
    const display = replacement || found;
    return text.substring(0, match.index) + missingMarker + '<u>' + display + '</u>' + text.substring(match.index + found.length);
  };

  // Try: replace origWord with marker<u>wrongWord</u>
  if (origWord) {
    const result = tryReplace(passage, origWord, wrongWord || origWord);
    if (result) return result;

    // Multi-word original (e.g., "on board with")
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

  // Try: find wrongWord in passage (unmarked)
  if (wrongWord) {
    const result = tryReplace(passage, wrongWord, wrongWord);
    if (result) return result;

    // Multi-word wrong word
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

let totalFixed = 0;
let totalSkipped = 0;
const skippedList = [];

for (const relPath of files) {
  const filePath = path.join(BASE, relPath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  let fileModified = false;

  for (let qi = 0; qi < data.questions.length; qi++) {
    const q = data.questions[qi];

    if (!q.ch || q.ch.length !== 4 || !q.ch.every((c, i) => c === MARKERS[i])) continue;
    if (!q.passage) continue;

    for (const missingMarker of MARKERS) {
      if (q.passage.includes(missingMarker)) continue;

      const { wrong, orig } = extractForMarker(q.det?.analysis || '', missingMarker);

      const newPassage = applyFix(q.passage, missingMarker, wrong, orig);

      if (newPassage && newPassage.includes(missingMarker)) {
        console.log(`FIX  ${relPath} Q${q.id} ${missingMarker}: wrong="${wrong || '?'}" orig="${orig || '?'}"`);
        data.questions[qi].passage = newPassage;
        q.passage = newPassage;
        fileModified = true;
        totalFixed++;
      } else {
        console.log(`SKIP ${relPath} Q${q.id} ${missingMarker}: wrong="${wrong || 'none'}" orig="${orig || 'none'}"`);
        skippedList.push({ file: relPath, qid: q.id, marker: missingMarker, wrong, orig,
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
fs.writeFileSync('/tmp/rmm-b2-skipped.json', JSON.stringify(skippedList, null, 2));
console.log('Skipped list → /tmp/rmm-b2-skipped.json');
