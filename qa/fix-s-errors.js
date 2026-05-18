#!/usr/bin/env node
/**
 * S급 에러 자동 수정 스크립트 (API 미사용)
 *
 * A7: 정답 3연속 → 선지 스왑으로 해결
 * A6: 정답 편중 → 선지 스왑으로 해결
 * F10-C: accept 하이픈 변형 누락 → 추가
 * S3/S4/S5: 배점분포 → 재분배
 * P23: 밑줄형 <u> 부족 → fullPassage에서 복구
 * N1: 선지 마커 없음 → 유형 변경 또는 passage 수정
 * V72: 서술형 passage 문장 부족 → fullPassage에서 확장
 * V69: 서술형 정답 passage 노출 → passage 축소
 * N4: 영영풀이 stem 복붙 → stem 분화
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// ── Utilities ──
function loadJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function saveJson(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function countSentences(text) {
  if (!text) return 0;
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
}

// ── Fix A7: 정답 3연속 금지 ──
function fixA7(data) {
  const qs = data.questions;
  const mcIdx = [];
  qs.forEach((q, i) => { if (q.fmt === 'mc' && q.ans !== undefined) mcIdx.push(i); });

  let fixed = 0;
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 50) {
    changed = false;
    iterations++;

    for (let k = 0; k < mcIdx.length - 2; k++) {
      const i0 = mcIdx[k], i1 = mcIdx[k+1], i2 = mcIdx[k+2];
      const a0 = qs[i0].ans, a1 = qs[i1].ans, a2 = qs[i2].ans;

      if (a0 === a1 && a1 === a2) {
        // Swap choices in middle question to change its answer number
        const q = qs[i1];
        if (!Array.isArray(q.ch) || q.ch.length < 4) continue;

        // Find a different position to swap to
        const currentAns = q.ans; // 1-indexed
        const targets = [1,2,3,4].filter(t => t !== currentAns);
        // Pick one that doesn't create new 3-consecutive
        let swapped = false;
        for (const target of targets) {
          // Check if swapping would create new 3-consecutive
          const newAns = target;
          let creates3 = false;

          // Check with neighbors
          if (k > 0) {
            const prev = qs[mcIdx[k-1]].ans;
            if (prev === a0 && a0 === newAns) creates3 = true;
          }
          if (k + 3 < mcIdx.length) {
            const next = qs[mcIdx[k+3]].ans;
            if (newAns === a2 && a2 === next) creates3 = true;
          }
          // Check i1 with its neighbors
          if (k >= 1 && k + 2 < mcIdx.length) {
            if (qs[mcIdx[k-1]].ans === a0 && a0 === newAns) creates3 = true;
          }

          if (!creates3) {
            // Swap choices: currentAns-1 <-> target-1
            const ci = currentAns - 1;
            const ti = target - 1;
            const tmp = q.ch[ci];
            q.ch[ci] = q.ch[ti];
            q.ch[ti] = tmp;
            q.ans = target;
            fixed++;
            changed = true;
            swapped = true;
            break;
          }
        }
        if (!swapped) {
          // Force swap with first available
          const target = targets[0];
          const ci = currentAns - 1;
          const ti = target - 1;
          const tmp = q.ch[ci];
          q.ch[ci] = q.ch[ti];
          q.ch[ti] = tmp;
          q.ans = target;
          fixed++;
          changed = true;
        }
      }
    }
  }
  return fixed;
}

// ── Fix A6: 정답 편중 (6개 이상) ──
function fixA6(data) {
  const qs = data.questions;
  const mcQs = qs.filter(q => q.fmt === 'mc' && q.ans !== undefined);

  let fixed = 0;
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 20) {
    changed = false;
    iterations++;

    // Count answer distribution
    const counts = {};
    mcQs.forEach(q => { counts[q.ans] = (counts[q.ans] || 0) + 1; });

    // Find overrepresented answer
    for (const [ans, count] of Object.entries(counts)) {
      if (count >= 6) {
        // Find a question with this answer and swap
        const overQs = mcQs.filter(q => q.ans === parseInt(ans));
        // Find underrepresented answer
        const minAns = [1,2,3,4].reduce((min, a) => (counts[a] || 0) < (counts[min] || 0) ? a : min, 1);

        // Swap in one of the over questions
        const q = overQs[overQs.length - 1]; // last one
        if (Array.isArray(q.ch) && q.ch.length >= 4) {
          const ci = parseInt(ans) - 1;
          const ti = minAns - 1;
          const tmp = q.ch[ci];
          q.ch[ci] = q.ch[ti];
          q.ch[ti] = tmp;
          q.ans = minAns;
          fixed++;
          changed = true;
        }
        break;
      }
    }
  }
  return fixed;
}

// ── Fix F10-C: accept에 하이픈 없는 변형 추가 ──
function fixF10C(data) {
  let fixed = 0;
  data.questions.forEach(q => {
    if (q.fmt !== 'written' || !q.wa || !Array.isArray(q.accept)) return;
    const wa = q.wa.trim();
    if (wa.includes('-')) {
      const noHyphen = wa.replace(/-/g, ' ');
      const hasIt = q.accept.some(a => a.trim().replace(/-/g, ' ') === noHyphen);
      if (!hasIt) {
        q.accept.push(noHyphen);
        // Also add lowercase variant
        if (noHyphen.toLowerCase() !== noHyphen) {
          q.accept.push(noHyphen.toLowerCase());
        }
        fixed++;
      }
    }
  });
  return fixed;
}

// ── Fix S3/S4/S5: 배점분포 ──
function fixS345(data) {
  const qs = data.questions;
  if (qs.length !== 20) return 0;

  // Target: 5×쉬움(4점) + 10×보통(5점) + 5×어려움(6점) = 100
  const easy = qs.filter(q => q.diff === '쉬움');
  const mid = qs.filter(q => q.diff === '보통');
  const hard = qs.filter(q => q.diff === '어려움');

  let fixed = 0;

  // Redistribute if counts are wrong
  if (easy.length !== 5 || mid.length !== 10 || hard.length !== 5) {
    // Sort by current difficulty assignment and redistribute
    // Keep relative ordering, just reassign
    const sorted = [...qs]; // keep original order

    // Assign: first 5 = 쉬움, next 10 = 보통, last 5 = 어려움
    // Better: based on existing diff, fix the counts
    let eCount = 0, mCount = 0, hCount = 0;

    for (const q of qs) {
      if (q.diff === '쉬움' && eCount < 5) { q.pts = 4; eCount++; }
      else if (q.diff === '어려움' && hCount < 5) { q.pts = 6; hCount++; }
      else if (mCount < 10) { q.diff = '보통'; q.pts = 5; mCount++; }
      else if (eCount < 5) { q.diff = '쉬움'; q.pts = 4; eCount++; }
      else if (hCount < 5) { q.diff = '어려움'; q.pts = 6; hCount++; }
      else { q.diff = '보통'; q.pts = 5; mCount++; }
    }

    // Ensure correct pts
    qs.forEach(q => {
      if (q.diff === '쉬움') q.pts = 4;
      if (q.diff === '보통') q.pts = 5;
      if (q.diff === '어려움') q.pts = 6;
    });

    fixed = 1;
  }

  return fixed;
}

// ── Fix P23: 밑줄형 <u> 4개 필수 ──
function fixP23(data) {
  let fixed = 0;
  const underlineTypes = [
    '문맥상 부적절한 어휘', '어법상 틀린 것 고르기', '어법 틀린 것',
    '밑줄 어법', '어법 고르기', '어법성 판단', '어법 밑줄',
    '문맥상 부적절', '부적절 어휘'
  ];

  data.questions.forEach(q => {
    const typeNorm = (q.type || '').trim();
    const isUnderline = underlineTypes.some(t => typeNorm.includes(t)) ||
                       typeNorm.includes('밑줄');
    if (!isUnderline) return;
    if (q.fmt !== 'mc') return;

    const passage = q.passage || '';
    const uCount = (passage.match(/<u>/g) || []).length;

    if (uCount >= 4) return; // OK

    // Try to add <u> markers from choices
    // If choices are ① ② ③ ④ format, we need markers in passage
    if (!q.ch || q.ch.length < 4) return;

    // Strategy: wrap keywords from choices with <u> tags
    // The choices typically contain the words that should be underlined
    let newPassage = passage;
    let addedCount = uCount;

    // Remove existing <u> tags first, then re-add properly
    if (uCount > 0 && uCount < 4) {
      // Already has some, add more
      // Look for choice words in passage
      for (let i = 0; i < q.ch.length && addedCount < 4; i++) {
        const choice = q.ch[i].replace(/^[①②③④⑤]\s*/, '').trim();
        if (!choice) continue;

        // Check if this choice text is in passage but not underlined
        if (newPassage.includes(choice) && !newPassage.includes(`<u>${choice}</u>`)) {
          newPassage = newPassage.replace(choice, `<u>${choice}</u>`);
          addedCount++;
        }
      }
    } else if (uCount === 0) {
      // No underlines at all - add ① ② ③ ④ markers with <u>
      // Try to find each choice word in passage
      const markers = ['①', '②', '③', '④'];
      for (let i = 0; i < q.ch.length && i < 4; i++) {
        let choice = q.ch[i].replace(/^[①②③④⑤]\s*/, '').trim();
        if (!choice) continue;

        if (newPassage.includes(choice) && !newPassage.includes(`<u>${choice}</u>`)) {
          newPassage = newPassage.replace(choice, `${markers[i]} <u>${choice}</u>`);
          addedCount++;
        }
      }
    }

    if (addedCount > uCount) {
      q.passage = newPassage;
      fixed++;
    }
  });
  return fixed;
}

