#!/usr/bin/env node
/**
 * verify-integrity.js — 전수 정합성 검증
 *
 * 검증 항목:
 * 1. textbooks.ts id ↔ test-catalog.json 키 일치
 * 2. test-catalog.json path ↔ data/ 실제 폴더 일치
 * 3. test-catalog.json sections ↔ data/ 실제 섹션 일치
 * 4. 모든 JSON 파일 파싱 가능 + 최소 구조 검증
 * 5. NFC 정규화 검증 (macOS 인코딩 이슈)
 *
 * pre-commit hook 또는 CI에서 실행.
 * 에러 1건이라도 있으면 exit 1 → 커밋/배포 차단.
 *
 * Usage: node scripts/verify-integrity.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const CATALOG_PATH = path.join(ROOT, 'test-catalog.json');
const SHARED_PATH = path.resolve(ROOT, '..', 'naesinfit-shared', 'src', 'constants', 'textbooks.ts');

let errors = 0;
let warnings = 0;

function err(msg) { console.error('  ❌ ' + msg); errors++; }
function warn(msg) { console.log('  ⚠️  ' + msg); warnings++; }
function ok(msg) { console.log('  ✅ ' + msg); }

// ─── 1. textbooks.ts 파싱 ───
console.log('\n[1] textbooks.ts 파싱...');
let tbSrc;
try {
  tbSrc = fs.readFileSync(SHARED_PATH, 'utf8');
} catch (e) {
  err('textbooks.ts 읽기 실패: ' + e.message);
  process.exit(1);
}

const tbIds = new Set();
const tbPaths = {};
const tbRe = /\{\s*id:"([^"]+)"[^}]*?path:"([^"]+)"/g;
let m;
while ((m = tbRe.exec(tbSrc)) !== null) {
  tbIds.add(m[1]);
  tbPaths[m[1]] = m[2];
}
// path 없는 교과서도 id 수집
const tbIdOnlyRe = /\{\s*id:"([^"]+)"/g;
while ((m = tbIdOnlyRe.exec(tbSrc)) !== null) {
  tbIds.add(m[1]);
}
ok(`교과서 ${tbIds.size}개 id 파싱`);

// 모의고사 id 수집
const mockIds = new Set();
const mockPaths = {};
const mockRe = /\{\s*id:"(모의-[^"]+)"[^}]*?(?:path:"([^"]+)")?/g;
while ((m = mockRe.exec(tbSrc)) !== null) {
  mockIds.add(m[1]);
  if (m[2]) {
    const km = m[1].match(/모의-(\d+)-(고\d)-(\d+월)/);
    if (km) mockPaths[`${km[2]}-${km[1]}-${km[3]}`] = m[2];
  }
}
ok(`모의고사 ${mockIds.size}개 id 파싱`);

// ─── 2. test-catalog.json ↔ textbooks.ts 키 일치 ───
console.log('\n[2] catalog 키 ↔ textbooks.ts id 일치 검증...');
let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
} catch (e) {
  err('test-catalog.json 파싱 실패: ' + e.message);
  process.exit(1);
}

const catTbKeys = Object.keys(catalog['교과서'] || {});
for (const k of catTbKeys) {
  if (!tbIds.has(k)) {
    err(`카탈로그 교과서 키 "${k}"가 textbooks.ts에 없음`);
  }
}
for (const [id, p] of Object.entries(tbPaths)) {
  const catEntry = catalog['교과서']?.[id];
  if (catEntry && catEntry.path !== p) {
    err(`${id}: textbooks.ts path="${p}" ≠ catalog path="${catEntry.path}"`);
  }
}
if (errors === 0) ok('교과서 키/path 일치');

// ─── 3. catalog path ↔ data/ 폴더 일치 ───
console.log('\n[3] catalog path ↔ data/ 폴더 검증...');
let folderErrors = 0;
for (const [id, entry] of Object.entries(catalog['교과서'] || {})) {
  if (!entry.path || entry.units.length === 0) continue; // 미배포
  const dirPath = path.join(DATA, '교과서', entry.path.normalize('NFC'));
  if (!fs.existsSync(dirPath)) {
    err(`${id}: data/교과서/${entry.path} 폴더 없음`);
    folderErrors++;
    continue;
  }
  // 단원 확인
  for (const unit of entry.units) {
    const unitPath = path.join(dirPath, unit.normalize('NFC'));
    if (!fs.existsSync(unitPath)) {
      err(`${id}: data/교과서/${entry.path}/${unit} 폴더 없음`);
      folderErrors++;
    }
  }
  // 섹션 확인
  for (const [unit, sections] of Object.entries(entry.sections || {})) {
    for (const sec of sections) {
      const secPath = path.join(dirPath, unit.normalize('NFC'), sec.normalize('NFC'));
      if (!fs.existsSync(secPath)) {
        err(`${id}: data/교과서/${entry.path}/${unit}/${sec} 폴더 없음`);
        folderErrors++;
      }
    }
  }
}
if (folderErrors === 0) ok('교과서 폴더 구조 일치');

// 모의고사
for (const [key, entry] of Object.entries(catalog['모의고사'] || {})) {
  if (!entry.path || entry.items.length === 0) continue;
  const dirPath = path.join(DATA, '모의고사', entry.path.normalize('NFC'));
  if (!fs.existsSync(dirPath)) {
    err(`모의 ${key}: data/모의고사/${entry.path} 폴더 없음`);
  }
}

// 부교재
for (const [key, entry] of Object.entries(catalog['부교재'] || {})) {
  if (!entry.path || !entry.units || entry.units.length === 0) continue;
  const dirPath = path.join(DATA, '부교재', entry.path.normalize('NFC'));
  if (!fs.existsSync(dirPath)) {
    err(`부교재 ${key}: data/부교재/${entry.path} 폴더 없음`);
  }
}

// ─── 4. JSON 무결성 (배포된 파일만) ───
console.log('\n[4] JSON 무결성 검사...');
let jsonTotal = 0, jsonFail = 0;
function walkJson(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) { walkJson(full); continue; }
    if (!f.endsWith('.json') || f.startsWith('.')) continue;
    jsonTotal++;
    try {
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (!data.questions || !Array.isArray(data.questions)) {
        warn(`${path.relative(ROOT, full)}: questions 배열 없음`);
      } else if (data.questions.length === 0) {
        warn(`${path.relative(ROOT, full)}: questions 비어있음`);
      }
    } catch (e) {
      err(`${path.relative(ROOT, full)}: JSON 파싱 실패 — ${e.message}`);
      jsonFail++;
    }
  }
}
walkJson(DATA);
if (jsonFail === 0) ok(`${jsonTotal}개 JSON 파일 파싱 성공`);

// ─── 5. NFC 검증 ───
console.log('\n[5] NFC 정규화 검증...');
let nfcIssues = 0;
function checkNFC(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f !== f.normalize('NFC')) {
      warn(`NFD 파일명 감지: ${path.relative(ROOT, full)}`);
      nfcIssues++;
    }
    if (fs.statSync(full).isDirectory()) checkNFC(full);
  }
}
checkNFC(DATA);
if (nfcIssues === 0) ok('NFC 정규화 이슈 없음');
else warn(`${nfcIssues}개 NFD 파일명 (macOS 정상이지만 주의)`);

// ─── 결과 ───
console.log('\n═══ 정합성 검증 결과 ═══');
console.log(`에러: ${errors}건 | 경고: ${warnings}건`);
if (errors > 0) {
  console.error('\n⛔ FAIL — 에러 수정 후 다시 실행하세요.');
  process.exit(1);
} else {
  console.log('\n✅ ALL PASS');
  process.exit(0);
}
