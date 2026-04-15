#!/usr/bin/env node
/**
 * Meta-Test Runner — validate.js 규칙별 PASS/FAIL fixture 검증
 *
 * 실행: node tests/rules/run.js  (또는 npm run test:rules)
 *
 * 구조: tests/fixtures/<rule-id>/pass.json, fail.json
 *   - pass.json: 이 규칙에 걸리지 않아야 함 (통과 기대)
 *   - fail.json: 이 규칙에 반드시 걸려야 함 (차단 기대)
 *
 * 각 fixture는 실제 test JSON 구조 (version, testType, ei, fullPassage, questions)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const VALIDATE = path.join(ROOT, 'validate', 'validate.js');

function runValidate(file) {
  try {
    return { out: execSync(`node "${VALIDATE}" "${file}" 2>&1`, { encoding: 'utf8' }), ok: true };
  } catch (e) {
    return { out: (e.stdout || '') + (e.stderr || ''), ok: false };
  }
}

function hasRule(output, ruleId) {
  // 파일 경로 라인 제외 — 규칙 코드 라인만 체크
  const pattern = new RegExp(`^\\s*\\[[SABC]\\]\\s+${ruleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'm');
  return pattern.test(output);
}

const ruleFolders = fs.existsSync(FIXTURES_DIR)
  ? fs.readdirSync(FIXTURES_DIR).filter(f => fs.statSync(path.join(FIXTURES_DIR, f)).isDirectory())
  : [];

let total = 0, passed = 0, failed = 0;
const failures = [];

for (const ruleId of ruleFolders) {
  const ruleDir = path.join(FIXTURES_DIR, ruleId);
  for (const variant of ['pass', 'fail']) {
    const fixtureFile = path.join(ruleDir, `${variant}.json`);
    if (!fs.existsSync(fixtureFile)) continue;
    total++;
    const res = runValidate(fixtureFile);
    const ruleHit = hasRule(res.out, ruleId);
    const expectedHit = variant === 'fail';
    if (ruleHit === expectedHit) {
      passed++;
      console.log(`✅ ${ruleId}/${variant}`);
    } else {
      failed++;
      failures.push({ ruleId, variant, expected: expectedHit, got: ruleHit, out: res.out.slice(0, 400) });
      console.log(`❌ ${ruleId}/${variant} — 예상:${expectedHit ? '걸림' : '통과'}, 실제:${ruleHit ? '걸림' : '통과'}`);
    }
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Meta-Test: ${passed}/${total} PASS (실패 ${failed})`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

if (failures.length) {
  console.log(`\n실패 상세:`);
  for (const f of failures) {
    console.log(`\n[${f.ruleId}/${f.variant}] 예상:${f.expected ? '걸림' : '통과'}, 실제:${f.got ? '걸림' : '통과'}`);
    console.log(f.out);
  }
  process.exit(1);
}
