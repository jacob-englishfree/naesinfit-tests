#!/usr/bin/env node
/**
 * sync-all.js — 통합 sync 스크립트
 *
 * ✅ 이전의 sync-catalog.js + sync-test-deploy.js를 완전 대체
 * ✅ NFC 정규화 강제 (macOS NFD 버그 영구 차단)
 * ✅ 두 곳 동시 쓰기: naesinfit-shared + 내신핏v21/app (sync.sh 실패 보험)
 * ✅ NFC 검증: NFD 문자 감지 시 즉시 에러 + 배포 차단
 * ✅ sync.sh 자동 실행
 *
 * 실행: node scripts/sync-all.js
 *   또는: npm run sync
 *
 * 단일 진실 소스: test-catalog.json
 * ⛔ test-deploy.ts를 직접 수정하지 마세요!
 * ⛔ sync-catalog.js, sync-test-deploy.js를 단독으로 실행하지 마세요!
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'test-catalog.json');

// 출력 대상 두 곳
const SHARED_DEPLOY = path.join(ROOT, '..', 'naesinfit-shared', 'src', 'constants', 'test-deploy.ts');
const APP_DEPLOY    = path.join(ROOT, '..', '내신핏v21', 'app', 'src', 'shared', 'constants', 'test-deploy.ts');
const SYNC_SH       = path.join(ROOT, '..', 'naesinfit-shared', 'sync.sh');

// ── textbooks.ts ID 정합성 검증용 화이트리스트 ──
const TEXTBOOK_IDS = new Set([
  'C1-능률민','C1-미래','C1-능률오','C1-YBM김','C1-YBM박','C1-동아','C1-비상','C1-지학사','C1-천재강','C1-천재조',
  'C2-능률민','C2-능률오','C2-YBM김','C2-YBM박','C2-동아','C2-미래','C2-비상','C2-지학사','C2-천재강','C2-천재조',
  'E1-능률','E1-YBM','E1-동아','E1-미래','E1-비상','E1-지학사','E1-천재강','E1-천재조','E1-YBM한',
  'E2-능률','E2-YBM','E2-YBM한','E2-동아','E2-미래','E2-비상','E2-지학사','E2-천재강','E2-천재조',
  'M2-YBM김은형',
  'M3-미래엔최',
]);

// ── NFC 유틸 ──
function nfc(s) {
  if (typeof s === 'string') return s.normalize('NFC');
  return s;
}

function nfcDeep(obj) {
  if (Array.isArray(obj)) return obj.map(nfcDeep);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[nfc(k)] = nfcDeep(v);
    }
    return out;
  }
  return nfc(obj);
}

// ── NFD 감지 ──
function hasNFD(str) {
  // NFD는 자음/모음이 분리된 코드포인트가 나타남 (U+1100~U+11FF, U+302E~U+302F 등)
  // 간단 검증: NFC로 변환했을 때 길이가 달라지면 NFD 문자 포함
  return str.normalize('NFC').length !== str.length ||
         str !== str.normalize('NFC');
}

function validateNFC(content, label) {
  const lines = content.split('\n');
  const nfdLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (hasNFD(lines[i])) {
      nfdLines.push(`  line ${i + 1}: ${JSON.stringify(lines[i])}`);
    }
  }
  if (nfdLines.length > 0) {
    console.error(`\n⛔ NFC 검증 FAIL: ${label} 에 NFD 문자가 있습니다!`);
    console.error('  NFD 문자가 있으면 테스트 버튼이 전부 사라지는 사고가 발생합니다.');
    nfdLines.forEach(l => console.error(l));
    console.error('\n→ test-catalog.json에서 해당 문자열을 수정하거나,');
    console.error('  한국어 문자를 macOS에서 복붙할 때 NFD가 섞입니다.');
    process.exit(1);
  }
  console.log(`  ✅ NFC 검증 PASS: ${label}`);
}

// ── 카탈로그 읽기 + NFC 정규화 ──
function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`❌ test-catalog.json 없음: ${CATALOG_PATH}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  return nfcDeep(raw);
}

// ── 키 정합성 검증 ──
function validateKeys(catalog) {
  const textbooks = catalog['교과서'] || {};
  const errors = [];
  for (const k of Object.keys(textbooks)) {
    if (!TEXTBOOK_IDS.has(k)) {
      errors.push(`⛔ 카탈로그 키 "${k}"가 textbooks.ts에 없음! 학생 DB와 매칭 불가.`);
    }
  }
  if (errors.length > 0) {
    console.error('\n=== 키 정합성 검증 FAIL ===');
    errors.forEach(e => console.error(e));
    console.error('\n→ test-catalog.json의 키를 textbooks.ts의 id에 맞춰주세요.');
    process.exit(1);
  }
  console.log('  ✅ 키 정합성 검증 PASS');
}

// ── TypeScript 생성 ──
function generateTS(catalog) {
  const textbooks   = catalog['교과서']  || {};
  const supplements = catalog['부교재']  || {};
  const mocks       = catalog['모의고사'] || {};

  const j = (v) => JSON.stringify(v);

  // TEST_APP_DEPLOY
  const deployEntries = Object.entries(textbooks).map(([id, info]) => {
    let e = `  ${j(id)}: { path: ${j(info.path)}, units: ${j(info.units || [])}`;
    if (info.sections && Object.keys(info.sections).length > 0) {
      const secStr = Object.entries(info.sections)
        .map(([k, v]) => `${j(k)}: ${j(v)}`)
        .join(', ');
      e += `, sections: { ${secStr} }`;
    }
    e += ' },';
    return e;
  }).join('\n');

  // TEST_APP_SUPPLEMENT_DEPLOY
  const supEntries = Object.entries(supplements).map(([id, info]) => {
    let e = `  ${j(id)}: { path: ${j(info.path)}, units: ${j(info.units || [])}`;
    if (info.sections && Object.keys(info.sections).length > 0) {
      const secStr = Object.entries(info.sections)
        .map(([k, v]) => `${j(k)}: ${j(v)}`)
        .join(', ');
      e += `, sections: { ${secStr} }`;
    }
    e += ' },';
    return e;
  }).join('\n');

  // TEST_APP_MOCK_DEPLOY
  const mockEntries = Object.entries(mocks).map(([id, info]) => {
    return `  ${j(id)}: { path: ${j(info.path)}, items: ${j(info.items || [])} },`;
  }).join('\n');

  // CONTENT_NAMES (cat + dn)
  const contentNameEntries = Object.entries(textbooks).map(([id, info]) => {
    const cat = info.cat || '';
    const dn  = info.dn  || '';
    return `  ${j(id)}: ${j(`${cat} ${dn}`.trim())},`;
  }).join('\n');

  const ts = `/**
 * 테스트 앱 배포 매핑
 * ⛔ 이 파일을 직접 수정하지 마세요!
 * ⛔ test-catalog.json을 수정한 후 npm run sync 실행
 * ⛔ 마지막 동기화: ${new Date().toISOString().slice(0, 10)}
 */

