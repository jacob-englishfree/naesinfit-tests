#!/usr/bin/env node
/**
 * fix-v62-blank.js
 *
 * V62: "빈칸에 들어갈" stem인데 passage에 ____ 없음 → 자동 수정
 *
 * 전략:
 * 1. ansWord (ch[ans-1])가 passage에 있으면 → <u>ansWord</u> 또는 ansWord 를 ____ 로 교체
 * 2. wa가 passage에 있으면 → wa 를 ____ 로 교체
 * 3. 어순배열: wa 단어들과 가장 겹치는 문장 찾아서 ____ 로 교체
 * 4. overlayBlank가 passage에 있으면 → overlayBlank 를 ____ 로 교체
 * 5. 위 모두 실패하면 SKIP (수동 검토 필요)
 *
 * Usage: node validate/fix-v62-blank.js
 */

const fs = require('fs');
const path = require('path');

const V62_FILES = JSON.parse(fs.readFileSync('/tmp/v62-files.json', 'utf8'));

// V62 trigger condition (same as validate.js)
function hasV62Stem(stem) {
  return stem.includes('위 글의 빈칸') ||
    stem.includes('위 빈칸') ||
    stem.includes('빈칸에 들어갈') ||
    stem.includes('빈 칸에 들어갈');
}
function isFindType(stem) {
  return stem.includes('찾아 쓰시오') || stem.includes('찾아쓰시오') || stem.includes('본문에서 찾아');
}
function hasBlank(passage) {
  return passage.includes('____') || passage.includes('_____');
}

/**
 * Find the sentence in passage that best matches wa words.
 * Returns { text, start, end } or null.
 */
