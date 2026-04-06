#!/usr/bin/env node
/**
 * fix-marker-rotate.js — 마커형 문항의 passage 마커를 회전시켜 ans 재분배
 *
 * 어법/부적절 문항에서 ①②③④ 마커를 passage에서 순환 이동하여
 * 정답 위치를 바꿈. 학생 풀이 결과는 동일 (부적절한 단어는 그대로).
 *
 * 사용: node validate/fix-marker-rotate.js <file> <qid> <rotation>
 *   rotation: 마커를 몇 칸 회전할지 (1=①→②, ②→③, ③→④, ④→①)
 */

const fs = require('fs');
const path = require('path');

const markers = ['①', '②', '③', '④'];

function rotateMarkers(passage, shift) {
  // passage 안의 ①②③④ 마커를 shift만큼 회전
  // ①<u>X</u> → ①<u>X</u> 는 그대로, 마커만 바꿈
  // shift=1: ①→②, ②→③, ③→④, ④→①

  return passage.replace(/[①②③④]/g, (m) => {
    const idx = markers.indexOf(m);
    const newIdx = (idx + shift) % 4;
    return markers[newIdx];
  });
}

function fixQuestion(q, shift) {
  // q.passage 마커 회전 + ans 재계산
  // 원래 ans 위치의 단어가 부적절한 것 → 회전 후 새 위치 추적
  // ans 1-indexed: 1=①, 2=②, 3=③, 4=④
  // shift=1일 때: ans=4 → ①(shift 전 ④), passage에서 원래 ④였던 단어가 ①로 표시됨
  //   그러므로 새로운 ans = (old_ans - 1 + shift) % 4 + 1

  if (q.fmt !== 'mc' || !q.passage) return q;
  if (!q.ch || q.ch.length !== 4) return q;
  if (!q.ch.every(c => markers.includes((c || '').trim()))) return q;

  const newPassage = rotateMarkers(q.passage, shift);
  const newAns = ((q.ans - 1 + shift) % 4) + 1;

  return { ...q, passage: newPassage, ans: newAns };
}

// CLI
const [file, qid, shift] = process.argv.slice(2);
if (!file || !qid || !shift) {
  console.error('Usage: node fix-marker-rotate.js <file> <qid> <shift>');
  process.exit(1);
}

const fp = path.resolve(file);
const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
const qidNum = parseInt(qid);
const shiftNum = parseInt(shift);

const q = data.questions.find(q => q.id === qidNum);
if (!q) { console.error('Q' + qid + ' not found'); process.exit(1); }

const oldAns = q.ans;
const newQ = fixQuestion(q, shiftNum);
const idx = data.questions.findIndex(q => q.id === qidNum);
data.questions[idx] = newQ;

fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
console.log(`[FIXED] ${file} Q${qid}: ans ${oldAns}→${newQ.ans} (shift ${shift})`);