export const TEST_APP_BASE = "https://naesinfit-tests.vercel.app/교과서";
export const TEST_APP_SUPPLEMENT_BASE = "https://naesinfit-tests.vercel.app/부교재";
export const TEST_APP_MOCK_BASE = "https://naesinfit-tests.vercel.app/모의고사";

export interface TextbookDeploy {
  path: string;
  units: string[];
  sections?: Record<string, string[]>;
}

export const TEST_APP_DEPLOY: Record<string, TextbookDeploy> = {
${deployEntries}
};

export const TEST_APP_SUPPLEMENT_DEPLOY: Record<string, { path: string; units: string[]; sections?: Record<string, string[]> }> = {
${supEntries}
};

export const TEST_APP_MOCK_DEPLOY: Record<string, { path: string; items: string[] }> = {
${mockEntries}
};

export const ASSET_LABELS: Record<string, string> = {
  lecture: "강의",
  main: "주교재",
  vocab: "단어",
  workbook: "워크북",
  quiz: "퀴즈",
};

export const TEST_LABELS: Record<string, string> = {
  vocab: "단어", workbook: "워크북", quiz: "퀴즈",
  noshow: "불참", homework: "숙제",
};

export const CONTENT_NAMES: Record<string, string> = {
${contentNameEntries}
};

