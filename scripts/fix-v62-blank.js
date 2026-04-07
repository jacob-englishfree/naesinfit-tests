#!/usr/bin/env node
// V62 자동수정: "빈칸에 들어갈" stem인데 passage에 빈칸(____) 없음
// 전략: ch[ans-1]의 정답 단어/구가 passage에 정확히 1회 등장할 때만 _____로 교체
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const BLANK = '_____';

let scanned = 0, fixed = 0, skipped = 0;
const skipList = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) processFile(p);
  }
}

function escReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function processFile(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  if (!data || !Array.isArray(data.questions)) return;

  let mutated = false;
  for (const q of data.questions) {
    scanned++;
    const stem = (q.stem || '').toString();
    // Must mention "빈칸에 들어갈" or equivalent
    if (!(stem.includes('빈칸에 들어갈') || stem.includes('위 글의 빈칸') || stem.includes('위 빈칸') || stem.includes('빈 칸에 들어갈'))) continue;
    const passage = (q.passage || '').toString();
    if (passage.trim().length < 10) continue;
    if (passage.includes('____')) continue; // already has blank
    // Must be mc with ch array and ans
    if (q.fmt !== 'mc' || !Array.isArray(q.ch) || !q.ans) continue;
    const ansIdx = Number(q.ans) - 1;
    const correct = (q.ch[ansIdx] || '').toString().trim();
    if (!correct) continue;
    // Strip marker ①②③④⑤ if present
    const cleanCorrect = correct.replace(/^[①②③④⑤]\s*/, '').trim();
    if (!cleanCorrect) continue;
    // Must appear exactly once in passage (word-boundary for English)
    const isEnglish = /^[A-Za-z][A-Za-z\s\-'()]*$/.test(cleanCorrect);
    if (!isEnglish) {
      skipped++;
      skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (non-english answer)`);
      continue;
    }
    const re = new RegExp(`\\b${escReg(cleanCorrect)}\\b`, 'g');
    const matches = passage.match(re) || [];
    if (matches.length !== 1) {
      skipped++;
      skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (${matches.length} matches for "${cleanCorrect}")`);
      continue;
    }
    // Replace the single occurrence with blank
    q.passage = passage.replace(re, BLANK);
    mutated = true;
    fixed++;
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);

console.log(`\n━━━ V62 자동수정 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
console.log(`skipped (모호/비영어): ${skipped}`);
if (skipped > 0) {
  fs.writeFileSync(path.join(__dirname, '..', 'reports', 'v62-skipped.txt'), skipList.join('\n') + '\n');
  console.log(`→ reports/v62-skipped.txt`);
}
