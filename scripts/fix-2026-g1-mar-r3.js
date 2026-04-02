#!/usr/bin/env node
/**
 * fix-2026-g1-mar-r3.js — 3차 자동 수정
 * 1. "밑줄 친 WORD" → passage에 <u>WORD</u> 추가 + stem에 <b>WORD</b>
 * 2. 영작 서술형 passage 비우기
 * 3. 남은 짧은 passage → fullPassage
 * 4. 반의어 stem "다음 중 'word'" → passage에 <u> 추가
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', '모의고사', '고1', '3월_2026');
let totalFixed = 0;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fixFile(filePath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return 0; }

  const fullPassage = data.fullPassage;
  if (!fullPassage) return 0;

  let fixes = 0;

  for (const q of data.questions) {
    if (!q.stem) continue;

    // Pattern 1: "밑줄 친 WORD와/의/에/을" (without <b>)
    if (q.stem.includes('밑줄 친') && q.passage && !q.passage.includes('<u>')) {
      let targetWord = null;

      // Try: "밑줄 친 <b>word</b>"
      const boldMatch = q.stem.match(/<b>([^<]+)<\/b>/);
      if (boldMatch) {
        targetWord = boldMatch[1];
      }

      // Try: "밑줄 친 word와/의/에/을/이/가/로" (Korean particle follows English word)
      if (!targetWord) {
        const plainMatch = q.stem.match(/밑줄\s*친\s+([a-zA-Z][a-zA-Z\s-]*[a-zA-Z])(?:[와의에을이가로]|와\s|의\s)/);
        if (plainMatch) targetWord = plainMatch[1].trim();
      }

      // Try: "밑줄 친 'word'"
      if (!targetWord) {
        const quotedMatch = q.stem.match(/밑줄\s*친\s+['"]([^'"]+)['"]/);
        if (quotedMatch) targetWord = quotedMatch[1].trim();
      }

      // Try: "다음 중 'word'의"
      if (!targetWord) {
        const quotedMatch2 = q.stem.match(/['']([a-zA-Z]+)['']/);
        if (quotedMatch2) targetWord = quotedMatch2[1].trim();
      }

      if (targetWord) {
        // Add <u> to passage
        const regex = new RegExp('(?<!<u>)\\b' + escapeRegex(targetWord) + '\\b(?!</u>)', 'i');
        const match = q.passage.match(regex);
        if (match) {
          q.passage = q.passage.replace(regex, '<u>' + match[0] + '</u>');
          fixes++;
        } else {
          // Word not in passage - use fullPassage
          const fMatch = fullPassage.match(regex);
          if (fMatch) {
            q.passage = fullPassage.replace(regex, '<u>' + fMatch[0] + '</u>');
            fixes++;
          }
        }

        // Add <b> to stem if not already there
        if (!q.stem.includes('<b>')) {
          q.stem = q.stem.replace(targetWord, '<b>' + targetWord + '</b>');
          fixes++;
        }
      }
    }

    // Pattern 2: "다음 중 'word'의 반의어" without <u> in passage
    if (q.stem.includes("반의어") && !q.stem.includes('밑줄 친') && q.passage && !q.passage.includes('<u>')) {
      const quotedMatch = q.stem.match(/['']([a-zA-Z]+)['']/);
      if (quotedMatch) {
        const word = quotedMatch[1];
        const regex = new RegExp('\\b' + escapeRegex(word) + '\\b', 'i');
        const match = q.passage.match(regex);
        if (match) {
          q.passage = q.passage.replace(regex, '<u>' + match[0] + '</u>');
          // Rewrite stem to use 밑줄 친 format
          q.stem = '밑줄 친 <b>' + word + '</b>의 의미와 가장 <b>먼</b> 것은?';
          fixes++;
        } else {
          // Use fullPassage
          const fMatch = fullPassage.match(regex);
          if (fMatch) {
            q.passage = fullPassage.replace(regex, '<u>' + fMatch[0] + '</u>');
            q.stem = '밑줄 친 <b>' + word + '</b>의 의미와 가장 <b>먼</b> 것은?';
            fixes++;
          }
        }
      }
    }

    // Pattern 3: 영영풀이 with "밑줄 친" in stem but no <u>
    if (q.type === '영영풀이 매칭' && q.passage && !q.passage.includes('<u>')) {
      // Find the answer word from choices
      if (q.ch && q.ans) {
        const answerWord = q.ch[q.ans - 1];
        if (answerWord) {
          const regex = new RegExp('\\b' + escapeRegex(answerWord) + '\\b', 'i');
          const fMatch = fullPassage.match(regex);
          if (fMatch) {
            q.passage = fullPassage;
            // Remove "밑줄 친" from stem since 영영풀이 doesn't need underline
            if (q.stem.includes('밑줄 친')) {
              q.stem = q.stem.replace(/밑줄\s*친\s+/, '');
            }
            fixes++;
          }
        }
      }
    }

    // Pattern 4: 영작/어형변환 서술형 — passage should be empty if stem says 영작/바꿔
    if (q.fmt === 'written' && q.passage && q.passage.length > 0) {
      if (q.stem && (q.stem.includes('주어진 단어를') || q.stem.includes('영작') ||
          q.stem.includes('바꿔 쓰시오') || q.stem.includes('영어로 바꿔') ||
          q.stem.includes('어형을 변환'))) {
        q.passage = '';
        fixes++;
      }
    }

    // Pattern 5: Short written passages → use fullPassage with blank
    if (q.fmt === 'written' && q.passage && q.passage.length > 0 && q.passage.length < 150) {
      if (q.type === '어형 변환' || q.stem.includes('빈칸')) {
        let newP = fullPassage;
        if (q.wa && newP.includes(q.wa)) {
          newP = newP.replace(new RegExp('\\b' + escapeRegex(q.wa) + '\\b'), '____');
        }
        q.passage = newP;
        fixes++;
      }
    }

    // Pattern 6: Short mc passage for 빈칸추론
    if (['빈칸추론', '빈칸 어휘 완성'].includes(q.type) && q.fmt === 'mc') {
      const clean = q.passage ? q.passage.replace(/<[^>]+>/g, ' ') : '';
      const sents = clean.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
      if (sents < 5) {
        let newP = fullPassage;
        if (!newP.includes('______')) {
          const words = newP.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 5 && /^[a-zA-Z]+$/.test(w));
          if (words.length > 3) {
            const mid = words[Math.floor(words.length / 2)];
            newP = newP.replace(new RegExp('\\b' + escapeRegex(mid) + '\\b'), '______');
          }
        }
        q.passage = newP;
        fixes++;
      }
    }
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    totalFixed += fixes;
  }
  return fixes;
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(p);
    else if (entry.name.endsWith('.json')) {
      const n = fixFile(p);
      if (n > 0) console.log(`  Fixed ${n} in ${path.relative(BASE, p)}`);
    }
  }
}

console.log('=== Round 3 Fix ===\n');
walkDir(BASE);
console.log(`\n총 ${totalFixed}건 수정`);
