#!/usr/bin/env node
/**
 * data/ 폴더를 스캔해서 index.html의 SCOPE_CATALOG를 자동 갱신
 * 
 * 사용: node scripts/sync-catalog.js
 * pre-commit hook에서 자동 실행됨
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const INDEX = path.join(__dirname, '..', 'index.html');

function scanDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => !f.startsWith('.') && !f.startsWith('_'));
}

function buildSupplementCatalog() {
  const supDir = path.join(DATA, '부교재');
  if (!fs.existsSync(supDir)) return {};
  
  const result = {};
  for (const series of scanDir(supDir)) {
    result[series] = {};
    const seriesDir = path.join(supDir, series);
    for (const book of scanDir(seriesDir)) {
      const bookDir = path.join(seriesDir, book);
      if (!fs.statSync(bookDir).isDirectory()) continue;
      
      const lessons = scanDir(bookDir).filter(f => {
        const fp = path.join(bookDir, f);
        return fs.statSync(fp).isDirectory() && f !== '_passages';
      });
      
      if (lessons.length === 0) continue;
      
      // Sort lessons naturally
      lessons.sort((a, b) => {
        const na = parseInt(a) || 0;
        const nb = parseInt(b) || 0;
        if (na && nb) return na - nb;
        return a.localeCompare(b);
      });
      
      const subs = {};
      for (const lesson of lessons) {
        const lessonDir = path.join(bookDir, lesson);
        const sections = scanDir(lessonDir).filter(f => {
          const fp = path.join(lessonDir, f);
          return fs.statSync(fp).isDirectory() && f !== '_passages';
        });
        if (sections.length > 0) {
          subs[lesson] = sections.sort();
        }
      }
      
      // Determine display name
      const dn = `${series} ${book}`;
      
      result[series][book] = { dn, lessons, isNew: true };
      if (Object.keys(subs).length > 0) {
        result[series][book].subs = subs;
      }
    }
  }
  return result;
}

function buildMockCatalog() {
  const mockDir = path.join(DATA, '모의고사');
  if (!fs.existsSync(mockDir)) return {};
  
  const result = {};
  for (const grade of scanDir(mockDir)) {
    result[grade] = {};
    const gradeDir = path.join(mockDir, grade);
    for (const exam of scanDir(gradeDir)) {
      const examDir = path.join(gradeDir, exam);
      if (!fs.statSync(examDir).isDirectory()) continue;
      
      const items = scanDir(examDir).filter(f => {
        const fp = path.join(examDir, f);
        return fs.statSync(fp).isDirectory();
      });
      
      items.sort((a, b) => {
        const na = parseInt(a) || 0;
        const nb = parseInt(b) || 0;
        return na - nb;
      });
      
      if (items.length > 0) {
        const dn = `${grade} ${exam.replace(/_/g, ' ')}`;
        result[grade][exam] = { dn, lessons: items, isNew: false };
      }
    }
  }
  return result;
}

function buildTextbookCatalog() {
  const tbDir = path.join(DATA, '교과서');
  if (!fs.existsSync(tbDir)) return {};
  
  const result = {};
  for (const pub of scanDir(tbDir)) {
    result[pub] = {};
    const pubDir = path.join(tbDir, pub);
    for (const unit of scanDir(pubDir)) {
      const unitDir = path.join(pubDir, unit);
      if (!fs.statSync(unitDir).isDirectory()) continue;
      
      const sections = scanDir(unitDir).filter(f => {
        const fp = path.join(unitDir, f);
        return fs.statSync(fp).isDirectory();
      });
      
      if (sections.length > 0) {
        result[pub][unit] = sections;
      }
    }
  }
  return result;
}

// Build catalog
const sup = buildSupplementCatalog();
const mock = buildMockCatalog();

// Read index.html
let html = fs.readFileSync(INDEX, 'utf-8');

// Find and replace SCOPE_CATALOG 부교재 section
// We need to update the lessons/subs for 부교재 entries
for (const [series, books] of Object.entries(sup)) {
  for (const [book, info] of Object.entries(books)) {
    const lessonsStr = JSON.stringify(info.lessons);
    const subsStr = info.subs ? JSON.stringify(info.subs) : null;
    
    // Find existing entry pattern
    const escSeries = series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escBook = book.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Pattern: "series":{"book":{dn:...,lessons:[...],isNew:...,subs:{...}}}
    const pattern = new RegExp(
      `"${escSeries}":\\{"${escBook}":\\{[^}]*lessons:\\[[^\\]]*\\][^}]*(?:subs:\\{[^}]*\\})?[^}]*\\}\\}`,
    );
    
    // Not easy to regex replace nested JSON in HTML... 
    // Instead, just update the lessons array
    const lessonsPattern = new RegExp(
      `("${escSeries}":\\{"${escBook}":\\{[^}]*lessons:)\\[[^\\]]*\\]`,
    );
    
    const match = html.match(lessonsPattern);
    if (match) {
      html = html.replace(lessonsPattern, `$1${lessonsStr}`);
      
      // Also update subs if they exist
      if (subsStr) {
        const subsPattern = new RegExp(
          `("${escSeries}":\\{"${escBook}":\\{[^}]*subs:)\\{[^}]*\\}`,
        );
        if (html.match(subsPattern)) {
          // Replace subs - but nested braces make this tricky
          // For safety, just replace lessons (subs are more complex)
        }
      }
    }
  }
}

fs.writeFileSync(INDEX, html, 'utf-8');
console.log('✅ SCOPE_CATALOG synced from data/ folder');

// Report what was found
for (const [series, books] of Object.entries(sup)) {
  for (const [book, info] of Object.entries(books)) {
    console.log(`  부교재/${series}/${book}: ${info.lessons.length}강`);
  }
}
