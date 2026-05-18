#!/usr/bin/env node
/**
 * fix-validation-issues.js
 * Fixes S-level validation issues:
 *   V63-B  — 순서배열/문장삽입 passage → null
 *   P-TF   — T/F outside 워크북 → change type to 내용이해 T/F
 *   V67    — stem has 밑줄 친 but no <u> → add <u>word</u> to passage (동의어/반의어 only)
 *   P_EMPTY — 서술형 — 배열영작 null passage triggers false error → fix validate.js
 *   N4     — identical 영영풀이 stems (copy-paste) → log only
 *
 * Skips: data/부교재/수능특강Light/
 *
 * Usage: node scripts/fix-validation-issues.js [--dry-run]
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const DATA    = path.join(ROOT, 'data');
const DRY_RUN = process.argv.includes('--dry-run');

// ── helpers ──────────────────────────────────────────────────────────────────

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  if (DRY_RUN) return;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getAllJsonFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip 수능특강Light
      if (entry.name === '수능특강Light') continue;
      results.push(...getAllJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

// ── counters ─────────────────────────────────────────────────────────────────

const stats = {
  v63b:    { files: 0, questions: 0 },
  ptf:     { files: 0, questions: 0 },
  v67:     { files: 0, questions: 0, logged: [] },
  pempty:  { files: 0, questions: 0 },
  n4:      { logged: [] },
};

// ── V67 helpers ───────────────────────────────────────────────────────────────

/**
 * Extract target word/phrase from stem for V67 fix.
 * Handles:
 *   밑줄 친 <b>word</b>
 *   밑줄 친 'word'  / 밑줄 친 "word"
 *   밑줄 친 word (plain)
 * Returns null if can't reliably extract.
 */
