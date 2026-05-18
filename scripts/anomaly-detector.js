#!/usr/bin/env node
/**
 * 정답률 이상치 감지
 * - 한 문항 정답률 0% 또는 100% → 의심
 * - 한 학생이 한 시험에서 만점/0점 → 의심
 *
 * Supabase REST API 사용 (supabase-js 의존성 없음)
 * 테이블 가정: test_results (또는 test_attempts) — 첫 실행 시 자동 탐색
 *
 * 환경변수: SUPABASE_URL, SUPABASE_KEY (.env에서 로드)
 */
const fs = require('fs');
const path = require('path');

// .env 로드
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[anomaly] SUPABASE_URL/KEY missing');
  process.exit(0);
}

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchTable(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`${table}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function detectTable() {
  const candidates = ['test_results', 'test_attempts', 'test_scores', 'quiz_results'];
  for (const t of candidates) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?limit=1`, { headers: HEADERS });
      if (r.ok) {
        console.log(`[anomaly] table found: ${t}`);
        return t;
      }
    } catch {}
  }
  return null;
}

(async () => {
  try {
    const table = await detectTable();
    if (!table) {
      console.log('[anomaly] no results table found — skip');
      return;
    }

    // 최근 7일 데이터
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const rows = await fetchTable(table, `created_at=gte.${since}&limit=5000`);
    console.log(`[anomaly] rows last 7d: ${rows.length}`);

    if (rows.length === 0) return;

    // 학생별 점수 이상치
    const perStudent = {}; // key: student_id+content_id
    const perQuestion = {}; // key: content_id+q_id → {correct, total}

    for (const r of rows) {
      const sid = r.student_id || r.user_id || 'unknown';
      const cid = r.content_id || r.test_id || 'unknown';
      const score = r.score ?? r.percent ?? null;
      if (score !== null) {
        const k = `${sid}|${cid}`;
        perStudent[k] = score;
      }
      // 문항별
      if (Array.isArray(r.answers) || Array.isArray(r.results)) {
        const arr = r.answers || r.results;
        arr.forEach((a, i) => {
          const qk = `${cid}|q${a.q_id ?? i + 1}`;
          if (!perQuestion[qk]) perQuestion[qk] = { correct: 0, total: 0 };
          perQuestion[qk].total++;
          if (a.correct === true || a.is_correct === true) perQuestion[qk].correct++;
        });
      }
    }

    // 만점/0점 학생
    const sus = Object.entries(perStudent).filter(([, s]) => s === 0 || s === 100);
    if (sus.length) {
      console.log(`[anomaly] 만점/0점 학생-시험 ${sus.length}건`);
      sus.slice(0, 10).forEach(([k, s]) => console.log(`    ${k} → ${s}`));
    }

    // 0%/100% 정답률 문항 (5명 이상 응시 기준)
    const susQ = Object.entries(perQuestion).filter(
      ([, v]) => v.total >= 5 && (v.correct === 0 || v.correct === v.total)
    );
    if (susQ.length) {
      console.log(`[anomaly] 정답률 0%/100% 문항 ${susQ.length}건`);
      susQ.slice(0, 20).forEach(([k, v]) =>
        console.log(`    ${k} → ${v.correct}/${v.total}`)
      );
    }

    if (sus.length === 0 && susQ.length === 0) {
      console.log('[anomaly] 이상치 없음');
    }
  } catch (e) {
    console.error('[anomaly] error:', e.message);
  }
})();
