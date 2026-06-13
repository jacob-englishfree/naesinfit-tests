#!/usr/bin/env node
/**
 * fix-a6a7.js — A6/A7 자동 수정 (det.analysis 동시 업데이트)
 *
 * mc 문항의 선지(ch)를 스왑하여 정답번호를 재분배합니다.
 * 마커형 문항(①②③④)은 고정, 나머지만 스왑.
 * det.analysis의 ①②③④ 라인과 ←정답 마커도 함께 업데이트.
 *
 * Usage:
 *   node fix-a6a7.js                          # data/교과서 전체
 *   node fix-a6a7.js <file1> <file2> ...      # 개별 파일
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  const dist = {};
  mcQs.forEach(q => { dist[q.ans] = (dist[q.ans] || 0) + 1; });
  if (Object.values(dist).some(c => c > 5)) return true;
  for (let i = 0; i < mcQs.length - 2; i++) {
    if (mcQs[i].ans === mcQs[i + 1].ans && mcQs[i + 1].ans === mcQs[i + 2].ans) return true;
  }
  return false;
}

/**
 * Swap two choices in a question, updating ch, ans, and det.analysis
 */
function swapChoices(q, idxA, idxB) {
  if (idxA === idxB) return;
  const ch = q.ch;

  // Swap choices
  const tmp = ch[idxA];
  ch[idxA] = ch[idxB];
  ch[idxB] = tmp;

  // Update ans
  if (q.ans - 1 === idxA) q.ans = idxB + 1;
  else if (q.ans - 1 === idxB) q.ans = idxA + 1;

  // Update det.analysis
  if (q.det && q.det.analysis) {
    const markers = ['①', '②', '③', '④'];
    const mA = markers[idxA];
    const mB = markers[idxB];

    const lines = q.det.analysis.split('\n');
    let lineA = null, lineB = null;
    let liA = -1, liB = -1;

    for (let i = 0; i < lines.length; i++) {
      const s = lines[i].trim();
      if (s.startsWith(mA)) { lineA = lines[i]; liA = i; }
      else if (s.startsWith(mB)) { lineB = lines[i]; liB = i; }
    }

    if (liA >= 0 && liB >= 0) {
      // Extract content after marker
      const contentA = lineA.includes(mA) ? lineA.split(mA).slice(1).join(mA) : '';
      const contentB = lineB.includes(mB) ? lineB.split(mB).slice(1).join(mB) : '';

      const arrow = ' ←정답';
      const cleanA = contentA.replace(arrow, '');
      const cleanB = contentB.replace(arrow, '');
      const aHadArrow = contentA.includes(arrow);
      const bHadArrow = contentB.includes(arrow);

      // After swap: position A gets B's content, position B gets A's content
      // Arrow follows the correct answer
      lines[liA] = mA + (bHadArrow ? cleanB : cleanB + (aHadArrow ? '' : ''));
      lines[liB] = mB + (aHadArrow ? cleanA : cleanA + (bHadArrow ? '' : ''));

      // Now add arrow to whichever has the correct content
      if (aHadArrow) {
        // A was correct, moved to B
        lines[liB] = lines[liB].replace(/\s*←정답\s*$/, '') + arrow;
        lines[liA] = lines[liA].replace(/\s*←정답\s*$/, '');
      } else if (bHadArrow) {
        // B was correct, moved to A
        lines[liA] = lines[liA].replace(/\s*←정답\s*$/, '') + arrow;
        lines[liB] = lines[liB].replace(/\s*←정답\s*$/, '');
      }

      q.det.analysis = lines.join('\n');
    }
  }
}

/**
 * Set a shuffleable question's answer to targetAns by swapping choices
 */
function setAnsTo(q, targetAns) {
  if (!isShuffleable(q)) return;
  if (q.ans === targetAns) return;

  const currentIdx = q.ans - 1;
  const targetIdx = targetAns - 1;
  swapChoices(q, currentIdx, targetIdx);
}

