#!/usr/bin/env node
/**
 * SEM-3 fix: 어법형 ch를 passage <u> 밑줄 출현 순서대로 재정렬 + ans 텍스트 보존
 *
 * 어법(grammar) 문항은 ch 순서가 passage 밑줄 순서와 일치해야 함.
 * fix-answer-distribution이 어법형까지 셔플해서 깨진 케이스 복구.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const APPLY = process.argv.includes('--apply');

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir)) {
    if (e === '_passages' || e.startsWith('.')) continue;
    const f = path.join(dir, e);
    const st = fs.statSync(f);
    if (st.isDirectory()) walk(f, files);
    else if (e === '단어.json' || e === '워크북.json' || e === '퀴즈.json') files.push(f);
  }
  return files;
}

function normalize(s) {
  return String(s || '')
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')
    .replace(/[\s\-—–·,.()<>"'`]/g, '')
    .toLowerCase().trim();
}

// passage에서 <u>...</u> 텍스트들을 출현 순서대로 추출
function extractUnderlines(passage) {
  if (!passage) return [];
  const matches = passage.match(/<u[^>]*>([\s\S]*?)<\/u>/g) || [];
  return matches.map(m => m.replace(/<\/?u[^>]*>/g, '').trim());
}

// ch 텍스트가 어떤 underline에 매칭되는지 → 그 underline의 인덱스
function chToUnderlineIdx(chText, underlines) {
  const c = normalize(chText);
  if (c.length < 2) return -1;
  for (let i = 0; i < underlines.length; i++) {
    const u = normalize(underlines[i]);
    if (u && (u.includes(c) || c.includes(u))) return i;
  }
  return -1;
}

// 어법형 문항 판별: type/stem에 "어법" 또는 SEM-3 검증 대상 여부
function isGrammarQ(q) {
  const stem = (q.stem || '') + ' ' + (q.type || '');
  return /어법|어형|어법상|어법성/.test(stem);
}

const stats = { filesScanned: 0, filesChanged: 0, qFixed: 0, qSkipped: 0 };

const files = walk(ROOT);
for (const file of files) {
  stats.filesScanned++;
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  if (!Array.isArray(data.questions)) continue;

  let changed = false;
  for (const q of data.questions) {
    if (!isGrammarQ(q)) continue;
    if (!Array.isArray(q.ch) || q.ch.length === 0) continue;
    const underlines = extractUnderlines(q.passage);
    if (underlines.length < 2) continue;

    // 현재 ch가 underline 순서와 일치하는지 확인
    const chIdxList = q.ch.map(c => chToUnderlineIdx(c, underlines));
    if (chIdxList.some(x => x === -1)) { stats.qSkipped++; continue; } // 매칭 실패시 skip

    // 이미 정렬돼 있으면 skip
    let sorted = true;
    for (let i = 1; i < chIdxList.length; i++) {
      if (chIdxList[i] < chIdxList[i - 1]) { sorted = false; break; }
    }
    if (sorted) continue;

    // 정답 텍스트 저장
    const oldAnsText = q.ch[q.ans - 1];

    // ch를 underline 순서대로 재배열 (ch와 chIdx를 함께 정렬)
    const paired = q.ch.map((c, i) => ({ c, u: chIdxList[i] }));
    paired.sort((a, b) => a.u - b.u);
    // 마커(①②③④) 재부착
    const markers = ['①', '②', '③', '④', '⑤'];
    const newCh = paired.map((p, i) => {
      const cleaned = String(p.c).replace(/^[①②③④⑤]\s*/, '');
      return `${markers[i]} ${cleaned}`;
    });
    q.ch = newCh;
    // 새 ans 인덱스 찾기
    const newAns = newCh.findIndex(c => normalize(c) === normalize(oldAnsText)) + 1;
    if (newAns >= 1) q.ans = newAns;

    changed = true;
    stats.qFixed++;
  }

  if (changed && APPLY) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    stats.filesChanged++;
  } else if (changed) {
    stats.filesChanged++;
  }
}

console.log(JSON.stringify(stats, null, 2));
console.log(APPLY ? '✅ APPLIED' : '🔍 DRY-RUN');
