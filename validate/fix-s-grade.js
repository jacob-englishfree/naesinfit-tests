#!/usr/bin/env node
/**
 * fix-s-grade.js — A6/A7 S급 에러 자동 수정 (정답 편중/3연속)
 *
 * mc 문항의 선지(ch)를 셔플하여 정답번호를 재분배합니다.
 * 마커형 문항(①②③④)은 고정, 나머지만 셔플.
 * wa(서술형 정답)는 건드리지 않습니다.
 *
 * Usage: node validate/fix-s-grade.js data/교과서/
 */

const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node validate/fix-s-grade.js <directory>');
  process.exit(1);
}

function findJsonFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results = results.concat(findJsonFiles(full));
    else if (e.name.endsWith('.json')) results.push(full);
  }
  return results;
}

const circleMarkers = ['①', '②', '③', '④', '⑤'];

function isMarkerType(q) {
  return q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 4 &&
    q.ch.every(c => circleMarkers.includes((c || '').trim()));
}

function isMc(q) {
  return q.fmt === 'mc' && typeof q.ans === 'number' && Array.isArray(q.ch) && q.ch.length === 4;
}

function isShuffleable(q) {
  return isMc(q) && !isMarkerType(q);
}

function hasA6A7(questions) {
  const mcQs = questions.filter(q => isMc(q));

  // A6: 한 정답번호 6개 이상
  const dist = {};
  mcQs.forEach(q => { dist[q.ans] = (dist[q.ans] || 0) + 1; });
  const hasA6 = Object.values(dist).some(c => c > 5);

  // A7: 3연속
  let hasA7 = false;
  for (let i = 0; i < mcQs.length - 2; i++) {
    if (mcQs[i].ans === mcQs[i + 1].ans && mcQs[i + 1].ans === mcQs[i + 2].ans) {
      hasA7 = true;
      break;
    }
  }

  return hasA6 || hasA7;
}

function setAnsTo(q, targetAns) {
  // 선지를 재배열하여 정답이 targetAns 번째가 되도록
  if (!isShuffleable(q)) return q;
  const correctIdx = q.ans - 1;
  const correctChoice = q.ch[correctIdx];
  const targetIdx = targetAns - 1;

  const newCh = [...q.ch];
  // correctChoice를 targetIdx 위치로 이동
  newCh.splice(correctIdx, 1); // 정답 제거
  newCh.splice(targetIdx, 0, correctChoice); // targetIdx에 삽입

  return { ...q, ch: newCh, ans: targetAns };
}

function shuffleChoices(q) {
  if (!isShuffleable(q)) return q;

  const correctIdx = q.ans - 1;
  const correctChoice = q.ch[correctIdx];

  const indices = [0, 1, 2, 3];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const newCh = indices.map(i => q.ch[i]);
  const newAns = newCh.indexOf(correctChoice) + 1;

  return { ...q, ch: newCh, ans: newAns };
}

