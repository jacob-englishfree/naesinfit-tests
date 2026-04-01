/**
 * path-mapper.js — data/ ↔ originals/ ↔ reports/ 경로 변환
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

function dataToOriginal(dataPath) {
  // data/교과서/영어1/비상홍/2과/본문/단어.json → originals/교과서/영어1/비상홍/2과/본문.txt
  const rel = path.relative(path.join(ROOT, 'data'), dataPath);
  const parts = rel.split(path.sep);
  parts.pop(); // 단어.json 제거
  return path.join(ROOT, 'originals', parts.join(path.sep) + '.txt');
}

function dataToReport(dataPath, date) {
  // data/.../단어.json → reports/.../단어_20260401.json
  const rel = path.relative(path.join(ROOT, 'data'), dataPath);
  const dir = path.dirname(rel);
  const base = path.basename(rel, '.json');
  const dateStr = date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return path.join(ROOT, 'reports', dir, `${base}_${dateStr}.json`);
}

function dataToReportDir(dataPath) {
  const rel = path.relative(path.join(ROOT, 'data'), dataPath);
  return path.join(ROOT, 'reports', path.dirname(rel));
}

function findJsonFiles(dir) {
  const fs = require('fs');
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findJsonFiles(full));
    else if (entry.name.endsWith('.json')) results.push(full);
  }
  return results;
}

module.exports = { dataToOriginal, dataToReport, dataToReportDir, findJsonFiles, ROOT };
