#!/usr/bin/env node
/**
 * S-PASSAGE-NOT-FULL 안전 수정
 *
 * 조건:
 * 1. fullPassage가 존재하고 비어있지 않음
 * 2. passage가 fullPassage의 85% 미만
 * 3. 모의고사 또는 부교재 (교과서 제외)
 *
 * 수정 전략:
 * - passage에 특수 마커(①②③④⑤, <u>, ____)가 있으면:
 *   → fullPassage에 해당 마커를 이식
 * - passage에 특수 마커가 없으면:
 *   → fullPassage로 단순 교체
 */
const fs = require('fs');
const path = require('path');
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

let fixed = 0, skipped = 0, total = 0;

for (const f of findAll(DATA_DIR)) {
  const rel = path.relative(ROOT, f);
  // 교과서 제외 (교과서는 발췌 허용)
  if (rel.includes('교과서')) continue;

  let data;
  try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  if (!data.questions || !Array.isArray(data.questions)) continue;

  // fullPassage는 최상위 레벨에 있음
  const topFP = data.fullPassage || '';

  let fileChanged = false;

  for (const q of data.questions) {
    const fp = q.fullPassage || topFP;
    const p = q.passage;
    if (!fp || fp.trim() === '' || !p || p.trim() === '') continue;
    if (p.length >= fp.length * 0.85) continue;

    total++;

    // 영영풀이, 다의어 스킵
    if (/영영풀이|다의어/.test(q.type || '')) { skipped++; continue; }

    const hasMarkers = /[①②③④⑤]/.test(p);
    const hasUnderline = /<u>/.test(p);
    const hasBlank = /_{4,}/.test(p);
    const hasABC = /\(A\)|\(B\)|\(C\)/.test(p);

    if (!hasMarkers && !hasUnderline && !hasBlank && !hasABC) {
      // 마커 없음 → fullPassage로 단순 교체
      q.passage = fp;
      fileChanged = true;
      fixed++;
    } else {
      // 마커 있음 → fullPassage 기반으로 마커 이식 시도
      let newP = fp;

      // 밑줄 이식: passage에서 <u>word</u> 추출 → fullPassage에서 word 찾아 <u> 씌우기
      if (hasUnderline) {
        const uls = [...p.matchAll(/<u>([^<]+)<\/u>/g)];
        for (const m of uls) {
          const word = m[1];
          if (newP.includes(word) && !newP.includes(`<u>${word}</u>`)) {
            newP = newP.replace(word, `<u>${word}</u>`);
          }
        }
      }

      // 마커 이식: ①<u>word</u> 패턴 → fullPassage에서 word 찾아 마커+밑줄 삽입
      if (hasMarkers) {
        const markerPats = [...p.matchAll(/([①②③④⑤])(?:<u>)?([^<①②③④⑤\n]{1,50})(?:<\/u>)?/g)];
        for (const m of markerPats) {
          const marker = m[1];
          const word = m[2].trim();
          if (word && newP.includes(word) && !newP.includes(marker)) {
            if (hasUnderline) {
              newP = newP.replace(word, `${marker}<u>${word}</u>`);
            } else {
              newP = newP.replace(word, `${marker}${word}`);
            }
          }
        }
      }

      // 빈칸 이식: passage에서 ____ 위치의 원문 단어를 overlay.blank에서 찾기
      if (hasBlank) {
        if (q.overlay && q.overlay.blank) {
          const blank = q.overlay.blank;
          if (newP.includes(blank)) {
            newP = newP.replace(blank, '__________');
          }
        }
      }

      // (A)(B)(C) 이식
      if (hasABC) {
        const abcPats = [...p.matchAll(/\((A|B|C)\)\s*\[([^\]]+)\]/g)];
        for (const m of abcPats) {
          // ABC 조합형은 복잡 → 스킵
        }
        if (abcPats.length > 0) { skipped++; continue; }
      }

      // 교체 후 85% 이상인지 확인
      if (newP.length >= fp.length * 0.85) {
        q.passage = newP;
        fileChanged = true;
        fixed++;
      } else {
        skipped++;
      }
    }
  }

  if (fileChanged) {
    fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
  }
}

console.log(`S-PASSAGE-NOT-FULL 수정 완료`);
console.log(`대상: ${total} | 수정: ${fixed} | 스킵: ${skipped}`);
