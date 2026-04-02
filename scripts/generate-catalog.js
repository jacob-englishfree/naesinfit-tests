#!/usr/bin/env node
/**
 * generate-catalog.js — textbooks.ts + data/ 스캔 → test-catalog.json 자동 생성
 *
 * ⛔ test-catalog.json을 수동으로 편집하지 마세요!
 * ⛔ textbooks.ts가 유일한 진실 소스입니다.
 *
 * 동작:
 * 1. naesinfit-shared/textbooks.ts 파싱 (id, path, name, cat)
 * 2. data/ 디렉토리 스캔 (실제 존재하는 단원/섹션 탐지)
 * 3. textbooks.ts의 path ↔ data/ 폴더 교차 검증
 * 4. test-catalog.json 생성
 *
 * Usage: node scripts/generate-catalog.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const CATALOG_PATH = path.join(ROOT, 'test-catalog.json');

// ─── textbooks.ts 파싱 (TypeScript → JS eval 없이 정규식으로) ───
const SHARED_PATH = path.resolve(ROOT, '..', 'naesinfit-shared', 'src', 'constants', 'textbooks.ts');

function parseTextbooksTS() {
  const src = fs.readFileSync(SHARED_PATH, 'utf8');

  // TEXTBOOKS 배열 파싱
  const textbooks = [];
  const tbRe = /\{\s*id:"([^"]+)",\s*name:"([^"]+)",\s*cat:"([^"]+)",\s*pub:"([^"]+)",\s*author:"([^"]+)",\s*g:"([^"]+)"(?:,\s*path:"([^"]+)")?\s*\}/g;
  let m;
  while ((m = tbRe.exec(src)) !== null) {
    textbooks.push({ id: m[1], name: m[2], cat: m[3], pub: m[4], author: m[5], g: m[6], path: m[7] || null });
  }

  // MOCK_EXAMS 파싱
  const mocks = [];
  const mockRe = /\{\s*id:"([^"]+)",\s*label:"([^"]+)",\s*g:"([^"]+)"(?:,\s*path:"([^"]+)")?\s*\}/g;
  const mockSection = src.substring(src.indexOf('MOCK_EXAMS'));
  while ((m = mockRe.exec(mockSection)) !== null) {
    if (m[1].startsWith('모의-')) {
      mocks.push({ id: m[1], label: m[2], g: m[3], path: m[4] || null });
    }
  }

  // SUPPLEMENTS 파싱
  const supplements = [];
  const supRe = /\{\s*id:"([^"]+)",\s*label:"([^"]+)",\s*units:(\d+)(?:,\s*path:"([^"]+)")?\s*\}/g;
  const supSection = src.substring(src.indexOf('SUPPLEMENTS'));
  while ((m = supRe.exec(supSection)) !== null) {
    supplements.push({ id: m[1], label: m[2], units: parseInt(m[3]), path: m[4] || null });
  }

  return { textbooks, mocks, supplements };
}

// ─── data/ 디렉토리 스캔 ───
function scanDir(dir) {
  const result = {};
  if (!fs.existsSync(dir)) return result;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      const children = fs.readdirSync(full).filter(f =>
        fs.statSync(path.join(full, f)).isDirectory()
      ).sort();
      result[item] = children;
    }
  }
  return result;
}

function scanDeep(dir) {
  const result = {};
  if (!fs.existsSync(dir)) return result;
  for (const unit of fs.readdirSync(dir).sort()) {
    const unitPath = path.join(dir, unit);
    if (!fs.statSync(unitPath).isDirectory()) continue;
    const sections = fs.readdirSync(unitPath)
      .filter(f => fs.statSync(path.join(unitPath, f)).isDirectory())
      .sort();
    result[unit] = sections;
  }
  return result;
}

// ─── 메인 ───
function main() {
  console.log('=== generate-catalog.js ===\n');

  const { textbooks, mocks, supplements } = parseTextbooksTS();
  console.log(`textbooks.ts 파싱: 교과서 ${textbooks.length}개, 모의고사 ${mocks.length}개, 부교재 ${supplements.length}개\n`);

  const errors = [];
  const catalog = { '교과서': {}, '모의고사': {}, '부교재': {} };

  // ─── 교과서 ───
  for (const tb of textbooks) {
    if (!tb.path) continue; // path 없으면 아직 미제작
    const dirPath = path.join(DATA, '교과서', tb.path.normalize('NFC'));
    const exists = fs.existsSync(dirPath);

    if (!exists) {
      // 폴더가 없어도 카탈로그에는 등록 (테스트 미제작 상태)
      catalog['교과서'][tb.id] = {
        path: tb.path,
        cat: tb.cat,
        dn: `${tb.pub}(${tb.author})`,
        units: [],
        sections: {},
        _deployed: false,
      };
      continue;
    }

    // 실제 디렉토리 스캔 (NFC 정규화 적용)
    const unitDataRaw = scanDeep(dirPath);
    // NFD → NFC 정규화
    const unitData = {};
    for (const [k, v] of Object.entries(unitDataRaw)) {
      unitData[k.normalize('NFC')] = v.map(s => s.normalize('NFC'));
    }
    const units = Object.keys(unitData).filter(u => /^\d+과$/.test(u)).sort((a, b) =>
      parseInt(a) - parseInt(b)
    );
    const sections = {};
    for (const u of units) {
      if (unitData[u] && unitData[u].length > 0) {
        sections[u] = unitData[u];
      }
    }

    catalog['교과서'][tb.id] = {
      path: tb.path,
      cat: tb.cat,
      dn: `${tb.pub}(${tb.author})`,
      units,
      sections,
    };
  }

  // ─── 모의고사 ───
  // id 형식: 모의-YYYY-고N-M월 → catalog 키: 고N-YYYY-M월
  for (const mock of mocks) {
    const m = mock.id.match(/모의-(\d+)-(고\d)-(\d+월)/);
    if (!m) continue;
    const catalogKey = `${m[2]}-${m[1]}-${m[3]}`;

    if (!mock.path) {
      catalog['모의고사'][catalogKey] = { path: '', items: [], _deployed: false };
      continue;
    }

    const dirPath = path.join(DATA, '모의고사', mock.path.normalize('NFC'));
    if (!fs.existsSync(dirPath)) {
      catalog['모의고사'][catalogKey] = { path: mock.path, items: [], _deployed: false };
      continue;
    }

    const items = fs.readdirSync(dirPath)
      .filter(f => fs.statSync(path.join(dirPath, f)).isDirectory())
      .map(f => f.normalize('NFC'))
      .sort((a, b) => {
        const na = parseInt(a) || 99;
        const nb = parseInt(b) || 99;
        return na - nb;
      });

    catalog['모의고사'][catalogKey] = { path: mock.path, items };
  }

  // ─── 부교재 ───
  for (const sup of supplements) {
    if (!sup.path) continue;
    const dirPath = path.join(DATA, '부교재', sup.path.normalize('NFC'));
    if (!fs.existsSync(dirPath)) {
      catalog['부교재'][sup.id] = { path: sup.path, units: [], sections: {}, _deployed: false };
      continue;
    }

    const unitDataRaw2 = scanDeep(dirPath);
    const unitData2 = {};
    for (const [k, v] of Object.entries(unitDataRaw2)) {
      unitData2[k.normalize('NFC')] = v.map(s => s.normalize('NFC'));
    }
    const units = Object.keys(unitData2).sort((a, b) => {
      const na = parseInt(a) || 99;
      const nb = parseInt(b) || 99;
      return na - nb;
    });
    const sections = {};
    for (const u of units) {
      if (unitData2[u] && unitData2[u].length > 0) {
        sections[u] = unitData2[u];
      }
    }

    catalog['부교재'][sup.id] = { path: sup.path, units, sections };
  }

  // ─── 검증: data/ 폴더에 있는데 textbooks.ts에 없는 것 ───
  const tbPaths = new Set(textbooks.filter(t => t.path).map(t => t.path.normalize('NFC')));
  const actualTbDirs = [];
  const tbBase = path.join(DATA, '교과서');
  if (fs.existsSync(tbBase)) {
    for (const cat of fs.readdirSync(tbBase)) {
      const catPath = path.join(tbBase, cat);
      if (!fs.statSync(catPath).isDirectory()) continue;
      for (const pub of fs.readdirSync(catPath)) {
        if (!fs.statSync(path.join(catPath, pub)).isDirectory()) continue;
        const relPath = `${cat}/${pub}`.normalize('NFC');
        actualTbDirs.push(relPath);
        if (!tbPaths.has(relPath)) {
          errors.push(`⚠️  data/교과서/${relPath} 폴더 존재하지만 textbooks.ts에 없음`);
        }
      }
    }
  }

  // ─── 저장 ───
  // _deployed 제거 (내부용)
  const clean = JSON.parse(JSON.stringify(catalog));
  for (const type of Object.keys(clean)) {
    for (const key of Object.keys(clean[type])) {
      delete clean[type][key]._deployed;
    }
  }

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(clean, null, 2) + '\n', 'utf8');

  // ─── 결과 ───
  const tbCount = Object.keys(catalog['교과서']).length;
  const tbDeployed = Object.values(catalog['교과서']).filter(v => v.units.length > 0).length;
  const mockCount = Object.keys(catalog['모의고사']).length;
  const mockDeployed = Object.values(catalog['모의고사']).filter(v => v.items.length > 0).length;
  const supCount = Object.keys(catalog['부교재']).length;
  const supDeployed = Object.values(catalog['부교재']).filter(v => v.units && v.units.length > 0).length;

  console.log('✅ test-catalog.json 생성 완료');
  console.log(`   교과서: ${tbDeployed}/${tbCount} 배포됨`);
  console.log(`   모의고사: ${mockDeployed}/${mockCount} 배포됨`);
  console.log(`   부교재: ${supDeployed}/${supCount} 배포됨`);

  if (errors.length > 0) {
    console.log('\n⚠️  경고:');
    errors.forEach(e => console.log('  ' + e));
  }

  console.log('\n→ node scripts/sync-catalog.js 실행하여 test-deploy.ts 갱신');
}

main();
