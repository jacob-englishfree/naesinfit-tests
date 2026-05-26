#!/usr/bin/env node
/**
 * sync-ch-passage.js
 * 어법 문항의 ch 배열을 passage의 <u>밑줄</u> 단어와 동기화
 *
 * SEM-3 에러 해소: DC-9 수정 후 passage 단어가 바뀌었는데
 * ch 배열에는 이전 단어가 남아있는 불일치 수정
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirs = args.filter(a => !a.startsWith('--'));

if (dirs.length === 0) {
  console.log('Usage: node sync-ch-passage.js <dir...> [--dry-run]');
  process.exit(1);
}

const MARKERS = ['①', '②', '③', '④'];

function collectFiles(p) {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    let result = [];
    for (const e of fs.readdirSync(p)) result = result.concat(collectFiles(path.join(p, e)));
    return result;
  }
  if (p.endsWith('단어.json') || p.endsWith('워크북.json') || p.endsWith('퀴즈.json')) return [p];
  return [];
}

function extractPassageWords(passage) {
  // Extract underlined words at each marker position
  const words = {};
  for (const m of MARKERS) {
    const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped + '<u>([^<]+)</u>');
    const match = passage.match(regex);
    if (match) {
      words[m] = match[1].trim();
    }
  }
  return words;
}

let totalFixed = 0;
let totalFilesModified = 0;
const fixes = [];

let fileList = [];
for (const d of dirs) fileList = fileList.concat(collectFiles(d));

for (const filePath of fileList) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  let modified = false;
  const rel = path.relative(process.cwd(), filePath);

  for (let qi = 0; qi < data.questions.length; qi++) {
    const q = data.questions[qi];
    if (q.type !== '어법' || !q.passage) continue;

    const passageWords = extractPassageWords(q.passage);
    if (Object.keys(passageWords).length === 0) continue;

    // Determine ch format
    const isMarkerOnly = q.ch.every(c => /^[①②③④]$/.test(c.trim()));
    if (isMarkerOnly) continue; // no word in ch, nothing to sync

    const newCh = [...q.ch];
    let changed = false;

    for (let i = 0; i < MARKERS.length; i++) {
      const m = MARKERS[i];
      const passageWord = passageWords[m];
      if (!passageWord) continue;

      const currentCh = q.ch[i];

      // Determine if ch[i] uses marker prefix
      const markerPrefix = currentCh.trim().startsWith(m);

      if (markerPrefix) {
        // ch format: "② word"
        const currentWord = currentCh.replace(m, '').trim();
        if (currentWord && currentWord !== passageWord) {
          newCh[i] = m + ' ' + passageWord;
          changed = true;
          fixes.push(`${rel} Q${qi+1} ch[${i}]: "${currentCh}" → "${newCh[i]}"`);
        }
      } else {
        // ch format: "word" (no marker prefix)
        if (currentCh.trim() !== passageWord) {
          newCh[i] = passageWord;
          changed = true;
          fixes.push(`${rel} Q${qi+1} ch[${i}]: "${currentCh}" → "${newCh[i]}"`);
        }
      }
    }

    if (changed) {
      if (!dryRun) {
        q.ch = newCh;
        modified = true;
      }
      totalFixed++;
    }
  }

  if (modified && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    totalFilesModified++;
  }
}

console.log('\n=== CH-Passage Sync Results ===');
console.log(`Questions fixed: ${totalFixed}`);
console.log(`Files modified: ${totalFilesModified}`);
console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLIED'}`);

if (fixes.length > 0) {
  console.log('\n--- Changes ---');
  for (const f of fixes) console.log('  ' + f);
}
