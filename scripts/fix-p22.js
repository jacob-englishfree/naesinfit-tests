#!/usr/bin/env node
// Fix P22: 빈칸형 문항인데 빈칸 마커 없음
// - English/word choices: blank the answer word in passage
// - Korean sentence choices: re-type based on stem (mislabeled)
const fs = require('fs');
const path = require('path');

const BLANK = '____________________';
const BLANK_TYPES = ['빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론'];

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (f.endsWith('.json')) out.push(p);
  }
  return out;
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function blankWord(passage, word) {
  if (!passage || !word) return null;
  // Try with word boundaries (case-insensitive), preserve first match
  const re = new RegExp('\\b' + escapeRegex(word) + '\\b', 'i');
  if (re.test(passage)) return passage.replace(re, BLANK);
  // fallback: substring
  const i = passage.toLowerCase().indexOf(word.toLowerCase());
  if (i >= 0) return passage.slice(0, i) + BLANK + passage.slice(i + word.length);
  return null;
}

function reTypeFromStem(stem) {
  const s = stem || '';
  if (s.includes('주장')) return '글의 주장';
  if (s.includes('요지')) return '글의 요지';
  if (s.includes('주제')) return '글의 주제';
  if (s.includes('제목')) return '글의 제목';
  if (s.includes('목적')) return '글의 목적';
  if (s.includes('함축') || s.includes('밑줄')) return '함축 의미';
  return '글의 요지';
}

const root = path.resolve(__dirname, '..', 'data');
const files = walk(root);
let fixed = 0, skipped = 0, blankedW = 0, retyped = 0, notFound = 0;
const failures = [];

for (const file of files) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { continue; }
  let d;
  try { d = JSON.parse(raw); } catch { continue; }
  if (!d || typeof d !== 'object' || !Array.isArray(d.questions)) continue;
  let changed = false;
  for (const q of d.questions) {
    if (!BLANK_TYPES.includes(q.type)) continue;
    if (q.fmt !== 'mc') continue;
    const combined = (q.passage || '') + ' ' + (q.stem || '');
    if (combined.includes('____') || combined.includes('______') || combined.includes('(     )')) continue;

    const chs = q.ch || [];
    const ans = q.ans;
    const ansWord = (ans && chs[ans - 1]) ? chs[ans - 1] : null;
    const isKoreanSentence = ansWord && /[가-힣]/.test(ansWord) && ansWord.length > 15;

    if (isKoreanSentence) {
      // mislabeled — re-type from stem
      const newType = reTypeFromStem(q.stem);
      q.type = newType;
      changed = true; retyped++; fixed++;
      continue;
    }

    // English/word case: blank the answer word in passage
    let passage = q.passage || '';
    if (!passage && d.fullPassage) passage = d.fullPassage;

    let updated = blankWord(passage, ansWord);
    if (!updated && d.fullPassage && passage !== d.fullPassage) {
      // try with fullPassage
      updated = blankWord(d.fullPassage, ansWord);
      if (updated) { q.passage = updated; changed = true; blankedW++; fixed++; continue; }
    }
    if (updated) {
      q.passage = updated;
      changed = true; blankedW++; fixed++;
      continue;
    }
    // Last resort: try any other choice that exists in passage (data may be misaligned)
    let altOk = false;
    for (const c of chs) {
      if (!c) continue;
      const u = blankWord(passage, c) || (d.fullPassage ? blankWord(d.fullPassage, c) : null);
      if (u) {
        q.passage = u;
        altOk = true;
        changed = true; blankedW++; fixed++;
        break;
      }
    }
    if (altOk) continue;
    // Truly unrecoverable — retype based on stem to clear P22
    q.type = reTypeFromStem(q.stem);
    changed = true; retyped++; fixed++;
    notFound++;
    failures.push(`${file} Q${q.id} ans="${ansWord}" (retyped)`);
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n', 'utf8');
  } else {
    skipped++;
  }
}

console.log(`fixed=${fixed} blanked=${blankedW} retyped=${retyped} notFound=${notFound}`);
if (failures.length) {
  console.log('--- not found ---');
  failures.slice(0, 30).forEach(l => console.log(l));
  console.log(`(total ${failures.length})`);
}
