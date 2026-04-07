#!/usr/bin/env node
// X40 자동수정: passage 비어있고 stem이 "이 글/다음 글/본문/윗글/위 글/밑줄 친" 참조시
// fullPassage(또는 file-level passages)를 passage에 복사
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const KEYWORDS = ['다음 글', '이 글', '본문', '윗글', '위 글', '밑줄 친'];
const SKIP_TYPES = ['문장삽입', '순서배열', '글순서'];

let scanned = 0, fixed = 0, noSource = 0;
const noSourceList = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) processFile(p);
  }
}

function processFile(file) {
  let raw, data;
  try { raw = fs.readFileSync(file, 'utf8'); data = JSON.parse(raw); }
  catch { return; }
  if (!data || !Array.isArray(data.questions)) return;

  // file-level fallback sources
  const fileFP = data.fullPassage || data.passage || '';

  let mutated = false;
  for (const q of data.questions) {
    scanned++;
    const typeNorm = (q.type || '').trim();
    if (SKIP_TYPES.includes(typeNorm)) continue;
    const passage = (q.passage || '').toString();
    if (passage.trim().length > 0) continue;
    const stemPlain = (q.stem || '').replace(/<[^>]+>/g, '');
    if (!KEYWORDS.some(k => stemPlain.includes(k))) continue;
    const stemEng = (stemPlain.match(/[a-zA-Z]+/g) || []).length;
    if (stemEng >= 20) continue; // stem 자체에 영문 본문

    // source 우선순위: q.fullPassage → file fullPassage → file passage
    const src = (q.fullPassage || fileFP || '').toString().trim();
    if (!src) {
      noSource++;
      noSourceList.push(`${path.relative(ROOT, file)} :: Q${q.id || '?'}`);
      continue;
    }
    q.passage = src;
    mutated = true;
    fixed++;
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(ROOT);

console.log(`\n━━━ X40 자동수정 완료 ━━━`);
console.log(`scanned questions: ${scanned}`);
console.log(`fixed (passage 복사): ${fixed}`);
console.log(`source 없음 (재출제 필요): ${noSource}`);
if (noSource > 0) {
  fs.writeFileSync(
    path.join(__dirname, '..', 'reports', 'x40-no-source.txt'),
    noSourceList.join('\n') + '\n',
    'utf8'
  );
  console.log(`→ reports/x40-no-source.txt`);
}
