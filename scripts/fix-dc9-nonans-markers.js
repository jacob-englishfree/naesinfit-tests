#!/usr/bin/env node
/**
 * fix-dc9-nonans-markers.js
 * DC-9 수정: 어법 문항에서 오답 마커의 단어를 fullPassage 원문으로 복원
 *
 * 문제: 오답 마커 위치에 변형된 단어가 들어가 있으면
 *       학생이 해당 마커도 틀린 것으로 판단할 수 있음
 * 해결: fullPassage에서 해당 위치의 원문 단어를 찾아 복원
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirs = args.filter(a => !a.startsWith('--'));

if (dirs.length === 0) {
  console.log('Usage: node fix-dc9-nonans-markers.js <dir...> [--dry-run]');
  process.exit(1);
}

const MARKERS = ['①', '②', '③', '④'];

function collectFiles(p) {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    let result = [];
    for (const e of fs.readdirSync(p)) {
      result = result.concat(collectFiles(path.join(p, e)));
    }
    return result;
  }
  if (p.endsWith('단어.json') || p.endsWith('워크북.json') || p.endsWith('퀴즈.json')) {
    return [p];
  }
  return [];
}

function findOriginalWord(fp, passage, markerChar, currentWord) {
  // Strategy: find context words around the marker in passage,
  // then locate the same context in fullPassage to find original word

  const markerIdx = passage.indexOf(markerChar + '<u>');
  if (markerIdx < 0) return null;

  // Get words BEFORE the marker (last 3-5 words)
  const beforeText = passage.substring(0, markerIdx)
    .replace(/<[^>]+>/g, '')  // strip HTML
    .replace(/[①②③④]/g, '')  // strip other markers
    .trim();
  const beforeWords = beforeText.split(/\s+/).filter(w => w.length > 0);

  // Get words AFTER the marker
  const afterMarkerMatch = passage.substring(markerIdx).match(/<\/u>(.{0,100})/);
  const afterText = afterMarkerMatch ? afterMarkerMatch[1]
    .replace(/<[^>]+>/g, '')
    .replace(/[①②③④]/g, '')
    .trim() : '';
  const afterWords = afterText.split(/\s+/).filter(w => w.length > 0);

  // Try different context window sizes
  for (let windowSize = 4; windowSize >= 2; windowSize--) {
    const contextBefore = beforeWords.slice(-windowSize).join(' ');
    if (contextBefore.length < 5) continue;

    // Clean context for search (remove markers, tags)
    const cleanContext = contextBefore.replace(/[①②③④<>\/u]/g, '').trim();

    const fpIdx = fp.indexOf(cleanContext);
    if (fpIdx < 0) continue;

    // Found context! Now extract the word that follows in fullPassage
    const afterContextIdx = fpIdx + cleanContext.length;
    const remainingFP = fp.substring(afterContextIdx).trim();

    // The original word(s) should be at the start of remainingFP
    // Need to match word count of currentWord
    const currentWordCount = currentWord.split(/\s+/).length;
    const fpWords = remainingFP.split(/\s+/);

    // Take the same number of words
    let originalWord = fpWords.slice(0, currentWordCount).join(' ');

    // Also try taking one more or fewer words if they make more sense
    // Clean trailing punctuation if not in current word
    originalWord = originalWord.replace(/[,;:.]$/, '');

    if (originalWord && originalWord !== currentWord) {
      // Verify the after-context also matches
      const afterContext = afterWords.slice(0, 2).join(' ');
      if (afterContext.length > 3) {
        const checkStr = originalWord + ' ' + afterContext.substring(0, 10);
        // Loose check: afterContext words should appear near originalWord in fp
        const fpCheckIdx = fp.indexOf(originalWord, afterContextIdx - 5);
        if (fpCheckIdx >= 0) {
          return originalWord;
        }
      } else {
        return originalWord;
      }
    }
  }

  // Fallback: try searching for after-context too
  for (let bw = 3; bw >= 1; bw--) {
    for (let aw = 3; aw >= 1; aw--) {
      const ctxBefore = beforeWords.slice(-bw).join(' ');
      const ctxAfter = afterWords.slice(0, aw).join(' ');
      if (ctxBefore.length < 3 || ctxAfter.length < 3) continue;

      // Search fp for pattern: ctxBefore + SOMETHING + ctxAfter
      const escapedBefore = ctxBefore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedAfter = ctxAfter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedBefore + '\\s+(.+?)\\s+' + escapedAfter);
      const match = fp.match(regex);
      if (match) {
        const found = match[1].trim();
        if (found.split(/\s+/).length <= 4 && found !== currentWord) {
          return found;
        }
      }
    }
  }

  return null;
}

let totalFixed = 0;
let totalSkipped = 0;
let totalFiles = 0;
const fixes = [];

let fileList = [];
for (const d of dirs) {
  fileList = fileList.concat(collectFiles(d));
}

for (const filePath of fileList) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const fp = data.fullPassage;
  if (!fp) continue;

  let modified = false;

  for (const q of data.questions) {
    if (q.type !== '어법' || !q.passage) continue;

    for (let i = 0; i < MARKERS.length; i++) {
      if (i === q.ans - 1) continue; // skip answer

      const m = MARKERS[i];
      const regex = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<u>([^<]+)</u>');
      const match = q.passage.match(regex);
      if (!match) continue;

      const word = match[1].trim();
      if (fp.includes(word)) continue; // already correct

      // Try to find original word
      const original = findOriginalWord(fp, q.passage, m, word);

      if (original && fp.includes(original)) {
        const rel = path.relative(process.cwd(), filePath);
        const fixInfo = `${rel} | ${q.qn || 'Q?'} | ${m} | "${word}" → "${original}"`;
        fixes.push(fixInfo);

        if (!dryRun) {
          // Replace in passage
          const oldStr = m + '<u>' + word + '</u>';
          const newStr = m + '<u>' + original + '</u>';
          q.passage = q.passage.replace(oldStr, newStr);
          modified = true;
        }
        totalFixed++;
      } else {
        const rel = path.relative(process.cwd(), filePath);
        console.log(`[SKIP] ${rel} | ${q.qn || 'Q?'} | ${m} | "${word}" — original not found`);
        totalSkipped++;
      }
    }
  }

  if (modified && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    totalFiles++;
  }
}

console.log('\n=== DC-9 Fix Results ===');
console.log(`Fixed: ${totalFixed}`);
console.log(`Skipped: ${totalSkipped}`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLIED'}`);

if (fixes.length > 0) {
  console.log('\n--- Fixes ---');
  for (const f of fixes) {
    console.log('  ' + f);
  }
}
