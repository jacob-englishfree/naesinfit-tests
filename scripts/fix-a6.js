#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

let out;
try { out = execSync('node validate/validate.js --all 2>/dev/null', { encoding: 'utf8', maxBuffer: 500 * 1024 * 1024 }); }
catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
const lines = out.split('\n');
const files = new Set();
let cur = null;
for (const ln of lines) {
  const m = ln.match(/^\[FAIL\]\s+(\S+\.json)/);
  if (m) { cur = m[1]; continue; }
  if (cur && /\[S\] A6:/.test(ln)) files.add(cur);
}

function countA7(arr) {
  let n = 0;
  for (let i = 0; i < arr.length - 2; i++) {
    if (arr[i] === arr[i+1] && arr[i+1] === arr[i+2]) n++;
  }
  return n;
}

function fixA6(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const qs = data.questions || [];
  const mcIdx = [];
  qs.forEach((q, i) => {
    if (q.fmt === 'mc' && q.ans >= 1 && q.ans <= 4 && Array.isArray(q.ch) && q.ch.length === 4) {
      mcIdx.push({ q, i });
    }
  });

  for (let pass = 0; pass < 50; pass++) {
    const dist = {1:0,2:0,3:0,4:0};
    mcIdx.forEach(x => dist[x.q.ans]++);
    const overEntry = Object.entries(dist).find(([_,c]) => c >= 6);
    if (!overEntry) return true;
    const overA = parseInt(overEntry[0]);
    const sorted = Object.entries(dist).sort((a,b) => a[1]-b[1]);
    let swapped = false;
    for (const [u, _] of sorted) {
      const underA = parseInt(u);
      if (underA === overA) continue;
      for (const x of mcIdx) {
        if (x.q.ans !== overA) continue;
        // Try swap
        const orig = x.q.ans;
        x.q.ans = underA;
        const arr = mcIdx.map(y => y.q.ans);
        if (checkA7(arr)) { x.q.ans = orig; continue; }
        // Apply choice swap
        const tmp = x.q.ch[overA-1];
        x.q.ch[overA-1] = x.q.ch[underA-1];
        x.q.ch[underA-1] = tmp;
        swapped = true;
        break;
      }
      if (swapped) break;
    }
    if (!swapped) return false;
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  return true;
}

// Need to write inside loop too
function fixAndSave(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const qs = data.questions || [];
  const mcIdx = [];
  qs.forEach((q, i) => {
    if (q.fmt === 'mc' && typeof q.ans === 'number' && Array.isArray(q.ch) && q.ch.length >= 2) {
      mcIdx.push({ q, i });
    }
  });

  let changed = false;
  for (let pass = 0; pass < 50; pass++) {
    const dist = {1:0,2:0,3:0,4:0};
    mcIdx.forEach(x => dist[x.q.ans]++);
    const overEntry = Object.entries(dist).find(([_,c]) => c >= 6);
    if (!overEntry) break;
    const overA = parseInt(overEntry[0]);
    const sorted = Object.entries(dist).sort((a,b) => a[1]-b[1]);
    let swapped = false;
    for (const [u] of sorted) {
      const underA = parseInt(u);
      if (underA === overA) continue;
      if (dist[underA] >= 5) continue;
      const beforeA7 = countA7(mcIdx.map(y => y.q.ans));
      for (const x of mcIdx) {
        if (x.q.ans !== overA) continue;
        if (underA > x.q.ch.length) continue;
        const orig = x.q.ans;
        x.q.ans = underA;
        const arr = mcIdx.map(y => y.q.ans);
        if (countA7(arr) > beforeA7) { x.q.ans = orig; continue; }
        const tmp = x.q.ch[overA-1];
        x.q.ch[overA-1] = x.q.ch[underA-1];
        x.q.ch[underA-1] = tmp;
        swapped = true;
        changed = true;
        break;
      }
      if (swapped) break;
    }
    if (!swapped) break;
  }
  if (changed) fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  return changed;
}

let ok = 0, fail = 0;
for (const f of files) {
  try {
    if (fixAndSave(f)) ok++; else fail++;
  } catch (e) {
    console.error('ERR', f, e.message);
    fail++;
  }
}
console.log(`Files: ${files.size}, fixed: ${ok}, unchanged: ${fail}`);