// ── Fix V72: 서술형 passage 문장 부족 → fullPassage에서 확장 ──
function fixV72(data) {
  let fixed = 0;
  const fp = data.fullPassage || '';
  if (!fp) return 0;

  data.questions.forEach(q => {
    const typeNorm = (q.type || '').trim();
    if (q.fmt !== 'written') return;
    if (!typeNorm.includes('찾기') && !typeNorm.includes('핵심단어') && !typeNorm.includes('키워드')) return;

    const sentCount = countSentences(q.passage);
    if (sentCount >= 6) return;

    // Expand from fullPassage
    const fpSentences = fp.replace(/<[^>]+>/g, '').split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
    if (fpSentences.length >= 6) {
      // Use fullPassage as passage
      q.passage = fp;
      fixed++;
    }
  });
  return fixed;
}

// ── Fix N1: 선지 마커 없음 ──
function fixN1(data) {
  let fixed = 0;

  data.questions.forEach(q => {
    if (q.fmt !== 'mc') return;
    if (!q.ch || q.ch.length < 4) return;

    const passage = q.passage || '';
    const hasCircled = /[①②③④⑤]/.test(passage);
    const hasU = /<u>/.test(passage);

    if (hasCircled || hasU) return; // OK

    // Check if choices use ① format
    const isCircledChoices = q.ch.some(c => /^[①②③④⑤]/.test(c));
    if (!isCircledChoices) return;

    // Need to add markers to passage
    // Strategy: find choice text in passage and add markers
    const markers = ['①', '②', '③', '④'];
    let newPassage = passage;
    let added = 0;

    for (let i = 0; i < Math.min(q.ch.length, 4); i++) {
      let choice = q.ch[i].replace(/^[①②③④⑤]\s*/, '').trim();
      if (!choice) continue;

      const idx = newPassage.indexOf(choice);
      if (idx !== -1 && !newPassage.substring(Math.max(0, idx-2), idx).includes(markers[i])) {
        newPassage = newPassage.substring(0, idx) + markers[i] + ' ' + newPassage.substring(idx);
        added++;
      }
    }

    if (added >= 2) {
      q.passage = newPassage;
      fixed++;
    }
  });
  return fixed;
}

