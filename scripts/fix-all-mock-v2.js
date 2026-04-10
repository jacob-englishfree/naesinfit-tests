#!/usr/bin/env node
/**
 * 모의고사 2차 자동수정
 *
 * 1차에서 skip된 유형들 처리:
 * - S-PASSAGE-NOT-FULL for 어법/부적절: fullPassage + 마커/밑줄 이식
 * - V-WRITTEN-WORDCOUNT: stem에 (N단어) 추가
 * - V67/V67-H: 밑줄 필요 유형에 <u> 추가
 * - V68-U: 밑줄형 어법 관련
 * - S-NO-PASSAGE 잔여
 * - S-WA-IN-PASSAGE 잔여
 * - V63-E 잔여
 * - S-MARKER-LEAK 잔여
 * - S-PASSAGE-1-SENTENCE 잔여
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', '모의고사');
let totalFixes = 0;
let filesModified = 0;
const codeCounts = {};

function fix(code) { totalFixes++; codeCounts[code] = (codeCounts[code] || 0) + 1; }
function esc(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function getAllFiles() {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.json')) results.push(p);
    }
  }
  walk(BASE);
  return results;
}

function processFile(filePath) {
  let data;
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return false; }
  const fp = data.fullPassage;
  if (!fp || !data.questions) return false;
  let modified = false;

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    const type = q.type || '';
    const typeNorm = type.replace(/\s/g, '');
    const stem = q.stem || '';
    const isGrammar = type.includes('어법');
    const isInappropriate = type.includes('부적절') || type.includes('오류');
    const isWritten = q.fmt === 'written';

    // === S-PASSAGE-NOT-FULL for 어법/부적절 ===
    if ((isGrammar || isInappropriate) && q.passage && !isWritten) {
      const ratio = q.passage.length / fp.length;
      if (ratio < 0.85) {
        // Transfer markers + underlines from current passage to fullPassage
        const ulRe = /([①②③④⑤]?\s*)<u>([^<]*)<\/u>/g;
        let m, overlays = [];
        while ((m = ulRe.exec(q.passage)) !== null) {
          overlays.push({ marker: m[1].trim(), word: m[2], pos: m.index });
        }

        if (overlays.length >= 3) {
          let newP = fp;
          // Apply each overlay to fullPassage
          let success = true;
          for (const ov of overlays) {
            const wordEsc = esc(ov.word);
            const rx = new RegExp(`(?<![①②③④⑤]\\s*<u>)\\b${wordEsc}\\b(?!</u>)`, 'i');
            if (rx.test(newP)) {
              const replacement = ov.marker ? `${ov.marker}<u>${ov.word}</u>` : `<u>${ov.word}</u>`;
              newP = newP.replace(rx, replacement);
            } else {
              // Word not found - can't migrate
              success = false;
              break;
            }
          }
          if (success && newP.length >= fp.length * 0.85) {
            q.passage = newP;
            fix('FULL-OVERLAY');
            modified = true;
          }
        }
      }
    }

    // === V-WRITTEN-WORDCOUNT: stem에 단어수 추가 ===
    if (isWritten && q.wa && stem && !stem.match(/\d+\s*단어/)) {
      const wc = q.wa.split(/\s+/).length;
      if (wc >= 2) {
        // Add word count hint to stem
        q.stem = stem.replace(/쓰시오\.?$/, `쓰시오. (${wc}단어)`);
        if (q.stem !== stem) {
          fix('WCOUNT-ADD');
          modified = true;
        }
      }
    }

    // === V67: stem "밑줄 친" but no <u> ===
    if (stem.includes('밑줄') && q.passage && !q.passage.includes('<u>')) {
      // Try to find target word from det
      if (q.det?.korean) {
        // Look for quoted text or specific patterns
        const quotedMatch = q.det.korean.match(/"([^"]+)"/);
        const arrowMatch = q.det.korean.match(/(\w+)\s*→/);
        const targetWord = quotedMatch ? quotedMatch[1] : (arrowMatch ? arrowMatch[1] : null);
        if (targetWord && q.passage.includes(targetWord)) {
          q.passage = q.passage.replace(targetWord, `<u>${targetWord}</u>`);
          fix('V67-FIX');
          modified = true;
        }
      }
      // For 어법 with ch words - underline them
      if (isGrammar && q.ch && !q.passage.includes('<u>')) {
        const chWords = q.ch.map(c => c.replace(/^[①②③④⑤]\s*/, '').trim()).filter(w => w.length > 0);
        let addedUl = 0;
        let newP = q.passage;
        for (const cw of chWords) {
          if (cw && newP.includes(cw) && !newP.includes(`<u>${cw}</u>`)) {
            newP = newP.replace(new RegExp(`\\b${esc(cw)}\\b`), `<u>${cw}</u>`);
            addedUl++;
          }
        }
        if (addedUl >= 3) {
          q.passage = newP;
          fix('V67-UL');
          modified = true;
        }
      }
    }

    // === S-NO-PASSAGE 잔여 (written with passage) ===
    if (isWritten && !q.passage) {
      let newP = fp;
      newP = newP.replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1').replace(/[①②③④⑤]/g, '');
      if (q.wa) {
        newP = newP.replace(new RegExp(`\\b${esc(q.wa)}\\b`, 'gi'), '____');
      }
      q.passage = newP;
      fix('NO-PASS-2');
      modified = true;
    }

    // === S-PASSAGE-1-SENTENCE 잔여 ===
    if (q.passage && !isWritten && !isGrammar && !isInappropriate) {
      const sentCount = (q.passage.match(/[.!?]/g) || []).length;
      if (sentCount <= 1 && q.passage.length < fp.length * 0.5) {
        let newP = fp;
        // Transfer <u> if present
        if (q.passage.includes('<u>')) {
          const ulRe = /<u>([^<]+)<\/u>/g;
          let m;
          while ((m = ulRe.exec(q.passage)) !== null) {
            if (newP.includes(m[1]) && !newP.includes(`<u>${m[1]}</u>`)) {
              newP = newP.replace(m[1], `<u>${m[1]}</u>`);
            }
          }
        }
        // Transfer blanks
        if (q.passage.includes('____') && q.ch && q.ans) {
          const ansWord = q.ch[q.ans - 1];
          if (ansWord && newP.includes(ansWord)) {
            newP = newP.replace(new RegExp(`\\b${esc(ansWord)}\\b`, 'i'), '____');
          }
        }
        if (stem.includes('밑줄') && !newP.includes('<u>')) continue;
        q.passage = newP;
        fix('1SENT-FIX');
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    filesModified++;
  }
  return modified;
}

const files = getAllFiles();
console.log(`\n=== 모의고사 2차 자동수정 (${files.length} files) ===\n`);
const start = Date.now();
for (const f of files) processFile(f);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(`=== 수정 요약 (${elapsed}s) ===`);
console.log(`파일: ${filesModified}/${files.length}`);
console.log(`총: ${totalFixes}건\n`);
Object.entries(codeCounts).sort((a,b) => b[1] - a[1]).forEach(([c,n]) => console.log(`  ${String(n).padStart(5)} ${c}`));
