#!/usr/bin/env node
/**
 * fix-p23-underline.js — P23 문맥상 부적절한 어휘 밑줄 4개 보완
 *
 * 부적절한 어휘 문항에서 passage에 <u> 태그가 4개 미만인 경우
 * det.analysis에서 마커→단어 매핑을 추출하여 누락된 마커+<u> 추가
 *
 * Strategy:
 *   A) det.analysis에서 ✅마커 → 원문 단어 추출 (이미 passage에 있는 단어에 마커+밑줄 추가)
 *   B) det.analysis에서 ❌마커 → wrongWord → origWord 추출 (passage의 origWord를 wrongWord로 교체+마커+밑줄)
 *
 * Usage:
 *   node validate/fix-p23-underline.js <file.json>
 *   node validate/fix-p23-underline.js --batch /tmp/p23-b3.json
 *   node validate/fix-p23-underline.js --dry-run --batch /tmp/p23-b3.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUJUK_TYPES = ['문맥상 부적절한 어휘', '부적절한 어휘'];
const MARKERS = ['①', '②', '③', '④'];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Clean word: strip Korean parentheticals, leading markers, explanatory text
// "rejects(거부하다)" → "rejects"
// "② enriched" → "enriched"
// "harder → easier" → "harder" (just take first word/phrase before →)
// "worst → best — ..." → "worst"
// "unskilled → skilled — ..." → "unskilled"
function cleanWord(w) {
  if (!w) return '';
  // Strip leading marker characters
  let s = w.replace(/^[①②③④⑤]\s+/, '').trim();
  // Take only the part before → or — (em-dash explanations)
  s = s.split(/\s*[→—]\s*/)[0].trim();
  // Strip Korean parentheticals
  s = s.replace(/\([\uAC00-\uD7AF\s]+\)/g, '').replace(/（[\uAC00-\uD7AF\s]+）/g, '').trim();
  // Strip trailing punctuation
  s = s.replace(/[.,;:!?]+$/, '').trim();
  return s;
}

/**
 * det.analysis 파싱:
 * Returns:
 *   markerWords: { '①': { word, isWrong, origWord } }
 *
 * Patterns handled:
 *   ✅① word: 한국어       → correct, word = "word", origWord = null
 *   ❌③ wrongWord → origWord: ... → wrong, word = wrongWord, origWord = origWord
 *   ❌② wrongWord(한국어) → origWord(한국어) → same
 *
 *   Also: inline format:
 *   ✅ ② ② enriched       → correct word = enriched
 *   ❌ ① ① cuts down on   → det implies this is the "wrong" one? No — if ❌ then it's the WRONG marker?
 *   Wait: ❌ in front of marker means THIS marker's word is WRONG (= answer)
 *         ✅ means this marker's word is CORRECT (distractor)
 *
 * Re-check 22강/단어 Q5:
 *   ❌ ① ① cuts down on  → ① has wrong word "cuts down on"?? But det says ✅① cuts down on: 원문 일치
 *   Contradiction. The inline format ❌/✅ refers to whether the QUESTION OPTION is the wrong one.
 *
 * Actually looking at example: det.analysis for Q4 in 23강/1번/퀴즈:
 *   ❌ ① ①   (just markers, no word)
 *   ❌③ accelerates → slows down: 원문은 'a bullet slows down'
 *   ✅① caught: 잡았다
 *
 * And for 22강/단어 Q5:
 *   ❌ ① ① cuts down on   (the ① ① format means: marker text = "cuts down on")
 *   ✅ ② ② enriched       (marker text = "enriched", but ✅ means ... wait)
 *   Then: ❌② enriched → deprived  means ② enriched is WRONG → original is deprived
 *   But ✅② enriched says ② is correct??
 *
 * I think the ✅/❌ in "✅ ② ② enriched" just lists what word is at ②, and the ✅/❌
 * means whether THAT OPTION is the answer.
 * Wait — ✅ = this IS the answer (wrong word = the one to find)
 *         ❌ = this is NOT the answer (correct word in context)
 *
 * Cross-check with Q4 in 23강/2번/퀴즈 (ans=3):
 *   ❌ ① ①  ❌ ② ②  ✅ ③ ③  ❌ ④ ④
 *   ❌③ approximate → accurate (③ is wrong)
 *
 * Hmm, but ✅③③ and ❌③approximate? Contradiction.
 *
 * Let me just focus on the explicit lines like:
 *   ❌③ wrongWord → origWord  OR  ✅③ word: meaning
 * And extract from there.
 *
 * Key insight from 22강/단어 Q5:
 *   The passage has ①cuts down on, ③rural, ④reduce underlined
 *   Missing ②
 *   ❌② enriched → deprived means ② should be the wrong word "enriched" (replacing "deprived")
 *   So in passage: find "deprived" → replace with "②<u>enriched</u>"
 */
