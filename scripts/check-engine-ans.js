#!/usr/bin/env node
/**
 * check-engine-ans.js — 엔진(index.html) 내장 문항 채점 정합성 게이트
 *
 * 배경 사고 (2026-09-03, 유서현 신고):
 *   데일리 단어 생성기가 ans를 0-indexed(ch.indexOf)로 저장 → 채점기(a+1===ans)는
 *   1-indexed 기대 → 정답을 골라도 오답 처리 + 정답 번호 오표시.
 *   FALLBACK_QUESTION_BANK 57문항도 전부 0-indexed였음 (동일 계열).
 *
 * 불변식: index.html 안에서 mc 문항의 ans는 항상 1-indexed (1..ch.length).
 *
 * 검사 항목:
 *   R1. `ans:` 뒤에 indexOf(...)를 쓰면 반드시 +1 (0-indexed 생성 차단)
 *   R2. `ans:0` / `ans: 0` 리터럴 금지 (1-indexed에서 0은 존재 불가)
 *   R3. FALLBACK_QUESTION_BANK 전 문항: mc → ans ∈ 1..ch.length,
 *       해설(✅①~⑤)과 ans 교차 대조 (적절형만; 부적절/불일치/무관형 제외)
 *   R4. getDailyVocabQuestions() 실행 검증: ans ∈ 1..4 && ch[ans-1] === 정답 텍스트
 *
 * Usage: node scripts/check-engine-ans.js   (exit 1 = FAIL, 커밋/배포 차단)
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');
const errors = [];

// ── R1: ans에 indexOf를 쓰면 반드시 +1 ──
lines.forEach((l, i) => {
  const m = l.match(/ans:\s*[A-Za-z_$][\w$.]*\.indexOf\([^)]*\)(?!\s*\+\s*1)/g);
  if (m) m.forEach(x => errors.push(`R1 L${i + 1}: 0-indexed ans 생성 — "${x}" 에 +1 필요`));
});

// ── R2: ans:0 리터럴 금지 ──
lines.forEach((l, i) => {
  if (/(?<![A-Za-z_])ans:\s*0(?![\d.])/.test(l)) {
    errors.push(`R2 L${i + 1}: ans:0 발견 — 1-indexed에서 0은 불가 (0-indexed 의심)`);
  }
});

// ── R3: FALLBACK_QUESTION_BANK 정합성 ──
try {
  const start = src.indexOf('const FALLBACK_FULL_PASSAGE');
  const bankStart = src.indexOf('const FALLBACK_QUESTION_BANK');
  const bankEnd = src.indexOf('\n};', bankStart);
  if (start < 0 || bankStart < 0 || bankEnd < 0) throw new Error('FALLBACK 블록을 찾지 못함');
  const region = src.slice(start, bankEnd + 3);
  const bank = new Function(region + '\nreturn FALLBACK_QUESTION_BANK;')();
  const NMS = ['①', '②', '③', '④', '⑤'];
  for (const [tt, scopes] of Object.entries(bank)) {
    for (const [sc, qs] of Object.entries(scopes)) {
      for (const q of qs) {
        if (q.fmt === 'mc') {
          if (typeof q.ans !== 'number' || !(q.ans >= 1 && q.ans <= (q.ch || []).length)) {
            errors.push(`R3 ${tt}/${sc} Q${q.id}: ans=${q.ans} 범위 밖 (1..${(q.ch || []).length})`);
            continue;
          }
          const det = JSON.stringify(q.det || {});
          const isNegType = /적절하지 않은|일치하지 않는|무관한|다른 의미|않은 것/.test(q.stem || '');
          const mm = det.match(/✅\s*([①②③④⑤])/);
          if (mm && !isNegType) {
            const idx = NMS.indexOf(mm[1]) + 1;
            if (q.ans !== idx) errors.push(`R3 ${tt}/${sc} Q${q.id}: ans=${q.ans} vs 해설 ✅${mm[1]}(=${idx}) 불일치`);
          }
        } else if (q.fmt === 'written' && !q.wa) {
          errors.push(`R3 ${tt}/${sc} Q${q.id}: written인데 wa 없음`);
        }
      }
    }
  }
} catch (e) {
  errors.push(`R3 EVAL FAIL: ${e.message}`);
}

// ── R4: 데일리 단어 생성기 실행 검증 ──
try {
  const dwStart = src.indexOf('const DAILY_WORDS');
  const fnEnd = src.indexOf('\n}', src.indexOf('function getDailyVocabQuestions'));
  if (dwStart < 0 || fnEnd < 0) throw new Error('데일리 단어 블록을 찾지 못함');
  const block = src.slice(dwStart, fnEnd + 2);
  const stub = `
    function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
    function dailySeed(){return __SEED__;}
  `;
  for (const seed of [0, 1, 7, 42, 999]) {
    const qs = new Function(stub.replace('__SEED__', String(seed)) + block + '\nreturn getDailyVocabQuestions();')();
    for (const q of qs) {
      if (!(q.ans >= 1 && q.ans <= q.ch.length)) {
        errors.push(`R4 seed=${seed} Q${q.id}: ans=${q.ans} 범위 밖`);
        continue;
      }
      const correct = String(q.det.correct || '').replace('정답: ', '');
      if (q.ch[q.ans - 1] !== correct) {
        errors.push(`R4 seed=${seed} Q${q.id}: ch[ans-1]="${q.ch[q.ans - 1]}" ≠ 정답 "${correct}"`);
      }
    }
  }
} catch (e) {
  errors.push(`R4 EVAL FAIL: ${e.message}`);
}

if (errors.length) {
  console.error(`⛔ 엔진 채점 게이트 FAIL — ${errors.length}건`);
  errors.slice(0, 30).forEach(e => console.error('  ' + e));
  console.error('\n엔진 내장 문항 ans는 반드시 1-indexed(1..ch.length)여야 합니다.');
  process.exit(1);
}
console.log('✅ 엔진 채점 게이트 PASS (R1 indexOf+1 · R2 ans:0 금지 · R3 폴백뱅크 57문항 · R4 데일리 생성기 5시드)');
