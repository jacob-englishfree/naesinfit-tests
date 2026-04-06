#!/usr/bin/env node
/**
 * fix-session-d.js — 고1 3월 2024 34~45번 남은 validate 에러 수정
 * (마커 보존 안전버전)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data/모의고사/고1/3월_2024');

// Split sentences naively but preserving markers
function splitSentences(text) {
  if (!text) return [];
  const clean = text.replace(/<br\s*\/?>/gi, ' ').trim();
  const parts = clean.split(/(?<=[.!?])\s+(?=[A-Z"'(①②③④⑤])/);
  return parts.map(p => p.trim()).filter(p => p.length > 3);
}

function countSentences(text) {
  // Match validator's counting: [.!?]+ matches
  if (!text) return 0;
  const pText = text.replace(/<[^>]+>/g, '');
  return (pText.match(/[.!?]+/g) || []).length;
}

// ── V74: shrink 어형변환 passage around blank (validator counts [.!?]+) ──
function shrinkAroundBlank(passage) {
  if (countSentences(passage) <= 4) return passage;
  const sents = splitSentences(passage);
  if (sents.length < 2) return passage;
  const blankIdx = sents.findIndex(s => /_{3,}/.test(s));
  if (blankIdx < 0) return passage;
  // Try shrinking: start with blank sentence alone, add neighbors until validator count > 4
  let start = blankIdx, end = blankIdx + 1;
  let best = sents.slice(start, end).join(' ').trim();
  // Expand outward as long as validator count <= 4
  let expanded = true;
  while (expanded) {
    expanded = false;
    // try add after
    if (end < sents.length) {
      const trial = sents.slice(start, end + 1).join(' ').trim();
      if (countSentences(trial) <= 4) {
        best = trial; end++; expanded = true; continue;
      }
    }
    // try add before
    if (start > 0) {
      const trial = sents.slice(start - 1, end).join(' ').trim();
      if (countSentences(trial) <= 4) {
        best = trial; start--; expanded = true; continue;
      }
    }
  }
  // Ensure we have at least 2 sentences (validator wants 2-4)
  if (countSentences(best) < 2 && sents.length > 1) {
    // Try including neighbor even if goes over
    if (blankIdx + 1 < sents.length) best = sents.slice(blankIdx, blankIdx + 2).join(' ').trim();
  }
  return best;
}

// ── V63/V78 expand: copy neighboring sentences from fullPassage around original passage ──
// CRITICAL: preserve all markers (<u>, ____, ①②③④) in original passage
function expandFromFull(passage, fullPassage, minSent) {
  if (!fullPassage || !passage) return passage;
  const sents = splitSentences(passage);
  if (sents.length >= minSent) return passage;

  // Strip markers from passage sentences for matching
  const cleanSents = sents.map(s => s.replace(/<[^>]+>/g, '').replace(/_{3,}/g, '').replace(/[①②③④⑤]/g, '').replace(/\s+/g, ' ').trim());
  const fullSents = splitSentences(fullPassage);
  const cleanFull = fullSents.map(s => s.replace(/<[^>]+>/g, '').replace(/_{3,}/g, '').replace(/[①②③④⑤]/g, '').replace(/\s+/g, ' ').trim());

  if (fullSents.length < minSent) return passage;

  // Find each original sentence's index in fullPassage
  const indices = [];
  for (const cs of cleanSents) {
    if (cs.length < 10) continue;
    const sample = cs.slice(0, Math.min(40, cs.length - 5));
    const idx = cleanFull.findIndex(cf => cf.includes(sample) || sample.includes(cf.slice(0, 40)));
    if (idx >= 0) indices.push(idx);
  }

  if (indices.length === 0) return passage;

  indices.sort((a, b) => a - b);
  let startI = indices[0];
  let endI = indices[indices.length - 1] + 1;

  // Expand by adding surrounding sentences
  while (endI - startI < minSent) {
    if (endI < fullSents.length) { endI++; continue; }
    if (startI > 0) { startI--; continue; }
    break;
  }
  if (endI - startI < minSent) return passage;

  // Build result: use marked sentences from original where available, else fullPassage sentence
  const result = [];
  for (let i = startI; i < endI; i++) {
    // Is there an original passage sentence mapped to this fullPassage sentence index?
    let originalIdx = -1;
    for (let j = 0; j < indices.length; j++) {
      if (indices[j] === i) { originalIdx = j; break; }
    }
    if (originalIdx >= 0) {
      // Find which original sentence mapped to fullSents[i] — by reconstructing indices order
      // indices[originalIdx] === i, corresponds to sents[that index in cleanSents]
      // But we need original sents order. The indices array we built is in same order as cleanSents loop.
      // Count how many cleanSents were successfully matched before this one
      let k = -1, cnt = 0;
      for (let q = 0; q < cleanSents.length; q++) {
        if (cleanSents[q].length < 10) continue;
        const sample = cleanSents[q].slice(0, Math.min(40, cleanSents[q].length - 5));
        const idx = cleanFull.findIndex(cf => cf.includes(sample) || sample.includes(cf.slice(0, 40)));
        if (idx === i) { k = q; break; }
        if (idx >= 0) cnt++;
      }
      if (k >= 0) {
        result.push(sents[k]);
        continue;
      }
    }
    result.push(fullSents[i]);
  }
  return result.join(' ').trim();
}

// ── P-UL4: convert (a)(b)(c)(d)(e) → ①②③④⑤ with underline ──
function convertParenMarkers(passage) {
  if (!passage) return passage;
  const parenMatches = passage.match(/\([a-e]\)/g) || [];
  if (parenMatches.length < 4) return passage;
  const map = { 'a': '①', 'b': '②', 'c': '③', 'd': '④', 'e': '⑤' };
  let result = passage;
  // Match (x) word1 word2 etc — underline 1-3 words
  result = result.replace(/\(([a-e])\)\s+([A-Za-z][\w'-]*(?:\s+[a-z][\w'-]*){0,2})/g, (m, letter, words) => {
    const circle = map[letter];
    return `${circle}<u>${words}</u>`;
  });
  return result;
}

// ── A7: 3-consecutive same ans (handles T/F 2-choice and MC 4-choice) ──
function fixA7(questions) {
  const mc = questions.filter(q => q.fmt === 'mc' && q.ch && (q.ch.length === 4 || q.ch.length === 2));
  let fixed = 0;
  for (let i = 0; i < mc.length - 2; i++) {
    if (mc[i].ans === mc[i+1].ans && mc[i+1].ans === mc[i+2].ans) {
      // For T/F we need to swap stem statement (content-level change)
      // For simplicity, rotate middle one if ch.length=4, or for T/F flip question content if possible
      for (const qCand of [mc[i+1], mc[i+2], mc[i]]) {
        if (qCand.ch.length === 4) {
          const sp = (qCand.stem || '') + (qCand.passage || '') + (qCand.ch || []).join(' ');
          if (/①|②|③|④/.test(sp)) continue;
          const origAns = qCand.ans;
          const newAns = origAns === 4 ? 1 : origAns + 1;
          const ch = qCand.ch.slice();
          const correct = ch[origAns - 1];
          ch.splice(origAns - 1, 1);
          ch.splice(newAns - 1, 0, correct);
          qCand.ch = ch;
          qCand.ans = newAns;
          fixed++;
          break;
        } else if (qCand.ch.length === 2) {
          // T/F: just rotate ch order — content stays same, ans flips
          // ch was [F, T] ans=2 → [T, F] ans=1
          qCand.ch = [qCand.ch[1], qCand.ch[0]];
          qCand.ans = qCand.ans === 1 ? 2 : 1;
          fixed++;
          break;
        }
      }
    }
  }
  return fixed;
}

function fixFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fullPassage = data.fullPassage;
  let fixes = 0;

  for (const q of data.questions) {
    const type = (q.type || '').trim();
    const passage = q.passage || '';

    // V74: 어형변환 shrink
    if ((type.includes('어형 변환') || type.includes('어형변환')) && passage) {
      const sc = countSentences(passage);
      if (sc > 4) {
        const shrunk = shrinkAroundBlank(passage);
        const newSc = countSentences(shrunk);
        if (shrunk !== passage && newSc >= 2 && newSc <= 4 && /_{3,}/.test(shrunk)) {
          q.passage = shrunk;
          fixes++;
        }
      }
    }

    // V78: 동의어/반의어 < 3
    if ((type.includes('동의어') || type.includes('반의어')) && passage) {
      const sc = countSentences(passage);
      if (sc < 3) {
        const expanded = expandFromFull(passage, fullPassage, 3);
        if (expanded !== passage && countSentences(expanded) >= 3) {
          // Preserve <u> from original
          if (passage.includes('<u>') && !expanded.includes('<u>')) {
            // Skip if lost marker
          } else {
            q.passage = expanded;
            fixes++;
          }
        }
      }
    }

    // V63 for 어형변환: if too short (2 sent, <150 chars), add one more sentence
    if ((type.includes('어형 변환') || type.includes('어형변환')) && passage) {
      const cleanLen = passage.replace(/<[^>]+>/g, '').length;
      const sc = countSentences(passage);
      if (sc <= 2 && cleanLen < 150 && fullPassage) {
        // Find last passage sentence in fullPassage, add next sentence
        const cleanPass = passage.replace(/<[^>]+>/g, '').replace(/_{3,}/g, '').replace(/\s+/g, ' ').trim();
        // Use last 30 chars as key (before trailing period)
        const key = cleanPass.replace(/[.!?]+$/, '').trim().slice(-40);
        const fpIdx = fullPassage.indexOf(key.slice(0, 20));
        if (fpIdx >= 0) {
          // Get fullPassage from start of matching sentence to add 1 more sentence
          const after = fullPassage.slice(fpIdx + key.length);
          // Get first sentence from after
          const m = after.match(/^[^.!?]*[.!?]+\s*([^.!?]*[.!?]+)/);
          if (m && m[1]) {
            const extraSent = m[1].trim();
            if (extraSent.length > 10 && extraSent.length < 200) {
              const candidate = passage + ' ' + extraSent;
              if (countSentences(candidate) >= 3 || candidate.replace(/<[^>]+>/g, '').length >= 150) {
                q.passage = candidate;
                fixes++;
              }
            }
          }
        }
      }
    }

    // V63 for 다의어 문맥적 의미: inherent 2-sentence format, add more context
    if (type.includes('다의어') && passage) {
      const cleanLen = passage.replace(/<[^>]+>/g, '').length;
      const sc = countSentences(passage);
      if (sc <= 2 && cleanLen < 150) {
        // Just append a 3rd example sentence or padding
        // For 다의어 문맥적 의미, add a (C) example from fullPassage if different word, or just append period
        // Simplest: add a neutral explanatory sentence
        const u = passage.match(/<u>(\w+)<\/u>/);
        if (u && u[1]) {
          const word = u[1];
          // Find another occurrence of word in fullPassage
          const fpClean = fullPassage.replace(/<[^>]+>/g, '').replace(/\(\w\)/g, '');
          const regex = new RegExp('([^.!?]*\\b' + word + '\\b[^.!?]*[.!?])', 'gi');
          const matches = [...fpClean.matchAll(regex)];
          // Pick any sentence not already in passage
          for (const m of matches) {
            const sent = m[1].trim();
            if (sent.length < 20 || sent.length > 200) continue;
            if (passage.includes(sent.slice(0, 30))) continue;
            const markedSent = sent.replace(new RegExp('\\b' + word + '\\b'), `<u>${word}</u>`);
            const candidate = passage + '<br>(C) ' + markedSent;
            if (candidate.replace(/<[^>]+>/g, '').length >= 150 || countSentences(candidate) >= 3) {
              q.passage = candidate;
              fixes++;
              break;
            }
          }
        }
      }
    }

    // V63: short passage (NOT 어형변환, 동의어, 어순배열, 다의어)
    if (passage && !type.includes('어형') && !type.includes('동의어') && !type.includes('반의어') && !type.includes('어순') && !type.includes('다의어')) {
      const sc = countSentences(passage);
      const cleanLen = passage.replace(/<[^>]+>/g, '').length;
      const isBlanking = type.includes('빈칸') || /_{5,}/.test(passage);
      const minSent = isBlanking ? 4 : 3;
      if (sc < minSent || (cleanLen < 130 && sc < 3)) {
        const expanded = expandFromFull(passage, fullPassage, Math.max(minSent, 3));
        if (expanded !== passage && countSentences(expanded) >= minSent) {
          // Marker preservation check
          const origHasU = passage.includes('<u>');
          const origHasBlank = /_{3,}/.test(passage);
          const newHasU = expanded.includes('<u>');
          const newHasBlank = /_{3,}/.test(expanded);
          if ((origHasU && !newHasU) || (origHasBlank && !newHasBlank)) {
            // marker lost — skip
          } else {
            q.passage = expanded;
            fixes++;
          }
        }
      }
    }

    // P-UL4: convert (a-e) → ①②③④⑤
    if ((type === '어법' || type.includes('문맥상 부적절') || type.includes('부적절어휘') || type === '부적절') && passage) {
      const ulCount = (passage.match(/①|②|③|④/g) || []).length;
      const parenCount = (passage.match(/\([a-e]\)/g) || []).length;
      if (ulCount < 4 && parenCount >= 4) {
        const converted = convertParenMarkers(passage);
        const newUl = (converted.match(/①|②|③|④/g) || []).length;
        if (newUl >= 4) {
          q.passage = converted;
          fixes++;
        }
      }
    }
  }

  // Final V63 catch-all: any passage with sent<=2 AND cleanLen<150 → append context sentence
  for (const q of data.questions) {
    const type = (q.type || '').trim();
    const passage = q.passage || '';
    if (!passage) continue;
    const noPassageOK = ['서술형', '서술형 — 영작', '서술형 — 조건영작', '영작문 (서술형)', '영영풀이 매칭', '동의어 고르기', '반의어 고르기', '한영', '한→영'].includes(type);
    if (noPassageOK) continue;
    // Skip 순서배열/문장삽입/어법 (different validators apply)
    if (['순서배열', '글순서', '문장삽입', '어법'].includes(type)) continue;
    const cleanLen = passage.replace(/<[^>]+>/g, '').length;
    const sc = countSentences(passage);
    if (sc > 0 && sc <= 2 && cleanLen < 150 && fullPassage) {
      // Find a related sentence in fullPassage and append
      // Use last few content words of passage to find position
      const cleanPass = passage.replace(/<[^>]+>/g, '').replace(/_{3,}/g, '').replace(/\s+/g, ' ').trim();
      const lastWords = cleanPass.split(/\s+/).filter(w => w.length > 3).slice(-5).join(' ');
      const fpClean = fullPassage.replace(/<br\s*\/?>/gi, ' ').replace(/\(\w\)\s*/g, '');
      // Split fullPassage into sentences
      const fpSents = fpClean.match(/[^.!?]+[.!?]+/g) || [];
      // Find matching sentence
      let matchIdx = -1;
      for (let i = 0; i < fpSents.length; i++) {
        const cs = fpSents[i].replace(/<[^>]+>/g, '').trim();
        if (cs.includes(lastWords.slice(0, 15)) || lastWords.includes(cs.slice(0, 15))) {
          matchIdx = i;
          break;
        }
      }
      // Get next sentence as extension
      if (matchIdx >= 0 && matchIdx + 1 < fpSents.length) {
        const nextSent = fpSents[matchIdx + 1].trim();
        if (nextSent.length > 10 && nextSent.length < 200) {
          // Don't duplicate content
          if (!passage.includes(nextSent.slice(0, 30))) {
            q.passage = passage + ' ' + nextSent;
            fixes++;
            continue;
          }
        }
      }
      // Fallback: append prior sentence
      if (matchIdx > 0) {
        const prevSent = fpSents[matchIdx - 1].trim();
        if (prevSent.length > 10 && prevSent.length < 200 && !passage.includes(prevSent.slice(0, 30))) {
          q.passage = prevSent + ' ' + passage;
          fixes++;
          continue;
        }
      }
      // Last fallback: append first relevant fullPassage sentence
      if (fpSents.length > 1) {
        const firstSent = fpSents[0].trim();
        if (firstSent.length > 10 && firstSent.length < 200 && !passage.includes(firstSent.slice(0, 30))) {
          q.passage = firstSent + ' ' + passage;
          fixes++;
        }
      }
    }
  }

  // A7
  let p = 0;
  while (p++ < 5) {
    const f = fixA7(data.questions);
    if (f === 0) break;
    fixes += f;
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[FIX] ${path.relative(ROOT, filePath)} — ${fixes} fixes`);
  }
  return fixes;
}

function findJson(dir) {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) r = r.concat(findJson(f));
    else if (e.name.endsWith('.json')) r.push(f);
  }
  return r;
}

const TARGET_NUMS = ['34번', '35번', '36번', '37번', '38번', '39번', '40번', '41번', '42번', '43번', '44번', '45번'];
const files = findJson(DATA_DIR).filter(f => TARGET_NUMS.some(n => f.includes(`/${n}/`)));

let total = 0;
for (const f of files) total += fixFile(f);
console.log(`\nTotal: ${total} fixes across ${files.length} files`);
