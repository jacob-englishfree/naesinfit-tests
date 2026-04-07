#!/usr/bin/env node
/**
 * fix-answer-distribution.js
 *
 * Fixes A6 (same answer ≥6 times in 20Q file) and
 * A7 (same answer 3-consecutive) violations by rotating
 * the ch array of MC questions, preserving correct answer content.
 *
 * Rules:
 * - Only modifies fmt="mc" questions
 * - Rotates ch array so correct answer lands on a different position
 * - ans is 1-indexed (ans=1 → ch[0])
 * - Does NOT touch written questions
 * - Skips files under 수능특강Light
 *
 * Usage: node scripts/fix-answer-distribution.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Collect all JSON files, skipping 수능특강Light ──
function collectFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip 수능특강Light
      if (e.name.includes('수능특강Light') || e.name.includes('수능특강light')) continue;
      collectFiles(full, files);
    } else if (e.name.endsWith('.json') && !e.name.startsWith('.')) {
      files.push(full);
    }
  }
  return files;
}

// ── Check A6: any MC answer appears >= 6 times ──
function checkA6(mcQuestions) {
  const dist = {};
  mcQuestions.forEach(q => {
    dist[q.ans] = (dist[q.ans] || 0) + 1;
  });
  return Object.entries(dist)
    .filter(([, count]) => count > 5)
    .map(([ans, count]) => ({ ans: parseInt(ans), count }));
}

// ── Check A7: 3 consecutive same answers ──
function checkA7(mcQuestions) {
  const violations = new Set();
  for (let i = 0; i < mcQuestions.length - 2; i++) {
    if (mcQuestions[i].ans === mcQuestions[i+1].ans &&
        mcQuestions[i+1].ans === mcQuestions[i+2].ans) {
      violations.add(i);
      violations.add(i+1);
      violations.add(i+2);
    }
  }
  return violations;
}

// ── For a given set of MC questions, compute the ideal ans sequence ──
// Strategy: greedily assign answer positions avoiding:
//   - 3-consecutive same value
//   - any value exceeding 5 occurrences
// We keep correct answer content, only change position (rotate ch).
function computeTargetAns(mcQuestions) {
  const n = mcQuestions.length;
  const targetAns = new Array(n);

  // For each question, we can rotate ch to place the correct answer at any of positions 1-4
  // (or 1-2 for T/F which we skip)
  // Use a greedy approach: for each question in order, choose the lowest-count answer
  // that doesn't create a 3-run.

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const maxPerAns = 5;

  for (let i = 0; i < n; i++) {
    const q = mcQuestions[i];
    const isTF = Array.isArray(q.ch) && q.ch.length === 2;
    const positions = isTF ? [1, 2] : [1, 2, 3, 4];

    // Find best position for this question
    // Prefer: no 3-run, not exceeding max count, lowest count
    let bestPos = null;
    let bestScore = Infinity;

    for (const pos of positions) {
      // Check count limit
      if (counts[pos] >= maxPerAns) continue;

      // Check 3-run: would this create a 3-run?
      let creates3run = false;
      if (i >= 2 && targetAns[i-1] === pos && targetAns[i-2] === pos) {
        creates3run = true;
      }
      if (creates3run) continue;

      // Score: lower count is better (spread distribution)
      const score = counts[pos];
      if (score < bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }

    if (bestPos === null) {
      // Fallback: just avoid 3-run, ignore count limit
      for (const pos of positions) {
        let creates3run = false;
        if (i >= 2 && targetAns[i-1] === pos && targetAns[i-2] === pos) {
          creates3run = true;
        }
        if (!creates3run) {
          bestPos = pos;
          break;
        }
      }
      if (bestPos === null) bestPos = positions[0]; // last resort
    }

    targetAns[i] = bestPos;
    counts[bestPos] = (counts[bestPos] || 0) + 1;
  }

  return targetAns;
}

// ── Rotate ch array so correct answer lands at targetPos (1-indexed) ──
function rotateChoices(ch, currentAns, targetAns) {
  if (currentAns === targetAns) return { ch, ans: currentAns };

  // ch is 0-indexed; ans is 1-indexed
  const correctContent = ch[currentAns - 1];

  // Build new ch: move correct answer to targetAns position
  // Fill remaining positions with the other choices in their original order
  const others = ch.filter((_, i) => i !== currentAns - 1);
  const newCh = [...ch]; // copy

  // Insert correct answer at targetAns-1
  // For the remaining slots, fill with others maintaining relative order
  const targetIdx = targetAns - 1;
  let otherIdx = 0;
  for (let i = 0; i < newCh.length; i++) {
    if (i === targetIdx) {
      newCh[i] = correctContent;
    } else {
      newCh[i] = others[otherIdx++];
    }
  }

  return { ch: newCh, ans: targetAns };
}

// ── Main fix function for a single file ──
function fixFile(filePath) {
  let raw, data;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    return { skipped: true, reason: `parse error: ${e.message}` };
  }

  const { questions } = data;
  if (!Array.isArray(questions)) return { skipped: true, reason: 'no questions array' };
  if (questions.length !== 20) {
    // Only fix 20-question files (A6 only applies to 20Q, A7 applies to all but focus on 20Q)
    // Still check A7 for any file
    const mcQuestions = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
    if (mcQuestions.length < 3) return { skipped: true, reason: 'too few MC questions' };

    const a7Violations = checkA7(mcQuestions);
    if (a7Violations.size === 0) return { skipped: true, reason: 'no violations' };

    // Fix only A7 for non-20Q files
    return fixA7Only(filePath, data, questions, mcQuestions, a7Violations);
  }

  const mcQuestions = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
  const a6Violations = checkA6(mcQuestions);
  const a7Violations = checkA7(mcQuestions);

  if (a6Violations.length === 0 && a7Violations.size === 0) {
    return { skipped: true, reason: 'no violations' };
  }

  // Need to fix: compute ideal answer sequence
  const targetAns = computeTargetAns(mcQuestions);

  // Apply rotations
  let modified = false;
  const mcMap = new Map(mcQuestions.map((q, i) => [q.id, { q, targetIdx: i }]));

  questions.forEach(q => {
    if (q.fmt !== 'mc' || typeof q.ans !== 'number') return;
    const info = mcMap.get(q.id);
    if (!info) return;

    const target = targetAns[info.targetIdx];
    if (target === q.ans) return; // no change needed

    // Validate ch array
    if (!Array.isArray(q.ch) || q.ch.length < 2) return;

    // ⛔ 어법형(마커 라벨만 있는 ch) 셔플 금지 — ch 순서 = passage 밑줄 순서
    const isMarkerOnly = q.ch.every(c => /^[①②③④⑤⑥⑦⑧⑨⑩]\s*$/.test(String(c).trim()) || /^[①②③④⑤]\s+\S{1,20}$/.test(String(c).trim()));
    const stem = (q.stem || '') + ' ' + (q.type || '');
    const isGrammar = /어법|어형|부적절/.test(stem);
    if (isMarkerOnly || isGrammar) return;

    const { ch: newCh, ans: newAns } = rotateChoices(q.ch, q.ans, target);

    // Verify the correct content is preserved
    const originalCorrect = q.ch[q.ans - 1];
    const newCorrect = newCh[newAns - 1];
    if (originalCorrect !== newCorrect) {
      console.error(`  ERROR: correct answer content mismatch at Q${q.id} in ${filePath}`);
      return;
    }

    q.ch = newCh;
    q.ans = newAns;
    modified = true;
  });

  if (!modified) return { skipped: true, reason: 'no changes made' };

  // Verify fixes resolved the violations
  const mcAfter = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
  const a6After = checkA6(mcAfter);
  const a7After = checkA7(mcAfter);

  if (a6After.length > 0 || a7After.size > 0) {
    // Re-attempt with a different strategy
    console.warn(`  WARN: violations remain after first pass in ${path.relative(ROOT, filePath)}, retrying...`);
    // Retry with a stricter greedy pass
    return fixFileStrict(filePath, data, questions);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  return {
    modified: true,
    a6Before: a6Violations.length,
    a7Before: a7Violations.size,
    a6After: a6After.length,
    a7After: a7After.size
  };
}

// ── Fix A7 only for non-20Q files ──
function fixA7Only(filePath, data, questions, mcQuestions, a7Violations) {
  let modified = false;

  // For each violation index, try to change the 3rd question's position
  for (let i = 0; i < mcQuestions.length - 2; i++) {
    if (mcQuestions[i].ans === mcQuestions[i+1].ans &&
        mcQuestions[i+1].ans === mcQuestions[i+2].ans) {

      const q = mcQuestions[i+2]; // change the 3rd one in the run
      if (!Array.isArray(q.ch) || q.ch.length < 2) continue;

      const currentAns = q.ans;
      // Find a position that breaks the run
      const positions = q.ch.length === 2 ? [1, 2] : [1, 2, 3, 4];
      const alternativePos = positions.find(p => p !== currentAns);

      if (alternativePos && alternativePos !== currentAns) {
        const { ch: newCh, ans: newAns } = rotateChoices(q.ch, q.ans, alternativePos);
        const originalCorrect = q.ch[q.ans - 1];
        const newCorrect = newCh[newAns - 1];
        if (originalCorrect === newCorrect) {
          q.ch = newCh;
          q.ans = newAns;
          modified = true;
        }
      }
    }
  }

  if (!modified) return { skipped: true, reason: 'no changes possible' };

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  return { modified: true, a6Before: 0, a7Before: 1, a6After: 0, a7After: 0 };
}

// ── Strict retry: enumerate better positions ──
function fixFileStrict(filePath, data, questions) {
  const mcQuestions = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');

  // More thorough: try to find best permutation
  // Greedy with look-ahead: for each question, pick position that:
  // 1. Doesn't create 3-run
  // 2. Minimizes max count
  // 3. Prefers positions not used in last 2

  const n = mcQuestions.length;
  const targetAns = new Array(n);
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const maxPerAns = Math.ceil(n / 4) + 1; // flexible max

  for (let i = 0; i < n; i++) {
    const q = mcQuestions[i];
    const isTF = Array.isArray(q.ch) && q.ch.length === 2;
    const positions = isTF ? [1, 2] : [1, 2, 3, 4];

    // Sort positions by count ascending
    const sorted = [...positions].sort((a, b) => (counts[a] || 0) - (counts[b] || 0));

    let chosen = null;
    for (const pos of sorted) {
      if ((counts[pos] || 0) >= maxPerAns) continue;
      // Check 3-run
      if (i >= 2 && targetAns[i-1] === pos && targetAns[i-2] === pos) continue;
      chosen = pos;
      break;
    }

    if (chosen === null) {
      // Relax count constraint
      for (const pos of sorted) {
        if (i >= 2 && targetAns[i-1] === pos && targetAns[i-2] === pos) continue;
        chosen = pos;
        break;
      }
    }
    if (chosen === null) chosen = positions[0];

    targetAns[i] = chosen;
    counts[chosen] = (counts[chosen] || 0) + 1;
  }

  // Apply
  let modified = false;
  const mcMap = new Map(mcQuestions.map((q, i) => [q.id, i]));

  questions.forEach(q => {
    if (q.fmt !== 'mc' || typeof q.ans !== 'number') return;
    const idx = mcMap.get(q.id);
    if (idx === undefined) return;

    const target = targetAns[idx];
    if (target === q.ans) return;
    if (!Array.isArray(q.ch) || q.ch.length < 2) return;

    const { ch: newCh, ans: newAns } = rotateChoices(q.ch, q.ans, target);
    const originalCorrect = q.ch[q.ans - 1];
    if (newCh[newAns - 1] !== originalCorrect) {
      console.error(`  ERROR: content mismatch in strict pass Q${q.id}`);
      return;
    }

    q.ch = newCh;
    q.ans = newAns;
    modified = true;
  });

  if (!modified) return { skipped: true, reason: 'strict: no changes' };

  // Final check
  const mcAfter = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
  const a6After = checkA6(mcAfter);
  const a7After = checkA7(mcAfter);

  if (a6After.length > 0 || a7After.size > 0) {
    console.warn(`  WARN: violations STILL remain after strict pass: ${path.relative(ROOT, filePath)}`);
    console.warn(`    A6: ${JSON.stringify(a6After)}, A7 count: ${a7After.size}`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  return { modified: true, strictPass: true, a6After: a6After.length, a7After: a7After.size };
}

// ── Main ──
const files = collectFiles(DATA_DIR);
console.log(`Found ${files.length} JSON files (excluding 수능특강Light)`);

let totalFixed = 0;
let totalSkipped = 0;
let totalErrors = 0;
let remaining = 0;

for (const f of files) {
  try {
    const result = fixFile(f);
    if (result.skipped) {
      totalSkipped++;
    } else if (result.modified) {
      totalFixed++;
      const rel = path.relative(ROOT, f);
      if (result.a6After > 0 || result.a7After > 0) {
        remaining++;
        console.log(`  [PARTIAL] ${rel} — A6 remaining: ${result.a6After}, A7 remaining: ${result.a7After}`);
      }
    }
  } catch (e) {
    totalErrors++;
    console.error(`ERROR processing ${f}: ${e.message}`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Files checked:  ${files.length}`);
console.log(`Files modified: ${totalFixed}`);
console.log(`Files skipped:  ${totalSkipped}`);
console.log(`Errors:         ${totalErrors}`);
console.log(`Partial fixes:  ${remaining}`);
if (DRY_RUN) console.log(`\n[DRY RUN] No files were written.`);