function parseDetAnalysis(analysis) {
  const map = {};
  if (!analysis) return map;

  const lines = analysis.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();

    // Pattern B: ❌마커 wrongWord → origWord  (wrong word needs to replace origWord in passage)
    // e.g. "❌③ accelerates → slows down: 원문은..."
    // e.g. "❌② enriched → deprived"
    // e.g. "❌② rejects(거부하다) → accepts(수용하다)"
    // e.g. "❌①: ignores → depends on." (colon right after marker)
    // e.g. "❌③: growing → fading. 원문은..."
    const mB = trimmed.match(/^[❌✗×✅✓]\s*([①②③④])[:\s]+(\S[\S ]*?)\s*[→\-]+\s*(\S[\S ]*?)(?:\s*[:.]\s*|\s*$)/);
    if (mB) {
      const marker = mB[1];
      const wrongWord = cleanWord(mB[2].trim());
      // Skip if wrongWord is just a marker character (column-swap artifact)
      if (!MARKERS.includes(wrongWord)) {
        const origRaw = mB[3].trim();
        // Handle "원문은 X" in origWord
        const origWord = cleanWord(origRaw.split(/[:.]/)[0].trim());
        // Pattern B takes priority (explicit → format is most reliable)
        map[marker] = { word: wrongWord, isWrong: true, origWord };
      }
    }

    // Pattern B2: ❌/✅ 마커 word: 원문은 origWord  (colon+Korean pattern)
    // e.g. "❌ ③ cheerful: 원문은 serious"
    // e.g. "❌ ④ uniform(획일적인): 원문은 diverse(다양한)"
    // Also: ✅ ③ unbiased(편견 없는): 원문은 biased(편향된) — ... ← 정답
    // Also: ✅ ④ difficult: 원문은 easy(쉬운). 다른 사람을... (long explanation)
    const mB2 = trimmed.match(/^[❌✗×✅✓]\s+([①②③④])\s+(\S[\S ]*?)\s*[:：]\s*원문은?\s+(\S+)/);
    if (mB2) {
      const marker = mB2[1];
      const wrongWord = cleanWord(mB2[2].trim());
      // origWord: just the first token after "원문은", strip Korean parens
      const origWord = cleanWord(mB2[3].trim());
      if (!map[marker] && !MARKERS.includes(wrongWord)) {
        map[marker] = { word: wrongWord, isWrong: true, origWord };
      }
    }

    // Pattern A: ✅/❌ 마커 word: meaning  (word already in passage, just needs marker+underline)
    // e.g. "✅① caught: 잡았다"
    // e.g. "✅ ③ solutions: 원문 일치"
    // e.g. "❌ ② promotes — '촉진하다'로 문맥에 맞음." (❌ = NOT the wrong answer = correct)
    // e.g. "❌ ① natural: 판단은 '자연스럽다' — 적절."
    // e.g. "✅ ② highest: 적절"
    // SKIP if contains "원문은" (handled by B2)
    // SKIP if contains → (handled by B)
    if (!trimmed.includes('원문은') && !trimmed.includes('→')) {
      const mA = trimmed.match(/^[✅✓○●❌✗×]\s*([①②③④])\s+(\S[\S ]*?)(?:\s*:|\s+—|\s*$)/);
      if (mA) {
        const marker = mA[1];
        const rawWord = mA[2].trim();
        const word = cleanWord(rawWord);
        // Skip if word is a marker char (column-swap artifact like "✅ ④ ③")
        if (!MARKERS.includes(word) && !map[marker]) {
          map[marker] = { word, isWrong: false, origWord: null };
        }
      }
    }

    // Pattern C: inline format with word on same line as marker duplicated
    // "✅ ② ② enriched" or "❌ ① ① cuts down on"
    // The FIRST marker is the real one; skip if second token is also a marker (column-swap)
    const mC = trimmed.match(/^[✅✓○●❌✗×]\s+([①②③④])\s+([①②③④])\s+(\S[\S ]*?)$/);
    if (mC && mC[1] === mC[2]) { // Only use if both markers are same (e.g. "② ② enriched")
      const marker = mC[1];
      const word = cleanWord(mC[3].trim());
      const isWrong = /^[❌✗×]/.test(trimmed);
      if (!map[marker] && !MARKERS.includes(word)) {
        map[marker] = { word, isWrong, origWord: null };
      }
    }
  });

  return map;
}

