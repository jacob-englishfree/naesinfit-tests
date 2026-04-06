#!/usr/bin/env node
/**
 * fix-n1-pul4.js — N1 + P-UL4 자동 수정
 *
 * N1: 선지 ①②③④인데 passage에 마커 없음 → fullPassage에서 문장 사이에 마커 삽입
 * P-UL4: 어법 밑줄찾기인데 마커 부족 → ch[] 단어를 passage에서 찾아 <u> 태그 추가
 *
 * Usage:
 *   node validate/fix-n1-pul4.js --all
 *   node validate/fix-n1-pul4.js --dry-run --all
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const all = process.argv.includes('--all');

const GRAMMAR_TYPES = ['어법', '어법 빈칸', '어법 밑줄형', '문맥상 부적절한 어휘', '어휘'];
const MARKER_TYPES = ['문장삽입', '오류찾기'];
const MARKERS = ['①', '②', '③', '④'];

function findJsonFiles(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== '_passages' && entry.name !== 'node_modules') {
        results = results.concat(findJsonFiles(full));
      } else if (entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

function splitSentences(text) {
  // Split on period/question mark/exclamation followed by space and capital letter
  // But preserve quotes, abbreviations, etc.
  const sentences = [];
  let current = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    current += chars[i];
    if ((chars[i] === '.' || chars[i] === '?' || chars[i] === '!') &&
        i + 1 < chars.length && chars[i+1] === ' ' &&
        i + 2 < chars.length && /[A-Z"'"(]/.test(chars[i+2])) {
      sentences.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences;
}

function extractChWord(ch) {
  // "① permitting" → "permitting", "① " prefix removed
  return ch.replace(/^[①②③④⑤]\s*/, '').trim();
}

function hasMarkers(passage) {
  if (!passage) return false;
  return /[①②③④]/.test(passage) || /<u>/.test(passage);
}

function countUTags(passage) {
  if (!passage) return 0;
  return (passage.match(/<u>/g) || []).length;
}

let totalScanned = 0;
let totalFixed = 0;
let n1Fixed = 0;
let pul4Fixed = 0;

const dirs = all ? [path.join(ROOT, 'data')] : process.argv.filter(a => !a.startsWith('-')).slice(2).map(d => path.resolve(d));
const files = [];
for (const d of dirs) {
  files.push(...findJsonFiles(d));
}

console.log(`Scanning ${files.length} files...`);

for (const filePath of files) {
  totalScanned++;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { continue; }

  if (!data.questions) continue;

  let modified = false;
  const rel = path.relative(ROOT, filePath);

  for (const q of data.questions) {
    // === P-UL4: 어법 밑줄 부족 ===
    if (q.passage && q.ch && q.ch.length >= 4) {
      const isGrammar = q.type && (q.type.includes('어법') || q.type.includes('어휘') || q.type.includes('부적절'));
      const stemHasUnderline = q.stem && (q.stem.includes('밑줄') || q.stem.includes('①~④'));

      if (isGrammar && stemHasUnderline) {
        const uCount = countUTags(q.passage);
        if (uCount < 4) {
          // Try to add <u> tags for ch words
          let p = q.passage;
          let addedCount = 0;

          for (let i = 0; i < q.ch.length && i < 4; i++) {
            const word = extractChWord(q.ch[i]);
            if (!word || word.length < 2) continue;

            const marker = MARKERS[i];
            // Check if this word already has <u> in passage
            const uPattern = new RegExp(`<u>[^<]*${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*</u>`);
            if (uPattern.test(p)) continue;

            // Find the word in passage and add marker + <u>
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordRe = new RegExp(`(?<![<①②③④])\\b${escapedWord}\\b(?![^<]*</u>)`, 'i');
            const match = p.match(wordRe);
            if (match) {
              const idx = match.index;
              p = p.substring(0, idx) + `${marker}<u>${match[0]}</u>` + p.substring(idx + match[0].length);
              addedCount++;
            }
          }

          if (addedCount > 0 && countUTags(p) >= 4) {
            if (!dryRun) q.passage = p;
            pul4Fixed++;
            modified = true;
            console.log(`  P-UL4 Q${q.id}: +${addedCount} 밑줄 (${uCount}→${countUTags(p)})`);
          }
        }
      }
    }

    // === N1: 문장삽입/오류찾기 마커 없음 ===
    if (q.ch && q.ch.length === 4 &&
        q.ch[0] === '①' && q.ch[1] === '②' && q.ch[2] === '③' && q.ch[3] === '④') {

      // passage가 null/undefined면 fullPassage에서 생성
      if (!q.passage && data.fullPassage) {
        const sentences = splitSentences(data.fullPassage);
        if (sentences.length >= 4) {
          // Insert markers between sentences
          let p = '';
          for (let i = 0; i < sentences.length; i++) {
            if (i > 0 && i <= 4) {
              p += ` ${MARKERS[i-1]} `;
            } else if (i > 0) {
              p += ' ';
            }
            p += sentences[i];
          }
          if (!dryRun) q.passage = p;
          n1Fixed++;
          modified = true;
          console.log(`  N1 Q${q.id}: passage 생성 (${sentences.length}문장, 마커 삽입)`);
        }
      } else if (q.passage && !hasMarkers(q.passage)) {
        // passage가 있지만 마커가 없는 경우
        const sentences = splitSentences(q.passage);
        if (sentences.length >= 4) {
          let p = '';
          for (let i = 0; i < sentences.length; i++) {
            if (i > 0 && i <= 4) {
              p += ` ${MARKERS[i-1]} `;
            } else if (i > 0) {
              p += ' ';
            }
            p += sentences[i];
          }
          if (!dryRun) q.passage = p;
          n1Fixed++;
          modified = true;
          console.log(`  N1 Q${q.id}: 마커 삽입 (${sentences.length}문장)`);
        }
      }
    }
  }

  if (modified) {
    totalFixed++;
    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
    console.log(`📝 ${rel}`);
  }
}

console.log(`\n━━━ fix-n1-pul4 결과 ━━━`);
console.log(`파일: ${totalScanned}개 스캔, ${totalFixed}개 수정`);
console.log(`N1 (마커 삽입): ${n1Fixed}건`);
console.log(`P-UL4 (밑줄 추가): ${pul4Fixed}건`);
if (dryRun) console.log('(dry-run 모드 — 실제 수정 안 함)');
