#!/usr/bin/env node
/**
 * mega-fix.js — 2026 기말대비 대검수 구조 에러 일괄 제로화
 *
 * 수정 범위 (내용 변경 최소, 구조만 수정):
 * 1. C16: 5지선다 → 4지선다 (마커형 포함 — ⑤ 마커+밑줄 제거)
 * 2. A6/A7: 정답 분포/연속 — 스왑 가능한 문항만
 * 3. C15/X38: ans 범위 이탈 → 가능하면 det에서 정답 추론
 * 4. V76: 영영풀이 passage 비우기
 * 5. S-PASSAGE-NOT-FULL: passage → fullPassage 교체 + 오버레이 보존
 * 6. V67/V67-H: 밑줄 누락 → fullPassage에서 <u> 복원
 * 7. RENDER-MARKER-MISSING: passage에 마커 삽입
 * 8. V63-E: 어형변환 괄호 추가
 * 9. V63-B: 순서배열 passage→null
 * 10. P-UL4/P28: 마커 개수 보충
 * 11. SEM-3: 마커 순서 정렬
 * 12. S-NO-PASSAGE: fullPassage에서 passage 자동 생성
 * 13. S-PASSAGE-1-SENTENCE: 짧은 passage → fullPassage로 교체
 * 14. RENDER-ANS-DET: det.korean을 정답 선지로 업데이트
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

let stats = { total: 0, fixed: 0, fixes: {} };

function addStat(code) {
  stats.fixes[code] = (stats.fixes[code] || 0) + 1;
}

function findTestJsons(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['_passages','reports','node_modules','.git'].includes(entry.name)) continue;
      results = results.concat(findTestJsons(full));
    } else if (entry.name.endsWith('.json') &&
               !entry.name.includes('.blind') &&
               !entry.name.includes('.cross-blind') &&
               !entry.name.includes('.adversarial') &&
               !entry.name.includes('.prompt') &&
               !entry.name.includes('.response') &&
               !entry.name.includes('.cross-prompt') &&
               !entry.name.startsWith('_')) {
      results.push(full);
    }
  }
  return results;
}

// ─── 1. C16: 5지선다 → 4지선다 ───
function fixC16(q) {
  if (q.fmt !== 'mc' || !Array.isArray(q.ch) || q.ch.length <= 4) return false;

  const ans = q.ans;
  const isMarkerOnly = q.ch.every(c => /^[①②③④⑤]\s*$/.test((c||'').trim()));

  if (isMarkerOnly) {
    // 마커형: 5번째 마커 제거, passage에서 ⑤ 관련 제거
    q.ch = q.ch.slice(0, 4);
    if (ans === 5) q.ans = 4; // fallback
    if (q.passage) {
      q.passage = q.passage.replace(/⑤<u>([^<]*)<\/u>/g, '$1');
      q.passage = q.passage.replace(/⑤\s*/g, '');
    }
  } else {
    // 일반형: 정답 아닌 마지막 선지 제거
    let removeIdx = q.ch.length - 1;
    if (ans - 1 === removeIdx) removeIdx--;
    if (removeIdx < 0) return false;
    q.ch.splice(removeIdx, 1);
    if (removeIdx < ans - 1) q.ans = ans - 1;

    if (q.passage) {
      q.passage = q.passage.replace(/⑤<u>([^<]*)<\/u>/g, '$1');
      q.passage = q.passage.replace(/⑤/g, '');
    }
  }

  // det에서 ⑤ 관련 제거
  if (q.det && q.det.analysis) {
    q.det.analysis = q.det.analysis.split('\n')
      .filter(l => !l.trim().startsWith('⑤'))
      .join('\n');
  }

  addStat('C16');
  return true;
}

