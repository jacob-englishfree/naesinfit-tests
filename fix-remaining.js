#!/usr/bin/env node
/**
 * fix-remaining.js
 * Fixes 4 categories of issues in quiz test HTML files:
 *   1. 빈칸 type with Korean choices -> 내용이해
 *   2. 부적절어휘 with FULL_PASSAGE (no underlines) -> generate underlined passage
 *   3. Mojibake special characters
 *   4. ABC combo marker issues
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const SCAN_DIRS = [
  path.join(BASE, '모의고사'),
  path.join(BASE, '부교재', '수능특강'),
];

// ─── Antonym Dictionary for Issue 2 ───
const ANTONYMS = {
  'confidence': 'doubt', 'dropped': 'rose', 'amazing': 'ordinary',
  'quietly': 'loudly', 'unique': 'common', 'uniqueness': 'commonality',
  'confirmed': 'denied', 'excited': 'calm', 'wonderful': 'terrible',
  'success': 'failure', 'happy': 'sad', 'love': 'hate',
  'beautiful': 'ugly', 'increase': 'decrease', 'strengthen': 'weaken',
  'simple': 'complex', 'simplicity': 'complexity', 'complex': 'simple',
  'positive': 'negative', 'negative': 'positive', 'accept': 'reject',
  'safe': 'dangerous', 'stable': 'unstable', 'stability': 'chaos',
  'clear': 'ambiguous', 'ambiguous': 'clear', 'certain': 'uncertain',
  'natural': 'artificial', 'artificial': 'natural', 'effective': 'ineffective',
  'active': 'passive', 'passive': 'active', 'independent': 'dependent',
  'encourage': 'discourage', 'beneficial': 'harmful', 'harmful': 'beneficial',
  'voluntary': 'involuntary', 'permanent': 'temporary', 'temporary': 'permanent',
  'flexible': 'rigid', 'rigid': 'flexible', 'abstract': 'concrete',
  'concrete': 'abstract', 'rational': 'irrational', 'subjective': 'objective',
  'objective': 'subjective', 'inclusive': 'exclusive', 'optimistic': 'pessimistic',
  'reliable': 'unreliable', 'visible': 'invisible', 'possible': 'impossible',
  'familiar': 'unfamiliar', 'significant': 'insignificant', 'relevant': 'irrelevant',
  'similar': 'different', 'different': 'similar', 'essential': 'unnecessary',
  'rapidly': 'slowly', 'frequently': 'rarely', 'easily': 'hardly',
  'freely': 'restrictively', 'willingly': 'reluctantly', 'deliberately': 'accidentally',
  'improve': 'worsen', 'expand': 'shrink', 'create': 'destroy',
  'protect': 'endanger', 'support': 'oppose', 'reveal': 'conceal',
  'connect': 'disconnect', 'combine': 'separate', 'attract': 'repel',
  'reward': 'punish', 'praised': 'criticized', 'achieve': 'fail',
  'advantage': 'disadvantage', 'progress': 'regress', 'advanced': 'primitive',
  'important': 'trivial', 'major': 'minor', 'primary': 'secondary',
  'generous': 'selfish', 'honest': 'dishonest', 'brave': 'cowardly',
  'respect': 'disrespect', 'freedom': 'restriction', 'restrict': 'liberate',
  'liberate': 'restrict', 'promote': 'hinder', 'enhance': 'diminish',
  'strengthen': 'weaken', 'weaken': 'strengthen', 'preserve': 'destroy',
  'traditional': 'modern', 'modern': 'traditional', 'familiar': 'strange',
  'diverse': 'uniform', 'uniform': 'diverse', 'abundant': 'scarce',
  'common': 'rare', 'rare': 'common', 'superior': 'inferior',
  'inferior': 'superior', 'maximum': 'minimum', 'minimum': 'maximum',
  'public': 'private', 'private': 'public', 'internal': 'external',
  'external': 'internal', 'voluntary': 'compulsory', 'conscious': 'unconscious',
  'logical': 'illogical', 'consistent': 'inconsistent', 'practical': 'impractical',
  'productive': 'unproductive', 'balanced': 'unbalanced',
  'prosper': 'decline', 'growth': 'decline', 'cooperative': 'competitive',
  'collectively': 'individually', 'intentional': 'accidental',
  'systematic': 'chaotic', 'chaotic': 'systematic', 'creative': 'unimaginative',
  'intuitive': 'methodical', 'methodical': 'intuitive',
  // Added for 고2/3월_2024 files
  'arrived': 'departed', 'convenience': 'inconvenience', 'shifting': 'fixed',
  'trust': 'distrust', 'lecturer': 'student', 'addiction': 'aversion',
  'reactions': 'inaction', 'strong': 'weak', 'attracted': 'repelled',
  'composition': 'decomposition', 'further': 'closer', 'warmer': 'colder',
  'stage': 'conclusion', 'controllable': 'uncontrollable', 'crises': 'stability',
  'valuable': 'worthless', 'provided': 'withheld',
  'completely': 'partially', 'carefully': 'carelessly', 'properly': 'improperly',
  'greatly': 'slightly', 'directly': 'indirectly', 'fairly': 'unfairly',
  'honestly': 'dishonestly', 'widely': 'narrowly',
  'powerful': 'powerless', 'successful': 'unsuccessful', 'careful': 'careless',
  'useful': 'useless', 'hopeful': 'hopeless', 'meaningful': 'meaningless',
  'harmful': 'harmless', 'thankful': 'ungrateful', 'peaceful': 'violent',
  'eventually': 'immediately', 'gradually': 'suddenly',
  'remained': 'departed', 'increased': 'decreased', 'improved': 'worsened',
  'accepted': 'rejected', 'allowed': 'forbidden', 'continued': 'stopped',
  'encouraged': 'discouraged', 'maintained': 'abandoned', 'survived': 'perished',
  'remarkable': 'ordinary', 'extraordinary': 'ordinary', 'fascinating': 'boring',
  'crucial': 'trivial', 'essential': 'optional', 'obvious': 'obscure',
  'precise': 'vague', 'sufficient': 'insufficient', 'appropriate': 'inappropriate',
  'specific': 'general', 'individual': 'collective', 'separate': 'combined',
  'correctly': 'incorrectly', 'efficiently': 'inefficiently',
};

// ─── Helpers ───
function findFiles(dir, name = '퀴즈테스트.html') {
  let results = [];
  try {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, f.name);
      if (f.isDirectory()) results.push(...findFiles(fp, name));
      else if (f.name === name) results.push(fp);
    }
  } catch (e) { /* skip */ }
  return results;
}

