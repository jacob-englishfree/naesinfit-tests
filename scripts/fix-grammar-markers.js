#!/usr/bin/env node
/**
 * 어법 문항 SEM-3 수정: 정답(틀린 형태)이 passage에 없는 경우
 * det.korean에서 "A → B" 패턴으로 원래 형태를 찾아 passage에서 교체
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

let totalFixes = 0;

function fixFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fp = data.fullPassage;
  if (!fp) return;

  let changed = false;

  for (const q of data.questions || []) {
    if (!q.type || !q.type.includes('어법')) continue;
    if (q.fmt !== 'mc' || !q.passage) continue;

    const ch = q.ch || [];
    const ans = q.ans;
    if (!ans || ans < 1 || ans > ch.length) continue;

    // 정답 단어 (틀린 형태)
    let ansWord = ch[ans - 1];
    // ch가 "① word" 형태인 경우 마커 제거
    ansWord = ansWord.replace(/^[①②③④⑤]\s*/, '');

    // passage에 이 단어가 밑줄로 있는지 확인
    if (q.passage.includes(`<u>${ansWord}</u>`)) continue; // 이미 있음

    // det.korean에서 원래 단어 찾기: "A → B" or "A(한글) → B(한글)"
    const det = q.det?.korean || '';
    const analysis = q.det?.analysis || '';
    const tip = q.det?.tip || '';
    const allDet = det + ' ' + analysis + ' ' + tip;

    // 패턴: "wrongWord → correctWord" (det.korean에서)
    const escapedAns = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // det.korean 패턴: "③ planning → planned"
    let origWord = null;

    // 패턴 1: "ansWord → origWord"
    const p1 = allDet.match(new RegExp(`${escapedAns}[^→]*→\\s*(\\w+)`, 'i'));
    if (p1) origWord = p1[1];

    // 패턴 2: "ansWord(한글) → origWord"
    if (!origWord) {
      const p2 = allDet.match(new RegExp(`${escapedAns}\\([^)]+\\)\\s*→\\s*(\\w+)`, 'i'));
      if (p2) origWord = p2[1];
    }

    // 패턴 3: tip "origWord ↔ ..."
    if (!origWord) {
      const p3 = (tip || '').match(/:\s*(\w+)/);
      if (p3) origWord = p3[1];
    }

    if (!origWord) continue;

    // passage에서 원래 단어를 찾아 정답(틀린 형태) + 마커로 교체
    const markerChars = ['①', '②', '③', '④', '⑤'];
    const marker = markerChars[ans - 1];

    // ch에 마커가 포함된 형태("② see")라면 passage에도 마커+밑줄 삽입
    const chHasMarker = ch[ans - 1].match(/^[①②③④⑤]/);

    const origEscaped = origWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // origWord가 passage에 있고, 아직 마커가 붙지 않은 경우만
    const regex = new RegExp(`(?<![①②③④⑤]\\s*<u>)\\b${origEscaped}\\b(?!</u>)`, 'i');

    if (regex.test(q.passage)) {
      q.passage = q.passage.replace(regex, `${marker}<u>${ansWord}</u>`);
      changed = true;
      totalFixes++;
      console.log(`  Q${q.id}: "${origWord}" → "${marker}<u>${ansWord}</u>" in ${path.relative(BASE, filePath)}`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

const files = getAllFiles();
console.log(`\n=== 어법 마커 수정 ===\n`);
for (const f of files) fixFile(f);
console.log(`\n총 ${totalFixes}건 수정.`);