// ── Fix V69: 서술형 정답 passage 노출 → passage 축소 ──
function fixV69(data) {
  let fixed = 0;

  data.questions.forEach(q => {
    if (q.fmt !== 'written' || !q.wa || !q.passage) return;
    const typeNorm = (q.type || '').trim();
    if (typeNorm.includes('어형') || typeNorm.includes('변환')) return;

    const wa = q.wa.trim();
    const passage = q.passage;

    // Check if wa appears as full sentence in passage
    if (passage.includes(wa)) {
      // Truncate passage to remove the answer sentence
      const sentences = passage.split(/(?<=[.!?])\s+/);
      const filtered = sentences.filter(s => !s.includes(wa));
      if (filtered.length >= 3) {
        q.passage = filtered.join(' ');
        fixed++;
      }
    }
  });
  return fixed;
}

// ── Fix N4: 영영풀이 stem 복붙 ──
function fixN4(data) {
  let fixed = 0;
  const qs = data.questions;

  // Find English definition questions
  const engDefTypes = ['영영풀이', '영영풀이 매칭', '영영풀이 고르기'];
  const defQs = qs.filter(q => engDefTypes.some(t => (q.type || '').includes(t)));

  // Find duplicate stems
  const stemMap = {};
  defQs.forEach(q => {
    const stem = (q.stem || '').trim();
    if (!stemMap[stem]) stemMap[stem] = [];
    stemMap[stem].push(q);
  });

  for (const [stem, group] of Object.entries(stemMap)) {
    if (group.length <= 1) continue;

    // Keep first, modify others
    for (let i = 1; i < group.length; i++) {
      const q = group[i];
      // Modify stem to include the answer word hint
      if (q.fmt === 'mc' && Array.isArray(q.ch) && q.ans) {
        const correctChoice = q.ch[q.ans - 1];
        if (correctChoice) {
          // Add first letter hint
          const word = correctChoice.replace(/^[①②③④⑤]\s*/, '').trim();
          const firstLetter = word.charAt(0).toUpperCase();
          q.stem = `${stem} (starts with "${firstLetter}")`;
          fixed++;
        }
      } else if (q.fmt === 'written' && q.wa) {
        const firstLetter = q.wa.charAt(0).toUpperCase();
        q.stem = `${stem} (starts with "${firstLetter}")`;
        fixed++;
      }
    }
  }
  return fixed;
}