/**
 * passage에서 marker+<u>word</u> 추가
 *
 * Case A (isWrong=false): word가 이미 passage에 있음 → 앞에 marker+<u>...</u> 추가
 * Case B (isWrong=true): origWord가 passage에 있음 → origWord를 marker+<u>wrongWord</u>로 교체
 */
function applyMarkerToPassage(passage, marker, info) {
  if (!passage || !marker || !info || !info.word) return null;

  const word = info.word;
  const origWord = info.origWord;

  // Already has this marker?
  if (passage.includes(marker + '<u>') || passage.includes(marker + ' <u>')) {
    return null;
  }

  if (info.isWrong && origWord) {
    // Replace origWord in passage with marker+<u>wrongWord</u>
    // Strip any trailing parenthetical (including truncated Korean like "(더")
    const origWordStripped = origWord.replace(/\([^)]*$/, '').replace(/\(.*?\)/g, '').trim();
    const origWordClean = (origWordStripped || origWord).split(/\s+/).slice(0, 3).join(' '); // take first 3 words max
    const origRe = new RegExp(`\\b(${escapeRegex(origWordClean)})\\b`, 'i');
    if (origRe.test(passage)) {
      return passage.replace(origRe, `${marker}<u>${word}</u>`);
    }
    // Try word boundary less strict
    const origRe2 = new RegExp(`(?<=[\\s\\-—(]|^)(${escapeRegex(origWordClean)})(?=[\\s\\-—).,;:!?]|$)`, 'i');
    if (origRe2.test(passage)) {
      return passage.replace(origRe2, `${marker}<u>${word}</u>`);
    }
    return null;
  } else {
    // Case A: word is already in passage, wrap it
    // Don't wrap if already in a <u> tag
    const alreadyUl = new RegExp(`<u>[^<]*${escapeRegex(word)}[^<]*</u>`, 'i');
    if (alreadyUl.test(passage)) {
      const ulRe = new RegExp(`(<u>[^<]*${escapeRegex(word)}[^<]*</u>)`, 'i');
      const idxUl = passage.search(ulRe);
      if (idxUl > 0 && MARKERS.includes(passage[idxUl - 1])) {
        // Word has a different marker — swap it with our desired marker
        const existingMarker = passage[idxUl - 1];
        if (existingMarker !== marker) {
          // Replace existingMarker+<u>word</u> with marker+<u>word</u>
          return passage.replace(new RegExp(escapeRegex(existingMarker) + `(<u>[^<]*${escapeRegex(word)}[^<]*</u>)`, 'i'), `${marker}$1`);
        }
        return null; // already has correct marker
      }
      return passage.replace(ulRe, `${marker}$1`);
    }

    // Multi-word: handle "cuts down on" etc.
    const wordEsc = escapeRegex(word);
    const re1 = new RegExp(`(?<=[\\s\\-—(]|^)(${wordEsc}[s]?)(?=[\\s\\-—).,;:!?]|$)`, 'i');
    if (re1.test(passage)) {
      return passage.replace(re1, `${marker}<u>$1</u>`);
    }
    const re2 = new RegExp(`\\b(${wordEsc})\\b`, 'i');
    if (re2.test(passage)) {
      return passage.replace(re2, `${marker}<u>$1</u>`);
    }

    return null;
  }
}