function hasKorean(str) { return /[가-힣]/.test(str); }
function allChoicesKorean(arr) { return arr && arr.length > 0 && arr.every(c => hasKorean(c)); }
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const COMMON_WORDS = new Set([
  'about','after','again','almost','along','always','among','another','around',
  'based','because','become','before','being','between','called','change','could',
  'different','doing','during','enough','every','example','first','found','given',
  'going','great','group','having','however','human','include','inside','instead',
  'known','large','later','least','level','light','likely','little','looking',
  'might','money','never','number','often','order','other','others','people',
  'place','point','possible','probably','problem','quite','rather','really',
  'right','sense','several','should','since','small','something','still','study',
  'their','there','these','thing','things','think','those','though','thought',
  'three','through','today','together','under','until','using','value','very',
  'water','where','which','while','whole','without','world','would','years',
  'young','itself','themselves','himself','herself','ourselves','merely','simply',
  'certain','indeed','perhaps','whether','within','cannot','nothing','anything',
  'everything','everyone','someone','already','although','neither','either',
  'except','across','toward','towards','beyond','above','below','whose',
  'began','begin','began','being','comes','could','doing','going','makes',
  'means','needs','seems','takes','wants','works','asked','began','bring',
]);

function extractKeyWords(passage) {
  const clean = passage.replace(/<[^>]+>/g, '').replace(/\\u[\da-fA-F]{4}/g, '');
  const words = clean.match(/\b[a-zA-Z]{5,}\b/g) || [];
  const unique = [];
  const seen = new Set();
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!seen.has(lower) && !COMMON_WORDS.has(lower) && lower.length >= 5) {
      seen.add(lower);
      unique.push(w);
    }
  }
  return unique;
}

