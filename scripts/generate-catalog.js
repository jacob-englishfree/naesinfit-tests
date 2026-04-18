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

// ─── 차단 목록 (validate FAIL 파일) ───
// _blocked_files.txt: 한 줄에 하나씩 'data/...json' 형식
// section/item 안에 어떤 type(단어/워크북/퀴즈)이라도 차단되면 그 section/item 전체를 카탈로그에서 제외 → 학생에게 노출 안 됨
const BLOCKED_PATH = path.join(ROOT, '_blocked_files.txt');
const BLOCKED_TB_SECTIONS = new Set(); // "공통영어1/비상홍/1과/본문" (교과서)
const BLOCKED_MOCK_ITEMS = new Set();  // "고1/2025/3월/18번"
const BLOCKED_SUP_SECTIONS = new Set(); // "수능특강/영어/1강/본문"
function loadBlockedList() {
  if (!fs.existsSync(BLOCKED_PATH)) {
    console.log('(차단 목록 없음: _blocked_files.txt)');
    return;
  }
  const lines = fs.readFileSync(BLOCKED_PATH, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const rel = line.replace(/^data[\/\\]/, '').normalize('NFC');
    const parts = rel.split('/');
    if (parts.length < 5) continue;
    const fileName = parts[parts.length - 1];
    if (!['단어.json', '워크북.json', '퀴즈.json'].includes(fileName)) continue;
    const source = parts[0];
    const sectionKey = parts.slice(1, -1).join('/'); // source 제외
    if (source === '교과서') BLOCKED_TB_SECTIONS.add(sectionKey);
    else if (source === '부교재') BLOCKED_SUP_SECTIONS.add(sectionKey);
    else if (source === '모의고사') BLOCKED_MOCK_ITEMS.add(sectionKey);
  }
  console.log(`🚫 차단: ${lines.length}파일 → 교과서 section ${BLOCKED_TB_SECTIONS.size}개 / 모의고사 item ${BLOCKED_MOCK_ITEMS.size}개 / 부교재 section ${BLOCKED_SUP_SECTIONS.size}개 제외`);
}

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
    if (item.startsWith('_')) continue;
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      const children = fs.readdirSync(full).filter(f =>
        !f.startsWith('_') && fs.statSync(path.join(full, f)).isDirectory()
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
    if (unit.startsWith('_')) continue; // _passages 등 내부 폴더 제외
    const unitPath = path.join(dir, unit);
    if (!fs.statSync(unitPath).isDirectory()) continue;
    const sections = fs.readdirSync(unitPath)
      .filter(f => !f.startsWith('_') && fs.statSync(path.join(unitPath, f)).isDirectory())
      .sort();
    result[unit] = sections;
  }
  return result;
}

