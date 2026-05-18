#!/usr/bin/env node
/**
 * fix-a6-single.js — 단일 파일 A6(정답 분포 편중) + A7(3연속) 수정
 * 선지 위치 스왑만 수행. 문항 내용 변경 없음.
 *
 * Usage: node scripts/fix-a6-single.js <test.json>
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('Usage: node fix-a6-single.js <test.json>'); process.exit(1); }

const absPath = path.resolve(file);
const data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
const qs = data.questions;
if (!qs || !Array.isArray(qs)) { console.error('No questions array'); process.exit(1); }

const mcIdx = [];
qs.forEach((q, i) => {
  if (q.fmt === 'mc' && typeof q.ans === 'number' && q.ans >= 1 && q.ans <= 4 && Array.isArray(q.ch) && q.ch.length === 4) {
    mcIdx.push({ q, i });
  }
});

function countA7(arr) {
  let n = 0;
  for (let i = 0; i < arr.length - 2; i++) {
    if (arr[i] === arr[i+1] && arr[i+1] === arr[i+2]) n++;
  }
  return n;
}

function getDist() {
  const dist = {1:0,2:0,3:0,4:0};
  mcIdx.forEach(x => dist[x.q.ans]++);
  return dist;
}

// Before
const beforeDist = getDist();
const beforeA7 = countA7(qs.map(q => q.ans));
console.log(`[BEFORE] 분포: ${JSON.stringify(beforeDist)}, 3연속: ${beforeA7}`);

let changed = false;
for (let pass = 0; pass < 100; pass++) {
  const dist = getDist();
  const overEntry = Object.entries(dist).find(([_,c]) => c >= 6);
  const a7count = countA7(mcIdx.map(y => y.q.ans));

  if (!overEntry && a7count === 0) break;

  // Fix A6 first
  if (overEntry) {
    const overA = parseInt(overEntry[0]);
    const sorted = Object.entries(dist).sort((a,b) => a[1]-b[1]);
    let swapped = false;
    for (const [u] of sorted) {
      const underA = parseInt(u);
      if (underA === overA || dist[underA] >= 5) continue;
      for (const x of mcIdx) {
        if (x.q.ans !== overA) continue;
        const orig = x.q.ans;
        x.q.ans = underA;
        const newA7 = countA7(mcIdx.map(y => y.q.ans));
        if (newA7 > a7count) { x.q.ans = orig; continue; }
        // Swap choices
        const tmp = x.q.ch[overA-1];
        x.q.ch[overA-1] = x.q.ch[underA-1];
        x.q.ch[underA-1] = tmp;
        // Swap det.analysis markers if present
        if (x.q.det && x.q.det.analysis) {
          const markers = ['①','②','③','④'];
          const lines = x.q.det.analysis.split('\n');
          const oldLine = lines.find(l => l.startsWith(markers[overA-1]));
          const newLine = lines.find(l => l.startsWith(markers[underA-1]));
          if (oldLine && newLine) {
            const oldContent = oldLine.substring(markers[overA-1].length);
            const newContent = newLine.substring(markers[underA-1].length);
            x.q.det.analysis = lines.map(l => {
              if (l.startsWith(markers[overA-1])) return markers[overA-1] + newContent;
              if (l.startsWith(markers[underA-1])) return markers[underA-1] + oldContent;
              return l;
            }).join('\n');
          }
        }
        swapped = true;
        changed = true;
        break;
      }
      if (swapped) break;
    }
    if (!swapped) break;
    continue;
  }

  // Fix A7 (3연속)
  if (a7count > 0) {
    let fixed = false;
    for (let i = 0; i < mcIdx.length - 2; i++) {
      const a = mcIdx[i].q.ans, b = mcIdx[i+1].q.ans, c = mcIdx[i+2].q.ans;
      if (a === b && b === c) {
        // Swap middle item's answer to a different number
        const mid = mcIdx[i+1];
        for (let newA = 1; newA <= 4; newA++) {
          if (newA === mid.q.ans) continue;
          const dist2 = getDist();
          if (dist2[newA] >= 5) continue;
          const origA = mid.q.ans;
          // Swap choices
          const tmp = mid.q.ch[origA-1];
          mid.q.ch[origA-1] = mid.q.ch[newA-1];
          mid.q.ch[newA-1] = tmp;
          mid.q.ans = newA;
          changed = true;
          fixed = true;
          break;
        }
        if (fixed) break;
      }
    }
    if (!fixed) break;
  }
}

const afterDist = getDist();
const afterA7 = countA7(mcIdx.map(y => y.q.ans));
console.log(`[AFTER]  분포: ${JSON.stringify(afterDist)}, 3연속: ${afterA7}`);

if (changed) {
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`[FIXED] ${path.relative(process.cwd(), absPath)}`);
} else {
  console.log(`[SKIP] 변경 없음`);
}
