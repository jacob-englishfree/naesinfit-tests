#!/usr/bin/env node
/**
 * auto-catalog.js — data/ 폴더 스캔 → index.html SCOPE_CATALOG["부교재"] 자동 동기화
 *
 * ⛔ 중요: 과거 regex 기반 replace가 중괄호 불균형으로 SCOPE_CATALOG를 깨뜨리는 사고 발생 (2026-04-10, 2026-04-15)
 *   → 이번 버전은 **정확한 브레이스 매칭**으로 안전하게 교체
 *
 * Usage: node scripts/auto-catalog.js [--check]
 *        --check: 변경 없이 검증만 (CI/pre-commit 용)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const DATA = path.join(ROOT, 'data');

const CHECK_ONLY = process.argv.includes('--check');

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
        const subDirs = scanDir(itemPath).filter(s => s !== '_passages' && hasJson(path.join(itemPath, s)));
        if (subDirs.length > 0) {
          subs[item] = subDirs.sort((a, b) => {
            if (a === 'Gateway') return -1;
            if (b === 'Gateway') return 1;
            return (parseInt(a) || 99) - (parseInt(b) || 99);
          });
        }
      }
      lessons.sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999));
      if (lessons.length > 0) {
        const entry = { dn: `${series} ${book}`, lessons, isNew: true };
        if (Object.keys(subs).length > 0) entry.subs = subs;
        result[series][book] = entry;
      }
    }
  }
  return result;
}

// ── 브레이스 균형 기반 교체 (안전) ──
function findBalancedRange(text, startIdx) {
  // startIdx가 '{' 위치. 닫는 '}' 인덱스 반환 (exclusive).
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === '\\') { escape = true; continue; }
      if (c === stringChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") { inString = true; stringChar = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function buildSupplementsEntry(supplements) {
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
  return suppParts.join(',');
}

// ── 검증: 생성된 SCOPE_CATALOG 블록 자체가 JS 문법 OK인지 ──
function validateSyntax(newBlock) {
  try {
    new Function(`const x = {${newBlock}};`);
    return true;
  } catch (e) {
    console.error(`❌ 생성된 catalog 블록 JS 문법 오류: ${e.message}`);
    return false;
  }
}

function validateFullHtml(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, idx = 0;
  while ((m = re.exec(html)) !== null) {
    try { new Function(m[1]); } catch (e) {
      console.error(`❌ index.html script[${idx}] JS 문법 오류: ${e.message}`);
      return false;
    }
    idx++;
  }
  return true;
}

// ── 메인: SCOPE_CATALOG["부교재"] 블록 정확히 찾아서 교체 ──
function updateIndex() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const supplements = scanSupplements();
  const newContent = buildSupplementsEntry(supplements);
  const newBlock = `"부교재":{ icon:"📖", items:{${newContent}}}`;

  // 1) 생성된 블록 자체 syntax 검증
  if (!validateSyntax(newBlock)) {
    console.error('❌ 새 블록 생성 실패 — scanSupplements 결과 이상');
    process.exit(2);
  }

  // 2) 기존 "부교재":{ 시작 위치 찾기 (SCOPE_CATALOG 내부)
  const scopeCatalogIdx = html.indexOf('const SCOPE_CATALOG');
  if (scopeCatalogIdx < 0) {
    console.error('❌ SCOPE_CATALOG 선언을 찾을 수 없음');
    process.exit(2);
  }
  const bookLabelIdx = html.indexOf('"부교재":{', scopeCatalogIdx);
  if (bookLabelIdx < 0) {
    console.error('❌ SCOPE_CATALOG 내 "부교재" 키를 찾을 수 없음');
    process.exit(2);
  }
  const braceStart = html.indexOf('{', bookLabelIdx + '"부교재":'.length);
  const braceEnd = findBalancedRange(html, braceStart);
  if (braceEnd < 0) {
    console.error('❌ "부교재" 객체의 닫는 중괄호를 찾을 수 없음 (브레이스 불균형)');
    process.exit(2);
  }

  // 3) 블록 교체
  const before = html.slice(0, bookLabelIdx);
  const after = html.slice(braceEnd);
  const newHtml = before + newBlock + after;

  // 4) 전체 HTML 임시 저장 후 syntax 재검증
  const tmpPath = INDEX + '.tmp';
  fs.writeFileSync(tmpPath, newHtml, 'utf8');
  if (!validateFullHtml(tmpPath)) {
    fs.unlinkSync(tmpPath);
    console.error('❌ 교체 후 index.html JS 문법 오류 — 변경 취소');
    process.exit(2);
  }

  if (CHECK_ONLY) {
    fs.unlinkSync(tmpPath);
    console.log('✅ auto-catalog --check PASS (실제 쓰기는 안 함)');
    return true;
  }

  // 5) 원본에 적용
  fs.renameSync(tmpPath, INDEX);

  let totalLessons = 0;
  for (const books of Object.values(supplements)) {
    for (const info of Object.values(books)) totalLessons += info.lessons.length;
  }
  console.log(`✅ 부교재 카탈로그 동기화: ${Object.keys(supplements).length}개 시리즈 / ${totalLessons}개 강단원`);
  return true;
}

updateIndex();
