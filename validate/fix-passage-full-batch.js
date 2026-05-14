#!/usr/bin/env node
/**
 * fix-passage-full-batch.js
 * Fix S-PASSAGE-NOT-FULL: replace excerpted passages with fullPassage + overlays
 * For mock test (모의고사) and supplement (부교재) files only
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const targetDir = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]) || 'data/모의고사';

const EXEMPT_TYPES = ['어형 변환', '영영풀이 매칭', '다의어 문맥적 의미', '오류찾기'];
// Type names may include suffixes like (서술형), so we do partial matching
function isExemptType(type) {
  return EXEMPT_TYPES.some(t => type.startsWith(t));
}
const MARKER_TYPES = ['어법', '문맥상 부적절한 어휘'];
const BLANK_TYPES = ['빈칸 어휘 완성', '빈칸 문맥 완성', '어순배열', '서술형 — 조건영작', '서술형 — 영작'];
const UNDERLINE_TYPES = ['동의어 고르기', '반의어 고르기', '함축의미 추론', '지칭추론'];

function findJsonFiles(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = dir + '/' + entry.name;
      if (entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'node_modules') {
        results = results.concat(findJsonFiles(rel));
      } else if (entry.name.match(/^(단어|워크북|퀴즈)\.json$/)) {
        results.push(rel);
      }
    }
  } catch(e) {}
  return results;
}

function applyMarkersToFullPassage(fullPassage, passage, type) {
  if (!fullPassage || !passage) return null;
  
  // Extract markers from current passage
  // Pattern: ①<u>word</u> or just ①word or <u>word</u>
  const markerRegex = /([①②③④⑤])(?:<u>([^<]+)<\/u>|(\S+))/g;
  const markers = [];
  let m;
  while ((m = markerRegex.exec(passage)) !== null) {
    markers.push({ marker: m[1], word: m[2] || m[3], full: m[0] });
  }
  
  // Extract blanks
  const blankRegex = /_{4,}/g;
  const blanks = [];
  while ((m = blankRegex.exec(passage)) !== null) {
    blanks.push({ blank: m[0], index: m.index });
  }
  
  // Extract underlines without markers
  const ulRegex = /<u>([^<]+)<\/u>/g;
  const underlines = [];
  while ((m = ulRegex.exec(passage)) !== null) {
    // Skip if already captured as marker
    if (!markers.some(mk => mk.word === m[1])) {
      underlines.push({ word: m[1], full: m[0] });
    }
  }
  
  // Extract (A)(B)(C) patterns
  const abcRegex = /\(([A-C])\)\s*\[([^\]]+)\]/g;
  const abcMarkers = [];
  while ((m = abcRegex.exec(passage)) !== null) {
    abcMarkers.push({ letter: m[1], content: m[2], full: m[0] });
  }
  
  // Extract insertion markers (①)(②)(③)(④)
  const insertionRegex = /\(([①②③④⑤])\)/g;
  const insertionMarkers = [];
  while ((m = insertionRegex.exec(passage)) !== null) {
    insertionMarkers.push({ marker: m[1], full: m[0] });
  }
  
  let result = fullPassage;
  
  // Apply markers (①<u>word</u>)
  if (markers.length > 0) {
    for (const mk of markers) {
      // Find the original word in fullPassage (without marker)
      const wordEscaped = mk.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Try to find the word with word boundary
      const wordRegex = new RegExp('(?<![①②③④⑤](?:<u>)?)' + wordEscaped + '(?!</u>)', 'g');
      let found = false;
      result = result.replace(wordRegex, (match, offset) => {
        if (found) return match; // Only replace first occurrence
        found = true;
        return mk.full;
      });
      if (!found) {
        // Word might be modified (e.g., "seeming" vs "seemed")
        // Try case-insensitive
        const wordRegexI = new RegExp('\\b' + wordEscaped + '\\b', 'i');
        const match = result.match(wordRegexI);
        if (match) {
          result = result.replace(match[0], mk.full);
        }
      }
    }
  }
  
  // Apply underlines
  if (underlines.length > 0) {
    for (const ul of underlines) {
      const wordEscaped = ul.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp('(?<!<u>)' + wordEscaped + '(?!</u>)');
      result = result.replace(wordRegex, ul.full);
    }
  }
  
  // Apply blanks - find the word at blank position in fullPassage
  if (blanks.length > 0 && BLANK_TYPES.includes(type)) {
    // For blank types, we need the overlay.blank or figure out what was blanked
    // The passage has ____ where fullPassage has the original word
    // Find the context around the blank in the passage
    for (const bl of blanks) {
      const beforeBlank = passage.substring(Math.max(0, bl.index - 30), bl.index).trim();
      const afterBlank = passage.substring(bl.index + bl.blank.length, bl.index + bl.blank.length + 30).trim();
      
      if (beforeBlank && afterBlank) {
        const beforeEscaped = beforeBlank.slice(-15).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const afterEscaped = afterBlank.slice(0, 15).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const contextRegex = new RegExp(beforeEscaped + '\\s+(\\S+(?:\\s+\\S+){0,3})\\s+' + afterEscaped);
        const contextMatch = fullPassage.match(contextRegex);
        if (contextMatch) {
          result = result.replace(contextMatch[1], bl.blank);
        }
      }
    }
  }
  
  return result;
}

function processFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  const raw = fs.readFileSync(absPath, 'utf8');
  const data = JSON.parse(raw);
  const fullPassage = data.fullPassage;
  if (!fullPassage) return { file: relPath, fixed: 0, skipped: 0 };
  
  let fixed = 0;
  let skipped = 0;
  
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (!q.passage) continue;
    
    const pLen = q.passage.length;
    const fpLen = fullPassage.length;
    
    // Skip if already >= 85%
    if (pLen >= fpLen * 0.85) continue;
    
    // Skip exempt types (partial match for suffixed types like '어형 변환 (서술형)')
    if (isExemptType(q.type)) {
      skipped++;
      continue;
    }
    
    // For types that don't modify passage, just use fullPassage directly
    const noOverlayTypes = ['내용이해 T/F', '내용 일치/불일치', '주제', '요지', '제목'];
    if (noOverlayTypes.includes(q.type)) {
      data.questions[i].passage = fullPassage;
      fixed++;
      continue;
    }
    
    // For 순서배열, passage structure is different (intro + ABC blocks), skip
    if (q.type === '순서배열') {
      skipped++;
      continue;
    }
    
    // For marker/underline/blank types, try to apply overlays to fullPassage
    const newPassage = applyMarkersToFullPassage(fullPassage, q.passage, q.type);
    if (newPassage && newPassage.length >= fpLen * 0.85) {
      data.questions[i].passage = newPassage;
      fixed++;
    } else {
      // Fallback: if passage has no special markers, just use fullPassage
      const hasSpecial = /[①②③④⑤]|<u>|_{4,}|\(A\)|\(B\)|\(C\)/.test(q.passage);
      if (!hasSpecial) {
        data.questions[i].passage = fullPassage;
        fixed++;
      } else {
        skipped++;
        console.log(`  SKIP Q${i+1} (${q.type}): could not auto-fix markers`);
      }
    }
  }
  
  if (fixed > 0 && !dryRun) {
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  
  return { file: relPath, fixed, skipped };
}

// Main
const files = findJsonFiles(targetDir);
let totalFixed = 0;
let totalSkipped = 0;
let filesModified = 0;

for (const f of files) {
  const result = processFile(f);
  if (result.fixed > 0) {
    console.log(`[FIX] ${f}: ${result.fixed} questions fixed, ${result.skipped} skipped`);
    totalFixed += result.fixed;
    filesModified++;
  }
  totalSkipped += result.skipped;
}

console.log(`\nTotal: ${filesModified} files, ${totalFixed} questions fixed, ${totalSkipped} skipped`);
if (dryRun) console.log('(DRY RUN - no files modified)');
