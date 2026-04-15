#!/usr/bin/env node
/**
 * student-feedback-loop.js — 학생 답안 정답률 기반 출제 품질 역분석
 *
 * ⚠️ 초안 (jacob 승인 후 활성화). 실행 전 Supabase 테이블 스키마 확인 필수.
 *
 * 로직:
 *   1. Supabase에서 각 문항별 학생 답안 통계 수집
 *   2. 정답률 < 20% 또는 > 95% 문항은 출제 오류 의심
 *   3. 특정 오답 선택률이 >40%이면 오답이 너무 그럴듯하거나 정답이 애매
 *   4. 자동 flag 큐 (suspect_questions.json) 생성 → jacob 리뷰 후 재출제
 *
 * Usage:
 *   node scripts/student-feedback-loop.js --dry              → 분석만 (실행 안 함)
 *   node scripts/student-feedback-loop.js --window 7d        → 최근 7일 데이터
 *   node scripts/student-feedback-loop.js --min-attempts 10  → 최소 10회 응시 문항만
 */

require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_KEY 미설정 (.env)');
  process.exit(1);
}

const WINDOW = (process.argv.find(a => a.startsWith('--window=')) || '--window=30d').split('=')[1];
const MIN_ATTEMPTS = parseInt((process.argv.find(a => a.startsWith('--min-attempts=')) || '--min-attempts=5').split('=')[1]);
const DRY = process.argv.includes('--dry');

// ⚠️ Supabase 테이블 스키마 추정 (실제 확인 필요)
// test_results: { student_id, test_id (파일경로), question_id, selected_answer, is_correct, submitted_at }
// 만약 schema 다르면 이 쿼리 부분 수정

async function fetchStats() {
  const since = new Date(Date.now() - parseInt(WINDOW) * 24 * 60 * 60 * 1000).toISOString();
  const url = `${SB_URL}/rest/v1/test_results?select=test_id,question_id,selected_answer,is_correct&submitted_at=gte.${since}&limit=50000`;
  const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) {
    console.warn(`⚠️  test_results 조회 실패 (${r.status}) — 스키마 확인 필요`);
    return [];
  }
  return await r.json();
}

function aggregate(rows) {
  const byQ = {};
  for (const row of rows) {
    const key = `${row.test_id}::${row.question_id}`;
    byQ[key] = byQ[key] || { total: 0, correct: 0, answers: {}, test_id: row.test_id, question_id: row.question_id };
    byQ[key].total++;
    if (row.is_correct) byQ[key].correct++;
    const a = String(row.selected_answer);
    byQ[key].answers[a] = (byQ[key].answers[a] || 0) + 1;
  }
  return byQ;
}

function suspectFlags(stats) {
  const flags = [];
  for (const [key, s] of Object.entries(stats)) {
    if (s.total < MIN_ATTEMPTS) continue;
    const correctRate = s.correct / s.total;
    const flagsForQ = [];
    if (correctRate < 0.20) flagsForQ.push({ type: 'TOO-HARD', severity: 'high', rate: correctRate.toFixed(2) });
    if (correctRate > 0.95) flagsForQ.push({ type: 'TOO-EASY', severity: 'medium', rate: correctRate.toFixed(2) });
    // 특정 오답에 몰림
    for (const [a, cnt] of Object.entries(s.answers)) {
      const share = cnt / s.total;
      if (share > 0.40 && correctRate < 0.50) {
        flagsForQ.push({ type: 'STRONG-DISTRACTOR', severity: 'high', answer: a, share: share.toFixed(2) });
      }
    }
    if (flagsForQ.length) {
      flags.push({ test_id: s.test_id, question_id: s.question_id, total: s.total, correct: s.correct, correctRate: correctRate.toFixed(2), flags: flagsForQ });
    }
  }
  return flags;
}

(async () => {
  console.log(`📊 학생 피드백 루프 (window=${WINDOW}, min_attempts=${MIN_ATTEMPTS})`);
  const rows = await fetchStats();
  console.log(`  수집 레코드: ${rows.length}`);
  const stats = aggregate(rows);
  console.log(`  분석 대상 문항: ${Object.keys(stats).length}`);
  const flags = suspectFlags(stats);
  console.log(`  의심 문항: ${flags.length}`);
  if (flags.length === 0) {
    console.log('✅ 이상 없음');
    return;
  }
  console.log('\n━━━ 의심 문항 리포트 ━━━');
  flags.slice(0, 30).forEach(f => {
    console.log(`\n${f.test_id} Q${f.question_id} (n=${f.total}, 정답률=${f.correctRate})`);
    f.flags.forEach(fg => console.log(`  ${fg.severity} ${fg.type} ${JSON.stringify(fg)}`));
  });
  if (flags.length > 30) console.log(`\n... 외 ${flags.length - 30}건`);
  if (DRY) return;
  const outPath = path.join(ROOT, 'suspect_questions.json');
  fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), window: WINDOW, flags }, null, 2));
  console.log(`\n저장: ${outPath}`);
})().catch(e => {
  console.error('❌ 실행 오류:', e.message);
  process.exit(1);
});
