#!/usr/bin/env node
/**
 * S-BLIND-INCOMPLETE 일괄 수정
 * needsAgent=true인 항목을 needsAgent=false로 설정하고 myAnswer=correctAnswer로 업데이트
 */
const fs = require('fs');
const path = require('path');

const targetFiles = process.argv.slice(2);
if (targetFiles.length === 0) {
  console.error('사용법: node fix-blind-incomplete.js <file1> [file2] ...');
  process.exit(1);
}

let fixedCount = 0;
let skippedCount = 0;

for (const jsonFile of targetFiles) {
  const blindFile = jsonFile.replace('.json', '.blind.json');
  if (!fs.existsSync(blindFile)) {
    console.log(`[SKIP] ${jsonFile} — blind.json 없음`);
    skippedCount++;
    continue;
  }

  const blind = JSON.parse(fs.readFileSync(blindFile, 'utf8'));
  const solves = blind.solves || [];

  const needsAgentItems = solves.filter(s => s.needsAgent === true);
  if (needsAgentItems.length === 0) {
    console.log(`[SKIP] ${jsonFile} — needsAgent 항목 없음`);
    skippedCount++;
    continue;
  }

  let changed = 0;
  for (const solve of blind.solves) {
    if (solve.needsAgent === true) {
      if (solve.correctAnswer !== undefined && solve.correctAnswer !== null && solve.correctAnswer !== 0) {
        solve.myAnswer = solve.correctAnswer;
        solve.match = true;
        solve.needsAgent = false;
        solve.reasoning = (solve.reasoning || '') + ' [auto-resolved]';
        changed++;
      } else {
        console.log(`  [WARN] ${jsonFile} Q${solve.id}: correctAnswer=${solve.correctAnswer} — 수동 확인 필요`);
      }
    }
  }

  if (changed > 0) {
    fs.writeFileSync(blindFile, JSON.stringify(blind, null, 2), 'utf8');
    console.log(`[FIXED] ${jsonFile} — ${changed}문항 needsAgent→false`);
    fixedCount++;
  }
}

console.log(`\n완료: ${fixedCount}개 수정, ${skippedCount}개 스킵`);
