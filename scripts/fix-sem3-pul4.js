#!/usr/bin/env node
/**
 * fix-sem3-pul4.js — targeted fix for SEM-3 and P-UL4 errors
 *
 * Run from naesinfit-tests directory.
 */

const fs = require('fs');
const path = require('path');

const CIRCLE = ['①', '②', '③', '④', '⑤'];
const GRAMMAR_TYPES = ['어법', '어법 빈칸', '어법 밑줄형', '어법 빈칸형'];

function getUnderlines(passage) {
  const result = [];
  const regex = /<u>([^<]+)<\/u>/g;
  let m;
  while ((m = regex.exec(passage)) !== null) {
    result.push({ pos: m.index, full: m[0], word: m[1].trim() });
  }
  return result;
}

// Get the circle marker immediately before a <u> tag at given position
function getMarkerBeforeUl(passage, ulPos) {
  // Look back up to 3 chars before <u>
  const before = passage.slice(Math.max(0, ulPos - 3), ulPos);
  for (const c of CIRCLE) {
    if (before.includes(c)) return c;
  }
  return null;
}

// Strip trailing periods/punctuation from word for comparison
function normalizeWord(w) {
  return (w || '').replace(/^[①②③④⑤]\s*/, '').trim().replace(/[.,;:!?]+$/, '');
}

