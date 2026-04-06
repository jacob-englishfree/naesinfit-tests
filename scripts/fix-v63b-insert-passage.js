#!/usr/bin/env node
// V63-B: 문장삽입형은 stem에 텍스트 들어있으므로 passage를 null로
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'data');
const APPLY = process.argv.includes('--apply');

function walk(dir, files=[]) {
  for (const e of fs.readdirSync(dir)) {
    if (e==='_passages'||e.startsWith('.')) continue;
    const f = path.join(dir,e);
    if (fs.statSync(f).isDirectory()) walk(f,files);
    else if (e==='단어.json'||e==='워크북.json'||e==='퀴즈.json') files.push(f);
  }
  return files;
}

let qFixed=0, fChanged=0;
for (const file of walk(ROOT)) {
  let d; try { d=JSON.parse(fs.readFileSync(file,'utf8')); } catch { continue; }
  if (!Array.isArray(d.questions)) continue;
  let changed=false;
  for (const q of d.questions) {
    const stem = q.stem || '';
    const isInsert = /문장삽입|주어진.*문장.*들어가|적절한.*위치/.test(stem) || q.type === '문장삽입';
    if (isInsert && q.passage) {
      q.passage = null;
      changed=true; qFixed++;
    }
  }
  if (changed) {
    fChanged++;
    if (APPLY) fs.writeFileSync(file, JSON.stringify(d,null,2)+'\n');
  }
}
console.log(`qFixed=${qFixed} fChanged=${fChanged} ${APPLY?'APPLIED':'DRY'}`);
