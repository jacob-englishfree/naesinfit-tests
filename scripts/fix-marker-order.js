#!/usr/bin/env node
/**
 * 어법 마커 순서 수정: passage 내 ①②③④ 출현 순서 = 단조증가
 * ch와 ans도 같이 재매핑
 */
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..', 'data', '모의고사', '고1', '3월_2026');

function getAllFiles() {
  const results = [];
  const dirs = fs.readdirSync(BASE).filter(d => {
    const p = path.join(BASE, d);
    return fs.statSync(p).isDirectory() && !d.startsWith('_');
  });
  for (const dir of dirs) {
    const dirPath = path.join(BASE, dir);
    for (const j of fs.readdirSync(dirPath).filter(f => f.endsWith('.json'))) {
      results.push(path.join(dirPath, j));
    }
  }
  return results;
}

const MARKERS = ['①', '②', '③', '④'];
let totalFixes = 0;

function fixFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = false;

  for (const q of data.questions || []) {
    if (!q.type || !q.type.includes('어법')) continue;
    if (q.fmt !== 'mc' || !q.passage) continue;
    const ch = q.ch || [];
    if (ch.length < 4) continue;

    // ch가 마커형(①②③④)인 경우 skip — 이건 다른 구조
    if (ch[0].match(/^[①②③④⑤]$/)) continue;

    // passage에서 마커+밑줄 위치 추출
    const markerRegex = /([①②③④])\s*<u>([^<]+)<\/u>/g;
    const positions = [];
    let m;
    while ((m = markerRegex.exec(q.passage)) !== null) {
      positions.push({ marker: m[1], word: m[2], index: m.index });
    }

    if (positions.length < 3) continue;

    // 위치 순서대로 정렬
    positions.sort((a, b) => a.index - b.index);

    // 현재 마커 순서 확인
    const currentOrder = positions.map(p => p.marker);
    const expectedOrder = MARKERS.slice(0, positions.length);

    // 이미 올바른 순서면 skip
    if (currentOrder.every((m, i) => m === expectedOrder[i])) continue;

    // 마커 재매핑: position[0]=①, position[1]=②, ...
    // 먼저 passage에서 모든 마커 제거 후 올바른 순서로 재삽입
    let newPassage = q.passage;

    // 역순으로 제거 (앞부터 제거하면 인덱스 틀어짐)
    const sortedByIndexDesc = [...positions].sort((a, b) => b.index - a.index);
    for (const p of sortedByIndexDesc) {
      const fullMatch = `${p.marker}<u>${p.word}</u>`;
      // 정확한 위치에서 제거
      const before = newPassage.substring(0, p.index);
      const after = newPassage.substring(p.index + fullMatch.length);
      newPassage = before + `__PLACEHOLDER_${p.word}__` + after;
    }

    // 올바른 순서로 재삽입
    for (let i = 0; i < positions.length; i++) {
      const word = positions[i].word; // 위치순
      const marker = expectedOrder[i]; // ①②③④ 순서
      newPassage = newPassage.replace(`__PLACEHOLDER_${word}__`, `${marker}<u>${word}</u>`);
    }

    // ch 재매핑
    // 기존: 마커 N → ch[N-1], 새: 위치순 → ①②③④
    const oldMarkerToChIndex = {};
    for (let i = 0; i < positions.length; i++) {
      const oldMarker = positions[i].marker;
      const oldIdx = MARKERS.indexOf(oldMarker); // 0-based
      oldMarkerToChIndex[i] = oldIdx; // position i was originally marker oldIdx+1
    }

    const newCh = [...ch];
    const oldAns = q.ans;
    let newAns = oldAns;

    // Create mapping: new marker index → old marker index
    for (let newIdx = 0; newIdx < positions.length; newIdx++) {
      const oldIdx = MARKERS.indexOf(positions[newIdx].marker);
      newCh[newIdx] = ch[oldIdx];
      if (oldAns === oldIdx + 1) newAns = newIdx + 1;
    }

    // 나머지 ch (5번째 이상) 유지
    for (let i = positions.length; i < ch.length; i++) {
      newCh[i] = ch[i];
    }

    q.passage = newPassage;
    q.ch = newCh;
    q.ans = newAns;

    // det도 업데이트 필요하지만 복잡 — 일단 passage/ch/ans만
    changed = true;
    totalFixes++;
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`  OK: ${path.relative(BASE, filePath)}`);
  }
}

const files = getAllFiles();
console.log(`\n=== 마커 순서 수정 ===\n`);
for (const f of files) fixFile(f);
console.log(`\n총 ${totalFixes}건.`);
