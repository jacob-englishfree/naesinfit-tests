#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — build-all.js
 * Finds ALL JSON files in data/, validates each, builds HTML to dist/.
 * Shows progress and summary.
 *
 * Usage: node scripts/build-all.js
 *        node scripts/build-all.js --force   (rebuild all, ignoring timestamps)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DIST_DIR = path.join(ROOT, 'dist');

function findJsonFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

function getOutputPath(jsonPath) {
  const relFromData = path.relative(DATA_DIR, jsonPath);
  const parsed = path.parse(relFromData);
  const outName = parsed.name + '테스트.html';
  return path.join(DIST_DIR, parsed.dir, outName);
}

function needsRebuild(jsonPath, htmlPath) {
  if (!fs.existsSync(htmlPath)) return true;
  const jsonStat = fs.statSync(jsonPath);
  const htmlStat = fs.statSync(htmlPath);
  return jsonStat.mtimeMs > htmlStat.mtimeMs;
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  const files = findJsonFiles(DATA_DIR);
  if (files.length === 0) {
    console.log('No JSON files found in data/');
    return;
  }

  console.log(`Found ${files.length} JSON files in data/`);
  if (force) console.log('Mode: --force (rebuilding all)');

  const validatePath = path.join(ROOT, 'validate', 'validate.js');
  const buildPath = path.join(ROOT, 'engine', 'build.js');

  // Check that required scripts exist
  if (!fs.existsSync(validatePath)) {
    console.error(`[ERROR] validate.js not found: ${validatePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(buildPath)) {
    console.error(`[ERROR] build.js not found: ${buildPath}`);
    process.exit(1);
  }

  // Import validate directly for speed
  const { validate } = require(validatePath);

  let built = 0, skipped = 0, failed = 0, validationFailed = 0;
  const errors = [];
  const startTime = Date.now();

  files.forEach((jsonFile, idx) => {
    const rel = path.relative(ROOT, jsonFile);
    const outPath = getOutputPath(jsonFile);
    const progress = `[${idx + 1}/${files.length}]`;

    // Skip if not modified (unless --force)
    if (!force && !needsRebuild(jsonFile, outPath)) {
      skipped++;
      return;
    }

    // Validate first
    const result = validate(jsonFile);
    if (!result.pass) {
      validationFailed++;
      const errMsgs = result.errors.map(e => `${e.id}: ${e.msg}`).join('; ');
      errors.push({ file: rel, reason: errMsgs });
      process.stdout.write(`${progress} [VFAIL] ${rel}\r\n`);
      return;
    }

    // Build
    try {
      execFileSync(process.execPath, [buildPath, jsonFile], {
        cwd: ROOT,
        stdio: 'pipe',
        timeout: 30000
      });
      built++;
      // Show progress in-place
      process.stdout.write(`${progress} [BUILD] ${rel}\r\n`);
    } catch (e) {
      failed++;
      const errMsg = (e.stderr || e.message || '').toString().trim().split('\n')[0];
      errors.push({ file: rel, reason: errMsg });
      process.stdout.write(`${progress} [FAIL]  ${rel}\r\n`);
    }
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Progress bar summary
  console.log('\n' + '='.repeat(60));
  console.log('Build Summary');
  console.log('='.repeat(60));
  console.log(`Total files:       ${files.length}`);
  console.log(`Built:             ${built}`);
  console.log(`Skipped (cached):  ${skipped}`);
  console.log(`Validation failed: ${validationFailed}`);
  console.log(`Build failed:      ${failed}`);
  console.log(`Elapsed:           ${elapsed}s`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => {
      console.log(`  ${e.file}`);
      console.log(`    -> ${e.reason}`);
    });
  }

  console.log('='.repeat(60));
  process.exit(failed + validationFailed > 0 ? 1 : 0);
}

if (require.main === module) main();