function getAntonym(word) {
  const lower = word.toLowerCase();
  if (ANTONYMS[lower]) return ANTONYMS[lower];
  // Try common prefixes
  if (lower.startsWith('un')) return lower.substring(2);
  if (lower.startsWith('in')) return lower.substring(2);
  if (lower.startsWith('dis')) return lower.substring(3);
  return null;
}

// ─── Stats ───
const stats = {
  issue1_fixed: 0, issue2_fixed: 0, issue3_fixed: 0, issue4_fixed: 0,
  issue2_nodata_fixed: 0,
  filesModified: 0, filesScanned: 0,
  details: [],
};

// ─── Process each file ───
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const relPath = path.relative(BASE, filePath);

  // ═══════════ Issue 3: Mojibake ═══════════
  const mojibakePatterns = [
    [/\xe2\x80\x93/g, '\u2013'], [/\xe2\x80\x94/g, '\u2014'],
    [/\xe2\x80\x99/g, '\u2019'], [/\xe2\x80\x98/g, '\u2018'],
    [/\xe2\x80\x9c/g, '\u201c'], [/\xe2\x80\x9d/g, '\u201d'],
    [/\xc3\xa9/g, '\u00e9'],
  ];
  for (const [pat, rep] of mojibakePatterns) {
    const before = content;
    content = content.replace(pat, rep);
    if (content !== before) stats.issue3_fixed++;
  }

  // ═══════════ Issue 1: 빈칸 type with Korean choices -> 내용이해 ═══════════
  // Match type that contains 빈칸 (빈칸추론, 빈칸 문맥 완성, 빈칸 어휘 완성, etc.)
  // Use a line-by-line approach for reliability
  const lines = content.split('\n');
  let modified = content !== original;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match type containing 빈칸
    const typeMatch = line.match(/type:\s*([`'"])([^`'"]*빈칸[^`'"]*)\1/);
    if (!typeMatch) continue;

    const quoteChar = typeMatch[1];
    const typeName = typeMatch[2];

    // Look ahead for ch array (within next 5 lines)
    let chLine = '';
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes('ch:')) {
        chLine = lines[j];
        // May span multiple lines
        if (!chLine.includes(']')) {
          for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
            chLine += lines[k];
            if (lines[k].includes(']')) break;
          }
        }
        break;
      }
    }

    if (!chLine) continue;

    // Extract choices
    const chMatch = chLine.match(/ch:\s*\[([^\]]*)\]/);
    if (!chMatch) continue;

    const choices = [];
    const cr = /[`'"]([^`'"]+)[`'"]/g;
    let cm;
    while ((cm = cr.exec(chMatch[1])) !== null) choices.push(cm[1]);

    if (choices.length === 0) continue;

    // Check if ALL choices contain Korean
    if (allChoicesKorean(choices)) {
      const oldType = `type:${quoteChar}${typeName}${quoteChar}`;
      const newType = `type:${quoteChar}내용이해${quoteChar}`;
      lines[i] = lines[i].replace(oldType, newType);
      stats.issue1_fixed++;
      modified = true;
    }
  }

  if (modified) {
    content = lines.join('\n');
  }

  // ═══════════ Issue 2: 부적절어휘 with FULL_PASSAGE ═══════════
  const fpMatch = content.match(/const FULL_PASSAGE\s*=\s*`([^`]*)`/);
  const fullPassage = fpMatch ? fpMatch[1] : null;

  if (fullPassage) {
    // Strategy: find each 어휘/부적절어휘 question with passage:FULL_PASSAGE
    // Two sub-cases:
    // (a) det has specific word info (❌ ④ liberate: 원문은 restrict)
    // (b) det has minimal info (❌ ④: 반의어로 교체됨)

    // We'll use a regex that captures the entire question block
    const qArray = content.match(/const Q\s*=\s*\[([\s\S]*?)\];\s*(?:const|function|let|var|\/\/)/);
    if (qArray) {
      const qContent = qArray[1];

      // Split into individual question blocks
      const qBlocks = [];
      let depth = 0;
      let blockStart = -1;

      for (let ci = 0; ci < qContent.length; ci++) {
        if (qContent[ci] === '{' && depth === 0) { blockStart = ci; depth++; }
        else if (qContent[ci] === '{') depth++;
        else if (qContent[ci] === '}') {
          depth--;
          if (depth === 0 && blockStart >= 0) {
            qBlocks.push({
              text: qContent.substring(blockStart, ci + 1),
              start: blockStart,
              end: ci + 1,
            });
            blockStart = -1;
          }
        }
      }

      const replacements = [];

      for (const block of qBlocks) {
        const text = block.text;

        // Check if this is 어휘/부적절어휘 type with passage:FULL_PASSAGE
        const isVocab = /type:\s*[`'"](문맥상 부적절한 어휘|부적절어휘|어휘)[`'"]/.test(text);
        if (!isVocab) continue;
        if (!text.includes('passage:FULL_PASSAGE') && !text.match(/passage:\s*FULL_PASSAGE/)) continue;

        // Extract ans index
        const ansMatch = text.match(/ans:\s*(\d+)/);
        if (!ansMatch) continue;
        const ansIdx = parseInt(ansMatch[1]);

        // Try to extract word info from det.analysis
        const analysisMatch = text.match(/analysis:\s*[`'"]([^`'"]*)[`'"]/);
        const tipMatch = text.match(/tip:\s*[`'"]([^`'"]*)[`'"]/);
        const analysis = analysisMatch ? analysisMatch[1] : '';
        const tip = tipMatch ? tipMatch[1] : '';

        let wrongWord = null;
        let originalWord = null;

        // Case (a): detailed info
        const detailedMatch = analysis.match(/[❌]\s*[①②③④⑤]\s*(\w+)[\s:]+원문[은는]?\s*(\w+)/);
        if (detailedMatch) {
          wrongWord = detailedMatch[1];
          originalWord = detailedMatch[2];
        }

        // Also try tip pattern: "word1 ↔ word2"
        if (!wrongWord && tip) {
          const tipPair = tip.match(/(\w{3,})\s*[↔⇔]\s*(\w{3,})/);
          if (tipPair) {
            originalWord = tipPair[1];
            wrongWord = tipPair[2];
          }
        }

        // Case (b): minimal info - need to generate
        const keyWords = extractKeyWords(fullPassage);

        if (!wrongWord && keyWords.length >= 5) {
          // First, find a word that HAS an antonym
          let antonymWord = null;
          let antonymValue = null;

          // Try all keywords to find one with a known antonym
          for (const kw of keyWords) {
            const ant = getAntonym(kw);
            if (ant) {
              antonymWord = kw;
              antonymValue = ant;
              break;
            }
          }

          if (!antonymWord) {
            stats.details.push(`SKIP (no antonym found for any word): ${relPath}`);
            continue;
          }

          // Now select 5 words: the antonym word + 4 others spread across passage
          const otherWords = keyWords.filter(w => w !== antonymWord);
          const step = Math.max(1, Math.floor(otherWords.length / 5));
          const fourOthers = [];
          for (let si = 0; si < otherWords.length && fourOthers.length < 4; si += step) {
            fourOthers.push(otherWords[si]);
          }
          while (fourOthers.length < 4) {
            const next = otherWords.find(w => !fourOthers.includes(w));
            if (next) fourOthers.push(next);
            else break;
          }
          if (fourOthers.length < 4) continue;

          // Build selected array with antonym word at the right position
          // First, find all 5 words and their positions to determine passage order
          const allFive = [...fourOthers, antonymWord];

          originalWord = antonymWord;
          wrongWord = antonymValue;

          // Build underlined passage using allFive
          const circledNums = ['\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
          let newPassage = fullPassage;

          // Find positions of each word in passage
          const positions = [];
          for (let wi = 0; wi < allFive.length; wi++) {
            const regex = new RegExp('\\b' + escapeRegex(allFive[wi]) + '\\b', 'i');
            const wm = regex.exec(newPassage);
            if (wm) {
              positions.push({
                idx: wi,
                pos: wm.index,
                len: wm[0].length,
                word: allFive[wi],
                isAnswer: allFive[wi] === antonymWord,
              });
            }
          }

          if (positions.length < 5) {
            stats.details.push(`SKIP (not all words found in passage): ${relPath}`);
            continue;
          }

          // Sort by position in passage
          positions.sort((a, b) => a.pos - b.pos);

          // Build underlined passage
          let built = '';
          let lastEnd = 0;
          let newAnsIdx = -1;

          for (let pi = 0; pi < positions.length; pi++) {
            const p = positions[pi];
            built += newPassage.substring(lastEnd, p.pos);
            const displayWord = p.isAnswer ? wrongWord : p.word;
            built += circledNums[pi] + '<u>' + displayWord + '</u>';
            lastEnd = p.pos + p.len;
            if (p.isAnswer) newAnsIdx = pi;
          }
          built += newPassage.substring(lastEnd);

          if (newAnsIdx === -1) continue;

          // Build replacement block
          let newText = text.replace(/passage:\s*FULL_PASSAGE/, 'passage:`' + built.replace(/`/g, '\\`') + '`');
          newText = newText.replace(/ans:\s*\d+/, 'ans:' + newAnsIdx);

          // Update det
          newText = newText.replace(
            /analysis:\s*[`'"]([^`'"]*)[`'"]/,
            `analysis:\`❌ ${circledNums[newAnsIdx]} ${wrongWord}: 원문은 ${originalWord}\\n✅ 나머지: 원문 일치\``
          );
          newText = newText.replace(
            /tip:\s*[`'"]([^`'"]*)[`'"]/,
            `tip:\`${originalWord} \\u2194 ${wrongWord}\``
          );

          replacements.push({ start: block.start, end: block.end, newText });
          stats.issue2_nodata_fixed++;
          continue;
        }

        if (!wrongWord || !originalWord) {
          stats.details.push(`SKIP (no word data): ${relPath} ans:${ansIdx}`);
          continue;
        }

        // Case (a): we have word data, build underlined passage
        const allKeyWords = extractKeyWords(fullPassage);

        // Remove original and wrong word from candidates
        const candidates = allKeyWords.filter(
          w => w.toLowerCase() !== originalWord.toLowerCase() && w.toLowerCase() !== wrongWord.toLowerCase()
        );

        if (candidates.length < 4) {
          stats.details.push(`SKIP (too few vocab words): ${relPath}`);
          continue;
        }

        // Select 4 spread words
        const step = Math.max(1, Math.floor(candidates.length / 5));
        const fourWords = [];
        for (let si = 0; si < candidates.length && fourWords.length < 4; si += step) {
          fourWords.push(candidates[si]);
        }
        while (fourWords.length < 4) {
          const next = candidates.find(w => !fourWords.includes(w));
          if (next) fourWords.push(next);
          else break;
        }

        if (fourWords.length < 4) continue;

        // Build 5 words: 4 correct + 1 wrong at answer position
        const fiveEntries = [];
        let correctIdx = 0;
        for (let wi = 0; wi < 5; wi++) {
          if (wi === ansIdx) {
            fiveEntries.push({ display: wrongWord, original: originalWord, isAnswer: true });
          } else {
            fiveEntries.push({ display: fourWords[correctIdx], original: fourWords[correctIdx], isAnswer: false });
            correctIdx++;
          }
        }

        // Find positions in passage
        let workPassage = fullPassage;
        const positions = [];
        for (let wi = 0; wi < fiveEntries.length; wi++) {
          const searchWord = fiveEntries[wi].original;
          const regex = new RegExp('\\b' + escapeRegex(searchWord) + '\\b', 'i');
          const wm = regex.exec(workPassage);
          if (wm) {
            positions.push({
              idx: wi,
              pos: wm.index,
              len: wm[0].length,
              display: fiveEntries[wi].display,
              isAnswer: fiveEntries[wi].isAnswer,
            });
          }
        }

        if (positions.length < 5) {
          stats.details.push(`SKIP (words not found): ${relPath}`);
          continue;
        }

        positions.sort((a, b) => a.pos - b.pos);

        const circledNums = ['\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
        let built = '';
        let lastEnd = 0;
        let newAnsIdx = -1;

        for (let pi = 0; pi < positions.length; pi++) {
          const p = positions[pi];
          built += workPassage.substring(lastEnd, p.pos);
          built += circledNums[pi] + '<u>' + p.display + '</u>';
          lastEnd = p.pos + p.len;
          if (p.isAnswer) newAnsIdx = pi;
        }
        built += workPassage.substring(lastEnd);

        if (newAnsIdx === -1) continue;

        let newText = text.replace(/passage:\s*FULL_PASSAGE/, 'passage:`' + built.replace(/`/g, '\\`') + '`');
        newText = newText.replace(/ans:\s*\d+/, 'ans:' + newAnsIdx);

        replacements.push({ start: block.start, end: block.end, newText });
        stats.issue2_fixed++;
      }

      // Apply replacements in reverse order
      if (replacements.length > 0) {
        const qStart = content.indexOf(qContent);
        replacements.sort((a, b) => b.start - a.start);
        let newQContent = qContent;
        for (const r of replacements) {
          newQContent = newQContent.substring(0, r.start) + r.newText + newQContent.substring(r.end);
        }
        content = content.replace(qContent, newQContent);
        modified = true;
      }
    }
  }

  // ═══════════ Issue 4: ABC combo markers ═══════════
  // Check if any (A)(B)(C) 조합형 questions are missing markers in their passage
  if (content.includes('(A)(B)(C)')) {
    const qArray2 = content.match(/const Q\s*=\s*\[([\s\S]*?)\];\s*(?:const|function|let|var|\/\/)/);
    if (qArray2) {
      // Parse question blocks again
      const qContent2 = qArray2[1];
      const abcRegex = /\{id:\d+[^}]*type:[`'"]\(A\)\(B\)\(C\) 조합형[`'"][^]*?(?=\{id:|\}$)/g;
      // Simple approach: find each ABC question and check if passage has markers
      let abcMatch;
      while ((abcMatch = abcRegex.exec(qContent2)) !== null) {
        const block = abcMatch[0];
        const passMatch = block.match(/passage:\s*[`'"]([^`'"]*)[`'"]/);
        if (!passMatch) continue;
        const passage = passMatch[1];

        if (passage.includes('<b>(A)</b>') && passage.includes('<b>(B)</b>') && passage.includes('<b>(C)</b>')) {
          continue; // Already has markers
        }

        // Extract answer choices to find the 3 words
        const ansMatch2 = block.match(/ans:\s*(\d+)/);
        const chMatch2 = block.match(/ch:\s*\[([^\]]*)\]/);
        if (!ansMatch2 || !chMatch2) continue;

        const ansIdx2 = parseInt(ansMatch2[1]);
        const choices2 = [];
        const cr2 = /[`'"]([^`'"]*)[`'"]/g;
        let cm2;
        while ((cm2 = cr2.exec(chMatch2[1])) !== null) choices2.push(cm2[1]);

        if (ansIdx2 >= choices2.length) continue;
        const correctChoice = choices2[ansIdx2];
        const parts = correctChoice.split(/\s*[\u2014\u2013\-]\s*/);
        if (parts.length !== 3) {
          stats.details.push(`ABC SKIP (not 3 parts): ${relPath}`);
          continue;
        }

        const [wA, wB, wC] = parts.map(p => p.trim());
        let newPassage = passage;
        let fixed = 0;

        for (const [label, word] of [['(A)', wA], ['(B)', wB], ['(C)', wC]]) {
          if (newPassage.includes('<b>' + label + '</b>')) continue;
          const wr = new RegExp('(?<!<b>\\()\\b' + escapeRegex(word) + '\\b', 'i');
          const wm = wr.exec(newPassage);
          if (wm) {
            newPassage = newPassage.substring(0, wm.index) + '<b>' + label + '</b> ' + newPassage.substring(wm.index);
            fixed++;
          }
        }

        if (fixed > 0) {
          const oldP = passMatch[0];
          const quote = oldP.match(/passage:\s*([`'"])/)[1];
          const newP = 'passage:' + quote + newPassage + quote;
          content = content.replace(oldP, newP);
          stats.issue4_fixed++;
          modified = true;
        }
      }
    }
  }

  // ═══════════ Save if modified ═══════════
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesModified++;
  }
}

// ─── Run ───
console.log('=== fix-remaining.js ===\n');

const allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles.push(...findFiles(dir));
}
console.log(`Found ${allFiles.length} quiz test files\n`);

for (const f of allFiles) {
  stats.filesScanned++;
  try {
    processFile(f);
  } catch (e) {
    console.error(`ERROR in ${path.relative(BASE, f)}: ${e.message}`);
  }
}

// ─── Verification pass ───
let remainIssue1 = 0;
let remainIssue2 = 0;

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf8');

  // Remaining Issue 1: 빈칸 type with Korean choices
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const tm = lines[i].match(/type:\s*[`'"]([^`'"]*빈칸[^`'"]*)[`'"]/);
    if (!tm) continue;
    let chLine = '';
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes('ch:')) {
        chLine = lines[j];
        if (!chLine.includes(']')) {
          for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
            chLine += lines[k];
            if (lines[k].includes(']')) break;
          }
        }
        break;
      }
    }
    if (!chLine) continue;
    const chm = chLine.match(/ch:\s*\[([^\]]*)\]/);
    if (!chm) continue;
    const choices = [];
    const cr = /[`'"]([^`'"]+)[`'"]/g;
    let cm;
    while ((cm = cr.exec(chm[1])) !== null) choices.push(cm[1]);
    if (choices.length > 0 && allChoicesKorean(choices)) remainIssue1++;
  }

  // Remaining Issue 2: 어휘/부적절 with FULL_PASSAGE - precise per-question check
  const qStart2 = content.indexOf('const Q=[');
  if (qStart2 >= 0) {
    const qEnd2 = content.indexOf('];', qStart2);
    if (qEnd2 >= 0) {
      const qSection = content.substring(qStart2, qEnd2);
      const qBlocks2 = qSection.split(/(?=\{id:\d)/);
      for (const block of qBlocks2) {
        if (!block.includes('type:')) continue;
        const hasVT = /type:\s*[`'"](문맥상 부적절한 어휘|부적절어휘|어휘)[`'"]/.test(block);
        if (hasVT && /passage:\s*FULL_PASSAGE/.test(block)) {
          remainIssue2++;
        }
      }
    }
  }
}

// ─── Report ───
console.log('\n' + '='.repeat(50));
console.log('         FIX RESULTS REPORT');
console.log('='.repeat(50));
console.log(`Files scanned:      ${stats.filesScanned}`);
console.log(`Files modified:     ${stats.filesModified}`);
console.log('');
console.log('Issue 1: 빈칸 with Korean choices -> 내용이해');
console.log(`  Fixed:            ${stats.issue1_fixed}`);
console.log(`  Remaining:        ${remainIssue1}`);
console.log('');
console.log('Issue 2: 부적절 밑줄 추가');
console.log(`  Fixed (detailed): ${stats.issue2_fixed}`);
console.log(`  Fixed (no data):  ${stats.issue2_nodata_fixed}`);
console.log(`  Remaining:        ${remainIssue2}`);
console.log('');
console.log('Issue 3: 특수문자(mojibake)');
console.log(`  Fixed:            ${stats.issue3_fixed}`);
console.log('');
console.log('Issue 4: ABC 조합 마커');
console.log(`  Fixed:            ${stats.issue4_fixed}`);
console.log('='.repeat(50));

if (stats.details.length > 0) {
  console.log('\nDetails:');
  for (const d of stats.details) {
    console.log('  ' + d);
  }
}

console.log('\nTotal fixed: ' + (stats.issue1_fixed + stats.issue2_fixed + stats.issue2_nodata_fixed + stats.issue3_fixed + stats.issue4_fixed));
console.log('Total remaining: ' + (remainIssue1 + remainIssue2));
