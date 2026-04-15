#!/usr/bin/env node
/**
 * 회귀 테스트: macOS NFD 한글 파일명 차단
 *
 * 사고: 2026-04-03 — macOS가 파일명을 NFD(분해형)로 저장 → 코드에서 NFC 비교 시 불일치
 *      → 테스트 버튼 전멸. feedback_nfc_normalize.
 *
 * 차단: data/ 모든 디렉토리명에 NFD 한글(ᄀ~ᇿ 자모 분리)이 있으면 FAIL.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
const NFD_JAMO = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/;
let fail = 0;
const flagged = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = e.name;
    const nfc = name.normalize('NFC');
    if (name !== nfc || NFD_JAMO.test(name)) {
      flagged.push(path.join(dir, name));
      fail++;
    }
    if (e.isDirectory()) walk(path.join(dir, name));
  }
}

walk(DATA_DIR);

if (fail) {
  console.error(`\n❌ NFD 한글 파일/폴더명 (${fail}건)`);
  flagged.slice(0, 20).forEach(f => console.error('  ' + path.relative(DATA_DIR, f)));
  console.error('\n사고: 2026-04-03. macOS NFD → 테스트 버튼 전멸. .normalize("NFC") 필수.');
  process.exit(1);
}
console.log('✅ NFD 한글 파일명 0건');
