#!/usr/bin/env node
/**
 * fix-ft30-restore.js
 *
 * FT-30 hallucination fix was too aggressive — it removed sentences
 * containing test markers (__________, <u> tags, ①②③④) from passages.
 *
 * This script:
 * 1. Gets all modified files in data/부교재/ from git diff
 * 2. Runs validate on each
 * 3. For files with S/A-level errors, restores ONLY the affected question's
 *    passage from the git HEAD version
 * 4. Re-validates to confirm fix
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, ...opts });
}

// Step 1: Get all modified files in data/부교재/
console.log('=== Step 1: Getting modified files from git diff ===');
const modifiedFiles = run('git -c core.quotePath=false diff --name-only -- "data/부교재/"')
  .trim().split('\n').filter(Boolean);
console.log(`Found ${modifiedFiles.length} modified files`);

// Step 2: Run validate on each and collect errors
console.log('\n=== Step 2: Running validate on all modified files ===');

// Match any S or A level error related to passage issues
const errorPattern = /^\s*\[([SA])\]\s+(P22|P23|V63|V66|V67|V68|V68-U):\s+Q(\d+)/;
let totalFixed = 0;
let totalFiles = 0;

for (const filePath of modifiedFiles) {
  const absPath = path.join(ROOT, filePath);
  if (!fs.existsSync(absPath)) continue;

  // Run validate
  let output;
  try {
    output = run(`node validate/validate.js "${filePath}" 2>&1`);
  } catch (e) {
    output = e.stdout || e.stderr || '';
  }

  // Parse S/A level errors for P22, P23, V63, V66, V68
  const lines = output.split('\n');
  const failingQs = new Set();

  for (const line of lines) {
    const m = line.match(errorPattern);
    if (m) {
      const qNum = parseInt(m[3], 10); // 1-indexed question number
      failingQs.add(qNum);
    }
  }

  if (failingQs.size === 0) continue;

  // Step 3: Get original file from git HEAD
  let origData;
  try {
    const origJson = run(`git show HEAD:"${filePath}"`, { stdio: ['pipe', 'pipe', 'pipe'] });
    origData = JSON.parse(origJson);
  } catch (e) {
    console.log(`  ⚠ Cannot get HEAD version of ${filePath}, skipping`);
    continue;
  }

  // Read current file
  const currentJson = fs.readFileSync(absPath, 'utf8');
  const currentData = JSON.parse(currentJson);

  if (!currentData.questions || !origData.questions) continue;

  let fixedCount = 0;

  for (const qNum of failingQs) {
    const idx = qNum - 1; // Convert to 0-indexed
    if (idx < 0 || idx >= currentData.questions.length) continue;
    if (idx >= origData.questions.length) continue;

    const origPassage = origData.questions[idx].passage;
    const curPassage = currentData.questions[idx].passage;

    if (origPassage && origPassage !== curPassage) {
      currentData.questions[idx].passage = origPassage;
      fixedCount++;
    }
  }

  if (fixedCount > 0) {
    fs.writeFileSync(absPath, JSON.stringify(currentData, null, 2) + '\n');
    totalFixed += fixedCount;
    totalFiles++;
    console.log(`  ✅ ${filePath}: restored ${fixedCount} passages (Q${[...failingQs].join(', Q')})`);
  }
}

console.log(`\n=== Step 3: Summary ===`);
console.log(`Fixed ${totalFixed} passages in ${totalFiles} files`);

// Step 4: Re-validate all fixed files
console.log('\n=== Step 4: Re-validating all modified files ===');
let passCount = 0;
let failCount = 0;
const stillFailing = [];

for (const filePath of modifiedFiles) {
  const absPath = path.join(ROOT, filePath);
  if (!fs.existsSync(absPath)) continue;

  let output;
  try {
    output = run(`node validate/validate.js "${filePath}" 2>&1`);
  } catch (e) {
    output = e.stdout || e.stderr || '';
  }

  // Check for S/A errors
  const lines = output.split('\n');
  const hasBlockingError = lines.some(line => {
    const m = line.match(/^\s*\[([SA])\]/);
    return m !== null;
  });

  if (hasBlockingError) {
    failCount++;
    stillFailing.push({ file: filePath, output: lines.filter(l => l.match(/^\s*\[([SA])\]/)).join('\n') });
  } else {
    passCount++;
  }
}

console.log(`\nResults: ${passCount} PASS, ${failCount} FAIL out of ${modifiedFiles.length} files`);

if (stillFailing.length > 0) {
  console.log('\n⛔ Still failing files:');
  for (const f of stillFailing) {
    console.log(`  ${f.file}:`);
    console.log(`    ${f.output}`);
  }
}
