#!/usr/bin/env node
/**
 * sync-test-deploy.js — data/ 폴더를 스캔해서 test-deploy.ts 자동 생성
 *
 * 실행: node scripts/sync-test-deploy.js
 * 결과: ../내신핏v21/app/src/shared/constants/test-deploy.ts 덮어쓰기
 *
 * ⛔ test-deploy.ts를 수동으로 수정하지 마세요. 이 스크립트로만 관리합니다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const APP_DEPLOY = path.join(ROOT, '..', '내신핏v21', 'app', 'src', 'shared', 'constants', 'test-deploy.ts');

// ── 교과서 ID 매핑 (폴더명 → deploy key) ──
const TEXTBOOK_MAP = {
  '공통영어1/YBM김은형': 'C1-YBM김',
  '공통영어1/YBM박준언': 'C1-YBM박',
  '공통영어1/능률민병천': 'C1-능률민',
  '공통영어1/능률오선영': 'C1-능률오',
  '공통영어1/동아이병민': 'C1-동아',
  '공통영어1/미래엔김성연': 'C1-미래',
  '공통영어1/비상홍': 'C1-비상',
  '공통영어1/지학사신상근': 'C1-지학사',
  '공통영어1/천재강상구': 'C1-천재강',
  '공통영어1/천재조수경': 'C1-천재조',
  '영어1/YBM박준언': 'E1-YBM',
  '영어1/능률오선영': 'E1-능률',
  '영어1/동아박용예': 'E1-동아',
  '영어1/미래엔김성연': 'E1-미래',
  '영어1/비상홍': 'E1-비상',
  '영어1/지학사신상근': 'E1-지학사',
  '영어1/천재강상구': 'E1-천재강',
  '영어1/천재조수경': 'E1-천재조',
  '영어1/YBM한상호': 'E1-YBM한',
  '영어2/YBM한상호': 'E2-YBM한',
  '중2/YBM김은형': 'M2-YBM김은형',
};

// ── 부교재 ID 매핑 ──
const SUPPLEMENT_MAP = {
  '수능특강/영어': '수능특강영어2027',
  '수능특강Light/영어': '수능특강Light영어2026',
};

// ── 모의고사 폴더 → deploy key 매핑 ──
const MOCK_YEAR_MAP = {
  '3월': '2025-3월',
  '3월_2024': '2024-3월',
  '3월_2025': '2025-3월b',
  '3월_2026': '2026-3월',
  '6월': '2025-6월',
  '9월': '2025-9월',
};

function scanDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  } catch { return []; }
}

function hasJson(dir) {
  try {
    return fs.readdirSync(dir).some(f => f.endsWith('.json'));
  } catch { return false; }
}

// ── 교과서 스캔 ──
function scanTextbooks() {
  const result = {};
  const textbookDir = path.join(DATA, '교과서');

  for (const [folderPath, deployKey] of Object.entries(TEXTBOOK_MAP)) {
    const pubDir = path.join(textbookDir, folderPath);
    if (!fs.existsSync(pubDir)) continue;

    const units = scanDir(pubDir);
    if (units.length === 0) continue;

    const sections = {};
    let hasSections = false;

    for (const unit of units) {
      const unitDir = path.join(pubDir, unit);
      const subs = scanDir(unitDir);
      const subWithJson = subs.filter(s => hasJson(path.join(unitDir, s)));

      if (subWithJson.length > 0) {
        // 본문을 항상 먼저 배치
        const sorted = subWithJson.sort((a, b) => {
          if (a === '본문') return -1;
          if (b === '본문') return 1;
          return a.localeCompare(b);
        });
        // 본문이 맨 뒤로 가야 하는 경우는 없음 — 항상 본문 우선
        // 실제로는 본문이 먼저, 추가지문이 나중
        const reordered = [];
        const bonmun = sorted.filter(s => s === '본문');
        const others = sorted.filter(s => s !== '본문');
        reordered.push(...bonmun, ...others);

        sections[unit] = reordered;
        hasSections = true;
      }
    }

    result[deployKey] = {
      path: folderPath,
      units,
      ...(hasSections ? { sections } : {}),
    };
  }

  return result;
}

// ── 부교재 스캔 ──
function scanSupplements() {
  const result = {};
  const suppDir = path.join(DATA, '부교재');

  for (const [folderPath, deployKey] of Object.entries(SUPPLEMENT_MAP)) {
    const bookDir = path.join(suppDir, folderPath);
    if (!fs.existsSync(bookDir)) continue;

    const units = scanDir(bookDir);
    if (units.length === 0) continue;

    const sections = {};
    let hasSections = false;

    for (const unit of units) {
      const unitDir = path.join(bookDir, unit);
      const subs = scanDir(unitDir);
      const subWithJson = subs.filter(s => hasJson(path.join(unitDir, s)));

      if (subWithJson.length > 0) {
        sections[unit] = subWithJson;
        hasSections = true;
      }
    }

    result[deployKey] = {
      path: folderPath,
      units,
      ...(hasSections ? { sections } : {}),
    };
  }

  return result;
}

// ── 모의고사 스캔 ──
function scanMocks() {
  const result = {};
  const mockDir = path.join(DATA, '모의고사');

  for (const grade of scanDir(mockDir)) {
    const gradeDir = path.join(mockDir, grade);

    for (const exam of scanDir(gradeDir)) {
      const examDir = path.join(gradeDir, exam);
      const items = scanDir(examDir).filter(item => hasJson(path.join(examDir, item)));

      if (items.length === 0) continue;

      const yearKey = MOCK_YEAR_MAP[exam];
      if (!yearKey) {
        console.warn(`⚠️ 모의고사 매핑 없음: ${grade}/${exam}`);
        continue;
      }

      const deployKey = `${grade}-${yearKey}`;
      result[deployKey] = {
        path: `${grade}/${exam}`,
        items,
      };
    }
  }

  return result;
}

// ── TypeScript 생성 ──
function generateTS(textbooks, supplements, mocks) {
  const jsonStr = (obj) => JSON.stringify(obj);

  let ts = `/**
 * 테스트 앱 배포 매핑
 * ⛔ 이 파일을 직접 수정하지 마세요!
 * ⛔ node scripts/sync-test-deploy.js 로 자동 생성됩니다.
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

export const TEST_APP_DEPLOY: Record<string, TextbookDeploy> = {\n`;

  for (const [key, val] of Object.entries(textbooks)) {
    ts += `  ${jsonStr(key)}: ${jsonStr(val)},\n`;
  }
  ts += `};\n\n`;

  ts += `export const TEST_APP_SUPPLEMENT_DEPLOY: Record<string, { path: string; units: string[]; sections?: Record<string, string[]> }> = {\n`;
  for (const [key, val] of Object.entries(supplements)) {
    ts += `  ${jsonStr(key)}: ${jsonStr(val)},\n`;
  }
  ts += `};\n\n`;

  ts += `export const TEST_APP_MOCK_DEPLOY: Record<string, { path: string; items: string[] }> = {\n`;
  for (const [key, val] of Object.entries(mocks)) {
    ts += `  ${jsonStr(key)}: ${jsonStr(val)},\n`;
  }
  ts += `};\n\n`;

  // 기존 ASSET_LABELS, TEST_LABELS 유지
  ts += `export const ASSET_LABELS: Record<string, string> = {
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

export const TEXTBOOK_LABELS: Record<string, string> = {\n`;

  // 교과서 라벨 자동 생성
  const labelMap = {
    'C1': '공통영어1', 'E1': '영어1', 'E2': '영어2', 'M2': '중2영어',
  };
  for (const [key, val] of Object.entries(textbooks)) {
    const prefix = key.split('-')[0];
    const pubName = val.path.split('/')[1];
    const label = `${labelMap[prefix] || prefix} ${pubName.replace(/[a-zA-Z]+/g, (m) => m)}`;
    ts += `  ${jsonStr(key)}: ${jsonStr(label)},\n`;
  }
  ts += `};\n\n`;

  // CONTENT_NAMES (괄호 포함 라벨)
  const contentLabelMap = {
    'C1': '공통영어1', 'E1': '영어1', 'E2': '영어2', 'M2': '중2',
  };
  ts += `export const CONTENT_NAMES: Record<string, string> = {\n`;
  for (const [key, val] of Object.entries(textbooks)) {
    const prefix = key.split('-')[0];
    const pubName = val.path.split('/')[1];
    // 출판사명에서 영문+한글 분리: "YBM박준언" → "YBM(박준언)", "능률오선영" → "능률(오선영)"
    const pubFormatted = pubName.replace(/^([a-zA-Z]+)(.+)$/, '$1($2)').replace(/^([가-힣]{2})(.+)$/, '$1($2)');
    ts += `  ${jsonStr(key)}: ${jsonStr(`${contentLabelMap[prefix] || prefix} ${pubFormatted}`)},\n`;
  }
  ts += `};\n\n`;

  // DESIGN_TOKENS (고정값)
  ts += `export const DESIGN_TOKENS = {
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
};\n`;

  return ts;
}

function main() {
  console.log('📦 data/ 스캔 중...');

  const textbooks = scanTextbooks();
  const supplements = scanSupplements();
  const mocks = scanMocks();

  console.log(`  교과서: ${Object.keys(textbooks).length}종`);
  console.log(`  부교재: ${Object.keys(supplements).length}종`);
  console.log(`  모의고사: ${Object.keys(mocks).length}개 시험`);

  const ts = generateTS(textbooks, supplements, mocks);

  if (fs.existsSync(APP_DEPLOY)) {
    fs.writeFileSync(APP_DEPLOY, ts, 'utf8');
    console.log(`\n✅ 동기화 완료: ${path.relative(ROOT, APP_DEPLOY)}`);
  } else {
    console.error(`❌ 앱 경로 없음: ${APP_DEPLOY}`);
    // 로컬에도 저장
    const localPath = path.join(ROOT, 'test-deploy.ts');
    fs.writeFileSync(localPath, ts, 'utf8');
    console.log(`  로컬 저장: ${localPath}`);
  }

  // 변경 요약
  console.log('\n--- 변경 요약 ---');
  for (const [key, val] of Object.entries(textbooks)) {
    const secCount = val.sections ? Object.values(val.sections).flat().length : 0;
    console.log(`  ${key}: ${val.units.length}과 ${secCount > 0 ? `(${secCount} sections)` : '(sections 없음)'}`);
  }
}

module.exports = { scanTextbooks, scanSupplements, scanMocks };
if (require.main === module) main();

// ── Push 후 검증: sections가 제대로 반영됐는지 확인 ──
function verify() {
  if (!fs.existsSync(APP_DEPLOY)) {
    console.error('❌ test-deploy.ts 없음');
    return false;
  }
  const content = fs.readFileSync(APP_DEPLOY, 'utf8');
  const textbooks = scanTextbooks();
  let ok = true;
  
  for (const [key, val] of Object.entries(textbooks)) {
    if (val.sections) {
      for (const [unit, secs] of Object.entries(val.sections)) {
        // 본문이 첫 번째인지 확인
        if (secs[0] !== '본문') {
          console.error(`❌ ${key} ${unit}: 본문이 첫 번째가 아님 (${secs[0]})`);
          ok = false;
        }
        // sections가 파일에 포함되어 있는지 확인
        for (const sec of secs) {
          if (!content.includes(sec)) {
            console.error(`❌ ${key} ${unit} "${sec}" — test-deploy.ts에 없음`);
            ok = false;
          }
        }
      }
    }
  }
  
  if (ok) console.log('✅ 검증 통과: 모든 sections 정상 반영');
  return ok;
}

if (process.argv.includes('--verify')) {
  process.exit(verify() ? 0 : 1);
}
