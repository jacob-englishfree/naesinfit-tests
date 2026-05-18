#!/usr/bin/env node
/**
 * fix-rmm-b5.js
 * Fix RENDER-MARKER-MISSING for files listed in /tmp/rmm-b5.json.
 * Only modifies q.passage.
 *
 * Marker types:
 *   어법: passage shows WRONG form underlined.
 *     det says: "❌ ③ wrongWord: ..." or "③ wrongWord → correctWord"
 *     fullPassage has correctWord → replace correctWord with ③<u>wrongWord</u>
 *
 *   문맥상 부적절한 어휘: passage shows one WRONG word underlined.
 *     det says: "❌ N wrongWord: 원문은 origWord" → find origWord, replace with N<u>wrongWord</u>
 *     alt: "✅ N N" format with tip/korean → parse tip for "origWord ↔ wrongWord"
 *
 *   문장삽입/순서/순서배열: insert ①②③④ between sentences from fullPassage.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKERS = ['①','②','③','④','⑤'];

// ── helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitSentences(text) {
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"'\u201C\(])/);
  return parts.filter(s => s.trim().length > 0);
}

function buildInsertionPassage(fullPassage) {
  const sents = splitSentences(fullPassage);
  const numGaps = sents.length - 1;

  if (numGaps < 4) {
    const step = Math.floor(fullPassage.length / 5);
    const chunks = [];
    for (let i = 0; i < 4; i++) chunks.push(fullPassage.slice(i * step, (i + 1) * step));
    chunks.push(fullPassage.slice(4 * step));
    return chunks[0] + ' ① ' + chunks[1] + ' ② ' + chunks[2] + ' ③ ' + chunks[3] + ' ④ ' + chunks[4];
  }

  let idxs;
  if (numGaps === 4) {
    idxs = [0, 1, 2, 3];
  } else {
    idxs = [];
    const step = numGaps / 5;
    for (let k = 0; k < 4; k++) {
      idxs.push(Math.min(numGaps - 1, Math.floor((k + 1) * step)));
    }
    for (let k = 1; k < 4; k++) {
      if (idxs[k] <= idxs[k - 1]) idxs[k] = idxs[k - 1] + 1;
    }
    for (let k = 3; k >= 0; k--) {
      const maxVal = numGaps - 1 - (3 - k);
      if (idxs[k] > maxVal) idxs[k] = maxVal;
    }
    for (let k = 2; k >= 0; k--) {
      if (idxs[k] >= idxs[k + 1]) idxs[k] = idxs[k + 1] - 1;
    }
  }

  const out = [];
  let mk = 0;
  for (let i = 0; i < sents.length; i++) {
    out.push(sents[i]);
    if (mk < 4 && i === idxs[mk]) {
      out.push(MARKERS[mk]);
      mk++;
    }
  }
  return out.join(' ');
}

/**
 * Find word positions respecting word boundaries.
 * Returns array of start indices.
 */
function findWordPositions(text, word) {
  const positions = [];
  let idx = 0;
  const w = word.toLowerCase();
  const t = text.toLowerCase();
  while (true) {
    const found = t.indexOf(w, idx);
    if (found === -1) break;
    const before = found > 0 ? t[found - 1] : ' ';
    const after = found + w.length < t.length ? t[found + w.length] : ' ';
    if (!/[a-z']/.test(before) && !/[a-z']/.test(after)) {
      positions.push(found);
    }
    idx = found + 1;
  }
  return positions;
}

/**
 * Replace word at position pos in text with replacement.
 * Handles case-preservation.
 */
function replaceAt(text, pos, origWord, replacement) {
  return text.slice(0, pos) + replacement + text.slice(pos + origWord.length);
}

/**
 * Check if position pos in text is already inside a marker tag.
 */
function isAlreadyMarked(text, pos) {
  const before = text.slice(Math.max(0, pos - 5), pos);
  return /[①②③④⑤]/.test(before);
}

/**
 * Parse det fields to extract { wrongWord, origWord } for a given marker index (1-based).
 *
 * Handles multiple det formats:
 *   Format A: "❌ ③ wrongWord: 원문은 origWord ..."
 *   Format B: "❌ ③ wrongWord: reason" (no 원문은 → wrongWord is in passage already, orig = correct)
 *   Format C: "③ wrongWord → correctWord ..." (in det.korean/tip)
 *   Format D: "✅ ③ N" / "❌ ③ N" (number-only, no word) → use det.korean/tip
 *   Format E: "❌ ③ word → origWord: ..." (explicit arrow)
 */
