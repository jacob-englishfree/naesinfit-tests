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
  // Try strict match first, then fallback to last <script> block
  let scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!scriptMatch) {
    // Fallback: find the last <script>...</script> block
    const allScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    if (allScripts.length > 0) scriptMatch = allScripts[allScripts.length - 1];
  }
  if (!scriptMatch) {
    // Last resort: find <script> without closing tag (broken HTML)
    const lastScript = html.lastIndexOf('<script>');
    if (lastScript !== -1) {
      const content = html.substring(lastScript + 8);
      scriptMatch = [null, content];
    }
  }
  if (!scriptMatch) throw new Error('No <script> block found');
  const script = scriptMatch[1];

  // ── Determine testType from filename ──
  const basename = path.basename(htmlPath, '.html');
  let testType;
  if (basename.includes('단어')) testType = '단어';
  else if (basename.includes('워크북')) testType = '워크북';
  else if (basename.includes('퀴즈')) testType = '퀴즈';
  else throw new Error(`Cannot determine testType from filename: ${basename}`);

  // ── Extract EI ──
  const eiMatch = script.match(/(?:const|let|var)\s+EI\s*=\s*(\{[^;]+\});/);
  if (!eiMatch) throw new Error('EI object not found');
  let ei;
  try {
    ei = JSON.parse(eiMatch[1]);
  } catch (e) {
    // Try evaluating as JS object (single quotes etc)
    ei = evalJsObject(eiMatch[1]);
  }
  // Normalize EI defaults
  if (!ei.totalQ) ei.totalQ = 20;
  if (!ei.total) ei.total = 100;
  if (!ei.time) ei.time = 1200;

  // ── Extract passage variables ──
  // Extract ALL uppercase const/let/var string declarations before Q array.
  // Variable names can be: FULL_PASSAGE, P_GW, P1, DL, RC, L1, T2, etc.
  const passageVars = {};
  let pm;
  // Backtick-quoted
  const passageRegex = /(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*`([\s\S]*?)`;/g;
  while ((pm = passageRegex.exec(script)) !== null) {
    if (pm[1] === 'EI') continue; // Skip EI object
    passageVars[pm[1]] = pm[2];
  }
  // Double-quoted
  const passageRegex2 = /(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*"([\s\S]*?)";/g;
  while ((pm = passageRegex2.exec(script)) !== null) {
    if (pm[1] === 'EI') continue;
    passageVars[pm[1]] = pm[2].replace(/\\"/g, '"');
  }
  // Single-quoted
  const passageRegex3 = /(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*'([\s\S]*?)';/g;
  while ((pm = passageRegex3.exec(script)) !== null) {
    if (pm[1] === 'EI') continue;
    passageVars[pm[1]] = pm[2].replace(/\\'/g, "'");
  }

  // Determine fullPassage — use FULL_PASSAGE or combine all P_ vars
  let fullPassage = passageVars['FULL_PASSAGE'] || '';
  if (!fullPassage) {
    // For 부교재 with multiple passage vars (P_GW, P_EX01, etc.), combine them
    const sortedKeys = Object.keys(passageVars).filter(k => k !== 'EI').sort();
    if (sortedKeys.length > 0) {
      fullPassage = sortedKeys.map(k => passageVars[k]).join('\n\n');
    }
  }

  // ── Extract Q array using bracket-counting ──
  let qRaw = extractQArray(script);

  // Replace curly/smart quotes with straight quotes
  qRaw = qRaw.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // Fix literal newlines inside JSON double-quoted string values (should be \\n)
  // Only apply to files that use JSON-style double-quoted strings (not backtick JS)
  if (!qRaw.includes('`')) {
    qRaw = fixLiteralNewlines(qRaw);
  }

  // ── Parse Q array ──
  let questions;
  questions = parseQRaw(qRaw, passageVars);

  // ── Clean up questions ──
  questions = questions.map(q => {
    // Normalize det object
    let det = { korean: '', analysis: '', tip: '' };
    if (q.det) {
      if (q.det.korean) {
        // New format — use as-is
        det = {
          korean: q.det.korean || '',
          analysis: q.det.analysis || '',
          tip: q.det.tip || ''
        };
      } else if (q.det.ref) {
        // Old format (det:{ref:"[원문]...[해석]..."}) — convert
        const refText = q.det.ref || '';
        const koreanMatch = refText.match(/\[해석\]\s*(.*?)(?:\s*\[|$)/s);
        const sourceMatch = refText.match(/\[원문\]\s*(.*?)(?:\s*\[|$)/s);
        det.korean = koreanMatch ? koreanMatch[1].trim() : refText;
        det.analysis = sourceMatch ? `원문: ${sourceMatch[1].trim()}` : '';
        det.tip = '';
      }
    }

    const clean = {
      id: q.id,
      type: q.type,
      diff: q.diff,
      pts: q.pts,
      fmt: q.fmt,
      passage: q.passage || '',
      stem: q.stem || '',
      det
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

  // ── Fallback fullPassage: derive from question passages if still empty ──
  if (!fullPassage || fullPassage.length < 10) {
    // Find the longest passage among all questions
    const passages = questions.map(q => q.passage || '').filter(p => p.length > 50);
    if (passages.length > 0) {
      // Use the longest passage as fullPassage
      fullPassage = passages.reduce((a, b) => a.length >= b.length ? a : b, '');
    }
  }

  return {
    version: 1,
    testType,
    ei,
    fullPassage,
    questions
  };
}

/**
 * Extract Q array content using naive bracket-counting.
 * Brackets inside strings are empirically always balanced in our HTML files,
 * so we don't need to track string boundaries (which is error-prone with
 * mixed backtick/single/double quotes).
 */
function extractQArray(script) {
  const marker = script.match(/(?:const|let|var)\s+Q\s*=\s*\[/);
  if (!marker) throw new Error('Q array not found');

  const startIdx = marker.index + marker[0].length; // right after opening [
  let depth = 1;

  for (let i = startIdx; i < script.length; i++) {
    if (script[i] === '[') depth++;
    else if (script[i] === ']') {
      depth--;
      if (depth === 0) {
        return script.substring(startIdx, i);
      }
    }
  }

  throw new Error('Unmatched brackets in Q array');
}

/**
 * Try multiple strategies to parse the Q array raw text.
 */
function parseQRaw(qRaw, passageVars) {
  const strategies = [
    // 1. Direct eval
    () => evalQArray(qRaw, passageVars),
    // 2. Fix single quotes → backticks, then eval
    () => evalQArray(fixSingleQuotes(qRaw), passageVars),
    // 3. Repair corrupted fields, then eval
    () => evalQArray(repairCorruptedFields(qRaw), passageVars),
    // 4. Fix single quotes + repair, then eval
    () => evalQArray(fixSingleQuotes(repairCorruptedFields(qRaw)), passageVars),
    // 5. Fix bare double quotes in JSON strings, then eval
    () => evalQArray(fixBareDoubleQuotes(qRaw), passageVars),
    // 6. Fix bare double quotes + repair, then eval
    () => evalQArray(fixBareDoubleQuotes(repairCorruptedFields(qRaw)), passageVars),
    // 7. JSON parse with cleanup
    () => parseQArrayAsJson(qRaw, passageVars),
    // 8. JSON parse on repaired text
    () => parseQArrayAsJson(repairCorruptedFields(qRaw), passageVars),
    // 9. Extract individual questions one-by-one
    () => extractQuestionsIndividually(qRaw, passageVars),
  ];

  const errors = [];
  for (let i = 0; i < strategies.length; i++) {
    try {
      return strategies[i]();
    } catch (e) {
      errors.push(`  strategy${i + 1}: ${e.message}`);
    }
  }
  throw new Error(`Failed to parse Q array (${strategies.length} strategies failed).\n${errors.join('\n')}`);
}

/**
 * Convert single-quoted strings to backtick strings to avoid unescaped
 * apostrophe issues (e.g., "can't", "artist's" inside '...' strings).
 *
 * Skips backtick-quoted and double-quoted strings.
 */
function fixSingleQuotes(qRaw) {
  let result = '';
  let i = 0;
  while (i < qRaw.length) {
    const c = qRaw[i];

    // Skip double-quoted strings
    if (c === '"') {
      let j = i + 1;
      while (j < qRaw.length && qRaw[j] !== '"') {
        if (qRaw[j] === '\\') j++;
        j++;
      }
      result += qRaw.substring(i, j + 1);
      i = j + 1;
      continue;
    }

    // Skip backtick strings
    if (c === '`') {
      let j = i + 1;
      while (j < qRaw.length && qRaw[j] !== '`') {
        if (qRaw[j] === '\\') j++;
        j++;
      }
      result += qRaw.substring(i, j + 1);
      i = j + 1;
      continue;
    }

    // Convert single-quoted strings to backtick strings
    if (c === "'") {
      let j = i + 1;
      let content = '';
      while (j < qRaw.length) {
        if (qRaw[j] === '\\' && j + 1 < qRaw.length) {
          content += qRaw[j] + qRaw[j + 1];
          j += 2;
          continue;
        }
        if (qRaw[j] === "'") {
          // Is this a closing quote or an apostrophe?
          const after = qRaw[j + 1];
          if (!after || ',}]\n :'.includes(after)) {
            break; // closing quote
          } else {
            content += "'"; // apostrophe
            j++;
            continue;
          }
        }
        // Escape backticks inside the content
        if (qRaw[j] === '`') {
          content += '\\`';
        } else {
          content += qRaw[j];
        }
        j++;
      }
      result += '`' + content + '`';
      i = j + 1;
      continue;
    }

    result += c;
    i++;
  }
  return result;
}

/**
 * Fix unescaped double quotes inside double-quoted JSON string values.
 * E.g., "no theory of "active" democracy" → "no theory of \"active\" democracy"
 *
 * Strategy: scan through double-quoted strings. When a " is followed by a
 * non-structural character (not , } ] : space newline), it's an unescaped
 * inner quote — escape it with backslash.
 */
function fixBareDoubleQuotes(qRaw) {
  let result = '';
  let i = 0;
  while (i < qRaw.length) {
    const c = qRaw[i];

    // Skip backtick strings
    if (c === '`') {
      let j = i + 1;
      while (j < qRaw.length && qRaw[j] !== '`') {
        if (qRaw[j] === '\\') j++;
        j++;
      }
      result += qRaw.substring(i, j + 1);
      i = j + 1;
      continue;
    }

    // Skip single-quoted strings
    if (c === "'") {
      let j = i + 1;
      while (j < qRaw.length && qRaw[j] !== "'") {
        if (qRaw[j] === '\\') j++;
        j++;
      }
      result += qRaw.substring(i, j + 1);
      i = j + 1;
      continue;
    }

    // Process double-quoted strings
    if (c === '"') {
      result += '"';
      let j = i + 1;
      while (j < qRaw.length) {
        if (qRaw[j] === '\\' && j + 1 < qRaw.length) {
          result += qRaw[j] + qRaw[j + 1];
          j += 2;
          continue;
        }
        if (qRaw[j] === '"') {
          // Is this the real closing quote?
          // In valid JSON, closing " is followed by , } ] : or whitespace before structural char
          const after = qRaw[j + 1];
          if (!after || ',}]:'.includes(after)) {
            result += '"'; // definitely closing quote
            j++;
            break;
          }
          // Check for whitespace followed by structural char (e.g., " , or " })
          if (' \n\r\t'.includes(after)) {
            // Look ahead past whitespace for structural char
            let k = j + 1;
            while (k < qRaw.length && ' \n\r\t'.includes(qRaw[k])) k++;
            if (!qRaw[k] || ',}]:'.includes(qRaw[k])) {
              result += '"'; // closing quote with trailing whitespace
              j++;
              break;
            }
          }
          // Unescaped inner quote — escape it
          result += '\\"';
          j++;
          continue;
        }
        result += qRaw[j];
        j++;
      }
      i = j;
      continue;
    }

    // Skip comments
    if (c === '/' && i + 1 < qRaw.length && qRaw[i + 1] === '/') {
      const eol = qRaw.indexOf('\n', i);
      const end = eol === -1 ? qRaw.length : eol;
      result += qRaw.substring(i, end);
      i = end;
      continue;
    }

    result += c;
    i++;
  }
  return result;
}

/**
 * Repair corrupted field boundaries in Q array text.
 *
 * Known corruption pattern (고2/3월 files):
 *   ch:[...,`해당 사항 없음`]TEXTCONTENT`,
 * Should be:
 *   ch:[...,`해당 사항 없음`],passage:`TEXTCONTENT`,  (or stem:`)
 *
 * The corruption removes `,fieldname:`  (and sometimes `<`) after ch's closing `]`.
 */
function repairCorruptedFields(qRaw) {
  // Pattern: backtick + ] followed by text that's not a separator
  // `]X where X is not , } ] ; whitespace
  return qRaw.replace(/`\]([^,}\];\s\n])/g, (match, nextChar, offset) => {
    // Determine which field was lost by looking ahead for stem:
    const ahead = qRaw.substring(offset, offset + 500);
    const hasStemAhead = /,\s*\n?\s*stem\s*:/.test(ahead);

    if (hasStemAhead) {
      // stem exists later → the corrupted field is passage
      // Check if a `<` was also lost (HTML content)
      if ('buisBUIS'.includes(nextChar)) {
        return '`],passage:`<' + nextChar;
      }
      return '`],passage:`' + nextChar;
    } else {
      // No stem ahead → the corrupted field is stem
      if ('buisBUIS'.includes(nextChar)) {
        return '`],stem:`<' + nextChar;
      }
      return '`],stem:`' + nextChar;
    }
  });
}

function evalQArray(qRaw, passageVars) {
  // Define passage variables in scope
  let setup = '';
  Object.entries(passageVars).forEach(([k, v]) => {
    setup += `const ${k} = ${JSON.stringify(v)};\n`;
  });

  // Also find referenced but undefined passage variables and define them as empty
  const definedVars = new Set(Object.keys(passageVars));
  const refPattern = /(?:passage|"passage")\s*:\s*([A-Z][A-Z0-9_]*)/g;
  let rm;
  while ((rm = refPattern.exec(qRaw)) !== null) {
    if (!definedVars.has(rm[1])) {
      setup += `const ${rm[1]} = "";\n`;
      definedVars.add(rm[1]);
    }
  }

  // Use Function constructor (handles backticks, single quotes, comments, undefined, etc.)
  const code = setup + 'return [' + qRaw + '];';
  const fn = new Function(code);
  return fn();
}

function parseQArrayAsJson(qRaw, passageVars) {
  // Remove JS comments
  let cleaned = qRaw
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Replace variable references in passage fields
  Object.keys(passageVars).forEach(varName => {
    const varRegex = new RegExp(`(?:"passage"|passage):\\s*${varName}(?=[,\\s}])`, 'g');
    cleaned = cleaned.replace(varRegex, `"passage":${JSON.stringify(passageVars[varName])}`);
  });

  // Replace undefined with null
  cleaned = cleaned.replace(/:\s*undefined\b/g, ':null');

  // Replace backtick strings with double-quoted strings
  cleaned = cleaned.replace(/`([^`]*)`/g, (match, content) => {
    return JSON.stringify(content);
  });

  // Replace single-quoted strings with double-quoted strings
  // Match single-quoted strings that aren't inside double quotes
  cleaned = cleaned.replace(/'((?:[^'\\]|\\.)*)'/g, (match, content) => {
    return JSON.stringify(content.replace(/\\'/g, "'"));
  });

  let qJson = '[' + cleaned + ']';

  // Quote unquoted keys
  qJson = qJson.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

  // Remove trailing commas before } or ]
  qJson = qJson.replace(/,\s*([\]}])/g, '$1');

  return JSON.parse(qJson);
}

/**
 * Extract questions individually by finding each {id:N,...}} block
 * and parsing them one by one. Handles severely corrupted files.
 */
function extractQuestionsIndividually(qRaw, passageVars) {
  // Build setup for passage variables
  let setup = '';
  const definedVars = new Set();
  Object.entries(passageVars).forEach(([k, v]) => {
    setup += `const ${k} = ${JSON.stringify(v)};\n`;
    definedVars.add(k);
  });
  // Add undefined variable stubs
  const refPattern = /(?:passage|"passage")\s*:\s*([A-Z][A-Z0-9_]*)/g;
  let rm;
  while ((rm = refPattern.exec(qRaw)) !== null) {
    if (!definedVars.has(rm[1])) {
      setup += `const ${rm[1]} = "";\n`;
      definedVars.add(rm[1]);
    }
  }

  // Find individual question objects using {id: pattern
  const questions = [];
  const idPattern = /\{id\s*:\s*(\d+)/g;
  let match;
  const idPositions = [];
  while ((match = idPattern.exec(qRaw)) !== null) {
    idPositions.push({ id: parseInt(match[1]), pos: match.index });
  }

  for (let idx = 0; idx < idPositions.length; idx++) {
    const start = idPositions[idx].pos;
    const end = idx + 1 < idPositions.length ? idPositions[idx + 1].pos : qRaw.length;
    let objText = qRaw.substring(start, end).replace(/,\s*$/, ''); // Remove trailing comma

    // Try multiple parse strategies for individual question
    let q = null;
    const strategies = [
      () => new Function(setup + 'return (' + objText + ')')(),
      () => new Function(setup + 'return (' + fixSingleQuotes(objText) + ')')(),
      () => new Function(setup + 'return (' + fixBareDoubleQuotes(objText) + ')')(),
      () => new Function(setup + 'return (' + repairCorruptedFields(objText) + ')')(),
      () => new Function(setup + 'return (' + fixSingleQuotes(repairCorruptedFields(objText)) + ')')(),
      () => new Function(setup + 'return (' + fixBareDoubleQuotes(repairCorruptedFields(objText)) + ')')(),
    ];

    for (const strat of strategies) {
      try {
        q = strat();
        break;
      } catch (e) {
        // Try next strategy
      }
    }

    if (q && typeof q === 'object' && q.id) {
      questions.push(q);
    }
    // If all strategies fail for this question, skip it but continue
  }

  if (questions.length === 0) {
    throw new Error('Could not extract any questions individually');
  }

  return questions;
}

/**
 * Fix literal newlines inside JSON double-quoted string values.
 * Scans through double-quoted strings and replaces actual \n with \\n.
 */
function fixLiteralNewlines(text) {
  let result = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    // Skip backtick strings
    if (c === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== '`') {
        if (text[j] === '\\') j++;
        j++;
      }
      result += text.substring(i, j + 1);
      i = j + 1;
      continue;
    }
    // Process double-quoted strings
    if (c === '"') {
      result += '"';
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\' && j + 1 < text.length) {
          result += text[j] + text[j + 1];
          j += 2;
          continue;
        }
        if (text[j] === '"') {
          result += '"';
          j++;
          break;
        }
        if (text[j] === '\n') {
          result += '\\n';
          j++;
          continue;
        }
        if (text[j] === '\r') {
          j++;
          continue;
        }
        result += text[j];
        j++;
      }
      i = j;
      continue;
    }
    result += c;
    i++;
  }
  return result;
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
    const failures = [];
    htmlFiles.forEach(f => {
      try {
        processFile(f);
        success++;
      } catch (e) {
        fail++;
        const msg = `[FAIL] ${path.relative(ROOT, f)}: ${e.message}`;
        failures.push(msg);
        console.error(msg);
      }
    });
    console.log(`\nDone: ${success} success, ${fail} fail`);
    if (failures.length > 0) {
      console.log('\n--- All failures ---');
      failures.forEach(f => console.log(f));
    }
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
