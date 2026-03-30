#!/usr/bin/env node
/**
 * validate-ans.js — det↔ans 정합성 검증 (S급 차단)
 *
 * 규칙:
 * 1. MC 문항의 det.analysis에 ✅/❌ 마커가 반드시 있어야 함 (없으면 S급 FAIL)
 * 2. 어법/부적절 (다수 ✅ + 단일 ❌): ❌ 번호 === ans
 * 3. 일반 MC (단일 ✅ + 다수 ❌): ✅ 번호 === ans
 * 4. T/F: ✅T → ans=1, ✅F → ans=2
 * 5. ans 수동 수정 감지: det 마커와 ans 불일치 시 S급 FAIL
 *
 * Usage: node validate/validate-ans.js data/path/to/file.json
 *        node validate/validate-ans.js --all
 */

const fs = require('fs');
const path = require('path');
const glob = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKERS = [
  ['①', 1], ['②', 2], ['③', 3], ['④', 4],
  ['ⓐ', 1], ['ⓑ', 2], ['ⓒ', 3], ['ⓓ', 4],
];

function validateAns(jsonPath) {
  const errors = [];
  let raw, data;
  try {
    raw = fs.readFileSync(jsonPath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    return [{ sev: 'S', msg: `PARSE: ${e.message}` }];
  }

  const questions = data.questions || (Array.isArray(data) ? data : []);

  for (const q of questions) {
    if (q.fmt !== 'mc' || q.ans === undefined) continue;
    const qid = q.id || '?';
    const analysis = (q.det && q.det.analysis) || '';
    const ch = q.ch || [];
    const ans = q.ans;

    // T/F 문항
    if (ch.length === 2) {
      const chUpper = ch.map(c => (c || '').trim().toUpperCase());
      if (chUpper[0] === 'T' && chUpper[1] === 'F') {
        if (analysis.includes('✅ T') && ans !== 1) {
          errors.push({ sev: 'S', msg: `Q${qid}: det says ✅T but ans=${ans} (should be 1)` });
        } else if (analysis.includes('✅ F') && ans !== 2) {
          errors.push({ sev: 'S', msg: `Q${qid}: det says ✅F but ans=${ans} (should be 2)` });
        }
        // T/F 마커 강제
        if (!analysis.includes('✅ T') && !analysis.includes('✅ F')) {
          errors.push({ sev: 'S', msg: `Q${qid}: T/F 문항인데 det에 ✅T 또는 ✅F 마커 없음` });
        }
        continue;
      }
    }

    // MC 4지선다
    const checkMarks = [];
    const crossMarks = [];
    for (const [marker, idx] of MARKERS) {
      if (analysis.includes(`✅ ${marker}`)) checkMarks.push({ marker, idx });
      if (analysis.includes(`❌ ${marker}`)) crossMarks.push({ marker, idx });
    }

    const totalMarkers = checkMarks.length + crossMarks.length;

    // 마커 강제: ✅/❌ 합쳐서 최소 2개 이상 있어야 함
    if (totalMarkers < 2) {
      // 첫줄 패턴도 체크 (④ word → correction 형태)
      const firstLine = analysis.trim().split('\n')[0] || '';
      let hasFirstLineMarker = false;
      for (const [marker] of MARKERS) {
        if (firstLine.startsWith(marker + ' ') || firstLine.startsWith(marker + ':')) {
          hasFirstLineMarker = true;
          break;
        }
      }
      if (!hasFirstLineMarker) {
        errors.push({ sev: 'S', msg: `Q${qid}: det.analysis에 ✅/❌ 마커 부족 (${totalMarkers}개) — 최소 2개 필요` });
      }
      continue;
    }

    // 어법/부적절: 다수 ✅ + 단일 ❌ → ❌이 정답
    if (checkMarks.length >= 2 && crossMarks.length === 1) {
      const correct = crossMarks[0].idx;
      if (ans !== correct) {
        errors.push({
          sev: 'S',
          msg: `Q${qid}: 어법/부적절 det says ❌${crossMarks[0].marker}(=${correct}) but ans=${ans}`
        });
      }
      continue;
    }

    // 일반: 단일 ✅ + 다수 ❌ → ✅이 정답
    if (checkMarks.length === 1 && crossMarks.length >= 1) {
      const correct = checkMarks[0].idx;
      if (ans !== correct) {
        errors.push({
          sev: 'S',
          msg: `Q${qid}: det says ✅${checkMarks[0].marker}(=${correct}) but ans=${ans}`
        });
      }
      continue;
    }

    // 다수 ✅ + 다수 ❌ or 다수 ❌ only → 첫줄 패턴으로 판정
    if (crossMarks.length >= 2 && checkMarks.length === 0) {
      // 첫줄이 정답
      const firstLine = analysis.trim().split('\n')[0] || '';
      for (const [marker, idx] of MARKERS) {
        if (firstLine.startsWith(marker + ' ') || firstLine.startsWith(marker + ':')) {
          if (ans !== idx) {
            errors.push({
              sev: 'S',
              msg: `Q${qid}: det 첫줄 ${marker}(=${idx}) but ans=${ans}`
            });
          }
          break;
        }
      }
    }
  }

  return errors;
}

// ── CLI ──
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node validate/validate-ans.js <file.json|--all>');
  process.exit(0);
}

const files = [];
if (args[0] === '--all') {
  const { execSync } = require('child_process');
  const out = execSync(`find "${path.join(ROOT, 'data')}" -name "*.json" -type f`, { encoding: 'utf8' });
  files.push(...out.trim().split('\n').filter(Boolean));
} else {
  files.push(path.resolve(args[0]));
}

let totalErrors = 0;
let totalFiles = 0;
let failFiles = 0;

for (const f of files) {
  const errors = validateAns(f);
  totalFiles++;
  const rel = path.relative(ROOT, f);
  if (errors.length > 0) {
    failFiles++;
    console.log(`[FAIL] ${rel} (${errors.length} errors)`);
    for (const e of errors) {
      console.log(`  [${e.sev}] ${e.msg}`);
    }
    totalErrors += errors.length;
  }
}

if (totalErrors === 0) {
  console.log(`[ALL PASS] ${totalFiles} files, 0 det↔ans errors`);
} else {
  console.log(`\n${failFiles}/${totalFiles} files FAIL, ${totalErrors} total errors`);
}

process.exit(totalErrors > 0 ? 1 : 0);