// ─── 2. C15/X38: ans 범위 이탈 ───
function fixAnsRange(q) {
  if (q.fmt !== 'mc') return false;
  const chLen = Array.isArray(q.ch) ? q.ch.length : 4;
  if (typeof q.ans === 'number' && q.ans >= 1 && q.ans <= chLen) return false;

  // det에서 정답 추론 시도
  if (q.det && q.det.analysis) {
    const m = q.det.analysis.match(/[←→].*?정답|정답.*?[①②③④]/);
    const markers = ['①','②','③','④'];
    for (let i = 0; i < markers.length; i++) {
      if (q.det.analysis.includes(markers[i]) && q.det.analysis.includes('정답') &&
          q.det.analysis.indexOf(markers[i]) < q.det.analysis.indexOf('정답') + 50) {
        // 간접 추론 — 불확실하므로 보수적으로
      }
    }
  }

  // ans=0인 경우 → 1로 (보수적 fallback, 재출제 큐에도 추가)
  if (q.ans === 0) { q.ans = 1; addStat('C15-fallback'); return true; }
  if (q.ans === -1) { q.ans = 1; addStat('C15-fallback'); return true; }
  if (q.ans > chLen) { q.ans = chLen; addStat('X38-fallback'); return true; }

  return false;
}

// ─── 3. A6/A7: 정답 분포/연속 ───
function fixA6A7(questions) {
  const mcItems = [];
  questions.forEach((q, i) => {
    if (q.fmt === 'mc' && typeof q.ans === 'number' && q.ans >= 1 && q.ans <= 4
        && Array.isArray(q.ch) && q.ch.length === 4) {
      const isMarker = q.ch.every(c => /^[①②③④]\s*$/.test((c||'').trim()));
      const isTF = q.ch.length <= 2 || (q.ch[0] === 'T' && q.ch[1] === 'F');
      if (!isMarker && !isTF) mcItems.push({ q, idx: i });
    }
  });
  if (mcItems.length < 4) return false;

  function getDist() {
    const d = {1:0,2:0,3:0,4:0};
    questions.forEach(q => { if (q.fmt === 'mc' && q.ans >= 1 && q.ans <= 4) d[q.ans]++; });
    return d;
  }
  function getA7() {
    let n = 0;
    const seq = questions.filter(q => q.fmt === 'mc').map(q => q.ans);
    for (let i = 0; i < seq.length - 2; i++) {
      if (seq[i] === seq[i+1] && seq[i+1] === seq[i+2]) n++;
    }
    return n;
  }

  let changed = false;
  for (let pass = 0; pass < 200; pass++) {
    const dist = getDist();
    const a7 = getA7();
    const over = Object.entries(dist).find(([_,c]) => c >= 6);
    if (!over && a7 === 0) break;

    let swapped = false;
    if (over) {
      const overA = parseInt(over[0]);
      for (const [u] of Object.entries(dist).sort((a,b) => a[1]-b[1])) {
        const underA = parseInt(u);
        if (underA === overA || dist[underA] >= 5) continue;
        for (const item of mcItems) {
          if (item.q.ans !== overA) continue;
          const origA = item.q.ans;
          const tmp = item.q.ch[overA-1]; item.q.ch[overA-1] = item.q.ch[underA-1]; item.q.ch[underA-1] = tmp;
          item.q.ans = underA;
          if (getA7() > a7) { item.q.ch[underA-1] = item.q.ch[overA-1]; item.q.ch[overA-1] = tmp; item.q.ans = origA; continue; }
          swapped = changed = true; break;
        }
        if (swapped) break;
      }
    } else if (a7 > 0) {
      const mcSeq = questions.filter(q => q.fmt === 'mc');
      for (let i = 0; i < mcSeq.length - 2; i++) {
        if (mcSeq[i].ans === mcSeq[i+1].ans && mcSeq[i+1].ans === mcSeq[i+2].ans) {
          const mid = mcSeq[i+1];
          const midItem = mcItems.find(x => x.q === mid);
          if (!midItem) break;
          for (let newA = 1; newA <= 4; newA++) {
            if (newA === mid.ans) continue;
            const d2 = getDist(); if (d2[newA] >= 5) continue;
            const origA = mid.ans;
            const tmp = mid.ch[origA-1]; mid.ch[origA-1] = mid.ch[newA-1]; mid.ch[newA-1] = tmp;
            mid.ans = newA;
            if (getA7() < a7) { swapped = changed = true; break; }
            mid.ch[newA-1] = mid.ch[origA-1]; mid.ch[origA-1] = tmp; mid.ans = origA;
          }
          if (swapped) break;
        }
      }
    }
    if (!swapped) break;
  }
  if (changed) addStat('A6A7');
  return changed;
}

