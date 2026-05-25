#!/usr/bin/env node
/**
 * fix-dc-batch.js — DC-1, DC-2, DC-3, DC-6, DC-9 일괄 수정
 *
 * DC-1+DC-2: passage 마커를 텍스트 출현순으로 재배치 → det/ans/ch 업데이트
 * DC-3: 부적절어휘 정답이 원문과 동일 → 반의어로 교체
 * DC-6: 어순배열 stem 보기에 wa 단어 누락 → 추가
 * DC-9: 어법 오답 변형 → fullPassage 원문으로 복원
 */

const fs = require('fs');
const path = require('path');

const MARKERS = ['①', '②', '③', '④'];
const MARKER_SET = new Set(MARKERS);

// ===== DC-1+DC-2 FIX =====
function fixDC1DC2(q) {
  if (q.fmt !== 'mc' || !q.ch || !q.passage) return false;
  const isMarkerCh = q.ch.every(c => MARKER_SET.has(c));
  if (!isMarkerCh) return false;

  // Find all markers and their positions in passage
  const markerPositions = [];
  for (const m of MARKERS) {
    const idx = q.passage.indexOf(m);
    if (idx >= 0) {
      markerPositions.push({ marker: m, pos: idx });
    }
  }
  if (markerPositions.length < 3) return false;

  // Check if already in order
  let isOrdered = true;
  for (let i = 1; i < markerPositions.length; i++) {
    if (markerPositions[i].pos <= markerPositions[i - 1].pos) {
      isOrdered = false;
      break;
    }
  }

  if (!isOrdered) {
    // DC-2 present: reorder markers in passage
    const sorted = [...markerPositions].sort((a, b) => a.pos - b.pos);

    // Build mapping: old marker → new marker (based on text position)
    const oldToNew = {};
    for (let i = 0; i < sorted.length; i++) {
      oldToNew[sorted[i].marker] = MARKERS[i];
    }

    // Extract content (word under <u>) for each OLD marker from passage
    const oldMarkerWord = {};
    for (const m of MARKERS) {
      const regex = new RegExp(escapeRegex(m) + '<u>([^<]*)</u>');
      const match = q.passage.match(regex);
      if (match) {
        oldMarkerWord[m] = match[1].trim();
      }
    }

    // Replace markers in passage using placeholders
    let newPassage = q.passage;
    const placeholders = {};
    for (const oldM of MARKERS) {
      if (oldToNew[oldM] && oldToNew[oldM] !== oldM) {
        const ph = `__PH${MARKERS.indexOf(oldM)}__`;
        placeholders[ph] = oldToNew[oldM];
        newPassage = newPassage.replace(oldM, ph);
      }
    }
    for (const [ph, newM] of Object.entries(placeholders)) {
      newPassage = newPassage.replace(ph, newM);
    }
    q.passage = newPassage;

    // Build NEW marker → word mapping (after reorder)
    // newMarkerWord[①] = word that is now under ① in new passage
    const newMarkerWord = {};
    for (const oldM of MARKERS) {
      if (oldToNew[oldM] && oldMarkerWord[oldM]) {
        newMarkerWord[oldToNew[oldM]] = oldMarkerWord[oldM];
      }
    }

    // Fix det.analysis: parse segments, match to NEW passage by content word
    if (q.det && q.det.analysis) {
      const analysis = q.det.analysis;

      // Parse det.analysis into segments
      const segments = [];
      const segRegex = /([①②③④⑤])([^①②③④⑤]*)/g;
      let segMatch;
      while ((segMatch = segRegex.exec(analysis)) !== null) {
        const detMarker = segMatch[1];
        const content = segMatch[2].trim();
        const isCorrect = content.includes('←') && content.includes('정답');

        // Extract the first word from the segment content (e.g., "training:" → "training")
        const wordMatch = content.match(/^([a-zA-Z\s\-']+?)[\s:]/);
        const detWord = wordMatch ? wordMatch[1].trim() : null;

        segments.push({
          detMarker,
          detWord,
          content,
          isCorrect,
          assignedNewMarker: null
        });
      }

      // For each segment, find which NEW passage marker has matching content
      // newMarkerWord = { ①: 'trained', ②: 'traveled', ③: 'studied', ④: 'was buried' }
      const usedNewMarkers = new Set();
      for (const seg of segments) {
        if (!seg.detWord) continue;
        // Try exact match first
        for (const [nm, nw] of Object.entries(newMarkerWord)) {
          if (usedNewMarkers.has(nm)) continue;
          if (nw && nw.toLowerCase() === seg.detWord.toLowerCase()) {
            seg.assignedNewMarker = nm;
            usedNewMarkers.add(nm);
            break;
          }
        }
        // Try partial match (e.g., "training" ~ "trained")
        if (!seg.assignedNewMarker) {
          for (const [nm, nw] of Object.entries(newMarkerWord)) {
            if (usedNewMarkers.has(nm)) continue;
            if (nw && (nw.toLowerCase().startsWith(seg.detWord.toLowerCase().substring(0,4)) ||
                       seg.detWord.toLowerCase().startsWith(nw.toLowerCase().substring(0,4)))) {
              seg.assignedNewMarker = nm;
              usedNewMarkers.add(nm);
              break;
            }
          }
        }
      }

      // Assign remaining markers to unmatched segments
      for (const seg of segments) {
        if (!seg.assignedNewMarker) {
          for (const m of MARKERS) {
            if (!usedNewMarkers.has(m)) {
              seg.assignedNewMarker = m;
              usedNewMarkers.add(m);
              break;
            }
          }
        }
      }

      // Sort segments by assigned new marker order
      segments.sort((a, b) => MARKERS.indexOf(a.assignedNewMarker) - MARKERS.indexOf(b.assignedNewMarker));

      // Rebuild analysis
      const newAnalysis = segments.map(seg => {
        const m = seg.assignedNewMarker || seg.detMarker;
        return m + seg.content;
      }).join(' ');
      q.det.analysis = newAnalysis;

      // Set ans based on ←정답
      const correctSeg = segments.find(s => s.isCorrect);
      if (correctSeg && correctSeg.assignedNewMarker) {
        const newAns = MARKERS.indexOf(correctSeg.assignedNewMarker) + 1;
        if (newAns > 0) q.ans = newAns;
      }
    }

    // Also fix det.korean if it starts with a marker
    if (q.det && q.det.korean) {
      for (const oldM of MARKERS) {
        if (q.det.korean.startsWith(oldM) && oldToNew[oldM]) {
          q.det.korean = q.det.korean.replace(oldM, oldToNew[oldM]);
          break;
        }
      }
    }

    return true;
  } else {
    // DC-1 only (no DC-2): just fix ans from det.analysis
    if (q.det && q.det.analysis) {
      const analysis = q.det.analysis;
      const correctMatch = analysis.match(/([①②③④⑤])[^①②③④⑤]*←\s*정답/);
      if (correctMatch) {
        const ansMarker = correctMatch[1];
        const newAns = MARKERS.indexOf(ansMarker) + 1;
        if (newAns > 0 && newAns !== q.ans) {
          q.ans = newAns;
          return true;
        }
      }
    }
    return false;
  }
}

// ===== DC-3 FIX =====
// Antonym/inappropriate word replacements
const ANTONYMS = {
  'concern': 'indifference',
  'negative': 'positive',
  'adding': 'removing',
  'smooth': 'rough',
  'activate': 'deactivate',
  'accumulate': 'disperse',
  'prolonged': 'brief',
  '1919': null, // special case - number, needs manual
  'lensing': null, // special term, needs context
};

function fixDC3(q, fullPassage) {
  if (q.type !== '문맥상 부적절한 어휘') return false;
  if (!q.passage || !fullPassage) return false;

  const isMarkerCh = q.ch && q.ch.every(c => MARKER_SET.has(c));

  // Find the answer marker and word
  let ansMarker, ansWord;
  if (isMarkerCh) {
    ansMarker = MARKERS[q.ans - 1];
    const regex = new RegExp(escapeRegex(ansMarker) + '<u>([^<]+)</u>');
    const match = q.passage.match(regex);
    if (match) ansWord = match[1].trim();
  } else {
    ansWord = q.ch && q.ch[q.ans - 1];
    if (ansWord) ansWord = ansWord.replace(/^[①②③④⑤]\s*/, '').trim();
  }

  if (!ansWord) return false;

  // Check if the answer word exists in fullPassage in the same context
  const passClean = q.passage.replace(/<[^>]+>/g, '').replace(/[①②③④⑤]/g, '');
  const fpClean = fullPassage.replace(/[①②③④⑤]/g, '');

  // Check context match
  const wordEsc = escapeRegex(ansWord);
  const ctxRegex = new RegExp('(\\S+\\s+\\S+\\s+)' + wordEsc + '(\\s+\\S+\\s+\\S+)', 'i');
  const passCtx = passClean.match(ctxRegex);

  if (!passCtx) return false;

  const contextPhrase = passCtx[1] + ansWord + passCtx[2];
  const ctxPhraseClean = contextPhrase.replace(/\s+/g, ' ').trim();
  const fpNorm = fpClean.replace(/\s+/g, ' ');

  if (!fpNorm.includes(ctxPhraseClean)) return false;

  // The answer word is same as original — need to find what the original is and replace with antonym
  // First, find the original word from fullPassage at this position
  const originalWord = ansWord; // it IS the original since context matches

  // Find a suitable replacement (antonym/inappropriate word)
  let replacement = findAntonym(originalWord, fullPassage);
  if (!replacement) {
    console.log(`  [SKIP DC-3] Q${q.id}: Cannot find antonym for "${originalWord}" — needs manual fix`);
    return false;
  }

  // Replace in passage
  if (isMarkerCh) {
    const oldPattern = ansMarker + '<u>' + ansWord + '</u>';
    const newPattern = ansMarker + '<u>' + replacement + '</u>';
    q.passage = q.passage.replace(oldPattern, newPattern);
  }

  // Update det.analysis - rebuild the answer line
  if (q.det && q.det.analysis) {
    const analysis = q.det.analysis;
    // Find the answer marker line and replace
    const ansM = isMarkerCh ? MARKERS[q.ans - 1] : '';
    if (ansM) {
      // Pattern: ②ansWord: explanation ←정답
      // Replace with: ②replacement: replacement는 ... 부적절. originalWord가 적절 ←정답
      const lineRegex = new RegExp(
        escapeRegex(ansM) + escapeRegex(ansWord) + ':[^←]*←\\s*정답'
      );
      const lineMatch = analysis.match(lineRegex);
      if (lineMatch) {
        const newLine = `${ansM}${replacement}: ${replacement}는 문맥상 부적절. ${originalWord}(원문)가 적절 ←정답`;
        q.det.analysis = analysis.replace(lineMatch[0], newLine);
      } else {
        // Fallback: just replace the word
        q.det.analysis = analysis.replace(
          new RegExp(escapeRegex(ansWord), 'g'),
          replacement
        );
      }
    }
  }

  // Update det.tip if present
  if (q.det && q.det.tip) {
    q.det.tip = `${originalWord}(원문) ↔ ${replacement}(부적절)`;
  }

  return true;
}

function findAntonym(word, fullPassage) {
  const w = word.toLowerCase();

  // Comprehensive antonym/inappropriate word map
  const map = {
    'concern': 'indifference',
    'negative': 'constructive',
    'adding': 'subtracting',
    'smooth': 'turbulent',
    'activate': 'suppress',
    'accumulate': 'dissipate',
    'prolonged': 'fleeting',
    'lensing': 'distorting',
    '1919': '1950',
    'brightly': 'dimly',
    'suddenly': 'gradually',
    // Common words
    'improve': 'worsen',
    'improved': 'worsened',
    'increase': 'decrease',
    'increased': 'decreased',
    'positive': 'detrimental',
    'success': 'failure',
    'successful': 'unsuccessful',
    'benefit': 'harm',
    'beneficial': 'harmful',
    'important': 'trivial',
    'significant': 'negligible',
    'significantly': 'marginally',
    'enhance': 'diminish',
    'enhanced': 'diminished',
    'support': 'undermine',
    'encourage': 'discourage',
    'progress': 'regression',
    'growth': 'decline',
    'strong': 'weak',
    'strengthen': 'weaken',
    'accept': 'reject',
    'gain': 'lose',
    'expand': 'contract',
    'develop': 'stagnate',
    'confidence': 'doubt',
    'stable': 'volatile',
    'protect': 'expose',
    'maintain': 'abandon',
    'effective': 'futile',
    'advantage': 'drawback',
    'contribute': 'detract',
    'promote': 'hinder',
    'valuable': 'worthless',
    'essential': 'superfluous',
    'reduce': 'amplify',
    'connect': 'isolate',
    'unite': 'divide',
    'create': 'destroy',
    'build': 'demolish',
    'achieve': 'forfeit',
    'further': 'barely',
    'carefully': 'carelessly',
    'quickly': 'slowly',
    'peacefully': 'restlessly',
    'comfortable': 'distressed',
    'exceptional': 'mediocre',
    'continued': 'discontinued',
    'dedicated': 'indifferent',
    'confident': 'uncertain',
    'steady': 'erratic',
    'natural': 'artificial',
    'certain': 'uncertain',
    'easily': 'hardly',
    'clearly': 'vaguely',
    'properly': 'improperly',
    'directly': 'indirectly',
    'primarily': 'marginally',
    'consistently': 'sporadically',
    'effectively': 'poorly',
    'precisely': 'roughly',
    'deeply': 'superficially',
    'freely': 'restrictedly',
    'widely': 'narrowly',
    'rapidly': 'sluggishly',
    'largely': 'minimally',
    'firmly': 'loosely',
    'actively': 'passively',
    'fairly': 'unfairly',
    'properly': 'poorly',
    'independent': 'dependent',
    'sufficient': 'insufficient',
    'relevant': 'irrelevant',
    'appropriate': 'inappropriate',
    'various': 'uniform',
    'complex': 'simple',
    'diverse': 'homogeneous',
    'flexible': 'rigid',
    'reliable': 'unreliable',
    'accurate': 'inaccurate',
    'efficient': 'wasteful',
  };

  let replacement = map[w];
  if (!replacement) return null;

  // Make sure replacement isn't already in fullPassage
  if (fullPassage.toLowerCase().includes(replacement.toLowerCase())) {
    // Try alternate
    const alternates = {
      'concern': ['apathy', 'disregard', 'complacency'],
      'negative': ['constructive', 'favorable', 'advantageous'],
      'adding': ['subtracting', 'eliminating', 'deducting'],
      'smooth': ['turbulent', 'chaotic', 'erratic'],
      'activate': ['suppress', 'inhibit', 'neutralize'],
      'accumulate': ['dissipate', 'scatter', 'deplete'],
      'prolonged': ['fleeting', 'momentary', 'transient'],
      'positive': ['detrimental', 'adverse', 'unfavorable'],
    };

    const alts = alternates[w] || [];
    for (const alt of alts) {
      if (!fullPassage.toLowerCase().includes(alt.toLowerCase())) {
        return alt;
      }
    }
    return null;
  }

  return replacement;
}

// ===== DC-6 FIX =====
function fixDC6(q) {
  if (q.type !== '어순배열' || !q.wa || !q.stem) return false;

  const bracketMatch = q.stem.match(/\[([^\]]+)\]/);
  if (!bracketMatch) return false;

  const bracketContent = bracketMatch[1].trim();
  if (bracketContent === '보기' || bracketContent === '조건') return false;

  // Extract words from wa
  const waWords = q.wa.split(/\s+/).filter(w => w.length > 0);

  // Extract words from bracket
  const stemWords = bracketContent.split(/[,\s/]+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);

  // Find missing words
  const missing = waWords.filter(w => !stemWords.includes(w.toLowerCase()));

  if (missing.length === 0) return false;

  // Add missing words to bracket content
  const newBracketContent = bracketContent + ', ' + missing.join(', ');
  q.stem = q.stem.replace('[' + bracketContent + ']', '[' + newBracketContent + ']');

  return true;
}

// ===== DC-9 FIX =====
function fixDC9(q, fullPassage) {
  if (q.type !== '어법' || !q.passage || !fullPassage) return false;

  // Find non-answer markers with words not in fullPassage
  let fixed = false;
  for (let i = 0; i < MARKERS.length; i++) {
    if (i + 1 === q.ans) continue; // skip answer marker

    const m = MARKERS[i];
    const regex = new RegExp(escapeRegex(m) + '<u>([^<]+)</u>');
    const match = q.passage.match(regex);
    if (!match) continue;

    const word = match[1].trim();
    if (fullPassage.includes(word)) continue; // word exists in fullPassage, OK

    // Word not in fullPassage — find original word
    // Look at overlay.markers if available
    let originalWord = null;
    if (q.overlay && q.overlay.markers && q.overlay.markers[m]) {
      const ov = q.overlay.markers[m];
      if (typeof ov === 'string') {
        originalWord = ov;
      } else if (typeof ov === 'object' && ov.find) {
        originalWord = ov.find;
      }
    }

    if (!originalWord) {
      // Try to find original by context matching
      // Get surrounding words from passage
      const passClean = q.passage.replace(/<[^>]+>/g, '').replace(/[①②③④⑤]/g, '');
      const wordPos = passClean.indexOf(word);
      if (wordPos < 0) continue;

      // Get context around the word
      const before = passClean.substring(Math.max(0, wordPos - 40), wordPos).trim();
      const after = passClean.substring(wordPos + word.length, wordPos + word.length + 40).trim();

      // Find what's in fullPassage at similar context
      const beforeWords = before.split(/\s+/).slice(-2).join('\\s+');
      const afterWords = after.split(/\s+/).slice(0, 2).join('\\s+');

      if (beforeWords && afterWords) {
        const ctxRegex = new RegExp(beforeWords + '\\s+(\\S+)\\s+' + afterWords, 'i');
        const fpMatch = fullPassage.match(ctxRegex);
        if (fpMatch) {
          originalWord = fpMatch[1];
        }
      }
    }

    if (originalWord && originalWord !== word) {
      // Replace the incorrect word with original
      const oldPattern = m + '<u>' + word + '</u>';
      const newPattern = m + '<u>' + originalWord + '</u>';
      q.passage = q.passage.replace(oldPattern, newPattern);

      // Update det.analysis if it mentions the old word
      if (q.det && q.det.analysis) {
        q.det.analysis = q.det.analysis.replace(
          new RegExp(escapeRegex(word), 'g'),
          originalWord
        );
      }

      // Update overlay
      if (q.overlay && q.overlay.markers && q.overlay.markers[m]) {
        if (typeof q.overlay.markers[m] === 'string') {
          q.overlay.markers[m] = originalWord;
        }
      }

      fixed = true;
      console.log(`  [DC-9 FIX] Q${q.id}: marker ${m} "${word}" → "${originalWord}"`);
    }
  }
  return fixed;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===== MAIN =====
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node fix-dc-batch.js <file.json>');
  process.exit(1);
}

const absPath = path.resolve(filePath);
let data;
try {
  data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
} catch (e) {
  console.error(`Failed to read ${absPath}: ${e.message}`);
  process.exit(1);
}

if (!data.questions || !data.fullPassage) {
  console.log('No questions or fullPassage — skipping');
  process.exit(0);
}

let totalFixes = 0;

for (const q of data.questions) {
  // DC-1+DC-2 first (reorders markers)
  if (fixDC1DC2(q)) {
    console.log(`  [DC-1/2 FIX] Q${q.id}: markers reordered, ans=${q.ans}`);
    totalFixes++;
  }

  // DC-3
  if (fixDC3(q, data.fullPassage)) {
    console.log(`  [DC-3 FIX] Q${q.id}: antonym replaced`);
    totalFixes++;
  }

  // DC-6
  if (fixDC6(q)) {
    console.log(`  [DC-6 FIX] Q${q.id}: missing words added to stem`);
    totalFixes++;
  }

  // DC-9
  if (fixDC9(q, data.fullPassage)) {
    totalFixes++;
  }
}

if (totalFixes > 0) {
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`  → ${totalFixes} fixes applied, file saved`);
} else {
  console.log('  → No fixes needed');
}