function findBestSentence(passage, wa) {
  const sentenceRe = /[^\n.!?]*[.!?\n]+/g;
  const sentences = [];
  let m;
  while ((m = sentenceRe.exec(passage)) !== null) {
    sentences.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }

  const waWords = wa.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  let best = null, bestScore = 0;

  for (const s of sentences) {
    const sLower = s.text.toLowerCase();
    let score = 0;
    for (const w of waWords) {
      if (sLower.includes(w)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  // Require at least 60% word overlap
  if (best && waWords.length > 0 && bestScore / waWords.length >= 0.6) {
    return best;
  }
  return null;
}

let fixed = 0;
let skipped = 0;
const skipLog = [];

for (const relPath of V62_FILES) {
  const absPath = path.resolve(relPath);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (e) {
    console.error('PARSE ERROR:', relPath, e.message);
    continue;
  }

  let fileChanged = false;

  for (const q of (data.questions || [])) {
    const stem = q.stem || '';
    const passage = q.passage || '';

    // Only fix if V62 condition is met
    if (!hasV62Stem(stem)) continue;
    if (passage.trim().length <= 10) continue;
    if (hasBlank(passage)) continue;
    if (isFindType(stem)) continue;

    const ansWord = q.ch ? q.ch[(q.ans || 1) - 1] : null;
    const wa = q.wa || null;
    const overlayBlank = q.overlay ? q.overlay.blank : null;

    let newPassage = null;
    let strategy = null;

    // Strategy 1: ansWord with <u> tags
    if (!newPassage && ansWord) {
      const tagged = '<u>' + ansWord + '</u>';
      if (passage.includes(tagged)) {
        newPassage = passage.replace(tagged, '____');
        strategy = 'REPLACE_U_TAG';
      }
    }

    // Strategy 2: ansWord plain (exact)
    if (!newPassage && ansWord && passage.includes(ansWord)) {
      // Replace FIRST occurrence only
      const idx = passage.indexOf(ansWord);
      newPassage = passage.substring(0, idx) + '____' + passage.substring(idx + ansWord.length);
      strategy = 'REPLACE_ANSWORD';
    }

    // Strategy 3: wa plain (exact)
    if (!newPassage && wa && typeof wa === 'string' && passage.includes(wa)) {
      const idx = passage.indexOf(wa);
      newPassage = passage.substring(0, idx) + '____' + passage.substring(idx + wa.length);
      strategy = 'REPLACE_WA';
    }

    // Strategy 4: 어순배열 / 서술형 — find best matching sentence
    if (!newPassage && wa && typeof wa === 'string' && ['어순배열', '서술형', '서술형 — 영작', '서술형 — 조건영작', '서술형 — 배열영작'].includes(q.type)) {
      const best = findBestSentence(passage, wa);
      if (best) {
        newPassage = passage.substring(0, best.start) + '____' + passage.substring(best.end);
        strategy = 'REPLACE_SENTENCE';
      }
    }

    // Strategy 5: overlayBlank
    if (!newPassage && overlayBlank && passage.includes(overlayBlank)) {
      const idx = passage.indexOf(overlayBlank);
      newPassage = passage.substring(0, idx) + '____' + passage.substring(idx + overlayBlank.length);
      strategy = 'REPLACE_OVERLAY';
    }

    // Strategy 6: ansWord case-insensitive
    if (!newPassage && ansWord) {
      const lower = ansWord.toLowerCase();
      const pLower = passage.toLowerCase();
      const idx = pLower.indexOf(lower);
      if (idx >= 0) {
        newPassage = passage.substring(0, idx) + '____' + passage.substring(idx + ansWord.length);
        strategy = 'REPLACE_ANSWORD_CI';
      }
    }

    // Strategy 7: wa case-insensitive
    if (!newPassage && wa && typeof wa === 'string') {
      const lower = wa.toLowerCase();
      const pLower = passage.toLowerCase();
      const idx = pLower.indexOf(lower);
      if (idx >= 0) {
        newPassage = passage.substring(0, idx) + '____' + passage.substring(idx + wa.length);
        strategy = 'REPLACE_WA_CI';
      }
    }

    // Strategy 8: <u>tagged word that is a variant of a ch word (for 어법 fill-in-blank)
    // When ansWord is NOT in passage but there's a <u>word</u> that shares root with one of ch words
    if (!newPassage && q.ch && q.ch.length > 0) {
      const uTagRe = /<u>(.*?)<\/u>/g;
      const tagged = [];
      let tm;
      while ((tm = uTagRe.exec(passage)) !== null) {
        tagged.push({ full: tm[0], word: tm[1].trim(), start: tm.index });
      }

      if (tagged.length > 0) {
        // Find the best matching tagged word
        let bestTag = null;

        // Priority 1: tagged word exactly matches one of ch (different forms)
        for (const t of tagged) {
          const tw = t.word.toLowerCase().replace(/[^a-z]/g, '');
          if (q.ch.some(c => c.toLowerCase().replace(/[^a-z]/g, '') === tw)) {
            bestTag = t;
            break;
          }
        }

        // Priority 2: tagged word shares root with one of ch
        if (!bestTag) {
          function getWordRoot(word) {
            return word.toLowerCase()
              .replace(/^(to |with |in |for |as well as\.?)\s*/i, '')
              .replace(/(ing|tion|ance|ence|ment|ion|ed|es|er|al|ly|ize|ise|ful|ness|able|ible)$/, '');
          }
          for (const t of tagged) {
            const tRoot = getWordRoot(t.word);
            if (tRoot.length < 3) continue;
            for (const c of q.ch) {
              const cRoot = getWordRoot(c);
              if (cRoot.length >= 3 && (tRoot.startsWith(cRoot) || cRoot.startsWith(tRoot))) {
                bestTag = t;
                break;
              }
            }
            if (bestTag) break;
          }
        }

        // Priority 3: garbled tags like ③<u>④<u>word</u>rest</u> — fix nested/broken tags
        if (!bestTag) {
          // Look for garbled nested marker tags
          const garbledRe = /[①②③④⑤]<u>[①②③④⑤]<u>(.*?)<\/u>(.*?)<\/u>/g;
          let gm;
          while ((gm = garbledRe.exec(passage)) !== null) {
            tagged.push({ full: gm[0], word: gm[1] + gm[2], start: gm.index, garbled: true });
            if (!bestTag) bestTag = tagged[tagged.length - 1];
          }
        }

        if (bestTag) {
          newPassage = passage.substring(0, bestTag.start) + '____' + passage.substring(bestTag.start + bestTag.full.length);
          strategy = 'REPLACE_U_VARIANT';
        }
      }
    }

    if (newPassage) {
      q.passage = newPassage;
      fileChanged = true;
      fixed++;
      console.log(`FIXED [${strategy}] ${relPath} Q${q.id} (${q.type})`);
    } else {
      skipped++;
      skipLog.push({ f: relPath, qid: q.id, type: q.type, ansWord, wa, overlayBlank });
    }
  }

  if (fileChanged) {
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2), 'utf8');
  }
}

console.log('');
console.log('=== 결과 ===');
console.log(`수정: ${fixed}건`);
console.log(`스킵: ${skipped}건`);

if (skipLog.length > 0) {
  console.log('\n=== 수동 검토 필요 ===');
  for (const s of skipLog) {
    console.log(`  ${s.f} Q${s.qid} [${s.type}] | ans: ${s.ansWord} | wa: ${s.wa} | OB: ${s.overlayBlank}`);
  }
}