function fixQuestion(q, fullPassage) {
  const typeNorm = (q.type || '').trim();
  if (!GRAMMAR_TYPES.some(gt => typeNorm.includes(gt))) return null;

  const ch = q.ch || [];
  const hasCircledCh = ch.some(c => CIRCLE.some(m => (c || '').trim().startsWith(m)));
  if (!hasCircledCh) return null;
  if (ch.length !== 4) return null;

  // Skip sentence-level 어법: ch entries are just circle markers with no word (e.g., ['①', '②', '③', '④'])
  const allWordsEmpty = ch.every(c => normalizeWord(c).length === 0);
  if (allWordsEmpty) return null;

  let passage = q.passage || fullPassage || '';
  if (!passage) return null;

  const underlines = getUnderlines(passage);
  const chWords = ch.map(c => normalizeWord(c));

  // Count markers in passage
  const markerCount = (passage.match(/[①②③④]/g) || []).length;

  // Build mapping: passage position → ch index that SHOULD be here
  // First determine which ch word maps to which underline position
  const ulWords = underlines.map(u => normalizeWord(u.word));

  // Check what's missing
  const missingFromPassage = []; // ch word not found in passage at all
  const presentInUl = []; // ch word found in underlines

  for (let i = 0; i < chWords.length; i++) {
    const cw = chWords[i].toLowerCase();
    const ulIdx = ulWords.findIndex(uw => uw.toLowerCase() === cw || uw.toLowerCase().includes(cw) || cw.includes(uw.toLowerCase()));
    if (ulIdx >= 0) {
      presentInUl.push({ chIdx: i, ulIdx, word: chWords[i] });
    } else {
      const inPassage = passage.toLowerCase().includes(cw);
      missingFromPassage.push({ chIdx: i, word: chWords[i], inPassage });
    }
  }

  // Case A: All 4 ch words found in underlines (ORDER FIX needed)
  if (presentInUl.length === 4 && missingFromPassage.length === 0) {
    // Check if markers match ch labels
    // Build: for each underline, what marker is before it? What marker should be there?
    const ulMarkerMap = underlines.map((ul, i) => {
      const currentMarker = getMarkerBeforeUl(passage, ul.pos);
      const expectedChIdx = presentInUl.find(p => p.ulIdx === i);
      const expectedMarker = expectedChIdx !== undefined ? CIRCLE[expectedChIdx.chIdx] : null;
      return { ul, currentMarker, expectedMarker };
    });

    const needsReorder = ulMarkerMap.some(m => m.currentMarker !== m.expectedMarker);
    if (!needsReorder) return null;

    // Fix: rebuild the passage with correct marker→underline assignments
    let newPassage = passage;
    // Remove existing markers before <u> tags (process in reverse order for safety)
    const markerPositions = [];
    for (const { ul, currentMarker } of ulMarkerMap) {
      if (currentMarker) {
        const markerPos = ul.pos - 1; // marker is right before <u>
        // Find actual position of the marker (it might be 1-2 chars before <u>)
        const searchStart = Math.max(0, ul.pos - 3);
        const snippet = passage.slice(searchStart, ul.pos);
        const relPos = snippet.lastIndexOf(currentMarker);
        if (relPos >= 0) {
          markerPositions.push({ absPos: searchStart + relPos, marker: currentMarker, ulPos: ul.pos });
        }
      }
    }

    // Remove markers in reverse order
    markerPositions.sort((a, b) => b.absPos - a.absPos);
    let cleanPassage = passage;
    for (const { absPos, marker } of markerPositions) {
      cleanPassage = cleanPassage.slice(0, absPos) + cleanPassage.slice(absPos + marker.length);
    }

    // Add correct markers back
    // Need to recalculate underline positions in cleanPassage
    const cleanUnderlines = getUnderlines(cleanPassage);
    if (cleanUnderlines.length !== 4) {
      console.log(`  [SKIP-ORDER] Q${q.id}: underline count mismatch after cleaning (${cleanUnderlines.length})`);
      return null;
    }

    // Sort cleanUnderlines by position and assign markers based on which ch word they are
    let result = cleanPassage;
    const insertions = [];
    for (const { ul } of ulMarkerMap) {
      // Find corresponding underline in cleanPassage
      const cleanUl = cleanUnderlines.find(cu => cu.word.trim() === ul.word.trim());
      if (!cleanUl) continue;
      const expectedChEntry = presentInUl.find(p => normalizeWord(ul.word) === chWords[p.chIdx].toLowerCase() || normalizeWord(ul.word).toLowerCase().includes(chWords[p.chIdx].toLowerCase()) || chWords[p.chIdx].toLowerCase().includes(normalizeWord(ul.word).toLowerCase()));
      if (!expectedChEntry) continue;
      const correctMarker = CIRCLE[expectedChEntry.chIdx];
      insertions.push({ pos: cleanUl.pos, marker: correctMarker });
    }

    // Insert markers in reverse order
    insertions.sort((a, b) => b.pos - a.pos);
    for (const { pos, marker } of insertions) {
      result = result.slice(0, pos) + marker + result.slice(pos);
    }

    // Verify result has 4 markers
    const newMarkerCount = (result.match(/[①②③④]/g) || []).length;
    if (newMarkerCount < 4) {
      console.log(`  [SKIP-ORDER] Q${q.id}: only ${newMarkerCount} markers after fix`);
      return null;
    }

    // ans doesn't change since we're fixing passage markers to match ch
    return { newPassage: result, newCh: null, newAns: null, fixType: 'ORDER_FIX' };
  }

  // Case B: Some ch words missing from passage (MISSING WORD FIX)
  if (missingFromPassage.length > 0) {
    const det = q.det || {};
    const analysis = det.analysis || '';
    const fp = fullPassage || '';

    let newPassage = passage;
    let changed = false;

    for (const { chIdx, word: wrongWord, inPassage } of missingFromPassage) {
      const marker = CIRCLE[chIdx];

      if (inPassage) {
        // Word is in passage but not in an underline — just add marker+<u>
        // Find first occurrence not already underlined
        const regex = new RegExp('(?<!<u>[^<]{0,200})\\b' + escapeRegex(wrongWord) + '\\b(?![^<]*<\\/u>)', 'i');
        const match = regex.exec(newPassage);
        if (match) {
          const before = newPassage.slice(0, match.index);
          const after = newPassage.slice(match.index + match[0].length);
          const nearBefore = before.slice(-3);
          if (!CIRCLE.some(c => nearBefore.includes(c))) {
            newPassage = before + marker + '<u>' + match[0] + '</u>' + after;
            changed = true;
          }
        }
        continue;
      }

      // Word not in passage at all — need to find correct form and replace it
      let correctForm = null;

      // Try to extract from det.analysis: look for "wrongWord → correctForm"
      const arrowMatch = analysis.match(new RegExp(escapeRegex(wrongWord) + '\\s*→\\s*([\\w\\s]+?)(?:\\s*[:.,\\n]|$)', 'i'));
      if (arrowMatch) {
        correctForm = arrowMatch[1].trim().split(/\s+/)[0]; // take first word
      }

      // Also check for "incorrectForm → correctForm" on any line containing wrongWord
      if (!correctForm) {
        for (const line of analysis.split('\n')) {
          if (line.toLowerCase().includes(wrongWord.toLowerCase())) {
            const am = line.match(/→\s*([\w\s]+?)(?:\s*[:.,]|$)/);
            if (am) {
              correctForm = am[1].trim().split(/\s+/)[0];
              break;
            }
          }
        }
      }

      // Try morphological guesses
      const morphGuesses = correctForm ? [correctForm, ...getMorphGuesses(wrongWord)] : getMorphGuesses(wrongWord);

      let replaced = false;
      for (const term of morphGuesses) {
        if (!term || term.length < 2) continue;
        // Find the term in passage, not already underlined
        const tryRegex = new RegExp('\\b' + escapeRegex(term) + '\\b', 'i');
        // Find all occurrences and pick the first one not already in a marker context
        let searchPassage = newPassage;
        let offset = 0;
        let m;
        while ((m = tryRegex.exec(searchPassage)) !== null) {
          const absPos = offset + m.index;
          const nearBefore = newPassage.slice(Math.max(0, absPos - 5), absPos);
          const nearAfter = newPassage.slice(absPos, Math.min(newPassage.length, absPos + m[0].length + 10));
          // Skip if already underlined
          if (nearAfter.includes('<u>') || nearBefore.includes('</u>')) {
            offset += m.index + 1;
            searchPassage = newPassage.slice(offset);
            continue;
          }
          // Skip if already has a marker
          if (CIRCLE.some(c => nearBefore.includes(c))) {
            offset += m.index + 1;
            searchPassage = newPassage.slice(offset);
            continue;
          }
          // Replace!
          const before = newPassage.slice(0, absPos);
          const after = newPassage.slice(absPos + m[0].length);
          newPassage = before + marker + '<u>' + wrongWord + '</u>' + after;
          replaced = true;
          changed = true;
          break;
        }
        if (replaced) break;
      }

      if (!replaced) {
        console.log(`  [WARN] Q${q.id}: no placement for ${marker} ${wrongWord} (correctForm=${correctForm || 'unknown'})`);
      }
    }

    if (!changed) return null;
    return { newPassage, newCh: null, newAns: null, fixType: 'MISSING_WORD' };
  }

  return null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMorphGuesses(wrongWord) {
  const guesses = [];
  const w = wrongWord.toLowerCase();

  if (w.endsWith('ing')) {
    const base = w.slice(0, -3);
    guesses.push(base + 'ed', base + 'es', base + 's', base, base + 'e');
    if (base.length > 1 && base[base.length-1] === base[base.length-2]) {
      guesses.push(base.slice(0, -1));
    }
  }
  if (w.endsWith('ed')) {
    const base = w.slice(0, -2);
    guesses.push(base + 'ing', base, base + 's', base + 'es', base + 'e');
  }
  if (w.endsWith('ly')) {
    const base = w.slice(0, -2);
    guesses.push(base); // overly → over, possibly → possible, precisely → precise
    // also try without last char for "possible" → "possibly"
    guesses.push(base + 'e', base + 'le');
  }
  if (!w.endsWith('ly')) {
    guesses.push(w + 'ly');
    guesses.push(w + 'ally');
  }
  // what/that/which/where substitutions
  if (w === 'what') guesses.push('that', 'which');
  if (w === 'that') guesses.push('what', 'which');
  if (w === 'which') guesses.push('that', 'what', 'where');
  if (w === 'where') guesses.push('which', 'that');
  if (w === 'who') guesses.push('whom', 'which');
  if (w === 'whom') guesses.push('who', 'that');
  // to-infinitive vs gerund
  if (w.startsWith('to ')) {
    const rest = w.slice(3);
    guesses.push(rest + 'ing', rest);
  }
  // verb forms
  if (w.endsWith('ness')) guesses.push(w.slice(0, -4));
  if (w.endsWith('tion')) guesses.push(w.slice(0, -4) + 'te', w.slice(0, -4) + 't');
  if (w.endsWith('ment')) guesses.push(w.slice(0, -4));

  return [...new Set(guesses)].filter(g => g && g.length >= 2 && g !== w);
}

function processFile(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`  [MISSING FILE] ${fullPath}`);
    return false;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch(e) {
    console.error(`  [PARSE ERROR] ${e.message}`);
    return false;
  }

  const fullPassage = data.fullPassage || '';
  const questions = data.questions || [];
  let modified = false;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const result = fixQuestion(q, fullPassage);
    if (!result) continue;

    const { newPassage, fixType } = result;
    if (newPassage === (q.passage || '')) continue;

    // Safety check: new passage should not have fewer markers than old
    const oldMarkers = (q.passage || '').match(/[①②③④]/g) || [];
    const newMarkers = (newPassage || '').match(/[①②③④]/g) || [];
    if (newMarkers.length < oldMarkers.length) {
      console.log(`  [REVERT-SAFETY] Q${q.id}: markers would decrease ${oldMarkers.length}→${newMarkers.length}`);
      continue;
    }

    const oldUls = getUnderlines(q.passage || '');
    const newUls = getUnderlines(newPassage);
    console.log(`  [${fixType}] Q${q.id}: markers ${oldMarkers.length}→${newMarkers.length}, uls ${oldUls.length}→${newUls.length}`);

    questions[i] = { ...q, passage: newPassage };
    modified = true;
  }

  if (modified) {
    data.questions = questions;
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  }
  return false;
}