export const DESIGN_TOKENS = {
  P: {
    bg: "#F2F4F6", bg2: "#FFFFFF", bg3: "#F7F8FA",
    tx: "#191F28", tx2: "#4E5968", tx3: "#6B7684", tx4: "#8B95A1",
    bd: "#E5E8EB",
    ac: "#7C3AED", acL: "#F3EEFF", neon: "#00F5A0", neonL: "#E6FFF5",
    ok: "#00C471", okB: "#E8FAF0",
    err: "#FF4545", errB: "#FFEBEB",
    warn: "#FF9F43", warnB: "#FFF4E6",
    info: "#6C5CE7", infoB: "#F0EEFF",
    pink: "#E91E8C", pinkB: "#FFF0F8",
  },
  T: { display: 28, title1: 22, title2: 17, body1: 15, body2: 14, caption1: 13, caption2: 12 },
  R: { lg: 16, md: 12, sm: 8, xs: 4 },
  S: { lg: 24, md: 16, sm: 12, xs: 8 },
};
`;

  return ts;
}

// ── 메인 ──
function main() {
  console.log('🔄 npm run sync 시작...\n');

  // 1. 카탈로그 로드 (NFC 자동 적용)
  console.log('① test-catalog.json 로드 + NFC 정규화...');
  const catalog = loadCatalog();
  const tb   = Object.keys(catalog['교과서']  || {}).length;
  const sup  = Object.keys(catalog['부교재']  || {}).length;
  const mock = Object.keys(catalog['모의고사'] || {}).length;
  console.log(`   교과서 ${tb}종 / 부교재 ${sup}종 / 모의고사 ${mock}개`);

  // 2. 키 정합성 검증
  console.log('\n② 키 정합성 검증...');
  validateKeys(catalog);

  // 3. TypeScript 생성
  console.log('\n③ TypeScript 생성...');
  const ts = generateTS(catalog);

  // 4. NFC 검증 (생성 결과)
  console.log('\n④ NFC 검증...');
  validateNFC(ts, 'test-deploy.ts');

  // 5. naesinfit-shared에 쓰기
  console.log('\n⑤ naesinfit-shared/src/constants/test-deploy.ts 갱신...');
  if (fs.existsSync(SHARED_DEPLOY)) {
    fs.writeFileSync(SHARED_DEPLOY, ts, 'utf8');
    console.log('  ✅ 완료');
  } else {
    console.warn(`  ⚠️ shared 경로 없음: ${SHARED_DEPLOY}`);
  }

  // 6. 앱에 직접 쓰기 (sync.sh 실패 보험)
  console.log('\n⑥ 내신핏v21/app/src/shared/constants/test-deploy.ts 직접 갱신...');
  if (fs.existsSync(APP_DEPLOY)) {
    fs.writeFileSync(APP_DEPLOY, ts, 'utf8');
    console.log('  ✅ 완료');
  } else {
    console.warn(`  ⚠️ 앱 경로 없음: ${APP_DEPLOY}`);
  }

  // 7. sync.sh 실행 (shared → 양쪽 앱 동기화)
  console.log('\n⑦ sync.sh 실행 (shared → ehg-academy + 내신핏v21)...');
  if (fs.existsSync(SYNC_SH)) {
    try {
      const result = execSync(`bash "${SYNC_SH}"`, { encoding: 'utf8', stdio: 'pipe' });
      console.log(result.trim().split('\n').map(l => `  ${l}`).join('\n'));
    } catch (e) {
      console.warn('  ⚠️ sync.sh 실패 (앱 직접 쓰기로 보완됨):', e.message);
    }
  } else {
    console.warn('  ⚠️ sync.sh 없음 — 앱 직접 쓰기만 적용됨');
  }

  // 8. 요약
  console.log('\n══════════════════════════════════════════');
  console.log('✅ npm run sync 완료');
  console.log(`   교과서 ${tb}종 / 부교재 ${sup}종 / 모의고사 ${mock}개`);
  console.log('   NFC 검증 PASS — NFD 버그 없음');
  console.log('   다음 단계: git add + git commit + git push');
  console.log('══════════════════════════════════════════\n');
}

main();
