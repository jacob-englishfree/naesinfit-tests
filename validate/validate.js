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

// Phase 1 모듈 통합
const { validateBySchema } = require('./schema.js');
const { validateRender } = require('./render-sim.js');

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

    // Phase 1: 유형별 schema 검증
    try {
      const schemaErrs = validateBySchema(q, qid);
      for (const e of schemaErrs) result.add(e.id, SEV[e.sev] || SEV.A, e.msg);
    } catch (e) {}

    // Phase 1: 렌더링 시뮬레이션
    try {
      const renderErrs = validateRender(q, qid);
      for (const e of renderErrs) result.add(e.id, SEV[e.sev] || SEV.A, e.msg);
    } catch (e) {}

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
      if (q.wa && typeof q.wa !== 'string') result.add('F10', SEV.S, `Q${qid}: wa must be string, got ${typeof q.wa}`);
      if (!Array.isArray(q.accept)) result.add('F10', SEV.S, `Q${qid}: written missing accept array`);
      // F10-B: accept 배열에 대소문자/하이픈 변형 포함 검증
      if (q.wa && typeof q.wa === 'string' && Array.isArray(q.accept) && q.accept.length > 0) {
        const wa = q.wa.trim();
        const hasLower = q.accept.some(a => a.trim() === wa.toLowerCase());
        const hasUpper = q.accept.some(a => a.trim() === wa.charAt(0).toUpperCase() + wa.slice(1));
        if (!hasLower && wa.toLowerCase() !== wa) {
          result.add('F10-B', SEV.A, `Q${qid}: accept에 소문자 변형("${wa.toLowerCase()}") 없음`);
        }
        // 하이픈 포함 단어는 공백 변형도 필요
        if (wa.includes('-')) {
          const noHyphen = wa.replace(/-/g, ' ');
          const hasNoHyphen = q.accept.some(a => a.trim().replace(/-/g, ' ') === noHyphen);
          if (!hasNoHyphen) {
            result.add('F10-C', SEV.S, `Q${qid}: accept에 하이픈 없는 변형("${noHyphen}") 없음 — 학생이 공백으로 쓰면 오답 처리됨`);
          }
        }
      }
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
      '서술형', '서술형 — 영작', '서술형 — 조건영작', '영작문 (서술형)',
      '서술형 — 배열영작',
      '순서배열', '글순서', '문장삽입',
    ];
    if ((!passage || passage.trim().length === 0) && !noPassageTypes.includes(typeNorm)) {
      const stemEngCount = ((q.stem || '').replace(/<[^>]+>/g, '').match(/[a-zA-Z]+/g) || []).length;
      if (stemEngCount < 20) {
        result.add('P_EMPTY', SEV.S, `Q${qid}: passage가 비어있음 — passage 필수`);
      }
    }
    // 교과서: 15문장 이상이면 최소 8문장 발췌 허용 (정답 근거 포함 필수)
    // 모의고사/수능특강: 원문 전체 필수 (별도 체크)

    // ── C15~C18: mc consistency ──
    if (q.fmt === 'mc' && Array.isArray(q.ch)) {
      // C16: 모든 MC 문항 4지선다 필수 (T/F는 2지선다 허용)
      const isTF = ['T/F', 'TF', 'TF 판별', '내용이해 T/F'].includes(typeNorm);
      if (isTF && q.ch.length !== 2) {
        result.add('C16', SEV.S, `Q${qid}: T/F인데 ch.length = ${q.ch.length}, 2지선다 필수`);
      } else if (!isTF && q.ch.length !== 4) {
        result.add('C16', SEV.S, `Q${qid}: ch.length = ${q.ch.length}, 4지선다 필수`);
      }

      // C15: ans in bounds (1-based: 1~ch.length)
      if (typeof q.ans === 'number' && (q.ans < 1 || q.ans > q.ch.length)) {
        result.add('C15', SEV.S, `Q${qid}: ans=${q.ans} out of bounds [1,${q.ch.length}]`);
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
        result.add('P22', SEV.S, `Q${qid}: 빈칸형(${typeNorm})인데 빈칸 마커 없음 — 학생이 풀 수 없음`);
      }
    }

    // P23: 밑줄형 유형은 passage에 <u> 태그 4개 필요 (①~④) — S급 차단
    if (['문맥상 부적절한 어휘', '부적절한 어휘'].includes(typeNorm) && q.fmt === 'mc') {
      const uCount = (passage.match(/<u>/g) || []).length;
      if (uCount > 0 && uCount < 4) {
        result.add('P23', SEV.S, `Q${qid}: 밑줄형(${typeNorm})에 <u> ${uCount}개 — 4개 필수 (①~④)`);
      }
    }

    // P24: (A)(B)(C) 조합형은 passage에 (A)(B)(C) 마커 필수
    // testType 외에 선지 패턴(3단어 — 조합)으로도 감지
    const isABCByType = typeNorm === '(A)(B)(C) 조합형';
    const isABCByStem = (q.stem || '').includes('(A)') && (q.stem || '').includes('(B)') && (q.stem || '').includes('(C)');
    const isABCByCh = q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 4 &&
      q.ch.filter(c => typeof c === 'string' && c.includes(' — ') && c.split(' — ').length >= 3).length >= 3;
    const isOrderType = ['순서배열', '글순서', '문장삽입'].includes(typeNorm);
    if (!isOrderType && (isABCByType || isABCByStem || isABCByCh)) {
      if (!passage.includes('(A)') && !passage.includes('<b>(A)')) {
        result.add('P24', SEV.S, `Q${qid}: (A)(B)(C) 조합형인데 passage에 (A) 마커 없음 — 학생이 풀 수 없음`);
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

    // N1: ①②③④ 선지인데 passage에 마커가 하나도 없음
    // 단, 문장삽입은 passage=null이 정상 (엔진이 fullPassage를 자동 분할)
    if (q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 4 && typeNorm !== '문장삽입') {
      const allCircled = q.ch.every(c => ['①','②','③','④','⑤'].includes((c || '').trim()));
      if (allCircled) {
        const hasAnyMarker = passage.includes('①') || passage.includes('②') || passage.includes('<u>');
        if (!hasAnyMarker) {
          result.add('N1', SEV.S, `Q${qid}: 선지가 ①②③④인데 passage에 마커(①/<u>)가 하나도 없음 — 학생이 풀 수 없음`);
        }
      }
    }

    // N4: 영영풀이 stem ↔ 선지 정합성 (정의에 맞는 정답이 ch에 있어야 함)
    if (['영영풀이 매칭', '영영풀이'].includes(typeNorm) && q.fmt === 'mc' && Array.isArray(q.ch) && q.stem) {
      // 같은 파일 내 다른 영영풀이 문항과 stem이 동일하면 복붙 의심
      const sameStems = questions.filter((oq, oi) => oi !== i &&
        ['영영풀이 매칭', '영영풀이'].includes((oq.type || '').trim()) &&
        oq.stem === q.stem);
      if (sameStems.length > 0) {
        result.add('N4', SEV.S, `Q${qid}: 영영풀이 stem이 Q${sameStems.map(s => s.id).join(',')}과 동일 — 복붙 의심`);
      }
    }

    // N5: 가짜 영어 단어 탐지 (-ly/-ness 기계적 조합)
    if (q.fmt === 'mc' && Array.isArray(q.ch)) {
      const fakePatterns = [
        /[a-z]{4,}lyly$/i,           // subsequentlyly
        /[a-z]{4,}nessness$/i,       // significantlyness
        /[a-z]{3,}ness$/i,           // buildness, ableness — 추가 체크 필요
      ];
      const knownFakeEndings = [
        'ableness', 'buildness', 'constructly', 'consistentness',
        'complementness', 'supplemently', 'capablely', 'biographyly',
        'assumptionness', 'premisely', 'occurrenceness', 'phenomenonly',
        'spectrumness', 'continuumly', 'lastingness', 'presumedly',
        'assumedness', 'afterwardness', 'significantlyness', 'considerablyly',
        'subsequentlyly', 'remotedness',
      ];
      q.ch.forEach((c, ci) => {
        const word = (c || '').trim().toLowerCase();
        // 이중 접미사 (-lyly, -nessness)
        if (/[a-z]{3,}lyly$/i.test(word) || /[a-z]{3,}nessness$/i.test(word)) {
          result.add('N5', SEV.S, `Q${qid}: ch[${ci}] = "${c}" — 이중 접미사 가짜 단어`);
        }
        // 알려진 가짜 단어 목록
        if (knownFakeEndings.includes(word)) {
          result.add('N5', SEV.S, `Q${qid}: ch[${ci}] = "${c}" — 가짜 영어 단어`);
        }
      });
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

    // ── V60~V69: jacob 검수 기반 화면 레벨 체크 (2026-03-27) ──
    const stem = q.stem || '';
    const passagePlainLen = passage.replace(/<[^>]+>/g, '').trim().length;
    const passageSentences = passage.replace(/<[^>]+>/g, '').split(/[.!?]+/).filter(s => s.trim()).length;

    // V60: 어순배열 — 빈칸이 passage 안에 있어야 함 (stem에 있으면 안 됨)
    if (typeNorm === '어순배열') {
      if (!passage.includes('____')) {
        result.add('V60', SEV.S, `Q${qid}: 어순배열인데 passage에 빈칸(____) 없음 — 빈칸은 반드시 passage 안에`);
      }
    }

    // V61: 영작 서술형 — passage가 비어있어야 함
    if (q.fmt === 'written' && (stem.includes('우리말') || stem.includes('한→영') || stem.includes('영작') || stem.includes('일치하도록'))) {
      if (passage.trim().length > 0) {
        result.add('V61', SEV.S, `Q${qid}: 영작 서술형인데 passage가 있음 — 영작은 passage 비워야 함 (정답 노출 방지)`);
      }
    }

    // V62: "위 글의 빈칸" / "위 빈칸" stem인데 passage에 빈칸 없음
    if ((stem.includes('위 글의 빈칸') || stem.includes('위 빈칸')) && !passage.includes('____')) {
      result.add('V62', SEV.S, `Q${qid}: stem에 "위 빈칸"이라고 했는데 passage에 빈칸(____) 없음`);
    }

    // V63: passage 2문장 이하 빈 화면 (서술형 영작/영영풀이 제외)
    const noPassageOK = ['서술형', '서술형 — 영작', '서술형 — 조건영작', '영작문 (서술형)', '영영풀이 매칭', '동의어 고르기', '반의어 고르기', '한영', '한→영', '어형 변환', '어형 변환 (서술형)', '어형변환', '어형변화', '어형변형'].includes(typeNorm);
    if (!noPassageOK && passageSentences > 0 && passageSentences <= 2 && passagePlainLen < 150) {
      result.add('V63', SEV.A, `Q${qid}: passage가 ${passageSentences}문장(${passagePlainLen}자) — 너무 짧아서 빈 화면`);
    }

    // V63-B: 순서배열 — passage 있으면 정답 노출 (S급 차단)
    // 문장삽입은 제외: passage에 ①②③④ 위치 마커가 있어야 학생이 삽입 위치를 고를 수 있음
    if (['순서배열', '글순서'].includes(typeNorm) && q.passage && String(q.passage).length > 10) {
      result.add('V63-B', SEV.S, `Q${qid}: ${typeNorm}에 passage 있음 — stem에 이미 텍스트 포함. passage를 null로 변경 필수`);
    }

    // V63-C: 어법(밑줄찾기) — passage 있으면 이중표시 (S급 차단)
    if (typeNorm === '어법' && q.passage && String(q.passage).length > 100) {
      const stemEng = (q.stem || '').replace(/<[^>]+>/g, '').match(/[a-zA-Z]+/g) || [];
      if (stemEng.length > 15) {
        result.add('V63-C', SEV.S, `Q${qid}: 어법인데 passage+stem 이중표시 — passage를 null로 변경 필수`);
      }
    }

    // V63-D: 서술형 조건 명확성 — 영작/어순배열은 조건 필수
    if (q.fmt === 'written' && (typeNorm === '영작' || stem.includes('영작'))) {
      if (!stem.includes('조건') && !stem.includes('사용할 것') && !stem.includes('사용하여')) {
        result.add('V63-D', SEV.A, `Q${qid}: 영작 문항인데 조건이 없음 — "조건:" 명시 필수`);
      }
    }

    // V64: 서술형/어순배열 — 정답이 passage에 그대로 노출
    if (typeNorm === '어순배열' && q.wa) {
      const waLower = q.wa.toLowerCase().trim();
      const passLower = passage.replace(/<[^>]+>/g, '').replace(/_{5,}/g, '').toLowerCase();
      if (waLower.length > 10 && passLower.includes(waLower)) {
        result.add('V64', SEV.S, `Q${qid}: 어순배열 정답이 passage에 그대로 노출됨`);
      }
    }

    // V65: 핵심단어 서술형 — stem에 "위 글의 빈칸"이면 안 됨 ("본문에서 찾아 쓰시오"여야 함)
    if (q.fmt === 'written' && stem.includes('본문에서 찾아') && stem.includes('위 글의 빈칸')) {
      result.add('V65', SEV.A, `Q${qid}: "본문에서 찾아 쓰시오"인데 "위 글의 빈칸"도 있음 — 모순`);
    }

    // V66: 빈칸형 passage가 너무 짧음 (암기용 방지) — 5문장 미만
    if (['빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론'].includes(typeNorm)) {
      if (passageSentences > 0 && passageSentences < 4) {
        result.add('V66', SEV.A, `Q${qid}: 빈칸형 passage가 ${passageSentences}문장 — 최소 5문장 권장 (암기용 방지)`);
      }
    }

    // V67: stem에 "밑줄 친"이 있으면 passage에 <u> 태그 필수 (유형 무관 통합)
    // 영영풀이는 V76에 의해 passage=null 필수이므로 V67 제외. 어형변환은 stem 오염 가능.
    const V67_EXEMPT_TYPES = ['영영풀이 매칭', '영영풀이', '어형 변환', '서술형 — 어형변환', '함축의미 추론', '서술형 — 핵심단어', '내용이해 T/F', '오류찾기'];
    if ((stem.includes('밑줄 친') || stem.includes('밑줄친')) && !V67_EXEMPT_TYPES.includes(typeNorm)) {
      if (!passage.includes('<u>')) {
        result.add('V67', SEV.S, `Q${qid}: stem에 "밑줄 친"이 있는데 passage에 <u> 밑줄 없음`);
      }
    }

    // V68: 지칭추론 — passage 최소 5문장 + <u>대명사</u> 밑줄 필수
    if (typeNorm === '지칭추론' || typeNorm === '지칭') {
      if (passageSentences > 0 && passageSentences < 5) {
        result.add('V68', SEV.S, `Q${qid}: 지칭추론 passage가 ${passageSentences}문장 — 최소 5문장 필수 (너무 짧으면 답이 바로 보임)`);
      }
      if (!passage.includes('<u>')) {
        result.add('V68-U', SEV.S, `Q${qid}: 지칭추론인데 passage에 <u>대명사</u> 밑줄 없음`);
      }
    }

    // V69: 서술형 — 정답(wa)이 passage에 문장 단위로 그대로 노출 (어형변환 제외)
    if (q.fmt === 'written' && q.wa && typeof q.wa === 'string') {
      const waLower = q.wa.toLowerCase().trim();
      const skipTypes = ['어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형'];
      if (!skipTypes.includes(typeNorm) && waLower.length > 15) {
        const passLower = passage.replace(/<[^>]+>/g, '').replace(/_{5,}/g, '').toLowerCase();
        if (passLower.includes(waLower)) {
          result.add('V69', SEV.S, `Q${qid}: 서술형 정답("${q.wa.substring(0,30)}...")이 passage에 문장 단위로 그대로 노출`);
        }
      }
    }

    // ── V70~V78: 출제 가이드라인 content quality checks ──

    // V70: 빈칸어휘/빈칸추론 — 빈칸(____) 위치 검증
    if (['빈칸 어휘 완성', '빈칸어휘', '빈칸추론', '빈칸 추론', '빈칸 문맥 완성', '빈칸문맥'].includes(typeNorm)) {
      const stemHasBlank = (q.stem || '').includes('____');
      const passageHasBlank = (q.passage || '').includes('____');
      if (stemHasBlank && !passageHasBlank) {
        result.add('V70', SEV.S, `Q${qid}: ${typeNorm} 빈칸이 stem에 있음 — 빈칸은 반드시 passage 안에 있어야 함`);
      }
    }

    // V71: passage가 fullPassage 전체이면 FAIL (발췌해야 함)
    if (['빈칸 어휘 완성', '빈칸어휘', '빈칸추론', '빈칸 추론', '빈칸 문맥 완성', '빈칸문맥'].includes(typeNorm)) {
      if (q.passage && fullPassage && q.passage.replace(/<[^>]+>/g,'').replace(/_{3,}/g,'').trim() === fullPassage.trim()) {
        result.add('V71', SEV.S, `Q${qid}: ${typeNorm} passage가 fullPassage 전체와 동일 — 5~8문장으로 발췌해야 함`);
      }
    }

    // V72: 서술형 핵심단어 — passage 6~10문장 필수
    if (typeNorm.includes('서술형') && (typeNorm.includes('핵심') || typeNorm.includes('찾기'))) {
      const pText = (q.passage || '').replace(/<[^>]+>/g, '');
      const sentCount = (pText.match(/[.!?]+/g) || []).length;
      if (sentCount > 0 && sentCount < 5) {
        result.add('V72', SEV.S, `Q${qid}: 서술형(찾기) passage가 ${sentCount}문장 — 최소 6문장 필요`);
      }
    }

    // V73: 영작 서술형 — passage 비어야 함 (원문 노출 방지)
    if (typeNorm.includes('영작') || (q.fmt === 'written' && (q.stem || '').includes('영작'))) {
      if (q.passage && String(q.passage).length > 10) {
        result.add('V73', SEV.S, `Q${qid}: 영작 서술형인데 passage가 있음 — passage 비워야 함 (원문 노출 방지)`);
      }
    }

    // V74: 어형변환 — passage 2~4문장
    if (typeNorm.includes('어형') || typeNorm.includes('어형 변환')) {
      const pText = (q.passage || '').replace(/<[^>]+>/g, '');
      const sentCount = (pText.match(/[.!?]+/g) || []).length;
      if (sentCount > 4) {
        result.add('V74', SEV.A, `Q${qid}: 어형변환 passage가 ${sentCount}문장 — 2~4문장 권장 (정답 단어 노출 방지)`);
      }
    }

    // V75: (A)(B)(C) 조합형 — passage 5~8문장
    if (typeNorm === '(A)(B)(C) 조합형' || typeNorm === '(A)(B)(C)조합형' || typeNorm === '(A)(B)(C)') {
      const pText = (q.passage || '').replace(/<[^>]+>/g, '');
      const sentCount = (pText.match(/[.!?]+/g) || []).length;
      if (sentCount > 0 && sentCount < 4) {
        result.add('V75', SEV.A, `Q${qid}: (A)(B)(C) 조합형 passage가 ${sentCount}문장 — 5~8문장 권장`);
      }
    }

    // V76: 영영풀이 — passage 없어야 함
    if (typeNorm === '영영풀이 매칭' || typeNorm === '영영풀이') {
      if (q.passage && String(q.passage).length > 10) {
        result.add('V76', SEV.S, `Q${qid}: 영영풀이인데 passage 있음 — passage 없어야 함 (밑줄 있으면 정답 노출)`);
      }
    }

    // V77: 내용일치/불일치 — passage 5~10문장
    if (['내용일치', '내용불일치', '내용이해'].includes(typeNorm)) {
      const pText = (q.passage || '').replace(/<[^>]+>/g, '');
      const sentCount = (pText.match(/[.!?]+/g) || []).length;
      if (sentCount > 0 && sentCount < 4) {
        result.add('V77', SEV.A, `Q${qid}: ${typeNorm} passage가 ${sentCount}문장 — 5~10문장 권장`);
      }
    }

    // V78: 동의어/반의어 — passage 3~5문장
    if (typeNorm.includes('동의어') || typeNorm.includes('반의어')) {
      const pText = (q.passage || '').replace(/<[^>]+>/g, '');
      const sentCount = (pText.match(/[.!?]+/g) || []).length;
      if (sentCount > 0 && sentCount < 2) {
        result.add('V78', SEV.A, `Q${qid}: ${typeNorm} passage가 ${sentCount}문장 — 3~5문장 권장`);
      }
    }

    // V-WRITTEN-WORDCOUNT (A급): 서술형 영작 stem에 단어 수 조건 필수
    // 2026-04-06 jacob 24강 검수 — feedback_written_wordcount.md
    if (q.fmt === 'written' && (typeNorm.includes('영작') || stem.includes('영작'))) {
      if (q.wa && typeof q.wa === 'string') {
        const waWords = q.wa.trim().split(/\s+/).filter(Boolean);
        if (waWords.length >= 2) {
          const stemText = q.stem || '';
          const hasCond = /\(\d+\s*단어\)|\d+\s*단어를?\s*올바른|한\s*단어|한\s*문장|[a-z]로\s*시작/i.test(stemText);
          if (!hasCond) {
            result.add('V-WRITTEN-WORDCOUNT', SEV.A, `Q${qid}: 서술형 영작 stem에 단어 수 조건 누락 (wa: "${q.wa}")`);
          }
        }
      }
    }

    // V-WRITTEN-FIND-PASSAGE (S급): stem "본문에서 찾아" ↔ passage에서 정답 빈칸 처리 모순
    // 2026-04-06 jacob 24강 검수 — feedback_written_find_in_passage.md
    if (q.fmt === 'written' && q.wa && typeof q.wa === 'string') {
      const stemText = q.stem || '';
      if (/본문에서\s*찾아|본문에서\s*골라|지문에서\s*찾아|지문에서\s*골라/.test(stemText)) {
        const waLower = q.wa.trim().toLowerCase();
        if (waLower.length > 0) {
          const visiblePassage = (q.passage && String(q.passage).trim().length > 0) ? q.passage : (fullPassage || '');
          const visibleClean = String(visiblePassage).replace(/<[^>]+>/g, '').toLowerCase();
          if (!visibleClean.includes(waLower)) {
            result.add('V-WRITTEN-FIND-PASSAGE', SEV.S, `Q${qid}: stem이 "본문에서 찾아"인데 정답 "${q.wa}"이 passage에서 빈칸 처리됨`);
          }
        }
      }
    }

    // V-DET-ANALYSIS-DUP-HEADER (B급): det.analysis 헤더 요약 블록 (① ① 형태) 중복
    // 2026-04-06 jacob 24강 검수 — feedback_det_analysis_format.md
    if (q.det && typeof q.det.analysis === 'string' && q.det.analysis.trim().length > 0) {
      const aText = q.det.analysis.replace(/<[^>]+>/g, '');
      const aLines = aText.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 5);
      const dupHeader = aLines.filter(line => /^[✅❌]\s*[①②③④]\s*[①②③④]/.test(line)).length;
      if (dupHeader >= 1) {
        result.add('V-DET-ANALYSIS-DUP-HEADER', SEV.B, `Q${qid}: det.analysis 헤더 요약 블록 중복 (① ① 형태). 한 블록 순서 정리 권장.`);
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

    // X35: placeholder choices — 가짜 선지 차단
    if (Array.isArray(q.ch)) {
      const placeholderPatterns = [
        /^\(다른 뜻\)/,
        /^\(다른 뜻\) \(변형\)/,
        /^선택\d$/,
        /^오답 \d$/,
        /^글의 (핵심|내용)을? (정확히|부정적으로)/,
        /^지문의 핵심/,
        /^지문에서 언급되지 않은/,
        /^본문에서 확인할 수 없는/,
        /^필자의 의도와 다른/,
        /^원문의 내용과 상반/,
        /^지문과 반대되는/,
        /^지문과 일치하는/,
        /^지문의 흐름과/,
        /^문맥상 적절한 연결/,
        /^핵심 내용을 담은/,
      ];
      q.ch.forEach((c, ci) => {
        if (typeof c !== 'string') return;
        for (const pat of placeholderPatterns) {
          if (pat.test(c.trim())) {
            result.add('X35', SEV.S, `Q${qid}: ch[${ci+1}]="${c.substring(0,30)}" — 플레이스홀더 선지 (가짜)`);
            break;
          }
        }
      });
    }

    // X40: stem이 '다음 글'/'이 글'/'밑줄' 참조하는데 passage 없음
    // 문장삽입/순서배열은 passage 없이 stem에 텍스트를 포함하므로 제외 (V63-B 참조)
    if (q.fmt === 'mc' && !['문장삽입', '순서배열', '글순서'].includes(typeNorm)) {
      const stemPlain = (q.stem || '').replace(/<[^>]+>/g, '');
      if ((stemPlain.includes('다음 글') || stemPlain.includes('이 글') || stemPlain.includes('밑줄 친')) && (!passage || passage.trim().length === 0)) {
        // Skip if stem itself contains substantial english (passage embedded in stem)
        const stemEng = (stemPlain.match(/[a-zA-Z]+/g) || []).length;
        if (stemEng < 20) {
          result.add('X40', SEV.S, `Q${qid}: stem이 지문 참조하는데 passage 없음 — 풀 수 없음`);
        }
      }
    }

    // X41: stem 자체가 플레이스홀더
    {
      const stemPlain = (q.stem || '').replace(/<[^>]+>/g, '');
      if (/지문의 핵심 연결 문장|지문에서 확인할 수 없|핵심 요약 문장/.test(stemPlain)) {
        result.add('X41', SEV.S, `Q${qid}: stem이 플레이스홀더 — "${stemPlain.substring(0,40)}"`);
      }
    }

    // X43: passage에 한국어 섞임 (영어 지문이어야 함)
    if (q.fmt === 'mc' && passage && passage.length > 30) {
      const passagePlain = passage.replace(/<[^>]+>/g, '');
      const koreanMatches = passagePlain.match(/[가-힣]+/g);
      if (koreanMatches && koreanMatches.length >= 3) {
        // 3개 이상 한국어 토큰이면 명백한 오염
        result.add('X43', SEV.S, `Q${qid}: passage에 한국어 섞임 — "${koreanMatches.slice(0,3).join(',')}"`);
      }
    }

    // X44: 난이도-배점 불일치
    if (q.diff && q.pts) {
      const expected = q.diff === '쉬움' ? 4 : q.diff === '보통' ? 5 : q.diff === '어려움' ? 6 : null;
      if (expected && q.pts !== expected) {
        result.add('X44', SEV.A, `Q${qid}: diff=${q.diff} pts=${q.pts} (expected ${expected})`);
      }
    }

    // X42: 어법 마커형 ans↔det.korean 불일치 (학생이 화면에서 보는 정답이 해설과 다름)
    if (q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 4) {
      const isMarkerCh = q.ch.every(c => typeof c === 'string' && /^[①②③④⑤]\s*$/.test(c.trim()));
      if (isMarkerCh && q.det && q.det.korean) {
        // 우선순위 1: "①word" 또는 "③ word →" 같은 마커+단어 직접 패턴
        let wrongWord = null;
        const markerWordMatch = q.det.korean.match(/^[①②③④⑤]\s*([a-zA-Z][a-zA-Z\s\-']{1,30}?)(?:\s*[:→↔]|$)/m);
        if (markerWordMatch) {
          wrongWord = markerWordMatch[1].trim();
        } else {
          // 우선순위 2: "X → Y" 패턴 (단, "→ Y" 형태로 시작하면 안 됨)
          const arrowMatch = q.det.korean.match(/(?:^|\.\s*|\n)([a-zA-Z][a-zA-Z\s\-']{2,30}?)\s*→/);
          if (arrowMatch) wrongWord = arrowMatch[1].trim();
        }
        if (wrongWord) {
          const markers = ['①','②','③','④','⑤'];
          const ansIdx = q.ans - 1;
          if (ansIdx >= 0 && ansIdx < markers.length) {
            const ansPattern = new RegExp(markers[ansIdx] + '\\s*<u>([^<]+)</u>');
            const ansMatch = passage.match(ansPattern);
            if (ansMatch) {
              const ansWord = ansMatch[1].trim();
              if (ansWord.toLowerCase() !== wrongWord.toLowerCase() && !ansWord.toLowerCase().includes(wrongWord.toLowerCase().split(/\s+/)[0])) {
                result.add('X42', SEV.S, `Q${qid}: ans=${q.ans}(${ansWord}) ↔ det.korean="${wrongWord}" 불일치 — 학생화면 정답이 해설과 다름`);
              }
            }
          }
        }
      }
    }

    // X36: 선지 중복 — 동일 선지 2개 이상
    if (Array.isArray(q.ch)) {
      const chSet = new Set();
      q.ch.forEach((c, ci) => {
        if (typeof c !== 'string' || c.length <= 3 || /^[①②③④⑤]$/.test(c.trim())) return;
        if (chSet.has(c)) {
          result.add('X36', SEV.S, `Q${qid}: 선지 중복 "${c.substring(0, 30)}"`);
        }
        chSet.add(c);
      });
    }

    // X37: __FULL__ 리터럴 노출
    if (passage && passage.includes('__FULL__')) {
      result.add('X37', SEV.S, `Q${qid}: passage에 "__FULL__" 리터럴 노출`);
    }

    // X38: ans=0 (범위 밖)
    if (q.fmt === 'mc' && q.ans === 0) {
      result.add('X38', SEV.S, `Q${qid}: ans=0 — 1~4 범위 밖`);
    }

    // X39: 가짜 어형변환 (nonsense 단어: influencedtion, skepticismtion 등)
    if (q.fmt === 'written' && q.wa && typeof q.wa === 'string') {
      // 정상 영단어 화이트리스트 (regex 패턴에 걸리지만 실제 존재하는 단어)
      const X39_WHITELIST = new Set([
        'consciousness','seriousness','willingness','mindfulness','usefulness',
        'effectiveness','purposefulness','persuasiveness','expressiveness',
        'playfulness','receptiveness','memorability','attractiveness',
        'aggressiveness','competitiveness','creativeness','decisiveness',
        'exclusiveness','impressiveness','inventiveness','objectiveness',
        'perceptiveness','productiveness','progressiveness','protectiveness',
        'responsiveness','selectiveness','sensitiveness','submissiveness',
        'successfulness','supportiveness','thoughtfulness','assertiveness',
        'thankfulness','gratefulness','hopefulness','resourcefulness',
        'meaningfulness','cheerfulness','forgetfulness','restfulness',
      ]);
      const waWords = q.wa.split(/\s+/);
      const nonsenseWord = waWords.find(w => /[a-z]+(tion|ment|ness|ful|ous|ive|al|ed|ing|ly)(tion|ness)$/i.test(w) && w.length > 10 && !X39_WHITELIST.has(w.toLowerCase()));
      if (nonsenseWord) {
        result.add('X39', SEV.S, `Q${qid}: wa="${q.wa}" — 존재하지 않는 어형변환`);
      }
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

    // EX-1: 빈칸 문제 — 정답이 passage의 빈칸 외 다른 곳에 그대로 노출
    // 빈칸이 있는데 다른 곳에도 같은 단어가 있으면 B급 (원문에 반복 등장하는 단어일 수 있음)
    // 빈칸 자체가 없으면 A급
    if (['빈칸추론', '빈칸 추론', '빈칸 문맥 완성', '빈칸 어휘 완성', '연결사'].includes(typeNorm) && q.fmt === 'mc' && Array.isArray(q.ch)) {
      const answer = (q.ch[q.ans - 1] || '').trim();
      if (answer.length >= 3) {
        const passageNoBlanks = passagePlain.replace(/_{5,}/g, '').toLowerCase();
        const ansLower = answer.toLowerCase();
        if (passageNoBlanks.includes(ansLower)) {
          const hasBlank = passage.includes('____');
          const exSev = (answer.length <= 5 || hasBlank) ? SEV.B : SEV.A;
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
    if (q.fmt === 'written' && q.wa && typeof q.wa === 'string' && (q.stem || '').includes('원문에서 찾아')) {
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
      const answer = (q.ch[q.ans - 1] || '').trim();
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
      const answer = (q.ch[q.ans - 1] || '').trim();
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

  // ── A6: 정답 분포 — 한 번호 5개 이상 금지 ──
  if (questions.length === 20) {
    const ansDist = {};
    questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number').forEach(q => {
      ansDist[q.ans] = (ansDist[q.ans] || 0) + 1;
    });
    Object.entries(ansDist).forEach(([ans, count]) => {
      if (count > 5) {
        result.add('A6', SEV.S, `정답 ${ans}번이 ${count}개 — 6개 이상 금지 (최대 5개)`);
      }
    });
  }

  // ── A7: 같은 정답 3연속 금지 ──
  const mcQuestions = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
  for (let i = 0; i < mcQuestions.length - 2; i++) {
    if (mcQuestions[i].ans === mcQuestions[i+1].ans && mcQuestions[i+1].ans === mcQuestions[i+2].ans) {
      result.add('A7', SEV.S, `Q${mcQuestions[i].id}~Q${mcQuestions[i+2].id}: 정답 ${mcQuestions[i].ans}번 3연속 금지`);
    }
  }

  // ── P-UL4: 어법/부적절 밑줄 4개 필수 (passage 또는 stem에서 체크) ──
  // 단, "밑줄 고치기" (ch가 같은 단어의 변형)는 1개 밑줄이면 충분
  // "밑줄 찾기" (ch가 "① word" 형식)만 4개 마커 필수
  questions.forEach(q => {
    const t = (q.type || '').trim();
    if (['어법', '문맥상 부적절한 어휘', '부적절어휘', '부적절'].includes(t)) {
      const hasCircledCh = q.ch && q.ch.some(c => /^[①②③④⑤]/.test((c || '').trim()));
      if (!hasCircledCh) return; // "밑줄 고치기" 타입 — 1개 밑줄이면 OK
      const text = (q.passage || '') + (q.stem || '');
      const ulCount = (text.match(/①|②|③|④/g) || []).length;
      if (q.fmt === 'mc' && q.ch && q.ch.length === 4 && ulCount < 4) {
        result.add('P-UL4', SEV.A, `Q${q.id}: ${t} 밑줄찾기인데 마커 ${ulCount}개 — 4개 필수`);
      }
    }
  });

  // ── P-SEN: 동의어/반의어 밑줄 필수 ──
  questions.forEach(q => {
    const t = (q.type || '').trim();
    if (t.includes('동의어') || t.includes('반의어')) {
      const stem = q.stem || '';
      if (!stem.includes('<u>') && !stem.includes('<b>') && !stem.includes('밑줄')) {
        result.add('P-SEN', SEV.A, `Q${q.id}: ${t}인데 밑줄(<u>) 없음 — 대상 단어에 밑줄 필수`);
      }
    }
  });

  // ── P-TF: T/F는 워크북 전용 ──
  questions.forEach(q => {
    const t = (q.type || '').trim();
    if ((t === 'T/F' || t === 'TF') && testType !== '워크북') {
      result.add('P-TF', SEV.S, `Q${q.id}: T/F는 워크북 전용 — ${testType}에서 사용 금지`);
    }
  });

  // ── P-STEM-EN: 서술형 stem에 '영어' 명시 ──
  questions.forEach(q => {
    if (q.fmt === 'written') {
      const t = (q.type || '').trim();
      const stem = q.stem || '';
      if ((t.includes('찾기') || t.includes('핵심단어')) && !stem.includes('영어')) {
        result.add('P-STEM-EN', SEV.A, `Q${q.id}: 서술형(찾기) stem에 "영어" 명시 없음 — "영어 단어를 찾아 쓰시오" 필수`);
      }
      if (t.includes('한영') && !stem.includes('영어')) {
        result.add('P-STEM-EN', SEV.A, `Q${q.id}: 한영인데 stem에 "영어" 명시 없음`);
      }
    }
  });

  // ── F10-D: 서술형 accept에 마침표 변형 포함 ──
  questions.forEach(q => {
    if (q.fmt === 'written' && q.wa && typeof q.wa === 'string' && Array.isArray(q.accept)) {
      const wa = q.wa.trim();
      if (wa.endsWith('.')) {
        const noDot = wa.slice(0, -1).trim();
        if (!q.accept.some(a => a.trim() === noDot)) {
          result.add('F10-D', SEV.A, `Q${q.id}: accept에 마침표 없는 변형("${noDot.substring(0,30)}") 없음`);
        }
      } else if (wa.length > 10) {
        const withDot = wa + '.';
        if (!q.accept.some(a => a.trim() === withDot)) {
          result.add('F10-D', SEV.B, `Q${q.id}: accept에 마침표 있는 변형 없음 (권장)`);
        }
      }
    }
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

  // ── SEM-3: 어법 ch[]↔passage <u> 밑줄 순서 정합 ──
  // 어법 유형 문항에서 ch 순서가 passage 밑줄 출현 순서와 다르면 학생이 풀 수 없음
  const GRAMMAR_TYPES = ['어법', '어법 빈칸', '어법 밑줄형', '어법 빈칸형', '어법 5지선다'];

  // 탐욕적 매칭: 정확 매칭 우선, 이미 사용된 인덱스 제외
  function matchChToUnderlines(chWords, underlineWords) {
    const used = new Set();
    const mapping = new Array(chWords.length).fill(-1);

    // Pass 1: 정확 매칭
    chWords.forEach((c, ci) => {
      const idx = underlineWords.findIndex((u, ui) => !used.has(ui) && u === c);
      if (idx !== -1) { mapping[ci] = idx; used.add(idx); }
    });

    // Pass 2: 포함 매칭 (긴 것 우선)
    chWords.forEach((c, ci) => {
      if (mapping[ci] !== -1) return;
      const idx = underlineWords.findIndex((u, ui) => !used.has(ui) && (u.includes(c) || c.includes(u)));
      if (idx !== -1) { mapping[ci] = idx; used.add(idx); }
    });

    return mapping;
  }

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    const typeNorm = (q.type || '').trim();
    if (!GRAMMAR_TYPES.some(gt => typeNorm.includes(gt))) return;

    const psg = q.passage || fullPassage || '';
    const uMatches = psg.match(/<u>([^<]+)<\/u>/g);
    if (!uMatches || uMatches.length < 2) return;

    const underlineWords = uMatches.map(m => m.replace(/<\/?u>/g, '').trim().toLowerCase());
    const chWords = (q.ch || []).map(c => (c || '').trim().toLowerCase());
    if (chWords.length === 0) return;

    const mapping = matchChToUnderlines(chWords, underlineWords);
    const matchedCount = mapping.filter(m => m !== -1).length;
    if (matchedCount < 2) return; // 밑줄형이 아닌 어법 문항은 스킵

    // 순서 비교: 매칭된 인덱스가 증가 순서인지
    const chOrder = mapping.filter(m => m !== -1);
    let isOrdered = true;
    for (let j = 1; j < chOrder.length; j++) {
      if (chOrder[j] <= chOrder[j - 1]) { isOrdered = false; break; }
    }

    if (!isOrdered) {
      result.add('SEM-3', SEV.A, `Q${qid}: 어법 ch[] 순서가 passage <u> 밑줄 출현 순서와 불일치`);
    }

    // ch 단어가 밑줄에 없는 경우도 경고
    chWords.forEach((c, ci) => {
      if (c && mapping[ci] === -1) {
        result.add('SEM-3', SEV.A, `Q${qid}: ch[${ci + 1}]="${q.ch[ci]}"가 passage 밑줄에 없음`);
      }
    });
  });

  // ── SEM-4: det "X→Y" 패턴↔ans 위치 매칭 ──
  // det.korean에서 "X→Y" 형태의 수정 설명이 있으면, X가 있는 ch 인덱스 = ans여야 함
  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    if (!q.det || !q.det.korean) return;
    if (typeof q.ans !== 'number') return;

    const korean = q.det.korean;
    // "X → Y" 또는 "X→Y" 패턴 추출
    const arrowMatch = korean.match(/(\S+)\s*→\s*<b>([^<]+)<\/b>/);
    if (!arrowMatch) return;

    const wrongWord = arrowMatch[1].replace(/[②③④①⑤]/g, '').trim().toLowerCase();
    const chWords = (q.ch || []).map(c => (c || '').trim().toLowerCase());

    // wrongWord가 있는 ch 인덱스 찾기 (1-indexed)
    const wrongIdx = chWords.findIndex(c => c === wrongWord || c.includes(wrongWord) || wrongWord.includes(c));
    if (wrongIdx === -1) return;

    const expectedAns = wrongIdx + 1; // 1-indexed
    if (q.ans !== expectedAns) {
      result.add('SEM-4', SEV.A, `Q${qid}: det "${arrowMatch[1]}→${arrowMatch[2]}" → ch[${expectedAns}]인데 ans=${q.ans}`);
    }
  });

  // ── SEM-1: fullPassage↔stem 교차오염 검출 ──
  // 다른 번호의 passage 키워드가 stem/ch에 대량 혼입되면 복붙 사고
  // 단일 파일에서는 self-check만 가능: passage 키워드와 전혀 관련없는 stem 탐지
  if (fullPassage && fullPassage.length > 100) {
    const fpWords = new Set(
      fullPassage.replace(/<[^>]+>/g, '').toLowerCase()
        .split(/\s+/)
        .filter(w => w.length >= 5) // 5자 이상 단어만
    );

    // stem에 독립적 영어 문장이 정상적으로 포함되는 유형은 제외
    const SEM1_EXEMPT_TYPES = [
      '영영풀이', '영영풀이 매칭', '어형 변환', '어형변환', '어형 변환 (서술형)',
      '서술형', '서술', '영작문', '한영', '한→영',
      '요약', '요약문', '문장삽입', '문장 삽입', '순서배열', '순서', '글순서',
      '빈칸추론', '빈칸 추론', '빈칸 문맥 완성', '빈칸(문장)',
      '어순배열', '어순'
    ];

    questions.forEach((q, i) => {
      const qid = q.id || (i + 1);
      const typeNorm = (q.type || '').trim();
      if (SEM1_EXEMPT_TYPES.some(t => typeNorm.includes(t))) return;

      const stem = (q.stem || '').toLowerCase();
      const stemWords = stem.split(/\s+/).filter(w => w.length >= 5);
      if (stemWords.length < 3) return;

      const englishStemWords = stemWords.filter(w => /^[a-z]+$/.test(w));
      if (englishStemWords.length < 3) return;

      const notInPassage = englishStemWords.filter(w => !fpWords.has(w));
      const foreignRatio = notInPassage.length / englishStemWords.length;

      if (foreignRatio >= 0.8 && notInPassage.length >= 5) {
        result.add('SEM-1', SEV.B, `Q${qid}: stem 영어단어 ${notInPassage.length}/${englishStemWords.length}개가 fullPassage에 없음 — 교차오염 의심`);
      }
    });
  }

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

  // ── Cross-file validation (N2, N3, N6) ──
  if (files.length > 3) {
    console.log(`\n--- Cross-file checks ---`);
    let crossIssues = 0;

    // Group files by exam (same directory parent = same exam)
    const examGroups = {};
    files.forEach(f => {
      try {
        const data = JSON.parse(fs.readFileSync(f, 'utf8'));
        // Group by grandparent dir (e.g., 모의고사/고3/9월/)
        const rel = path.relative(path.join(ROOT, 'data'), f);
        const parts = rel.split(path.sep);
        // exam key = first 3 parts (e.g., 모의고사/고3/9월) or 교과서/출판사/과
        const examKey = parts.slice(0, Math.min(3, parts.length - 1)).join('/');
        const testType = data.testType || '';
        const groupKey = `${examKey}/${testType}`;
        if (!examGroups[groupKey]) examGroups[groupKey] = [];
        examGroups[groupKey].push({ path: f, rel, data, testType });
      } catch (e) { /* skip */ }
    });

    Object.entries(examGroups).forEach(([groupKey, group]) => {
      if (group.length < 2) return;

      // N2: 정답 시퀀스 동일 탐지
      const ansSeqs = {};
      group.forEach(g => {
        const qs = g.data.questions || [];
        const seq = qs.map(q => q.ans).filter(a => a !== null && a !== undefined).join(',');
        if (seq.length > 5) {
          if (!ansSeqs[seq]) ansSeqs[seq] = [];
          ansSeqs[seq].push(path.relative(ROOT, g.path));
        }
      });
      Object.entries(ansSeqs).forEach(([seq, dupFiles]) => {
        if (dupFiles.length >= 2) {
          crossIssues++;
          console.log(`  [S] N2: 정답 시퀀스 동일 (${dupFiles.length}파일): ${dupFiles.slice(0, 3).join(', ')}${dupFiles.length > 3 ? ` 외 ${dupFiles.length - 3}파일` : ''}`);
        }
      });

      // N3: stem+ch 완전 복붙 탐지 (같은 그룹 내 다른 파일)
      const qFingerprints = {};
      group.forEach(g => {
        const qs = g.data.questions || [];
        qs.forEach(q => {
          const fp = JSON.stringify({ stem: q.stem, ch: q.ch });
          if (!qFingerprints[fp]) qFingerprints[fp] = new Set();
          qFingerprints[fp].add(path.relative(ROOT, g.path));
        });
      });
      let crossCopyCount = 0;
      Object.entries(qFingerprints).forEach(([fp, fileSet]) => {
        if (fileSet.size >= 3) crossCopyCount++;
      });
      if (crossCopyCount >= 5) {
        crossIssues++;
        const sampleFiles = group.slice(0, 3).map(g => path.relative(ROOT, g.path));
        console.log(`  [A] N3: stem+ch 복붙 ${crossCopyCount}건 — ${sampleFiles.join(', ')} 등`);
      }

      // N6: 시험 단위 ans 분포 편향
      const ansDist = { 1: 0, 2: 0, 3: 0, 4: 0 };
      let totalAns = 0;
      group.forEach(g => {
        (g.data.questions || []).forEach(q => {
          if (typeof q.ans === 'number' && q.ans >= 1 && q.ans <= 4) {
            ansDist[q.ans]++;
            totalAns++;
          }
        });
      });
      if (totalAns >= 40) {
        Object.entries(ansDist).forEach(([ans, count]) => {
          const pct = (count / totalAns * 100).toFixed(1);
          if (pct > 40) {
            crossIssues++;
            console.log(`  [A] N6: ${groupKey} — ans=${ans}가 ${pct}% (${count}/${totalAns}) — 40% 초과 편향`);
          }
          if (pct < 10) {
            crossIssues++;
            console.log(`  [A] N6: ${groupKey} — ans=${ans}가 ${pct}% (${count}/${totalAns}) — 10% 미만 부족`);
          }
        });
      }
    });

    if (crossIssues === 0) {
      console.log('  Cross-file checks: ALL CLEAN');
    } else {
      console.log(`  Cross-file issues: ${crossIssues}건`);
      totalFail += crossIssues;
    }
  }

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
    if (entry.isDirectory() && entry.name !== '_passages') {
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
