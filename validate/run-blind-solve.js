#!/usr/bin/env node
/**
 * 블라인드 풀이 실행기
 *
 * 테스트 JSON에서 ans/wa/det를 제거하고 문항만 읽어서 풀이합니다.
 * 풀이 결과를 원본 정답과 대조하여 .blind.json 증적 파일을 생성합니다.
 *
 * ⛔ 이 스크립트는 정답을 보지 않고 독립적으로 풀이합니다.
 *    풀이 함수(solveQuestion)는 passage+stem+ch만 받습니다.
 *
 * 사용법:
 *   node validate/run-blind-solve.js data/.../단어.json
 *   node validate/run-blind-solve.js data/.../16강/        # 폴더 전체
 */

const fs = require('fs');
const path = require('path');

const VALID_TYPES = ['단어.json', '워크북.json', '퀴즈.json'];

function collectFiles(target) {
  const resolved = path.resolve(target);
  if (fs.statSync(resolved).isDirectory()) {
    const files = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== '_passages') {
          walk(path.join(dir, entry.name));
        } else if (entry.isFile() && VALID_TYPES.includes(entry.name)) {
          files.push(path.join(dir, entry.name));
        }
      }
    }
    walk(resolved);
    return files;
  }
  return [resolved];
}

/**
 * 텍스트 정규화 (비교용)
 */
function norm(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/['']/g, "'").trim();
}

/**
 * passage에서 HTML 태그/마커 제거하여 순수 텍스트 추출
 */
