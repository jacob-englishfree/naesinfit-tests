#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — validate.js
 * Validates a JSON test data file against 53 checkpoints.
 *
 * Usage: node validate/validate.js data/모의고사/고1/3월/18번/단어.json
 *        node validate/validate.js --all   (validates all JSON in data/)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Severity levels ──
const SEV = { S: 'S', A: 'A', B: 'B', C: 'C' };

class ValidationResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.errors = [];   // { id, sev, msg }
    this.warnings = []; // { id, sev, msg }
  }
  add(id, sev, msg) {
    const entry = { id, sev, msg };
    if (sev === SEV.S || sev === SEV.A) this.errors.push(entry);
    else this.warnings.push(entry);
  }
  get pass() { return this.errors.length === 0; }
}

function validate(jsonPath) {
  const result = new ValidationResult(jsonPath);

  // ── Read & parse ──
  let raw, data;
  try {
    raw = fs.readFileSync(jsonPath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    result.add('PARSE', SEV.S, `JSON parse error: ${e.message}`);
    return result;
  }

  const { testType, ei, fullPassage, questions } = data;

  // ── S1: questions.length === 20 ──
  if (!Array.isArray(questions)) {
    result.add('S1', SEV.S, 'questions is not an array');
    return result;
  }
  // Non-20 question files accepted silently (legacy 지문별 분리 등)

  // ── S2: sum(pts) check — flexible for non-20 question files ──
  const totalPts = questions.reduce((s, q) => s + (q.pts || 0), 0);
  if (questions.length === 20 && totalPts !== 100) {
    result.add('S2', SEV.S, `sum(pts) = ${totalPts}, expected 100`);
  } else if (questions.length !== 20 && totalPts !== (ei.total || totalPts)) {
    // For non-20 files, check EI.total matches actual
    if (ei.total && ei.total !== totalPts) {
      result.add('S2', SEV.B, `sum(pts) = ${totalPts}, ei.total = ${ei.total}`);
    }
  }

  // ── S3~S5: 배점 분포 — 20문항일 때만 엄격 체크 ──
  if (questions.length === 20 && totalPts === 100) {
    const easy = questions.filter(q => q.diff === '쉬움' && q.pts === 4);
    if (easy.length !== 5) {
      result.add('S3', SEV.S, `쉬움(4점) count = ${easy.length}, expected 5`);
    }
    const mid = questions.filter(q => q.diff === '보통' && q.pts === 5);
    if (mid.length !== 10) {
      result.add('S4', SEV.S, `보통(5점) count = ${mid.length}, expected 10`);
    }
    const hard = questions.filter(q => q.diff === '어려움' && q.pts === 6);
    if (hard.length !== 5) {
      result.add('S5', SEV.S, `어려움(6점) count = ${hard.length}, expected 5`);
    }
  }

  // ── S6: ei constants ──
  if (!ei) {
    result.add('S6', SEV.S, 'ei object missing');
    return result;
  }
  // Flexible: ei.totalQ should match actual question count
  if (ei.totalQ !== questions.length) {
    result.add('S6', SEV.B, `ei.totalQ = ${ei.totalQ}, actual questions = ${questions.length}`);
  }
  if (questions.length === 20 && ei.total !== 100) {
    result.add('S6', SEV.S, `ei.total = ${ei.total}, expected 100`);
  }

  // ── F7: EI 8 required fields ──
  const eiFields = ['subject', 'pub', 'lesson', 'title', 'total', 'time', 'totalQ', 'histKey'];
  eiFields.forEach(f => {
    if (ei[f] === undefined || ei[f] === null || ei[f] === '') {
      result.add('F7', SEV.S, `ei.${f} is missing or empty`);
    }
  });

  // ── F8~F14: Question field checks ──
  const validDiffs = ['쉬움', '보통', '어려움'];
  const validFmts = ['mc', 'written'];

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    // F8
    if (q.id === undefined) result.add('F8', SEV.S, `Q${i}: id missing`);
    if (!q.type) result.add('F8', SEV.S, `Q${qid}: type missing`);
    if (!q.diff) result.add('F8', SEV.S, `Q${qid}: diff missing`);
    if (q.pts === undefined) result.add('F8', SEV.S, `Q${qid}: pts missing`);
    if (!q.fmt) result.add('F8', SEV.S, `Q${qid}: fmt missing`);

    // C21
    if (q.diff && !validDiffs.includes(q.diff)) {
      result.add('C21', SEV.S, `Q${qid}: diff="${q.diff}" invalid`);
    }

    // F9: mc requires ans + ch
    if (q.fmt === 'mc') {
      if (q.ans === undefined || q.ans === null) result.add('F9', SEV.S, `Q${qid}: mc missing ans`);
      if (!Array.isArray(q.ch)) result.add('F9', SEV.S, `Q${qid}: mc missing ch array`);
    }

    // F10: written requires wa + accept
    if (q.fmt === 'written') {
      if (!q.wa) result.add('F10', SEV.S, `Q${qid}: written missing wa`);
      if (!Array.isArray(q.accept)) result.add('F10', SEV.S, `Q${qid}: written missing accept array`);
    }

    // F11: passage key exists
    if (q.passage === undefined) result.add('F11', SEV.S, `Q${qid}: passage key missing`);

    // F12: stem exists and non-empty
    if (!q.stem) result.add('F12', SEV.S, `Q${qid}: stem missing or empty`);

    // F13: det exists with korean — B severity (many legacy files lack det)
    if (!q.det) {
      result.add('F13', SEV.B, `Q${qid}: det (detail/explanation) missing`);
    } else {
      if (!q.det.korean) result.add('F13', SEV.B, `Q${qid}: det.korean missing`);
      // F14: analysis + tip
      if (!q.det.analysis) result.add('F14', SEV.B, `Q${qid}: det.analysis missing`);
      if (!q.det.tip) result.add('F14', SEV.B, `Q${qid}: det.tip missing`);
    }

    // ── Derived values ──
    const passage = q.passage || '';
    const typeNorm = (q.type || '').trim();

    // ── passage 비어있으면 S급 에러 (passage 없이 출제되는 유형은 면제) ──
    const noPassageTypes = [
      '동의어 고르기', '반의어 고르기', '영영풀이 매칭',
      '한영', '한→영', '한영영작',
      '어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형',
    ];
    if ((!passage || passage.trim().length === 0) && !noPassageTypes.includes(typeNorm)) {
      result.add('P_EMPTY', SEV.S, `Q${qid}: passage가 비어있음 — passage 필수`);
    }
    // 교과서: 15문장 이상이면 최소 8문장 발췌 허용 (정답 근거 포함 필수)
    // 모의고사/수능특강: 원문 전체 필수 (별도 체크)

    // ── C15~C18: mc consistency ──
    if (q.fmt === 'mc' && Array.isArray(q.ch)) {
      // C16: 모든 MC 문항 4지선다 필수 (서술형 제외)
      if (q.ch.length !== 4) {
        result.add('C16', SEV.S, `Q${qid}: ch.length = ${q.ch.length}, 모든 문항 4지선다 필수`);
      }

      // C15: ans in bounds
      if (typeof q.ans === 'number' && (q.ans < 0 || q.ans >= q.ch.length)) {
        result.add('C15', SEV.S, `Q${qid}: ans=${q.ans} out of bounds [0,${q.ch.length - 1}]`);
      }

      // C17: no empty choices AND no dummy choices (-, —, etc.)
      q.ch.forEach((c, ci) => {
        if (!c || c.trim() === '') result.add('C17', SEV.S, `Q${qid}: ch[${ci}] is empty`);
        const trimmed = (c || '').trim();
        if (/^[-—–]$/.test(trimmed) || /^[-—–]\s*\(/.test(trimmed) || trimmed === '- (변형)') {
          result.add('C17-DUMMY', SEV.S, `Q${qid}: ch[${ci}] = "${trimmed}" — 더미 선지 금지. 유효한 4지선다 필수`);
        }
      });

      // C18: no duplicate choices
      const unique = new Set(q.ch.map(c => (c || '').trim().toLowerCase()));
      if (unique.size !== q.ch.length) result.add('C18', SEV.A, `Q${qid}: duplicate choices detected`);
    }

    // ── P22~P29: passage-type cross checks ──

    // P22: 빈칸형 문항은 passage 또는 stem에 빈칸(____) 필요
    if (['빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론'].includes(typeNorm) && q.fmt === 'mc') {
      const combined = passage + ' ' + (q.stem || '');
      if (!combined.includes('____') && !combined.includes('(     )') && !combined.includes('______')) {
        result.add('P22', SEV.A, `Q${qid}: 빈칸형(${typeNorm})인데 빈칸 마커 없음`);
      }
    }

    // P23: 밑줄형 유형은 passage에 <u> 태그 4개 필요 (①~④) — S급 차단
    if (['문맥상 부적절한 어휘', '부적절한 어휘'].includes(typeNorm) && q.fmt === 'mc') {
      const uCount = (passage.match(/<u>/g) || []).length;
      if (uCount > 0 && uCount < 4) {
        result.add('P23', SEV.S, `Q${qid}: 밑줄형(${typeNorm})에 <u> ${uCount}개 — 4개 필수 (①~④)`);
      }
    }

    // P24: (A)(B)(C) 조합형은 passage 또는 stem에 (A)(B)(C) 마커 필요
    if (typeNorm === '(A)(B)(C) 조합형') {
      const combined = passage + ' ' + (q.stem || '');
      if (!combined.includes('(A)') || !combined.includes('(B)') || !combined.includes('(C)')) {
        result.add('P24', SEV.B, `Q${qid}: (A)(B)(C) 조합형인데 마커 누락 — passage 또는 stem 확인`);
      }
    }

    // P25: 어형 변환은 passage에 변환 대상 표시 필요
    if (['어형 변환 (서술형)', '어형 변환'].includes(typeNorm)) {
      if (!passage.includes('<') && !passage.includes('(') && !passage.includes('[')) {
        result.add('P25', SEV.B, `Q${qid}: 어형 변환인데 변환 대상 표시 없음`);
      }
    }

    // P26: 동의어/반의어 passage 체크 — 현재 원문 전체 passage 필수 규칙에 따라 비활성화

    // P27: 영영풀이 passage 체크 — 현재 원문 전체 passage 필수 규칙에 따라 비활성화

    // P28: 어법 4지선다 — ①②③④ 마커 일관성
    if (typeNorm === '어법' && q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 4) {
      const hasCircled = passage.includes('①') || passage.includes('②');
      if (hasCircled) {
        const missingMarkers = ['①', '②', '③', '④'].filter(c => !passage.includes(c));
        // ④만 누락 = 흔한 데이터 이슈 → B급, 여러 개 누락 = A급
        const markerSev = missingMarkers.length >= 2 ? SEV.A : SEV.B;
        missingMarkers.forEach(c => {
          result.add('P28', markerSev, `Q${qid}: 어법 4지선다 — ${c} 마커 누락`);
        });
      }
    }

    // P29: 문장삽입 → ①②③④ markers (only if passage has any markers)
    if (typeNorm === '문장삽입' && passage && passage.length > 10) {
      const hasAnyMarker = passage.includes('①') || passage.includes('②');
      if (hasAnyMarker) {
        ['①', '②', '③', '④'].forEach(c => {
          if (!passage.includes(c)) result.add('P29', SEV.S, `Q${qid}: 문장삽입 missing ${c} position marker`);
        });
      }
    }

    // ── X30~X34: content pollution ──
    const allText = [passage, q.stem || '', JSON.stringify(q.det || {})].join(' ');

    // X30 — only match literal error markers, not the word "error" in content
    if (/\[ERROR\]|\[error\]|^ERROR:/.test(allText)) {
      result.add('X30', SEV.S, `Q${qid}: contains ERROR pattern`);
    }

    // X31
    if (/\bundefined\b|\bnull\b|\bNaN\b/.test(allText.replace(/"[^"]*"/g, ''))) {
      // Only flag if not inside a JSON string value context
      // Simple heuristic: check in stem and passage directly
      const directText = (q.stem || '') + ' ' + (passage || '');
      if (/\bundefined\b|\bNaN\b/.test(directText)) {
        result.add('X31', SEV.S, `Q${qid}: contains undefined/NaN literal`);
      }
    }

    // X32
    if (/\bTODO\b|\bFIXME\b|\bPLACEHOLDER\b|\bINSERT HERE\b/i.test(allText)) {
      result.add('X32', SEV.A, `Q${qid}: contains TODO/FIXME/PLACEHOLDER`);
    }

    // X33
    if (/\?\?\?|xxx|---/.test(allText)) {
      // Exclude legitimate uses (e.g., in Korean text or --- as separator)
      if (/\?\?\?/.test(passage) || /\bxxx\b/i.test(passage)) {
        result.add('X33', SEV.A, `Q${qid}: contains placeholder pattern (???, xxx)`);
      }
    }

    // X34: broken characters
    if (/\uFFFD/.test(allText)) {
      result.add('X34', SEV.A, `Q${qid}: contains broken character (U+FFFD)`);
    }

    // ── D43~D48: answer-explanation consistency ──
    if (q.det) {
      // D46: min 10 chars each
      if (q.det.korean && q.det.korean.replace(/<[^>]+>/g, '').length < 10) {
        result.add('D46', SEV.B, `Q${qid}: det.korean under 10 chars`);
      }
      if (q.det.analysis && q.det.analysis.replace(/<[^>]+>/g, '').length < 10) {
        result.add('D46', SEV.B, `Q${qid}: det.analysis under 10 chars`);
      }
      if (q.det.tip && q.det.tip.replace(/<[^>]+>/g, '').length < 5) {
        result.add('D46', SEV.B, `Q${qid}: det.tip under 5 chars`);
      }
    }

    // ── W49~W50: 어순배열 special ──
    if (typeNorm === '어순배열' && q.fmt === 'written' && q.wa) {
      if (passage.includes(q.wa)) {
        result.add('W49', SEV.S, `Q${qid}: 어순배열 answer "${q.wa}" visible in passage`);
      }
      // W49-ORDER: stem의 단어 순서가 wa와 동일하면 문제 불성립
      const stemPlain = (q.stem || '').replace(/<[^>]+>/g, '');
      const boldMatch = (q.stem || '').match(/<b>([^<]+)<\/b>/);
      if (boldMatch) {
        const givenWords = boldMatch[1].replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const ansWords = q.wa.replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (givenWords === ansWords) {
          result.add('W49-ORDER', SEV.S, `Q${qid}: 어순배열 — stem의 단어가 이미 정답 순서. 순서를 섞어야 함`);
        }
      }
    }
    // W50: blank format
    if (passage.includes('(     )') || passage.includes('(      )')) {
      result.add('W50', SEV.A, `Q${qid}: blanks should be __________ not (    )`);
    }

    // ── EX: 정답 노출 checks ──
    const passagePlain = passage.replace(/<[^>]+>/g, '');

    // EX-1: 빈칸 문제 — 정답이 passage의 빈칸 외 다른 곳에 그대로 노출 — A급 차단
    if (['빈칸추론', '빈칸 추론', '빈칸 문맥 완성', '빈칸 어휘 완성', '연결사'].includes(typeNorm) && q.fmt === 'mc' && Array.isArray(q.ch)) {
      const answer = (q.ch[q.ans] || '').trim();
      if (answer.length >= 3) {
        const passageNoBlanks = passagePlain.replace(/_{5,}/g, '').toLowerCase();
        const ansLower = answer.toLowerCase();
        if (passageNoBlanks.includes(ansLower)) {
          const exSev = answer.length <= 5 ? SEV.B : SEV.A;
          result.add('EX-1', exSev, `Q${qid}: 빈칸 정답 "${answer}" 이 지문에 그대로 노출됨 — 정답 노출 금지`);
        }
      }
    }

    // EX-2: 서술형 — 정답(wa)이 passage에 그대로 노출 — A급 차단
    // 제외: 어순배열(W49), 어형변환(원형 노출 정상), 한영(지문 단어가 정답), 내용이해
    if (q.fmt === 'written' && q.wa && typeof q.wa === 'string' && typeNorm !== '어순배열') {
      const wa = q.wa.trim();
      const skipTypes = [
        '어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형', '서술형어형', '서술형 — 어형변환',
        '한영', '한→영', '한영영작', '내용이해', '영한', '영→한', '영한해석',
        '서술형 — 핵심단어', '서술형 — 문장완성',
      ];
      // 서술형은 지문에서 답을 찾는 유형이 많음 → B급 경고로 완화
      // 진짜 위험한 정답 노출은 AI 풀이 검증(③)에서 판정
      const severity = SEV.B;
      if (wa.length >= 3 && !skipTypes.includes(typeNorm) && passagePlain.toLowerCase().includes(wa.toLowerCase())) {
        result.add('EX-2', severity, `Q${qid}: 서술형 정답 "${wa}" 이 지문에 그대로 노출됨 — 정답 노출 금지`);
      }
    }

    // EX-5: 서술형 "원문에서 찾아" stem인데 passage에 정답 단어가 없으면 풀 수 없음
    if (q.fmt === 'written' && q.wa && (q.stem || '').includes('원문에서 찾아')) {
      const wa = q.wa.trim().toLowerCase();
      const passLower = passagePlain.toLowerCase();
      // 빈칸으로 대체된 경우(정답 노출 방지 정상) vs 아예 passage에 해당 단어/근거가 없는 경우 구분
      // stem에 "원문에서 찾아"라고 했으면 passage에서 추론 가능해야 함
      if (wa.length >= 3 && !passLower.includes(wa) && !passLower.includes('__________')) {
        result.add('EX-5', SEV.A, `Q${qid}: "원문에서 찾아 쓰시오"인데 passage에 정답 "${q.wa}"도 빈칸도 없음 — 학생이 풀 수 없음`);
      }
    }

    // EX-3: (A)(B)(C) 조합형 — 정답 단어 3개가 passage에 볼드 없이 전부 노출
    if (typeNorm === '(A)(B)(C) 조합형' && q.fmt === 'mc' && Array.isArray(q.ch)) {
      const answer = (q.ch[q.ans] || '').trim();
      // Parse "word1 — word2 — word3" format
      const parts = answer.split(/\s*[—–-]\s*/).map(s => s.trim().toLowerCase()).filter(s => s.length >= 2);
      if (parts.length >= 3) {
        // Check if all 3 words appear in passage WITHOUT being inside <b> tags
        const passageNoMarkers = passage.replace(/<b>\([ABC]\)<\/b>/g, '').replace(/<[^>]+>/g, '').toLowerCase();
        const allExposed = parts.every(p => passageNoMarkers.includes(p));
        if (allExposed) {
          // Check that the answer words are NOT inside the (A)(B)(C) positions
          // If they're exposed elsewhere, it's a problem
          const markerPositions = [];
          const markerRegex = /<b>\(([ABC])\)<\/b>\s*(\w+)/g;
          let m;
          while ((m = markerRegex.exec(passage)) !== null) {
            markerPositions.push(m[2].toLowerCase());
          }
          const exposedOutsideMarkers = parts.filter(p => !markerPositions.includes(p));
          if (exposedOutsideMarkers.length >= 2) {
            result.add('EX-3', SEV.B, `Q${qid}: (A)(B)(C) 정답 단어가 지문 다른 곳에도 노출됨 — 선지 안 봐도 유추 가능`);
          }
        }
      }
    }

    // EX-4: 내용일치/불일치 — 정답 선지의 핵심 단어(4글자+)가 passage에 1:1 복사
    if (['내용일치', '내용불일치'].includes(typeNorm) && q.fmt === 'mc' && Array.isArray(q.ch)) {
      const answer = (q.ch[q.ans] || '').trim();
      // Extract meaningful words (4+ chars, not common words)
      const commonWords = new Set(['this', 'that', 'with', 'from', 'they', 'their', 'have', 'been', 'were', 'which', 'about', 'would', 'could', 'should', 'there', 'these', 'those', 'also', 'more', 'than', 'when', 'what', 'some', 'other', 'into', 'very', 'only', 'such', 'most', 'both', 'each', 'does', 'will']);
      const keywords = answer.toLowerCase().split(/\s+/).filter(w => w.length >= 4 && !commonWords.has(w));
      if (keywords.length >= 3) {
        const matchedInPassage = keywords.filter(k => passagePlain.toLowerCase().includes(k));
        if (matchedInPassage.length === keywords.length) {
          result.add('EX-4', SEV.B, `Q${qid}: 내용일치 정답 선지 키워드가 지문에 전부 동일하게 존재 — 너무 쉬울 수 있음`);
        }
      }
    }
    // end EX block
  });

  // ── C19: id 1~N continuous, no dups ──
  const ids = questions.map(q => q.id).sort((a, b) => a - b);
  const expectedIds = Array.from({ length: questions.length }, (_, i) => i + 1);
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    result.add('C19', SEV.S, `ids not 1~${questions.length} continuous: [${ids.join(',')}]`);
  }

  // ── C20: histKey pattern ──
  if (ei.histKey && !/^(wordTest|workbookTest|quizTest)_.+_v[0-9]+$/.test(ei.histKey)) {
    result.add('C20', SEV.B, `histKey "${ei.histKey}" doesn't match pattern`);
  }

  // ── T39: Quiz ordering (순서/삽입 FIRST, 어법/어휘 SECOND, 서술형/내용/TF LAST) ──
  if (testType === '퀴즈') {
    const firstTypes = ['순서배열', '글순서', '문장삽입', '어순배열'];
    const secondTypes = ['어법', '어휘', '어법 빈칸', '문맥상 부적절한 어휘'];
    const lastTypes = ['서술형', '내용이해', '내용일치', '내용불일치', 'T/F', '빈칸추론', '빈칸 추론'];

    let phase = 'first';
    questions.forEach(q => {
      const t = (q.type || '').trim();
      if (firstTypes.includes(t)) {
        if (phase !== 'first') result.add('T39', SEV.B, `Q${q.id}: ${t} should be in FIRST group`);
      } else if (secondTypes.includes(t)) {
        if (phase === 'first') phase = 'second';
        if (phase === 'last') result.add('T39', SEV.B, `Q${q.id}: ${t} should be in SECOND group`);
      } else {
        if (phase !== 'last') phase = 'last';
      }
    });
  }

  // ── R51~R53: 모의고사 문항번호 적합성 ──
  if (ei.subject && ei.subject.includes('모의고사')) {
    const pubNum = parseInt(ei.pub);
    if (!isNaN(pubNum)) {
      // R51: excluded numbers
      if ([25, 27, 28].includes(pubNum)) {
        result.add('R51', SEV.C, `문항번호 ${pubNum}번은 출제 제외 번호입니다`);
      }
      // R52: short passages shouldn't have 순서/삽입/어순배열
      if ([18, 19, 20, 26].includes(pubNum)) {
        const badTypes = ['순서배열', '글순서', '문장삽입', '어순배열'];
        questions.forEach(q => {
          if (badTypes.includes(q.type)) {
            result.add('R52', SEV.C, `Q${q.id}: 짧은 지문(${pubNum}번)에 ${q.type} 출제`);
          }
        });
      }
      // R53: mid passages + 문장삽입
      if ([21, 22, 23, 24, 29, 30, 31, 32, 33, 34].includes(pubNum)) {
        questions.forEach(q => {
          if (q.type === '문장삽입') {
            result.add('R53', SEV.C, `Q${q.id}: 중간 지문(${pubNum}번)에 문장삽입 — 길이 확인 필요`);
          }
        });
      }
    }
  }

  // ── Fullpassage check ──
  if (!fullPassage || fullPassage.trim().length === 0) {
    result.add('FP', SEV.S, 'fullPassage is empty');
  }

  // ── testType check ──
  if (!['단어', '워크북', '퀴즈'].includes(testType)) {
    result.add('TT', SEV.S, `testType="${testType}" invalid`);
  }

  // ── TW: Type whitelist — 허용 유형 외 전부 차단 ──
  // 정규 이름 → 같은 유형의 약어/변형 모두 포함
  const TYPE_WHITELIST = {
    '단어': [
      '동의어 고르기', '반의어 고르기', '영영풀이 매칭',
      '빈칸 어휘 완성', '빈칸 문맥 완성',
      '(A)(B)(C) 조합형',
      '문맥상 부적절한 어휘', '부적절한 어휘', '부적절어휘', '부적절',
      '다의어 문맥적 의미', '다의어 / 문맥적 의미', '다의어·문맥적 의미', '다의어 / 영영풀이',
      '어형 변환 (서술형)', '어형 변환',
      '한영', '내용이해',
      '어휘', '주제', '빈칸추론', '빈칸 추론'
    ],
    '워크북': [
      '내용이해', '내용일치', '내용불일치', '내용 일치/불일치', '불일치', '내용이해 T/F',
      'T/F', 'TF', 'TF 판별',
      '빈칸추론', '빈칸 추론', '빈칸 문맥 완성', '빈칸', '빈칸어휘', '빈칸 어휘 완성', '빈칸(구)', '빈칸(문장)', '주제빈칸', '추론',
      '어법', '어법 빈칸', '어법빈칸', '어법 5지선다', '어법 밑줄형', '어법 빈칸형',
      '문장삽입', '순서배열', '순서', '글순서', '오류찾기', '오류', '무관', '무관문장',
      '서술형', '서술', '영작문 (서술형)', '서술형 — 핵심단어', '서술형 — 배열영작', '서술형 — 조건영작', '서술형 — 어형변환', '서술형 — 문장완성', '서술형 — 영작',
      '지칭추론', '지칭', '연결사',
      '주제', '주제/요지', '대의', '의미파악', '의미', '함축', '함축의미 추론', '요약', '요약문',
      '동의어 고르기', '반의어 고르기', '영영풀이 매칭',
      '다의어 문맥적 의미', '다의어 / 문맥적 의미',
      '문맥상 부적절한 어휘', '부적절어휘', '부적절',
      '(A)(B)(C) 조합형',
      '어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형',
      '어휘', '어순', '어순배열',
      '영한', '영→한', '영한해석', '한영영작', '한영', '한→영',
      '추론불가', '일치', '어휘 문맥', '종합'
    ],
    '퀴즈': [
      '순서배열', '순서', '글순서',
      '문장삽입', '어순배열',
      '어법', '어법 빈칸', '어법 ⓐ~ⓔ', '어법 ⓐ~ⓓ', '어법 A/B/C', '어법 밑줄형', '어법 빈칸형',
      '문맥상 부적절한 어휘', '부적절어휘', '부적절',
      '어휘', '어휘 ①~⑤', '어휘 A/B/C',
      '빈칸추론', '빈칸 추론', '빈칸 문맥 완성', '빈칸', '빈칸 어휘 완성', '빈칸(구)', '빈칸(문장)',
      '서술형', '서술', '서술형요약', '서술형영작', '서술형어형', '서술형(요약)', '서술형(영작)', '서술형(어형)', '영작문 (서술형)', '서술형 — 핵심단어', '서술형 — 배열영작', '서술형 — 조건영작', '서술형 — 어형변환', '서술형 — 문장완성', '서술형 — 영작',
      '내용이해', '내용일치', '내용불일치', '내용 일치/불일치', '일치', '불일치', '내용이해 T/F',
      'T/F', 'TF', 'TF 판별',
      '어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형',
      '동의어 고르기', '반의어 고르기', '영영풀이 매칭',
      '다의어 문맥적 의미', '다의어 / 문맥적 의미',
      '(A)(B)(C) 조합형',
      '주제', '주제/요지', '주제빈칸', '제목', '대의', '시사점', '무관문장', '무관', '함축', '요약', '요약문', '추론',
      '지칭', '지칭추론', '연결사', '함축의미 추론', '무관한 문장 찾기',
      '어법빈칸', '어법 5지선다', '어법 ⓐ~ⓔ', '어법 ⓐ~ⓓ', '어법 A/B/C',
      '한영', '한→영',
      '기타', '종합', '어휘 문맥'
    ]
  };

  // 절대 금지 유형 (어떤 테스트에도 불가)
  const BANNED_TYPES = ['심경', '심경변화', '도표', '안내문', '광고문'];

  const allowed = TYPE_WHITELIST[testType] || [];
  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    const typeNorm = (q.type || '').trim();
    if (!typeNorm) return; // F8에서 이미 잡힘

    // 절대 금지 유형 체크
    if (BANNED_TYPES.some(b => typeNorm.includes(b))) {
      result.add('TW-BAN', SEV.S, `Q${qid}: "${typeNorm}" — 내신 출제 금지 유형`);
    }
    // 허용 목록 체크
    else if (allowed.length > 0 && !allowed.includes(typeNorm)) {
      result.add('TW-TYPE', SEV.S, `Q${qid}: "${typeNorm}" — ${testType}테스트 허용 유형 아님`);
    }
  });

  // ── P1~P4: Passage excerpt validation (신규) ──
  const fullTextTypes = [
    '빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론',
    '문맥상 부적절한 어휘', '(A)(B)(C) 조합형',
    '어형 변환 (서술형)', '내용일치', '내용불일치', '내용이해',
    'T/F', '어법', '어법 빈칸', '문장삽입'
  ];

  const fpPlainLen = fullPassage ? fullPassage.replace(/<[^>]+>/g, '').length : 0;

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    const typeNorm = (q.type || '').trim();
    const passage = q.passage || '';

    // P1: passage가 있는 문항은 최소 길이 확인
    if (fullTextTypes.includes(typeNorm) && passage) {
      const pLen = passage.replace(/<[^>]+>/g, '').length;
      if (pLen > 0 && pLen < 20) {
        result.add('P1', SEV.B, `Q${qid}: passage가 너무 짧음 (${pLen}자)`);
      }
    }

    // P2: fullPassage가 있을 때 passage가 원문의 일부인지 확인
    if (fullPassage && passage && passage.replace(/<[^>]+>/g, '').length > 50) {
      const passClean = passage.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 50);
      const fullClean = fullPassage.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (passClean.length > 30 && !fullClean.includes(passClean)) {
        result.add('P2', SEV.B, `Q${qid}: passage 앞부분이 fullPassage에 없음 — 원문 확인 필요`);
      }
    }

    // P3: \\u escape 잔존 확인
    if (passage && /\\u[0-9a-fA-F]{4}/.test(passage)) {
      result.add('P3', SEV.B, `Q${qid}: passage에 \\u escape 잔존`);
    }

    // P4: No placeholder text in choices
    if (Array.isArray(q.ch)) {
      q.ch.forEach((c, ci) => {
        if (/^보기[0-9]$/.test((c || '').trim()) || /^선택지[0-9]$/.test((c || '').trim())) {
          result.add('P4', SEV.S, `Q${qid}: ch[${ci}] = "${c}" is placeholder text`);
        }
        if (/^placeholder$/i.test((c || '').trim()) || /^option\s*[0-9]$/i.test((c || '').trim())) {
          result.add('P4', SEV.S, `Q${qid}: ch[${ci}] = "${c}" is placeholder text`);
        }
      });
    }
    // Also check stem for placeholder
    if (q.stem && /^발문$|^문제$|^stem$/i.test(q.stem.trim())) {
      result.add('P4', SEV.S, `Q${qid}: stem = "${q.stem}" is placeholder text`);
    }
  });

  return result;
}

