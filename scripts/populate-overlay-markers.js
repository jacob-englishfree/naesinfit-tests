#!/usr/bin/env node
/**
 * populate-overlay-markers.js — passage에서 마커 추출 → overlay.markers 자동 생성
 *
 * 어법/부적절 문항에서 passage에 ①<u>word</u> 형태의 마커가 있지만
 * overlay.markers가 비어있는 경우, fullPassage와 대조하여
 * overlay.markers = { "①": {find: "원문", display: "변형"}, ... } 생성
 *
 * blind-solver-local.js가 이 데이터로 자동 검증 가능
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const isAll = args.includes('--all');

const MARKER_TYPES = new Set([
  '어법', '문맥상 부적절한 어휘', '어휘', '부적절', '오류찾기'
]);

const MK = ['①', '②', '③', '④', '⑤'];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.') && e.name !== 'node_modules')
      out.push(...walk(path.join(dir, e.name)));
    else if (['단어.json', '워크북.json', '퀴즈.json'].includes(e.name))
      out.push(path.join(dir, e.name));
  }
  return out;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * passage에서 마커+단어 추출
 * 형태: ①<u>word</u> 또는 ①word (공백/태그 전까지)
 */
function extractMarkers(passage) {
  if (!passage) return null;
  const result = {};
  // Pattern 1: ①<u>word</u>
  const re1 = /([①②③④⑤])<u>([^<]+)<\/u>/g;
  let m;
  while ((m = re1.exec(passage)) !== null) {
    result[m[1]] = m[2].trim();
  }
  // Pattern 2: ①word (no <u>, grab next word)
  const re2 = /([①②③④⑤])(?!<u>)([a-zA-Z][a-zA-Z'-]*)/g;
  while ((m = re2.exec(passage)) !== null) {
    if (!result[m[1]]) {
      result[m[1]] = m[2].trim();
    }
  }
  return Object.keys(result).length >= 2 ? result : null;
}

/**
 * fullPassage에서 marker 위치의 원본 단어 찾기
 * passage의 marker 주변 컨텍스트를 이용하여 fullPassage에서 위치 특정
 */
function findOriginalWord(passage, fullPassage, marker, displayWord) {
  if (!fullPassage || !passage) return null;

  // 1. displayWord가 fullPassage에 있으면 동일 (find = display)
  const fpLower = fullPassage.toLowerCase();
  const dispLower = displayWord.toLowerCase();
  if (fpLower.includes(dispLower)) {
    return displayWord; // 원문과 동일 = 변형 아님
  }

  // 2. 없으면: passage에서 marker 주변 컨텍스트 추출, fullPassage에서 대응 위치의 단어 찾기
  const markerIdx = passage.indexOf(marker);
  if (markerIdx === -1) return null;

  // marker 앞 15자 컨텍스트
  const beforeCtx = passage.substring(Math.max(0, markerIdx - 40), markerIdx)
    .replace(/<[^>]+>/g, '').replace(/[①②③④⑤]/g, '').trim();
  // marker 뒤 (display word 이후) 15자 컨텍스트
  const afterStart = markerIdx + marker.length + displayWord.length + 10; // rough skip
  const afterCtx = passage.substring(afterStart, afterStart + 40)
    .replace(/<[^>]+>/g, '').replace(/[①②③④⑤]/g, '').trim();

  // beforeCtx의 마지막 2-3 단어
  const beforeWords = beforeCtx.split(/\s+/).filter(w => w.length >= 2).slice(-3);
  // afterCtx의 첫 2-3 단어
  const afterWords = afterCtx.split(/\s+/).filter(w => w.length >= 2).slice(0, 3);

  if (beforeWords.length === 0 && afterWords.length === 0) return null;

  // fullPassage에서 beforeWords 이후, afterWords 이전의 단어 찾기
  const fpClean = fullPassage.replace(/<[^>]+>/g, '');

  for (let bLen = beforeWords.length; bLen >= 1; bLen--) {
    const bPhrase = beforeWords.slice(-bLen).join('\\s+');
    for (let aLen = Math.min(afterWords.length, 2); aLen >= 1; aLen--) {
      const aPhrase = afterWords.slice(0, aLen).join('\\s+');
      const re = new RegExp(esc(bPhrase.replace(/\\s\+/g, ' ')).replace(/ /g, '\\s+') + '\\s+(\\S+)\\s+' + esc(aPhrase.replace(/\\s\+/g, ' ')).replace(/ /g, '\\s+'), 'i');
      const match = fpClean.match(re);
      if (match) {
        return match[1].replace(/[.,;:!?'"()]/g, '').trim();
      }
    }
  }

  return null;
}

function processFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fp = data.fullPassage || '';
  let fixed = 0;

  for (const q of data.questions) {
    if (q.fmt !== 'mc') continue;
    if (!MARKER_TYPES.has(q.type)) continue;
    if (q.overlay && q.overlay.markers && Object.keys(q.overlay.markers).length >= 2) continue;
    if (!q.passage) continue;

    const markers = extractMarkers(q.passage);
    if (!markers) continue;

    // Build overlay.markers
    const overlayMarkers = {};
    let allFound = true;
    let hasDiff = false;

    for (const [mk, dispWord] of Object.entries(markers)) {
      const origWord = findOriginalWord(q.passage, fp, mk, dispWord);
      if (origWord === null) {
        // Can't find original → use display as both (solver won't detect it)
        overlayMarkers[mk] = dispWord;
        allFound = false;
      } else if (origWord.toLowerCase() !== dispWord.toLowerCase()) {
        overlayMarkers[mk] = { find: origWord, display: dispWord };
        hasDiff = true;
      } else {
        overlayMarkers[mk] = dispWord;
      }
    }

    if (Object.keys(overlayMarkers).length >= 2) {
      if (!q.overlay) q.overlay = {};
      q.overlay.markers = overlayMarkers;
      fixed++;
    }
  }

  if (fixed > 0 && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
  return fixed;
}

// Main
const target = isAll ? path.join(ROOT, 'data') : args.find(a => !a.startsWith('--'));
if (!target) {
  console.error('Usage: node scripts/populate-overlay-markers.js [--dry] <dir|--all>');
  process.exit(1);
}

const files = walk(path.resolve(target));
let totalFiles = 0, totalFixed = 0;

for (const f of files) {
  const fixed = processFile(f);
  if (fixed > 0) {
    totalFiles++;
    totalFixed += fixed;
  }
}

console.log(`\n━━━ 결과 ━━━`);
console.log(`  수정 파일: ${totalFiles}`);
console.log(`  overlay.markers 생성: ${totalFixed}문항`);
if (dryRun) console.log(`  (드라이런)`);
