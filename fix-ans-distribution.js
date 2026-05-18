#!/usr/bin/env node
/**
 * Fix ans distribution in response.json files
 * - Ensures max 5 of same ans across 20 questions
 * - No 3 consecutive same ans
 * - Swaps ch entries and analysis markers accordingly
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node fix-ans-distribution.js <response.json>'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Good distribution pattern (1-based): 5 each of 1,2,3,4, no 3 consecutive
const pattern = [1,2,3,4, 2,3,1,4, 3,1,4,2, 4,1,2,3, 2,4,3,1];

const markerSymbols = ['①','②','③','④'];

data.decisions.forEach((d, i) => {
  // Skip written type (no ch/ans)
  if (d.wa !== undefined && d.ans === undefined) return;
  // Skip T/F (choiceCount=2)
  if (d.ch && d.ch.length === 2) return;
  if (!d.ch || !d.ans) return;

  const oldAns = d.ans;
  const newAns = pattern[i];

  if (oldAns === newAns) return;

  const isMarker = d.ch.length === 4 && d.ch.every(c => markerSymbols.includes(c));

  if (isMarker && d.overlay && d.overlay.markers) {
    // For marker questions (어법/부적절/오류찾기): swap the error in overlay.markers
    const markers = d.overlay.markers;
    const oldKey = markerSymbols[oldAns - 1];
    const newKey = markerSymbols[newAns - 1];
    const oldVal = markers[oldKey];
    const newVal = markers[newKey];
    markers[oldKey] = newVal;
    markers[newKey] = oldVal;
    d.ans = newAns;
  } else if (!isMarker && d.ch.length === 4) {
    // For regular mc: swap ch entries
    const oldIdx = oldAns - 1;
    const newIdx = newAns - 1;
    const temp = d.ch[oldIdx];
    d.ch[oldIdx] = d.ch[newIdx];
    d.ch[newIdx] = temp;
    d.ans = newAns;
  }

  // Fix analysis: swap ✅/❌ between old and new positions
  if (d.analysis) {
    const lines = d.analysis.split('\n');
    // Find line indices by marker symbols
    const oldMarker = markerSymbols[oldAns - 1] || String(oldAns);
    const newMarker = markerSymbols[newAns - 1] || String(newAns);

    const newLines = lines.map(line => {
      // Line that was ✅ (old answer) → make ❌
      if (line.includes('✅') && line.includes(oldMarker)) {
        return line.replace('✅', '❌');
      }
      // Line that was ❌ (new answer position) → make ✅
      if (line.includes('❌') && line.includes(newMarker)) {
        return line.replace('❌', '✅');
      }
      return line;
    });
    d.analysis = newLines.join('\n');
  }
});

// Verify distribution
const dist = {};
data.decisions.forEach(d => {
  if (d.ans) { dist[d.ans] = (dist[d.ans] || 0) + 1; }
});

// Check for 3 consecutive
let consecutive = false;
for (let i = 2; i < data.decisions.length; i++) {
  const a = data.decisions[i-2].ans;
  const b = data.decisions[i-1].ans;
  const c = data.decisions[i].ans;
  if (a && b && c && a === b && b === c) {
    consecutive = true;
    break;
  }
}

console.log(`Fixed: ${file}`);
console.log(`  Distribution: ${JSON.stringify(dist)}`);
console.log(`  3-consecutive: ${consecutive ? '❌ STILL HAS' : '✅ NONE'}`);
console.log(`  Max same: ${Math.max(...Object.values(dist))}`);

fs.writeFileSync(file, JSON.stringify(data, null, 2));