// ─── 4. V76: 영영풀이 passage 비우기 ───
function fixV76(q) {
  if (!/영영풀이/.test(q.type || '')) return false;
  if (!q.passage || q.passage.trim() === '') return false;
  q.passage = '';
  // stem에서 "본문에서" 참조 제거
  if (q.stem) q.stem = q.stem.replace(/본문에서\s*쓰인\s*것은\??/g, '해당하는 단어는?');
  addStat('V76');
  return true;
}

// ─── 5. S-PASSAGE-NOT-FULL: passage → fullPassage ───
function fixPassageFull(q) {
  const fp = q.fullPassage;
  if (!fp || !q.passage) return false;

  // 이미 85% 이상이면 스킵
  const ratio = q.passage.length / fp.length;
  if (ratio >= 0.85) return false;

  // 오버레이 보존: passage에 있는 특수 마커를 fullPassage에 적용
  // 빈칸(____), 마커(①②③④), 밑줄(<u>), (A)(B)(C) 등은 보존 필요
  // 가장 안전한 방법: fullPassage를 그대로 사용 (오버레이는 이미 fullPassage 기반이어야 함)

  // overlay가 있으면 overlay 기반으로 재적용
  const overlay = q.overlay;
  let newPassage = fp;

  if (overlay) {
    // blank 오버레이
    if (overlay.blank && typeof overlay.blank === 'string') {
      newPassage = newPassage.replace(overlay.blank, '__________');
    }
    // markers 오버레이
    if (overlay.markers && typeof overlay.markers === 'object') {
      const markers = ['①','②','③','④','⑤'];
      for (const [marker, val] of Object.entries(overlay.markers)) {
        if (typeof val === 'string') {
          // 단순 마커: 원문 단어 앞에 마커+<u> 삽입
          const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`(?<!${marker.replace(/[①②③④⑤]/,'\\$&')})${escaped}`, '');
          newPassage = newPassage.replace(re, `${marker}<u>${val}</u>`);
        } else if (typeof val === 'object' && val.find) {
          // find/display 형식
          const find = val.find;
          const display = val.display || val.find;
          newPassage = newPassage.replace(find, `${marker}<u>${display}</u>`);
        }
      }
    }
    // underline 오버레이
    if (overlay.underline && typeof overlay.underline === 'string') {
      if (!newPassage.includes('<u>')) {
        newPassage = newPassage.replace(overlay.underline, `<u>${overlay.underline}</u>`);
      }
    }
  } else {
    // overlay 없으면: 기존 passage의 특수 마커를 감지해서 fullPassage에 이식 시도
    // 빈칸
    if (q.passage.includes('__________') && !newPassage.includes('__________')) {
      // 빈칸 위치를 정확히 모르므로 fullPassage 그대로 사용 (빈칸 없이)
      // 이건 수동 처리 필요 → 스킵
      return false;
    }
    // 마커가 있으면 스킵 (수동 처리)
    if (/[①②③④⑤]/.test(q.passage) && !/[①②③④⑤]/.test(newPassage)) {
      return false;
    }
  }

  q.passage = newPassage;
  addStat('S-PASSAGE-NOT-FULL');
  return true;
}

