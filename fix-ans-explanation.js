#!/usr/bin/env node
/**
 * fix-ans-explanation.js
 * Finds and fixes MC questions where ans doesn't match the correct answer
 * identified from the explanation section of det.analysis.
 *
 * Usage: node fix-ans-explanation.js [--fix] [--dir <path>]
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FIX_MODE = process.argv.includes('--fix');
const dirArg = process.argv.indexOf('--dir');
const TARGET_DIR = dirArg >= 0 ? process.argv[dirArg + 1] : 'data/부교재/수능특강/영어';

function findCorrectAnsFromExplanation(q) {
  const analysis = q.det && q.det.analysis ? q.det.analysis : '';
  const ch = q.ch || [];
  if (ch.length === 0) return null;

  const lines = analysis.split('\n');

  // Priority 1: explanation lines WITH colon (authoritative)
  // Pattern: "✅④ word: explanation" or "✅ ④ word: explanation"
  for (const line of lines) {
    if (!line.includes('✅')) continue;
    if (!line.includes(':')) continue;
    const match = line.match(/✅\s*[①②③④]?\s*(.+?):/);
    if (!match) continue;
    const word = match[1].trim().toLowerCase();
    if (!word || word.length < 2) continue;
    for (let i = 0; i < ch.length; i++) {
      const chLow = ch[i].toLowerCase().trim();
      if (chLow === word) return i + 1;
      if (word.length > 3 && word.startsWith(chLow)) return i + 1;
      if (chLow.length > 3 && word.startsWith(chLow)) return i + 1;
    }
  }

  // Priority 2: list lines WITHOUT colon
  // Pattern: "✅ ③ word" or "✅③word"
  for (const line of lines) {
    if (!line.includes('✅')) continue;
    if (line.includes(':')) continue;
    const stripped = line.replace(/✅\s*[①②③④]?\s*/, '').trim().toLowerCase();
    if (!stripped || stripped.length < 2) continue;
    for (let i = 0; i < ch.length; i++) {
      const chLow = ch[i].toLowerCase().trim();
      if (stripped === chLow) return i + 1;
      if (chLow.length > 3 && stripped.startsWith(chLow)) return i + 1;
    }
  }

  return null;
}

function processFile(filePath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { mismatches: [], errors: [e.message] };
  }

  const mismatches = [];
  for (const q of data.questions || []) {
    if (q.fmt !== 'mc') continue;
    if (!q.ans || !q.ch) continue;

    const expAns = findCorrectAnsFromExplanation(q);
    if (expAns !== null && expAns !== q.ans) {
      mismatches.push({
        qid: q.id,
        type: q.type,
        currentAns: q.ans,
        currentWord: q.ch[q.ans - 1],
        correctAns: expAns,
        correctWord: q.ch[expAns - 1],
      });
      if (FIX_MODE) {
        q.ans = expAns;
      }
    }
  }

  if (FIX_MODE && mismatches.length > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  return { mismatches };
}

// Collect all target JSON files
function collectFiles(dir) {
  const results = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d)) {
      const full = path.join(d, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (entry !== '_passages' && entry !== '_raw') walk(full);
      } else if (['단어.json', '워크북.json', '퀴즈.json'].includes(entry)) {
        results.push(full);
      }
    }
  }
  walk(path.join(ROOT, dir));
  return results.sort();
}

const files = collectFiles(TARGET_DIR);
let totalMismatches = 0;
let affectedFiles = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f);
  const { mismatches } = processFile(f);
  if (mismatches.length > 0) {
    affectedFiles++;
    totalMismatches += mismatches.length;
    for (const m of mismatches) {
      const status = FIX_MODE ? '[FIXED]' : '[MISMATCH]';
      console.log(`${status} ${rel} Q${m.qid} (${m.type}): ans=${m.currentAns}(${m.currentWord}) -> ${m.correctAns}(${m.correctWord})`);
    }
  }
}

console.log(`\n=== 요약 ===`);
console.log(`검사 파일: ${files.length} | 영향 파일: ${affectedFiles} | 총 불일치: ${totalMismatches}`);
if (!FIX_MODE && totalMismatches > 0) {
  console.log('수정하려면 --fix 옵션 추가');
}
