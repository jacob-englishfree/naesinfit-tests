#!/usr/bin/env node
/**
 * fix-v70-blank-in-stem.js
 *
 * Fixes V70 violations: 빈칸 type questions where the blank (__________) is in
 * the `stem` field instead of the `passage` field.
 *
 * Rule: For 빈칸추론 / 빈칸 문맥 완성 type questions, the blank must be in `passage`.
 *
 * Fix strategy:
 *   The blank is in a quoted summary/comprehension sentence inside the stem.
 *   Move that sentence (with the blank) into the passage, and set the stem
 *   to the standard Korean instruction line only.
 *
 * Scope: data/교과서 and data/모의고사 only (skip 수능특강Light)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── helpers ────────────────────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) results.push(...walk(full));
    else if (full.endsWith('.json'))      results.push(full);
  }
  return results;
}

/**
 * Extract the standard instruction line and the blank-sentence from a stem.
 *
 * Patterns seen in the wild:
 *   A) Multi-line with quotes:
 *      "다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?\n\n\"Sentence with __________.\"
 *   B) Single-line Korean stem that itself has __________ (no separate instruction):
 *      "다음 글의 요지로 보아, 엘프에 대한 아이슬란드인들의 믿음은 결과적으로 __________에 기여한다."
 *   C) Two-line (Korean + quoted English, no extra blank line):
 *      "글의 흐름으로 보아 빈칸에 들어갈 말로 가장 적절한 것은?\n\"The tree mail ...\""
 *
 * Returns: { instruction: string, blankSentence: string }
 */
function parseStem(stem) {
  const lines = stem.split('\n').map(l => l.trim()).filter(Boolean);

  // Find the line(s) that contain __________
  const blankLineIdx = lines.findIndex(l => l.includes('__________'));

  if (blankLineIdx === -1) return null; // shouldn't happen

  if (blankLineIdx === 0) {
    // The entire stem is the blank sentence (no separate instruction)
    return {
      instruction: '다음 빈칸에 들어갈 말로 가장 적절한 것은?',
      blankSentence: stripQuotes(lines.join(' ')),
    };
  }

  // instruction = everything before blankLineIdx
  const instruction = lines.slice(0, blankLineIdx).join(' ').trim();
  // blankSentence = blankLineIdx onwards (there may be continuation lines)
  const blankPart = lines.slice(blankLineIdx).join(' ').trim();

  return {
    instruction,
    blankSentence: stripQuotes(blankPart),
  };
}

/** Remove surrounding quotes and HTML bold tags. */
function stripQuotes(s) {
  // Remove outer double-quotes (regular or escaped)
  s = s.replace(/^[""]/, '').replace(/[""]$/, '');
  // Remove surrounding HTML bold from the blank token itself
  s = s.replace(/<\/?b>/g, '');
  return s.trim();
}

/**
 * Build the new passage by appending the blankSentence as the final sentence.
 * We add a visual separator so the blank sentence is clearly the "요약" target.
 *
 * For "요약" stems (위 글을 한 문장으로 요약) the pattern is well established —
 * the summary sentence goes below the passage with a <br><br> or newline separator.
 */
function buildNewPassage(existingPassage, blankSentence) {
  const existing = (existingPassage || '').trim();

  // If the blank sentence is already present (shouldn't be), just return
  if (existing.includes('__________')) return existing;

  // Use the standard "요약" separator pattern
  const separator = '\n\n';
  return `${existing}${separator}${blankSentence}`;
}

// ── main ───────────────────────────────────────────────────────────────────

const BASE = path.join(
  '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/data'
);
const DIRS = [
  path.join(BASE, '교과서'),
  path.join(BASE, '모의고사'),
];

let totalFixed = 0;
let totalFiles = 0;
const report = [];

for (const dir of DIRS) {
  for (const file of walk(dir)) {
    // Skip 수능특강Light
    if (file.includes('수능특강Light')) continue;

    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); }
    catch (e) { continue; }

    let data;
    try { data = JSON.parse(raw); }
    catch (e) { console.error('JSON parse error:', file, e.message); continue; }

    const qs = data.questions;
    if (!Array.isArray(qs)) continue;

    let fixedInFile = 0;

    for (const q of qs) {
      // V70 check
      if (!q.type || !q.type.includes('빈칸')) continue;
      if (!q.stem || !q.stem.includes('__________')) continue;
      if (q.passage && q.passage.includes('__________')) continue;

      const parsed = parseStem(q.stem);
      if (!parsed) continue;

      const { instruction, blankSentence } = parsed;

      // Build new passage with blank sentence appended
      q.passage = buildNewPassage(q.passage, blankSentence);
      // Set stem to only the instruction (no blank)
      q.stem = instruction;

      fixedInFile++;
      totalFixed++;
    }

    if (fixedInFile > 0) {
      totalFiles++;
      const relPath = file.replace(BASE + '/', '');
      report.push({ file: relPath, fixed: fixedInFile });

      // Write back (preserve formatting as close as possible)
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    }
  }
}

// ── report ─────────────────────────────────────────────────────────────────

console.log('');
console.log('=== V70 Fix Report ===');
console.log(`Fixed ${totalFixed} questions in ${totalFiles} files`);
console.log('');
for (const { file, fixed } of report) {
  console.log(`  [${fixed}] ${file}`);
}
console.log('');
console.log('Done.');
