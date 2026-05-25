#!/usr/bin/env node
/**
 * deep-fix.js — DC-1, DC-2 자동 수정
 * DC-1: det.analysis ←정답 마커와 ans 불일치 → ans를 det 기준으로 수정
 * DC-2: passage 마커 순서 역전 → passage 내 마커를 출현순 ①②③④로 재배번, ch/ans/det 동시 업데이트
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.error('Usage: node deep-fix.js <file.json or dir> [--dry-run]');
  process.exit(1);
}

let totalFixed = 0, totalFiles = 0, fixedFiles = 0;
const ALL_MARKERS = ['①','②','③','④'];
// Use temp markers that do NOT contain circled numbers
const TEMP_MARKERS = ['__MK_ALPHA__','__MK_BETA__','__MK_GAMMA__','__MK_DELTA__'];

function collectFiles(p) {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    let result = [];
    for (const e of fs.readdirSync(p)) {
      result = result.concat(collectFiles(path.join(p, e)));
    }
    return result;
  }
  if (p.endsWith('단어.json') || p.endsWith('워크북.json') || p.endsWith('퀴즈.json')) {
    return [p];
  }
  return [];
}

function replaceMarkers(text, mapping) {
  // mapping: { '①': '③', '③': '①', ... }
  // Step 1: all old markers → temp
  let result = text;
  for (const [oldM, newM] of Object.entries(mapping)) {
    const newIdx = ALL_MARKERS.indexOf(newM);
    result = result.split(oldM).join(TEMP_MARKERS[newIdx]);
  }
  // Step 2: all temp → new markers
  for (let i = 0; i < TEMP_MARKERS.length; i++) {
    result = result.split(TEMP_MARKERS[i]).join(ALL_MARKERS[i]);
  }
  return result;
}

let fileList = [];
for (const f of files) fileList = fileList.concat(collectFiles(f));
fileList.sort();

for (const filePath of fileList) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { continue; }
  if (!data.questions) continue;
  totalFiles++;

  let modified = false;
  const fixes = [];

  for (const q of data.questions) {
    const qn = `Q${q.id}`;

    // === DC-2 FIX: 마커 순서 재정렬 ===
    if (q.fmt === 'mc' && q.ch && q.passage) {
      const isMarkerType = q.ch.every(c => /^[①②③④⑤]$/.test(c));
      if (isMarkerType) {
        // Find positions of each marker in passage
        const markerPositions = [];
        for (const m of ALL_MARKERS) {
          const idx = q.passage.indexOf(m);
          if (idx >= 0) {
            markerPositions.push({ marker: m, pos: idx });
          }
        }

        if (markerPositions.length >= 3) {
          const sorted = [...markerPositions].sort((a, b) => a.pos - b.pos);

          // Check if already ordered
          let needsReorder = false;
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].marker !== ALL_MARKERS[i]) {
              needsReorder = true;
              break;
            }
          }

          if (needsReorder) {
            // Build mapping: old marker → new marker (position-based)
            const mapping = {};
            for (let i = 0; i < sorted.length; i++) {
              mapping[sorted[i].marker] = ALL_MARKERS[i];
            }

            // Fix passage
            q.passage = replaceMarkers(q.passage, mapping);

            // Fix ans: old ans marker → new marker
            const oldAnsMarker = ALL_MARKERS[q.ans - 1];
            const newAnsMarker = mapping[oldAnsMarker];
            if (newAnsMarker) {
              const newAns = ALL_MARKERS.indexOf(newAnsMarker) + 1;
              if (newAns !== q.ans) {
                fixes.push(`[DC-2 FIX] ${qn}: ans ${q.ans}→${newAns} (마커 재정렬)`);
                q.ans = newAns;
              } else {
                fixes.push(`[DC-2 FIX] ${qn} (${q.type}): 마커 순서 재정렬 (ans 유지=${q.ans})`);
              }
            }

            // Fix det.analysis
            if (q.det && q.det.analysis) {
              q.det.analysis = replaceMarkers(q.det.analysis, mapping);
            }

            // Fix overlay.markers
            if (q.overlay && q.overlay.markers) {
              const newOvr = {};
              for (const [key, val] of Object.entries(q.overlay.markers)) {
                const newKey = mapping[key] || key;
                newOvr[newKey] = val;
              }
              q.overlay.markers = newOvr;
            }

            modified = true;
          }
        }
      }
    }

    // === DC-1 FIX: det ←정답 ≠ ans ===
    if (q.det && q.det.analysis && q.fmt === 'mc') {
      const analysis = q.det.analysis;
      const correctMatch = analysis.match(/[①②③④⑤][^①②③④⑤\n]*←\s*정답/);
      if (correctMatch) {
        const markerInAnalysis = ALL_MARKERS.find(m => correctMatch[0].includes(m));
        if (markerInAnalysis) {
          const markerIdx = ALL_MARKERS.indexOf(markerInAnalysis) + 1;
          const isMarkerCh = q.ch && q.ch.every(c => /^[①②③④⑤]$/.test(c));
          if (isMarkerCh && markerIdx !== q.ans) {
            fixes.push(`[DC-1 FIX] ${qn}: ans ${q.ans}→${markerIdx} (det ←정답 기준)`);
            q.ans = markerIdx;
            modified = true;
          }
        }
      }
    }
  }

  if (modified && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    fixedFiles++;
    totalFixed += fixes.length;
    const rel = path.relative(process.cwd(), filePath);
    console.log(`[FIXED] ${rel}`);
    for (const f of fixes) console.log(`  ${f}`);
  } else if (modified && dryRun) {
    fixedFiles++;
    totalFixed += fixes.length;
    const rel = path.relative(process.cwd(), filePath);
    console.log(`[WOULD FIX] ${rel}`);
    for (const f of fixes) console.log(`  ${f}`);
  }
}

console.log(`\n=== DEEP-FIX 결과 ===`);
console.log(`총 파일: ${totalFiles}`);
console.log(`수정 파일: ${fixedFiles}`);
console.log(`총 수정: ${totalFixed}`);
if (dryRun) console.log(`(DRY RUN — 실제 저장 안 됨)`);