function processQuestion(q, fullPassage, dryRun) {
  const typeNorm = (q.type || '').trim();
  if (!BUJUK_TYPES.includes(typeNorm) || q.fmt !== 'mc') return null;

  let passage = q.passage || fullPassage || '';
  if (!passage || passage.length < 50) return null;

  const ulCount = (passage.match(/<u>/g) || []).length;
  if (ulCount >= 4) return null;

  const missingMarkers = MARKERS.filter(m => !passage.includes(m));
  if (missingMarkers.length === 0) return null;

  const detMap = parseDetAnalysis(q.det?.analysis);

  let newPassage = passage;
  const added = [];
  const warnings = [];

  for (const marker of missingMarkers) {
    const info = detMap[marker];
    if (!info || !info.word) {
      warnings.push(`Q${q.id}: ${marker} 단어를 det.analysis에서 찾지 못함`);
      continue;
    }

    const result = applyMarkerToPassage(newPassage, marker, info);
    if (result) {
      newPassage = result;
      added.push({ marker, word: info.word, isWrong: info.isWrong, origWord: info.origWord });
    } else {
      const hint = info.isWrong
        ? `'${info.word}'(대체할 원문: '${info.origWord}')`
        : `'${info.word}'`;
      warnings.push(`Q${q.id}: ${marker} ${hint}을 passage에서 찾지 못함`);
    }
  }

  if (added.length === 0) return { qid: q.id, type: typeNorm, oldUl: ulCount, newUl: ulCount, added, warnings };

  const finalUlCount = (newPassage.match(/<u>/g) || []).length;

  if (!dryRun) {
    q.passage = newPassage;
  }

  return {
    qid: q.id,
    type: typeNorm,
    oldUl: ulCount,
    newUl: finalUlCount,
    added,
    warnings
  };
}

function processFile(filePath, dryRun) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`ERROR reading ${filePath}: ${e.message}`);
    return { path: filePath, fixes: [] };
  }

  const fullPassage = data.fullPassage || '';
  const fixes = [];

  (data.questions || []).forEach(q => {
    const fix = processQuestion(q, fullPassage, dryRun);
    if (fix) fixes.push(fix);
  });

  if (fixes.some(f => f.added.length > 0) && !dryRun) {
    const out = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(filePath, out, 'utf8');
  }

  return { path: filePath, fixes };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchIdx = args.indexOf('--batch');

  let filePaths = [];

  if (batchIdx >= 0) {
    const batchFile = args[batchIdx + 1];
    if (!batchFile) {
      console.error('--batch 다음에 파일 경로를 지정하세요');
      process.exit(1);
    }
    const list = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    filePaths = list.map(f => path.resolve(ROOT, f));
  } else {
    const filtered = args.filter(a => !a.startsWith('--'));
    if (filtered.length === 0) {
      console.error('Usage: node fix-p23-underline.js [--dry-run] <file.json>\n       node fix-p23-underline.js [--dry-run] --batch <list.json>');
      process.exit(1);
    }
    filePaths = filtered.map(f => path.resolve(ROOT, f));
  }

  console.log(`${dryRun ? '[DRY-RUN] ' : ''}파일 ${filePaths.length}개 처리 중...\n`);

  let totalFixed = 0;
  let filesFixed = 0;
  let totalWarnings = 0;

  filePaths.forEach(fp => {
    const result = processFile(fp, dryRun);
    const actualFixes = result.fixes.filter(f => f.added.length > 0);
    const warnFixes = result.fixes.filter(f => f.warnings.length > 0);

    if (result.fixes.length === 0) return;

    if (actualFixes.length > 0) filesFixed++;

    const relPath = path.relative(ROOT, fp);
    console.log(`${actualFixes.length > 0 ? '✓' : '⚠'} ${relPath}`);

    result.fixes.forEach(fix => {
      if (fix.added.length > 0) {
        totalFixed++;
        const status = fix.newUl >= 4 ? '→ 4개 ✓' : `→ ${fix.newUl}개 ⚠`;
        const addedStr = fix.added.map(a => {
          return a.isWrong
            ? `${a.marker}<u>${a.word}</u>[↩${a.origWord}]`
            : `${a.marker}<u>${a.word}</u>`;
        }).join(', ');
        console.log(`  Q${fix.qid}: 밑줄 ${fix.oldUl}→${fix.newUl}개 (${addedStr}) ${status}`);
      }
      fix.warnings.forEach(w => {
        totalWarnings++;
        console.log(`  ⚠ ${w}`);
      });
    });
  });

  console.log('\n━━━ fix-p23-underline 결과 ━━━');
  console.log(`파일: ${filePaths.length}개 스캔, ${filesFixed}개 수정`);
  console.log(`수정 문항: ${totalFixed}건, 경고: ${totalWarnings}건`);
  if (totalWarnings > 0) console.log(`⚠ 경고 항목은 수동 확인 필요`);
  if (dryRun) console.log(`\n⚠ DRY-RUN 모드 — 실제 파일 변경 없음`);
}

main();