function fixA6A7(questions) {
  const allQs = questions;
  const mcPositions = [];

  allQs.forEach((q, i) => {
    if (isMc(q)) {
      mcPositions.push({ idx: i, fixed: isMarkerType(q), ans: q.ans });
    }
  });

  const n = mcPositions.length;
  if (n === 0) return false;

  // Phase 1: Generate target pattern (deterministic)
  function tryPattern(seed) {
    const targetAns = new Array(n);
    const count = { 1: 0, 2: 0, 3: 0, 4: 0 };

    // Fix marker positions
    mcPositions.forEach((p, i) => {
      if (p.fixed) {
        targetAns[i] = p.ans;
        count[p.ans]++;
      }
    });

    // Check if markers already violate A6
    if (Object.values(count).some(c => c > 5)) {
      // Can't fix if markers alone exceed 5
      // Try to still find valid pattern for shuffleable ones
    }

    const shuffleIndices = [];
    mcPositions.forEach((p, i) => {
      if (!p.fixed) shuffleIndices.push(i);
    });

    // Build pool
    const pool = [];
    [1, 2, 3, 4].forEach(a => {
      const remaining = 5 - count[a];
      for (let j = 0; j < Math.max(0, remaining); j++) pool.push(a);
    });

    while (pool.length < shuffleIndices.length) {
      const minAns = [1, 2, 3, 4].reduce((a, b) => {
        const ca = count[a] + pool.filter(x => x === a).length;
        const cb = count[b] + pool.filter(x => x === b).length;
        return ca <= cb ? a : b;
      });
      pool.push(minAns);
    }

    // Seed-based shuffle
    let s = seed;
    for (let i = pool.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      const j = s % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Truncate pool if needed
    pool.length = shuffleIndices.length;

    shuffleIndices.forEach((si, j) => {
      targetAns[si] = pool[j];
    });

    // Validate: no 3 consecutive
    for (let i = 0; i < n - 2; i++) {
      if (targetAns[i] === targetAns[i + 1] && targetAns[i + 1] === targetAns[i + 2]) return null;
    }

    // Validate: distribution
    const finalCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
    targetAns.forEach(a => finalCount[a]++);
    if (Object.values(finalCount).some(c => c > 5)) return null;

    return targetAns;
  }

  for (let seed = 0; seed < 20000; seed++) {
    const pattern = tryPattern(seed);
    if (pattern) {
      let changed = false;
      mcPositions.forEach((p, i) => {
        if (!p.fixed && pattern[i] !== allQs[p.idx].ans) {
          setAnsTo(allQs[p.idx], pattern[i]);
          changed = true;
        }
      });
      if (changed && !hasA6A7(allQs)) return true;
      if (changed) {
        // Revert (reload needed, but since we modify in place, this approach is problematic)
        // Instead, let's try another seed
        // We need to re-read the original - skip revert, the changes accumulate
        // which is fine as long as final validation passes
        continue;
      }
    }
  }

  // Phase 2: Position swap for marker-heavy A7 runs
  // If A7 remains because of marker-only consecutive runs,
  // swap question positions to break the run
  const mcQs = allQs.filter(q => isMc(q));
  for (let attempt = 0; attempt < 100; attempt++) {
    // Find first A7 violation
    let runFound = false;
    for (let i = 0; i < mcQs.length - 2; i++) {
      if (mcQs[i].ans === mcQs[i + 1].ans && mcQs[i + 1].ans === mcQs[i + 2].ans) {
        // Find a question outside this run with different ans
        const runVal = mcQs[i].ans;
        const midQ = mcQs[i + 1];
        const midGlobalIdx = allQs.indexOf(midQ);

        // Find swap candidate
        for (let j = 0; j < allQs.length; j++) {
          if (j === midGlobalIdx) continue;
          const candidate = allQs[j];
          if (!isMc(candidate)) continue;
          if (candidate.ans === runVal) continue;

          // Test swap
          const tmpQ = allQs[midGlobalIdx];
          allQs[midGlobalIdx] = allQs[j];
          allQs[j] = tmpQ;

          if (!hasA6A7(allQs)) return true;

          // Check if at least A7 improved
          const mcAfter = allQs.filter(q => isMc(q));
          let a7Count = 0;
          for (let k = 0; k < mcAfter.length - 2; k++) {
            if (mcAfter[k].ans === mcAfter[k + 1].ans && mcAfter[k + 1].ans === mcAfter[k + 2].ans) a7Count++;
          }

          // If no improvement, revert
          if (a7Count >= 1) {
            allQs[j] = allQs[midGlobalIdx];
            allQs[midGlobalIdx] = tmpQ;
          } else {
            runFound = true;
            break;
          }
        }
        if (runFound) break;
      }
    }
    if (!runFound) break;
  }

  return !hasA6A7(allQs);
}

function processFile(filepath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    return { status: 'skip', reason: 'parse error' };
  }

  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    return { status: 'skip', reason: 'no questions' };
  }

  if (!hasA6A7(data.questions)) {
    return { status: 'skip', reason: 'no A6/A7' };
  }

  // Deep copy for safety
  const backup = JSON.stringify(data);

  const fixed = fixA6A7(data.questions);

  if (!hasA6A7(data.questions)) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return { status: 'fixed' };
  } else {
    // Restore backup
    fs.writeFileSync(filepath, backup, 'utf8');
    // Get remaining errors
    const mcQs = data.questions.filter(q => isMc(q));
    const dist = {};
    mcQs.forEach(q => { dist[q.ans] = (dist[q.ans] || 0) + 1; });
    const fixedCount = mcQs.filter(q => isMarkerType(q)).length;
    return { status: 'fail', detail: `mc:${mcQs.length} markers:${fixedCount} dist:${JSON.stringify(dist)}` };
  }
}

