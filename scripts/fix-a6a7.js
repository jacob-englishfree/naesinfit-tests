#!/usr/bin/env node
/**
 * fix-a6a7.js — A6(한 번호 5개 초과) / A7(3연속 동일번호) 자동 수정
 *
 * 비마커형: ch 순서 변경 + det.analysis ①②③④ 재배열
 * 마커형(ch에 ①②③④⑤ 포함): ch 순서 변경 + ans 변경만. det.analysis는 passage 마커 참조이므로 불변.
 * T/F(ch=["T","F"]): 2지선다라 회전 불가 → 스킵
 * written: fmt=written → 스킵
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VALIDATE_PATH = path.join(__dirname, '..', 'validate', 'validate.js');

function isTFCh(ch) {
  if (!Array.isArray(ch) || ch.length !== 2) return false;
  const s = ch.map(c => c.trim());
  return (s[0] === 'T' && s[1] === 'F') || (s[0] === 'F' && s[1] === 'T');
}

function isMarkerCh(ch) {
  if (!Array.isArray(ch) || ch.length < 2) return false;
  const markers = ['①','②','③','④','⑤'];
  return ch.some(c => markers.includes(c.trim()));
}

function canRotate(q) {
  if (q.fmt === 'written') return false;
  if (isTFCh(q.ch)) return false;
  if (!Array.isArray(q.ch) || q.ch.length < 3) return false;
  return true;
}

function getAnsDist(questions) {
  const dist = {};
  for (const q of questions) {
    if (q.fmt === 'written') continue;
    dist[q.ans] = (dist[q.ans] || 0) + 1;
  }
  return dist;
}

function getConsecutiveRuns(questions) {
  const runs = [];
  const mcQs = questions.filter(q => q.fmt !== 'written');
  for (let i = 0; i < mcQs.length - 2; i++) {
    if (mcQs[i].ans === mcQs[i+1].ans && mcQs[i+1].ans === mcQs[i+2].ans) {
      runs.push({
        ids: [mcQs[i].id, mcQs[i+1].id, mcQs[i+2].id],
        ans: mcQs[i].ans
      });
    }
  }
  return runs;
}

function rotateChoice(q, newAnsIdx) {
  const oldAnsIdx = q.ans - 1;
  if (oldAnsIdx === newAnsIdx) return false;

  const ch = [...q.ch];
  const correctChoice = ch[oldAnsIdx];

  ch.splice(oldAnsIdx, 1);
  ch.splice(newAnsIdx, 0, correctChoice);

  q.ch = ch;
  q.ans = newAnsIdx + 1;

  // Only update det.analysis for non-marker questions
  if (!isMarkerCh(q.ch) && q.det && q.det.analysis) {
    q.det.analysis = rebuildAnalysis(q.det.analysis, ch, q.ans);
  }

  return true;
}

function rebuildAnalysis(analysis, ch, correctAns) {
  const markers = ['①','②','③','④','⑤'];
  const lines = analysis.split('\n');
  const markerLines = [];
  const otherLines = [];

  for (const line of lines) {
    if (markers.some(m => line.trim().startsWith('✅ ' + m) || line.trim().startsWith('❌ ' + m) ||
                          line.trim().startsWith(m))) {
      markerLines.push(line);
    } else {
      otherLines.push(line);
    }
  }

  if (markerLines.length === 0) return analysis;

  const parsed = markerLines.map(line => {
    const trimmed = line.trim();
    let content = trimmed;
    if (content.startsWith('✅ ') || content.startsWith('❌ ')) {
      content = content.substring(2).trim();
    }
    for (const m of markers) {
      if (content.startsWith(m)) {
        content = content.substring(m.length).trim();
        break;
      }
    }
    content = content.replace(/\s*←\s*정답\s*$/, '').replace(/\s*—\s*정답\s*$/, '');
    return content;
  });

  // Rebuild: reorder parsed content to match new ch order
  const newLines = [];
  for (let i = 0; i < Math.min(ch.length, 4); i++) {
    const marker = markers[i];
    const isCorrect = (i + 1) === correctAns;
    const icon = isCorrect ? '✅' : '❌';
    let matchedContent = null;
    for (let j = 0; j < parsed.length; j++) {
      if (parsed[j] !== null && (parsed[j].includes(ch[i].substring(0, 10)) ||
          markerLines[j].includes(ch[i].substring(0, 15)))) {
        matchedContent = parsed[j];
        parsed[j] = null;
        break;
      }
    }
    if (matchedContent) {
      const suffix = isCorrect ? ' ←정답' : '';
      newLines.push(`${icon} ${marker} ${matchedContent}${suffix}`);
    }
  }

  if (newLines.length >= Math.min(ch.length, 4)) {
    return [...otherLines.filter(l => l.trim()), ...newLines].join('\n');
  }

  return analysis;
}

function findBestSwapTarget(questions, qToFix, currentOverloadedAns, avoidAns) {
  const dist = getAnsDist(questions);
  const candidates = [1, 2, 3, 4].filter(n => n !== currentOverloadedAns && !avoidAns.has(n));
  candidates.sort((a, b) => (dist[a] || 0) - (dist[b] || 0));

  const mcQs = questions.filter(q => q.fmt !== 'written');
  const mcIdx = mcQs.findIndex(q => q.id === qToFix.id);

  for (const cand of candidates) {
    let ok = true;
    // Check no 3-consecutive with neighbors
    if (mcIdx > 0 && mcIdx < mcQs.length - 1) {
      if (mcQs[mcIdx - 1].ans === cand && mcQs[mcIdx + 1].ans === cand) ok = false;
    }
    if (mcIdx > 1) {
      if (mcQs[mcIdx - 2].ans === cand && mcQs[mcIdx - 1].ans === cand) ok = false;
    }
    if (mcIdx < mcQs.length - 2) {
      if (mcQs[mcIdx + 1].ans === cand && mcQs[mcIdx + 2].ans === cand) ok = false;
    }

    // Also check won't cause A6 for this candidate
    if ((dist[cand] || 0) >= 5) ok = false;

    if (ok) return cand;
  }

  return candidates[0] || null;
}

function fixFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const questions = data.questions;

  let maxIter = 30;
  while (maxIter-- > 0) {
    const dist = getAnsDist(questions);
    let a6Violations = Object.entries(dist).filter(([k, v]) => v > 5);
    const runs = getConsecutiveRuns(questions);

    if (a6Violations.length === 0 && runs.length === 0) break;

    // Fix A7 first
    if (runs.length > 0) {
      const run = runs[0];
      // Try middle, then first, then last
      const tryOrder = [run.ids[1], run.ids[0], run.ids[2]];
      let fixed = false;

      for (const tryId of tryOrder) {
        const q = questions.find(q => q.id === tryId);
        if (q && canRotate(q)) {
          const newAns = findBestSwapTarget(questions, q, run.ans, new Set());
          if (newAns) {
            rotateChoice(q, newAns - 1);
            fixed = true;
            break;
          }
        }
      }

      if (!fixed) {
        // Try any question in the run that can rotate
        for (const tryId of run.ids) {
          const q = questions.find(q => q.id === tryId);
          if (q && canRotate(q)) {
            // Force any different ans
            const currentAns = q.ans;
            for (let tryAns = 1; tryAns <= q.ch.length; tryAns++) {
              if (tryAns === currentAns) continue;
              rotateChoice(q, tryAns - 1);
              // Check if this creates new A7
              const newRuns = getConsecutiveRuns(questions);
              const stillBad = newRuns.some(r =>
                r.ids.includes(tryId) && r.ans === tryAns
              );
              if (!stillBad) {
                fixed = true;
                break;
              }
              // Undo
              rotateChoice(q, currentAns - 1);
            }
            if (fixed) break;
          }
        }
      }

      if (!fixed) {
        console.error(`  [STUCK] Cannot fix A7 run Q${run.ids.join(',Q')} ans=${run.ans} in ${filePath}`);
        break;
      }
      continue;
    }

    // Fix A6
    if (a6Violations.length > 0) {
      const [overAns, count] = a6Violations[0];
      const overAnsNum = parseInt(overAns);

      const candidates = questions.filter(q =>
        q.ans === overAnsNum && canRotate(q)
      );

      if (candidates.length === 0) {
        console.error(`  [STUCK] A6 ans=${overAns} count=${count} no rotatable q in ${filePath}`);
        break;
      }

      let fixed = false;
      for (const cand of candidates) {
        const newAns = findBestSwapTarget(questions, cand, overAnsNum, new Set());
        if (newAns) {
          rotateChoice(cand, newAns - 1);
          fixed = true;
          break;
        }
      }
      if (!fixed) {
        console.error(`  [STUCK] Cannot fix A6 for ans=${overAns} in ${filePath}`);
        break;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function validate(filePath) {
  try {
    const result = execSync(`node "${VALIDATE_PATH}" "${filePath}" 2>&1`, { encoding: 'utf8' });
    if (result.includes('[FAIL]')) {
      const errors = result.split('\n').filter(l => l.includes('[S]') || l.includes('[FAIL]'));
      return { pass: false, errors };
    }
    return { pass: true, errors: [] };
  } catch (e) {
    return { pass: false, errors: [e.stdout || e.message] };
  }
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node fix-a6a7.js <file1.json> [file2.json] ...');
  console.log('       node fix-a6a7.js --stdin  (reads file paths from stdin)');
  process.exit(1);
}

let files = args;
if (args[0] === '--stdin') {
  files = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\n').filter(Boolean);
}

let passCount = 0;
let failCount = 0;
const failFiles = [];

for (const file of files) {
  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) {
    console.error(`[SKIP] ${file} not found`);
    continue;
  }

  const pre = validate(absPath);
  if (pre.pass) {
    passCount++;
    continue;
  }

  const hasA6A7 = pre.errors.some(e => e.includes('A6') || e.includes('A7'));
  if (!hasA6A7) {
    console.log(`[SKIP] ${file} — non-A6/A7 errors only`);
    failCount++;
    failFiles.push(file);
    continue;
  }

  console.log(`[FIX] ${file}`);
  fixFile(absPath);

  const post = validate(absPath);
  if (post.pass) {
    console.log(`  → PASS`);
    passCount++;
  } else {
    const a6a7Remain = post.errors.filter(e => e.includes('A6') || e.includes('A7'));
    if (a6a7Remain.length > 0) {
      console.log(`  → STILL FAIL: ${a6a7Remain.map(e=>e.trim()).join(' | ')}`);
      failCount++;
      failFiles.push(file);
    } else {
      console.log(`  → A6/A7 fixed (other warnings remain)`);
      passCount++;
    }
  }
}

console.log(`\n=== Summary: ${passCount} PASS, ${failCount} FAIL ===`);
if (failFiles.length > 0) {
  console.log('Remaining FAIL files:');
  failFiles.forEach(f => console.log('  ' + f));
}
