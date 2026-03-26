#!/usr/bin/env node
/**
 * 5지선다 → 4지선다 일괄 변환 스크립트
 * - ch 배열에서 가장 약한 오답 1개 제거 (정답 보존)
 * - ans 인덱스 조정
 * - passage의 ⑤ 마커 관련 처리
 * - 부적절어휘: ①~⑤ → ①~④ (5번째 밑줄 제거)
 * - TF: 5선지 → 4선지
 */

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('Usage: node scripts/fix-to-4choices.js file1.json file2.json ...');
  process.exit(1);
}

files.forEach(filePath => {
  const absPath = path.resolve(filePath);
  const raw = fs.readFileSync(absPath, 'utf8');
  const data = JSON.parse(raw);

  let modified = false;

  data.questions.forEach(q => {
    if (q.fmt !== 'mc' || !Array.isArray(q.ch)) return;
    if (q.ch.length <= 4) return; // already 4 or less

    // Need to remove one choice (the 5th, or the worst distractor)
    const ans = q.ans;

    // Strategy: remove the last choice if it's not the answer
    // If last IS the answer, remove the 4th (index 3)
    let removeIdx;
    if (ans === 4) {
      // Answer is 5th choice → remove 4th (index 3), shift answer to index 3
      removeIdx = 3;
    } else if (ans === 3) {
      // Answer is 4th → remove 5th (index 4)
      removeIdx = 4;
    } else {
      // Answer is 1st~3rd → remove 5th (index 4)
      removeIdx = 4;
    }

    q.ch.splice(removeIdx, 1);

    // Adjust ans if needed
    if (removeIdx <= ans) {
      q.ans = ans - 1;
    }
    // else ans stays the same

    // Fix passage: remove ⑤ marker if present (부적절어휘)
    if (q.passage && q.passage.includes('⑤')) {
      // For 부적절어휘: remove ⑤<u>word</u> or just ⑤ marker
      // Replace ⑤<u>word</u> with just the word (no underline, no marker)
      q.passage = q.passage.replace(/⑤<u>([^<]+)<\/u>/g, '$1');
      // Also remove standalone ⑤
      q.passage = q.passage.replace(/⑤/g, '');
    }

    // Fix det text: remove references to ⑤
    if (q.det) {
      const detStr = JSON.stringify(q.det);
      if (detStr.includes('⑤')) {
        // Remove lines with ⑤ from analysis
        if (q.det.analysis) {
          q.det.analysis = q.det.analysis.split('\n')
            .filter(line => !line.includes('⑤'))
            .join('\n');
        }
        if (q.det.korean) {
          q.det.korean = q.det.korean.replace(/⑤[^\\n]*/g, '');
        }
      }
      // Fix wrongs array if present
      if (Array.isArray(q.det.wrongs)) {
        q.det.wrongs = q.det.wrongs.filter(w => !w.includes('⑤'));
      }
    }

    modified = true;
  });

  if (modified) {
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[FIXED] ${path.relative(process.cwd(), absPath)}`);
  } else {
    console.log(`[SKIP] ${path.relative(process.cwd(), absPath)} — already 4 choices`);
  }
});
