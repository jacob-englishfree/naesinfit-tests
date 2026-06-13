#!/usr/bin/env node
/**
 * fix-a6a7-reorder.js — A6/A7 위반 해소를 위한 문항 순서 재배치
 *
 * 마커형 문항은 선지 회전이 불가하므로, 문항 순서를 바꿔서 3연속을 깨트린다.
 * A6(분포 초과)는 비마커형이 없으면 순서 재배치로도 해결 불가 → 에이전트 필요.
 *
 * 전략:
 * 1. A7 연속 3개 중 가운데 문항을 빼서 안전한 위치에 삽입
 * 2. 삽입 위치: 같은 ans가 연속하지 않는 곳
 * 3. id는 위치 순서대로 재번호 (1~20)
 * 4. 배점은 보존 (difficulty 순서: 쉬움1-5, 보통6-15, 어려움16-20)
 *    → 재배치 후 배점 재할당 (위치 기반)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VALIDATE_PATH = path.join(__dirname, '..', 'validate', 'validate.js');
const POINTS = { easy: 4, normal: 5, hard: 6 };
const DIFFICULTY_MAP = [
  // id 1-5: easy (4점), 6-15: normal (5점), 16-20: hard (6점)
  4,4,4,4,4, 5,5,5,5,5,5,5,5,5,5, 6,6,6,6,6
];

function getConsecutiveRuns(questions) {
  const runs = [];
  const mcQs = questions.filter(q => q.fmt !== 'written');
  for (let i = 0; i < mcQs.length - 2; i++) {
    if (mcQs[i].ans === mcQs[i+1].ans && mcQs[i+1].ans === mcQs[i+2].ans) {
      runs.push({
        indices: [i, i+1, i+2],
        ids: [mcQs[i].id, mcQs[i+1].id, mcQs[i+2].id],
        ans: mcQs[i].ans
      });
    }
  }
  return runs;
}

function hasA6(questions) {
  const dist = {};
  for (const q of questions) {
    if (q.fmt === 'written') continue;
    dist[q.ans] = (dist[q.ans] || 0) + 1;
  }
  return Object.values(dist).some(v => v > 5);
}

function validate(filePath) {
  try {
    const result = execSync(`node "${VALIDATE_PATH}" "${filePath}" 2>&1`, { encoding: 'utf8' });
    return !result.includes('[FAIL]');
  } catch (e) { return false; }
}

function fixFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const questions = data.questions;
  if (!questions || questions.length === 0) return false;

  let maxIter = 50;
  let changed = false;

  while (maxIter-- > 0) {
    const runs = getConsecutiveRuns(questions);
    if (runs.length === 0) break;

    const run = runs[0];
    // Move the middle question of the run to a safe spot
    const middleIdx = run.indices[1];
    const mcQs = questions.filter(q => q.fmt !== 'written');
    const middleQ = mcQs[middleIdx];

    // Find the index in the full questions array
    let fullIdx = questions.indexOf(middleQ);
    if (fullIdx === -1) break;

    // Remove from current position
    questions.splice(fullIdx, 1);

    // Find a safe insertion point (not creating new A7)
    let inserted = false;
    for (let tryPos = 0; tryPos <= questions.length; tryPos++) {
      // Check if inserting here creates A7
      const before = questions.slice(0, tryPos);
      const after = questions.slice(tryPos);
      const testArr = [...before, middleQ, ...after];

      const newRuns = getConsecutiveRuns(testArr);
      // Check this doesn't create runs involving our inserted question
      const oldRunCount = getConsecutiveRuns(questions).length;

      if (newRuns.length < runs.length && tryPos !== fullIdx) {
        // Insert here
        questions.splice(tryPos, 0, middleQ);
        changed = true;
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      // Put it back
      questions.splice(fullIdx, 0, middleQ);
      // Try moving first or last of run instead
      const altIdx = run.indices[0];
      const altQ = mcQs[altIdx];
      const altFullIdx = questions.indexOf(altQ);
      if (altFullIdx === -1) break;

      questions.splice(altFullIdx, 1);
      let altInserted = false;
      for (let tryPos = 0; tryPos <= questions.length; tryPos++) {
        const testArr = [...questions.slice(0, tryPos), altQ, ...questions.slice(tryPos)];
        const newRuns = getConsecutiveRuns(testArr);
        if (newRuns.length < runs.length && tryPos !== altFullIdx) {
          questions.splice(tryPos, 0, altQ);
          changed = true;
          altInserted = true;
          break;
        }
      }
      if (!altInserted) {
        questions.splice(altFullIdx, 0, altQ);
        break; // Can't fix this run
      }
    }
  }

  if (!changed) return false;

  // Reassign ids (1-based) and points based on new position
  for (let i = 0; i < questions.length; i++) {
    questions[i].id = i + 1;
    if (i < DIFFICULTY_MAP.length) {
      questions[i].pts = DIFFICULTY_MAP[i];
    }
  }

  data.questions = questions;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return true;
}

// Main
const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('--'));
if (files.length === 0) {
  console.error('Usage: node fix-a6a7-reorder.js <file1.json> ...');
  process.exit(1);
}

let passCount = 0, failCount = 0;
const failFiles = [];

for (const file of files) {
  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) continue;

  // Pre-check
  if (validate(absPath)) { passCount++; continue; }

  console.log(`[REORDER] ${file}`);
  const ok = fixFile(absPath);

  if (!ok) {
    console.log(`  → REORDER 실패 — 에이전트 수동 수정 필요`);
  }

  // Then run fix-a6a7 for any remaining A6 from non-marker Qs
  try {
    execSync(`node "${path.join(__dirname, 'fix-a6a7.js')}" "${absPath}" 2>&1`, { encoding: 'utf8' });
  } catch (e) {}

  if (validate(absPath)) {
    console.log(`  → PASS`);
    passCount++;
  } else {
    console.log(`  → STILL FAIL`);
    failCount++;
    failFiles.push(file);
  }
}

console.log(`\n=== Summary: ${passCount} PASS, ${failCount} FAIL ===`);
if (failFiles.length > 0) {
  console.log('Remaining:');
  failFiles.forEach(f => console.log('  ' + f));
}
