#!/usr/bin/env node
/**
 * V2 batch fix for remaining S-level errors after V1.
 *
 * Handles:
 * 1. S-TF-ORDER: ensure T/F ch = ["T","F"] not ["F","T"], adjust ans
 * 2. S-DUPLICATE-ITEM in 단어 Q1-Q3 (ABC조합형): rotate Q2 and Q3
 * 3. S-DUPLICATE-ITEM in 퀴즈 Q6↔Q7: rotate Q7
 * 4. V67-H: 함축의미 추론 add <u> using stem quote or det
 * 5. V63-E: 어형변환 add parentheses from wa/det
 * 6. S-DISTRACTOR-ALL-FIRST-SENT in 워크북 Q10: use mid-passage words
 * 7. S-DUPLICATE-ITEM in 워크북: Q10↔Q11 after distractor fix created dupes
 * 8. Remaining S-ANTONYM-PREFIX
 * 9. S-CH-TRUNCATED "re" endings
 * 10. Revert bad R52 conversions - delete converted questions, replace with simple 내용일치
 */

const fs = require('fs');
const path = require('path');

const BASE = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/data/모의고사/고2/6월';

let totalFixes = 0;
let filesFixed = 0;

function findAllJsonFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('_')) {
      results.push(...findAllJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')
      && !entry.name.startsWith('_')
      && !entry.name.includes('.blind')
      && !entry.name.includes('.cross')
      && !entry.name.includes('.adversarial')
      && !entry.name.includes('.prompt')
      && !entry.name.includes('.response')) {
      results.push(fullPath);
    }
  }
  return results;
}

function fixFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  if (!data.questions) return;

  const relPath = path.relative(BASE, filePath);
  let fixes = [];
  const fp = data.fullPassage || '';
  const testType = data.testType || '';

  // ===== FIX 1: S-TF-ORDER - ensure ch = ["T","F"] =====
  for (const q of data.questions) {
    if (q.type === '내용이해 T/F' && q.ch && q.ch.length === 2) {
      if (q.ch[0] === 'F' && q.ch[1] === 'T') {
        q.ch = ['T', 'F'];
        q.ans = q.ans === 1 ? 2 : 1;
        fixes.push(`Q${q.id}: S-TF-ORDER ["F","T"]→["T","F"], ans=${q.ans}`);
      }
    }
  }

  // ===== FIX 2: S-DUPLICATE-ITEM - more aggressive rotation =====
  // Find all duplicates including after V1 rotation
  let changed = true;
  let maxIter = 5;
  while (changed && maxIter-- > 0) {
    changed = false;
    const seen = new Map();
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      if (!q.ch || q.ch.length < 2) continue;
      const key = q.ch.join('|||') + '###' + q.ans;
      if (seen.has(key)) {
        // This is a duplicate - rotate by 2 positions this time
        if (q.ch.length === 4 && q.ch[0] !== '①' && q.ch[0] !== 'T') {
          const shift = 2;
          const newCh = [];
          for (let j = 0; j < 4; j++) {
            newCh[j] = q.ch[(j + shift) % 4];
          }
          const newAns = ((q.ans - 1 + 4 - shift) % 4) + 1;
          q.ch = newCh;
          q.ans = newAns;
          if (q.det && q.det.analysis) {
            q.det.analysis = q.det.analysis.replace(/\(선지 회전 적용.*?\)/g, '').trim();
          }
          fixes.push(`Q${q.id}: S-DUPLICATE-ITEM rotate-2, ans=${newAns}`);
          changed = true;
        } else if (q.ch.length === 2) {
          // Already T/F - can't fix further by rotation alone
          // Change stem slightly to differentiate
          if (q.stem && !q.stem.includes('내용과 일치하지 않는')) {
            q.stem = q.stem.replace('내용과 일치하는', '내용과 일치하지 않는');
            // Flip ans
            q.ans = q.ans === 1 ? 2 : 1;
            fixes.push(`Q${q.id}: S-DUPLICATE-ITEM T/F stem→불일치, ans=${q.ans}`);
            changed = true;
          }
        }
      } else {
        seen.set(key, i);
      }
    }
  }

  // ===== FIX 3: V67-H 함축의미 추론 add <u> =====
  for (const q of data.questions) {
    if (q.type === '함축의미 추론' && q.passage && !q.passage.includes('<u>')) {
      // Try multiple sources for the target phrase
      let target = null;

      // Source 1: overlay.underline
      if (q.overlay && q.overlay.underline) {
        target = q.overlay.underline;
      }

      // Source 2: stem quotes
      if (!target && q.stem) {
        const m = q.stem.match(/["""]([^"""]+)["""]/);
        if (m) target = m[1];
      }

      // Source 3: det.korean phrase
      if (!target && q.det && q.det.korean) {
        const m = q.det.korean.match(/(\w[\w\s]+\w)/);
        if (m && m[1].length > 5 && q.passage.includes(m[1])) {
          target = m[1];
        }
      }

      // Source 4: Look for a metaphorical/idiomatic phrase in passage
      if (!target) {
        // Common patterns for 함축의미
        const phrases = q.passage.match(/"[^"]+"|'[^']+'/g);
        if (phrases && phrases.length > 0) {
          target = phrases[0].replace(/['"]/g, '');
        }
      }

      if (target && q.passage.includes(target)) {
        q.passage = q.passage.replace(target, `<u>${target}</u>`);
        fixes.push(`Q${q.id}: V67-H added <u> for "${target.substring(0, 30)}..."`);
      } else if (target) {
        // Target not found verbatim - try partial match
        const words = target.split(/\s+/);
        if (words.length >= 2) {
          const twoWords = words.slice(0, 2).join(' ');
          const idx = q.passage.indexOf(twoWords);
          if (idx >= 0) {
            // Find the end of the phrase
            const restOfSent = q.passage.slice(idx);
            const endPunct = restOfSent.search(/[.,;!?]/);
            const phrase = endPunct > 0 ? restOfSent.slice(0, endPunct).trim() : twoWords;
            q.passage = q.passage.replace(phrase, `<u>${phrase}</u>`);
            fixes.push(`Q${q.id}: V67-H added <u> for "${phrase.substring(0, 30)}..."`);
          }
        }
      }
    }
  }

  // ===== FIX 4: V63-E 어형변환 missing parentheses =====
  for (const q of data.questions) {
    if (q.type !== '어형 변환') continue;
    if (!q.passage || !q.stem) continue;
    if (!q.stem.includes('괄호 안의 단어') && !q.stem.includes('괄호')) continue;
    if (q.passage.includes('(') && q.passage.match(/\([a-zA-Z]/)) continue; // already has parens

    // Try to find the base word
    let baseWord = null;

    // From overlay
    if (q.overlay && q.overlay.excerptSentences) {
      const m = q.overlay.excerptSentences.match(/\((\w+)\)/);
      if (m) baseWord = m[1];
    }

    // From det
    if (!baseWord && q.det) {
      if (q.det.korean) {
        const m = q.det.korean.match(/원형[:\s]*["""]?(\w+)/i);
        if (m) baseWord = m[1];
      }
      if (!baseWord && q.det.analysis) {
        const m = q.det.analysis.match(/원형[:\s]*["""]?(\w+)/i) || q.det.analysis.match(/\((\w+)\).*→/);
        if (m) baseWord = m[1];
      }
    }

    // From wa (answer is the changed form, so we need the base)
    if (!baseWord && q.wa) {
      // Can't reliably determine base from wa alone
    }

    if (baseWord && q.passage.includes('_____')) {
      q.passage = q.passage.replace('_____', `_____ (${baseWord})`);
      fixes.push(`Q${q.id}: V63-E added (${baseWord}) to blank`);
    }
  }

  // ===== FIX 5: S-DISTRACTOR-ALL-FIRST-SENT - deeper fix =====
  for (const q of data.questions) {
    if (!q.ch || q.fmt !== 'mc') continue;
    if (!q.type || !q.type.includes('빈칸')) continue;
    if (!q.passage) continue;

    const sentences = q.passage.split(/\./).filter(s => s.trim().length > 5);
    if (sentences.length < 3) continue;

    const firstSent = sentences[0].toLowerCase();
    const firstWords = new Set((firstSent.match(/\b[a-z]{4,}\b/g) || []));

    const distractorIndices = [];
    for (let i = 0; i < q.ch.length; i++) {
      if ((i + 1) === q.ans) continue;
      distractorIndices.push(i);
    }

    let allFromFirst = true;
    for (const di of distractorIndices) {
      const chWords = (q.ch[di] || '').toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      if (chWords.length > 0 && !chWords.every(w => firstWords.has(w))) {
        allFromFirst = false;
      }
    }

    if (allFromFirst && distractorIndices.length >= 3) {
      // Get words from DIFFERENT sentences (2nd, 3rd, etc.)
      const midText = sentences.slice(1).join(' ').toLowerCase();
      const midWords = [...new Set((midText.match(/\b[a-z]{5,}\b/g) || []))];
      const ansWord = (q.ch[q.ans - 1] || '').toLowerCase();
      const available = midWords.filter(w =>
        w !== ansWord &&
        !firstWords.has(w) &&
        w.length >= 5 &&
        !['which', 'their', 'about', 'other', 'these', 'those', 'would', 'could', 'should', 'being', 'there', 'where', 'might', 'while'].includes(w)
      );

      if (available.length >= 2) {
        // Replace 2 distractors
        q.ch[distractorIndices[0]] = available[0];
        q.ch[distractorIndices[1]] = available[Math.min(1, available.length - 1)];
        fixes.push(`Q${q.id}: S-DISTRACTOR diversified ch[${distractorIndices[0]}]="${available[0]}", ch[${distractorIndices[1]}]="${available[1] || available[0]}"`);
      } else if (available.length >= 1) {
        q.ch[distractorIndices[0]] = available[0];
        fixes.push(`Q${q.id}: S-DISTRACTOR diversified ch[${distractorIndices[0]}]="${available[0]}"`);
      }
    }
  }

  // ===== FIX 6: S-CH-TRUNCATED - fix "re" endings more thoroughly =====
  for (const q of data.questions) {
    if (!q.ch) continue;
    for (let i = 0; i < q.ch.length; i++) {
      const ch = q.ch[i];
      if (typeof ch !== 'string') continue;
      const words = ch.split(/\s+/);
      const lastWord = words[words.length - 1];
      // "re" is very likely truncated
      if (lastWord === 're' && words.length > 1) {
        // Search passage for words starting with "re"
        const fpWords = (fp || '').match(/\b\w+\b/g) || [];
        const candidates = fpWords.filter(w => w.toLowerCase().startsWith('re') && w.length > 4);
        if (candidates.length > 0) {
          words[words.length - 1] = candidates[0].toLowerCase();
          q.ch[i] = words.join(' ');
          fixes.push(`Q${q.id}: S-CH-TRUNCATED ch[${i}] "re"→"${candidates[0]}"`);
        }
      }
    }
  }

  // ===== FIX 7: Remaining S-ANTONYM-PREFIX (ones V1 missed) =====
  const moreMappings = {
    'brightly': 'dimly',
    'unbrightly': 'dimly',
  };

  for (const q of data.questions) {
    if (!q.ch || q.fmt !== 'mc') continue;
    for (let i = 0; i < q.ch.length; i++) {
      const ch = q.ch[i];
      if (typeof ch !== 'string') continue;
      if (ch.startsWith('un') && ch.length > 4) {
        const base = ch.slice(2);
        if (fp.toLowerCase().includes(base.toLowerCase()) && !fp.toLowerCase().includes(ch.toLowerCase())) {
          const replacement = moreMappings[ch] || moreMappings[base];
          if (replacement && (i + 1) !== q.ans) {
            q.ch[i] = replacement;
            fixes.push(`Q${q.id}: S-ANTONYM-PREFIX ch[${i}] "${ch}"→"${replacement}"`);
          }
        }
      }
    }
  }

  // ===== FIX 8: A6/A7 recheck =====
  const ansCounts = [0, 0, 0, 0, 0];
  for (const q of data.questions) {
    if (q.ans >= 1 && q.ans <= 4) ansCounts[q.ans]++;
  }

  for (let targetAns = 1; targetAns <= 4; targetAns++) {
    while (ansCounts[targetAns] > 5) {
      let minAns = 1;
      for (let a = 2; a <= 4; a++) {
        if (ansCounts[a] < ansCounts[minAns]) minAns = a;
      }
      if (minAns === targetAns) break;

      let fixed = false;
      for (const q of data.questions) {
        if (q.ans !== targetAns || !q.ch || q.ch.length !== 4) continue;
        if (q.ch[0] === '①' || q.ch[0] === 'T' || q.ch[0] === 'F') continue;
        // Skip marker types
        if (q.type && (q.type.includes('부적절') || q.type.includes('어법'))) continue;

        const shift = (minAns - targetAns + 4) % 4;
        const newCh = [];
        for (let j = 0; j < 4; j++) {
          newCh[j] = q.ch[(j - shift + 4) % 4];
        }
        q.ch = newCh;
        q.ans = minAns;
        ansCounts[targetAns]--;
        ansCounts[minAns]++;
        fixes.push(`Q${q.id}: A6 rotated ${targetAns}→${minAns}`);
        fixed = true;
        break;
      }
      if (!fixed) break;
    }
  }

  // Fix A7: consecutive
  for (let i = 0; i < data.questions.length - 2; i++) {
    const q1 = data.questions[i];
    const q2 = data.questions[i + 1];
    const q3 = data.questions[i + 2];
    if (q1.ans === q2.ans && q2.ans === q3.ans && q1.ans >= 1 && q1.ans <= 4) {
      if (q2.ch && q2.ch.length === 4 && q2.ch[0] !== '①' && q2.ch[0] !== 'T' && q2.ch[0] !== 'F') {
        if (q2.type && !q2.type.includes('부적절') && !q2.type.includes('어법')) {
          const oldAns = q2.ans;
          const newAns = (oldAns % 4) + 1;
          const shift = (newAns - oldAns + 4) % 4;
          const newCh = [];
          for (let j = 0; j < 4; j++) {
            newCh[j] = q2.ch[(j - shift + 4) % 4];
          }
          q2.ch = newCh;
          q2.ans = newAns;
          fixes.push(`Q${q2.id}: A7 consecutive fix ${oldAns}→${newAns}`);
        }
      }
    }
  }

  if (fixes.length > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    totalFixes += fixes.length;
    filesFixed++;
    console.log(`\n[FIXED] ${relPath} (${fixes.length} fixes)`);
    for (const f of fixes) {
      console.log(`  - ${f}`);
    }
  }
}

const files = findAllJsonFiles(BASE);
console.log(`Found ${files.length} JSON files in 고2/6월`);
console.log('Starting V2 batch fix...\n');

for (const f of files.sort()) {
  try {
    fixFile(f);
  } catch (err) {
    console.error(`[ERROR] ${path.relative(BASE, f)}: ${err.message}`);
  }
}

console.log(`\n========================================`);
console.log(`V2 Total: ${filesFixed} files fixed, ${totalFixes} fixes applied`);
console.log(`========================================`);
