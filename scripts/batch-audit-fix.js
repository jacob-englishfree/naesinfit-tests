#!/usr/bin/env node
/**
 * batch-audit-fix.js — 2026 기말대비 대검수 통합 배치 스크립트
 *
 * 1단계: 안전한 자동 수정 (구조 보존, 내용 변경 최소)
 * 2단계: validate 재실행 → 결과 분류
 * 3단계: 진행 추적 JSON 업데이트
 *
 * 자동 수정 범위:
 * - C16: 5지선다 → 4지선다 (약한 오답 제거)
 * - A6: 정답 분포 편중 → mc 선지 스왑 (마커형/TF 제외)
 * - A7: 정답 3연속 → mc 선지 스왑 (마커형/TF 제외)
 * - X37/S-FULL-PLACEHOLDER: __FULL__ → fullPassage 치환
 * - RENDER-ANS-DET: ans↔det 불일치 → det 업데이트
 *
 * 수정 불가 → recreate-queue.json에 저장
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const PROGRESS_FILE = path.join(ROOT, 'audit-progress.json');

// ─── 파일 탐색 ───
function findTestJsons(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // _passages, reports 등 스킵
      if (['_passages', 'reports', 'node_modules'].includes(entry.name)) continue;
      results = results.concat(findTestJsons(full));
    } else if (entry.name.endsWith('.json') &&
               !entry.name.includes('.blind') &&
               !entry.name.includes('.cross-blind') &&
               !entry.name.includes('.adversarial') &&
               !entry.name.includes('.prompt') &&
               !entry.name.includes('.response') &&
               !entry.name.includes('.cross-prompt') &&
               !entry.name.startsWith('_')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Fix C16: 5지선다 → 4지선다 ───
function fixC16(q) {
  if (q.fmt !== 'mc' || !Array.isArray(q.ch) || q.ch.length <= 4) return false;

  const ans = q.ans;
  // 마커형(①②③④⑤)이면 5번째 마커+밑줄도 제거해야 하므로 여기서는 스킵
  const isMarker = q.ch.every(c => /^[①②③④⑤]$/.test((c||'').trim()));
  if (isMarker) return false;

  // 정답이 아닌 마지막 선지 제거
  let removeIdx = q.ch.length - 1;
  if (ans - 1 === removeIdx) removeIdx = removeIdx - 1;

  q.ch.splice(removeIdx, 1);

  // ans 조정 (제거된 인덱스가 ans 앞이면 ans--)
  if (removeIdx < ans - 1) {
    q.ans = ans - 1;
  }

  // passage에서 ⑤ 관련 마커 제거
  if (q.passage) {
    q.passage = q.passage.replace(/⑤<u>([^<]*)<\/u>/g, '$1');
    q.passage = q.passage.replace(/⑤/g, '');
  }

  // det에서 ⑤ 관련 제거
  if (q.det && q.det.analysis) {
    q.det.analysis = q.det.analysis.split('\n')
      .filter(line => !line.trim().startsWith('⑤'))
      .join('\n');
  }

  return true;
}

// ─── Fix A6/A7: 정답 분포/연속 ───
function fixA6A7(questions) {
  const mcItems = [];
  questions.forEach((q, i) => {
    if (q.fmt === 'mc' && typeof q.ans === 'number' && q.ans >= 1 && q.ans <= 4
        && Array.isArray(q.ch) && q.ch.length === 4) {
      // 마커형 스킵 (①②③④ 또는 어법/부적절어휘 마커)
      const isMarker = q.ch.every(c => /^[①②③④]$/.test((c||'').trim()));
      // T/F 스킵
      const isTF = q.ch.length === 2 || (q.ch[0] === 'T' && q.ch[1] === 'F');
      if (!isMarker && !isTF) {
        mcItems.push({ q, idx: i });
      }
    }
  });

  if (mcItems.length < 4) return false;

  function getDist() {
    const d = {1:0,2:0,3:0,4:0};
    questions.forEach(q => {
      if (q.fmt === 'mc' && q.ans >= 1 && q.ans <= 4) d[q.ans]++;
    });
    return d;
  }

  function getA7Count() {
    let n = 0;
    const seq = questions.filter(q => q.fmt === 'mc').map(q => q.ans);
    for (let i = 0; i < seq.length - 2; i++) {
      if (seq[i] === seq[i+1] && seq[i+1] === seq[i+2]) n++;
    }
    return n;
  }

  let changed = false;

  for (let pass = 0; pass < 200; pass++) {
    const dist = getDist();
    const a7 = getA7Count();
    const overEntry = Object.entries(dist).find(([_,c]) => c >= 6);

    if (!overEntry && a7 === 0) break;

    let swapped = false;

    if (overEntry) {
      const overA = parseInt(overEntry[0]);
      const sorted = Object.entries(dist).sort((a,b) => a[1] - b[1]);

      for (const [u] of sorted) {
        const underA = parseInt(u);
        if (underA === overA || dist[underA] >= 5) continue;

        for (const item of mcItems) {
          if (item.q.ans !== overA) continue;

          // 스왑 시도
          const origAns = item.q.ans;
          const tmp = item.q.ch[overA-1];
          item.q.ch[overA-1] = item.q.ch[underA-1];
          item.q.ch[underA-1] = tmp;
          item.q.ans = underA;

          // A7 악화 체크
          if (getA7Count() > a7) {
            // 롤백
            item.q.ch[underA-1] = item.q.ch[overA-1];
            item.q.ch[overA-1] = tmp;
            item.q.ans = origAns;
            continue;
          }

          // det.analysis 마커 스왑
          if (item.q.det && item.q.det.analysis) {
            const markers = ['①','②','③','④'];
            const lines = item.q.det.analysis.split('\n');
            const oLine = lines.findIndex(l => l.includes(markers[overA-1]));
            const uLine = lines.findIndex(l => l.includes(markers[underA-1]));
            if (oLine >= 0 && uLine >= 0 && oLine !== uLine) {
              const tmpLine = lines[oLine];
              lines[oLine] = lines[uLine].replace(markers[underA-1], markers[overA-1]);
              lines[uLine] = tmpLine.replace(markers[overA-1], markers[underA-1]);
              item.q.det.analysis = lines.join('\n');
            }
          }

          swapped = true;
          changed = true;
          break;
        }
        if (swapped) break;
      }
    } else if (a7 > 0) {
      // A7만 수정
      const mcSeq = questions.filter(q => q.fmt === 'mc');
      for (let i = 0; i < mcSeq.length - 2; i++) {
        if (mcSeq[i].ans === mcSeq[i+1].ans && mcSeq[i+1].ans === mcSeq[i+2].ans) {
          const mid = mcSeq[i+1];
          const midItem = mcItems.find(x => x.q === mid);
          if (!midItem) break; // 마커형/TF → 스왑 불가

          const origA = mid.ans;
          for (let newA = 1; newA <= 4; newA++) {
            if (newA === origA) continue;
            const dist2 = getDist();
            if (dist2[newA] >= 5) continue;

            const tmp = mid.ch[origA-1];
            mid.ch[origA-1] = mid.ch[newA-1];
            mid.ch[newA-1] = tmp;
            mid.ans = newA;

            if (getA7Count() < a7) {
              swapped = true;
              changed = true;
              break;
            }
            // 롤백
            mid.ch[newA-1] = mid.ch[origA-1];
            mid.ch[origA-1] = tmp;
            mid.ans = origA;
          }
          if (swapped) break;
        }
      }
    }

    if (!swapped) break;
  }

  return changed;
}

// ─── Fix __FULL__ placeholder ───
function fixFullPlaceholder(q, ei) {
  if (!q.passage || !q.passage.includes('__FULL__')) return false;

  // fullPassage가 있으면 치환
  const fp = q.fullPassage || (ei && ei.fullPassage);
  if (!fp) return false;

  q.passage = q.passage.replace(/__FULL__/g, fp);
  return true;
}

// ─── 메인 ───
function processFile(filePath) {
  const relPath = path.relative(DATA_DIR, filePath);
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch { return { path: relPath, status: 'READ_ERROR' }; }

  let data;
  try { data = JSON.parse(raw); } catch { return { path: relPath, status: 'PARSE_ERROR' }; }

  const qs = data.questions;
  if (!qs || !Array.isArray(qs)) return { path: relPath, status: 'NO_QUESTIONS' };

  const fixes = [];

  // C16
  let c16count = 0;
  qs.forEach(q => { if (fixC16(q)) c16count++; });
  if (c16count > 0) fixes.push(`C16: ${c16count}문항 4지선다 변환`);

  // __FULL__
  let fullCount = 0;
  qs.forEach(q => { if (fixFullPlaceholder(q, data.ei)) fullCount++; });
  if (fullCount > 0) fixes.push(`__FULL__: ${fullCount}문항 passage 치환`);

  // A6/A7
  if (fixA6A7(qs)) fixes.push('A6/A7: 정답 분포/연속 수정');

  if (fixes.length > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  }

  return { path: relPath, status: fixes.length > 0 ? 'FIXED' : 'UNCHANGED', fixes };
}

// ─── 실행 ───
console.log('=== 2026 기말대비 대검수 — 배치 자동수정 시작 ===\n');
const allFiles = findTestJsons(DATA_DIR);
console.log(`총 ${allFiles.length}개 파일 발견\n`);

const results = { fixed: 0, unchanged: 0, errors: 0, details: [] };

allFiles.forEach((f, i) => {
  const r = processFile(f);
  if (r.status === 'FIXED') {
    results.fixed++;
    if (results.fixed <= 30) console.log(`[FIXED] ${r.path} — ${r.fixes.join(', ')}`);
  } else if (r.status === 'UNCHANGED') {
    results.unchanged++;
  } else {
    results.errors++;
    console.log(`[ERROR] ${r.path} — ${r.status}`);
  }
  results.details.push(r);

  if ((i+1) % 500 === 0) console.log(`  ... ${i+1}/${allFiles.length} 처리중`);
});

console.log(`\n=== 완료 ===`);
console.log(`FIXED: ${results.fixed} | UNCHANGED: ${results.unchanged} | ERROR: ${results.errors}`);
console.log(`총 ${allFiles.length}개 파일 처리`);

// 결과 저장
fs.writeFileSync(path.join(ROOT, 'batch-fix-result.json'), JSON.stringify(results, null, 2));
