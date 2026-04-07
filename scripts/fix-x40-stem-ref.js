#!/usr/bin/env node
// X40 후속 수정: passage=null 영작 서술형에서 stem의 "위 글"/"다음 글" 참조 제거
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const REFS = ['위 글의 내용을 바탕으로 ', '위 글의 내용을 바탕으로, ', '다음 글의 내용을 바탕으로 ', '다음 글의 내용을 바탕으로, ', '위 글을 참고하여 ', '다음 글을 참고하여 '];
let scanned = 0, fixed = 0;

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

  let mutated = false;
  for (const q of data.questions) {
    scanned++;
    if (q.fmt !== 'written') continue;
    const passage = (q.passage || '').toString().trim();
    if (passage.length > 0) continue; // passage 있으면 건너뜀
    let stem = (q.stem || '').toString();
    let changed = false;
    for (const ref of REFS) {
      if (stem.includes(ref)) {
        stem = stem.replace(ref, '');
        changed = true;
      }
    }
    // 더 공격적 패턴: "위 글에서" → 제거
    stem = stem.replace(/위 글에서\s*/g, (m) => { changed = true; return ''; });
    stem = stem.replace(/다음 글에서\s*/g, (m) => { changed = true; return ''; });
    // "이 글에서" 는 stem 본문 참조일 수 있어 보수적 처리 — 영작이면 제거
    const typeNorm = (q.type || '').trim();
    if (typeNorm.includes('영작')) {
      stem = stem.replace(/이 글에서\s*/g, (m) => { changed = true; return ''; });
    }
    if (changed) {
      q.stem = stem;
      mutated = true;
      fixed++;
    }
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);
console.log(`\n━━━ X40 stem 참조 제거 완료 ━━━`);
console.log(`scanned: ${scanned}`);
console.log(`fixed: ${fixed}`);
