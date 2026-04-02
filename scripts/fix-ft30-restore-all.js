#!/usr/bin/env node
/**
 * fix-ft30-restore-all.js
 *
 * FT-30 fix removed sentences containing test markers (__________, <u>, etc)
 * from passages. This restores ONLY the affected question's passage from HEAD
 * for files that now fail structure validation (P22, P23, V63, V66, V67, V68).
 *
 * Covers ALL data/ directories (모의고사, 교과서, 부교재).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, ...opts });
}

// Step 1: Get ALL modified files in data/
console.log('=== Step 1: Getting modified files from git diff (all data/) ===');
const modifiedFiles = run('git -c core.quotePath=false diff --name-only -- "data/"')
  .trim().split('\n').filter(Boolean);
console.log(`Found ${modifiedFiles.length} modified files`);

// Step 2: Run validate on each and collect errors
console.log('\n=== Step 2: Running validate + selective restore ===');

const errorPattern = /^\s*\[([SA])\]\s+(P22|P23|V63|V66|V67|V68|V68-U):\s+Q(\d+)/;
let totalFixed = 0;
let totalFiles = 0;
const fixedFilesList = [];

for (const filePath of modifiedFiles) {
  const absPath = path.join(ROOT, filePath);
  if (!fs.existsSync(absPath)) continue;
  if (!filePath.endsWith('.json')) continue;

  // Run validate
  let output;
  try {
    output = run(`node validate/validate.js "${filePath}" 2>&1`);
  } catch (e) {
    output = (e.stdout || '') + (e.stderr || '');
  }

  // Parse S/A level errors for passage-related checks
  const lines = output.split('\n');
  const failingQs = new Set();

  for (const line of lines) {
    const m = line.match(errorPattern);
    if (m) {
      const qNum = parseInt(m[3], 10);
      failingQs.add(qNum);
    }
  }

  if (failingQs.size === 0) continue;

  // Get original file from git HEAD
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
    const idx = qNum - 1;
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
    fixedFilesList.push({ file: filePath, count: fixedCount, qs: [...failingQs] });
    console.log(`  ✅ ${filePath}: restored ${fixedCount} passages (Q${[...failingQs].join(', Q')})`);
  } else {
    console.log(`  ⚠ ${filePath}: errors Q${[...failingQs].join(', Q')} but no passage diff found`);
  }
}

console.log(`\n=== Step 3: Summary ===`);
console.log(`Fixed ${totalFixed} passages in ${totalFiles} files`);

// Step 4: Re-validate ALL fixed files
console.log('\n=== Step 4: Re-validating fixed files ===');
let passCount = 0;
let failCount = 0;
const stillFailing = [];

for (const { file: filePath } of fixedFilesList) {
  const absPath = path.join(ROOT, filePath);
  if (!fs.existsSync(absPath)) continue;

  let output;
  try {
    output = run(`node validate/validate.js "${filePath}" 2>&1`);
  } catch (e) {
    output = (e.stdout || '') + (e.stderr || '');
  }

  const lines = output.split('\n');
  const blockingErrors = lines.filter(line => {
    const m = line.match(/^\s*\[([SA])\]/);
    return m !== null;
  });

  if (blockingErrors.length > 0) {
    failCount++;
    stillFailing.push({ file: filePath, errors: blockingErrors.join('\n') });
  } else {
    passCount++;
  }
}

console.log(`\nFixed files re-validation: ${passCount} PASS, ${failCount} FAIL out of ${fixedFilesList.length} files`);

if (stillFailing.length > 0) {
  console.log('\n⛔ Still failing files:');
  for (const f of stillFailing) {
    console.log(`  ${f.file}:`);
    console.log(`    ${f.errors}`);
  }
}
