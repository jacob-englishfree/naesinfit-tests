#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — fix-excerpts.js
 * Scans all JSON files in data/. For each question where the type requires
 * a full passage but `passage` is too short (< fullPassage * 0.5),
 * replaces passage with fullPassage and applies the appropriate marker.
 *
 * Usage: node scripts/fix-excerpts.js
 *        node scripts/fix-excerpts.js data/모의고사/고1/3월/18번/단어.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Types that require full (or near-full) passage text
const FULL_PASSAGE_TYPES = [
  '빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론',
  '문맥상 부적절한 어휘', '(A)(B)(C) 조합형',
  '어형 변환 (서술형)', '내용일치', '내용불일치', '내용이해',
  'T/F', '어법', '어법 빈칸', '문장삽입'
];

// Marker application functions by type
const MARKER_APPLICATORS = {
  '빈칸 어휘 완성': applyBlankMarker,
  '빈칸 문맥 완성': applyBlankMarker,
  '빈칸추론': applyBlankMarker,
  '빈칸 추론': applyBlankMarker,
  '문맥상 부적절한 어휘': applyUnderlineMarker,
  '(A)(B)(C) 조합형': applyABCMarker,
  '어형 변환 (서술형)': applyMorphMarker,
  '어법': applyGrammarMarker,
  '어법 빈칸': applyGrammarBlankMarker,
  '문장삽입': applySentenceInsertionMarker,
  '내용일치': applyFullMarker,
  '내용불일치': applyFullMarker,
  '내용이해': applyFullMarker,
  'T/F': applyFullMarker
};

function applyFullMarker(passage, q, fullPassage) {
  // Content/TF types just use __FULL__ (full passage with no modifications)
  return '__FULL__';
}

function applyBlankMarker(passage, q, fullPassage) {
  // Find the answer word in fullPassage and replace with __________
  if (!q.ch || !Array.isArray(q.ch)) return fullPassage;
  const answer = q.ch[q.ans];
  if (!answer) return fullPassage;

  // Try to find the answer word in fullPassage
  const target = answer.trim();
  let result = fullPassage;

  if (result.includes(target)) {
    // Replace first occurrence only
    result = result.replace(target, '__________');
  } else {
    // Try case-insensitive match
    const regex = new RegExp(escapeRegex(target), 'i');
    if (regex.test(result)) {
      result = result.replace(regex, '__________');
    } else {
      // Cannot find answer word — use __FULL__ as fallback
      return '__FULL__';
    }
  }
  return result;
}

function applyUnderlineMarker(passage, q, fullPassage) {
  // Need 5 <u> tags around specific words. If existing passage has them, extract and apply to fullPassage.
  const existingUs = (passage || '').match(/<u>[^<]+<\/u>/g);
  if (existingUs && existingUs.length === 5) {
    // Extract the underlined words from existing passage
    let result = fullPassage;
    for (const uTag of existingUs) {
      const word = uTag.replace(/<\/?u>/g, '');
      if (result.includes(word)) {
        result = result.replace(word, uTag);
      }
    }
    return result;
  }
  // Cannot determine which words to underline — keep existing or use __FULL__
  return passage || '__FULL__';
}

function applyABCMarker(passage, q, fullPassage) {
  // Need (A), (B), (C) markers. If existing passage has them, extract positions.
  const existingMarkers = (passage || '').match(/<b>\([ABC]\)<\/b>\s*\w+/g);
  if (existingMarkers && existingMarkers.length >= 3) {
    // Extract marker-word pairs and apply to fullPassage
    let result = fullPassage;
    for (const markerPhrase of existingMarkers) {
      const match = markerPhrase.match(/<b>\(([ABC])\)<\/b>\s*(\w+)/);
      if (match) {
        const word = match[2];
        const marker = `<b>(${match[1]})</b> ${word}`;
        if (result.includes(word)) {
          result = result.replace(word, marker);
        }
      }
    }
    return result;
  }
  return passage || '__FULL__';
}