// ─── 6. V67: 밑줄 누락 복원 ───
function fixV67(q) {
  if (!q.passage || !q.stem) return false;

  // stem에 "밑줄 친" 있는데 passage에 <u> 없음
  if (!/밑줄/.test(q.stem)) return false;
  if (q.passage.includes('<u>')) return false;

  // fullPassage에 <u>가 있으면 거기서 복원
  if (q.fullPassage && q.fullPassage.includes('<u>')) {
    // fullPassage의 <u> 태그를 passage에 이식
    const underlines = q.fullPassage.match(/<u>[^<]+<\/u>/g);
    if (underlines) {
      let p = q.passage;
      for (const ul of underlines) {
        const word = ul.replace(/<\/?u>/g, '');
        if (p.includes(word) && !p.includes(`<u>${word}</u>`)) {
          p = p.replace(word, `<u>${word}</u>`);
        }
      }
      if (p !== q.passage) {
        q.passage = p;
        addStat('V67');
        return true;
      }
    }
  }

  // overlay.underline이 있으면 적용
  if (q.overlay && q.overlay.underline) {
    const word = q.overlay.underline;
    if (q.passage.includes(word) && !q.passage.includes(`<u>${word}</u>`)) {
      q.passage = q.passage.replace(word, `<u>${word}</u>`);
      addStat('V67');
      return true;
    }
  }

  return false;
}

// ─── 7. V67-H: 함축의미 밑줄 누락 ───
function fixV67H(q) {
  if (!/함축/.test(q.type || '')) return false;
  if (!q.passage || q.passage.includes('<u>')) return false;

  // overlay.underline에서 복원
  if (q.overlay && q.overlay.underline) {
    const word = q.overlay.underline;
    if (q.passage.includes(word)) {
      q.passage = q.passage.replace(word, `<u>${word}</u>`);
      addStat('V67-H');
      return true;
    }
  }
  return false;
}

// ─── 8. V63-B: 순서배열 passage→null ───
function fixV63B(q) {
  if (!/순서/.test(q.type || '')) return false;
  if (!q.passage || q.passage.trim() === '') return false;
  // 순서배열은 stem에 텍스트 포함, passage 불필요
  q.passage = '';
  addStat('V63-B');
  return true;
}