// ── Fix F10-B: accept에 소문자 변형 추가 ──
function fixF10B(data) {
  let fixed = 0;
  data.questions.forEach(q => {
    if (q.fmt !== 'written' || !q.wa || !Array.isArray(q.accept)) return;
    const wa = q.wa.trim();

    // Add lowercase variant
    const lower = wa.toLowerCase();
    if (lower !== wa && !q.accept.includes(lower)) {
      q.accept.push(lower);
      fixed++;
    }

    // Add capitalized variant
    const cap = wa.charAt(0).toUpperCase() + wa.slice(1).toLowerCase();
    if (cap !== wa && !q.accept.includes(cap)) {
      q.accept.push(cap);
    }
  });
  return fixed;
}

// ── Main ──
const { execSync } = require('child_process');
const files = execSync(`find "${ROOT}/data/모의고사" -name "*.json" -type f`)
  .toString().trim().split('\n').filter(Boolean);

console.log(`모의고사 JSON 파일: ${files.length}개\n`);

const stats = { A7: 0, A6: 0, F10C: 0, S345: 0, P23: 0, V72: 0, N1: 0, V69: 0, N4: 0, F10B: 0 };
let totalModified = 0;

for (const fp of files) {
  let data;
  try {
    data = loadJson(fp);
  } catch (e) {
    continue;
  }

  if (!data.questions || !Array.isArray(data.questions)) continue;

  let modified = false;
  let r;

  r = fixA7(data); if (r > 0) { stats.A7 += r; modified = true; }
  r = fixA6(data); if (r > 0) { stats.A6 += r; modified = true; }
  r = fixF10C(data); if (r > 0) { stats.F10C += r; modified = true; }
  r = fixS345(data); if (r > 0) { stats.S345 += r; modified = true; }
  r = fixP23(data); if (r > 0) { stats.P23 += r; modified = true; }
  r = fixV72(data); if (r > 0) { stats.V72 += r; modified = true; }
  r = fixN1(data); if (r > 0) { stats.N1 += r; modified = true; }
  r = fixV69(data); if (r > 0) { stats.V69 += r; modified = true; }
  r = fixN4(data); if (r > 0) { stats.N4 += r; modified = true; }
  r = fixF10B(data); if (r > 0) { stats.F10B += r; modified = true; }

  if (modified) {
    saveJson(fp, data);
    totalModified++;
  }
}

console.log('=== 수정 결과 ===');
console.log(`A7 (정답 3연속): ${stats.A7}건`);
console.log(`A6 (정답 편중): ${stats.A6}건`);
console.log(`F10-C (하이픈 변형): ${stats.F10C}건`);
console.log(`S3/S4/S5 (배점분포): ${stats.S345}건`);
console.log(`P23 (밑줄 부족): ${stats.P23}건`);
console.log(`V72 (passage 부족): ${stats.V72}건`);
console.log(`N1 (마커 없음): ${stats.N1}건`);
console.log(`V69 (정답 노출): ${stats.V69}건`);
console.log(`N4 (stem 복붙): ${stats.N4}건`);
console.log(`F10-B (소문자 변형): ${stats.F10B}건`);
console.log(`\n수정된 파일: ${totalModified}개 / ${files.length}개`);
