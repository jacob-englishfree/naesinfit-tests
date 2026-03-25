#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — watch.js
 * Watches data/ directory. When a JSON file changes:
 * 1. Auto-validate
 * 2. Auto-build if valid
 * 3. Show result
 *
 * Usage: node scripts/watch.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const VALIDATE_PATH = path.join(ROOT, 'validate', 'validate.js');
const BUILD_PATH = path.join(ROOT, 'engine', 'build.js');

// Debounce map to avoid duplicate triggers
const debounceMap = new Map();
const DEBOUNCE_MS = 500;

function timestamp() {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

function handleChange(filePath) {
  if (!filePath.endsWith('.json')) return;

  // Debounce
  const existing = debounceMap.get(filePath);
  if (existing) clearTimeout(existing);

  debounceMap.set(filePath, setTimeout(() => {
    debounceMap.delete(filePath);
    processFile(filePath);
  }, DEBOUNCE_MS));
}

function processFile(jsonFile) {
  const rel = path.relative(ROOT, jsonFile);

  if (!fs.existsSync(jsonFile)) {
    console.log(`[${timestamp()}] [DELETE] ${rel}`);
    return;
  }

  console.log(`\n[${timestamp()}] [CHANGE] ${rel}`);

  // Step 1: Validate
  try {
    const { validate } = require(VALIDATE_PATH);
    // Clear require cache so we always use latest validate.js
    delete require.cache[require.resolve(VALIDATE_PATH)];

    const result = validate(jsonFile);
    if (!result.pass) {
      console.log(`  [VALIDATE] FAIL (${result.errors.length} errors)`);
      result.errors.forEach(e => console.log(`    [${e.sev}] ${e.id}: ${e.msg}`));
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => console.log(`    [${w.sev}] ${w.id}: ${w.msg}`));
      }
      return;
    }

    const warnCount = result.warnings.length;
    if (warnCount > 0) {
      console.log(`  [VALIDATE] PASS (${warnCount} warnings)`);
      result.warnings.forEach(w => console.log(`    [${w.sev}] ${w.id}: ${w.msg}`));
    } else {
      console.log('  [VALIDATE] PASS');
    }
  } catch (e) {
    console.log(`  [VALIDATE] ERROR: ${e.message}`);
    return;
  }

  // Step 2: Build
  try {
    const output = execFileSync(process.execPath, [BUILD_PATH, jsonFile], {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 30000
    }).toString().trim();

    console.log(`  [BUILD] OK`);
    if (output) {
      output.split('\n').forEach(line => console.log(`    ${line}`));
    }
  } catch (e) {
    const errMsg = (e.stderr || '').toString().trim();
    console.log(`  [BUILD] FAIL`);
    if (errMsg) {
      errMsg.split('\n').forEach(line => console.log(`    ${line}`));
    }
  }
}

function watchRecursive(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`[ERROR] Directory not found: ${dir}`);
    process.exit(1);
  }

  // Use fs.watch with recursive option (supported on macOS and Windows)
  try {
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const fullPath = path.join(dir, filename);
      handleChange(fullPath);
    });
  } catch (e) {
    // Fallback: watch individual directories
    console.log('  (Using fallback directory watcher)');
    watchDir(dir);
  }
}

function watchDir(dir) {
  fs.watch(dir, (eventType, filename) => {
    if (!filename) return;
    const fullPath = path.join(dir, filename);
    handleChange(fullPath);
  });

  // Watch subdirectories
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      watchDir(path.join(dir, entry.name));
    }
  }
}

function main() {
  console.log('='.repeat(50));
  console.log('NaesinFit Test Pipeline — Watch Mode');
  console.log('='.repeat(50));
  console.log(`Watching: ${DATA_DIR}`);
  console.log(`Validate: ${path.relative(ROOT, VALIDATE_PATH)}`);
  console.log(`Build:    ${path.relative(ROOT, BUILD_PATH)}`);
  console.log('');
  console.log('Waiting for changes... (Ctrl+C to stop)');
  console.log('');

  watchRecursive(DATA_DIR);

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nWatch stopped.');
    process.exit(0);
  });
}

if (require.main === module) main();
