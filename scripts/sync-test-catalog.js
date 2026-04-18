#!/usr/bin/env node
/**
 * sync-test-catalog.js — data/ 폴더 스캔 → test-catalog.json 자동 갱신
 * 
 * pre-commit hook에서 자동 실행.
 * 새 강/단원 폴더가 추가되면 test-catalog.json에 자동 등록.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'test-catalog.json');
const DATA = path.join(ROOT, 'data');

function scanDir(dir) {
  try { return fs.readdirSync(dir).filter(f => !f.startsWith('.') && !f.startsWith('_') && fs.statSync(path.join(dir, f)).isDirectory()); }
  catch { return []; }
}

function hasJson(dir) {
  try { return fs.readdirSync(dir).some(f => f.endsWith('.json') && !f.startsWith('_')); }
  catch { return false; }
}

// Load existing catalog
let catalog;
try { catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')); }
catch { console.error('❌ test-catalog.json 로드 실패'); process.exit(1); }

let changed = false;

// ── 부교재 스캔 ──
const supBase = path.join(DATA, '부교재');
if (fs.existsSync(supBase)) {
  for (const series of scanDir(supBase)) {
    for (const book of scanDir(path.join(supBase, series))) {
      const bookPath = path.join(supBase, series, book);
      
      // Find matching catalog entry by path
      const targetPath = `${series}/${book}`;
      let entryKey = null;
      for (const [k, v] of Object.entries(catalog['부교재'] || {})) {
        if (v.path === targetPath) { entryKey = k; break; }
      }
      
      if (!entryKey) continue; // not registered in catalog
      
      const entry = catalog['부교재'][entryKey];
      
      // Scan lessons from filesystem
      const fsLessons = scanDir(bookPath).filter(d => {
        const dp = path.join(bookPath, d);
        return (d.match(/^\d+강$/) || d.match(/^TEST/)) && (hasJson(dp) || scanDir(dp).length > 0);
      });
      
      // Sort: numbers first, then alpha
      fsLessons.sort((a, b) => {
        const na = parseInt(a) || 999;
        const nb = parseInt(b) || 999;
        return na - nb;
      });
      
      // Check if units need update
      const currentUnits = entry.units || [];
      const newUnits = [...new Set([...currentUnits, ...fsLessons])];
      newUnits.sort((a, b) => {
        const na = parseInt(a) || 999;
        const nb = parseInt(b) || 999;
        return na - nb;
      });
      
      if (JSON.stringify(newUnits) !== JSON.stringify(currentUnits)) {
        entry.units = newUnits;
        changed = true;
      }
      
      // Scan sections for each lesson
      if (!entry.sections) entry.sections = {};
      for (const lesson of fsLessons) {
        const lessonPath = path.join(bookPath, lesson);
        const fsSections = scanDir(lessonPath).filter(s => s !== '_passages' && hasJson(path.join(lessonPath, s)));
        fsSections.sort((a, b) => {
          if (a === 'Gateway') return -1;
          if (b === 'Gateway') return 1;
          if (a === '전체') return -1;
          if (b === '전체') return 1;
          const na = parseInt(a) || 99;
          const nb = parseInt(b) || 99;
          return na - nb;
        });
        
        if (fsSections.length > 0) {
          const currentSections = entry.sections[lesson] || [];
          const merged = [...new Set([...currentSections, ...fsSections])];
          if (JSON.stringify(merged) !== JSON.stringify(currentSections)) {
            entry.sections[lesson] = merged;
            changed = true;
          }
        }
      }
    }
  }
}

// ── 모의고사 스캔 ──
const mockBase = path.join(DATA, '모의고사');
if (fs.existsSync(mockBase)) {
  for (const grade of scanDir(mockBase)) {
    for (const exam of scanDir(path.join(mockBase, grade))) {
      const examPath = path.join(mockBase, grade, exam);
      const targetPath = `${grade}/${exam}`;
      
      let entryKey = null;
      for (const [k, v] of Object.entries(catalog['모의고사'] || {})) {
        if (v.path === targetPath) { entryKey = k; break; }
      }

      const fsItems = scanDir(examPath).filter(d => hasJson(path.join(examPath, d)));
      fsItems.sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
      if (fsItems.length === 0) continue;

      // 카탈로그에 없으면 자동 등록 (폴더명에서 키 생성: "고2/3월_2023" → "고2-2023-3월")
      if (!entryKey) {
        const m = exam.match(/^(\d+)월_(\d{4})$/);  // "3월_2023"
        if (m) {
          entryKey = `${grade}-${m[2]}-${m[1]}월`;
        } else {
          const m2 = exam.match(/^(\d+)월$/);  // "3월" (년도 없음)
          if (m2) continue;  // 년도 없는 폴더는 스킵
          continue;
        }
        if (!catalog['모의고사']) catalog['모의고사'] = {};
        catalog['모의고사'][entryKey] = { path: targetPath, items: [] };
        console.log(`📦 모의고사 자동 등록: ${entryKey} (${targetPath})`);
        changed = true;
      }

      const entry = catalog['모의고사'][entryKey];

      const current = entry.items || [];
      const merged = [...new Set([...current, ...fsItems])];
      merged.sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
      if (JSON.stringify(merged) !== JSON.stringify(current)) {
        entry.items = merged;
        changed = true;
      }
    }
  }
}

if (changed) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log('📦 test-catalog.json 자동 동기화됨');
} else {
  // silent — no changes needed
}