function fixA6A7(questions) {
  const allQs = [...questions];

  // Phase 1: 500회 랜덤 셔플 시도
  for (let attempt = 0; attempt < 500; attempt++) {
    const newQs = allQs.map(q => isShuffleable(q) ? shuffleChoices(q) : q);
    if (!hasA6A7(newQs)) return newQs;
  }

  // Phase 2: 결정론적 — mc 순서 기준 목표 정답 시퀀스 생성
  const mcPositions = []; // { idx: index in allQs, fixed: boolean, ans: number }
  allQs.forEach((q, i) => {
    if (isMc(q)) {
      mcPositions.push({ idx: i, fixed: isMarkerType(q), ans: q.ans });
    }
  });

  // 목표 정답 패턴 생성 (3연속 방지 + 분포 균등)
  // 고정 문항 위치와 정답을 먼저 놓고, 나머지를 채움
  const n = mcPositions.length;
  const targetAns = new Array(n);

  // 고정 문항 먼저 배치
  mcPositions.forEach((p, i) => {
    if (p.fixed) targetAns[i] = p.ans;
  });

  // 원하는 분포 (최대 5개씩)
  function tryPattern(seed) {
    const pattern = [...targetAns];
    const avail = [1, 2, 3, 4];

    // 고정 문항 정답 카운트
    const count = { 1: 0, 2: 0, 3: 0, 4: 0 };
    pattern.forEach(a => { if (a) count[a]++; });

    // 셔플 가능 문항에 할당
    const shuffleIndices = [];
    pattern.forEach((a, i) => { if (!a) shuffleIndices.push(i); });

    // 가능한 정답 풀 생성 (각 번호 최대 5개)
    const pool = [];
    avail.forEach(a => {
      const remaining = 5 - count[a];
      for (let j = 0; j < remaining; j++) pool.push(a);
    });

    // 풀이 부족하면 남은 걸로 채움
    while (pool.length < shuffleIndices.length) {
      const minAns = avail.reduce((a, b) => (count[a] + pool.filter(x => x === a).length) <= (count[b] + pool.filter(x => x === b).length) ? a : b);
      pool.push(minAns);
    }

    // seed 기반 셔플
    let s = seed;
    for (let i = pool.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      const j = s % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    shuffleIndices.forEach((si, j) => {
      pattern[si] = pool[j];
    });

    // 3연속 체크
    for (let i = 0; i < pattern.length - 2; i++) {
      if (pattern[i] === pattern[i + 1] && pattern[i + 1] === pattern[i + 2]) return null;
    }

    // 분포 체크
    const finalCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
    pattern.forEach(a => finalCount[a]++);
    if (Object.values(finalCount).some(c => c > 5)) return null;

    return pattern;
  }

  for (let seed = 0; seed < 10000; seed++) {
    const pattern = tryPattern(seed);
    if (pattern) {
      // 패턴 적용
      const newQs = [...allQs];
      mcPositions.forEach((p, i) => {
        if (!p.fixed && pattern[i] !== newQs[p.idx].ans) {
          newQs[p.idx] = setAnsTo(newQs[p.idx], pattern[i]);
        }
      });
      if (!hasA6A7(newQs)) return newQs;
    }
  }

  // Phase 3: 최후 수단 — 3연속만이라도 깸
  const finalQs = allQs.map(q => isShuffleable(q) ? shuffleChoices(q) : q);
  const mcFinal = finalQs.filter(q => isMc(q));

  for (let pass = 0; pass < 200; pass++) {
    let found3 = false;
    for (let i = 0; i < mcFinal.length - 2; i++) {
      if (mcFinal[i].ans === mcFinal[i + 1].ans && mcFinal[i + 1].ans === mcFinal[i + 2].ans) {
        // 3개 중 셔플 가능한 것을 찾아 다른 정답으로 강제
        for (let k = i; k <= i + 2; k++) {
          const qIdx = finalQs.indexOf(mcFinal[k]);
          if (qIdx >= 0 && isShuffleable(mcFinal[k])) {
            const currentAns = mcFinal[k].ans;
            const others = [1, 2, 3, 4].filter(a => a !== currentAns);
            const target = others[Math.floor(Math.random() * others.length)];
            finalQs[qIdx] = setAnsTo(finalQs[qIdx], target);
            mcFinal[k] = finalQs[qIdx];
            found3 = true;
            break;
          }
        }
      }
    }
    if (!found3) break;
  }

  return finalQs;
}

// ── Main ──
const files = findJsonFiles(path.resolve(targetDir));
let fixed = 0, skipped = 0, failed = 0;

files.forEach(f => {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { skipped++; return; }

  if (!Array.isArray(data.questions) || data.questions.length === 0) { skipped++; return; }

  if (!hasA6A7(data.questions)) { skipped++; return; }

  const newQs = fixA6A7(data.questions);

  if (!hasA6A7(newQs)) {
    data.questions = newQs;
    fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf8');
    fixed++;
    console.log(`[FIXED] ${path.relative(process.cwd(), f)}`);
  } else {
    failed++;
    // 남은 에러 디테일
    const mcQs = newQs.filter(q => isMc(q));
    const dist = {};
    mcQs.forEach(q => { dist[q.ans] = (dist[q.ans] || 0) + 1; });
    const fixedCount = mcQs.filter(q => isMarkerType(q)).length;
    console.log(`[FAIL] ${path.relative(process.cwd(), f)} — mc:${mcQs.length} fixed:${fixedCount} dist:${JSON.stringify(dist)}`);
  }
});

console.log(`\n--- Result ---`);
console.log(`Fixed: ${fixed} | Skipped: ${skipped} | Failed: ${failed}`);
