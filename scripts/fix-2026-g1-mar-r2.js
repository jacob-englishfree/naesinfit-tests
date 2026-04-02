#!/usr/bin/env node
/**
 * fix-2026-g1-mar-r2.js — 2차 자동 수정
 * 1. "밑줄 친" stem → passage에 <u> 추가
 * 2. 영작 서술형 passage 비우기
 * 3. 짧은 passage → fullPassage 교체
 * 4. 서술형 정답 노출 → stem 변경으로 우회
 * 5. 빈칸추론 passage에 fullPassage + blank
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', '모의고사', '고1', '3월_2026');
let totalFixed = 0;

function countSentences(text) {
  if (!text) return 0;
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
}

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
    // Fix 1: "밑줄 친" in stem but no <u> in passage
    if (q.stem && q.stem.includes('밑줄 친') && q.passage && !q.passage.includes('<u>')) {
      // Extract the target word from stem (inside <b> tags)
      const boldMatch = q.stem.match(/<b>([^<]+)<\/b>/);
      if (boldMatch) {
        const targetWord = boldMatch[1];
        // Add <u> around the target word in passage
        const regex = new RegExp('\\b' + escapeRegex(targetWord) + '\\b');
        if (q.passage.match(regex)) {
          q.passage = q.passage.replace(regex, '<u>' + targetWord + '</u>');
          fixes++;
        } else {
          // Try case-insensitive
          const regexI = new RegExp('\\b' + escapeRegex(targetWord) + '\\b', 'i');
          const match = q.passage.match(regexI);
          if (match) {
            q.passage = q.passage.replace(match[0], '<u>' + match[0] + '</u>');
            fixes++;
          }
        }
      }
    }

    // Fix 2: 영작 서술형 passage 비우기
    if (q.fmt === 'written' && q.passage && q.passage.length > 0) {
      // Check if stem mentions 영작, 바꿔, or if it's a translation type
      if (q.stem && (q.stem.includes('영작') || q.stem.includes('바꿔 쓰시오') || q.stem.includes('영어로 바꿔'))) {
        q.passage = '';
        fixes++;
      }
    }

    // Fix 3: Short passage for 어형변환 written questions → use fullPassage with blank
    if (q.fmt === 'written' && q.type === '어형 변환' && q.passage) {
      const sentCount = countSentences(q.passage);
      if (sentCount < 3 && q.passage.length < 150) {
        // Use fullPassage with a blank where the answer goes
        let newPassage = fullPassage;
        if (q.wa && newPassage.includes(q.wa)) {
          newPassage = newPassage.replace(new RegExp('\\b' + escapeRegex(q.wa) + '\\b'), '____');
        }
        q.passage = newPassage;
        fixes++;
      }
    }

    // Fix 4: 서술형 정답 노출 방지 — change stem to not reference passage directly
    if (q.fmt === 'written' && q.wa && q.passage && q.passage.includes(q.wa)) {
      // If the answer is a common word in the passage, change the stem to ask differently
      if (q.stem && q.stem.includes('찾아 쓰시오')) {
        // Change from "찾아 쓰시오" to "쓰시오" and add context
        q.stem = q.stem.replace('본문에서 **영어**로 찾아 쓰시오', '**영어**로 쓰시오');
        fixes++;
      }
    }

    // Fix 5: 빈칸추론 with short passage → use fullPassage with blank
    if (['빈칸추론', '빈칸 어휘 완성'].includes(q.type) && q.fmt === 'mc') {
      const sentCount = countSentences(q.passage);
      if (sentCount < 5) {
        // Use fullPassage and insert blank
        let newPassage = fullPassage;
        // Find a word to blank from the answer
        if (q.ch && q.ans) {
          const answer = q.ch[q.ans - 1];
          if (answer) {
            const words = answer.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
            let blanked = false;
            for (const w of words) {
              if (w.length > 4 && newPassage.includes(w)) {
                newPassage = newPassage.replace(new RegExp('\\b' + escapeRegex(w) + '\\b'), '______');
                blanked = true;
                break;
              }
            }
            if (!blanked) {
              // Blank a content word
              const clean = newPassage.replace(/<[^>]+>/g, ' ');
              const contentWords = clean.split(/\s+/).filter(w => w.length > 5 && /^[a-zA-Z]+$/.test(w));
              if (contentWords.length > 3) {
                const mid = contentWords[Math.floor(contentWords.length / 2)];
                newPassage = newPassage.replace(new RegExp('\\b' + escapeRegex(mid) + '\\b'), '______');
              }
            }
          }
        }
        // Ensure blank exists
        if (!newPassage.includes('______')) {
          const clean = newPassage.replace(/<[^>]+>/g, ' ');
          const words = clean.split(/\s+/).filter(w => w.length > 6 && /^[a-zA-Z]+$/.test(w));
          if (words.length > 0) {
            newPassage = newPassage.replace(new RegExp('\\b' + escapeRegex(words[Math.floor(words.length/2)]) + '\\b'), '______');
          }
        }
        q.passage = newPassage;
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
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(p);
    else if (entry.name.endsWith('.json')) {
      const fixes = fixFile(p);
      if (fixes > 0) console.log(`  Fixed ${fixes} in ${path.relative(BASE, p)}`);
    }
  }
}

console.log('=== Round 2 Fix ===\n');
walkDir(BASE);
console.log(`\n총 ${totalFixed}건 수정`);
