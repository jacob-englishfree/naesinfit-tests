#!/usr/bin/env node
/**
 * RENDER-MARKER-MISSING 수정
 * ch가 마커형(①②③④)인데 passage에 마커가 없는 문항:
 * → git에서 원본 passage 복원하여 마커 정보 추출 → 현재 passage(fullPassage)에 이식
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function findAll(dir) {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() && !['_passages','reports','.git','node_modules'].includes(e.name)) r = r.concat(findAll(f));
    else if (e.name.endsWith('.json') && !e.name.includes('.blind') && !e.name.includes('.cross') &&
             !e.name.includes('.prompt') && !e.name.includes('.response') && !e.name.includes('.adversarial')) r.push(f);
  }
  return r;
}

// git에서 원본 passage 가져오기
function getOriginalPassages(filePath) {
  try {
    const relPath = path.relative(ROOT, filePath);
    const origRaw = execSync(`git show HEAD:"${relPath}" 2>/dev/null`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 10*1024*1024 });
    const origData = JSON.parse(origRaw);
    const map = {};
    if (origData.questions) {
      origData.questions.forEach(q => { map[q.id] = q.passage || ''; });
    }
    return map;
  } catch { return null; }
}

let fixed = 0, skipped = 0;

for (const f of findAll(DATA_DIR)) {
  let data;
  try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  if (!data.questions || !Array.isArray(data.questions)) continue;

  let needsOriginal = false;
  for (const q of data.questions) {
    if (!Array.isArray(q.ch)) continue;
    const isMarker = q.ch.every(c => /^[①②③④]\s*$/.test((c||'').trim()));
    if (!isMarker) continue;
    const p = q.passage || '';
    if (!/[①②③④]/.test(p)) { needsOriginal = true; break; }
  }

  if (!needsOriginal) continue;

  const origPassages = getOriginalPassages(f);
  if (!origPassages) { skipped++; continue; }

  let fileChanged = false;

  for (const q of data.questions) {
    if (!Array.isArray(q.ch)) continue;
    const isMarker = q.ch.every(c => /^[①②③④]\s*$/.test((c||'').trim()));
    if (!isMarker) continue;

    const p = q.passage || '';
    if (/[①②③④]/.test(p)) continue; // 이미 마커 있음

    // 원본에서 마커 정보 추출
    const origP = origPassages[q.id] || '';
    if (!/[①②③④]/.test(origP)) { skipped++; continue; }

    // 마커+밑줄 패턴 추출: ①<u>word</u> 또는 ①word
    const markerPats = [...origP.matchAll(/([①②③④⑤])(?:<u>([^<]+)<\/u>|(\S+))/g)];
    if (markerPats.length === 0) { skipped++; continue; }

    let newP = p;
    let allFound = true;

    for (const m of markerPats) {
      const marker = m[1];
      if (marker === '⑤') continue; // 5번째는 무시 (4지선다)
      const word = m[2] || m[3];
      if (!word) { allFound = false; continue; }

      // fullPassage(현재 passage)에서 해당 단어를 찾아 마커 삽입
      if (newP.includes(word) && !newP.includes(`${marker}`)) {
        if (m[2]) {
          // 밑줄 있는 경우
          newP = newP.replace(word, `${marker}<u>${word}</u>`);
        } else {
          newP = newP.replace(word, `${marker}${word}`);
        }
      } else if (!newP.includes(word)) {
        allFound = false;
      }
    }

    if (allFound || /[①②③④]/.test(newP)) {
      q.passage = newP;
      fileChanged = true;
      fixed++;
    } else {
      skipped++;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
  }
}

console.log(`RENDER-MARKER-MISSING 마커 복원 완료`);
console.log(`수정: ${fixed} | 스킵: ${skipped}`);
