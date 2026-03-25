#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — extract-data.js
 * Extracts data (EI, FULL_PASSAGE, Q[]) from existing HTML test files into JSON.
 *
 * Usage: node scripts/extract-data.js 부교재/수능특강/영어/1강/단어테스트.html
 * Output: data/부교재/수능특강/영어/1강/단어.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function extractData(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');

  // ── Extract <script> block ──
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!scriptMatch) throw new Error('No <script> block found before </body>');
  const script = scriptMatch[1];

  // ── Determine testType from filename ──
  const basename = path.basename(htmlPath, '.html');
  let testType;
  if (basename.includes('단어')) testType = '단어';
  else if (basename.includes('워크북')) testType = '워크북';
  else if (basename.includes('퀴즈')) testType = '퀴즈';
  else throw new Error(`Cannot determine testType from filename: ${basename}`);

  // ── Extract EI ──
  const eiMatch = script.match(/const\s+EI\s*=\s*(\{[^;]+\});/);
  if (!eiMatch) throw new Error('EI object not found');
  let ei;
  try {
    ei = JSON.parse(eiMatch[1]);
  } catch (e) {
    // Try evaluating as JS object (single quotes etc)
    ei = evalJsObject(eiMatch[1]);
  }

  // ── Extract passage variables ──
  // Look for FULL_PASSAGE, P_GW, P_EX01, etc.
  const passageVars = {};
  const passageRegex = /const\s+(FULL_PASSAGE|P_\w+)\s*=\s*`([\s\S]*?)`;/g;
  let pm;
  while ((pm = passageRegex.exec(script)) !== null) {
    passageVars[pm[1]] = pm[2];
  }
  // Also check for single-quoted or double-quoted passages
  const passageRegex2 = /const\s+(FULL_PASSAGE|P_\w+)\s*=\s*"([\s\S]*?)";/g;
  while ((pm = passageRegex2.exec(script)) !== null) {
    passageVars[pm[1]] = pm[2].replace(/\\"/g, '"');
  }

  // Determine fullPassage — use FULL_PASSAGE or combine all P_ vars
  let fullPassage = passageVars['FULL_PASSAGE'] || '';
  if (!fullPassage) {
    // For 부교재 with multiple passage vars (P_GW, P_EX01, etc.), combine them
    const sortedKeys = Object.keys(passageVars).sort();
    if (sortedKeys.length > 0) {
      fullPassage = sortedKeys.map(k => passageVars[k]).join('\n\n');
    }
  }

  // ── Extract Q array ──
  // This is the trickiest part — Q array may reference passage variables
  const qMatch = script.match(/const\s+Q\s*=\s*\[([\s\S]*?)\];\s*\n/);
  if (!qMatch) throw new Error('Q array not found');
  let qRaw = qMatch[1];

  // Replace variable references in passage fields
  // Pattern: passage: FULL_PASSAGE or passage: P_GW
  Object.keys(passageVars).forEach(varName => {
    // Replace unquoted variable references
    const varRegex = new RegExp(`"passage":\\s*${varName}`, 'g');
    qRaw = qRaw.replace(varRegex, `"passage":${JSON.stringify(passageVars[varName])}`);
    // Also handle without quotes on key
    const varRegex2 = new RegExp(`passage:\\s*${varName}`, 'g');
    qRaw = qRaw.replace(varRegex2, `"passage":${JSON.stringify(passageVars[varName])}`);
  });

  // Fix JS object syntax → JSON
  // Handle: unquoted keys, single quotes, trailing commas, null → "null"
  let qJson = '[' + qRaw + ']';

  // Replace unquoted keys with quoted keys
  qJson = qJson.replace(/(\s|,|\[|\{)(\w+)\s*:/g, '$1"$2":');

  // Replace single quotes with double quotes (careful with content)
  // This is risky; better to try JSON.parse first and fall back
  let questions;
  try {
    questions = JSON.parse(qJson);
  } catch (e) {
    // Fall back: use a more lenient parser
    try {
      // Try evaluating in a sandboxed way
      questions = evalQArray(qRaw, passageVars);
    } catch (e2) {
      throw new Error(`Failed to parse Q array: ${e.message}\nFallback: ${e2.message}`);
    }
  }

  // ── Clean up questions ──
  questions = questions.map(q => {
    const clean = {
      id: q.id,
      type: q.type,
      diff: q.diff,
      pts: q.pts,
      fmt: q.fmt,
      passage: q.passage || '',
      stem: q.stem || '',
      det: q.det || { korean: '', analysis: '', tip: '' }
    };

    // Check if passage matches a known full passage — use __FULL__ marker
    if (clean.passage && fullPassage && clean.passage === fullPassage) {
      clean.passage = '__FULL__';
    }

    if (q.fmt === 'mc') {
      clean.ans = q.ans;
      clean.ch = q.ch;
    }
    if (q.fmt === 'written') {
      clean.wa = q.wa;
      clean.accept = q.accept || [q.wa];
    }

    // Copy optional fields
    if (q.sec) clean.sec = q.sec;

    return clean;
  });

  return {
    version: 1,
    testType,
    ei,
    fullPassage,
    questions
  };
}

function evalQArray(qRaw, passageVars) {
  // Create a simple evaluator that handles the Q array JS syntax
  // Define passage variables in scope
  let setup = '';
  Object.entries(passageVars).forEach(([k, v]) => {
    setup += `const ${k} = ${JSON.stringify(v)};\n`;
  });

  // Use Function constructor (safer than eval)
  const fn = new Function(setup + 'return [' + qRaw + '];');
  return fn();
}

function evalJsObject(str) {
  const fn = new Function('return ' + str + ';');
  return fn();
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/extract-data.js <html-file>');
    console.error('       node scripts/extract-data.js --all <directory>');
    process.exit(1);
  }

  if (args[0] === '--all') {
    const dir = path.resolve(args[1] || '.');
    const htmlFiles = findHtmlFiles(dir);
    console.log(`Found ${htmlFiles.length} HTML files`);
    let success = 0, fail = 0;
    htmlFiles.forEach(f => {
      try {
        processFile(f);
        success++;
      } catch (e) {
        fail++;
        console.error(`[FAIL] ${path.relative(ROOT, f)}: ${e.message}`);
      }
    });
    console.log(`\nDone: ${success} success, ${fail} fail`);
  } else {
    const htmlPath = path.resolve(args[0]);
    try {
      const outPath = processFile(htmlPath);
      console.log(`[OK] ${path.relative(ROOT, outPath)}`);
    } catch (e) {
      console.error(`[ERROR] ${e.message}`);
      process.exit(1);
    }
  }
}

function processFile(htmlPath) {
  const data = extractData(htmlPath);

  // Determine output path
  // Input:  부교재/수능특강/영어/1강/단어테스트.html
  // Output: data/부교재/수능특강/영어/1강/단어.json
  const relFromRoot = path.relative(ROOT, htmlPath);
  const parsed = path.parse(relFromRoot);

  // Remove "테스트" from filename
  let outName = parsed.name.replace('테스트', '');
  const outDir = path.join(ROOT, 'data', parsed.dir);
  const outPath = path.join(outDir, outName + '.json');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

  return outPath;
}

function findHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findHtmlFiles(full));
    } else if (entry.name.endsWith('테스트.html')) {
      results.push(full);
    }
  }
  return results;
}

module.exports = { extractData };

if (require.main === module) main();
