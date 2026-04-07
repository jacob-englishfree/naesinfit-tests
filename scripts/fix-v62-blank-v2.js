#!/usr/bin/env node
// V62 자동수정 v2: passage에 정답 없으면 → fullPassage에서 정답 포함 문장 발췌 후 빈칸 교체
// 전략: passage 자체를 fullPassage로 교체 + 정답 단어를 _____로 블랭킹
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const BLANK = '_____';
const KEYWORDS = ['빈칸에 들어갈', '위 글의 빈칸', '위 빈칸', '빈 칸에 들어갈'];

let scanned = 0, fixed = 0, skipped = 0;
const skipList = [];

function escReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) processFile(p);
  }
}

function processFile(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  if (!data || !Array.isArray(data.questions)) return;

  // file-level fullPassage
  const fileFP = (data.fullPassage || '').toString().trim();

  let mutated = false;
  for (const q of data.questions) {
    scanned++;
    const stem = (q.stem || '').toString();
    if (!KEYWORDS.some(k => stem.includes(k))) continue;
    const passage = (q.passage || '').toString();
    if (passage.includes('____')) continue; // already has blank
    if (passage.trim().length < 10) continue;
    if (q.fmt !== 'mc' || !Array.isArray(q.ch) || !q.ans) continue;

    const ansIdx = Number(q.ans) - 1;
    const correct = (q.ch[ansIdx] || '').toString().trim().replace(/^[①②③④⑤]\s*/, '').trim();
    if (!correct || !/^[A-Za-z]/.test(correct)) continue;

    // Strategy 1: 정답이 passage에 있으면 교체 (case insensitive, allow 2+ matches → first only)
    const re1 = new RegExp(`\\b${escReg(correct)}\\b`, 'i');
    if (re1.test(passage)) {
      q.passage = passage.replace(re1, BLANK);
      mutated = true;
      fixed++;
      continue;
    }

    // Strategy 2: fullPassage에서 정답 찾아 passage 교체
    const fp = (q.fullPassage || fileFP || '').toString().trim();
    if (fp && re1.test(fp)) {
      // fullPassage에서 정답을 빈칸으로 교체한 버전을 passage로 사용
      q.passage = fp.replace(re1, BLANK);
      mutated = true;
      fixed++;
      continue;
    }

    skipped++;
    skipList.push(`${path.relative(ROOT, file)} :: Q${q.id} (no match in passage or fullPassage: "${correct}")`);
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);

console.log(`\n━━━ V62 v2 자동수정 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
console.log(`skipped: ${skipped}`);
if (skipped > 0) {
  fs.writeFileSync(path.join(__dirname, '..', 'reports', 'v62-skipped-v2.txt'), skipList.join('\n') + '\n');
  console.log(`→ reports/v62-skipped-v2.txt`);
}
