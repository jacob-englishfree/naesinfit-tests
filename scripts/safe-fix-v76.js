#!/usr/bin/env node
/** V76 fix: 영영풀이 문항의 passage 비우기 + stem에서 "본문" 참조 제거 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function findAll(dir) {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() && !['_passages','reports','.git','node_modules'].includes(e.name)) r = r.concat(findAll(f));
    else if (e.name.endsWith('.json') && !e.name.includes('.blind') && !e.name.includes('.cross') && !e.name.includes('.prompt') && !e.name.includes('.response') && !e.name.includes('.adversarial')) r.push(f);
  }
  return r;
}

let fixed = 0;
for (const f of findAll(DATA_DIR)) {
  let data;
  try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  if (!data.questions) continue;
  let changed = false;
  for (const q of data.questions) {
    if (/영영풀이/.test(q.type || '') && q.passage && q.passage.trim() !== '') {
      q.passage = '';
      if (q.stem) q.stem = q.stem.replace(/\s*본문에서\s*쓰인\s*것은\??\s*/g, '해당하는 단어는?');
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
    console.log(`[V76] ${path.relative(ROOT, f)}`);
    fixed++;
  }
}
console.log(`\n완료: ${fixed}개 파일 수정`);
