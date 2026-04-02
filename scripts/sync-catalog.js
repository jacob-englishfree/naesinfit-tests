#!/usr/bin/env node
/**
 * test-catalog.json → shared/constants/test-deploy.ts 자동 생성
 *
 * 사용법: node scripts/sync-catalog.js
 *
 * test-catalog.json이 단일 진실 소스.
 * 이 스크립트가 test-deploy.ts의 DEPLOY 상수들을 자동으로 덮어씀.
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'test-catalog.json');
const DEPLOY_PATH = path.join(__dirname, '..', '..', 'naesinfit-shared', 'src', 'constants', 'test-deploy.ts');

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

// ─── 키 정합성 검증: textbooks.ts의 id가 단일 진실 소스 ───
// textbooks.ts에서 id 목록 추출 (정적 리스트 — textbooks.ts 변경 시 여기도 갱신)
const TEXTBOOK_IDS = [
  'C1-능률민','C1-미래','C1-능률오','C1-YBM김','C1-YBM박','C1-동아','C1-비상','C1-지학사','C1-천재강','C1-천재조',
  'C2-능률민','C2-능률오','C2-YBM김','C2-YBM박','C2-동아','C2-미래','C2-비상','C2-지학사','C2-천재강','C2-천재조',
  'E1-능률','E1-YBM','E1-동아','E1-미래','E1-비상','E1-지학사','E1-천재강','E1-천재조','E1-YBM한',
  'E2-능률','E2-YBM','E2-YBM한','E2-동아','E2-미래','E2-비상','E2-지학사','E2-천재강','E2-천재조',
  'M2-YBM김은형',
];
const tbIdSet = new Set(TEXTBOOK_IDS);
const catalogKeys = Object.keys(catalog['교과서'] || {});
const errors = [];

// 카탈로그에 있는데 textbooks.ts에 없는 키 → 키 불일치
for (const k of catalogKeys) {
  if (!tbIdSet.has(k)) {
    errors.push(`⛔ 카탈로그 키 "${k}"가 textbooks.ts에 없음! 학생 DB와 매칭 불가.`);
  }
}

if (errors.length > 0) {
  console.error('=== 키 정합성 검증 FAIL ===');
  errors.forEach(e => console.error(e));
  console.error('\n→ test-catalog.json의 키를 textbooks.ts의 id에 맞춰주세요.');
  console.error('→ textbooks.ts 위치: app/src/shared/constants/textbooks.ts');
  process.exit(1);
}
console.log('✅ 키 정합성 검증 PASS — 카탈로그 키가 textbooks.ts와 일치');

// ─── TEST_APP_DEPLOY (교과서) ───
const textbooks = catalog['교과서'] || {};
const deployEntries = Object.entries(textbooks).map(([id, info]) => {
  let entry = `  "${id}": { path: "${info.path}", units: ${JSON.stringify(info.units)}`;
  if (info.sections) {
    const secStr = Object.entries(info.sections)
      .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
      .join(', ');
    entry += `, sections: { ${secStr} }`;
  }
  entry += ' },';
  return entry;
}).join('\n');

// ─── TEST_APP_SUPPLEMENT_DEPLOY (부교재) ───
const supplements = catalog['부교재'] || {};
const supEntries = Object.entries(supplements).map(([id, info]) => {
  let entry = `  "${id}": { path: "${info.path}", units: ${JSON.stringify(info.units)}`;
  if (info.sections) {
    const secStr = Object.entries(info.sections)
      .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
      .join(', ');
    entry += `, sections: { ${secStr} }`;
  }
  entry += ' },';
  return entry;
}).join('\n');

// ─── TEST_APP_MOCK_DEPLOY (모의고사) ───
const mocks = catalog['모의고사'] || {};
const mockEntries = Object.entries(mocks).map(([id, info]) => {
  return `  "${id}": { path: "${info.path}", items: ${JSON.stringify(info.items)} },`;
}).join('\n');

// ─── CONTENT_NAMES ───
const nameEntries = Object.entries(textbooks).map(([id, info]) => {
  const cat = info.cat || '';
  const dn = info.dn || '';
  return `  "${id}": "${cat} ${dn}",`;
}).join('\n');

// ─── 출력 ───
const output = `/**
 * 테스트 앱 배포 매핑
 * ⛔ 이 파일을 직접 수정하지 마세요!
 * ⛔ test-catalog.json을 수정한 후 node scripts/sync-catalog.js 실행
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
${nameEntries}
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

fs.writeFileSync(DEPLOY_PATH, output, 'utf8');
console.log('✅ test-deploy.ts 자동 생성 완료');
console.log('   교과서:', Object.keys(textbooks).length, '개');
console.log('   부교재:', Object.keys(supplements).length, '개');
console.log('   모의고사:', Object.keys(mocks).length, '개');
console.log('');
console.log('→ naesinfit-shared/sync.sh 실행하여 양쪽 앱에 반영하세요');
