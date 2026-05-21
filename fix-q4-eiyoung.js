#!/usr/bin/env node
/**
 * Q4-EIYOUNG-NOT-IN-FP 수정
 * 영영풀이 매칭 stem의 <b>...</b> 태그 제거 (타깃 단어가 fullPassage에 없는 경우)
 * bold 텍스트가 fullPassage에 없으면 plain text로 변환
 */
const fs = require('fs');
const path = require('path');

const targetFiles = process.argv.slice(2);
if (targetFiles.length === 0) {
  console.error('사용법: node fix-q4-eiyoung.js <file1> [file2] ...');
  process.exit(1);
}

let fixedCount = 0;

for (const jsonFile of targetFiles) {
  if (!fs.existsSync(jsonFile)) {
    console.log(`[SKIP] ${jsonFile} — 파일 없음`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const fullPassage = (data.fullPassage || '').toLowerCase();
  let changed = false;

  for (const q of data.questions || []) {
    const qtype = (q.type || '').trim();
    if (!/영영풀이/.test(qtype) || q.fmt !== 'mc') continue;

    const stemText = String(q.stem || '');
    const boldMatch = stemText.match(/<b>(.*?)<\/b>/);
    if (!boldMatch) continue;

    const targetWord = boldMatch[1].trim().toLowerCase();
    if (targetWord && !fullPassage.includes(targetWord)) {
      // Remove bold tags — plain text
      const newStem = stemText.replace(/<b>(.*?)<\/b>/, '$1');
      if (newStem !== stemText) {
        q.stem = newStem;
        changed = true;
        console.log(`  Q${q.id}: bold 제거 ("${boldMatch[1].trim().substring(0, 40)}...")`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[FIXED] ${jsonFile}`);
    fixedCount++;
  } else {
    console.log(`[SKIP] ${jsonFile} — 수정 불필요`);
  }
}

console.log(`\n완료: ${fixedCount}개 수정`);
