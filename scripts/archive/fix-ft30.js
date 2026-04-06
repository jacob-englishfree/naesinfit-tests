#!/usr/bin/env node
/**
 * fix-ft30.js — Remove hallucinated sentences from passage fields
 *
 * For each JSON test file, checks every question with both passage and fullPassage.
 * If a sentence in passage is NOT found in fullPassage (match ratio < 50%),
 * it is removed from the passage.
 *
 * Uses the same normalization logic as validate-fulltext.js for consistency.
 *
 * Usage: node scripts/fix-ft30.js [--dry-run] [--dir data/부교재]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Normalization (enhanced from validate-fulltext.js) ──
// Extra: strip [word1 / word2] → word1 (keeps first option, the original word)
// Extra: strip __________ (word) → word (어형변환 blanks → original word)
function normalizePassage(text) {
  if (!text) return '';
  let s = text;
  s = s.replace(/<b>\([ABC]\)<\/b>\s*/g, '');
  s = s.replace(/<\/?u>/g, '');
  s = s.replace(/\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/g, ' ');
  // Remove all HTML tags first (before bracket processing)
  s = s.replace(/<[^>]+>/g, '');
  // [word1 / word2] → word1 (first option = original word)
  s = s.replace(/\[([^\]/]+)\s*\/\s*[^\]]+\]/g, '$1');
  // __________ (word) → word (어형변환: blank + hint word → the original word)
  s = s.replace(/_{3,}\s*\((\w[\w\s]*)\)/g, '$1');
  // Remaining blanks (no hint)
  s = s.replace(/_{3,}/g, '');
  s = s.replace(/\([ABC]\)\s*/g, '');
  // (word) parenthesized forms for 어형변환
  s = s.replace(/\([\w]+\)/g, '');
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

function calcMatchRatio(normPassage, normFull, chunkSize = 6) {
  if (!normPassage || normPassage.length < chunkSize) return 1;
  if (!normFull) return 0;

  let matched = 0;
  let total = 0;

  for (let i = 0; i <= normPassage.length - chunkSize; i += chunkSize) {
    const chunk = normPassage.substring(i, i + chunkSize);
    if (chunk.trim().length < 3) continue;
    total++;
    if (normFull.includes(chunk)) matched++;
  }

  return total === 0 ? 1 : matched / total;
}

// Types where passage is intentionally different (skip)
const EXCERPT_TYPES = [
  '동의어 고르기', '반의어 고르기', '영영풀이 매칭',
  '빈칸 어휘 완성', 'T/F', '어형 변환 (서술형)',
  '순서배열', '글순서', '어순배열', '서술형',
  '다의어 문맥적 의미', '오류찾기', '의미파악', '한영',
  '어휘'
];
const FULL_TEXT_TYPES = [
  '내용일치', '내용불일치', '내용이해',
  '빈칸 문맥 완성', '빈칸추론', '빈칸 추론'
];

/**
 * Split passage into sentences, preserving the original text with HTML tags.
 * Returns array of {original, normalized, start, end} objects.
 */
function splitIntoSentences(passage) {
  // Split on sentence boundaries (. ! ?) followed by space or end
  // But preserve the delimiter in the sentence
  const sentences = [];
  // Use regex to split but keep delimiters
  const parts = passage.split(/(?<=[.!?])\s+/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const normalized = normalizePassage(trimmed);
    if (normalized.length > 20) {
      sentences.push({
        original: trimmed,
        normalized
      });
    }
  }
  return sentences;
}

/**
 * Check if a sentence is hallucinated (not in fullPassage).
 * Returns true if the sentence should be REMOVED.
 */
function isHallucinated(normSentence, normFull) {
  // Use same logic as FT-30 in validate-fulltext.js
  const ratio = calcMatchRatio(normSentence, normFull, 6);
  return ratio < 0.5;
}

/**
 * Remove hallucinated sentences from a passage string.
 * Returns {newPassage, removedSentences} or null if no changes.
 */