function applyMorphMarker(passage, q, fullPassage) {
  // Need __________ + (원형) pattern
  if (!q.wa) return fullPassage;

  let result = fullPassage;
  const answer = q.wa.trim();

  // Find the answer in fullPassage, replace with __________ (root-form)
  if (result.includes(answer)) {
    // Try to extract the root form from accept array or existing passage
    const rootMatch = (passage || '').match(/\((\w+)\)/);
    const rootForm = rootMatch ? rootMatch[1] : answer;
    result = result.replace(answer, `__________ (${rootForm})`);
  }
  return result;
}

function applyGrammarMarker(passage, q, fullPassage) {
  // Need ①②③④⑤ markers — extract from existing passage if available
  const circled = ['①', '②', '③', '④', '⑤'];
  const hasAllMarkers = circled.every(c => (passage || '').includes(c));
  if (hasAllMarkers) {
    // Extract words near markers from existing passage and apply to fullPassage
    return passage; // Keep existing passage since grammar markers are position-sensitive
  }
  return passage || '__FULL__';
}

function applyGrammarBlankMarker(passage, q, fullPassage) {
  // Grammar blank — needs __________ with grammar choice
  return applyBlankMarker(passage, q, fullPassage);
}

function applySentenceInsertionMarker(passage, q, fullPassage) {
  // Need ①②③④ position markers — these are highly position-specific
  const markers = ['①', '②', '③', '④'];
  const hasAllMarkers = markers.every(c => (passage || '').includes(c));
  if (hasAllMarkers) {
    return passage; // Keep existing — marker positions are content-dependent
  }
  return passage || '__FULL__';
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripHtml(str) {
  return (str || '').replace(/<[^>]+>/g, '');
}

function fixFile(jsonPath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    return { path: jsonPath, fixed: 0, error: `Parse error: ${e.message}` };
  }

  const { fullPassage, questions } = data;
  if (!fullPassage || !Array.isArray(questions)) {
    return { path: jsonPath, fixed: 0, error: 'Missing fullPassage or questions' };
  }

  const fpLen = stripHtml(fullPassage).length;
  let fixedCount = 0;

  questions.forEach(q => {
    const typeNorm = (q.type || '').trim();
    if (!FULL_PASSAGE_TYPES.includes(typeNorm)) return;
    if (q.passage === '__FULL__') return;

    const passageLen = stripHtml(q.passage || '').length;
    const ratio = fpLen > 0 ? passageLen / fpLen : 0;

    if (ratio < 0.5) {
      // Passage is too short — apply fix
      const applicator = MARKER_APPLICATORS[typeNorm];
      if (applicator) {
        const newPassage = applicator(q.passage, q, fullPassage);
        if (newPassage !== q.passage) {
          q.passage = newPassage;
          fixedCount++;
        }
      }
    }
  });

  if (fixedCount > 0) {
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  }

  return { path: jsonPath, fixed: fixedCount, error: null };
}

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

function main() {
  const args = process.argv.slice(2);
  let files;

  if (args.length > 0 && args[0] !== '--all') {
    files = [path.resolve(args[0])];
  } else {
    const dataDir = path.join(ROOT, 'data');
    files = findJsonFiles(dataDir);
  }

  if (files.length === 0) {
    console.log('No JSON files found.');
    return;
  }

  console.log(`Scanning ${files.length} JSON files...\n`);

  let totalFixed = 0;
  let totalErrors = 0;
  const fixedFiles = [];

  files.forEach(f => {
    const result = fixFile(f);
    if (result.error) {
      totalErrors++;
      console.log(`[ERROR] ${path.relative(ROOT, f)}: ${result.error}`);
    } else if (result.fixed > 0) {
      totalFixed += result.fixed;
      fixedFiles.push({ path: path.relative(ROOT, f), count: result.fixed });
    }
  });

  console.log('\n--- Fix-Excerpts Report ---');
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files modified: ${fixedFiles.length}`);
  console.log(`Questions fixed: ${totalFixed}`);
  console.log(`Errors: ${totalErrors}`);

  if (fixedFiles.length > 0) {
    console.log('\nModified files:');
    fixedFiles.forEach(f => {
      console.log(`  ${f.path} (${f.count} questions fixed)`);
    });
  }
}

module.exports = { fixFile, FULL_PASSAGE_TYPES };

if (require.main === module) main();
