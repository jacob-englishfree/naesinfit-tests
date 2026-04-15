#!/usr/bin/env node
/**
 * 회귀 테스트: 날짜 UTC 파싱 차단
 *
 * 사고: 2026-04-07 — new Date("2026-04-07")이 UTC 기준 파싱되어 KST에서 하루 밀림.
 *      D-day 계산 1일 오차. feedback_date_calc_local.
 *
 * 차단: shared 코드에서 new Date("YYYY-MM-DD") 패턴 (T00:00:00 없이) 사용 시 경고.
 *       new Date(d + "T00:00:00") 형식만 허용.
 */

const fs = require('fs');
const path = require('path');

const SHARED_DIR = path.resolve(__dirname, '../../../naesinfit-shared/src');
// date/week 관련 파일만 스캔 (student-filter, week, date, holding)
const TARGET_FILES = [
  'utils/week.ts',
  'utils/date.ts',
  'utils/student-filter.ts',
  'actions/holding.ts',
];

const UNSAFE_PATTERN = /new Date\(\s*([a-zA-Z_$][\w$.]*)\s*\)/g;
// 안전: new Date(), new Date(timestamp), new Date(d + "T00:00:00")
// 위험: new Date(dateString) — 변수가 "YYYY-MM-DD"일 수 있음

let warnings = 0;
const flagged = [];

for (const rel of TARGET_FILES) {
  const file = path.join(SHARED_DIR, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    // new Date(변수) 패턴 검출 — 단 new Date() (인자없음)나 new Date(today) 제외
    const m = line.match(/new Date\(([^)]+)\)/g);
    if (!m) return;
    for (const call of m) {
      const inner = call.slice(9, -1).trim();
      // 안전 패턴 스킵
      if (!inner) continue; // new Date()
      if (/^\d+$/.test(inner)) continue; // new Date(1234567890)
      if (inner.includes('T00:00:00')) continue; // 안전
      if (inner.includes('.getTime()')) continue; // timestamp
      if (inner.includes('.toISOString()')) continue;
      if (inner === 'today' && line.includes('|| new Date()')) continue; // 기본값 패턴

      flagged.push(`${rel}:${i + 1} — ${call}`);
      warnings++;
    }
  });
}

if (warnings > 0) {
  console.warn(`\n⚠️  날짜 UTC 파싱 위험 (${warnings}건)`);
  flagged.forEach(f => console.warn('  ' + f));
  console.warn('\n규칙: new Date(dateString) → new Date(d + "T00:00:00") 사용.');
  console.warn('사고: 2026-04-07. D-day 1일 오차.');
  // 현재는 경고만. Phase 3에서 FAIL로 승격 검토.
  // process.exit(1);
}

console.log(`✅ 날짜 파싱 검사 완료 (경고 ${warnings}건)`);
