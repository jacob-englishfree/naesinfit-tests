#!/usr/bin/env node
/**
 * fix-dc9-v2.js — DC-9 수정 v2
 * 어법 오답 마커의 단어를 fullPassage 원문으로 복원
 *
 * 매칭 전략: passage의 마커 전후 문맥을 fullPassage에서 찾아
 * 원문 단어를 정확히 추출
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const dirs = args.filter(a => !a.startsWith('--'));

if (dirs.length === 0) {
  console.log('Usage: node fix-dc9-v2.js <dir...> [--dry-run] [--verbose]');
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

/**
 * Strip all HTML tags and marker symbols from text
 */
function stripAll(text) {
  return text.replace(/<[^>]+>/g, '').replace(/[①②③④]/g, '').trim();
}

/**
 * Find the original word at a marker position by using AFTER-context matching.
 *
 * Strategy:
 * 1. From passage, extract text AFTER the underlined word (afterCtx)
 * 2. From passage, extract text BEFORE the marker (beforeCtx)
 * 3. Find both contexts in fullPassage
 * 4. The original word is between beforeCtx and afterCtx in fullPassage
 */
function findOriginalWord(fp, passage, markerChar, currentWord) {
  const markerPattern = markerChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fullMatch = passage.match(new RegExp(markerPattern + '<u>([^<]+)</u>'));
  if (!fullMatch) return null;

  const matchIdx = fullMatch.index;
  const fullMatchStr = fullMatch[0];
  const afterMatchIdx = matchIdx + fullMatchStr.length;

  // Get BEFORE text (strip HTML/markers, take last N words)
  const beforeRaw = passage.substring(0, matchIdx);
  const beforeClean = stripAll(beforeRaw);
  const beforeWords = beforeClean.split(/\s+/).filter(w => w.length > 0);

  // Get AFTER text (strip HTML/markers, take first N words)
  const afterRaw = passage.substring(afterMatchIdx);
  const afterClean = stripAll(afterRaw);
  const afterWords = afterClean.split(/\s+/).filter(w => w.length > 0);

  // Try matching with different context window sizes
  // Best strategy: use AFTER context to anchor, then walk backward
  for (let aw = Math.min(5, afterWords.length); aw >= 2; aw--) {
    const afterCtx = afterWords.slice(0, aw).join(' ');

    for (let bw = Math.min(5, beforeWords.length); bw >= 2; bw--) {
      const beforeCtx = beforeWords.slice(-bw).join(' ');

      // Find "beforeCtx ... afterCtx" in fullPassage
      const escapedBefore = beforeCtx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedAfter = afterCtx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Allow 1-10 words between before and after contexts
      const regex = new RegExp(escapedBefore + '\\s+(.{1,80}?)\\s+' + escapedAfter);
      const match = fp.match(regex);

      if (match) {
        const candidate = match[1].trim();
        // Sanity: should be 1-5 words, not a whole paragraph
        if (candidate.split(/\s+/).length <= 5 && candidate.length < 60) {
          if (candidate !== currentWord) {
            return candidate;
          }
          // If same as current word, it's actually fine (false positive in DC-9)
          return null;
        }
      }
    }
  }

  // Fallback: try case-insensitive search
  if (fp.toLowerCase().includes(currentWord.toLowerCase())) {
    // Find the exact form in fp
    const ciRegex = new RegExp(currentWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const ciMatch = fp.match(ciRegex);
    if (ciMatch && ciMatch[0] !== currentWord) {
      return ciMatch[0]; // case difference only
    }
    return null; // word exists in fp (case insensitive) — probably false positive
  }

  return null;
}

let fileList = [];
for (const d of dirs) fileList = fileList.concat(collectFiles(d));

let totalFixed = 0;
let totalSkipped = 0;
let totalCaseOnly = 0;
let totalFilesModified = 0;
const fixes = [];
const skips = [];

for (const filePath of fileList) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const fp = data.fullPassage;
  if (!fp) continue;

  let modified = false;
  const rel = path.relative(process.cwd(), filePath);

  for (let qi = 0; qi < data.questions.length; qi++) {
    const q = data.questions[qi];
    if (q.type !== '어법' || !q.passage) continue;

    for (let i = 0; i < MARKERS.length; i++) {
      if (i === q.ans - 1) continue; // skip answer position

      const m = MARKERS[i];
      const regex = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<u>([^<]+)</u>');
      const match = q.passage.match(regex);
      if (!match) continue;

      const word = match[1].trim();
      if (fp.includes(word)) continue; // word exists in fp — OK

      const original = findOriginalWord(fp, q.passage, m, word);

      if (original && fp.includes(original)) {
        const isCaseOnly = original.toLowerCase() === word.toLowerCase();
        const tag = isCaseOnly ? '[CASE]' : '[FORM]';
        const fixInfo = `${tag} ${rel} Q${qi+1} ${m}: "${word}" → "${original}"`;
        fixes.push(fixInfo);

        if (isCaseOnly) totalCaseOnly++;

        if (!dryRun) {
          const oldStr = m + '<u>' + word + '</u>';
          const newStr = m + '<u>' + original + '</u>';
          q.passage = q.passage.replace(oldStr, newStr);
          modified = true;
        }
        totalFixed++;
      } else {
        const skipInfo = `${rel} Q${qi+1} ${m}: "${word}" — no match found`;
        skips.push(skipInfo);
        totalSkipped++;
      }
    }
  }

  if (modified && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    totalFilesModified++;
  }
}

console.log('\n=== DC-9 Fix v2 Results ===');
console.log(`Fixed: ${totalFixed} (case-only: ${totalCaseOnly}, form: ${totalFixed - totalCaseOnly})`);
console.log(`Skipped: ${totalSkipped}`);
console.log(`Files modified: ${totalFilesModified}`);
console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLIED'}`);

if (fixes.length > 0) {
  console.log('\n--- Fixes ---');
  for (const f of fixes) console.log('  ' + f);
}
if (skips.length > 0) {
  console.log('\n--- Skipped ---');
  for (const s of skips) console.log('  ' + s);
}