// ─── 메인 ───
function main() {
  console.log('=== generate-catalog.js ===\n');
  loadBlockedList();

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
        const kept = unitData[u].filter(s => {
          const key = `${tb.path.normalize('NFC')}/${u}/${s}`.normalize('NFC');
          return !BLOCKED_TB_SECTIONS.has(key);
        });
        if (kept.length > 0) sections[u] = kept;
      }
    }
    const filteredUnits = units.filter(u => sections[u] && sections[u].length > 0);

    catalog['교과서'][tb.id] = {
      path: tb.path,
      cat: tb.cat,
      dn: `${tb.pub}(${tb.author})`,
      units: filteredUnits,
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
      // textbooks.ts에 path 없어도 data/ 폴더에 실제 데이터가 있으면 자동 탐지
      // catalogKey = "고1-2025-3월" → 가능한 폴더: "고1/3월_2025", "고1/3월"
      const grade = m[2]; // 고1
      const month = m[3]; // 3월
      const year = m[1]; // 2025
      const candidates = [`${grade}/${month}_${year}`, `${grade}/${month}`];
      let foundPath = null;
      for (const c of candidates) {
        const cp = path.join(DATA, '모의고사', c.normalize('NFC'));
        if (fs.existsSync(cp) && fs.readdirSync(cp).some(f => !f.startsWith('_') && fs.statSync(path.join(cp, f)).isDirectory())) {
          foundPath = c;
          break;
        }
      }
      if (!foundPath) {
        catalog['모의고사'][catalogKey] = { path: '', items: [], _deployed: false };
        continue;
      }
      // path를 찾았으면 아래 로직으로 진행
      mock.path = foundPath;
      console.log(`  📁 ${catalogKey}: textbooks.ts에 path 없음 → data/${foundPath} 자동 탐지`);
    }

    const dirPath = path.join(DATA, '모의고사', mock.path.normalize('NFC'));
    if (!fs.existsSync(dirPath)) {
      catalog['모의고사'][catalogKey] = { path: mock.path, items: [], _deployed: false };
      continue;
    }

    const items = fs.readdirSync(dirPath)
      .filter(f => !f.startsWith('_') && fs.statSync(path.join(dirPath, f)).isDirectory())
      .map(f => f.normalize('NFC'))
      .filter(f => {
        // mock.path = "고1/2025/3월", item = "18번" → key = "고1/2025/3월/18번"
        const key = `${mock.path.normalize('NFC')}/${f}`;
        return !BLOCKED_MOCK_ITEMS.has(key);
      })
      .sort((a, b) => {
        const na = parseInt(a) || 99;
        const nb = parseInt(b) || 99;
        return na - nb;
      });

    // ── 폴더 내 실제 년도 검증: id의 년도 vs 데이터의 년도 ──
    const expectedYear = m[1]; // textbooks.ts id에서 추출한 년도
    let actualYear = null;
    for (const item of items.slice(0, 3)) {
      for (const t of ['단어.json', '워크북.json', '퀴즈.json']) {
        const f = path.join(dirPath, item, t);
        if (!fs.existsSync(f)) continue;
        try {
          const raw = fs.readFileSync(f, 'utf8');
          const hk = raw.match(/histKey["']?\s*:\s*["']([^"']+)/);
          if (hk) { const ym = hk[1].match(/(20\d\d)/); if (ym) { actualYear = ym[1]; break; } }
          const subj = raw.match(/subject["']?\s*:\s*["']([^"']+)/);
          if (subj) { const ym = subj[1].match(/(20\d\d)/); if (ym) { actualYear = ym[1]; break; } }
        } catch (e) {}
      }
      if (actualYear) break;
    }
    if (actualYear && actualYear !== expectedYear) {
      errors.push(`⛔ 모의고사 ${catalogKey}: textbooks.ts 년도=${expectedYear} ≠ 폴더 데이터 년도=${actualYear} (path: ${mock.path})`);
    }

    catalog['모의고사'][catalogKey] = { path: mock.path, items };
  }

  // ─── 부교재 ───
  // path 누락 경고 (2026-04-19 추가)
  const noPathSupplements = supplements.filter(s => !s.path);
  if (noPathSupplements.length > 0) {
    console.log('\n⚠️  path 누락 부교재 (catalog에서 제외됨 — textbooks.ts에 path 추가 필요):');
    noPathSupplements.forEach(s => console.log(`  ⚠️ ${s.id}: "${s.label}" — path 없음`));
    noPathSupplements.forEach(s => errors.push(`⚠️ 부교재 ${s.id} path 누락 — catalog 미등록`));
  }

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
        const kept = unitData2[u].filter(s => {
          const key = `${sup.path.normalize('NFC')}/${u}/${s}`.normalize('NFC');
          return !BLOCKED_SUP_SECTIONS.has(key);
        });
        if (kept.length > 0) sections[u] = kept;
      }
    }
    const filteredUnits2 = units.filter(u => sections[u] && sections[u].length > 0);

    catalog['부교재'][sup.id] = { path: sup.path, units: filteredUnits2, sections };

    // "전체"만 있는 강 경고 (2026-04-19 추가)
    for (const u of filteredUnits2) {
      if (sections[u] && sections[u].length === 1 && sections[u][0] === '전체') {
        errors.push(`⚠️ 부교재 ${sup.id} ${u}: "전체"만 있음 — 개별 지문(1번/2번/3번) 테스트 누락 가능성`);
      }
    }
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

  // ─── 고아 폴더 감지: data/에 있는데 textbooks.ts에 path 없는 폴더 (2026-04-10) ───
  // 이게 있으면 학생이 테스트를 보는데 시스템이 "미출제"로 잘못 판정할 수 있음
  const registeredPaths = new Set([
    ...textbooks.filter(t => t.path).map(t => t.path),
    ...mocks.filter(t => t.path).map(t => t.path),
    ...supplements.filter(t => t.path).map(t => t.path),
  ]);
  const orphans = [];
  for (const source of ['교과서', '모의고사', '부교재']) {
    const sourceDir = path.join(DATA, source);
    if (!fs.existsSync(sourceDir)) continue;
    // walk 2~3 levels to find actual content folders
    for (const l1 of fs.readdirSync(sourceDir).filter(f => !f.startsWith('_') && fs.statSync(path.join(sourceDir, f)).isDirectory())) {
      if (source === '모의고사') {
        // 고1/3월 → check "고1/3월"
        for (const l2 of fs.readdirSync(path.join(sourceDir, l1)).filter(f => !f.startsWith('_') && fs.statSync(path.join(sourceDir, l1, f)).isDirectory())) {
          const p = l1 + '/' + l2;
          if (!registeredPaths.has(p)) orphans.push(source + '/' + p);
        }
      } else if (source === '부교재') {
        // 수능특강/영어 or 올림포스전국연합고2/2026
        for (const l2 of fs.readdirSync(path.join(sourceDir, l1)).filter(f => !f.startsWith('_') && fs.statSync(path.join(sourceDir, l1, f)).isDirectory())) {
          const p = l1 + '/' + l2;
          if (registeredPaths.has(p)) continue; // exact match
          // check if any registered path starts with this
          if ([...registeredPaths].some(rp => rp.startsWith(p + '/') || rp === p)) continue;
          orphans.push(source + '/' + p);
        }
      } else {
        // 교과서: 공통영어1/비상홍
        for (const l2 of fs.readdirSync(path.join(sourceDir, l1)).filter(f => !f.startsWith('_') && fs.statSync(path.join(sourceDir, l1, f)).isDirectory())) {
          const p = l1 + '/' + l2;
          if (!registeredPaths.has(p)) orphans.push(source + '/' + p);
        }
      }
    }
  }
  if (orphans.length > 0) {
    console.log('\n🚨 고아 폴더 감지 (data/에 있는데 textbooks.ts에 path 미등록):');
    orphans.forEach(o => console.log('  ' + o));
    console.log('  → textbooks.ts에 path 추가하거나, 중복 폴더면 삭제하세요.');
  }

  console.log('✅ test-catalog.json 생성 완료');
  console.log(`   교과서: ${tbDeployed}/${tbCount} 배포됨`);
  console.log(`   모의고사: ${mockDeployed}/${mockCount} 배포됨`);
  console.log(`   부교재: ${supDeployed}/${supCount} 배포됨`);

  const criticalErrors = errors.filter(e => e.startsWith('⛔'));
  const warnings = errors.filter(e => e.startsWith('⚠️'));

  if (warnings.length > 0) {
    console.log('\n⚠️  경고:');
    warnings.forEach(e => console.log('  ' + e));
  }

  if (criticalErrors.length > 0) {
    console.error('\n⛔ 에러:');
    criticalErrors.forEach(e => console.error('  ' + e));
    console.error('\n→ textbooks.ts의 모의고사 path 또는 id 년도를 수정하세요.');
    process.exit(1);
  }

  console.log('\n→ node scripts/sync-catalog.js 실행하여 test-deploy.ts 갱신');
}

main();
