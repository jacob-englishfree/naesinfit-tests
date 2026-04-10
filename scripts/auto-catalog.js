#!/usr/bin/env node
/**
 * auto-catalog.js — data/ 폴더 스캔 → index.html 카탈로그 자동 동기화
 *
 * data/에 JSON이 있으면 자동으로 카탈로그에 등록. 누락 불가능.
 *
 * Usage: node scripts/auto-catalog.js
 *        (pre-commit hook에서 자동 실행)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const DATA = path.join(ROOT, 'data');

function scanDir(dir) {
  try { return fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isDirectory()); }
  catch { return []; }
}

function hasJson(dir) {
  try { return fs.readdirSync(dir).some(f => f.endsWith('.json')); }
  catch { return false; }
}

// ── 부교재 스캔 ──
function scanSupplements() {
  const result = {};
  const base = path.join(DATA, '부교재');
  for (const series of scanDir(base)) {
    result[series] = {};
    for (const book of scanDir(path.join(base, series))) {
      const bookPath = path.join(base, series, book);
      const lessons = [];
      const subs = {};

      for (const item of scanDir(bookPath)) {
        if (!item.match(/^\d+강$/) && !item.match(/^TEST/)) continue;
        const itemPath = path.join(bookPath, item);
        if (!hasJson(itemPath) && scanDir(itemPath).length === 0) continue;
        lessons.push(item);

        const subDirs = scanDir(itemPath).filter(s => hasJson(path.join(itemPath, s)));
        if (subDirs.length > 0) {
          subs[item] = subDirs.sort((a, b) => {
            if (a === 'Gateway') return -1;
            if (b === 'Gateway') return 1;
            return (parseInt(a) || 99) - (parseInt(b) || 99);
          });
        }
      }

      lessons.sort((a, b) => parseInt(a) - parseInt(b));
      if (lessons.length > 0) {
        const entry = { dn: `${series} ${book}`, lessons, isNew: true };
        if (Object.keys(subs).length > 0) entry.subs = subs;
        result[series][book] = entry;
      }
    }
  }
  return result;
}

// ── index.html 부교재 카탈로그 업데이트 ──
function updateIndex() {
  let html = fs.readFileSync(INDEX, 'utf8');
  const supplements = scanSupplements();

  // Build replacement string
  const suppParts = [];
  for (const [series, books] of Object.entries(supplements)) {
    const bookParts = [];
    for (const [book, info] of Object.entries(books)) {
      const lessonsStr = JSON.stringify(info.lessons);
      let subsStr = '';
      if (info.subs) {
        const subParts = Object.entries(info.subs).map(([k, v]) => `"${k}":${JSON.stringify(v)}`);
        subsStr = `,subs:{${subParts.join(',')}}`;
      }
      bookParts.push(`"${book}":{dn:"${info.dn}",lessons:${lessonsStr},isNew:true${subsStr}}`);
    }
    suppParts.push(`"${series}":{${bookParts.join(',')}}`);
  }

  const newCatalog = suppParts.join(',');

  // Replace in SCOPE_CATALOG
  const regex = /"부교재":\{\s*icon:"📖",\s*items:\{[\s\S]*?\}\s*\}\}/;
  const replacement = `"부교재":{ icon:"📖", items:{${newCatalog}}}`;

  if (regex.test(html)) {
    html = html.replace(regex, replacement);
    fs.writeFileSync(INDEX, html, 'utf8');

    let totalLessons = 0;
    for (const books of Object.values(supplements)) {
      for (const info of Object.values(books)) totalLessons += info.lessons.length;
    }
    console.log(`✅ 부교재 카탈로그 동기화: ${totalLessons}개 강/단원`);
    return true;
  } else {
    console.error('❌ 부교재 카탈로그 패턴을 찾을 수 없음');
    return false;
  }
}

updateIndex();
