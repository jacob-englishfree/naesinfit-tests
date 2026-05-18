#!/usr/bin/env node
/**
 * Auto-fix ans distribution in response.json
 * Shuffles choice positions to balance ans across 1-4 (max 5 each, no 3 consecutive)
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('Usage: node fix-ans-dist.js <response.json>'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const decisions = data.decisions;

// Identify MC items (those with ch array and ans)
const mcItems = decisions.filter(d => d.ch && d.ans && !d.wa);
const writtenItems = decisions.filter(d => d.wa);

// Target: each ans value should appear at most 5 times, with no 3 consecutive same ans
const targetMax = 5;

// Count current distribution
function countDist(items) {
  const counts = {1:0, 2:0, 3:0, 4:0};
  items.forEach(d => { if (d.ans >= 1 && d.ans <= 4) counts[d.ans]++; });
  return counts;
}

// Swap ans position for an MC item: move correct answer to target position
function swapAns(decision, newAns) {
  if (decision.wa) return; // skip written
  const oldAns = decision.ans;
  if (oldAns === newAns) return;

  const ch = [...decision.ch];
  const correctChoice = ch[oldAns - 1];
  const targetChoice = ch[newAns - 1];

  // Swap
  ch[newAns - 1] = correctChoice;
  ch[oldAns - 1] = targetChoice;

  decision.ch = ch;
  decision.ans = newAns;

  // Update analysis if it has ① ② ③ ④ markers
  if (decision.analysis) {
    // Rebuild analysis with swapped positions
    const lines = decision.analysis.split('\n');
    if (lines.length >= 4) {
      const newLines = [...lines];
      // Find and swap the lines corresponding to oldAns and newAns
      const oldIdx = oldAns - 1;
      const newIdx = newAns - 1;
      if (oldIdx < lines.length && newIdx < lines.length) {
        // Extract content after marker
        const markers = ['①', '②', '③', '④'];
        const getContent = (line) => {
          for (const m of markers) {
            if (line.includes(m)) return line.substring(line.indexOf(m) + m.length).trim();
          }
          return line;
        };

        const oldContent = getContent(lines[oldIdx]);
        const newContent = getContent(lines[newIdx]);

        newLines[oldIdx] = `${markers[oldIdx]} ${newContent}`;
        newLines[newIdx] = `${markers[newIdx]} ${oldContent}`;

        decision.analysis = newLines.join('\n');
      }
    }
  }
}

// Check for 3 consecutive same ans
function has3Consecutive(items) {
  for (let i = 0; i < items.length - 2; i++) {
    if (items[i].ans && items[i+1].ans && items[i+2].ans) {
      if (items[i].ans === items[i+1].ans && items[i+1].ans === items[i+2].ans) {
        return { idx: i, val: items[i].ans };
      }
    }
  }
  return null;
}

// Balance distribution
let iterations = 0;
const maxIter = 100;

while (iterations < maxIter) {
  iterations++;
  const counts = countDist(mcItems);

  // Find overrepresented and underrepresented
  const over = Object.entries(counts).filter(([k,v]) => v > targetMax).map(([k]) => parseInt(k));
  const under = Object.entries(counts).filter(([k,v]) => v < targetMax).map(([k]) => parseInt(k));

  if (over.length === 0) {
    // Check consecutive
    const consec = has3Consecutive(decisions);
    if (!consec) break; // All good!

    // Fix consecutive by swapping middle item to least used ans
    const midIdx = consec.idx + 1;
    const midItem = decisions[midIdx];
    if (midItem.wa) break; // Can't swap written

    const leastUsed = Object.entries(counts)
      .filter(([k]) => parseInt(k) !== consec.val)
      .sort((a,b) => a[1] - b[1])[0];

    if (leastUsed) {
      swapAns(midItem, parseInt(leastUsed[0]));
    } else break;
    continue;
  }

  // Find an item with overrepresented ans and swap to underrepresented
  const overVal = over[0];
  const underVal = under[0];

  // Find best item to swap (prefer items not adjacent to same underVal)
  const candidates = mcItems.filter(d => d.ans === overVal);
  if (candidates.length === 0 || !underVal) break;

  swapAns(candidates[candidates.length - 1], underVal);
}

// Final check
const finalCounts = countDist(mcItems);
const consec = has3Consecutive(decisions);

console.log(`ans 분포: ${JSON.stringify(finalCounts)}`);
if (consec) console.log(`⚠️  3연속: Q${decisions[consec.idx].id}~Q${decisions[consec.idx+2].id}`);
else console.log('✅ 3연속 없음');

const maxVal = Math.max(...Object.values(finalCounts));
if (maxVal > 5) console.log(`⚠️  최대 ${maxVal}개`);
else console.log('✅ 최대 5개 이하');

// Write back
fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
console.log(`✅ 저장: ${file}`);
