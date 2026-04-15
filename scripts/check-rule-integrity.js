#!/usr/bin/env node
/**
 * check-rule-integrity.js — 규칙 파일 무결성 해시 검증
 *
 * 목적: validate.js + question-schema.json + 주요 feedback memory 파일들이
 *       악의적/실수로 변경됐는지 감지. pre-commit/CI에서 실행.
 *
 * Usage:
 *   node scripts/check-rule-integrity.js           → 현재 상태 검증 (변경 시 경고)
 *   node scripts/check-rule-integrity.js --update  → 의도적 변경 후 해시 재계산 + 기록
 *   node scripts/check-rule-integrity.js --list    → 봉인된 파일 목록
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SEAL_FILE = path.join(ROOT, '.rule-integrity.json');
const MEMORY_DIR = path.join(process.env.HOME, '.claude/projects/-Users-woobumpark/memory');

const SEALED_FILES = [
  // 출제/검수 규칙 파일
  'validate/validate.js',
  'validate/question-schema.json',
  'scripts/auto-catalog.js',
  'scripts/cross-check.js',
  'validate/blind-solver-local.js',
  'deploy-json.js',
  'create-test.js',
  'CLAUDE.md',
  'MULTI-AGENT-PROTOCOL.md'
];

const SEALED_MEMORY = [
  'feedback_no_meta_choice.md',
  'feedback_no_prefix_antonym.md',
  'feedback_anti_cheese_gate.md',
  'feedback_single_answer_only.md',
  'feedback_multi_agent_protocol.md',
  'feedback_no_api_only_agents.md'
];

function sha(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
}

function currentSeal() {
  const seal = { files: {}, memory: {}, timestamp: new Date().toISOString() };
  for (const f of SEALED_FILES) {
    seal.files[f] = sha(path.join(ROOT, f));
  }
  for (const f of SEALED_MEMORY) {
    seal.memory[f] = sha(path.join(MEMORY_DIR, f));
  }
  return seal;
}

function loadSeal() {
  if (!fs.existsSync(SEAL_FILE)) return null;
  return JSON.parse(fs.readFileSync(SEAL_FILE, 'utf8'));
}

const cmd = process.argv[2];

if (cmd === '--list') {
  console.log('봉인 파일:');
  SEALED_FILES.forEach(f => console.log(`  ${f}`));
  console.log('봉인 메모리:');
  SEALED_MEMORY.forEach(f => console.log(`  ${MEMORY_DIR}/${f}`));
  process.exit(0);
}

if (cmd === '--update') {
  const seal = currentSeal();
  fs.writeFileSync(SEAL_FILE, JSON.stringify(seal, null, 2));
  console.log(`✅ 봉인 갱신 (${Object.keys(seal.files).length + Object.keys(seal.memory).length}개 파일)`);
  process.exit(0);
}

// 검증 모드
const baseline = loadSeal();
if (!baseline) {
  console.log('⚠️  봉인 파일(.rule-integrity.json) 없음. --update 로 초기 생성');
  process.exit(0);
}

const current = currentSeal();
const changes = [];

for (const f of SEALED_FILES) {
  if (baseline.files[f] !== current.files[f]) {
    changes.push({ file: f, baseline: baseline.files[f], current: current.files[f] });
  }
}
for (const f of SEALED_MEMORY) {
  if (baseline.memory[f] !== current.memory[f]) {
    changes.push({ file: `memory/${f}`, baseline: baseline.memory[f], current: current.memory[f] });
  }
}

if (changes.length === 0) {
  console.log('✅ 봉인 무결성 확인 — 변경 없음');
  process.exit(0);
}

console.log(`⚠️  봉인된 파일 ${changes.length}개 변경됨:`);
for (const c of changes) {
  if (c.baseline === null) console.log(`  + 신규: ${c.file}`);
  else if (c.current === null) console.log(`  - 삭제: ${c.file} ← ⛔ 규칙 파일 삭제 주의!`);
  else console.log(`  ✎ 수정: ${c.file} (${c.baseline.slice(0, 8)} → ${c.current.slice(0, 8)})`);
}

console.log(`\n의도적 변경이면:  node scripts/check-rule-integrity.js --update`);
console.log(`변경이 이상하면: 해당 파일을 점검 후 복구`);
console.log(`\n⛔ 다음 변경 절대 금지 (feedback memory 필독):`);
console.log(`  - S-META-CHOICE, S-ANTONYM-PREFIX, S-ANTI-CHEESE-GATE, S-MULTI-ITEM-WRITTEN 규칙 삭제`);
console.log(`  - MULTI-AGENT-PROTOCOL.md 삭제`);
console.log(`  - feedback_*.md 파일 삭제`);
process.exit(1);
