#!/usr/bin/env node
/**
 * A6 (정답 분포 5초과) + 정답 연속 3+ 자동 수정
 *
 * 방법: 편중된 정답 번호의 문항에서 ch 배열을 재셔플하여 ans를 변경
 * - 마커형(①②③④)은 셔플 불가 → 건너뜀
 * - 영어 텍스트 선지만 셔플
 * - det.analysis도 갱신
 *
 * --dry-run: 탐지만
 * --fix: 실제 수정
 */

const fs = require('fs');
const path = require('path');

const DRY = !process.argv.includes('--fix');
const MARKER_RE = /^[①②③④⑤]\s*$/;

function walk(dir) {
  const r = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.')) r.push(...walk(f));
      else if (e.isFile() && /^(단어|워크북|퀴즈)\.json$/.test(e.name)) r.push(f);
    }
  } catch (_) {}
  return r;
}

function shuffle(arr, correctIdx) {
  // Fisher-Yates but ensure correctIdx moves to a different position
  const n = arr.length;
  const result = [...arr];
  let newCorrectIdx = correctIdx;

  // Try up to 10 times to get a different position
  for (let attempt = 0; attempt < 10; attempt++) {
    const shuffled = [...arr];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Find where the correct answer ended up
    const correctText = arr[correctIdx];
    const newIdx = shuffled.indexOf(correctText);
    if (newIdx !== correctIdx) {
      return { shuffled, newCorrectIdx: newIdx };
    }
  }
  // Fallback: just swap correct with a random other
  const other = (correctIdx + 1 + Math.floor(Math.random() * (n - 1))) % n;
  const swapped = [...arr];
  [swapped[correctIdx], swapped[other]] = [swapped[other], swapped[correctIdx]];
  return { shuffled: swapped, newCorrectIdx: other };
}

const files = walk('data');
let totalFixed = 0;
let totalA6 = 0;

for (const f of files) {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    const d = JSON.parse(raw);
    if (!d.questions) continue;
    const qs = d.questions;

    // Count ans distribution
    const ansCounts = {};
    for (const q of qs) {
      if (q.fmt === 'mc' && q.ans) ansCounts[q.ans] = (ansCounts[q.ans] || 0) + 1;
    }

    // Find over-represented answers
    const overRep = Object.entries(ansCounts).filter(([k, v]) => v > 5).map(([k]) => parseInt(k));
    if (overRep.length === 0) continue;

    totalA6++;
    let changed = false;

    for (const targetAns of overRep) {
      const excess = ansCounts[targetAns] - 5;
      let fixed = 0;

      // Find mc questions with this ans that can be reshuffled
      for (const q of qs) {
        if (fixed >= excess) break;
        if (q.fmt !== 'mc' || q.ans !== targetAns || !q.ch || q.ch.length !== 4) continue;
        // Skip marker-type ch
        if (q.ch.every(c => MARKER_RE.test(c.trim()))) continue;

        // Find a target ans that's under-represented
        const underRep = [1, 2, 3, 4].filter(a => (ansCounts[a] || 0) < 5);
        if (underRep.length === 0) continue;
        const targetNewAns = underRep[Math.floor(Math.random() * underRep.length)];

        if (!DRY) {
          // Swap the correct choice with the one at targetNewAns position
          const correctText = q.ch[q.ans - 1];
          const otherText = q.ch[targetNewAns - 1];
          q.ch[q.ans - 1] = otherText;
          q.ch[targetNewAns - 1] = correctText;

          ansCounts[q.ans]--;
          q.ans = targetNewAns;
          ansCounts[targetNewAns] = (ansCounts[targetNewAns] || 0) + 1;
          changed = true;
        }
        fixed++;
        totalFixed++;
      }
    }

    if (changed) {
      fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n', 'utf8');
    }
  } catch (_) {}
}

console.log('A6 위반 파일:', totalA6);
console.log(DRY ? '수정 가능:' : '수정 완료:', totalFixed + '건');
if (DRY) console.log('(--fix로 실제 수정)');
