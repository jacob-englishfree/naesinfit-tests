#!/usr/bin/env node
/**
 * A6: 정답 분포 한 번호 5개 초과 수정
 * marker형(①②③④) 문항의 ans를 rotate하여 분포 균형 조정
 * Non-marker 문항은 선지 순서를 바꾸고 ans를 업데이트
 */
const fs = require('fs');
const path = require('path');

const MARKERS = ['①', '②', '③', '④'];

function rotateMarkerQuestion(q, shift) {
  // passage 마커 회전 + ans 재계산
  if (!q.passage) return null;
  const newPassage = q.passage.replace(/[①②③④]/g, m => {
    const idx = MARKERS.indexOf(m);
    return MARKERS[(idx + shift) % 4];
  });
  const newAns = ((q.ans - 1 + shift) % 4) + 1;
  return { passage: newPassage, ans: newAns };
}

function swapNonMarkerAnswer(q, targetAns) {
  // 현재 ans → targetAns로 변경 (선지 순서 swap)
  if (q.ans === targetAns) return null;
  const oldIdx = q.ans - 1;
  const newIdx = targetAns - 1;
  const newCh = [...q.ch];
  // Swap choices at oldIdx and newIdx
  [newCh[oldIdx], newCh[newIdx]] = [newCh[newIdx], newCh[oldIdx]];
  // Update det.analysis if it references positions
  return { ch: newCh, ans: targetAns };
}

function isMarkerQuestion(q) {
  return q.ch && q.ch.length === 4 && MARKERS.every((m, i) => {
    const trimmed = (q.ch[i] || '').trim();
    return trimmed === m || trimmed === m + ' ';
  });
}

function fixA6(jsonFile) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const questions = data.questions || [];
  const MAX_SAME_ANS = 5;

  // Count current ans distribution
  function getAnsCounts() {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const q of questions) {
      if (q.fmt === 'mc' && typeof q.ans === 'number' && q.ans >= 1 && q.ans <= 4) {
        counts[q.ans]++;
      }
    }
    return counts;
  }

  let counts = getAnsCounts();
  let changed = false;

  // Find overloaded answers
  for (let overAns = 1; overAns <= 4; overAns++) {
    while (counts[overAns] > MAX_SAME_ANS) {
      // Find a rotatable marker question with this ans
      let fixed = false;

      // Try marker questions first
      for (const q of questions) {
        if (q.fmt !== 'mc' || q.ans !== overAns) continue;
        if (!isMarkerQuestion(q)) continue;
        if (q.type === '내용이해 T/F') continue; // T/F 건드리지 않음

        // Try rotating to find underloaded target
        for (let shift = 1; shift <= 3; shift++) {
          const targetAns = ((overAns - 1 + shift) % 4) + 1;
          if (counts[targetAns] < MAX_SAME_ANS) {
            const result = rotateMarkerQuestion(q, shift);
            if (result) {
              q.passage = result.passage;
              q.ans = result.ans;
              counts[overAns]--;
              counts[targetAns]++;
              console.log(`  Q${q.id}(marker): ans ${overAns}→${targetAns} (shift=${shift})`);
              changed = true;
              fixed = true;
              break;
            }
          }
        }
        if (fixed) break;
      }

      if (!fixed) {
        // Try non-marker questions (빈칸추론, 주제 etc. — not T/F, not 오류찾기)
        for (const q of questions) {
          if (q.fmt !== 'mc' || q.ans !== overAns) continue;
          if (isMarkerQuestion(q)) continue;
          if (/T\/F|T.F|내용이해/.test(q.type || '')) continue;
          if (/오류/.test(q.type || '')) continue;

          // Find underloaded target
          for (let targetAns = 1; targetAns <= 4; targetAns++) {
            if (targetAns === overAns) continue;
            if (counts[targetAns] < MAX_SAME_ANS) {
              const result = swapNonMarkerAnswer(q, targetAns);
              if (result) {
                q.ch = result.ch;
                q.ans = result.ans;
                counts[overAns]--;
                counts[targetAns]++;
                console.log(`  Q${q.id}(swap): ans ${overAns}→${targetAns}`);
                changed = true;
                fixed = true;
                break;
              }
            }
          }
          if (fixed) break;
        }
      }

      if (!fixed) {
        console.log(`  [WARN] Cannot fix ans=${overAns} count=${counts[overAns]} — manual fix needed`);
        break;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[FIXED] ${jsonFile} final counts: ${JSON.stringify(counts)}`);
  } else {
    console.log(`[SKIP] ${jsonFile} — no changes`);
  }
  return changed;
}

const targetFiles = process.argv.slice(2);
if (!targetFiles.length) { console.error('Usage: node fix-a6.js <file...>'); process.exit(1); }

let total = 0;
for (const f of targetFiles) {
  if (fixA6(f)) total++;
}
console.log(`\n완료: ${total}개 수정`);