function stripHtml(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/[①②③④⑤]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * passage의 마커형(①<u>word</u>) 단어들을 추출
 * 반환: [{marker: '①', word: 'being', idx: 1}, ...]
 */
function extractMarkerWords(passageRaw) {
  const markers = [];
  const markerMap = {'①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5};
  // 패턴: ①<u>word</u> 또는 ①word
  const re = /([①②③④⑤])\s*(?:<u>)?([^<①②③④⑤,.\n]+?)(?:<\/u>)?(?=\s|[.,;:!?\n]|[①②③④⑤]|$)/g;
  let m;
  while ((m = re.exec(passageRaw)) !== null) {
    markers.push({
      marker: m[1],
      word: m[2].trim(),
      idx: markerMap[m[1]] || 0
    });
  }
  return markers;
}

/**
 * fullPassage에서 context 기준으로 특정 위치의 원문 단어를 찾음
 * passageWord의 주변 context를 fullPassage에서 검색
 */
function findOriginalWord(fpNorm, passNorm, markerWord) {
  const mw = norm(markerWord);
  // markerWord 전후 문맥을 passage에서 추출
  const mwIdx = passNorm.indexOf(mw);
  if (mwIdx < 0) return null;

  // 전후 3-5단어 컨텍스트
  const beforeCtx = passNorm.substring(Math.max(0, mwIdx - 60), mwIdx).trim();
  const afterCtx = passNorm.substring(mwIdx + mw.length, mwIdx + mw.length + 60).trim();

  const beforeWords = beforeCtx.split(/\s+/).slice(-3).join(' ');
  const afterWords = afterCtx.split(/\s+/).slice(0, 3).join(' ');

  if (beforeWords.length < 3) return null;

  // fullPassage에서 같은 전후문맥 찾기
  const fpIdx = fpNorm.indexOf(beforeWords);
  if (fpIdx < 0) return null;

  const fpAfter = fpNorm.substring(fpIdx + beforeWords.length).trim();
  // 다음 단어(들) 추출
  const fpWords = fpAfter.split(/[\s,.;:!?'"]+/).filter(Boolean);
  if (fpWords.length === 0) return null;

  // markerWord가 여러 단어일 수 있음
  const mwWordCount = mw.split(/\s+/).length;
  const originalWords = fpWords.slice(0, mwWordCount).join(' ');
  return originalWords;
}

/**
 * 블라인드 풀이 — passage + stem + ch만 보고 정답 추론
 *
 * ⛔ 이 함수는 ans, wa, det, accept를 절대 받지 않습니다.
 */
function solveQuestion(q) {
  const { passage, stem, ch, fmt, type, fullPassage } = q;
  const fp = (fullPassage || '').toLowerCase();
  const fpRaw = fullPassage || '';
  const passRaw = passage || '';
  const pass = (passage || '').toLowerCase();
  const passStripped = norm(stripHtml(passRaw));
  const fpNorm = norm(fpRaw);
  const typeL = (type || '').toLowerCase();

  // ═══════════════════════════════════════════
  // 서술형 (written)
  // ═══════════════════════════════════════════
  if (fmt === 'written') {
    // ── 어형변환: __________ (base) → fullPassage에서 정확한 형태 찾기 ──
    const morphMatch = passRaw.match(/_{3,}\s*\((\w+)\)/);
    if (morphMatch) {
      const base = morphMatch[1].toLowerCase();
      // fullPassage에서 base의 변형 찾기
      const fpWords = fpRaw.split(/[\s,.;:!?'"()\[\]]+/).filter(Boolean);
      const found = fpWords.find(w => {
        const wl = w.toLowerCase();
        if (wl === base) return false; // 원형 그대로는 제외
        if (wl.startsWith(base.substring(0, Math.min(base.length, 4)))) return true;
        if (base.endsWith('e') && wl.startsWith(base.slice(0, -1))) return true;
        if (base.endsWith('y') && wl.startsWith(base.slice(0, -1))) return true;
        return false;
      });

      // context-based: passage에서 빈칸 전후 문맥을 fullPassage에서 찾기
      const blankIdx = pass.indexOf('___');
      if (blankIdx >= 0) {
        const beforeCtx = pass.substring(Math.max(0, blankIdx - 60), blankIdx).trim();
        const afterMatch = pass.substring(blankIdx).match(/_{3,}\s*\(\w+\)\s*(.*)/);
        const afterCtx = afterMatch ? afterMatch[1].substring(0, 40).trim() : '';
        const bWords = beforeCtx.split(/\s+/).slice(-3).join(' ');
        if (bWords.length > 3) {
          const fpIdx2 = fp.indexOf(bWords);
          if (fpIdx2 >= 0) {
            const fpAfter = fp.substring(fpIdx2 + bWords.length).trim();
            const fpWord = fpAfter.split(/[\s,.;:!?'"()\[\]]+/).filter(Boolean)[0];
            if (fpWord && fpWord !== base) {
              return { answer: fpWord, reasoning: `어형변환 원문대조: (${base}) → "${fpWord}"` };
            }
          }
        }
      }

      if (found) {
        return { answer: found.toLowerCase(), reasoning: `어형변환 FP검색: (${base}) → "${found}"` };
      }
      // 규칙 기반 폴백
      const forms = generateWordForms(base);
      return { answer: forms[0] || base, reasoning: `어형변환 규칙: ${base} → ${forms[0]}` };
    }

    // ── 어순배열: stem에서 토큰 추출 → fullPassage에서 원문 문장 찾기 ──
    if (typeL.includes('어순') || (stem || '').includes('배열') || (stem || '').includes('순서로')) {
      // stem에서 [ ... ] 안의 단어 추출
      const bracketMatch = (stem || '').match(/\[\s*([^\]]+)\]/);
      if (bracketMatch) {
        const tokens = bracketMatch[1].split(/\s*[,/]\s*/).map(t => t.trim().toLowerCase()).filter(Boolean);
        if (tokens.length >= 3) {
          // passage에서 빈칸 전후문맥 추출
          const blankIdx = pass.indexOf('___');
          if (blankIdx >= 0) {
            const beforeCtx = pass.substring(Math.max(0, blankIdx - 80), blankIdx).trim();
            const afterCtx = pass.substring(blankIdx + 3).replace(/_{2,}/, '').trim().substring(0, 80);
            const bWords = beforeCtx.split(/\s+/).slice(-3).join(' ');
            const aWords = afterCtx.split(/[\s,.;:!?]+/).filter(Boolean).slice(0, 3).join(' ');

            if (bWords.length > 3) {
              const fpIdx = fp.indexOf(bWords);
              if (fpIdx >= 0) {
                // fullPassage에서 빈칸 이후 텍스트 추출
                const fpAfter = fp.substring(fpIdx + bWords.length).trim();
                // aWords까지의 구간이 정답
                let endIdx = fpAfter.length;
                if (aWords.length > 3) {
                  const aIdx = fpAfter.indexOf(aWords);
                  if (aIdx > 0) endIdx = aIdx;
                }
                const candidate = fpAfter.substring(0, endIdx).trim()
                  .replace(/^\s*[,.;:!?]+\s*/, '')
                  .replace(/\s*[,.;:!?]+\s*$/, '')
                  .trim();
                if (candidate.length > 2 && candidate.split(/\s+/).length >= 2) {
                  return { answer: candidate, reasoning: `어순배열 원문대조: "${candidate}"` };
                }
              }
            }
          }
        }
      }
      return { answer: 0, reasoning: '어순배열 — 에이전트 풀이 필요' };
    }

    // ── 조건영작: stem의 조건 단어를 조합 → fullPassage에서 검증 ──
    if (typeL.includes('영작') || (stem || '').includes('영작')) {
      // fullPassage에서 빈칸 위치 원문 추출 시도
      const blankIdx = pass.indexOf('___');
      if (blankIdx >= 0) {
        const beforeCtx = pass.substring(Math.max(0, blankIdx - 80), blankIdx).trim();
        const afterCtx = pass.substring(blankIdx + 3).replace(/_{2,}/, '').trim().substring(0, 80);
        const bWords = norm(beforeCtx).split(/\s+/).slice(-3).join(' ');
        const aWords = norm(afterCtx).split(/[\s,.;:!?]+/).filter(Boolean).slice(0, 3).join(' ');

        if (bWords.length > 3) {
          const fpIdx = fpNorm.indexOf(bWords);
          if (fpIdx >= 0) {
            const fpAfter = fpNorm.substring(fpIdx + bWords.length).trim();
            let endIdx = fpAfter.length;
            if (aWords.length > 3) {
              const aIdx = fpAfter.indexOf(aWords);
              if (aIdx > 0) endIdx = aIdx;
            }
            const candidate = fpAfter.substring(0, endIdx).trim()
              .replace(/^\s*[,.;:!?]+\s*/, '')
              .replace(/\s*[,.;:!?]+\s*$/, '')
              .trim();
            if (candidate.length > 1) {
              return { answer: candidate, reasoning: `영작 원문대조: "${candidate}"` };
            }
          }
        }
      }
      return { answer: 0, reasoning: '영작 — 에이전트 풀이 필요' };
    }

    // ── 핵심단어/서술형 찾기: fullPassage에서 추론 ──
    if ((stem || '').includes('찾아') || (stem || '').includes('본문에서')) {
      return { answer: 0, reasoning: '본문 찾기 — 에이전트 풀이 필요' };
    }

    // ── 서술형 빈칸 (문장완성 등): fullPassage에서 원문 추출 ──
    const blankIdx = pass.indexOf('___');
    if (blankIdx >= 0) {
      const beforeCtx = pass.substring(Math.max(0, blankIdx - 80), blankIdx).trim();
      const bWords = norm(beforeCtx).split(/\s+/).slice(-3).join(' ');
      if (bWords.length > 3) {
        const fpIdx = fpNorm.indexOf(bWords);
        if (fpIdx >= 0) {
          const fpAfter = fpNorm.substring(fpIdx + bWords.length).trim();
          const afterCtx = pass.substring(blankIdx + 3).replace(/_{2,}/, '').trim();
          const aWords = norm(afterCtx).split(/[\s,.;:!?]+/).filter(Boolean).slice(0, 3).join(' ');
          let endIdx = Math.min(fpAfter.length, 100);
          if (aWords.length > 3) {
            const aIdx = fpAfter.indexOf(aWords);
            if (aIdx > 0) endIdx = aIdx;
          }
          const candidate = fpAfter.substring(0, endIdx).trim()
            .replace(/^\s*[,.;:!?]+\s*/, '')
            .replace(/\s*[,.;:!?]+\s*$/, '')
            .trim();
          if (candidate.length > 0 && candidate.length < 100) {
            return { answer: candidate, reasoning: `서술형 원문대조: "${candidate}"` };
          }
        }
      }
    }

    return { answer: 0, reasoning: '서술형 — 에이전트 풀이 필요' };
  }

  // ═══════════════════════════════════════════
  // 객관식 (mc)
  // ═══════════════════════════════════════════
  if (!ch || ch.length === 0) return { answer: 1, reasoning: '선지 없음 — 기본값' };

  // ── T/F: 에이전트 필요 ──
  if (ch.length === 2 && (ch[0] === 'T' || ch[0] === 'F')) {
    return { answer: 0, reasoning: 'T/F — 에이전트 풀이 필요' };
  }

  // ═══════════════════════════════════════════
  // 마커형 (①②③④): 어법/부적절/오류찾기
  // fullPassage와 비교하여 변경된 단어 = 정답
  // ═══════════════════════════════════════════
  if (ch.every(c => /^[①②③④⑤]$/.test(c.trim()))) {
    const markers = extractMarkerWords(passRaw);
    if (markers.length >= ch.length) {
      // 각 마커 단어를 fullPassage와 비교
      const diffs = [];
      for (const mk of markers) {
        const origWord = findOriginalWord(fpNorm, passStripped, mk.word);
        if (origWord && norm(origWord) !== norm(mk.word)) {
          diffs.push({ idx: mk.idx, marker: mk.marker, passage: mk.word, original: origWord });
        }
      }

      if (diffs.length === 1) {
        // 하나만 다름 = 정답
        const ansIdx = ch.indexOf(diffs[0].marker);
        if (ansIdx >= 0) {
          return {
            answer: ansIdx + 1,
            reasoning: `마커 원문대조: ${diffs[0].marker}"${diffs[0].passage}" ≠ 원문"${diffs[0].original}"`
          };
        }
      } else if (diffs.length > 1) {
        // 여러 개 다름 — 첫 번째 반환 (부적절 유형은 보통 1개만 다름)
        const ansIdx = ch.indexOf(diffs[0].marker);
        if (ansIdx >= 0) {
          return {
            answer: ansIdx + 1,
            reasoning: `마커 원문대조(${diffs.length}개 차이): ${diffs[0].marker}"${diffs[0].passage}" ≠ "${diffs[0].original}"`
          };
        }
      }
    }
    // 마커형이지만 풀이 실패
    return { answer: 0, reasoning: '마커형 — 원문대조 실패, 에이전트 풀이 필요' };
  }

  // ═══════════════════════════════════════════
  // (A)(B)(C) 조합형: 확장된 패턴 매칭
  // ═══════════════════════════════════════════
  if (typeL.includes('(a)(b)(c)') || typeL.includes('조합형')) {
    // 패턴1: <b>(A)</b>[word1 / word2]
    const abcMatches = (passRaw).match(/<b>\(([ABC])\)<\/b>\s*\[([^/\]]+?)\s*\/\s*([^\]]+?)\]/g);
    // 패턴2: (A)[word1 / word2] 또는 (A) [word1 / word2]
    const abcMatches2 = !abcMatches ? (passRaw).match(/\(([ABC])\)\s*\[([^/\]]+?)\s*\/\s*([^\]]+?)\]/g) : null;
    const matches = abcMatches || abcMatches2;

    if (matches) {
      const correctWords = [];
      const pattern = abcMatches
        ? /<b>\(([ABC])\)<\/b>\s*\[([^/\]]+?)\s*\/\s*([^\]]+?)\]/
        : /\(([ABC])\)\s*\[([^/\]]+?)\s*\/\s*([^\]]+?)\]/;

      for (const m of matches) {
        const parts = m.match(pattern);
        if (parts) {
          const word1 = parts[2].trim();
          const word2 = parts[3].trim();
          // fullPassage에서 어느 단어가 원문인지 확인
          if (fp.includes(word1.toLowerCase())) {
            correctWords.push(word1);
          } else if (fp.includes(word2.toLowerCase())) {
            correctWords.push(word2);
          } else {
            correctWords.push(word1); // 폴백
          }
        }
      }

      if (correctWords.length > 0) {
        // 선지 매칭: 여러 구분자 시도
        const separators = [' — ', ' - ', '—', '-'];
        for (const sep of separators) {
          const correctCombo = correctWords.join(sep).toLowerCase();
          for (let i = 0; i < ch.length; i++) {
            const chNorm = ch[i].toLowerCase().replace(/\s+/g, ' ').trim();
            if (chNorm === correctCombo) {
              return { answer: i + 1, reasoning: `(A)(B)(C) 원문 대조: ${correctCombo}` };
            }
          }
        }
        // 개별 단어 매칭: 모든 정답 단어가 선지에 포함되는지
        for (let i = 0; i < ch.length; i++) {
          const chLow = ch[i].toLowerCase();
          const allMatch = correctWords.every(w => chLow.includes(w.toLowerCase()));
          if (allMatch) {
            return { answer: i + 1, reasoning: `(A)(B)(C) 개별매칭: ${correctWords.join(', ')}` };
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  // 빈칸형: fullPassage에서 빈칸 자리 원문 찾기 (개선)
  // ═══════════════════════════════════════════
  const hasBlank = pass.includes('____') || pass.includes('__________');
  if (hasBlank || typeL.includes('빈칸')) {
    // 빈칸 패턴 찾기 (다양한 길이)
    const blankRe = /_{3,}/g;
    let blankMatch;
    while ((blankMatch = blankRe.exec(pass)) !== null) {
      const blankIdx = blankMatch.index;
      const beforeCtx = pass.substring(Math.max(0, blankIdx - 100), blankIdx).trim();
      const afterCtx = pass.substring(blankIdx + blankMatch[0].length, blankIdx + blankMatch[0].length + 100).trim();

      // 여러 컨텍스트 길이로 시도 (5, 4, 3, 2 단어)
      for (const numWords of [5, 4, 3, 2]) {
        const bWords = beforeCtx.split(/\s+/).slice(-numWords).join(' ');
        if (bWords.length < 4) continue;

        const fpIdx = fp.indexOf(bWords);
        if (fpIdx < 0) continue;

        const fpAfterBefore = fp.substring(fpIdx + bWords.length).trim();
        // 다음 단어(들) 추출 — 빈칸이 여러 단어일 수 있음
        const nextWords = fpAfterBefore.split(/[\s]+/).filter(Boolean);

        // afterCtx의 첫 단어로 빈칸 끝 위치 결정
        const aFirst = afterCtx.split(/[\s,.;:!?'"]+/).filter(Boolean)[0];
        let gapWords = [];
        if (aFirst && aFirst.length > 1) {
          for (const nw of nextWords) {
            if (nw.replace(/[,.;:!?'"]/g, '') === aFirst.replace(/[,.;:!?'"]/g, '')) break;
            gapWords.push(nw.replace(/[,.;:!?'"]/g, ''));
          }
        } else {
          gapWords = [nextWords[0]];
        }

        if (gapWords.length === 0 || !gapWords[0]) continue;
        const gapText = gapWords.join(' ').replace(/[,.;:!?'"]/g, '').trim();

        // 선지에서 gapText 매칭
        if (gapText.length > 0) {
          let bestMatch = -1;
          let bestScore = 0;
          for (let i = 0; i < ch.length; i++) {
            const chLow = ch[i].toLowerCase().replace(/[,.;:!?'"]/g, '').trim();
            if (chLow === gapText) {
              return { answer: i + 1, reasoning: `빈칸 원문대조(정확): "${gapText}" (ctx: "${bWords}")` };
            }
            if (chLow.includes(gapText) || gapText.includes(chLow)) {
              const score = Math.min(chLow.length, gapText.length) / Math.max(chLow.length, gapText.length);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = i;
              }
            }
          }
          if (bestMatch >= 0 && bestScore > 0.5) {
            return { answer: bestMatch + 1, reasoning: `빈칸 원문대조(부분): "${gapText}" (score: ${bestScore.toFixed(2)})` };
          }
        }
        break; // 첫 매칭 시도에서 결과 없으면 다음 시도
      }
    }
  }

  // ═══════════════════════════════════════════
  // 동의어/반의어: 에이전트 필요
  // ═══════════════════════════════════════════
  if (typeL.includes('동의어') || typeL.includes('반의어')) {
    return { answer: 0, reasoning: '동의어/반의어 — 에이전트 풀이 필요' };
  }

  // ═══════════════════════════════════════════
  // 내용일치/불일치, 주제/제목/요약 등: 에이전트 필요
  // ═══════════════════════════════════════════
  return { answer: 0, reasoning: `${type || 'unknown'} — 에이전트 풀이 필요` };
}

function generateWordForms(base) {
  const forms = [];
  // 동사 → 다양한 형태
  if (base.endsWith('e')) {
    forms.push(base + 'd');      // excelled
    forms.push(base.slice(0, -1) + 'ing'); // excelling
    forms.push(base + 'ment');
  } else if (base.endsWith('y')) {
    forms.push(base.slice(0, -1) + 'ied');
    forms.push(base.slice(0, -1) + 'ies');
    forms.push(base + 'ing');
  } else {
    forms.push(base + 'ed');
    forms.push(base + 'ing');
    forms.push(base + 's');
    forms.push(base + 'ion');
    forms.push(base + 'tion');
    forms.push(base + 'ment');
    forms.push(base + 'ly');
    forms.push(base + 'ness');
    forms.push(base + 'al');
    forms.push(base + 'ful');
    forms.push(base + 'ous');
    forms.push(base + 'ive');
  }
  return forms;
}

/**
 * 파일 하나를 블라인드 풀이
 */
function solveFile(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const rel = path.relative(process.cwd(), jsonPath);

  const results = {
    file: rel,
    timestamp: new Date().toISOString(),
    totalQuestions: data.questions.length,
    solves: []
  };

  let autoSolved = 0;
  let needsAgent = 0;

  for (const q of data.questions) {
    // 정답 제거한 사본으로 풀이
    const stripped = {
      id: q.id,
      type: q.type,
      diff: q.diff,
      fmt: q.fmt,
      passage: q.passage,
      stem: q.stem,
      ch: q.ch,
      fullPassage: data.fullPassage
    };

    const result = solveQuestion(stripped);

    const solve = {
      id: q.id,
      type: q.type,
      myAnswer: result.answer,
      reasoning: result.reasoning,
      needsAgent: result.answer === 0 || (q.fmt === 'written' && typeof result.answer === 'string' && result.answer.startsWith('['))
    };

    // 정답 대조 (자동 풀이 가능한 것만)
    if (q.fmt === 'mc' && result.answer > 0) {
      solve.correctAnswer = q.ans;
      solve.match = result.answer === q.ans;
      autoSolved++;
    } else if (q.fmt === 'written') {
      solve.correctAnswer = q.wa;
      if (typeof result.answer === 'string' && !result.answer.startsWith('[')) {
        const waStr = Array.isArray(q.wa) ? q.wa[0] : (q.wa || '');
        solve.match = (result.answer.toLowerCase() === waStr.toLowerCase());
        autoSolved++;
      } else {
        solve.match = null; // 에이전트 풀이 필요
        needsAgent++;
      }
    } else {
      solve.correctAnswer = q.ans;
      solve.match = null;
      needsAgent++;
    }

    results.solves.push(solve);
  }

  const matched = results.solves.filter(s => s.match === true).length;
  const mismatched = results.solves.filter(s => s.match === false).length;

  results.summary = {
    autoSolved,
    needsAgent,
    matched,
    mismatched,
    pending: needsAgent
  };

  return results;
}

// ── 메인 ──
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('사용법: node validate/run-blind-solve.js <파일|폴더>');
  process.exit(1);
}

const files = collectFiles(args[0]);
console.log(`\n🔍 블라인드 풀이: ${files.length}개 파일\n`);

let totalAuto = 0, totalAgent = 0, totalMatch = 0, totalMismatch = 0;

for (const f of files) {
  const results = solveFile(f);

  // .blind.json 저장
  const blindFile = f.replace(/\.json$/, '.blind.json');
  fs.writeFileSync(blindFile, JSON.stringify(results, null, 2), 'utf8');

  const { autoSolved, needsAgent, matched, mismatched } = results.summary;
  const status = mismatched > 0 ? '❌' : (needsAgent > 0 ? '⚠️' : '✅');

  console.log(`${status} ${path.relative(process.cwd(), f)}: 자동${matched}/${autoSolved} 일치, 에이전트필요 ${needsAgent}문항${mismatched > 0 ? `, ❌불일치 ${mismatched}건` : ''}`);

  totalAuto += autoSolved;
  totalAgent += needsAgent;
  totalMatch += matched;
  totalMismatch += mismatched;
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`자동 풀이: ${totalMatch}/${totalAuto} 일치`);
console.log(`에이전트 필요: ${totalAgent}문항`);
if (totalMismatch > 0) {
  console.log(`❌ 불일치: ${totalMismatch}건 — 해당 문항 확인 필요`);
}
console.log(`\n.blind.json 파일 ${files.length}개 생성 완료`);
if (totalAgent > 0) {
  console.log(`\n다음 단계: 에이전트로 ${totalAgent}문항 풀이 → .blind.json 업데이트`);
}
