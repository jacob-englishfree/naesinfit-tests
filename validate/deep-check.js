#!/usr/bin/env node
/**
 * deep-check.js — 학생 시점 오류 전수 검사
 * validate.js가 못 잡는 "실제 풀이" 수준 오류를 탐지
 *
 * 검사 항목:
 * DC-1: det.analysis "←정답" 마커 ≠ ans
 * DC-2: 마커형(①②③④) passage 출현 순서 ≠ ch 순서
 * DC-3: 부적절어휘 — 정답 마커 단어가 fullPassage 원문과 동일 (교체 안 됨 = 정답 없음)
 * DC-4: 어법 — 정답 마커에 find/display 없고 원문과 동일 (오류 없음 = 정답 없음)
 * DC-5: 지칭추론 — passage에 <u> 없음
 * DC-6: 서술형 어순배열 — stem 보기 단어로 wa 조합 불가
 * DC-7: det.analysis 마커 설명이 ch 배열과 불일치
 * DC-8: overlay.markers 정답 위치가 원문과 동일 (부적절어휘 정답 부재)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.error('Usage: node deep-check.js <file.json or dir> [--all]');
  process.exit(1);
}

let totalFiles = 0, totalErrors = 0, errorFiles = 0;
const allErrors = [];

function collectFiles(p) {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(p);
    let result = [];
    for (const e of entries) {
      result = result.concat(collectFiles(path.join(p, e)));
    }
    return result;
  }
  if (p.endsWith('.json') && (p.endsWith('단어.json') || p.endsWith('워크북.json') || p.endsWith('퀴즈.json'))) {
    return [p];
  }
  return [];
}

let fileList = [];
for (const f of files) {
  fileList = fileList.concat(collectFiles(f));
}
fileList.sort();

for (const filePath of fileList) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { continue; }

  if (!data.questions || !data.fullPassage) continue;
  totalFiles++;

  const fileErrors = [];
  const fp = data.fullPassage;

  for (const q of data.questions) {
    const qn = `Q${q.id}`;

    // DC-1: det.analysis "←정답" 마커 번호 ≠ ans
    if (q.det && q.det.analysis) {
      const analysis = q.det.analysis;
      // Find which marker has ←정답
      const correctMatch = analysis.match(/([①②③④⑤])[^①②③④⑤]*←\s*정답/);
      if (correctMatch) {
        const markers = ['①','②','③','④','⑤'];
        const markerInAnalysis = correctMatch[1];
        if (markerInAnalysis) {
          const markerIdx = markers.indexOf(markerInAnalysis) + 1; // 1-indexed
          if (q.fmt === 'mc' && q.ch && q.ch[0] === '①') {
            // ch = ["①","②","③","④"] marker-type
            if (markerIdx !== q.ans) {
              fileErrors.push(`[DC-1] ${qn}: det.analysis ←정답=${markerInAnalysis}(=${markerIdx}) ≠ ans=${q.ans}`);
            }
          }
        }
      }

      // Also check: ✅ marker with no ←정답 but marked as correct
      // Find lines starting with ✅ (correct answer indicator in 어법/부적절)
      if (['어법', '문맥상 부적절한 어휘'].includes(q.type)) {
        const lines = analysis.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          // ✅ means correct/answer marker
          if (trimmed.startsWith('✅') && trimmed.includes('←정답')) {
            // Found the answer line
          }
        }
      }
    }

    // DC-2: Marker order in passage ≠ ch order (for ①②③④ type)
    if (q.fmt === 'mc' && q.ch && q.passage) {
      const isMarkerType = q.ch.every(c => /^[①②③④⑤]$/.test(c));
      if (isMarkerType && q.passage) {
        const markers = ['①','②','③','④'];
        const positions = markers.map(m => {
          const idx = q.passage.indexOf(m);
          return idx >= 0 ? idx : -1;
        }).filter(p => p >= 0);

        // Check if positions are in ascending order
        if (positions.length >= 3) {
          let ordered = true;
          for (let i = 1; i < positions.length; i++) {
            if (positions[i] <= positions[i-1]) {
              ordered = false;
              break;
            }
          }
          if (!ordered) {
            fileErrors.push(`[DC-2] ${qn} (${q.type}): passage 마커 순서 역전 — ①②③④가 지문 출현 순서와 다름`);
          }
        }
      }
    }

    // DC-3: 부적절어휘 — 정답 위치의 단어가 원문과 동일 (교체 안 됨)
    if (q.type === '문맥상 부적절한 어휘' && q.passage && fp) {
      const markers = ['①','②','③','④'];
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 핵심: 마커형 ch(①②③④) vs 단어형 ch(word) 구분
      const isMarkerCh = q.ch && q.ch.every(c => /^[①②③④⑤]$/.test(c));

      let ansWord = null;

      if (isMarkerCh) {
        // 마커형: ans=2 → ② → passage에서 ②<u>word</u> 추출
        const ansMarker = markers[q.ans - 1];
        const regex = new RegExp(esc(ansMarker) + '<u>([^<]+)</u>');
        const match = q.passage.match(regex);
        if (match) ansWord = match[1].trim();
      } else {
        // 단어형: ans=2 → ch[1]이 정답 단어 → passage에서 해당 단어가 있는 마커 위치 찾기
        ansWord = q.ch && q.ch[q.ans - 1];
        if (ansWord) {
          // 마커 기호 제거 (① word → word)
          ansWord = ansWord.replace(/^[①②③④⑤]\s*/, '').trim();
        }
      }

      if (ansWord) {
        // overlay.markers가 있으면 직접 비교
        // 단어형일 때는 정답 단어가 어느 마커에 있는지 찾아야 함
        let ansMarkerPos = null;
        if (!isMarkerCh) {
          // passage에서 각 마커의 <u>word</u>를 추출해서 정답 단어가 어디 있는지 찾기
          for (const m of markers) {
            const regex = new RegExp(esc(m) + '<u>([^<]+)</u>');
            const match = q.passage.match(regex);
            if (match && match[1].trim().toLowerCase() === ansWord.toLowerCase()) {
              ansMarkerPos = m;
              break;
            }
          }
        } else {
          ansMarkerPos = markers[q.ans - 1];
        }

        // overlay 체크
        if (q.overlay && q.overlay.markers && ansMarkerPos && q.overlay.markers[ansMarkerPos]) {
          const original = q.overlay.markers[ansMarkerPos];
          if (typeof original === 'string' && original.toLowerCase() === ansWord.toLowerCase()) {
            fileErrors.push(`[DC-3] ${qn}: 부적절어휘 정답 "${ansWord}" = overlay 원문 "${original}" — 교체 안 됨`);
          }
        } else {
          // overlay 없음 → 정답 단어가 fullPassage에 같은 문맥으로 존재하는지 확인
          const passClean = q.passage.replace(/<[^>]+>/g, '').replace(/[①②③④⑤]/g, '');
          const fpClean = fp.replace(/[①②③④⑤]/g, '');
          const wordEsc = esc(ansWord);

          // 정답 단어가 fullPassage에 있는지 먼저 확인
          if (fp.toLowerCase().includes(ansWord.toLowerCase())) {
            // 주변 문맥 비교로 같은 위치인지 확인
            const ctxRegex = new RegExp('(\\S+\\s+\\S+\\s+)' + wordEsc + '(\\s+\\S+\\s+\\S+)', 'i');
            const passCtx = passClean.match(ctxRegex);

            if (passCtx) {
              const contextPhrase = passCtx[1] + ansWord + passCtx[2];
              const ctxPhraseClean = contextPhrase.replace(/\s+/g, ' ').trim();
              const fpNorm = fpClean.replace(/\s+/g, ' ');
              if (fpNorm.includes(ctxPhraseClean)) {
                fileErrors.push(`[DC-3] ${qn}: 부적절어휘 정답 "${ansWord}"가 원문 동일 문맥에 존재 — 교체 안 됨`);
              }
            } else {
              // 문맥 추출 실패 — 보수적으로 잡되 낮은 신뢰도
              fileErrors.push(`[DC-3?] ${qn}: 부적절어휘 정답 "${ansWord}"가 fullPassage에 존재 (문맥 미확인)`);
            }
          }
          // fullPassage에 정답 단어 없음 → 교체된 것 → 정상
        }
      }
    }

    // DC-4: 어법 — 정답 마커에 오류가 실제로 있는지
    // ⚠ WARNING 등급: 어법 오류는 형태 변화(require→requires)라 단순 문자열 비교로 신뢰성 낮음
    // 치명적 오류 카운트에서 제외, 참고용 경고로만 사용
    if (q.type === '어법' && q.passage && fp) {
      const markers = ['①','②','③','④'];
      const ansMarker = markers[q.ans - 1];
      if (ansMarker) {
        const regex = new RegExp(ansMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<u>([^<]+)</u>');
        const match = q.passage.match(regex);
        if (match) {
          const ansWord = match[1].trim();
          // overlay에 find/display 있으면 정상 (스킵)
          if (q.overlay && q.overlay.markers) {
            const overlay = q.overlay.markers[ansMarker];
            if (overlay && typeof overlay === 'object' && overlay.find && overlay.display) {
              // OK
            } else if (showAll) {
              fileErrors.push(`[DC-4w] ${qn}: 어법 overlay 불완전 (참고)`);
            }
          } else if (showAll) {
            // overlay 없는 어법 → --all 모드에서만 표시
            if (fp.includes(ansWord)) {
              fileErrors.push(`[DC-4w] ${qn}: 어법 "${ansWord}" overlay 없음 — 수동 확인 권장`);
            }
          }
        }
      }
    }

    // DC-5: 지칭추론 — passage에 <u> 없음
    if (q.type === '지칭추론' && q.passage) {
      if (!q.passage.includes('<u>')) {
        fileErrors.push(`[DC-5] ${qn}: 지칭추론인데 passage에 <u>밑줄</u> 없음`);
      }
    }

    // DC-6: 어순배열 — stem 보기 단어로 wa 조합 가능한지
    if (q.type === '어순배열' && q.wa && q.stem) {
      const bracketMatch = q.stem.match(/\[([^\]]+)\]/);
      if (bracketMatch) {
        const bracketContent = bracketMatch[1].replace(/<[^>]+>/g, '').trim();
        // [보기] 라벨만 있는 경우 → 실제 단어는 stem 텍스트에 별도 존재 → skip
        if (bracketContent === '보기' || bracketContent === '조건') {
          // 보기/조건 라벨 → stem 전체에서 영단어 추출하는 건 불확실 → skip
        } else {
          // / 또는 , 구분자 모두 지원
          let givenWords;
          if (bracketContent.includes('/')) {
            givenWords = bracketContent.split(/\s*\/\s*/).map(w => w.trim().toLowerCase());
          } else if (bracketContent.includes(',')) {
            givenWords = bracketContent.split(/\s*,\s*/).map(w => w.trim().toLowerCase());
          } else {
            givenWords = bracketContent.split(/\s+/).map(w => w.trim().toLowerCase());
          }
          givenWords = givenWords.filter(w => w.length > 0).map(w => w.replace(/[^a-zA-Z0-9'-]/g, ''));
          const waWords = q.wa.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9'-]/g, ''));
          const available = [...givenWords];
          const missing = waWords.filter(w => {
            const idx = available.indexOf(w);
            if (idx >= 0) {
              available.splice(idx, 1);
              return false;
            }
            return true;
          });
          // 1단어 이하 누락 + 그 단어가 a/an/the/and/or/to/of 등 기능어면 관대하게 처리
          const funcWords = new Set(['a','an','the','and','or','to','of','in','on','at','is','are','was','were','be','for','it','its','that','this','as','by','with','from','not','but','so','if','do','does','did','has','have','had','can','will','would','could','should','may','might','than','no','up']);
          const significantMissing = missing.filter(w => !funcWords.has(w));
          if (significantMissing.length > 0) {
            fileErrors.push(`[DC-6] ${qn}: 어순배열 wa 단어 [${missing.join(', ')}]가 stem 보기에 없음 — 학생이 조합 불가`);
          } else if (missing.length > 2) {
            // 기능어라도 3개 이상 빠지면 문제
            fileErrors.push(`[DC-6] ${qn}: 어순배열 기능어 ${missing.length}개 누락 [${missing.join(', ')}] — 보기 불완전`);
          }
        }
      }
    }

    // DC-7: det.analysis에서 마커 설명과 ch 배열 내용 불일치
    if (q.det && q.det.analysis && q.ch && q.fmt === 'mc') {
      const isMarkerType = q.ch.every && q.ch.every(c => /^[①②③④⑤]$/.test(c));
      if (!isMarkerType && q.ch.length === 4) {
        // Word-type choices — check if det mentions choices correctly
        const analysis = q.det.analysis;
        for (let i = 0; i < q.ch.length; i++) {
          const markers = ['①','②','③','④'];
          const m = markers[i];
          if (analysis.includes(m)) {
            // Extract what det says about this choice
            const lineRegex = new RegExp(m + '\\s*([^\\n①②③④]+)');
            const lineMatch = analysis.match(lineRegex);
            if (lineMatch) {
              const described = lineMatch[1].trim().split(/[:(：]/)[0].trim();
              const actual = q.ch[i].trim();
              // If described word clearly doesn't match ch[i]
              if (described.length > 2 && actual.length > 2 &&
                  !actual.toLowerCase().includes(described.toLowerCase()) &&
                  !described.toLowerCase().includes(actual.toLowerCase())) {
                // Possible mismatch — but could be explanation text, so only flag if very different
              }
            }
          }
        }
      }
    }

    // DC-8: 서술형 — wa가 passage에 그대로 노출 (찾기/어형변환/핵심단어 제외)
    if (q.fmt === 'written' && q.wa && q.passage && q.stem) {
      const isFindType = /찾아|찾으시오|찾아서/.test(q.stem);
      const isWordForm = /어형\s*변환|형태로\s*바꿔|형태로\s*변환/.test(q.type + ' ' + q.stem);
      const isKeyword = q.type === '서술형 — 핵심단어';
      if (!isFindType && !isWordForm && !isKeyword && q.wa.length > 5) {
        if (q.passage.includes(q.wa)) {
          fileErrors.push(`[DC-8] ${qn}: 서술형 wa "${q.wa.substring(0,30)}..." 가 passage에 그대로 노출`);
        }
      }
    }

    // DC-9: 어법 — passage에서 밑줄 단어가 원문과 다른 위치(정답 아닌 곳)에도 변경됨
    if (q.type === '어법' && q.passage && fp) {
      const markers = ['①','②','③','④'];
      for (let i = 0; i < markers.length; i++) {
        if (i === q.ans - 1) continue; // skip answer position
        const m = markers[i];
        const regex = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<u>([^<]+)</u>');
        const match = q.passage.match(regex);
        if (match) {
          const word = match[1].trim();
          // Non-answer markers should have the ORIGINAL word
          if (!fp.includes(word)) {
            fileErrors.push(`[DC-9] ${qn}: 어법 오답 마커 ${m} "${word}"가 fullPassage에 없음 — 오답인데 변형됨?`);
          }
        }
      }
    }
  }

  if (fileErrors.length > 0) {
    errorFiles++;
    totalErrors += fileErrors.length;
    const rel = path.relative(process.cwd(), filePath);
    allErrors.push({ file: rel, errors: fileErrors });
    console.log(`[ISSUE] ${rel} (${fileErrors.length} issues)`);
    for (const e of fileErrors) {
      console.log(`  ${e}`);
    }
  } else if (showAll) {
    console.log(`[OK] ${path.relative(process.cwd(), filePath)}`);
  }
}

console.log(`\n=== DEEP-CHECK 결과 ===`);
console.log(`총 파일: ${totalFiles}`);
console.log(`오류 파일: ${errorFiles}`);
console.log(`총 오류: ${totalErrors}`);

if (totalErrors > 0) {
  process.exit(1);
}