function fixPassage(passage, fullPassage) {
  if (!passage || !fullPassage) return null;
  if (passage === '__FULL__') return null;
  if (passage.trim().length < 20) return null;

  const normFull = normalizeFullPassage(fullPassage);

  // Split passage into sentences (working with the raw passage text)
  const sentences = splitIntoSentences(passage);
  if (sentences.length === 0) return null;

  const removed = [];
  const kept = [];

  for (const sent of sentences) {
    if (isHallucinated(sent.normalized, normFull)) {
      removed.push(sent.original);
    } else {
      kept.push(sent.original);
    }
  }

  if (removed.length === 0) return null;

  // If ALL sentences would be removed, replace with __FULL__
  if (kept.length === 0) {
    return { newPassage: '__FULL__', removedSentences: removed, allRemoved: true };
  }

  // Reconstruct passage from kept sentences
  const newPassage = kept.join(' ');

  return { newPassage, removedSentences: removed };
}

function findJsonFiles(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(findJsonFiles(full));
      } else if (entry.name.endsWith('.json')) {
        results.push(full);
      }
    }
  } catch (e) {
    // skip unreadable dirs
  }
  return results;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dirIdx = args.indexOf('--dir');
  const targetDir = dirIdx >= 0 && args[dirIdx + 1]
    ? path.resolve(ROOT, args[dirIdx + 1])
    : path.join(ROOT, 'data');

  console.log(`Scanning: ${targetDir}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE (will modify files)'}`);
  console.log('');

  const files = findJsonFiles(targetDir).filter(f => !f.includes('/dist/'));
  console.log(`Found ${files.length} JSON files\n`);

  let totalModified = 0;
  let totalSentencesRemoved = 0;
  let totalQuestionsFixed = 0;
  let totalFullReplaced = 0;
  const allRemoved = []; // {file, qid, sentence}

  for (const filePath of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      continue; // skip unparseable
    }

    const { fullPassage, questions } = data;
    if (!fullPassage || !Array.isArray(questions)) continue;

    let fileModified = false;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const typeNorm = (q.type || '').trim();

      // Skip excerpt types (same as validate-fulltext.js)
      if (EXCERPT_TYPES.includes(typeNorm) && !FULL_TEXT_TYPES.includes(typeNorm)) continue;

      const result = fixPassage(q.passage, fullPassage);
      if (result) {
        const qid = q.id || (i + 1);
        const rel = path.relative(ROOT, filePath);

        for (const sent of result.removedSentences) {
          allRemoved.push({ file: rel, qid, sentence: sent });
          totalSentencesRemoved++;
        }

        if (!dryRun) {
          questions[i].passage = result.newPassage;
        }

        fileModified = true;
        totalQuestionsFixed++;
        if (result.allRemoved) totalFullReplaced++;

        const tag = result.allRemoved ? 'FULL' : 'FIX';
        console.log(`  [${tag}] ${rel} Q${qid}: removed ${result.removedSentences.length} sentence(s)${result.allRemoved ? ' → __FULL__' : ''}`);
        for (const sent of result.removedSentences) {
          console.log(`         "${sent.substring(0, 80)}${sent.length > 80 ? '...' : ''}"`);
        }
      }
    }

    if (fileModified) {
      totalModified++;
      if (!dryRun) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      }
    }
  }

  console.log('\n══════════════════════════════════════');
  console.log(`Total files modified:      ${totalModified}`);
  console.log(`Total questions fixed:     ${totalQuestionsFixed}`);
  console.log(`Total sentences removed:   ${totalSentencesRemoved}`);
  console.log(`Total __FULL__ replaced:   ${totalFullReplaced}`);
  console.log(`Mode:                      ${dryRun ? 'DRY RUN (no files changed)' : 'LIVE (files updated)'}`);
  console.log('══════════════════════════════════════\n');

  if (allRemoved.length > 0) {
    console.log('Sample of removed sentences:');
    const sample = allRemoved.slice(0, 10);
    sample.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.file}] Q${r.qid}: "${r.sentence.substring(0, 100)}${r.sentence.length > 100 ? '...' : ''}"`);
    });
  }
}

main();
