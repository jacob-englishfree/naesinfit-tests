#!/usr/bin/env node
/**
 * fix-ans-errors.js — 블라인드 풀이에서 발견된 39건 ans 오류 수정
 * 2026-04-05
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const fixes = [
  // === 천재강상구 영어1 — ans=1 하드코딩 11건 ===
  { file: 'data/교과서/영어1/천재강상구/3과/본문/워크북.json', qid: 2, from: 1, to: 4, reason: '④destroy→destroys (3인칭 단수 병렬)' },
  { file: 'data/교과서/영어1/천재강상구/3과/본문/워크북.json', qid: 3, from: 1, to: 4, reason: '④that→which (콤마 뒤 계속적 용법)' },
  { file: 'data/교과서/영어1/천재강상구/3과/본문/워크북.json', qid: 4, from: 1, to: 4, reason: '④when→while (동시 동작)' },
  { file: 'data/교과서/영어1/천재강상구/3과/본문/워크북.json', qid: 14, from: 1, to: 3, reason: '③decrease→increase (56% more food)' },
  { file: 'data/교과서/영어1/천재강상구/4과/본문/워크북.json', qid: 1, from: 1, to: 4, reason: '④less→fewer (가산명사 predators)' },
  { file: 'data/교과서/영어1/천재강상구/4과/본문/워크북.json', qid: 2, from: 1, to: 3, reason: '③calling→called (수동 과거분사)' },
  { file: 'data/교과서/영어1/천재강상구/4과/본문/워크북.json', qid: 3, from: 1, to: 3, reason: '③increasing→increased (have+p.p.)' },
  { file: 'data/교과서/영어1/천재강상구/4과/본문/워크북.json', qid: 4, from: 1, to: 3, reason: '③which→where (장소 관계부사)' },
  { file: 'data/교과서/영어1/천재강상구/4과/본문/퀴즈.json', qid: 2, from: 1, to: 4, reason: '④say→says (3인칭 단수)' },
  { file: 'data/교과서/영어1/천재강상구/4과/본문/퀴즈.json', qid: 3, from: 1, to: 3, reason: '③counting→countless (형용사 필요)' },
  { file: 'data/교과서/영어1/천재강상구/4과/본문/퀴즈.json', qid: 4, from: 1, to: 3, reason: '③endangering→endangered (수동 p.p.)' },

  // === YBM한상호 영어2 — det.correct와 ans 불일치 2건 ===
  { file: 'data/교과서/영어2/YBM한상호/1과/본문/퀴즈.json', qid: 9, from: 3, to: 4, reason: '④harmless←원문infectious, det.correct도 ④' },
  { file: 'data/교과서/영어2/YBM한상호/1과/본문/퀴즈.json', qid: 10, from: 3, to: 4, reason: '④present←원문absent, det.correct도 ④' },

  // === YBM김은형 공통영어1 — 어법 논리 오류 1건 ===
  { file: 'data/교과서/공통영어1/YBM김은형/1과/Read More/워크북.json', qid: 3, from: 1, to: 2, reason: '4개 전부 어법 맞음 → ②(①②③④ 전부)가 정답' },

  // === 능률민병천 — 선지 셔플 후 ans 미업데이트 10건 ===
  { file: 'data/교과서/공통영어1/능률민병천/1과/본문/퀴즈.json', qid: 8, from: 1, to: 2, reason: '심박수증가+얼굴빨개짐=ch[2]' },
  { file: 'data/교과서/공통영어1/능률민병천/1과/본문/퀴즈.json', qid: 9, from: 4, to: 1, reason: '대처기술없으면공격적=ch[1]' },
  { file: 'data/교과서/공통영어1/능률민병천/1과/본문/퀴즈.json', qid: 10, from: 2, to: 1, reason: '단순스트레스비롯(불일치)=ch[1]' },
  { file: 'data/교과서/공통영어1/능률민병천/1과/본문/퀴즈.json', qid: 11, from: 3, to: 1, reason: '화를생산적으로관리=ch[1]' },
  { file: 'data/교과서/공통영어1/능률민병천/1과/본문/퀴즈.json', qid: 12, from: 2, to: 1, reason: '화적절히다루면주도권=ch[1]' },
  { file: 'data/교과서/공통영어1/능률민병천/1과/본문/퀴즈.json', qid: 14, from: 1, to: 4, reason: '문제해결+감정조절뇌부분=ch[4]' },
  { file: 'data/교과서/공통영어1/능률민병천/2과/본문/단어.json', qid: 10, from: 1, to: 2, reason: 'thrilled≈excited=ch[2]' },
  { file: 'data/교과서/공통영어1/능률민병천/2과/본문/단어.json', qid: 15, from: 2, to: 1, reason: '(A)해결책(B)용액=ch[1]' },
  { file: 'data/교과서/공통영어1/능률민병천/2과/본문/단어.json', qid: 16, from: 4, to: 2, reason: 'contribution=ch[2]' },
  { file: 'data/교과서/공통영어1/능률민병천/2과/본문/퀴즈.json', qid: 10, from: 4, to: 1, reason: '화학약품사용하여(원문without)=ch[1]' },

  // === 천재조수경 영어1 2과 — 내용 오류 4건 ===
  { file: 'data/교과서/영어1/천재조수경/2과/본문/워크북.json', qid: 9, from: 4, to: 3, reason: 'socially responsible (원문확인)' },
  { file: 'data/교과서/영어1/천재조수경/2과/본문/퀴즈.json', qid: 9, from: 3, to: 4, reason: '④more←원문less (fullPassage확인)' },
  { file: 'data/교과서/영어1/천재조수경/2과/본문/퀴즈.json', qid: 10, from: 3, to: 4, reason: '④flexible←fullPassage에없음' },
  { file: 'data/교과서/영어1/천재조수경/2과/본문/퀴즈.json', qid: 15, from: 3, to: 4, reason: 'thinking outside the box=창의적사고=ch[4]' },
];

// 지학사 ans=-1 버그 — 별도 처리 (wa값으로 복구)
const ansMinusOneFiles = [
  'data/교과서/영어1/지학사신상근/4과/Inside Culture/단어.json',
  'data/교과서/영어1/지학사신상근/4과/Inside Culture/워크북.json',
  'data/교과서/영어1/지학사신상근/4과/Inside Culture/퀴즈.json',
];

let fixedCount = 0;

// 1. 일반 ans 수정
fixes.forEach(({ file, qid, from, to, reason }) => {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) { console.log(`[SKIP] ${file} 없음`); return; }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const q = data.questions.find(q => q.id === qid);
  if (!q) { console.log(`[SKIP] ${file} Q${qid} 없음`); return; }
  if (q.ans !== from) { console.log(`[SKIP] ${file} Q${qid} ans=${q.ans} ≠ expected ${from}`); return; }
  q.ans = to;
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  fixedCount++;
  console.log(`[FIXED] ${file} Q${qid}: ${from}→${to} (${reason})`);
});

// 2. ans=-1 → wa 기반 복구
ansMinusOneFiles.forEach(file => {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) { console.log(`[SKIP] ${file} 없음`); return; }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let count = 0;
  data.questions.forEach(q => {
    if (q.ans === -1 && q.wa) {
      q.ans = 0; // 서술형은 ans=0이 정상 (wa로 채점)
      count++;
    }
  });
  if (count > 0) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
    fixedCount += count;
    console.log(`[FIXED] ${file}: ans=-1 → 0 (${count}건)`);
  }
});

console.log(`\n=== 총 ${fixedCount}건 수정 완료 ===`);
