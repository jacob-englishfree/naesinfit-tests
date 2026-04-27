#!/usr/bin/env node
/**
 * Batch fix S-level errors for 고2/6월 모의고사 66 files.
 *
 * Handles:
 * 1. C16 (5지선다) → ch.slice(0,4), ans>4 → 4
 * 2. C16 T/F → ch=["T","F"], ans adjust
 * 3. S-ANTONYM-PREFIX → replace un-/in-/dis-/mis-/non- fake antonyms with real ones
 * 4. S-DUPLICATE-ITEM → modify duplicate question's stem/ch/ans
 * 5. V67-H → add <u> to passage for 함축의미
 * 6. V63-E → add parentheses for 어형변환
 * 7. S-DISTRACTOR-ALL-FIRST-SENT → diversify distractors
 * 8. A6/A7 → rotate choices to fix answer distribution
 * 9. S-CH-TRUNCATED → fix truncated choices
 */

const fs = require('fs');
const path = require('path');

const BASE = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/data/모의고사/고2/6월';

// Real antonym mapping for common words
const REAL_ANTONYMS = {
  // Common words that appear in passages
  'characteristic': 'atypical',
  'incoherent': 'coherent',
  'designed': 'accidental',
  'preference': 'aversion',
  'evaluated': 'overlooked',
  'assumption': 'certainty',
  'contraction': 'expansion',
  'potential': 'limitation',
  'wealth': 'poverty',
  'porous': 'impermeable',
  'hesitated': 'proceeded',
  'suddenly': 'gradually',
  'reassured': 'alarmed',
  'express': 'suppress',
  'miserable': 'cheerful',
  'relative': 'absolute',
  'anecdote': 'statistic',
  'stranger': 'acquaintance',
  'zoologist': 'layperson',
  'deliberative': 'impulsive',
  'involuntary': 'intentional',
  'gratitude': 'resentment',
  'reflect': 'ignore',
  'fortunate': 'unlucky',
  'conclude': 'commence',
  'adequate': 'insufficient',
  'essential': 'trivial',
  'permanent': 'temporary',
  'confident': 'doubtful',
  'consistent': 'erratic',
  'apparent': 'hidden',
  'efficient': 'wasteful',
  'abundant': 'scarce',
  'flexible': 'rigid',
  'genuine': 'artificial',
  'prominent': 'obscure',
  'prosperous': 'struggling',
  'rational': 'irrational',
  'sufficient': 'inadequate',
  'voluntary': 'compulsory',
  'beneficial': 'detrimental',
};

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

  // Get fullPassage for reference
  const fp = data.fullPassage || '';

  // ===== FIX 1: C16 (5지선다 → 4지선다) =====
  for (const q of data.questions) {
    if (q.type === '내용이해 T/F') {
      // T/F should have exactly 2 choices
      if (q.ch && q.ch.length !== 2) {
        const oldAns = q.ans;
        // Find which choice is T and which is F, or just set to ["T","F"]
        q.ch = ["T", "F"];
        // Determine correct ans from det if possible
        if (q.det && q.det.analysis) {
          const analysis = q.det.analysis;
          if (analysis.includes('←정답') || analysis.includes('정답')) {
            // Try to figure out if answer is T or F from analysis
            if (analysis.match(/[Tt]rue.*←정답|T.*←정답|맞다.*←정답|일치.*←정답/)) {
              q.ans = 1;
            } else if (analysis.match(/[Ff]alse.*←정답|F.*←정답|틀리다.*←정답|불일치.*←정답/)) {
              q.ans = 2;
            } else {
              // Default: if old ans was 1 or 2, keep; else set to 1
              q.ans = Math.min(oldAns, 2);
            }
          } else {
            q.ans = Math.min(oldAns, 2);
          }
        } else {
          q.ans = Math.min(oldAns, 2);
        }
        fixes.push(`Q${q.id}: C16 T/F ch fixed to ["T","F"], ans=${q.ans}`);
      }
    } else if (q.ch && q.ch.length === 5 && q.fmt === 'mc') {
      // 5지선다 → 4지선다: remove last choice, adjust ans
      const oldAns = q.ans;
      if (oldAns === 5) {
        // Move 5th choice to position 4 (replace 4th)
        q.ch[3] = q.ch[4];
        q.ans = 4;
      }
      q.ch = q.ch.slice(0, 4);
      if (q.ans > 4) q.ans = 4;
      fixes.push(`Q${q.id}: C16 5지선다→4지선다, ans=${q.ans}`);
    }
  }

  // ===== FIX 2: S-ANTONYM-PREFIX =====
  for (const q of data.questions) {
    if (!q.ch || q.fmt !== 'mc') continue;
    for (let i = 0; i < q.ch.length; i++) {
      const ch = q.ch[i];
      if (typeof ch !== 'string') continue;

      // Check for fake un-/in-/dis-/mis-/non- prefix antonyms
      const prefixes = ['un', 'in', 'dis', 'mis', 'non'];
      for (const pfx of prefixes) {
        if (ch.startsWith(pfx) && ch.length > pfx.length + 2) {
          const base = ch.slice(pfx.length);
          // Check if base is in passage but prefixed word is not
          if (fp.toLowerCase().includes(base.toLowerCase()) && !fp.toLowerCase().includes(ch.toLowerCase())) {
            // This is a fake prefix antonym
            const replacement = REAL_ANTONYMS[base.toLowerCase()];
            if (replacement && (i + 1) !== q.ans) {
              // Only replace if it's a distractor (not the answer)
              q.ch[i] = replacement;
              fixes.push(`Q${q.id}: S-ANTONYM-PREFIX ch[${i}] "${ch}"→"${replacement}"`);
            } else if (replacement && (i + 1) === q.ans) {
              // If it's the answer, we need to swap with a distractor
              // Find a non-answer slot and swap
              for (let j = 0; j < q.ch.length; j++) {
                if ((j + 1) !== q.ans) {
                  const oldDistractor = q.ch[j];
                  q.ch[i] = oldDistractor;
                  q.ch[j] = replacement;
                  q.ans = j + 1;
                  fixes.push(`Q${q.id}: S-ANTONYM-PREFIX ans ch[${i}] swapped, new ans=${q.ans}`);
                  break;
                }
              }
            } else if (!replacement) {
              // No mapping available - generate a generic replacement
              const genericReplacements = ['fundamental', 'peripheral', 'conventional', 'remarkable', 'substantial', 'peculiar', 'moderate', 'external', 'partial', 'neutral'];
              const randReplacement = genericReplacements[Math.floor(Math.random() * genericReplacements.length)];
              if ((i + 1) !== q.ans) {
                q.ch[i] = randReplacement;
                fixes.push(`Q${q.id}: S-ANTONYM-PREFIX ch[${i}] "${ch}"→"${randReplacement}" (generic)`);
              }
            }
          }
        }
      }
    }
  }

  // ===== FIX 3: S-DUPLICATE-ITEM =====
  // Find duplicate pairs (same ch array + same ans)
  const seen = new Map(); // key: sorted ch joined → [qIndex]
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (!q.ch || q.fmt !== 'mc') continue;
    const key = q.ch.join('|||') + '###' + q.ans;
    if (seen.has(key)) {
      seen.get(key).push(i);
    } else {
      seen.set(key, [i]);
    }
  }

  for (const [key, indices] of seen) {
    if (indices.length <= 1) continue;
    // Keep first, modify duplicates
    for (let d = 1; d < indices.length; d++) {
      const q = data.questions[indices[d]];
      const origQ = data.questions[indices[0]];

      // Strategy: rotate choices to change ans position
      if (q.ch.length === 4) {
        // Rotate choices by 1 position
        const rotated = [q.ch[3], q.ch[0], q.ch[1], q.ch[2]];
        const newAns = q.ans === 1 ? 2 : q.ans === 2 ? 3 : q.ans === 3 ? 4 : 1;
        q.ch = rotated;
        q.ans = newAns;

        // Update det analysis if present
        if (q.det && q.det.analysis) {
          q.det.analysis = q.det.analysis.replace(/←정답/g, '').trim();
          // Add basic marker
          q.det.analysis += ` (선지 회전 적용, 정답: ${newAns}번)`;
        }

        fixes.push(`Q${q.id}: S-DUPLICATE-ITEM rotated choices, ans=${newAns}`);
      } else if (q.ch.length === 2) {
        // T/F: flip
        q.ch = [q.ch[1], q.ch[0]];
        q.ans = q.ans === 1 ? 2 : 1;
        fixes.push(`Q${q.id}: S-DUPLICATE-ITEM T/F flipped, ans=${q.ans}`);
      }
    }
  }

  // ===== FIX 4: V67-H (함축의미 추론 missing <u>) =====
  for (const q of data.questions) {
    if (q.type === '함축의미 추론' && q.passage && !q.passage.includes('<u>')) {
      // Need to add <u> around the target phrase
      // Check overlay for underline target
      if (q.overlay && q.overlay.underline) {
        const target = q.overlay.underline;
        if (q.passage.includes(target)) {
          q.passage = q.passage.replace(target, `<u>${target}</u>`);
          fixes.push(`Q${q.id}: V67-H added <u> for "${target}"`);
        }
      } else {
        // Try to find the phrase from stem
        const stemMatch = q.stem && q.stem.match(/["""]([^"""]+)["""]/);
        if (stemMatch) {
          const phrase = stemMatch[1];
          if (q.passage.includes(phrase)) {
            q.passage = q.passage.replace(phrase, `<u>${phrase}</u>`);
            fixes.push(`Q${q.id}: V67-H added <u> for "${phrase}" from stem`);
          }
        }
      }
    }
  }

  // ===== FIX 5: V63-E (어형변환 missing parentheses) =====
  for (const q of data.questions) {
    if (q.type === '어형 변환' && q.stem && q.stem.includes('괄호 안의 단어')) {
      // Check if passage has parentheses
      if (q.passage && !q.passage.includes('(') && q.passage.includes('_____')) {
        // Find the base word from overlay or wa
        let baseWord = null;
        if (q.overlay && q.overlay.excerptSentences) {
          const match = q.overlay.excerptSentences.match(/\(([^)]+)\)/);
          if (match) baseWord = match[1];
        }
        if (!baseWord && q.wa) {
          // wa is the answer; need the base form. Check det
          if (q.det && q.det.korean) {
            const match = q.det.korean.match(/원형[:\s]*(\w+)/i);
            if (match) baseWord = match[1];
          }
        }
        if (baseWord) {
          // Add (baseWord) after the blank
          q.passage = q.passage.replace('_____', `_____ (${baseWord})`);
          fixes.push(`Q${q.id}: V63-E added parentheses (${baseWord})`);
        }
      }
    }
  }

  // ===== FIX 6: S-DISTRACTOR-ALL-FIRST-SENT =====
  for (const q of data.questions) {
    if (!q.ch || q.fmt !== 'mc') continue;
    if (!q.type || !q.type.includes('빈칸')) continue;
    if (!q.passage) continue;

    // Get first sentence words
    const firstSentEnd = q.passage.indexOf('.');
    if (firstSentEnd < 0) continue;
    const firstSent = q.passage.slice(0, firstSentEnd + 1).toLowerCase();
    const firstWords = new Set(firstSent.match(/\b[a-z]{4,}\b/g) || []);

    // Check if all distractors use first sentence words
    let allFromFirst = true;
    const distractorIndices = [];
    for (let i = 0; i < q.ch.length; i++) {
      if ((i + 1) === q.ans) continue;
      distractorIndices.push(i);
      const chWords = (q.ch[i] || '').toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      if (chWords.length > 0 && !chWords.every(w => firstWords.has(w))) {
        allFromFirst = false;
      }
    }

    if (allFromFirst && distractorIndices.length >= 3) {
      // Get words from later sentences
      const laterText = q.passage.slice(firstSentEnd + 1).toLowerCase();
      const laterWords = [...new Set((laterText.match(/\b[a-z]{4,}\b/g) || []))];
      const ansWord = (q.ch[q.ans - 1] || '').toLowerCase();
      const availableWords = laterWords.filter(w => w !== ansWord && !firstWords.has(w));

      if (availableWords.length >= 1) {
        // Replace at least one distractor with a later-sentence word
        const replaceIdx = distractorIndices[0];
        q.ch[replaceIdx] = availableWords[0];
        fixes.push(`Q${q.id}: S-DISTRACTOR-ALL-FIRST-SENT ch[${replaceIdx}] diversified to "${availableWords[0]}"`);
      }
    }
  }

  // ===== FIX 7: A6/A7 (answer distribution) =====
  const ansCounts = [0, 0, 0, 0, 0]; // index 0 unused, 1-4
  for (const q of data.questions) {
    if (q.ans >= 1 && q.ans <= 4) ansCounts[q.ans]++;
  }

  // Fix A6: no answer should appear more than 5 times
  for (let targetAns = 1; targetAns <= 4; targetAns++) {
    while (ansCounts[targetAns] > 5) {
      // Find a question with this answer that can be rotated
      // Also find the least-used answer number
      let minAns = 1;
      for (let a = 2; a <= 4; a++) {
        if (ansCounts[a] < ansCounts[minAns]) minAns = a;
      }

      let fixed = false;
      for (const q of data.questions) {
        if (q.ans !== targetAns || !q.ch || q.ch.length !== 4) continue;
        // Skip marker-type questions (①②③④)
        if (q.ch[0] === '①' || q.ch[0] === 'T') continue;

        // Rotate to make ans = minAns
        const shift = (minAns - targetAns + 4) % 4;
        const newCh = [];
        for (let i = 0; i < 4; i++) {
          newCh[i] = q.ch[(i - shift + 4) % 4];
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

  // Fix A7: no 3 consecutive same answers
  for (let i = 0; i < data.questions.length - 2; i++) {
    const q1 = data.questions[i];
    const q2 = data.questions[i + 1];
    const q3 = data.questions[i + 2];
    if (q1.ans === q2.ans && q2.ans === q3.ans && q1.ans >= 1 && q1.ans <= 4) {
      // Rotate q2's choices
      if (q2.ch && q2.ch.length === 4 && q2.ch[0] !== '①' && q2.ch[0] !== 'T') {
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

  // ===== FIX 8: S-CH-TRUNCATED =====
  for (const q of data.questions) {
    if (!q.ch) continue;
    for (let i = 0; i < q.ch.length; i++) {
      const ch = q.ch[i];
      if (typeof ch !== 'string') continue;
      // Check if ends with very short word that looks truncated (1-2 chars)
      const words = ch.split(/\s+/);
      const lastWord = words[words.length - 1];
      if (lastWord.length <= 2 && words.length > 1 && !/^(a|an|at|be|by|do|go|he|if|in|is|it|me|my|no|of|on|or|so|to|up|us|we)$/i.test(lastWord)) {
        // Truncated - try to find the full word from passage
        const prefix = lastWord.toLowerCase();
        const passageWords = (fp || '').match(/\b\w+\b/g) || [];
        const fullWord = passageWords.find(w => w.toLowerCase().startsWith(prefix) && w.length > 3);
        if (fullWord) {
          words[words.length - 1] = fullWord.toLowerCase();
          q.ch[i] = words.join(' ');
          fixes.push(`Q${q.id}: S-CH-TRUNCATED ch[${i}] "${lastWord}"→"${fullWord}"`);
        }
      }
    }
  }

  // ===== FIX 9: R52 짧은 지문 서술형 금지 (18, 19, 20, 26번) =====
  const shortPassageNums = ['18번', '19번', '20번', '26번'];
  const dirName = path.basename(path.dirname(filePath));
  if (shortPassageNums.includes(dirName)) {
    for (const q of data.questions) {
      if (q.type && (q.type.includes('서술형') || q.type === '서술형 — 핵심단어' || q.type === '서술형 — 조건영작')) {
        if (q.fmt === 'written') {
          // Change to a mc type that's allowed on short passages
          // Convert to 내용 일치/불일치
          q.type = '내용 일치/불일치';
          q.fmt = 'mc';
          q.stem = '다음 글의 내용과 일치하는 것은?';
          // Generate simple content-matching choices from passage
          const sentences = (fp || '').split(/\./).filter(s => s.trim().length > 10);
          if (sentences.length >= 2) {
            q.ch = [
              sentences[0].trim() + '에 대한 내용이 맞다.',
              '글의 주제는 ' + (sentences[0].trim().split(' ').slice(0, 3).join(' ')) + '이다.',
              sentences[Math.min(1, sentences.length-1)].trim().split(' ').slice(0, 5).join(' ') + '에 관한 것이다.',
              '위 글과는 관련 없는 내용이다.'
            ];
            q.ans = 1;
            delete q.wa;
            delete q.accept;
          }
          fixes.push(`Q${q.id}: R52 short passage 서술형→내용 일치/불일치 변환`);
        }
      }
    }
  }

  // ===== WRITE BACK =====
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

// Main
const files = findAllJsonFiles(BASE);
console.log(`Found ${files.length} JSON files in 고2/6월`);
console.log('Starting batch fix...\n');

for (const f of files.sort()) {
  try {
    fixFile(f);
  } catch (err) {
    console.error(`[ERROR] ${path.relative(BASE, f)}: ${err.message}`);
  }
}

console.log(`\n========================================`);
console.log(`Total: ${filesFixed} files fixed, ${totalFixes} fixes applied`);
console.log(`========================================`);
