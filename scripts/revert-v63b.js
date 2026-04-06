#!/usr/bin/env node
// Revert: 문장삽입 passage가 null로 비워진 케이스 복구 (git HEAD에서 원본 가져옴)
const { execSync } = require('child_process');
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

let restored = 0, fChanged = 0;
for (const file of walk(ROOT)) {
  let cur; try { cur = JSON.parse(fs.readFileSync(file,'utf8')); } catch { continue; }
  if (!Array.isArray(cur.questions)) continue;
  const hasNullInsert = cur.questions.some(q =>
    (q.type === '문장삽입' || /문장삽입|주어진.*문장.*들어가/.test(q.stem||'')) && q.passage === null
  );
  if (!hasNullInsert) continue;

  // Get HEAD version
  const rel = path.relative(path.join(__dirname,'..'), file);
  let headJson;
  try {
    headJson = execSync(`git show HEAD:"${rel}"`, { cwd: path.join(__dirname,'..'), encoding: 'utf8' });
  } catch { continue; }
  let head;
  try { head = JSON.parse(headJson); } catch { continue; }
  if (!Array.isArray(head.questions)) continue;

  let changed = false;
  for (let i = 0; i < cur.questions.length; i++) {
    const q = cur.questions[i];
    const hq = head.questions[i];
    if (!hq) continue;
    if ((q.type === '문장삽입' || /문장삽입|주어진.*문장.*들어가/.test(q.stem||''))
        && q.passage === null && hq.passage) {
      q.passage = hq.passage;
      restored++;
      changed = true;
    }
  }
  if (changed) {
    fChanged++;
    if (APPLY) fs.writeFileSync(file, JSON.stringify(cur,null,2)+'\n');
  }
}
console.log(`restored=${restored} fChanged=${fChanged} ${APPLY?'APPLIED':'DRY'}`);