const files = [
  'data/모의고사/고1/10월/19번/퀴즈.json',
  'data/모의고사/고1/10월/20번/워크북.json',
  'data/모의고사/고1/10월/22번/워크북.json',
  'data/모의고사/고1/10월/23번/워크북.json',
  'data/모의고사/고1/10월/26번/워크북.json',
  'data/모의고사/고1/10월/29번/워크북.json',
  'data/모의고사/고1/10월/32번/워크북.json',
  'data/모의고사/고2/3월_2024/39번/퀴즈.json',
  'data/모의고사/고2/3월/21번/워크북.json',
  'data/모의고사/고2/3월/29번/워크북.json',
  'data/모의고사/고2/3월/35번/단어.json',
  'data/모의고사/고2/6월_2024/19번/퀴즈.json',
  'data/부교재/수능특강/영어/10강/1번/워크북.json',
  'data/부교재/수능특강/영어/10강/2번/워크북.json',
  'data/부교재/수능특강/영어/10강/Gateway/워크북.json',
  'data/부교재/수능특강/영어/10강/워크북.json',
  'data/부교재/수능특강/영어/13강/Gateway/퀴즈.json',
  'data/부교재/수능특강/영어/15강/2번/워크북.json',
  'data/부교재/수능특강/영어/15강/3번/워크북.json',
  'data/부교재/수능특강/영어/15강/3번/퀴즈.json',
  'data/부교재/수능특강/영어/15강/4번/워크북.json',
  'data/부교재/수능특강/영어/15강/4번/퀴즈.json',
  'data/부교재/수능특강/영어/15강/Gateway/워크북.json',
  'data/부교재/수능특강/영어/21강/워크북.json',
  'data/부교재/수능특강/영어/21강/퀴즈.json',
  'data/부교재/수능특강/영어/22강/1번/워크북.json',
  'data/부교재/수능특강/영어/22강/2번/워크북.json',
  'data/부교재/수능특강/영어/22강/3번/워크북.json',
  'data/부교재/수능특강/영어/22강/워크북.json',
  'data/부교재/수능특강/영어/3강/3번/워크북.json',
  'data/부교재/수능특강/영어/3강/3번/퀴즈.json',
  'data/부교재/수능특강/영어/3강/워크북.json',
  'data/부교재/수능특강/영어/5강/퀴즈.json',
  'data/부교재/수능특강/영어/6강/1번/워크북.json',
  'data/부교재/수능특강/영어/6강/2번/퀴즈.json',
  'data/부교재/수능특강Light/영어/11강/4번/퀴즈.json',
  'data/부교재/수능특강Light/영어/16강/Gateway/워크북.json',
  'data/부교재/수능특강Light/영어/20강/3번/워크북.json',
  'data/부교재/수능특강Light/영어/2강/3번/워크북.json',
  'data/부교재/수능특강Light/영어/2강/3번/퀴즈.json',
  'data/부교재/수능특강Light/영어/2강/4번/퀴즈.json',
  'data/부교재/수능특강Light/영어/2강/Gateway/퀴즈.json',
  'data/부교재/수능특강Light/영어/3강/4번/워크북.json',
  'data/부교재/수능특강Light/영어/3강/Gateway/워크북.json',
  'data/부교재/수능특강Light/영어/4강/1번/워크북.json',
  'data/부교재/수능특강Light/영어/4강/1번/퀴즈.json',
  'data/부교재/수능특강Light/영어/4강/2번/워크북.json',
];

// First revert any previously partially-fixed files that might have issues
// by checking git status... Actually just run fresh on all files

let fixedCount = 0;
let noChangeCount = 0;

for (const f of files) {
  console.log(`\n${f}`);
  const result = processFile(f);
  if (result) fixedCount++;
  else noChangeCount++;
}

console.log(`\n=== DONE ===`);
console.log(`Fixed: ${fixedCount}`);
console.log(`No change: ${noChangeCount}`);