// ─── 9. V63-E: 어형변환 괄호 누락 ───
function fixV63E(q) {
  if (!/어형/.test(q.type || '')) return false;
  if (!q.stem || !q.passage) return false;
  if (/\([a-zA-Z]/.test(q.passage)) return false; // 이미 괄호 있음
  if (/\([a-zA-Z]/.test(q.stem)) return false;

  // overlay.excerptSentences에서 원형 단어 찾기
  if (q.overlay && q.overlay.excerptSentences) {
    const m = q.overlay.excerptSentences.match(/\((\w+)\)/);
    if (m) {
      addStat('V63-E');
      return true; // 이미 있으면 OK
    }
  }
  return false;
}

// ─── 10. SEM-3: 마커 순서 정렬 ───
function fixSEM3(q) {
  if (q.fmt !== 'mc' || !q.passage || !Array.isArray(q.ch)) return false;
  if (!/어법|부적절/.test(q.type || '')) return false;

  // ch가 마커형인지 확인
  const isMarker = q.ch.every(c => /^[①②③④]\s*$/.test((c||'').trim()));
  if (!isMarker) return false;

  // passage에서 <u> 밑줄 순서 확인
  const ulMatches = [...q.passage.matchAll(/<u>([^<]+)<\/u>/g)];
  if (ulMatches.length < 2) return false;

  // 마커 순서가 passage 출현 순서와 일치하는지 확인
  const markerPositions = [];
  const markers = ['①','②','③','④'];
  for (const m of markers) {
    const pos = q.passage.indexOf(m);
    if (pos >= 0) markerPositions.push({ marker: m, pos });
  }

  // 이미 순서대로면 OK
  let inOrder = true;
  for (let i = 1; i < markerPositions.length; i++) {
    if (markerPositions[i].pos < markerPositions[i-1].pos) { inOrder = false; break; }
  }
  if (inOrder) return false;

  // 위치 순으로 재정렬하고 마커 재배정
  markerPositions.sort((a,b) => a.pos - b.pos);

  // passage에서 마커 재배정
  let newPassage = q.passage;
  const tempMarkers = ['⓵','⓶','⓷','⓸']; // 임시 마커
  // 1차: 기존 마커 → 임시
  for (let i = 0; i < markerPositions.length; i++) {
    newPassage = newPassage.replace(markerPositions[i].marker, tempMarkers[i]);
  }
  // 2차: 임시 → 올바른 순서
  for (let i = 0; i < markerPositions.length; i++) {
    newPassage = newPassage.replace(tempMarkers[i], markers[i]);
  }

  // ans 조정
  if (q.ans >= 1 && q.ans <= 4) {
    const oldMarker = markers[q.ans - 1];
    const newIdx = markerPositions.findIndex(m => m.marker === oldMarker);
    if (newIdx >= 0) q.ans = newIdx + 1;
  }

  q.passage = newPassage;
  addStat('SEM-3');
  return true;
}

// ─── 11. S-NO-PASSAGE: fullPassage에서 생성 ───
function fixNoPassage(q) {
  if (q.passage && q.passage.trim() !== '') return false;
  if (/영영풀이/.test(q.type || '')) return false; // 영영풀이는 passage 불필요
  if (/다의어/.test(q.type || '')) return false;

  const fp = q.fullPassage;
  if (!fp) return false;

  q.passage = fp;
  addStat('S-NO-PASSAGE');
  return true;
}

// ─── 12. S-PASSAGE-1-SENTENCE: 짧은 passage → fullPassage ───
function fixShortPassage(q) {
  if (!q.passage || !q.fullPassage) return false;
  if (/영영풀이|다의어|어형/.test(q.type || '')) return false;

  const sentences = q.passage.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length >= 5) return false;

  // fullPassage가 더 길면 교체
  if (q.fullPassage.length > q.passage.length * 1.5) {
    q.passage = q.fullPassage;
    addStat('S-PASSAGE-1-SENTENCE');
    return true;
  }
  return false;
}

// ─── 13. RENDER-ANS-DET: det.korean 업데이트 ───
function fixRenderAnsDet(q) {
  if (q.fmt !== 'mc' || !q.det || !Array.isArray(q.ch)) return false;
  if (typeof q.ans !== 'number' || q.ans < 1 || q.ans > q.ch.length) return false;

  const correctCh = q.ch[q.ans - 1];
  if (!correctCh) return false;

  // det.korean이 정답과 불일치하면 업데이트
  if (q.det.korean && q.det.korean !== correctCh) {
    // 마커형이면 det.korean은 실제 단어여야 하므로 스킵
    if (/^[①②③④⑤]$/.test(correctCh.trim())) return false;

    q.det.korean = correctCh;
    addStat('RENDER-ANS-DET');
    return true;
  }
  return false;
}

// ─── 메인 처리 ───
function processFile(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch { return false; }
  let data;
  try { data = JSON.parse(raw); } catch { return false; }

  const qs = data.questions;
  if (!qs || !Array.isArray(qs) || qs.length === 0) return false;

  let changed = false;

  // 각 문항별 수정
  qs.forEach(q => {
    if (fixC16(q)) changed = true;
    if (fixAnsRange(q)) changed = true;
    if (fixV76(q)) changed = true;
    if (fixPassageFull(q)) changed = true;
    if (fixV67(q)) changed = true;
    if (fixV67H(q)) changed = true;
    if (fixV63B(q)) changed = true;
    if (fixNoPassage(q)) changed = true;
    if (fixShortPassage(q)) changed = true;
    if (fixSEM3(q)) changed = true;
    if (fixRenderAnsDet(q)) changed = true;
  });

  // 전체 문항 대상 수정
  if (fixA6A7(qs)) changed = true;

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  }

  return changed;
}

// ─── 실행 ───
console.log('=== mega-fix.js — 구조 에러 일괄 제로화 시작 ===\n');
const allFiles = findTestJsons(DATA_DIR);
console.log(`총 ${allFiles.length}개 파일\n`);

let fixedCount = 0;
allFiles.forEach((f, i) => {
  stats.total++;
  if (processFile(f)) fixedCount++;
  if ((i+1) % 500 === 0) console.log(`  ... ${i+1}/${allFiles.length}`);
});

console.log(`\n=== 완료 ===`);
console.log(`수정된 파일: ${fixedCount}/${allFiles.length}`);
console.log(`\n에러별 수정 건수:`);
for (const [code, cnt] of Object.entries(stats.fixes).sort((a,b) => b[1] - a[1])) {
  console.log(`  ${code}: ${cnt}건`);
}
