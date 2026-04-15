#!/usr/bin/env node
/**
 * 회귀 테스트: ans=1 하드코딩 차단
 *
 * 사고: 2026-04-01 — 출제 후 교차검증 없이 모든 문항 ans=1로 하드코딩.
 *      det ❌마커와 ans 불일치. feedback_ans1_hardcode_bug.
 *
 * 차단: 한 파일 내 20문항 전부 ans=1이면 FAIL (통계적 불가능).
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
let fail = 0;
const flagged = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.json') && !e.name.startsWith('_')) {
      try {
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        const qs = data.questions;
        if (!Array.isArray(qs) || qs.length < 10) continue;
        const mcQs = qs.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
        if (mcQs.length < 10) continue;
        const allOne = mcQs.every(q => q.ans === 1);
        if (allOne) {
          flagged.push(path.relative(DATA_DIR, full) + ` (${mcQs.length}문항 전부 ans=1)`);
          fail++;
        }
      } catch {}
    }
  }
}

walk(DATA_DIR);

if (fail) {
  console.error(`\n❌ ANS=1 하드코딩 의심 (${fail}건)`);
  flagged.slice(0, 20).forEach(f => console.error('  ' + f));
  console.error('\n사고: 2026-04-01. 출제 후 교차검증 없이 ans=1 하드코딩.');
  process.exit(1);
}
console.log(`✅ ans=1 하드코딩 0건 (data/ ${fs.readdirSync(DATA_DIR).length} 폴더 스캔)`);
