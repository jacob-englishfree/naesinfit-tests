#!/usr/bin/env node
/**
 * S-ANTONYM-PREFIX 수정
 * prefix antonym(un-/in-/dis-/de-/mis-/non-)을 fullPassage에 있는 단어로 교체
 *
 * 사용: node fix-antonym-prefix.js <file> <qid> <ch_index> <bad_word> [replacement]
 * replacement 생략 시 fullPassage에서 자동 탐색
 */
const fs = require('fs');

const STOP_WORDS = new Set(['that', 'this', 'with', 'from', 'have', 'they', 'were', 'been', 'their',
  'when', 'what', 'which', 'more', 'also', 'some', 'each', 'such', 'most', 'just',
  'into', 'than', 'them', 'then', 'even', 'make', 'made', 'much', 'both', 'only',
  'very', 'over', 'here', 'well', 'back', 'time', 'many', 'will', 'would', 'could',
  'should', 'about', 'after', 'before', 'being', 'other', 'these', 'those', 'while',
  'where', 'there', 'their', 'through', 'people', 'world', 'often', 'first', 'known',
  'using', 'used', 'need', 'must', 'based', 'since', 'still', 'under', 'every']);

const [jsonFile, qidStr, chIdxStr, badWord, manualReplacement] = process.argv.slice(2);
if (!jsonFile) { console.error('Usage: node fix-antonym-prefix.js <file> <qid> <ch_idx> <bad_word> [replacement]'); process.exit(1); }

const qid = parseInt(qidStr);
const chIdx = parseInt(chIdxStr);

const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
const fullPassage = (data.fullPassage || '').toLowerCase();

const q = data.questions.find(q => q.id === qid);
if (!q) { console.error(`Q${qid} not found`); process.exit(1); }

let replacement = manualReplacement;

if (!replacement) {
  // Auto-find: extract words from fullPassage
  const words = fullPassage.match(/\b[a-zA-Z]{5,12}\b/g) || [];
  const existingCh = new Set(q.ch.map(c => c.toLowerCase()));
  const wordCounts = {};
  for (const w of words) {
    if (!STOP_WORDS.has(w) && !existingCh.has(w) && w !== badWord.toLowerCase()) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
  }
  // Pick words with 1-2 occurrences (not too dominant, not too rare)
  const candidates = Object.entries(wordCounts)
    .filter(([w, cnt]) => cnt >= 1 && cnt <= 3 && /^[a-z]/.test(w) && !/\d/.test(w))
    .sort((a, b) => a[1] - b[1])
    .map(([w]) => w);

  // Try to pick a meaningful word (verbs/adjectives preferred)
  // Heuristic: words ending in -ing, -ed, -ive, -al, -ous are often adjectives/verbs
  const preferred = candidates.filter(w => /ing$|ed$|ive$|al$|ous$|ent$|ant$|able$/.test(w));
  replacement = preferred[0] || candidates[0];
}

if (!replacement) {
  console.error(`No replacement found for "${badWord}"`);
  process.exit(1);
}

console.log(`Q${qid}: ch[${chIdx}] "${q.ch[chIdx]}" → "${replacement}"`);
q.ch[chIdx] = replacement;

// If the bad word was the answer, swap with something else
// (it shouldn't be the answer if it's a wrong antonym, but just in case)
if (q.ans - 1 === chIdx) {
  console.warn('WARNING: replacing the answer choice! Double-check.');
}

fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf8');
console.log('[FIXED]', jsonFile);