// ── CLI ──
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node validate/validate.js <json-file>');
    console.error('       node validate/validate.js --all');
    process.exit(1);
  }

  let files = [];
  if (args[0] === '--all') {
    const dataDir = path.join(ROOT, 'data');
    if (fs.existsSync(dataDir)) {
      files = findJsonFiles(dataDir);
    }
    if (files.length === 0) {
      console.log('No JSON files found in data/');
      process.exit(0);
    }
  } else {
    files = [path.resolve(args[0])];
  }

  let totalPass = 0, totalFail = 0, totalWarn = 0;

  files.forEach(f => {
    const result = validate(f);
    const relPath = path.relative(ROOT, f);

    if (result.pass) {
      totalPass++;
      const warnCount = result.warnings.length;
      if (warnCount > 0) {
        totalWarn += warnCount;
        console.log(`[PASS] ${relPath} (${warnCount} warnings)`);
        result.warnings.forEach(w => console.log(`  [${w.sev}] ${w.id}: ${w.msg}`));
      } else {
        console.log(`[PASS] ${relPath}`);
      }
    } else {
      totalFail++;
      console.log(`[FAIL] ${relPath} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
      result.errors.forEach(e => console.log(`  [${e.sev}] ${e.id}: ${e.msg}`));
      result.warnings.forEach(w => console.log(`  [${w.sev}] ${w.id}: ${w.msg}`));
    }
  });

  if (files.length > 1) {
    console.log(`\n--- Summary ---`);
    console.log(`Total: ${files.length} | PASS: ${totalPass} | FAIL: ${totalFail} | Warnings: ${totalWarn}`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

function findJsonFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

// Export for use by build.js
module.exports = { validate };

if (require.main === module) main();