function validate(filepath) {
  try {
    const out = execSync(`node validate/validate.js "${filepath}" 2>&1`, {
      cwd: '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests',
      encoding: 'utf8',
      timeout: 30000
    });
    return out.trim().split('\n')[0];
  } catch (e) {
    return (e.stdout || e.stderr || '').trim().split('\n')[0];
  }
}

// ── Main ──
const args = process.argv.slice(2);
let files = [];

if (args.length > 0) {
  files = args;
} else {
  // Find FAIL files
  console.log('Finding FAIL files in data/교과서 ...');
  try {
    const out = execSync(
      `find data/교과서 -maxdepth 10 \\( -name "단어.json" -o -name "워크북.json" -o -name "퀴즈.json" \\) -print0 | xargs -0 -I{} sh -c 'r=$(node validate/validate.js "{}" 2>&1 | head -1); echo "$r" | grep -q FAIL && echo "{}"'`,
      { encoding: 'utf8', timeout: 600000, maxBuffer: 10 * 1024 * 1024,
        cwd: '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests' }
    );
    files = out.trim().split('\n').filter(Boolean);
  } catch (e) {
    const out = (e.stdout || '').trim();
    files = out.split('\n').filter(Boolean);
  }
}

let fixed = 0, failed = 0, skipped = 0;
const failList = [];

files.forEach((f, i) => {
  process.stdout.write(`[${i + 1}/${files.length}] ${f} ... `);

  const result = processFile(f);

  if (result.status === 'fixed') {
    // Validate with validate.js
    const vResult = validate(f);
    const hasA6A7Still = /\[S\] A[67]:/.test(vResult);
    if (hasA6A7Still) {
      console.log(`STILL FAIL: ${vResult}`);
      failed++;
      failList.push(f);
    } else {
      console.log(`FIXED → ${vResult}`);
      fixed++;
    }
  } else if (result.status === 'fail') {
    console.log(`FAIL (${result.detail})`);
    failed++;
    failList.push(f);
  } else {
    console.log(`skip (${result.reason})`);
    skipped++;
  }
});

console.log(`\n=== Summary ===`);
console.log(`Total: ${files.length}, Fixed: ${fixed}, Failed: ${failed}, Skipped: ${skipped}`);
if (failList.length > 0) {
  console.log('Still failing:');
  failList.forEach(f => console.log(`  ${f}`));
}
