#!/usr/bin/env node
/**
 * fix-det-analysis-markers.js
 * det.analysis의 ①②③④ 마커 번호가 ch 배열 순서와 불일치하는 경우 수정
 *
 * 전략:
 * 1. det.analysis의 첫 4줄에서 "[❌|✅] [①②③④] TEXT" 파싱
 * 2. 각 TEXT를 ch 배열에서 찾아 실제 번호 매핑
 * 3. ch 순서대로 재정렬 + ans 위치에만 ✅
 * 4. 해설 본문(첫 4줄 이후)은 유지
 */

const fs = require('fs');

const MARKERS = ['①', '②', '③', '④'];

function fixQuestionDet(q) {
  if (q.fmt !== 'mc' || typeof q.ans !== 'number' || !Array.isArray(q.ch) || q.ch.length !== 4) return null;
  if (!q.det || !q.det.analysis) return null;

  const analysis = q.det.analysis;
  const lines = analysis.split('\n');

  // 첫 4줄에서 마커 추출
  const markerLines = [];
  let afterIdx = 0;
  for (let i = 0; i < lines.length && markerLines.length < 4; i++) {
    const line = lines[i];
    const m = line.match(/^([✅❌])\s*([①②③④])\s*(.+)$/);
    if (m) {
      markerLines.push({ mark: m[1], marker: m[2], text: m[3].trim() });
      afterIdx = i + 1;
    } else if (markerLines.length > 0) {
      break;
    }
  }

  if (markerLines.length !== 4) return null; // 파싱 불가

  // 마커형 문항 (①②③④ 선지) 스킵
  if (q.ch.every(c => MARKERS.includes((c || '').trim()))) return null;

  // 각 선지 텍스트를 ch에서 찾아 실제 인덱스 매핑
  const normalize = s => s.replace(/\s+/g, ' ').trim();
  const textToChIdx = new Map();
  for (const line of markerLines) {
    const normText = normalize(line.text);
    // ch에서 가장 가까운 텍스트 찾기 (완전 일치 우선)
    let foundIdx = -1;
    for (let i = 0; i < q.ch.length; i++) {
      if (normalize(q.ch[i]) === normText) { foundIdx = i; break; }
    }
    if (foundIdx === -1) {
      // partial match (prefix)
      for (let i = 0; i < q.ch.length; i++) {
        const chNorm = normalize(q.ch[i]);
        if (chNorm.startsWith(normText) || normText.startsWith(chNorm)) { foundIdx = i; break; }
      }
    }
    if (foundIdx === -1) return null; // 매칭 실패
    textToChIdx.set(line, foundIdx);
  }

  // 모든 ch 인덱스가 유일하게 매핑되었는지 확인
  const mappedIdxs = [...textToChIdx.values()];
  if (new Set(mappedIdxs).size !== 4) return null;

  // ch 순서대로 재정렬
  const newMarkerLines = q.ch.map((chText, idx) => {
    const marker = MARKERS[idx];
    const isAns = (idx + 1) === q.ans;
    return `${isAns ? '✅' : '❌'} ${marker} ${chText}`;
  });

  // 기존 마커 줄 이후 본문 유지
  const rest = lines.slice(afterIdx);
  const newAnalysis = [...newMarkerLines, ...rest].join('\n');

  if (newAnalysis === analysis) return null;
  return newAnalysis;
}

function fixFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  let changed = 0;
  const fixed = [];
  for (const q of data.questions || []) {
    const newAnalysis = fixQuestionDet(q);
    if (newAnalysis) {
      q.det.analysis = newAnalysis;
      changed++;
      fixed.push(q.id);
    }
  }
  if (changed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  return { changed, fixed };
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node fix-det-analysis-markers.js <file1.json> [file2.json ...]');
  process.exit(1);
}

let totalChanged = 0;
for (const f of args) {
  const { changed, fixed } = fixFile(f);
  console.log(`${changed > 0 ? '[FIXED]' : '[OK]'} ${f} — ${changed} questions${changed > 0 ? ' (Q' + fixed.join(', Q') + ')' : ''}`);
  totalChanged += changed;
}
console.log(`\nTotal: ${totalChanged} questions fixed across ${args.length} files`);