function parseDetWords(det, markerIdx) {
  if (!det) return null;
  const mc = MARKERS[markerIdx - 1];
  const analysis = det.analysis || '';
  const korean = det.korean || '';
  const tip = det.tip || '';

  // Format A+E: ❌/✅ N word (colon or arrow follows)
  const re = new RegExp(escapeRegex(mc) + '\\s+([A-Za-z][A-Za-z\'\\-]*)');
  const analysisLines = analysis.split('\n');
  for (const line of analysisLines) {
    if (!line.includes(mc)) continue;
    const m = line.match(re);
    if (!m) continue;

    const displayWord = m[1]; // candidate wrong word

    // Skip if displayWord is just a circled number (false match)
    if (/^[①②③④⑤]$/.test(displayWord)) continue;

    // Look for "원문은 X" or "원문 X" in the same line
    const origRe = /원문(?:은)?\s+([A-Za-z][A-Za-z\'\\-]*)/;
    const origM = line.match(origRe);
    const origWord = origM ? origM[1] : null;

    // Look for "→ X" pattern (could be in analysis or korean)
    const arrowRe = new RegExp(escapeRegex(mc) + '\\s+[A-Za-z\'\\-]+\\s*→\\s*([A-Za-z][A-Za-z\'\\-]*)');
    const arrowM = line.match(arrowRe);
    const arrowOrig = arrowM ? arrowM[1] : null;

    // Only return early if we have enough info (origWord known, or wrongWord is unique enough)
    if (origWord || arrowOrig) {
      return { wrongWord: displayWord, origWord: origWord || arrowOrig };
    }
    // Don't return yet — fall through to Format C which may have arrow info
    // Store as candidate
    var candidateA = { wrongWord: displayWord, origWord: null };
    break; // exit loop, but still try Format C
  }

  // Format C: det.korean has "③ wrongWord → correctWord" or "wrongWord → correctWord"
  if (korean) {
    // e.g., "③ taking → take (had to + 동사원형)"
    const korRe = new RegExp(escapeRegex(mc) + '\\s+([A-Za-z][A-Za-z\'\\-]*)\\s*→\\s*([A-Za-z][A-Za-z\'\\-]*)');
    const km = korean.match(korRe);
    if (km) return { wrongWord: km[1], origWord: km[2] };

    // e.g., "loved(좋아하다) → hated(싫어하다)" without marker in korean
    // But we know the answer marker from q.ans
    const simpleArrow = korean.match(/([A-Za-z][A-Za-z\'\\-]*)\s*[\(（][^)）]*[\)）]?\s*→\s*([A-Za-z][A-Za-z\'\\-]*)/);
    if (simpleArrow) {
      // wrongWord → correctWord means: wrongWord is shown, origWord is correctWord
      // But check which is the "wrong" one: context depends on ✅/❌ markers
      // Heuristic: if analysis has "✅ N" for this marker, the wrongWord is the answer
      const tickForMarker = new RegExp('[✅]\\s*' + escapeRegex(mc));
      if (tickForMarker.test(analysis)) {
        // ✅ means this is the wrong one (inverted format)
        return { wrongWord: simpleArrow[1], origWord: simpleArrow[2] };
      }
      // Standard: ❌ N wrongWord
      return { wrongWord: simpleArrow[1], origWord: simpleArrow[2] };
    }
  }

  // Format D: det.tip has "X ↔ Y" → the wrong one corresponds to markerIdx
  if (tip) {
    // e.g., "hated = 싫어했다 ↔ loved = 좋아했다"
    // e.g., "outstanding(뛰어난) ↔ inferior(열등한)"
    const tipPair = tip.match(/([A-Za-z][A-Za-z\'\\-]*)\s*[\(（（][^)））]*[\)））]?\s*↔\s*([A-Za-z][A-Za-z\'\\-]*)/);
    if (tipPair) {
      // Which is wrong? Check det.korean for hint
      const korLower = korean.toLowerCase();
      const w1 = tipPair[1].toLowerCase();
      const w2 = tipPair[2].toLowerCase();
      // det.korean format: "wrongWord(translation) → origWord(translation)"
      if (korLower.includes(w1 + '(') || korLower.includes(w1 + '（')) {
        return { wrongWord: tipPair[1], origWord: tipPair[2] };
      }
      if (korLower.includes(w2 + '(') || korLower.includes(w2 + '（')) {
        return { wrongWord: tipPair[2], origWord: tipPair[1] };
      }
      // Fallback: first word in tip is the wrong one
      return { wrongWord: tipPair[1], origWord: tipPair[2] };
    }
  }

  // Try det.analysis for "❌ N excluded → embedded" pattern
  for (const line of analysisLines) {
    if (!line.includes(mc)) continue;
    const arrowRe2 = new RegExp(escapeRegex(mc) + '\\s+([A-Za-z][A-Za-z\'\\-]*)\\s*→\\s*([A-Za-z][A-Za-z\'\\-]*)');
    const am = line.match(arrowRe2);
    if (am) return { wrongWord: am[1], origWord: am[2] };
  }

  // Parse det.korean for HTML bold pattern: "<b>wrongWord</b>(translation) → <b>origWord</b>"
  if (korean) {
    const htmlBold = korean.match(/<b>([A-Za-z][A-Za-z'\-]*)<\/b>\s*[\(（][^)）]*[\)）]?\s*→\s*<b>([A-Za-z][A-Za-z'\-]*)<\/b>/);
    if (htmlBold) return { wrongWord: htmlBold[1], origWord: htmlBold[2] };

    // Plain "wrongWord(translation) → origWord" (no bold)
    const plainArrow = korean.match(/([A-Za-z][A-Za-z'\-]*)\s*[\(（][^)）]*[\)）]\s*→\s*([A-Za-z][A-Za-z'\-]*)/);
    if (plainArrow) return { wrongWord: plainArrow[1], origWord: plainArrow[2] };
  }

  // Last resort: return candidateA (wrongWord from analysis, no origWord)
  if (typeof candidateA !== 'undefined' && candidateA) return candidateA;

  return null;
}

/**
 * For 어법: wrongWord is the incorrect form shown in passage.
 *           origWord is the correct form that appears in fullPassage.
 *
 * For 문맥상 부적절한 어휘: wrongWord is the substituted wrong word (shown marked).
 *           origWord is the original correct word (in fullPassage).
 *
 * Strategy:
 *   1. Find origWord in current passage or fullPassage.
 *   2. Replace with markerChar<u>wrongWord</u>.
 *   3. Preserve existing markers from current passage.
 */
function injectWordMarker(q, fullPassage, missingMarkerIdx) {
  const markerChar = MARKERS[missingMarkerIdx - 1];
  const currentPassage = q.passage || fullPassage;

  // Get word info from det
  const wordInfo = parseDetWords(q.det, missingMarkerIdx);
  if (!wordInfo) return null;

  const { wrongWord, origWord } = wordInfo;

  // The "target" is what we need to find in the passage (the thing to replace)
  // If origWord exists, that's what's in fullPassage and (possibly) in currentPassage
  // If no origWord, try wrongWord itself (for passages that already show the wrong word unmarked)
  const targetToFind = origWord || wrongWord;

  // Search in currentPassage first, then fullPassage
  for (const base of [currentPassage, fullPassage]) {
    const positions = findWordPositions(base, targetToFind);
    for (const pos of positions) {
      if (isAlreadyMarked(base, pos)) continue;
      // Do the replacement
      const updated = replaceAt(base, pos, targetToFind, `${markerChar}<u>${wrongWord}</u>`);
      if (updated.includes(markerChar)) {
        // If we used fullPassage as base, need to re-apply existing markers from currentPassage
        if (base === fullPassage && currentPassage !== fullPassage) {
          return reapplyExistingMarkers(updated, currentPassage, markerChar);
        }
        return updated;
      }
    }
  }

  // Last resort: try without word boundary (e.g., "taking" within "taken" etc.)
  for (const base of [currentPassage, fullPassage]) {
    const idx = base.toLowerCase().indexOf(targetToFind.toLowerCase());
    if (idx === -1) continue;
    if (isAlreadyMarked(base, idx)) continue;
    const updated = replaceAt(base, idx, targetToFind, `${markerChar}<u>${wrongWord}</u>`);
    if (updated.includes(markerChar)) {
      if (base === fullPassage && currentPassage !== fullPassage) {
        return reapplyExistingMarkers(updated, currentPassage, markerChar);
      }
      return updated;
    }
  }

  // For 어법: also try searching for wrongWord in currentPassage (it might already be wrong form)
  if (wrongWord && wrongWord !== targetToFind) {
    const positions = findWordPositions(currentPassage, wrongWord);
    for (const pos of positions) {
      if (isAlreadyMarked(currentPassage, pos)) continue;
      const updated = replaceAt(currentPassage, pos, wrongWord, `${markerChar}<u>${wrongWord}</u>`);
      if (updated.includes(markerChar)) return updated;
    }
  }

  return null;
}

/**
 * When rebuilding from fullPassage, re-apply existing markers from partialPassage.
 */
function reapplyExistingMarkers(newBase, partialPassage, skipMarker) {
  let result = newBase;
  const existingRe = /([①②③④⑤])<u>([^<]+)<\/u>/g;
  let m;
  while ((m = existingRe.exec(partialPassage)) !== null) {
    const mk = m[1];
    const word = m[2];
    if (mk === skipMarker) continue;
    if (result.includes(mk)) continue; // already there
    const positions = findWordPositions(result, word);
    for (const pos of positions) {
      if (!isAlreadyMarked(result, pos)) {
        result = replaceAt(result, pos, word, `${mk}<u>${word}</u>`);
        break;
      }
    }
  }
  return result;
}

// ── Types ────────────────────────────────────────────────────────────────────
const INSERTION_TYPES = new Set(['문장삽입', '순서', '순서배열']);
const WORD_MARKER_TYPES = new Set(['어법', '문맥상 부적절한 어휘', '오류찾기']);

// ── Main ─────────────────────────────────────────────────────────────────────

const files = JSON.parse(fs.readFileSync('/tmp/rmm-b5.json', 'utf8'));

let totalFiles = 0;
let totalQuestions = 0;
const skipped = [];

for (const relPath of files) {
  const absPath = path.join(ROOT, relPath);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (e) {
    console.error('SKIP (parse error):', relPath, e.message);
    continue;
  }

  const fullPassage = data.fullPassage || '';
  if (!fullPassage) {
    console.log('SKIP (no fullPassage):', relPath);
    continue;
  }

  let fileChanged = false;

  for (const q of data.questions) {
    if (q.fmt !== 'mc') continue;
    const ch = q.ch || [];
    const isMarkerCh = ch.length === 4 && ch.every(c =>
      typeof c === 'string' && /^[①②③④⑤]\s*$/.test((c || '').trim())
    );
    if (!isMarkerCh) continue;

    const passage = q.passage || '';
    const missingMarkers = MARKERS.slice(0, 4).filter(m => !passage.includes(m));
    if (missingMarkers.length === 0) continue;

    const type = q.type || '';
    let newPassage = null;

    if (INSERTION_TYPES.has(type)) {
      newPassage = buildInsertionPassage(fullPassage);
    } else if (WORD_MARKER_TYPES.has(type)) {
      let current = passage || fullPassage;
      let allOk = true;
      for (const markerChar of missingMarkers) {
        const missingIdx = MARKERS.indexOf(markerChar) + 1;
        const fixed = injectWordMarker({ ...q, passage: current }, fullPassage, missingIdx);
        if (fixed && fixed.includes(markerChar)) {
          current = fixed;
        } else {
          console.log(`  SKIP Q${q.id} [${type}] missing:${markerChar} — ${relPath}`);
          skipped.push({ file: relPath, qid: q.id, type, missing: markerChar });
          allOk = false;
          break;
        }
      }
      if (allOk) newPassage = current;
    } else {
      newPassage = buildInsertionPassage(fullPassage);
    }

    if (newPassage && MARKERS.slice(0, 4).every(m => newPassage.includes(m))) {
      q.passage = newPassage;
      fileChanged = true;
      totalQuestions++;
      process.stdout.write(`  FIX Q${q.id} [${type}]  ${relPath}\n`);
    } else if (newPassage) {
      const stillMissing = MARKERS.slice(0, 4).filter(m => !newPassage.includes(m));
      const prevMissing = MARKERS.slice(0, 4).filter(m => !passage.includes(m));
      if (stillMissing.length < prevMissing.length) {
        q.passage = newPassage;
        fileChanged = true;
        totalQuestions++;
        console.log(`  PARTIAL Q${q.id} [${type}] still missing:${stillMissing.join(',')}  ${relPath}`);
      } else {
        console.log(`  FAIL Q${q.id} [${type}] no improvement  ${relPath}`);
        skipped.push({ file: relPath, qid: q.id, type, missing: missingMarkers.join(',') });
      }
    }
  }

  if (fileChanged) {
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2));
    totalFiles++;
  }
}

console.log('\n=== DONE ===');
console.log(`Fixed ${totalQuestions} questions in ${totalFiles} files`);
if (skipped.length > 0) {
  console.log(`\nSkipped ${skipped.length} (need manual fix):`);
  for (const s of skipped) {
    console.log(`  ${s.file} Q${s.qid} [${s.type}] missing:${s.missing}`);
  }
}
