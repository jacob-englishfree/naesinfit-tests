#!/usr/bin/env node
/**
 * fix-ft30-round2.js — Remove hallucinated sentences from passage fields (Round 2)
 *
 * Targets 41 specific files that still have FT-30 errors.
 * Uses EXACTLY the same detection logic as validate-fulltext.js FT-30,
 * then removes the offending sentences from the original passage.
 *
 * Usage: node scripts/fix-ft30-round2.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── The 41 target files ──
const TARGET_FILES = [
  '6강/단어.json',
  '6강/워크북.json',
  '8강/2번/워크북.json',
  '12강/2번/워크북.json',
  '12강/3번/단어.json',
  '12강/3번/워크북.json',
  '12강/3번/퀴즈.json',
  '12강/4번/단어.json',
  '12강/4번/워크북.json',
  '12강/4번/퀴즈.json',
  '12강/Gateway/워크북.json',
  '13강/Gateway/단어.json',
  '18강/1번/워크북.json',
  '18강/3번/워크북.json',
  '18강/4번/워크북.json',
  '19강/4번/단어.json',
  '21강/1번/워크북.json',
  '21강/2번/워크북.json',
  '21강/3번/단어.json',
  '21강/Gateway/퀴즈.json',
  '21강/단어.json',
  '22강/1번/워크북.json',
  '22강/1번/퀴즈.json',
  '22강/2번/단어.json',
  '22강/2번/워크북.json',
  '22강/2번/퀴즈.json',
  '22강/3번/퀴즈.json',
  '22강/Gateway/워크북.json',
  '22강/Gateway/퀴즈.json',
  '22강/워크북.json',
  '23강/1번/워크북.json',
  '23강/1번/퀴즈.json',
  '23강/2번/단어.json',
  '23강/2번/워크북.json',
  '23강/2번/퀴즈.json',
  '23강/3번/단어.json',
  '23강/3번/워크북.json',
  '23강/3번/퀴즈.json',
  '23강/Gateway/워크북.json',
  '23강/Gateway/퀴즈.json',
  '23강/워크북.json',
];

const BASE_DIR = path.join(ROOT, 'data', '부교재', '수능특강', '영어');

// ── Normalization (EXACT copy from validate-fulltext.js) ──
function normalizePassage(text) {
  if (!text) return '';
  let s = text;
  s = s.replace(/<b>\([ABC]\)<\/b>\s*/g, '');
  s = s.replace(/<\/?u>/g, '');
  s = s.replace(/\[([^\]\/]+)\s*\/\s*[^\]]+\]/g, (_, first) => first.trim());
  s = s.replace(/\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/g, ' ');
  s = s.replace(/_{3,}/g, '');
  s = s.replace(/\([ABC]\)\s*/g, '');
  s = s.replace(/\([\w]+\)/g, '');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/['']/g, "'");
  s = s.replace(/[""]/g, '"');
  s = s.replace(/[—–]/g, '-');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function normalizeFullPassage(text) {
  if (!text) return '';
  let s = text;
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  s = s.replace(/['']/g, "'");
  s = s.replace(/[""]/g, '"');
  s = s.replace(/[—–]/g, '-');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function calcMatchRatio(normText, normFull, chunkSize = 6) {
  if (!normText || normText.length < chunkSize) return 1;
  if (!normFull) return 0;
  let matched = 0;
  let total = 0;
  for (let i = 0; i <= normText.length - chunkSize; i += chunkSize) {
    const chunk = normText.substring(i, i + chunkSize);
    if (chunk.trim().length < 3) continue;
    total++;
    if (normFull.includes(chunk)) matched++;
  }
  return total === 0 ? 1 : matched / total;
}

// ── Excerpt types (EXACT copy from validate-fulltext.js) ──
const EXCERPT_TYPES = [
  '동의어 고르기', '반의어 고르기', '영영풀이 매칭',
  '빈칸 어휘 완성', 'T/F', 'TF', '어형 변환 (서술형)', '어형 변환',
  '순서배열', '글순서', '어순배열', '서술형',
  '다의어 문맥적 의미', '오류찾기', '의미파악', '한영', '한→영',
  '어휘', '주제', '주제/요지', '제목', '요약', '요약문',
  '함축의미 추론', '무관문장', '무관', '지칭추론', '지칭', '연결사',
  '어법', '어법 빈칸', '문맥상 부적절한 어휘', '부적절한 어휘',
  '(A)(B)(C) 조합형', '문장삽입',
  '빈칸 문맥 완성', '빈칸추론', '빈칸 추론',
];
const FULL_TEXT_TYPES = [
  '내용일치', '내용불일치', '내용이해',
  '빈칸 문맥 완성', '빈칸추론', '빈칸 추론',
];

function shouldCheckQuestion(q) {
  const typeNorm = (q.type || '').trim();
  if (EXCERPT_TYPES.includes(typeNorm) && !FULL_TEXT_TYPES.includes(typeNorm)) return false;
  return true;
}

/**
 * Detect FT-30 errors using EXACTLY the same logic as validate-fulltext.js.
 * Returns array of hallucinated normalized sentence strings.
 */
function detectFT30(normPassage, normFull) {
  // Same as validate-fulltext.js lines 272-277
  const passageSentences = normPassage.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return passageSentences.filter(s => {
    const trimmed = s.trim();
    return calcMatchRatio(trimmed, normFull, 6) < 0.5;
  });
}

/**
 * Given a hallucinated normalized sentence fragment, find and remove
 * the corresponding sentence(s) from the original passage text.
 *
 * Strategy: for each sentence boundary in the original passage,
 * normalize it and check if it contains the hallucinated fragment.
 */
function removeHallucinatedFromOriginal(originalPassage, hallucinatedNormFragments, normFull) {
  if (!originalPassage || hallucinatedNormFragments.length === 0) return null;

  // Split original passage into sentences at ". " / "! " / "? " boundaries
  // We need to be careful to keep the punctuation with the sentence
  const sentenceRegex = /(?<=[.!?])\s+/;
  const originalSentences = originalPassage.split(sentenceRegex).map(s => s.trim()).filter(s => s.length > 0);

  if (originalSentences.length === 0) return null;

  const kept = [];
  const removed = [];

  for (const origSent of originalSentences) {
    const normSent = normalizePassage(origSent);

    // Check if this normalized sentence (or any part of it) matches a hallucinated fragment
    let isHallucinated = false;

    // Strip trailing punctuation from normalized sentence to match validate-fulltext.js behavior
    // (validate-fulltext splits on [.!?]+ which strips punctuation from ends)
    const normSentStripped = normSent.replace(/[.!?]+$/, '').trim();
    if (normSentStripped.length > 20) {
      const ratio = calcMatchRatio(normSentStripped, normFull, 6);
      if (ratio < 0.5) {
        isHallucinated = true;
      }
    }

    if (isHallucinated) {
      removed.push(origSent);
    } else {
      kept.push(origSent);
    }
  }

  if (removed.length === 0) return null;

  // If removing would leave < 3 sentences, use __FULL__
  if (kept.length < 3) {
    return { newPassage: '__FULL__', removed, usedFull: true };
  }

  return { newPassage: kept.join(' '), removed, usedFull: false };
}

// ── Main ──
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`fix-ft30-round2.js — Fixing FT-30 errors in ${TARGET_FILES.length} files`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE (will modify files)'}\n`);

  let totalFilesModified = 0;
  let totalSentencesRemoved = 0;
  let totalQuestionsFixed = 0;
  let totalFullReplaced = 0;
  const filesMissing = [];

  for (const relFile of TARGET_FILES) {
    const filePath = path.join(BASE_DIR, relFile);

    if (!fs.existsSync(filePath)) {
      filesMissing.push(relFile);
      console.log(`[SKIP] ${relFile} — file not found`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.log(`[SKIP] ${relFile} — parse error: ${e.message}`);
      continue;
    }

    const { fullPassage, questions } = data;
    if (!fullPassage || !Array.isArray(questions)) {
      console.log(`[SKIP] ${relFile} — no fullPassage or questions`);
      continue;
    }

    const normFull = normalizeFullPassage(fullPassage);
    let fileModified = false;
    let fileRemovedCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!shouldCheckQuestion(q)) continue;
      if (!q.passage || q.passage === '__FULL__' || q.passage.trim().length < 20) continue;

      const normPassage = normalizePassage(q.passage);

      // Step 1: Detect FT-30 using EXACT same logic as validate-fulltext.js
      const hallucinated = detectFT30(normPassage, normFull);
      if (hallucinated.length === 0) continue;

      // Step 2: Remove hallucinated sentences from original passage
      const result = removeHallucinatedFromOriginal(q.passage, hallucinated, normFull);
      if (!result) continue;

      const qid = q.id || (i + 1);
      const tag = result.usedFull ? '__FULL__' : 'FIX';
      console.log(`  [${tag}] ${relFile} Q${qid}: removed ${result.removed.length} sentence(s)`);
      for (const sent of result.removed) {
        console.log(`         - "${sent.substring(0, 100)}${sent.length > 100 ? '...' : ''}"`);
      }

      if (!dryRun) {
        questions[i].passage = result.newPassage;
      }

      fileModified = true;
      fileRemovedCount += result.removed.length;
      totalQuestionsFixed++;
      if (result.usedFull) totalFullReplaced++;
    }

    if (fileModified) {
      totalFilesModified++;
      totalSentencesRemoved += fileRemovedCount;

      if (!dryRun) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`  [SAVED] ${relFile} (${fileRemovedCount} sentences removed)\n`);
      } else {
        console.log(`  [DRY] ${relFile} would remove ${fileRemovedCount} sentences\n`);
      }
    } else {
      console.log(`  [CLEAN] ${relFile} — no FT-30 errors found\n`);
    }
  }

  console.log('══════════════════════════════════════');
  console.log(`Files scanned:             ${TARGET_FILES.length}`);
  console.log(`Files modified:            ${totalFilesModified}`);
  console.log(`Files missing:             ${filesMissing.length}`);
  console.log(`Questions fixed:           ${totalQuestionsFixed}`);
  console.log(`Total sentences removed:   ${totalSentencesRemoved}`);
  console.log(`Replaced with __FULL__:    ${totalFullReplaced}`);
  console.log(`Mode:                      ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('══════════════════════════════════════\n');

  // Re-validate if live mode
  if (!dryRun && totalFilesModified > 0) {
    console.log('── Re-validating fixed files ──\n');
    const { validateFulltext } = require('../validate/validate-fulltext.js');

    let rePass = 0, reFail = 0;
    const filesStillFail = [];

    for (const relFile of TARGET_FILES) {
      const filePath = path.join(BASE_DIR, relFile);
      if (!fs.existsSync(filePath)) continue;

      const result = validateFulltext(filePath);
      const ft30Errors = [...result.errors, ...result.warnings].filter(e => e.id === 'FT-30');

      if (ft30Errors.length > 0) {
        reFail++;
        filesStillFail.push(relFile);
        console.log(`[STILL FAIL] ${relFile}`);
        ft30Errors.forEach(e => console.log(`  [${e.sev}] ${e.msg}`));
      } else {
        rePass++;
        if (!result.pass) {
          const otherErrors = result.errors.filter(e => e.id !== 'FT-30');
          if (otherErrors.length > 0) {
            console.log(`[FT30-OK] ${relFile} (other errors: ${otherErrors.map(e => e.id).join(', ')})`);
          } else {
            console.log(`[PASS] ${relFile}`);
          }
        } else {
          console.log(`[PASS] ${relFile}`);
        }
      }
    }

    console.log(`\n── Re-validation Summary ──`);
    console.log(`FT-30 resolved: ${rePass}`);
    console.log(`FT-30 still failing: ${reFail}`);
    if (filesStillFail.length > 0) {
      console.log(`\nFiles still with FT-30:`);
      filesStillFail.forEach(f => console.log(`  - ${f}`));
    }
  }
}

main();
