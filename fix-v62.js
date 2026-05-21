#!/usr/bin/env node
/**
 * V62: stem에 "빈칸"이라고 했는데 passage에 빈칸(____) 없음
 * 서술형 wa 단어를 passage에서 ____ 로 교체
 *
 * Also fixes:
 * - V69/S-WA-IN-PASSAGE: 서술형 정답이 passage에 그대로 노출
 * - V-WRITTEN-FIND-PASSAGE: "본문에서 찾아"인데 정답이 passage에서 빈칸 처리됨 (역방향 - 빈칸 제거)
 */
const fs = require('fs');

const targetFiles = process.argv.slice(2);
if (!targetFiles.length) { console.error('Usage: node fix-v62.js <file...>'); process.exit(1); }

let fixedCount = 0;

for (const jsonFile of targetFiles) {
  if (!fs.existsSync(jsonFile)) { console.log(`[SKIP] ${jsonFile} — not found`); continue; }
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  let changed = false;

  for (const q of data.questions || []) {
    if (q.fmt !== 'written') continue;

    const stem = String(q.stem || '');
    const passage = String(q.passage || '');
    const wa = String(q.wa || '').trim();

    // Detect V-WRITTEN-FIND-PASSAGE: "본문에서 찾아" but wa is blanked in passage
    const isFindType = stem.includes('찾아 쓰시오') || stem.includes('찾아쓰시오') || stem.includes('본문에서 찾아') || stem.includes('위 글에서');
    if (isFindType && passage.includes('____') && wa) {
      // Fix: restore the wa word in passage (remove ____)
      const newPassage = passage.replace(/____+/g, wa);
      if (newPassage !== passage) {
        q.passage = newPassage;
        console.log(`  Q${q.id} [V-WRITTEN-FIND]: restored "${wa}" in passage`);
        changed = true;
      }
      continue;
    }

    // Detect V62: stem mentions 빈칸 but passage has no ____
    const hasBinKanStem = stem.includes('위 글의 빈칸') || stem.includes('위 빈칸') ||
                           stem.includes('빈칸에 들어갈') || stem.includes('빈 칸에 들어갈') ||
                           stem.includes('빈칸에 알맞은') || stem.includes('빈칸을 채우');
    if (!hasBinKanStem) continue;
    if (isFindType) continue; // 찾기 유형은 passage에 ____ 불필요 (wa가 passage에 보여야 함)
    if (!passage || !passage.trim()) continue;
    if (passage.includes('____') || passage.includes('_____')) continue;

    // Fix: find wa in passage and replace with ____
    if (!wa) {
      console.log(`  Q${q.id} [V62]: wa 없음 — 수동 수정 필요`);
      continue;
    }

    // Try to find wa (word or phrase) in passage (case-insensitive)
    const waLower = wa.toLowerCase();
    const passageLower = passage.toLowerCase();
    const idx = passageLower.indexOf(waLower);

    if (idx >= 0) {
      const blank = '_'.repeat(Math.max(5, wa.length));
      const newPassage = passage.substring(0, idx) + blank + passage.substring(idx + wa.length);
      q.passage = newPassage;
      console.log(`  Q${q.id} [V62]: replaced "${wa}" with "____" in passage`);
      changed = true;
    } else {
      // Try word boundary match
      const words = wa.toLowerCase().split(/\s+/);
      if (words.length === 1) {
        // Single word - try with word boundaries
        const regex = new RegExp('\\b' + wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        const match = passage.match(regex);
        if (match) {
          const blank = '_'.repeat(Math.max(5, wa.length));
          q.passage = passage.replace(regex, blank);
          console.log(`  Q${q.id} [V62]: replaced "${wa}" (word boundary) with "____" in passage`);
          changed = true;
        } else {
          console.log(`  Q${q.id} [V62]: wa="${wa}" not found in passage — 수동 수정 필요`);
        }
      } else {
        console.log(`  Q${q.id} [V62]: wa="${wa}" (multi-word) not found — 수동 수정 필요`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[FIXED] ${jsonFile}`);
    fixedCount++;
  } else {
    console.log(`[SKIP] ${jsonFile}`);
  }
}
console.log(`\n완료: ${fixedCount}개 수정`);
