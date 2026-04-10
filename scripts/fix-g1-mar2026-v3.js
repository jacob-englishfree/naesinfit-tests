#!/usr/bin/env node
/**
 * 고1/3월_2026 자동수정 v3 — 부적절 어휘 마커 보완
 *
 * 핵심: 부적절 어휘의 정답(오답어)은 fullPassage에 없음.
 * det.analysis에서 "원문 XXX" 패턴으로 원래 단어를 찾아
 * fullPassage에서 원문 단어 → 정답어(오답)로 교체 + 마커 삽입
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
    const jsons = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    for (const j of jsons) results.push(path.join(dirPath, j));
  }
  return results;
}

function fixFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fp = data.fullPassage;
  if (!fp) return 0;

  let fixes = 0;

  for (const q of data.questions || []) {
    const type = q.type || '';
    if (!type.includes('부적절') && !type.includes('오류')) continue;
    if (!q.passage || q.fmt !== 'mc') continue;

    const ch = q.ch || [];
    const ans = q.ans;
    if (!ans || ans < 1 || ans > ch.length) continue;

    // 현재 passage에서 마커 수 확인
    const currentMarkers = (q.passage.match(/[①②③④⑤]\s*<u>/g) || []).length;
    if (currentMarkers >= 4) continue; // 이미 4개면 OK

    // 정답어 (문맥상 부적절한 단어)
    const wrongWord = ch[ans - 1];

    // det.analysis에서 원문 단어 추출
    // 패턴들: "원문 inform", "원문은 inform", "inform → 알리다", "inform(알리다)"
    const analysis = (q.det?.analysis || '') + ' ' + (q.det?.korean || '') + ' ' + (q.det?.tip || '');

    let originalWord = null;

    // 패턴 1: "원문 WORD"
    const p1 = analysis.match(/원문\s+(\w+)/);
    if (p1) originalWord = p1[1];

    // 패턴 2: "→ WORD" (tip에서)
    if (!originalWord) {
      const p2 = analysis.match(/↔\s*(\w+)/);
      if (p2) originalWord = p2[1];
    }

    // 패턴 3: "WORD(한글)"  in tip after ↔
    if (!originalWord) {
      const tipMatch = (q.det?.tip || '').match(/↔\s*(\w+)\(/);
      if (tipMatch) originalWord = tipMatch[1];
    }

    // 패턴 4: 정답 해설에서 직접 추출 "❌ ② conceal: 원문 inform"
    if (!originalWord) {
      const detMatch = analysis.match(new RegExp(`${wrongWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*원문\\s+(\\w+)`, 'i'));
      if (detMatch) originalWord = detMatch[1];
    }

    if (!originalWord) {
      // console.log(`  SKIP (원문 못찾음): Q${q.id} wrong="${wrongWord}"`);
      continue;
    }

    // 원문 단어가 fullPassage에 있는지 확인
    const escaped = originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');

    if (!regex.test(fp)) {
      // 원문 단어가 fullPassage에 없으면 skip
      continue;
    }

    // fullPassage 기반으로 passage 재구성
    let newPassage = fp;
    const markers = []; // 기존 마커들

    // 기존 passage에서 마커+단어 추출 (정답이 아닌 것들)
    const existingPattern = /([①②③④⑤])\s*<u>([^<]+)<\/u>/g;
    let m;
    while ((m = existingPattern.exec(q.passage)) !== null) {
      markers.push({ marker: m[1], word: m[2] });
    }

    // 정답어의 마커 번호 결정
    const markerChars = ['①', '②', '③', '④', '⑤'];
    const ansMarker = markerChars[ans - 1];

    // fullPassage에 기존 마커들 삽입
    for (const { marker, word } of markers) {
      const wEsc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wRegex = new RegExp(`\\b${wEsc}\\b`);
      if (wRegex.test(newPassage)) {
        newPassage = newPassage.replace(wRegex, `${marker}<u>${word}</u>`);
      }
    }

    // 정답어 마커 삽입 (원문 단어 → 오답어로 교체)
    const origRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (origRegex.test(newPassage)) {
      newPassage = newPassage.replace(origRegex, `${ansMarker}<u>${wrongWord}</u>`);
    }

    // 마커 수 확인
    const newMarkerCount = (newPassage.match(/[①②③④⑤]\s*<u>/g) || []).length;
    if (newMarkerCount >= 4) {
      q.passage = newPassage;
      fixes++;
    }
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`  FIXED ${fixes}건: ${path.relative(BASE, filePath)}`);
  }
  return fixes;
}

const files = getAllFiles();
console.log(`\n=== 고1/3월_2026 부적절 마커 보완 (v3) ===`);
console.log(`대상: ${files.length}파일\n`);

let total = 0;
for (const f of files) total += fixFile(f);
console.log(`\n총 ${total}건 수정.`);
