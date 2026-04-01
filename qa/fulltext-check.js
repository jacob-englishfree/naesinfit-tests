#!/usr/bin/env node
/**
 * fulltext-check.js — originals/ 원본 텍스트 vs JSON fullPassage 대조
 */
const fs = require('fs');
const path = require('path');
const { dataToOriginal, ROOT } = require('./lib/path-mapper');

function normalize(text) {
  return (text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

function checkFulltext(jsonPath) {
  const result = { file: jsonPath, pass: true, skip: false, mismatches: [], matchRatio: 0, summary: '' };
  const originalPath = dataToOriginal(jsonPath);

  if (!fs.existsSync(originalPath)) {
    result.skip = true;
    result.summary = `originals/ 없음: ${path.relative(ROOT, originalPath)}`;
    return result;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const jsonText = normalize(data.fullPassage || '');
  const origText = normalize(fs.readFileSync(originalPath, 'utf8'));

  if (!jsonText) {
    result.pass = false;
    result.summary = 'fullPassage 비어있음';
    return result;
  }

  // 글자 단위 비교 — Levenshtein 대신 단어 단위 매칭
  const jsonWords = jsonText.split(/\s+/);
  const origWords = origText.split(/\s+/);
  let matches = 0;

  for (const w of jsonWords) {
    if (origWords.includes(w)) matches++;
  }

  result.matchRatio = jsonWords.length > 0 ? +(matches / jsonWords.length).toFixed(3) : 0;
  result.pass = result.matchRatio >= 0.85;
  result.summary = `일치율 ${(result.matchRatio * 100).toFixed(1)}% (${matches}/${jsonWords.length} 단어)`;

  // 불일치 단어 최대 10개 표시
  if (result.matchRatio < 1.0) {
    const missing = jsonWords.filter(w => !origWords.includes(w)).slice(0, 10);
    result.mismatches = missing;
  }

  return result;
}

module.exports = { checkFulltext };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node qa/fulltext-check.js <json-file>'); process.exit(1); }
  const r = checkFulltext(path.resolve(file));
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.pass || r.skip ? 0 : 1);
}
