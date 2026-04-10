#!/usr/bin/env node
/**
 * 모의고사 전체 자동수정 스크립트
 *
 * 대상: data/모의고사/ 전체 (이미 PASS인 파일은 건드리지 않음)
 *
 * 수정 항목:
 * 1. S-PASSAGE-NOT-FULL (5303건): passage < 85% fullPassage → fullPassage + 오버레이
 * 2. S-NO-PASSAGE (696건): 영작 passage 누락 → fullPassage 추가
 * 3. S-MARKER-LEAK (399건): 마커 무관 유형에서 ①②③④⑤ 제거
 * 4. S-WA-IN-PASSAGE (179건): 서술형 wa 노출 → ____ 마스킹
 * 5. V63-E (180건): 어형변환 괄호 추가
 * 6. V62 (171건): 빈칸 stem인데 passage에 ____ 없음
 * 7. SEM-3 (210건): 어법 ch 순서 → passage 밑줄 순서
 * 8. V-WRITTEN-WORDCOUNT (276건): stem 단어수 vs wa 불일치
 * 9. S-PASSAGE-1-SENTENCE (275건): 1문장 passage → fullPassage 확장
 * 10. EMPTY-UL: 빈 <u></u> → det에서 단어 추출
 * 11. V62-STEM: 어법 빈칸 stem → 밑줄형 변경 (퀴즈 Q1/Q3)
 * 12. V69: 서술형 문장단위 정답 마스킹
 * 13. S-CH-TRUNCATED: ch 절단 수정은 콘텐츠 이슈 → skip
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', '모의고사');
const log = [];
let totalFixes = 0;
let filesModified = 0;

function logFix(file, qi, code, msg) {
  log.push(`${path.relative(BASE, file)} Q${qi+1} [${code}] ${msg}`);
  totalFixes++;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getUnderlines(passage) {
  if (!passage) return [];
  const re = /<u>([^<]*)<\/u>/g;
  const res = [];
  let m;
  while ((m = re.exec(passage)) !== null) {
    res.push({ text: m[1].trim(), pos: m.index, full: m[0] });
  }
  return res;
}

function getWordFromDet(det, markerNum) {
  if (!det?.analysis) return null;
  const markers = ['①','②','③','④'];
  const marker = markers[markerNum - 1];
  if (!marker) return null;
  const patterns = [
    new RegExp(`[✅❌]\\s*${marker}\\s+(\\w[\\w\\s-]*?)(?:\\s*[→:—]|\\s*$)`, 'm'),
    new RegExp(`${marker}\\s+(\\w+)`, 'm'),
  ];
  for (const p of patterns) {
    const m = det.analysis.match(p);
    if (m) return m[1].trim().split(/\s/)[0];
  }
  if (det.korean) {
    const kp = new RegExp(`${marker}\\s+(\\w+)`);
    const km = det.korean.match(kp);
    if (km) return km[1].trim();
  }
  return null;
}

// Marker types that SHOULD have markers in passage
const MARKER_TYPES = /어법|부적절|오류찾기|문장삽입|순서배열|조합|\(A\)\(B\)\(C\)/;
// Types exempt from fullPassage (short excerpt OK)
const EXCERPT_TYPES = /어형변환|어형 변환|영영풀이/;
// Find-type stems exempt from S-WA-IN-PASSAGE
const FIND_STEM = /본문에서\s*찾아|본문\s*속|발췌|본문 그대로|본문에서\s*골라|지문에서\s*찾아|글에서\s*찾아/;

function getAllFiles() {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.json')) results.push(p);
    }
  }
  walk(BASE);
  return results;
}

function processFile(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch { return false; }
  let data;
  try { data = JSON.parse(raw); } catch { return false; }

  const fp = data.fullPassage;
  if (!fp || !data.questions) return false;

  let modified = false;

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    const type = q.type || '';
    const typeNorm = type.replace(/\s/g, '');
    const stem = q.stem || '';
    const isGrammar = type.includes('어법');
    const isInappropriate = type.includes('부적절') || type.includes('오류');
    const isMarkerCh = q.ch && q.ch.every(c => /^[①②③④⑤]$/.test(c));
    const isWritten = q.fmt === 'written';
    const isMc = q.fmt === 'mc';

    // === FIX 1: EMPTY <u></u> ===
    if (isGrammar && q.passage && q.det) {
      const emptyUl = q.passage.match(/([①②③④])<u><\/u>/g);
      if (emptyUl) {
        for (const eu of emptyUl) {
          const marker = eu[0];
          const mNum = ['①','②','③','④'].indexOf(marker) + 1;
          const word = getWordFromDet(q.det, mNum);
          if (word) {
            q.passage = q.passage.replace(`${marker}<u></u>`, `${marker}<u>${word}</u>`);
            logFix(filePath, i, 'EMPTY-UL', `${marker}<u>${word}</u>`);
            modified = true;
          }
        }
      }
    }

    // === FIX 2: S-NO-PASSAGE (written without passage) ===
    if (isWritten && !q.passage) {
      let newP = fp;
      newP = newP.replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1').replace(/[①②③④⑤]/g, '');
      if (q.wa) {
        const esc = escapeRegex(q.wa);
        newP = newP.replace(new RegExp(`\\b${esc}\\b`, 'gi'), '____');
      }
      q.passage = newP;
      logFix(filePath, i, 'NO-PASS', `passage 추가`);
      modified = true;
    }

    // === FIX 3: S-MARKER-LEAK (마커 무관 유형에서 번호만 제거, <u> 보존) ===
    if (q.passage && !MARKER_TYPES.test(typeNorm) && !isGrammar && !isInappropriate) {
      if (/[①②③④⑤]/.test(q.passage)) {
        const before = q.passage;
        // 마커 번호만 제거, <u> 태그는 유지
        q.passage = q.passage
          .replace(/[①②③④⑤]\s*(?=<u>)/g, '') // ①<u>word</u> → <u>word</u>
          .replace(/[①②③④⑤]/g, ''); // 단독 마커 제거
        if (q.passage !== before) {
          logFix(filePath, i, 'MARKER-LEAK', `마커 번호 제거 (<u> 보존)`);
          modified = true;
        }
      }
    }

    // === FIX 4: S-WA-IN-PASSAGE ===
    if (isWritten && q.wa && q.passage) {
      if (!FIND_STEM.test(stem) && !typeNorm.includes('영작') && !typeNorm.includes('어형') && !typeNorm.includes('한영')) {
        const waNorm = q.wa.trim().toLowerCase();
        if (waNorm.length >= 4 && q.passage.toLowerCase().includes(waNorm)) {
          const esc = escapeRegex(q.wa);
          q.passage = q.passage.replace(new RegExp(`\\b${esc}\\b`, 'i'), '____');
          logFix(filePath, i, 'WA-MASK', `"${q.wa.slice(0,30)}" → ____`);
          modified = true;
        }
      }
    }

    // === FIX 5: S-PASSAGE-NOT-FULL + S-PASSAGE-1-SENTENCE ===
    if (q.passage && !isWritten) {
      const ratio = q.passage.length / fp.length;
      const sentCount = (q.passage.match(/[.!?]/g) || []).length;

      if (ratio < 0.85 || sentCount <= 1) {
        // Skip types that need special overlay
        if (isGrammar || isInappropriate) continue;
        if (EXCERPT_TYPES.test(typeNorm)) continue;
        if (typeNorm.includes('문장삽입') || typeNorm.includes('순서')) continue;

        // Types that can use fullPassage directly
        const needsUnderline = typeNorm.includes('동의') || typeNorm.includes('반의') ||
            typeNorm.includes('다의') || typeNorm.includes('지칭');

        if (typeNorm.includes('내용') || typeNorm.includes('주제') || typeNorm.includes('제목') ||
            typeNorm.includes('요지') || type.includes('T/F') || typeNorm.includes('동의') ||
            typeNorm.includes('반의') || typeNorm.includes('지칭') || typeNorm.includes('다의') ||
            typeNorm.includes('무관') || typeNorm.includes('요약')) {
          let newP = fp;
          // 밑줄 필요 유형: 기존 passage에서 <u> 단어를 추출해서 fullPassage에 이식
          if (needsUnderline && q.passage.includes('<u>')) {
            const ulWords = [];
            const ulRe = /<u>([^<]+)<\/u>/g;
            let um;
            while ((um = ulRe.exec(q.passage)) !== null) ulWords.push(um[1]);
            for (const uw of ulWords) {
              if (newP.includes(uw) && !newP.includes(`<u>${uw}</u>`)) {
                newP = newP.replace(uw, `<u>${uw}</u>`);
              }
            }
          }
          // stem에 "밑줄 친"이 있으면 <u> 필수 확인
          if (stem.includes('밑줄') && !newP.includes('<u>') && q.passage.includes('<u>')) {
            // fullPassage에 밑줄 이식 실패 → 기존 passage 유지
            continue;
          }
          q.passage = newP;
          logFix(filePath, i, 'FULL', `passage 확장 (${type})`);
          modified = true;
        } else if (typeNorm.includes('빈칸') || typeNorm.includes('추론')) {
          // Preserve blank
          if (q.passage.includes('____')) {
            if (q.ch && q.ans) {
              const ansWord = q.ch[q.ans - 1];
              if (ansWord && fp.includes(ansWord)) {
                const esc = escapeRegex(ansWord);
                const newP = fp.replace(new RegExp(`\\b${esc}\\b`, 'i'), '____');
                if (newP.includes('____')) {
                  q.passage = newP;
                  logFix(filePath, i, 'FULL-BLANK', `빈칸추론 확장`);
                  modified = true;
                }
              }
            }
          } else {
            q.passage = fp;
            logFix(filePath, i, 'FULL', `passage 확장`);
            modified = true;
          }
        } else if (typeNorm.includes('함축')) {
          if (q.passage.includes('<u>')) {
            const ulMatch = q.passage.match(/<u>([^<]+)<\/u>/);
            if (ulMatch && fp.includes(ulMatch[1])) {
              q.passage = fp.replace(ulMatch[1], `<u>${ulMatch[1]}</u>`);
              logFix(filePath, i, 'FULL-UL', `함축 확장`);
              modified = true;
            }
          } else {
            q.passage = fp;
            logFix(filePath, i, 'FULL', `passage 확장 (함축)`);
            modified = true;
          }
        } else if (typeNorm.includes('조합') || typeNorm.includes('(A)(B)(C)')) {
          if (!q.passage.includes('(A)')) {
            q.passage = fp;
            logFix(filePath, i, 'FULL', `passage 확장 (조합)`);
            modified = true;
          }
        } else {
          // Default: expand if safe, but preserve <u> tags
          let newP = fp;
          if (q.passage.includes('<u>') && stem.includes('밑줄')) {
            // Transfer underlines from old passage to fullPassage
            const ulRe2 = /<u>([^<]+)<\/u>/g;
            let um2;
            while ((um2 = ulRe2.exec(q.passage)) !== null) {
              const uw2 = um2[1];
              if (newP.includes(uw2) && !newP.includes(`<u>${uw2}</u>`)) {
                newP = newP.replace(uw2, `<u>${uw2}</u>`);
              }
            }
            if (stem.includes('밑줄') && !newP.includes('<u>')) continue; // 이식 실패시 skip
          }
          q.passage = newP;
          logFix(filePath, i, 'FULL', `passage 확장 (${type || 'unknown'})`);
          modified = true;
        }
      }
    }

    // === FIX 6: V63-E (어형변환 괄호) ===
    if (typeNorm.includes('어형') && stem.includes('괄호') && q.passage) {
      if (!q.passage.includes('(') && !q.passage.includes('[')) {
        if (q.wa) {
          const esc = escapeRegex(q.wa);
          const rx = new RegExp(`\\b${esc}\\b`, 'i');
          if (rx.test(q.passage)) {
            q.passage = q.passage.replace(rx, `(${q.wa})`);
            logFix(filePath, i, 'V63-E', `괄호: (${q.wa})`);
            modified = true;
          } else if (q.det?.korean) {
            const dm = q.det.korean.match(/(\w+)\s*→/);
            if (dm) {
              const orig = dm[1];
              const rx2 = new RegExp(`\\b${escapeRegex(orig)}\\b`, 'i');
              if (rx2.test(q.passage)) {
                q.passage = q.passage.replace(rx2, `(${orig})`);
                logFix(filePath, i, 'V63-E', `괄호: (${orig})`);
                modified = true;
              }
            }
          }
        }
      }
    }

    // === FIX 7: SEM-3 ch reorder (word-based) ===
    if (isGrammar && q.ch && q.passage && q.ans && !isMarkerCh) {
      const underlines = getUnderlines(q.passage).filter(u => u.text.length > 0);
      if (underlines.length >= 3 && q.ch.length >= 3) {
        const matchMap = [];
        for (let ci = 0; ci < q.ch.length; ci++) {
          const cw = q.ch[ci].replace(/^[①②③④⑤]\s*/, '').trim();
          let bestUi = -1;
          for (let ui = 0; ui < underlines.length; ui++) {
            const uw = underlines[ui].text;
            if (uw === cw || uw.includes(cw) || cw.includes(uw)) { bestUi = ui; break; }
          }
          matchMap.push(bestUi);
        }
        if (matchMap.every(m => m >= 0)) {
          let inOrder = true;
          for (let j = 1; j < matchMap.length; j++) {
            if (matchMap[j] <= matchMap[j-1]) { inOrder = false; break; }
          }
          if (!inOrder) {
            const indexed = matchMap.map((pos, idx) => ({ pos, idx }));
            indexed.sort((a, b) => a.pos - b.pos);
            const oldAnsIdx = q.ans - 1;
            const newCh = indexed.map(x => q.ch[x.idx]);
            const newAnsIdx = indexed.findIndex(x => x.idx === oldAnsIdx);
            if (newAnsIdx >= 0) {
              if (q.det && Array.isArray(q.det)) {
                q.det = indexed.map(x => q.det[x.idx]);
              }
              q.ch = newCh;
              q.ans = newAnsIdx + 1;
              logFix(filePath, i, 'SEM-3', `ch 재정렬, ans→${q.ans}`);
              modified = true;
            }
          }
        }
      }
    }

    // === FIX 8: V62 (빈칸 stem인데 passage에 ____ 없음) ===
    if (stem.includes('빈칸') && q.passage && !q.passage.includes('____')) {
      // If 어법 with underlines → change stem instead
      if (isGrammar && q.passage.includes('<u>')) {
        q.stem = '다음 글의 밑줄 친 부분 중 어법상 적절하지 않은 것은?';
        logFix(filePath, i, 'V62-STEM', `빈칸→밑줄 stem 변경`);
        modified = true;
      } else {
        let ansWord = isWritten ? q.wa : (q.ch && q.ans ? q.ch[q.ans - 1] : null);
        if (ansWord) {
          const esc = escapeRegex(ansWord);
          const rx = new RegExp(`\\b${esc}\\b`, 'i');
          if (rx.test(q.passage)) {
            q.passage = q.passage.replace(rx, '____');
            logFix(filePath, i, 'V62', `빈칸 추가: "${ansWord.slice(0,20)}"`);
            modified = true;
          }
        }
      }
    }

    // === FIX 9: V-WRITTEN-WORDCOUNT ===
    if (isWritten && q.wa && stem) {
      const stemMatch = stem.match(/(\d+)\s*단어/);
      if (stemMatch) {
        const claimed = parseInt(stemMatch[1]);
        const actual = q.wa.split(/\s+/).length;
        if (claimed !== actual) {
          q.stem = stem.replace(/\d+\s*단어/, `${actual}단어`);
          logFix(filePath, i, 'WCOUNT', `${claimed}→${actual}단어`);
          modified = true;
        }
      }
    }

    // === FIX 10: V67-H (함축의미 밑줄) ===
    if (typeNorm.includes('함축') && q.passage && !q.passage.includes('<u>')) {
      if (q.det?.korean) {
        const match = q.det.korean.match(/"([^"]+)"/);
        if (match && q.passage.includes(match[1])) {
          q.passage = q.passage.replace(match[1], `<u>${match[1]}</u>`);
          logFix(filePath, i, 'V67-H', `함축 밑줄`);
          modified = true;
        }
      }
    }

    // === FIX 11: V69 (서술형 문장단위 노출) ===
    if (isWritten && q.wa && q.passage && q.wa.length > 15) {
      const isFindType = FIND_STEM.test(stem);
      if (!isFindType && q.passage.includes(q.wa)) {
        q.passage = q.passage.replace(q.wa, '____');
        logFix(filePath, i, 'V69', `문장노출 마스킹`);
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    filesModified++;
  }
  return modified;
}

// Main
const files = getAllFiles();
console.log(`\n=== 모의고사 전체 자동수정 시작 (${files.length} files) ===\n`);

const start = Date.now();
for (const f of files) {
  processFile(f);
}
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

// Summary by code
const codeCounts = {};
for (const l of log) {
  const m = l.match(/\[(\S+)\]/);
  if (m) codeCounts[m[1]] = (codeCounts[m[1]] || 0) + 1;
}

console.log(`=== 수정 요약 (${elapsed}s) ===`);
console.log(`파일: ${filesModified}/${files.length} 수정`);
console.log(`총 수정: ${totalFixes}건\n`);

const sorted = Object.entries(codeCounts).sort((a, b) => b[1] - a[1]);
for (const [code, count] of sorted) {
  console.log(`  ${String(count).padStart(5)} ${code}`);
}
