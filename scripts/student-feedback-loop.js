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

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// .env 수동 파싱 (dotenv 의존성 없이)
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const SB_URL = process.env.SUPABASE_URL || process.env.NAESINFIT_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY || process.env.NAESINFIT_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_KEY 미설정 (.env)');
  process.exit(1);
}

const WINDOW = (process.argv.find(a => a.startsWith('--window=')) || '--window=30d').split('=')[1];
const MIN_ATTEMPTS = parseInt((process.argv.find(a => a.startsWith('--min-attempts=')) || '--min-attempts=5').split('=')[1]);
const DRY = process.argv.includes('--dry');

// Supabase 스키마 (확인됨 2026-04-15):
//   test_results: hist_key, test_type, subject, pub, lesson, name, school, grade, score, total, correct, wrong, unanswered, elapsed, taken_at
//   test_scores: student_name, scope, test_type, score, ok, no, time_sec, created_at
// → 문항별 데이터 없음. 시험 전체 점수 기반 분석만 가능
// → 문항별 상세 분석은 별도 테이블 신설 필요 (jacob 승인 사항)

async function fetchStats() {
  const since = new Date(Date.now() - parseInt(WINDOW) * 24 * 60 * 60 * 1000).toISOString();
  const url = `${SB_URL}/rest/v1/test_results?select=hist_key,test_type,subject,pub,lesson,score,total,taken_at&taken_at=gte.${since}&limit=50000`;
  const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) {
    console.warn(`⚠️  test_results 조회 실패 (${r.status})`);
    return [];
  }
  return await r.json();
}

function aggregate(rows) {
  // hist_key 단위로 집계 (시험 파일별)
  const byTest = {};
  for (const row of rows) {
    const key = row.hist_key || `${row.subject}-${row.pub}-${row.lesson}-${row.test_type}`;
    byTest[key] = byTest[key] || { attempts: 0, scoreSum: 0, key, test_type: row.test_type, subject: row.subject, pub: row.pub, lesson: row.lesson, scores: [] };
    byTest[key].attempts++;
    byTest[key].scoreSum += (row.score || 0);
    byTest[key].scores.push(row.score || 0);
  }
  return byTest;
}

function suspectFlags(stats) {
  const flags = [];
  for (const [key, s] of Object.entries(stats)) {
    if (s.attempts < MIN_ATTEMPTS) continue;
    const avgScore = s.scoreSum / s.attempts;
    const passRate = s.scores.filter(x => x >= 80).length / s.attempts;
    const flagsForTest = [];
    if (avgScore < 40) flagsForTest.push({ type: 'AVG-TOO-LOW', severity: 'high', avgScore: avgScore.toFixed(1), note: '시험 전체 난이도 너무 높음 또는 출제 오류' });
    if (avgScore > 95) flagsForTest.push({ type: 'AVG-TOO-HIGH', severity: 'medium', avgScore: avgScore.toFixed(1), note: '시험 전체 난이도 너무 낮음' });
    if (passRate < 0.20 && s.attempts >= 10) flagsForTest.push({ type: 'LOW-PASS-RATE', severity: 'high', passRate: passRate.toFixed(2) });
    if (flagsForTest.length) {
      flags.push({ test: key, info: `${s.subject}/${s.pub}/${s.lesson}/${s.test_type}`, attempts: s.attempts, avgScore: avgScore.toFixed(1), passRate: passRate.toFixed(2), flags: flagsForTest });
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
