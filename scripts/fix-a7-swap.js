#!/usr/bin/env node
/**
 * fix-a7-swap.js — A7(3연속 동일번호) 해소: 문항 위치 스왑
 *
 * 마커형 문항은 선지 회전 불가하므로, 연속 run 중 한 문항을 다른 위치의 문항과 교환.
 * 교환 시 content(type/passage/ch/ans/det/overlay/fullPassage 등) 전부 교환.
 * id와 pts는 위치에 귀속 (원래 위치의 id/pts 유지).
 *
 * A6는 이 스크립트로 해결 불가 — 별도 에이전트 필요.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VALIDATE_PATH = path.join(__dirname, '..', 'validate', 'validate.js');

function getMcQuestions(questions) {
  return questions.filter(q => q.fmt !== 'written');
}

function getA7Runs(questions) {
  const runs = [];
  const mcQs = getMcQuestions(questions);
  for (let i = 0; i < mcQs.length - 2; i++) {
    if (mcQs[i].ans === mcQs[i+1].ans && mcQs[i+1].ans === mcQs[i+2].ans) {
      runs.push({
        mcIndices: [i, i+1, i+2],
        ids: [mcQs[i].id, mcQs[i+1].id, mcQs[i+2].id],
        ans: mcQs[i].ans
      });
    }
  }
  return runs;
}

function wouldCreateA7(questions, idxA, idxB) {
  // Simulate swap and check for A7
  const copy = questions.map(q => ({ ...q }));
  // Swap everything except id (pts moves with content because it depends on diff)
  const keysToSwap = Object.keys(copy[idxA]).filter(k => k !== 'id');
  for (const k of keysToSwap) {
    const tmp = copy[idxA][k];
    copy[idxA][k] = copy[idxB][k];
    copy[idxB][k] = tmp;
  }
  return getA7Runs(copy).length;
}

function swapQuestions(questions, idxA, idxB) {
  // Collect all unique keys from both (keep only id fixed to position)
  const allKeys = new Set([
    ...Object.keys(questions[idxA]),
    ...Object.keys(questions[idxB])
  ].filter(k => k !== 'id'));

  const tempA = {};
  const tempB = {};
  for (const k of allKeys) {
    tempA[k] = questions[idxA][k];
    tempB[k] = questions[idxB][k];
  }
  // Remove old keys
  for (const k of allKeys) {
    delete questions[idxA][k];
    delete questions[idxB][k];
  }
  // Assign swapped
  Object.assign(questions[idxA], tempB);
  Object.assign(questions[idxB], tempA);
}

function validate(filePath) {
  try {
    const result = execSync(`node "${VALIDATE_PATH}" "${filePath}" 2>&1`, { encoding: 'utf8' });
    return { pass: !result.includes('[FAIL]'), output: result };
  } catch (e) {
    return { pass: false, output: e.stdout || e.message };
  }
}

// Main
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (args.length === 0) {
  console.error('Usage: node fix-a7-swap.js <file1.json> ...');
  process.exit(1);
}

let passCount = 0, failCount = 0;
const failFiles = [];

for (const file of args) {
  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) continue;

  const pre = validate(absPath);
  if (pre.pass) { passCount++; continue; }
  if (!pre.output.includes('A7')) { failCount++; failFiles.push(file); continue; }

  console.log(`[SWAP] ${file}`);
  const data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  const questions = data.questions;

  let maxAttempts = 20;
  let anyFixed = false;

  while (maxAttempts-- > 0) {
    const runs = getA7Runs(questions);
    if (runs.length === 0) break;

    const run = runs[0];
    const runAns = run.ans;
    // The middle question of the run (full array index)
    const middleId = run.ids[1];
    const middleFullIdx = questions.findIndex(q => q.id === middleId);

    // Find a swap partner: different ans, not in any A7 run, not adjacent to same ans
    let bestPartner = -1;
    let bestRunCount = Infinity;

    for (let i = 0; i < questions.length; i++) {
      if (questions[i].fmt === 'written') continue;
      if (questions[i].ans === runAns) continue;
      if (i === middleFullIdx) continue;

      const newRunCount = wouldCreateA7(questions, middleFullIdx, i);
      if (newRunCount < runs.length && newRunCount < bestRunCount) {
        bestRunCount = newRunCount;
        bestPartner = i;
      }
    }

    if (bestPartner === -1) {
      // Try first or last of run
      for (const tryId of [run.ids[0], run.ids[2]]) {
        const tryIdx = questions.findIndex(q => q.id === tryId);
        for (let i = 0; i < questions.length; i++) {
          if (questions[i].fmt === 'written') continue;
          if (questions[i].ans === runAns) continue;
          if (i === tryIdx) continue;
          const newRunCount = wouldCreateA7(questions, tryIdx, i);
          if (newRunCount < runs.length && newRunCount < bestRunCount) {
            bestRunCount = newRunCount;
            bestPartner = i;
            // Update middle to this
            break;
          }
        }
        if (bestPartner !== -1) {
          // Swap tryIdx instead
          swapQuestions(questions, tryIdx, bestPartner);
          anyFixed = true;
          console.log(`  Q${questions[tryIdx].id}(pos${tryIdx+1}) ↔ Q${questions[bestPartner].id}(pos${bestPartner+1})`);
          break;
        }
      }
      if (bestPartner === -1) {
        console.log(`  → STUCK: 스왑 대상 없음`);
        break;
      }
    } else {
      swapQuestions(questions, middleFullIdx, bestPartner);
      anyFixed = true;
      console.log(`  Q${questions[middleFullIdx].id}(pos${middleFullIdx+1}) ↔ Q${questions[bestPartner].id}(pos${bestPartner+1})`);
    }
  }

  if (anyFixed) {
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

    // Also run fix-a6a7 for remaining A6
    try {
      execSync(`node "${path.join(__dirname, 'fix-a6a7.js')}" "${absPath}" 2>&1`, { encoding: 'utf8' });
    } catch (e) {}

    const post = validate(absPath);
    if (post.pass) {
      console.log(`  → PASS`);
      passCount++;
    } else {
      const remains = post.output.split('\n').filter(l => l.includes('[S]')).map(l => l.trim());
      console.log(`  → STILL FAIL: ${remains.slice(0,3).join(' | ')}`);
      failCount++;
      failFiles.push(file);
    }
  } else {
    failCount++;
    failFiles.push(file);
  }
}

console.log(`\n=== Summary: ${passCount} PASS, ${failCount} FAIL ===`);
if (failFiles.length > 0) {
  console.log('Remaining:');
  failFiles.forEach(f => console.log('  ' + f));
}
