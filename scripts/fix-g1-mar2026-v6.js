#!/usr/bin/env node
/**
 * 고1/3월_2026 v6 — 41 FAIL → 0 목표
 *
 * Pass 1: 빈 <u></u> 채우기 (det.analysis에서 단어 추출)
 * Pass 2: SEM-3 ch 순서 → passage 밑줄 순서로 재정렬
 * Pass 3: S-NO-PASSAGE → written Q에 fullPassage 추가
 * Pass 4: S-WA-IN-PASSAGE → wa 마스킹
 * Pass 5: S-PASSAGE-NOT-FULL → fullPassage로 확장 + 오버레이
 * Pass 6: V63-E → 어형변환 괄호 추가
 * Pass 7: P23 → 부적절 어휘 4마커 보장
 * Pass 8: V62 → 빈칸 추가
 * Pass 9: S-WORDCOUNT-MISMATCH
 * Pass 10: V63-C → 어법 passage+stem 이중표시 해결
 * Pass 11: V67-H → 함축의미 밑줄 추가
 * Pass 12: V69 → 서술형 passage 문장노출 마스킹
 * Pass 13: S-ANS-NEAR-BLANK → 빈칸 근처 정답 재배치
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', '모의고사', '고1', '3월_2026');
const log = [];
let totalFixes = 0;

function logFix(file, qi, code, msg) {
  log.push(`${path.basename(path.dirname(file))}/${path.basename(file)} Q${qi+1} [${code}] ${msg}`);
  totalFixes++;
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

// Extract word from det.analysis for a given marker (①②③④)
function getWordFromDet(det, markerNum) {
  if (!det?.analysis) return null;
  const markers = ['①','②','③','④'];
  const marker = markers[markerNum - 1];
  // Pattern: "❌ ② word" or "✅ ② word" or "② word → correct"
  const patterns = [
    new RegExp(`[✅❌]\\s*${marker}\\s+(\\w[\\w\\s-]*?)(?:\\s*[→:—]|\\s*$)`, 'm'),
    new RegExp(`${marker}\\s+(\\w+)`, 'm'),
  ];
  for (const p of patterns) {
    const m = det.analysis.match(p);
    if (m) return m[1].trim().split(/\s/)[0]; // first word
  }
  // Try korean field
  if (det.korean) {
    const kp = new RegExp(`${marker}\\s+(\\w+)`);
    const km = det.korean.match(kp);
    if (km) return km[1].trim();
    // Pattern: "② word → correction"
    const kp2 = det.korean.match(/(\w+)\s*→/);
    if (kp2) return kp2[1].trim();
  }
  return null;
}

function getAllFiles() {
  const results = [];
  const dirs = fs.readdirSync(BASE).filter(d => {
    try { return fs.statSync(path.join(BASE, d)).isDirectory(); } catch { return false; }
  });
  for (const dir of dirs) {
    const dirPath = path.join(BASE, dir);
    for (const f of fs.readdirSync(dirPath).filter(x => x.endsWith('.json'))) {
      results.push(path.join(dirPath, f));
    }
  }
  return results;
}

function processFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fp = data.fullPassage;
  if (!fp || !data.questions) return false;
  let modified = false;

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    const type = q.type || '';
    const isGrammar = type.includes('어법');
    const isInappropriate = type.includes('부적절') || type.includes('오류');
    const isMarkerCh = q.ch && q.ch.every(c => /^[①②③④⑤]$/.test(c));

    // === PASS 1: Fill empty <u></u> from det ===
    if (isGrammar && q.passage && q.det) {
      const emptyUl = q.passage.match(/([①②③④])<u><\/u>/g);
      if (emptyUl) {
        for (const eu of emptyUl) {
          const marker = eu[0]; // ①②③④
          const markerNum = '①②③④'.indexOf(marker) / 1 + 1;
          const mNum = ['①','②','③','④'].indexOf(marker) + 1;
          const word = getWordFromDet(q.det, mNum);
          if (word) {
            q.passage = q.passage.replace(`${marker}<u></u>`, `${marker}<u>${word}</u>`);
            logFix(filePath, i, 'EMPTY-UL', `${marker}<u></u> → ${marker}<u>${word}</u>`);
            modified = true;
          }
        }
      }
    }

    // === PASS 2: SEM-3 ch reorder (word-based ch only) ===
    if (isGrammar && q.ch && q.passage && q.ans && !isMarkerCh) {
      const underlines = getUnderlines(q.passage).filter(u => u.text.length > 0);
      if (underlines.length >= 3 && q.ch.length >= 3) {
        const chWords = q.ch;
        // Map each ch word to its underline position
        const matchMap = [];
        for (let ci = 0; ci < chWords.length; ci++) {
          const cw = chWords[ci].trim();
          let bestUi = -1;
          for (let ui = 0; ui < underlines.length; ui++) {
            const uw = underlines[ui].text;
            if (uw === cw || uw.includes(cw) || cw.includes(uw)) {
              bestUi = ui;
              break;
            }
          }
          matchMap.push(bestUi);
        }

        const allMatched = matchMap.every(m => m >= 0);
        if (allMatched) {
          // Check if not already in order
          let inOrder = true;
          for (let j = 1; j < matchMap.length; j++) {
            if (matchMap[j] <= matchMap[j-1]) { inOrder = false; break; }
          }
          if (!inOrder) {
            // Sort by underline position
            const indexed = matchMap.map((pos, idx) => ({ pos, idx }));
            indexed.sort((a, b) => a.pos - b.pos);

            const oldAnsIdx = q.ans - 1;
            const newCh = indexed.map(x => q.ch[x.idx]);
            const newAnsIdx = indexed.findIndex(x => x.idx === oldAnsIdx);

            if (newAnsIdx >= 0) {
              // Also reorder det array if applicable
              if (q.det && Array.isArray(q.det)) {
                q.det = indexed.map(x => q.det[x.idx]);
              }

              logFix(filePath, i, 'SEM-3', `ch [${q.ch}]→[${newCh}] ans:${q.ans}→${newAnsIdx+1}`);
              q.ch = newCh;
              q.ans = newAnsIdx + 1;
              modified = true;
            }
          }
        }
      }
    }

    // === PASS 3: S-NO-PASSAGE (영작 passage 누락) ===
    if (q.fmt === 'written' && !q.passage) {
      let newP = fp;
      // Remove any markers
      newP = newP.replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1').replace(/[①②③④⑤]/g, '');
      // Mask wa if present
      if (q.wa) {
        const esc = q.wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        newP = newP.replace(new RegExp(`\\b${esc}\\b`, 'gi'), '____');
      }
      q.passage = newP;
      logFix(filePath, i, 'NO-PASS', `passage 추가 (${newP.length}자)`);
      modified = true;
    }

    // === PASS 4: S-WA-IN-PASSAGE (서술형 wa 노출) ===
    if (q.fmt === 'written' && q.wa && q.passage) {
      const stem = q.stem || '';
      const isFindType = stem.includes('찾아') || stem.includes('찾으시오');
      if (!isFindType && q.passage.includes(q.wa)) {
        const esc = q.wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Only mask first occurrence to avoid over-masking
        q.passage = q.passage.replace(new RegExp(`\\b${esc}\\b`, 'i'), '____');
        logFix(filePath, i, 'WA-MASK', `"${q.wa}" → ____`);
        modified = true;
      }
    }

    // === PASS 5: S-PASSAGE-NOT-FULL (mc passage < 85% of fullPassage) ===
    if (q.passage && q.fmt !== 'written') {
      const ratio = q.passage.length / fp.length;
      if (ratio < 0.85) {
        // Skip types that need special overlay
        if (isGrammar || isInappropriate) continue;
        if (type.includes('어형')) continue;

        // For types that can use fullPassage directly
        if (type.includes('내용') || type.includes('주제') || type.includes('제목') ||
            type.includes('요지') || type.includes('T/F') || type.includes('동의') ||
            type.includes('반의') || type.includes('지칭') || type.includes('다의') ||
            type.includes('무관')) {
          q.passage = fp;
          logFix(filePath, i, 'FULL', `passage 확장 (${(ratio*100).toFixed(0)}%→100%)`);
          modified = true;
        } else if (type.includes('빈칸') || type.includes('추론')) {
          // Need to preserve ____ blank
          if (q.passage.includes('____')) {
            // Find what's blanked: compare passage with fullPassage
            // Try to find the blank position in fullPassage
            const beforeBlank = q.passage.split('____')[0];
            const afterBlank = q.passage.split('____').slice(1).join('____');

            // Use fullPassage with the same blank
            if (q.ch && q.ans) {
              const ansWord = q.ch[q.ans - 1];
              if (ansWord && fp.includes(ansWord)) {
                const esc = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const newP = fp.replace(new RegExp(`\\b${esc}\\b`, 'i'), '____');
                if (newP.includes('____')) {
                  q.passage = newP;
                  logFix(filePath, i, 'FULL-BLANK', `빈칸추론 passage 확장`);
                  modified = true;
                }
              }
            }
          } else {
            q.passage = fp;
            logFix(filePath, i, 'FULL', `passage 확장`);
            modified = true;
          }
        } else if (type.includes('(A)(B)(C)') || type.includes('조합')) {
          // Preserve (A)(B)(C) markers
          if (q.passage.includes('(A)')) {
            // Complex - skip auto
          } else {
            q.passage = fp;
            logFix(filePath, i, 'FULL', `passage 확장`);
            modified = true;
          }
        } else if (type.includes('함축')) {
          // Need <u> underline for target phrase
          if (q.passage.includes('<u>')) {
            // Has underline - expand but keep it
            // Find underlined text
            const ulMatch = q.passage.match(/<u>([^<]+)<\/u>/);
            if (ulMatch) {
              const ulText = ulMatch[1];
              if (fp.includes(ulText)) {
                q.passage = fp.replace(ulText, `<u>${ulText}</u>`);
                logFix(filePath, i, 'FULL-UL', `함축 passage 확장 + 밑줄 보존`);
                modified = true;
              }
            }
          }
        } else if (type.includes('문장삽입')) {
          // Need position markers - keep as is
        } else if (type.includes('순서')) {
          // Keep as is
        } else {
          // Default expansion
          q.passage = fp;
          logFix(filePath, i, 'FULL', `passage 확장 (${type})`);
          modified = true;
        }
      }
    }

    // === PASS 6: V63-E (어형변환 괄호) ===
    if (type.includes('어형') && q.stem?.includes('괄호') && q.passage) {
      if (!q.passage.includes('(') && !q.passage.includes('[')) {
        if (q.wa) {
          // Find the wa word in passage and wrap with ()
          const esc = q.wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rx = new RegExp(`\\b${esc}\\b`, 'i');
          if (rx.test(q.passage)) {
            q.passage = q.passage.replace(rx, `(${q.wa})`);
            logFix(filePath, i, 'V63-E', `괄호 추가: (${q.wa})`);
            modified = true;
          } else {
            // wa not in passage directly - check det for base form
            if (q.det?.korean) {
              const det_match = q.det.korean.match(/(\w+)\s*→\s*(\w+)/);
              if (det_match) {
                const orig = det_match[1];
                const esc2 = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const rx2 = new RegExp(`\\b${esc2}\\b`, 'i');
                if (rx2.test(q.passage)) {
                  q.passage = q.passage.replace(rx2, `(${orig})`);
                  logFix(filePath, i, 'V63-E', `괄호 추가: (${orig}) [det 기반]`);
                  modified = true;
                }
              }
            }
          }
        }
      }
    }

    // === PASS 7: P23 부적절 어휘 4마커 ===
    if (isInappropriate && q.passage && q.ch) {
      const markerUlCount = (q.passage.match(/[①②③④]\s*<u>[^<]+<\/u>/g) || []).length;
      if (markerUlCount < 4 && q.det) {
        // Get words from det.analysis
        const analysis = q.det.analysis || '';
        const markers = ['①','②','③','④'];
        for (let mi = 0; mi < 4; mi++) {
          const marker = markers[mi];
          // Check if marker already has underline in passage
          const hasMarkerUl = q.passage.includes(`${marker}<u>`) &&
            q.passage.match(new RegExp(`${marker}<u>[^<]+</u>`));
          if (hasMarkerUl) continue;

          // Find word from det.analysis
          const detPattern = new RegExp(`[✅❌]\\s*${marker}\\s+(\\w+)`, 'm');
          const detMatch = analysis.match(detPattern);
          if (!detMatch) continue;

          const word = detMatch[1];

          // Check if marker exists but underline is empty
          if (q.passage.includes(`${marker}<u></u>`)) {
            q.passage = q.passage.replace(`${marker}<u></u>`, `${marker}<u>${word}</u>`);
            logFix(filePath, i, 'P23-FILL', `${marker}<u></u>→${marker}<u>${word}</u>`);
            modified = true;
            continue;
          }

          // Check if word exists in passage without marker
          const wordEsc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordRx = new RegExp(`(?<![①②③④]<u>)\\b${wordEsc}\\b(?!</u>)`, 'i');
          if (wordRx.test(q.passage)) {
            q.passage = q.passage.replace(wordRx, `${marker}<u>${word}</u>`);
            logFix(filePath, i, 'P23-ADD', `${marker}<u>${word}</u> 추가`);
            modified = true;
          } else {
            // Word not in passage - try from fullPassage
            if (fp.includes(word)) {
              // Rebuild passage from fullPassage
              // Skip for now - needs manual
            }
          }
        }
      }
    }

    // === PASS 8: V62 빈칸 없음 ===
    if (q.stem?.includes('빈칸') && q.passage && !q.passage.includes('____')) {
      let ansWord = null;
      if (q.fmt === 'written' && q.wa) {
        ansWord = q.wa;
      } else if (q.ch && q.ans) {
        ansWord = q.ch[q.ans - 1];
      }
      if (ansWord) {
        const esc = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(`\\b${esc}\\b`, 'i');
        if (rx.test(q.passage)) {
          q.passage = q.passage.replace(rx, '____');
          logFix(filePath, i, 'V62', `빈칸 추가: "${ansWord}" → ____`);
          modified = true;
        }
      }
    }

    // === PASS 9: S-WORDCOUNT-MISMATCH ===
    if (q.fmt === 'written' && q.wa && q.stem) {
      const stemMatch = q.stem.match(/(\d+)\s*단어/);
      if (stemMatch) {
        const claimed = parseInt(stemMatch[1]);
        const actual = q.wa.split(/\s+/).length;
        if (claimed !== actual) {
          q.stem = q.stem.replace(/\d+\s*단어/, `${actual}단어`);
          logFix(filePath, i, 'WCOUNT', `단어수 ${claimed}→${actual}`);
          modified = true;
        }
      }
    }

    // === PASS 10: V63-C 어법 passage+stem 이중표시 ===
    if (isGrammar && q.passage && q.stem) {
      // If passage has underlines AND stem also describes the grammar point
      // Fix: set passage to null when stem alone is sufficient
      // Only fix when validate specifically flags V63-C
      // Pattern: 어법 with both passage containing <u> AND stem containing the question
      // Actually this is rare - skip auto
    }

    // === PASS 11: V67-H 함축의미 밑줄 ===
    if (type.includes('함축') && q.passage && !q.passage.includes('<u>')) {
      // Need to add underline to the target phrase
      if (q.det?.korean) {
        // det.korean often contains the target phrase
        const match = q.det.korean.match(/"([^"]+)"/);
        if (match) {
          const phrase = match[1];
          if (q.passage.includes(phrase)) {
            q.passage = q.passage.replace(phrase, `<u>${phrase}</u>`);
            logFix(filePath, i, 'V67-H', `함축 밑줄 추가: <u>${phrase}</u>`);
            modified = true;
          }
        }
      }
    }

    // === PASS 12: V69 서술형 문장단위 노출 ===
    if (q.fmt === 'written' && q.wa && q.passage) {
      const stem = q.stem || '';
      const isFindType = stem.includes('찾아') || stem.includes('찾으시오');
      if (!isFindType) {
        // Check if wa (as a phrase) appears in passage
        if (q.wa.length > 10 && q.passage.includes(q.wa)) {
          // Long wa phrase in passage - mask it
          q.passage = q.passage.replace(q.wa, '____');
          logFix(filePath, i, 'V69', `문장노출 마스킹: "${q.wa.slice(0,30)}..."`);
          modified = true;
        }
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  return modified;
}

// Main
const files = getAllFiles();
console.log(`\n=== 고1/3월_2026 v6 수정 시작 (${files.length} files) ===\n`);

let modCount = 0;
for (const f of files) {
  if (processFile(f)) modCount++;
}

console.log(`\n--- 수정 로그 (${totalFixes}건) ---`);
for (const l of log) console.log(l);
console.log(`\n=== 완료: ${modCount}/${files.length} 파일 수정, ${totalFixes}건 ===`);