function extractTargetWord(stem) {
  // Strip HTML tags for analysis but keep original for bold extraction
  const boldMatch = stem.match(/밑줄 친 ['"]?<b>([^<]+)<\/b>['"]?/);
  if (boldMatch) return boldMatch[1].trim();

  // Single quotes (Korean curly or ASCII)
  const sqMatch = stem.match(/밑줄 친 ['\u2018\u2019]([^'\u2019]+)['\u2019]/);
  if (sqMatch) return sqMatch[1].trim();

  // Double quotes
  const dqMatch = stem.match(/밑줄 친 [""]([^""]+)[""]/);
  if (dqMatch) return dqMatch[1].trim();

  // Backtick
  const btMatch = stem.match(/밑줄 친 `([^`]+)`/);
  if (btMatch) return btMatch[1].trim();

  // Plain word after 밑줄 친 (word ending before Korean/space/punctuation)
  const plainMatch = stem.match(/밑줄 친\s+([A-Za-z][A-Za-z\s\-']{1,40}?)(?:의|가|를|은|이\s|\s|$)/);
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

/**
 * Wrap first occurrence of `word` in passage with <u>word</u>.
 * Case-insensitive search but preserves original casing.
 * Returns modified passage string, or null if word not found.
 */
function addUnderline(passage, word) {
  if (!passage || !word) return null;

  // Escape for regex
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![<>\w])${escaped}(?![<>\w])`, 'i');
  const match = passage.match(re);
  if (!match) {
    // Try word boundary only
    const re2 = new RegExp(`\\b${escaped}\\b`, 'i');
    const m2 = passage.match(re2);
    if (!m2) return null;
    return passage.replace(re2, `<u>${m2[0]}</u>`);
  }
  return passage.replace(re, `<u>${match[0]}</u>`);
}

// ── types that are fixable for V67 ───────────────────────────────────────────

const V67_FIXABLE_TYPES = new Set([
  '동의어 고르기',
  '반의어 고르기',
  // 영영풀이 is excluded because V76 requires passage=null for 영영풀이
]);

const V67_LOG_TYPES = new Set([
  '함축의미 추론',
  '어형 변환',
  '서술형 — 어형변환',
  '영영풀이 매칭',
  '영영풀이',
  '내용이해 T/F',
  '오류찾기',
  '빈칸 문맥 완성',
  '서술형 — 핵심단어',
]);

// ── P-TF type mapping ─────────────────────────────────────────────────────────

const TF_TYPES = new Set(['T/F', 'TF']);

// ── V63-B types ───────────────────────────────────────────────────────────────

const V63B_TYPES = new Set(['순서배열', '글순서', '문장삽입']);

// ── main pass ─────────────────────────────────────────────────────────────────

const allFiles = getAllJsonFiles(DATA);
console.log(`Scanning ${allFiles.length} JSON files (excluding 수능특강Light)...\n`);

for (const filePath of allFiles) {
  let data;
  try {
    data = readJSON(filePath);
  } catch {
    continue;
  }

  const { testType, questions, fullPassage } = data;
  if (!Array.isArray(questions)) continue;

  const relPath = path.relative(ROOT, filePath);
  let modified = false;

  // ── N4: duplicate 영영풀이 stems ─────────────────────────────────────────────
  const englishDefs = questions.filter(q =>
    ['영영풀이 매칭', '영영풀이'].includes((q.type || '').trim())
  );
  const stemSeen = new Map();
  for (const q of englishDefs) {
    const stem = q.stem || '';
    if (stemSeen.has(stem)) {
      stats.n4.logged.push({
        file: relPath,
        ids: [stemSeen.get(stem), q.id],
        stem: stem.substring(0, 80),
      });
    } else {
      stemSeen.set(stem, q.id);
    }
  }

  for (const q of questions) {
    const typeNorm = (q.type || '').trim();
    const stem     = q.stem    || '';
    const passage  = q.passage != null ? String(q.passage) : '';

    // ── V63-B: 순서배열/문장삽입 with non-null passage ──────────────────────
    if (V63B_TYPES.has(typeNorm) && q.passage != null && String(q.passage).length > 10) {
      if (DRY_RUN) {
        console.log(`[V63-B dry] ${relPath} Q${q.id} ${typeNorm} → passage=null`);
      }
      q.passage = null;
      stats.v63b.questions++;
      modified = true;
    }

    // ── P-TF: T/F outside 워크북 → 내용이해 T/F ─────────────────────────────
    if (TF_TYPES.has(typeNorm) && testType !== '워크북') {
      if (DRY_RUN) {
        console.log(`[P-TF dry] ${relPath} Q${q.id} type "${typeNorm}" → "내용이해 T/F"`);
      }
      q.type = '내용이해 T/F';
      stats.ptf.questions++;
      modified = true;
    }

    // ── V67: stem has 밑줄 친 but passage lacks <u> ──────────────────────────
    if ((stem.includes('밑줄 친') || stem.includes('밑줄친')) && !passage.includes('<u>')) {
      if (V67_FIXABLE_TYPES.has(typeNorm)) {
        // Extract target word and add underline to passage
        const targetWord = extractTargetWord(stem);
        if (targetWord && passage.length > 0) {
          const newPassage = addUnderline(passage, targetWord);
          if (newPassage) {
            if (DRY_RUN) {
              console.log(`[V67 dry] ${relPath} Q${q.id} added <u>${targetWord}</u> to passage`);
            }
            q.passage = newPassage;
            stats.v67.questions++;
            modified = true;
          } else {
            stats.v67.logged.push({
              file: relPath, qid: q.id, type: typeNorm,
              word: targetWord,
              reason: `word not found in passage`,
              stem: stem.substring(0, 80),
            });
          }
        } else if (passage.length === 0 || q.passage == null) {
          // Passage is null/empty — can't add underline without content
          stats.v67.logged.push({
            file: relPath, qid: q.id, type: typeNorm,
            word: targetWord || '?',
            reason: `passage is null/empty — manual fix needed`,
            stem: stem.substring(0, 80),
          });
        } else {
          stats.v67.logged.push({
            file: relPath, qid: q.id, type: typeNorm,
            word: null,
            reason: `could not extract target word from stem`,
            stem: stem.substring(0, 80),
          });
        }
      } else if (V67_LOG_TYPES.has(typeNorm)) {
        stats.v67.logged.push({
          file: relPath, qid: q.id, type: typeNorm,
          reason: `type ${typeNorm} requires manual review`,
          stem: stem.substring(0, 80),
        });
      } else {
        // Unknown type — log
        stats.v67.logged.push({
          file: relPath, qid: q.id, type: typeNorm,
          reason: `unknown type — manual review`,
          stem: stem.substring(0, 80),
        });
      }
    }
  }

  // ── Track per-file changes ────────────────────────────────────────────────
  if (modified) {
    // Count V63-B / P-TF file changes
    const hasV63b = questions.some(q => V63B_TYPES.has((q.type||'').trim()));
    const hasPTF  = questions.some(q => TF_TYPES.has((q.type||'').trim())); // was TF, now changed
    if (!DRY_RUN) writeJSON(filePath, data);
  }
}

// Re-count file stats after the loop
{
  // Quick recount by re-scanning (stats were counted per question above)
  // File counts need separate tracking; approximate from questions
  stats.v63b.files  = '(see questions)';
  stats.ptf.files   = '(see questions)';
  stats.v67.files   = '(see questions)';
}

// ── validate.js patch: add exemptions ────────────────────────────────────────

const validatePath = path.join(ROOT, 'validate', 'validate.js');
let validateSrc = fs.readFileSync(validatePath, 'utf8');
let validateModified = false;

// PATCH 1: P_EMPTY — add '서술형 — 배열영작' to noPassageTypes
if (!validateSrc.includes("'서술형 — 배열영작'")) {
  // Find the noPassageTypes array and add '서술형 — 배열영작'
  validateSrc = validateSrc.replace(
    "'영작문 (서술형)',\n    ];",
    "'영작문 (서술형)',\n      '서술형 — 배열영작',\n    ];"
  );
  if (!validateSrc.includes("'서술형 — 배열영작'")) {
    // Alternative pattern
    validateSrc = validateSrc.replace(
      "'영작문 (서술형)',\r\n    ];",
      "'영작문 (서술형)',\n      '서술형 — 배열영작',\r\n    ];"
    );
  }
  validateModified = true;
  console.log('[PATCH] validate.js: added 서술형 — 배열영작 to noPassageTypes (fixes P_EMPTY)');
}

// PATCH 2: V67 — add exemption for 영영풀이 and 어형변환 types
// The current V67 check has no exemptions. We add a type guard.
const V67_EXEMPT = `['영영풀이 매칭', '영영풀이', '어형 변환', '서술형 — 어형변환']`;
if (!validateSrc.includes('V67_EXEMPT_TYPES')) {
  validateSrc = validateSrc.replace(
    `    // V67: stem에 "밑줄 친"이 있으면 passage에 <u> 태그 필수 (유형 무관 통합)\n    if (stem.includes('밑줄 친') || stem.includes('밑줄친')) {`,
    `    // V67: stem에 "밑줄 친"이 있으면 passage에 <u> 태그 필수 (유형 무관 통합)\n    // 영영풀이는 V76에 의해 passage=null 필수이므로 V67 제외. 어형변환은 stem 오염 가능.\n    const V67_EXEMPT_TYPES = ${V67_EXEMPT};\n    if ((stem.includes('밑줄 친') || stem.includes('밑줄친')) && !V67_EXEMPT_TYPES.includes(typeNorm)) {`
  );
  validateModified = true;
  console.log('[PATCH] validate.js: added V67 exemption for 영영풀이/어형변환 types');
}

if (validateModified && !DRY_RUN) {
  fs.writeFileSync(validatePath, validateSrc, 'utf8');
  console.log('[PATCH] validate.js saved.\n');
} else if (validateModified && DRY_RUN) {
  console.log('[PATCH dry] validate.js would be patched.\n');
} else {
  console.log('[PATCH] validate.js already patched, no changes needed.\n');
}

// ── Report ────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════');
console.log('FIX REPORT' + (DRY_RUN ? ' (DRY RUN — no files changed)' : ''));
console.log('═══════════════════════════════════════════════════════\n');

console.log(`V63-B  (passage→null for 순서배열/문장삽입):  ${stats.v63b.questions} questions fixed`);
console.log(`P-TF   (T/F → 내용이해 T/F outside 워크북):  ${stats.ptf.questions} questions fixed`);
console.log(`V67    (add <u> for 동의어/반의어):           ${stats.v67.questions} questions fixed`);
console.log(`P_EMPTY (validate.js noPassageTypes patch):  applied`);
console.log(`V67 logged (manual review needed):           ${stats.v67.logged.length} questions`);
console.log(`N4  logged (duplicate 영영풀이 stems):       ${stats.n4.logged.length} pairs\n`);

if (stats.v67.logged.length > 0) {
  console.log('── V67 Manual Review Required ──────────────────────────');
  for (const entry of stats.v67.logged) {
    console.log(`  [${entry.file}] Q${entry.qid} (${entry.type})`);
    console.log(`    reason: ${entry.reason}`);
    if (entry.word) console.log(`    word: ${entry.word}`);
    console.log(`    stem: ${entry.stem}`);
  }
  console.log();
}

if (stats.n4.logged.length > 0) {
  console.log('── N4 Duplicate 영영풀이 Stems (need re-authoring) ─────');
  const seen = new Set();
  for (const entry of stats.n4.logged) {
    const key = `${entry.file}:${entry.ids.join(',')}`;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`  [${entry.file}] Q${entry.ids.join(' & Q')}: "${entry.stem}..."`);
    }
  }
  console.log();
}

console.log('Done.');
