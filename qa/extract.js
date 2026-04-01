#!/usr/bin/env node
/**
 * extract.js — PDF에서 원문 텍스트 추출 → originals/ 저장
 *
 * Usage:
 *   node qa/extract.js input.pdf --out originals/교과서/영어1/비상홍/2과/본문.txt
 *   node qa/extract.js input.pdf  (자동 경로 추론 시도)
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/path-mapper');

async function extractPdf(pdfPath, outPath) {
  let pdfParse;
  try { pdfParse = require('pdf-parse'); } catch {
    console.error('pdf-parse 미설치. 설치: npm install pdf-parse');
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  const result = await pdfParse(buffer);

  // 텍스트 정리
  let text = result.text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 출력 경로
  const outputPath = outPath || path.join(ROOT, 'originals', path.basename(pdfPath, '.pdf') + '.txt');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, text, 'utf8');

  console.log(`✅ 추출 완료: ${outputPath}`);
  console.log(`   ${result.numpages}페이지, ${text.length}자`);
  console.log(`   처음 200자: ${text.substring(0, 200)}...`);

  return { outputPath, pages: result.numpages, chars: text.length };
}

module.exports = { extractPdf };

if (require.main === module) {
  const args = process.argv.slice(2);
  const pdfPath = args.find(a => !a.startsWith('-'));
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;

  if (!pdfPath) {
    console.error('Usage: node qa/extract.js <pdf-file> [--out <output-path>]');
    process.exit(1);
  }

  extractPdf(path.resolve(pdfPath), outPath ? path.resolve(outPath) : null);
}
