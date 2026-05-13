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

// ── Load question-schema.json — single source of truth for rules ──
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'question-schema.json'), 'utf8'));

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
  // Non-standard question count files accepted silently (legacy 지문별 분리 등)

  // ── S2: sum(pts) check — derived from SCHEMA.global.totalScore ──
  const schemaTotalScore = SCHEMA.global.totalScore;
  const schemaTotalQ = SCHEMA.global.totalQuestions;
  const totalPts = questions.reduce((s, q) => s + (q.pts || 0), 0);
  if (questions.length === schemaTotalQ && totalPts !== schemaTotalScore) {
    result.add('S2', SEV.S, `sum(pts) = ${totalPts}, expected ${schemaTotalScore}`);
  } else if (questions.length !== schemaTotalQ && totalPts !== (ei.total || totalPts)) {
    // For non-20 files, check EI.total matches actual
    if (ei.total && ei.total !== totalPts) {
      result.add('S2', SEV.B, `sum(pts) = ${totalPts}, ei.total = ${ei.total}`);
    }
  }

  // ── S3~S5: 배점 분포 — derived from SCHEMA.global.diffDistribution ──
  if (questions.length === schemaTotalQ && totalPts === schemaTotalScore) {
    const diffDist = SCHEMA.global.diffDistribution;
    const diffChecks = [
      { id: 'S3', diff: '쉬움', expectedCount: diffDist['쉬움'].count, expectedPts: diffDist['쉬움'].pts },
      { id: 'S4', diff: '보통', expectedCount: diffDist['보통'].count, expectedPts: diffDist['보통'].pts },
      { id: 'S5', diff: '어려움', expectedCount: diffDist['어려움'].count, expectedPts: diffDist['어려움'].pts },
    ];
    for (const dc of diffChecks) {
      const matched = questions.filter(q => q.diff === dc.diff && q.pts === dc.expectedPts);
      if (matched.length !== dc.expectedCount) {
        result.add(dc.id, SEV.S, `${dc.diff}(${dc.expectedPts}점) count = ${matched.length}, expected ${dc.expectedCount}`);
      }
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
  if (questions.length === schemaTotalQ && ei.total !== schemaTotalScore) {
    result.add('S6', SEV.S, `ei.total = ${ei.total}, expected ${schemaTotalScore}`);
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

  // ── Derive noPassageTypes from schema (computed once, not per question) ──
  const noPassageTypes = Object.entries(SCHEMA.questionTypes)
    .filter(([k, v]) => {
      const rule = typeof v.passageRule === 'string' ? v.passageRule : '';
      return rule.includes('없음') || rule.includes('빈 문자열');
    })
    .map(([k]) => k);
  if (!noPassageTypes.includes('영영풀이 매칭')) noPassageTypes.push('영영풀이 매칭');
  const noPassageAliases = [
    '한영', '한→영', '한영영작',
    '어형 변환 (서술형)', '어형변화', '어형변형',
    '서술형', '서술형 — 영작', '서술형 — 조건영작', '영작문 (서술형)',
    '서술형 — 배열영작',
    '순서배열', '글순서', '문장삽입',
  ];
  for (const alias of noPassageAliases) {
    if (!noPassageTypes.includes(alias)) noPassageTypes.push(alias);
  }

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
      // F10-B/C: 채점 시 production이 NORM(소문자/마침표/하이픈) 자동 정규화 → accept 변형 강제 불필요. 정보성으로만 유지.
      // 변경 이력: 2026-04-15 jacob — 출제 오버헤드 제거. 채점은 항상 case/period/hyphen 무시.
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
    // noPassageTypes is derived from SCHEMA.questionTypes above (before the loop)
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

    // V61: 영작 서술형 — 2026-04-08 보정. 새 원칙: passage 필수, 단 영어 정답 자리는 ____ 처리
    // 검사 비활성화 (S-NO-PASSAGE + S-ANS-NEAR-BLANK가 대체)

    // V62: "빈칸에 들어갈"/"위 글의 빈칸"/"위 빈칸" stem인데 passage에 빈칸 없음
    // ⛔ 어법/어휘/추론 모두 포함. passage가 존재하는 경우만 (passage 자체가 없는 유형은 X40이 처리)
    // 서술형 "찾기" 유형은 stem에 빈칸이 있어도 passage에는 필요 없음 (stem 안 한국어 문장의 빈칸)
    const isFindType = stem.includes('찾아 쓰시오') || stem.includes('찾아쓰시오') || stem.includes('본문에서 찾아');
    if ((stem.includes('위 글의 빈칸') || stem.includes('위 빈칸') || stem.includes('빈칸에 들어갈') || stem.includes('빈 칸에 들어갈')) && passage.trim().length > 10 && !passage.includes('____') && !passage.includes('_____') && !isFindType) {
      result.add('V62', SEV.S, `Q${qid}: stem에 "빈칸"이라고 했는데 passage에 빈칸(____) 없음 — 풀 수 없음`);
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
    // typeNorm이 '영작'/'서술형 — 영작'/'조건영작' 등 포함
    if (q.fmt === 'written' && (typeNorm.includes('영작') || stem.includes('영작'))) {
      if (!stem.includes('조건') && !stem.includes('사용할 것') && !stem.includes('사용하여') && !stem.includes('단어 사용') && !stem.includes('단어로')) {
        result.add('V63-D', SEV.A, `Q${qid}: 영작 문항인데 조건이 없음 — "조건:" 명시 필수`);
      }
    }

    // V67-H: 함축의미 추론 — passage에 <u> 밑줄 필수 (stem이 "밑줄 친" 명시 안 해도)
    if (typeNorm === '함축의미 추론' || typeNorm === '함축의미추론') {
      if (!passage.includes('<u>') && !passage.includes('<b>')) {
        result.add('V67-H', SEV.S, `Q${qid}: 함축의미 추론인데 passage에 <u> 밑줄 없음 — 대상 구절 표시 필수`);
      }
    }

    // V63-E: 어형변환 — stem에 "괄호 안의"라 했는데 passage/stem에 (word) 또는 [word] 없음
    if (typeNorm.includes('어형') && (stem.includes('괄호 안의') || stem.includes('괄호 속의') || stem.includes('괄호안의'))) {
      const parenRe = /[\(\[][A-Za-z][A-Za-z\s\-']*[\)\]]/;
      const hasParen = parenRe.test(passage) || parenRe.test(stem);
      if (!hasParen) {
        result.add('V63-E', SEV.S, `Q${qid}: 어형변환 "괄호 안의 단어" stem인데 괄호가 없음 — 학생이 변환 대상 모름`);
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
    // ⛔ '함축의미 추론' 제거: 함축의미는 밑줄 구절이 반드시 있어야 풀 수 있음
    const V67_EXEMPT_TYPES = ['영영풀이 매칭', '영영풀이', '어형 변환', '서술형 — 어형변환', '서술형 — 핵심단어', '내용이해 T/F', '오류찾기'];
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

    // V69: 서술형 — 정답(wa)이 passage에 문장 단위로 그대로 노출 (어형변환/찾기/영작 제외)
    // 찾기/영작은 fullPassage 맥락 제공이 필수라 노출 허용 (jacob 결정 2026-04-09)
    if (q.fmt === 'written' && q.wa && typeof q.wa === 'string') {
      const waLower = q.wa.toLowerCase().trim();
      const skipTypes = ['어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형'];
      const stem = String(q.stem || '');
      const isFindStem = /본문에서\s*찾아|본문\s*속|글에서\s*찾아|본문에서\s*고르|찾아\s*쓰시오/.test(stem);
      const isWriting = /영작/.test(typeNorm) || /영작/.test(stem);
      if (!skipTypes.includes(typeNorm) && !isFindStem && !isWriting && waLower.length > 15) {
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

    // V73: 2026-04-08 보정 — 영작 서술형도 passage 필수 (새 원칙)
    // 검사 비활성화. S-NO-PASSAGE + S-ANS-NEAR-BLANK로 대체

    // V74: 어형변환 — passage 2~4문장
    if (typeNorm.includes('어형') || typeNorm.includes('어형 변환')) {
      const pText = (q.passage || '').replace(/<[^>]+>/g, '');
      const sentCount = (pText.match(/[.!?]+/g) || []).length;
      if (sentCount > 6) {
        result.add('V74', SEV.S, `Q${qid}: 어형변환 passage가 ${sentCount}문장 — 2~4문장 권장, 6문장 초과 차단 (정답 단어 노출 방지)`);
      } else if (sentCount > 4) {
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
          const hasCond = /\(\d+\s*단어\)|\d+\s*단어로?\s*(쓸|올바른|작성)|한\s*단어|한\s*문장|[a-z]로\s*시작/i.test(stemText);
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

    // X31 — "undefined"가 fullPassage 원문에 있으면 false positive이므로 제외
    if (/\bundefined\b|\bnull\b|\bNaN\b/.test(allText.replace(/"[^"]*"/g, ''))) {
      // Only flag if not inside a JSON string value context
      // Simple heuristic: check in stem and passage directly
      const directText = (q.stem || '') + ' ' + (passage || '');
      const fpHasUndefined = fullPassage && /\bundefined\b/.test(fullPassage);
      const testPattern = fpHasUndefined ? /\bNaN\b/ : /\bundefined\b|\bNaN\b/;
      if (testPattern.test(directText)) {
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

    // X40: stem이 '다음 글'/'이 글'/'본문'/'밑줄' 참조하는데 passage 없음
    // 문장삽입/순서배열은 passage 없이 stem에 텍스트를 포함하므로 제외 (V63-B 참조)
    // ⛔ mc/written 모두 검사: 서술형도 "이 글에서..." stem이면 passage 필수
    if (!['문장삽입', '순서배열', '글순서'].includes(typeNorm)) {
      const stemPlain = (q.stem || '').replace(/<[^>]+>/g, '');
      if ((stemPlain.includes('다음 글') || stemPlain.includes('이 글') || stemPlain.includes('본문') || stemPlain.includes('윗글') || stemPlain.includes('위 글') || stemPlain.includes('밑줄 친')) && (!passage || passage.trim().length === 0)) {
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

    // X44: 난이도-배점 불일치 — derived from SCHEMA.global.diffDistribution
    if (q.diff && q.pts) {
      const diffEntry = SCHEMA.global.diffDistribution[q.diff];
      const expected = diffEntry ? diffEntry.pts : null;
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
        'nothingness','willingness','belongingness','lovingness',
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
    // 2026-04-06 보정: 빈칸 직후 5단어 이내 노출은 S-ANS-NEAR-BLANK로 이관.
    // 여기서는 "빈칸 자체가 없는데 정답이 본문에 있음"만 A급으로 차단.
    // 빈칸이 있는 경우 본문 다른 곳 등장은 B급 경고 (정상 케이스).
    if (['빈칸추론', '빈칸 추론', '빈칸 문맥 완성', '빈칸 어휘 완성', '연결사'].includes(typeNorm) && q.fmt === 'mc' && Array.isArray(q.ch)) {
      const answer = (q.ch[q.ans - 1] || '').trim();
      if (answer.length >= 3) {
        const passageNoBlanks = passagePlain.replace(/_{5,}/g, '').toLowerCase();
        const ansLower = answer.toLowerCase();
        if (passageNoBlanks.includes(ansLower)) {
          const hasBlank = passage.includes('____');
          // 빈칸이 있으면 항상 B (경고). 빈칸 없는 빈칸형은 A (차단).
          const exSev = hasBlank ? SEV.B : SEV.A;
          result.add('EX-1', exSev, `Q${qid}: 빈칸 정답 "${answer}" 이 지문에 그대로 노출됨${hasBlank ? ' (빈칸 있음 · 참고)' : ' — 빈칸 없음'}`);
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

  // ───────────────────────────────────────────────────────────────
  // S급 추가 검사 11종 (2026-04-06) — 사고 재발 방지, 보수적 매칭
  // ───────────────────────────────────────────────────────────────
  const COMMON_EN_SHORT = new Set(['the','a','an','of','to','in','on','at','by','it','is','be','as','or','if','no','so','do','we','he','i','me','my','us','up','go','no','am','us','our','his','her','its','for','and','but','not','was','are','has','had','can','may','too','out','off','use','one','two','all','any','new','old','how','why','who','you','she','him','them','this','that','from','with','into','than','then','when','what','were','have','been','will','also','more','some','such','most','both','each','does','only','very','over','many','much','ad','ads','dr','mr','ms','mrs','st','co','tv','pc','ai','id','uk','us','eu','un','vs','ok','tax','etc','cf','eg','ie']);
  const META_PATTERNS = [
    /\(원문에 없[는음]/,
    /\[\d점\]/,
    /✅|❌/,
    /\(보기\)/,
    /출제자/,
    /정답\s*:/
  ];

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    const stem = (q.stem || '').toString();
    const passage = (q.passage || '').toString();
    const ch = Array.isArray(q.ch) ? q.ch.map(c => (c || '').toString()) : [];
    const wa = (q.wa || '').toString();
    const typeNorm = (q.type || '').trim();
    const isMc = q.fmt === 'mc';
    const isWritten = q.fmt === 'written';

    // S-META-LEAK: 메타 텍스트 노출
    const metaTargets = [
      { name: 'passage', txt: passage },
      { name: 'stem', txt: stem },
      ...ch.map((c, idx) => ({ name: `ch[${idx + 1}]`, txt: c }))
    ];
    for (const t of metaTargets) {
      for (const pat of META_PATTERNS) {
        if (pat.test(t.txt)) {
          result.add('S-META-LEAK', SEV.S, `Q${qid}: ${t.name}에 메타 텍스트 노출 — ${pat}`);
          break;
        }
      }
    }

    // S-FULL-PLACEHOLDER: __FULL__ 등 미치환 플레이스홀더 학생 노출 (트랙B Phase1, 2026-04-09)
    // 사고: feedback_full_placeholder_bug — passage="__FULL__"이 학생 화면에 그대로 표시 (34건+)
    const PLACEHOLDER_PATTERNS = [
      /__FULL__/,
      /__PASSAGE__/,
      /__STEM__/,
      /\{\{[A-Z_]+\}\}/,
      /<<[A-Z_]+>>/
    ];
    for (const t of metaTargets) {
      for (const pat of PLACEHOLDER_PATTERNS) {
        if (pat.test(t.txt)) {
          result.add('S-FULL-PLACEHOLDER', SEV.S, `Q${qid}: ${t.name}에 미치환 플레이스홀더 노출 — ${pat}`);
          break;
        }
      }
    }

    // S-PREFIX-DOMINANT: ch 4개 중 3+가 동일한 15자+ prefix (긴 문장형 ch만)
    // 조합형/단어형 제외 (공유 prefix가 정상)
    const isCombinatorial = /\(A\)\(B\)\(C\)|조합|동의어|반의어|영영풀이|한영|어형|다의어/.test(typeNorm);
    if (isMc && ch.length >= 4 && !isCombinatorial) {
      const avgLen = ch.reduce((s, c) => s + c.length, 0) / ch.length;
      if (avgLen >= 30) {
        const norm = ch.map(c => c.replace(/\s+/g, ' ').trim().toLowerCase());
        const prefixCounts = {};
        for (const c of norm) {
          if (c.length >= 15) {
            const p = c.slice(0, 15);
            prefixCounts[p] = (prefixCounts[p] || 0) + 1;
          }
        }
        for (const [p, cnt] of Object.entries(prefixCounts)) {
          if (cnt >= 3) {
            result.add('S-PREFIX-DOMINANT', SEV.S, `Q${qid}: ch 4개 중 ${cnt}개가 동일 prefix "${p}..." — 형식 편향`);
            break;
          }
        }
      }
    }

    // S-CIRCULAR-STEM: 서술형에서 wa가 stem에 따옴표로 노출
    if (isWritten && wa) {
      const isDefinitionType = /다음 한국어 뜻|영영풀이|뜻에 해당하는|해당하는 단어/.test(stem);
      if (!isDefinitionType) {
        const waEsc = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const quotePat = new RegExp(`['"\u2018\u2019\u201C\u201D]\\s*${waEsc}\\s*['"\u2018\u2019\u201C\u201D]|\\*\\*${waEsc}\\*\\*`, 'i');
        if (quotePat.test(stem)) {
          result.add('S-CIRCULAR-STEM', SEV.S, `Q${qid}: 서술형 wa("${wa}")가 stem에 따옴표로 노출 — 정답 노출`);
        }
      }
    }

    // S-MISSING-KOREAN: "우리말에 맞도록"/"다음 우리말" 등인데 한국어 단서 부족
    if (/우리말에 맞도록|다음 우리말|우리말 뜻|아래 우리말/.test(stem)) {
      // 지시문 외에 한국어 단서가 더 있어야 함
      const koreanChars = (stem.match(/[가-힣]/g) || []).length;
      // 지시문 자체가 길면 보통 15자+ 한국어. 추가 한국어 5자가 더 있어야 한다.
      // 보수적으로: 한국어 총 길이가 15자 이하이면 단서 부족
      if (koreanChars <= 15) {
        result.add('S-MISSING-KOREAN', SEV.S, `Q${qid}: "우리말" 지시문이 있는데 stem 한국어 ${koreanChars}자 — 단서 부족`);
      }
    }

    // S-WORDCOUNT-MISMATCH: stem에 (N단어) 명시 + wa 단어 수 불일치
    if (wa) {
      const m = stem.match(/\((?:조건\s*:\s*)?(\d{1,2})\s*단어(?:\s*사용)?\)/);
      if (m) {
        const expected = parseInt(m[1], 10);
        const actual = wa.trim().split(/\s+/).filter(Boolean).length;
        if (actual !== expected) {
          result.add('S-WORDCOUNT-MISMATCH', SEV.S, `Q${qid}: stem 명시 ${expected}단어 vs wa 실제 ${actual}단어`);
        }
      }
    }

    // S-CH-TRUNCATED: ch 끝이 미완결 영어 단어 또는 한국어 어미 없이 끝남
    if (isMc && ch.length) {
      ch.forEach((c, idx) => {
        const trimmed = c.trim();
        if (!trimmed) return;
        // T/F/O/X 등 짧은 정답 라벨 제외
        if (trimmed.length <= 5) return;
        // 영어 ch (한글 거의 없음)
        const koreanCnt = (trimmed.match(/[가-힣]/g) || []).length;
        const isEnglish = koreanCnt < 2 && /[a-zA-Z]/.test(trimmed);
        if (isEnglish) {
          // ... 으로 끝나면서 길이 50자+
          if (/\.\.\.$/.test(trimmed) && trimmed.length >= 50) {
            result.add('S-CH-TRUNCATED', SEV.S, `Q${qid}: ch[${idx + 1}] "..." 절단 (${trimmed.length}자)`);
            return;
          }
          // 마지막 단어가 1~3자이고 알려진 단어 아님
          const lastWord = (trimmed.match(/([A-Za-z]+)\s*[.!?]?$/) || [, ''])[1];
          if (lastWord && lastWord.length >= 1 && lastWord.length <= 2) {
            if (!COMMON_EN_SHORT.has(lastWord.toLowerCase()) && !/[.!?"'\)\]]$/.test(trimmed)) {
              result.add('S-CH-TRUNCATED', SEV.S, `Q${qid}: ch[${idx + 1}] 끝 단어 "${lastWord}" — 미완결 의심`);
            }
          }
        }
      });
    }

    // S-MARKER-LEAK: passage에 ①②③④⑤ 마커가 있는데 해당 유형 아닐 때
    const markerCount = (passage.match(/[①②③④⑤]/g) || []).length;
    const markerAllowedTypes = [
      '(A)(B)(C) 조합형','어법','어법 오류','어법성 판단','오류 찾기','문법 오류','오류찾기',
      '내용일치','내용 일치','내용불일치','내용 불일치',
      '문장삽입','문장 삽입','순서배열','글의 순서','순서','어순배열','문맥상 부적절한 어휘','부적절한 어휘',
      '어휘','부적절어휘','부적절',
      '무관한문장찾기','무관한 문장 찾기','무관한문장','무관한'
    ];
    const typeNoSpace = typeNorm.replace(/\s+/g, '');
    if (markerCount >= 2 && !markerAllowedTypes.some(t => typeNoSpace.includes(t.replace(/\s+/g,'')))) {
      result.add('S-MARKER-LEAK', SEV.S, `Q${qid}: passage에 마커 ${markerCount}개 노출 (type=${typeNorm})`);
    }

    // S-TYPE-CONTENT-MISMATCH: 내용일치인데 ch 4개 모두 부정문
    if (typeNorm.replace(/\s+/g, '') === '내용일치' && isMc && ch.length === 4) {
      const negativeCount = ch.filter(c => /^It is not|^원문에 없|^다음 중 .*아니|아니다\.?$|않다\.?$|없다\.?$/.test(c.trim())).length;
      if (negativeCount === 4) {
        result.add('S-TYPE-CONTENT-MISMATCH', SEV.S, `Q${qid}: 내용일치인데 ch 4개 모두 부정형 — 정답=긍정 구조 위반`);
      }
    }

    // S-PASSAGE-1-SENTENCE: mc 문항 passage가 1문장
    const noPassageOk = ['동의어','반의어','영영풀이','한영','어형변환','다의어'];
    if (isMc && passage && !noPassageOk.some(t => typeNorm.includes(t))) {
      const sentCount = (passage.replace(/\s+/g, ' ').match(/[.!?]['")\]]?(\s|$)/g) || []).length;
      if (sentCount <= 1 && passage.replace(/\s+/g,'').length > 20) {
        result.add('S-PASSAGE-1-SENTENCE', SEV.S, `Q${qid}: mc passage가 1문장 — 너무 짧음`);
      }
    }

    // S-PASSAGE-NOT-FULL: 모의/부교재 — passage가 fullPassage 90% 미만 (jacob 2026-04-09)
    // 학생은 발췌가 아닌 fullPassage 통째에서 풀어야 함.
    // 면제: 어형변환 (V74 길이 권장) / 영영풀이 (passage 불필요) / 문장단위 어법 / 짧은 자체완결 지문 (안내문 등)
    if (data && data.fullPassage && passage && typeof passage === 'string') {
      const subj = String((data.ei && data.ei.subject) || '');
      const isMockOrSupp = /모의|수능특강|수능완성|EBS|부교재/.test(subj) || /모의고사|부교재/.test(String(data.ei && data.ei.pub || ''));
      const fullLen = data.fullPassage.length;
      if (isMockOrSupp && fullLen >= 200) {
        const typeNoSpace = String(typeNorm || '').replace(/\s+/g, '');
        // 면제: 어형변환/영영풀이/영작/어법/부적절 어휘 (paraphrased excerpts OK) + 찾기 stem
        const skipFull = /어형변환|영영풀이|다의어|문장단위어법|조건영작|어순배열|오류찾기/.test(typeNoSpace) || /본문에서\s*찾아|본문\s*속/.test(String(q.stem || ''));
        // 문장단위 어법: ①②③④ at sentence start, no <u>
        const isSentLevelGrammar = /[①②③④⑤]\s*[A-Z]/.test(passage) && !/<u>/i.test(passage) && (passage.match(/[①②③④⑤]/g) || []).length >= 3;
        if (!skipFull && !isSentLevelGrammar) {
          const passLen = passage.length;
          if (passLen < fullLen * 0.85) {
            result.add('S-PASSAGE-NOT-FULL', SEV.S, `Q${qid}: passage(${passLen}자)가 fullPassage(${fullLen}자)의 85% 미만 — 모의/부교재는 fullPassage 통째 + 오버레이만 허용`);
          }
        }
      }
    }

    // S-WA-IN-PASSAGE: 서술형 wa가 passage에 그대로 등장 (찾기/영작/어형/한영 유형 제외)
    // 영작도 fullPassage 맥락 제공이 필수라 노출 허용 (jacob 결정 2026-04-09)
    if (isWritten && wa && passage) {
      const isFindInPassage = /본문에서\s*찾아|본문\s*속|발췌|본문 그대로|본문에서\s*골라|지문에서\s*찾아|글에서\s*찾아|찾아\s*쓰시오/.test(stem);
      const isWriting = /영작/.test(typeNorm) || /영작/.test(stem);
      // 어형변환: passage에 (원형) 형태가 있어 변형 정답이 substring으로 잡힘 / 한영: 한국어→영어 매칭
      const isMorphOrK2E = typeNorm.includes('어형') || typeNorm.includes('한영');
      if (!isFindInPassage && !isWriting && !isMorphOrK2E) {
        const waNorm = wa.trim().toLowerCase();
        if (waNorm.length >= 4 && passage.toLowerCase().includes(waNorm)) {
          result.add('S-WA-IN-PASSAGE', SEV.S, `Q${qid}: 서술형 wa가 passage에 그대로 노출 — 정답 노출`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-WRITTEN-NO-PASSAGE (2026-04-13): 서술형에 passage 없으면 차단
    // 규칙: 모든 서술형(mc+written)에 passage 필수. 예외: 영영풀이, 다의어만
    // ─────────────────────────────────────────────────────────────
    if (isWritten && !passage && !/영영/.test(typeNorm) && !/다의어/.test(typeNorm)) {
      result.add('S-WRITTEN-NO-PASSAGE', SEV.S, `Q${qid}: 서술형인데 passage 없음 — 모든 서술형에 passage 필수`);
    }

    // ─────────────────────────────────────────────────────────────
    // S-WRITTEN-NO-LANG (2026-04-13): 서술형 stem에 응답 언어(영어/우리말) 미지정
    // ─────────────────────────────────────────────────────────────
    if (isWritten && stem) {
      const hasLang = /영어로|우리말로|한국어로|한글로|English|Korean/.test(stem);
      const isWordForm = /어형|변환/.test(typeNorm); // 어형변환은 언어 자명
      const isWordOrder = /어순|배열/.test(typeNorm); // 어순배열도 자명
      if (!hasLang && !isWordForm && !isWordOrder) {
        result.add('S-WRITTEN-NO-LANG', SEV.S, `Q${qid}: 서술형 stem에 응답 언어(영어로/우리말로) 미지정 — 학생이 뭘 써야 하는지 모름`);
      }
    }

    // S-COND-IS-WORDORDER 삭제 (2026-04-13)
    // 조건영작은 [조건] 단어수 = wa 단어수 허용 (어순배열과 형식 동일, 한국어 해석 제시가 차이점)

    // ─────────────────────────────────────────────────────────────
    // S-META-CHOICE (2026-04-15): 메타 선지 차단
    // C7 "뻔한 오답" 규칙 코드화. 오답이 "본문에서 언급된", "다루지 않은", "관련 없는",
    // "부차적", "직접 언급되지 않은", "논점과 상반" 등 메타 서술이면 학생이 passage 안 읽고 소거 가능
    // 적용: mc (주제/요지/내용일치/지칭추론 등)
    // ─────────────────────────────────────────────────────────────
    if (isMc && Array.isArray(q.ch) && q.ch.length >= 2) {
      const META_PATTERNS = [
        /본문에서\s*언급/,
        /본문에서\s*직접\s*언급되지/,
        /다루지\s*않은/,
        /관련\s*없는/,
        /부차적/,
        /상반되는\s*결론/,
        /논점과\s*상반/,
        /본문의\s*부차/,
        /본문에\s*없는/,
        /언급되지\s*않은/,
        /본문과\s*무관/,
        /글에서\s*다루지/,
        /주요\s*대상/,
        /비교되는\s*다른\s*대상/
      ];
      const metaHits = q.ch.filter(c => {
        const s = String(c || '').replace(/<[^>]*>/g, '').trim();
        return META_PATTERNS.some(re => re.test(s));
      });
      if (metaHits.length >= 1) {
        result.add('S-META-CHOICE', SEV.S, `Q${qid}: 선지에 메타 서술 포함 (${metaHits.length}건) — 학생이 passage 없이 소거법으로 풀림. C7 뻔한오답 금지 위반`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-ANTONYM-PREFIX (2026-04-15, 확장 2026-04-15): 접두사 조작형 반의어 차단
    // 의미 학습 없이 un-/in-/dis-/mis-/non-/im- 등 제거만으로 답이 되는 문제
    // 예: stem "'unmatch'의 반의어" wa="match" → 접두사 un 제거 = 정답. 무의미
    // 확장: mc 선지(ch)에도 적용 — "unbehavior", "untogether" 같은 비실존 단어 차단
    // ─────────────────────────────────────────────────────────────
    const PREFIXES = ['un', 'in', 'im', 'dis', 'mis', 'non', 'anti', 'de', 'ir', 'il'];
    // Common English words by prefix (valid words that START with prefix but are NOT pseudo)
    // This is a heuristic: if word starts with prefix AND base (after prefix) is a common word,
    // AND the prefixed word is NOT in a basic dictionary, flag it as pseudo.
    // Simpler approach: check against a small "known-good prefixed words" list.
    const KNOWN_PREFIXED_WORDS = new Set([
      'understand','uniform','university','under','until','unit','union','unique','unless','unlike',
      'inside','into','involve','income','increase','industry','influence','information','interest','international','internet','interview',
      'important','improve','impression','impact','imagine','immediate',
      'discuss','discover','display','distance','disagree','disappear','distinct','distinguish','discipline',
      'mistake','missing','missile','mission','mist','missionary',
      'nonsense','nothing','notion','notice','novel',
      'antique','anticipate','anxiety',
      'describe','design','decide','decrease','depart','deposit','derive','despair','despite','destination','destroy','detail','determine',
      'iron','ironic','irritate',
      'island','isle'
    ]);
    // Check mc ch for pseudo-prefix words in 어휘 부적절/문맥 inappropriate questions
    if (isMc && Array.isArray(q.ch) && (/어휘|부적절/.test(typeNorm) || /적절하지\s*<b>?\s*않은/.test(stem))) {
      const chTexts = q.ch.map(c => String(c || '').replace(/<[^>]*>/g, '').trim());
      for (let i=0;i<chTexts.length;i++) {
        const ct = chTexts[i];
        const m = ct.match(/\b([a-z]+)\b/gi);
        if (!m) continue;
        for (const word of m) {
          const lw = word.toLowerCase();
          if (lw.length < 5) continue;
          for (const pfx of PREFIXES) {
            if (lw.startsWith(pfx) && lw.length > pfx.length + 2) {
              const base = lw.slice(pfx.length);
              const fpLow = (fullPassage || '').toLowerCase();
              // Pseudo check: base is in passage but prefixed form is NOT + prefixed is not in known dict
              if (fpLow.includes(base) && !fpLow.includes(lw) && !KNOWN_PREFIXED_WORDS.has(lw)) {
                result.add('S-ANTONYM-PREFIX', SEV.S, `Q${qid}: ch[${i+1}]="${lw}" — 접두사 "${pfx}-" 비실존 조작 의심 (base "${base}"는 passage에 있으나 "${lw}"는 없음). 학생이 단어 형태만 보고 편법 풀이 가능`);
                break;
              }
            }
          }
        }
      }
    }
    // 기존: written 반의어 (stem → wa)
    if (isWritten && stem && wa && /반의어|반대/.test(stem)) {
      const stemWordMatch = stem.match(/['"'‘’“”]([a-zA-Z][a-zA-Z-]+)['"'‘’“”]/);
      if (stemWordMatch) {
        const stemWord = stemWordMatch[1].toLowerCase();
        const waWord = wa.replace(/[.!?,]+$/, '').trim().toLowerCase();
        for (const pfx of PREFIXES) {
          if (stemWord.startsWith(pfx) && stemWord.slice(pfx.length) === waWord) {
            result.add('S-ANTONYM-PREFIX', SEV.S, `Q${qid}: 접두사 "${pfx}-" 제거형 반의어 — "${stemWord}"에서 ${pfx} 빼면 정답 "${waWord}". 기계적 문제, 의미 학습 X`);
            break;
          }
          if (waWord.startsWith(pfx) && waWord.slice(pfx.length) === stemWord) {
            result.add('S-ANTONYM-PREFIX', SEV.S, `Q${qid}: 접두사 "${pfx}-" 추가형 반의어 — "${stemWord}"에 ${pfx} 붙이면 정답 "${waWord}". 기계적 문제, 의미 학습 X`);
            break;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-DUPLICATE-ITEM (2026-04-15): 같은 파일 내 중복 문항 차단
    // 선지/정답/stem이 거의 동일한 문항이 2개 이상이면 차단
    // 예: Q18 = Q19 (ch 배열 같음, ans 같음, stem 90%+ 동일)
    // ─────────────────────────────────────────────────────────────
    if (isMc && Array.isArray(q.ch) && q.ch.length === 4 && i < questions.length - 1) {
      // 마커형(①②③④) 선지는 중복 체크 제외 — 내용은 overlay가 결정하므로 오탐
      const MARKER_SET = new Set(['①','②','③','④','⑤']);
      const isMarkerCh = q.ch.every(c => MARKER_SET.has(String(c).trim()));
      // T/F형 선지는 중복 체크 제외 — 선지가 고정(T/F/None)이므로 stem이 다르면 다른 문항
      const isTFCh = q.ch.some(c => /^[TF]\s*\(/.test(String(c).trim()) || /^(True|False)$/i.test(String(c).trim()));
      if (!isMarkerCh && !isTFCh) for (let j = i + 1; j < questions.length; j++) {
        const other = questions[j];
        if (!other || !Array.isArray(other.ch) || other.ch.length !== 4) continue;
        // 상대도 마커형이면 스킵
        const otherIsMarker = other.ch.every(c => MARKER_SET.has(String(c).trim()));
        if (otherIsMarker) continue;
        // Check if ch arrays are identical (as sets)
        const chSet = new Set(q.ch.map(c => String(c).toLowerCase().trim()));
        const otherChSet = new Set(other.ch.map(c => String(c).toLowerCase().trim()));
        if (chSet.size === 4 && otherChSet.size === 4) {
          const intersection = [...chSet].filter(x => otherChSet.has(x)).length;
          if (intersection === 4) {
            // Also check ans 표현 동일성 (same correct answer content)
            const qAns = String(q.ch[q.ans - 1] || '').toLowerCase().trim();
            const oAns = String(other.ch[other.ans - 1] || '').toLowerCase().trim();
            if (qAns === oAns) {
              result.add('S-DUPLICATE-ITEM', SEV.S, `Q${qid}↔Q${other.id}: 선지 4개 + 정답 내용 완전 동일 — 중복 문항. 하나를 다른 유형/선지로 교체 필수`);
              break;
            }
          }
        }
      } // end for j (marker check guard)
    }

    // ─────────────────────────────────────────────────────────────
    // S-MULTI-CORRECT (2026-04-15): 내용 일치/불일치에 복수 정답 차단
    // stem이 "일치하는 것"/"일치하지 않는 것"인데 오답 선지 중 2개 이상이
    // passage 내용과도 일치하면 복수 정답 → 채점 불가
    // 휴리스틱: 오답 선지의 주요 명사구가 passage에 그대로 등장하는 비율로 판단
    // ─────────────────────────────────────────────────────────────
    if (isMc && Array.isArray(q.ch) && q.ch.length === 4 && typeof q.ans === 'number' &&
        (/일치하는|일치하지/.test(stem))) {
      const fpLow = (fullPassage || '').toLowerCase();
      const isFindMatching = /일치하는\s*것/.test(stem) && !/일치하지\s*않/.test(stem);
      // "일치하는 것" (find matching) — 오답 3개는 passage에 없어야 함
      // "일치하지 않는 것" (find non-matching) — 오답 3개는 passage에 있어야 함
      const wrongs = q.ch.map((c, idx) => ({ c: String(c || '').replace(/<[^>]*>/g, '').trim(), idx })).filter(x => x.idx !== q.ans - 1);
      // 주요 명사구 추출: 한국어 명사 체인(2글자 이상)
      let matchCount = 0;
      for (const w of wrongs) {
        // passage 토큰 기반 간이 매칭: 한국어는 어렵고, 영어 고유명사/구문 기반
        const ENtokens = w.c.match(/[a-zA-Z][a-zA-Z'-]+/g) || [];
        const KOtokens = w.c.match(/[가-힣]{2,}/g) || [];
        const enInPassage = ENtokens.filter(t => t.length >= 4 && fpLow.includes(t.toLowerCase())).length;
        const koInPassage = KOtokens.filter(t => t.length >= 3 && (data.korean || '').includes(t) || fpLow.includes(t.toLowerCase())).length;
        // 한국어 번역 기반 판단은 불완전 — 영어 토큰 + 기본 키워드 매칭
        const wKeywords = w.c.match(/[가-힣]{3,}|[a-zA-Z]{4,}/g) || [];
        const keywordMatch = wKeywords.filter(kw => {
          const kl = kw.toLowerCase();
          return fpLow.includes(kl) || (kw.match(/[가-힣]/) && questions.some(qq => (qq.korean || '').includes(kw)));
        }).length;
        const ratio = wKeywords.length ? keywordMatch / wKeywords.length : 0;
        if (ratio >= 0.5 && wKeywords.length >= 2) matchCount++;
      }
      // Flag conditions:
      if (isFindMatching && matchCount >= 2) {
        result.add('S-MULTI-CORRECT', SEV.S, `Q${qid}: 내용 일치 문제에서 오답 ${matchCount}개 이상이 passage와 일치 의심 — 복수 정답 위험. 오답 선지를 passage와 무관한 내용으로 교체 필수`);
      } else if (!isFindMatching && matchCount <= 1) {
        // "일치하지 않는 것"인데 오답이 passage와 거의 일치 안 하면 복수 정답 없음 → OK
        // 반대로 오답들도 대부분 일치 안 한다면 "일치하지 않는 것" 여러 개 → 복수 정답
        // 이건 또 다른 이슈이지만 여기선 skip (more data needed)
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-DISTRACTOR-ALL-FIRST-SENT (2026-04-15): 빈칸추론 오답 3개가
    // passage 첫 문장 명사 재사용만이면 소거법 가능 — 차단
    // ─────────────────────────────────────────────────────────────
    // 함축의미/지칭 추론 제외 (해석 선지 기반이라 첫 문장 단어 재사용은 정상 패턴)
    if (isMc && Array.isArray(q.ch) && q.ch.length === 4 && typeof q.ans === 'number' &&
        /빈칸|빈칸어휘|빈칸추론/.test(typeNorm) && !/함축|지칭/.test(typeNorm) && fullPassage) {
      const firstSent = (fullPassage.match(/^[^.!?]+[.!?]/) || [''])[0].toLowerCase();
      if (firstSent.length >= 20) {
        const wrongs = q.ch.map((c, idx) => ({ c: String(c || '').replace(/<[^>]*>/g, '').trim(), idx }))
          .filter(x => x.idx !== q.ans - 1);
        let firstSentHits = 0;
        for (const w of wrongs) {
          const tokens = (w.c.match(/[a-zA-Z]{4,}/g) || []).map(t => t.toLowerCase());
          if (!tokens.length) continue;
          const inFirst = tokens.filter(t => firstSent.includes(t)).length;
          if (inFirst > 0 && inFirst / tokens.length >= 0.5) firstSentHits++;
        }
        if (firstSentHits === 3) {
          result.add('S-DISTRACTOR-ALL-FIRST-SENT', SEV.S, `Q${qid}: 빈칸 추론 오답 3개가 모두 passage 첫 문장 단어 재사용 — 학생이 본문 읽지 않고 문법/위치만으로 소거 가능`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-ANTI-CHEESE-GATE (2026-04-15): passage 없이 풀리는 문제 차단
    // 핵심 안전망. 어느 편법이든 "passage 빠져도 풀리면" = 문제로서 기능 X
    // 현재는 메타선지 누적 + 정답 선지가 유일하게 구체적(나머지 추상)인 경우 감지
    // ─────────────────────────────────────────────────────────────
    if (isMc && Array.isArray(q.ch) && q.ch.length === 4 && typeof q.ans === 'number' && q.ans >= 1 && q.ans <= 4) {
      const chTexts = q.ch.map(c => String(c || '').replace(/<[^>]*>/g, '').trim());
      // 정답 외 3개 선지 전부가 추상/메타 서술인지 검사
      const ABSTRACT_HINTS = [
        /본문/, /언급/, /다루/, /부차/, /무관/, /관련/, /상반/, /논점/, /결론/, /주장/, /요소/, /내용/
      ];
      const ansIdx = q.ans - 1;
      const wrongs = chTexts.filter((_, i) => i !== ansIdx);
      const abstractWrongs = wrongs.filter(w => ABSTRACT_HINTS.some(re => re.test(w)));
      if (abstractWrongs.length >= 3 && wrongs.length === 3) {
        result.add('S-ANTI-CHEESE-GATE', SEV.S, `Q${qid}: 오답 3개 전부 추상/메타 서술 — 학생이 passage 안 읽고도 정답 소거 가능. 문제로서 기능 안 함`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-MULTI-ITEM-WRITTEN (2026-04-15): 서술형에 "N가지 찾아 쓰시오" 다중 항목 금지
    // 원칙: 서술형 답은 "한 문항 = 한 항목". N가지 찾기는 쉼표/and 채점 지옥 유발
    // 적용:
    //   (a) stem에 "두/세/네/다섯 가지" + "찾아 쓰시오"/"찾아서" 조합
    //   (b) wa에 쉼표 2개 이상 (A, B, C) 또는 " and " 패턴 (A, B, and C)
    //   (c) stem에 "모두 쓰시오" + 구두점 조건 없음
    //   (d) (N단어) 단어수가 wa의 의미 토큰 수와 불일치 (예: 3가지인데 4단어)
    // 예외: 조건영작(wa가 문장), 어순배열(wa가 문장), 한영(단일 구문) — 허용
    // ─────────────────────────────────────────────────────────────
    if (isWritten && wa && stem) {
      const isWriting = /영작|어순|배열|한영/.test(typeNorm) || /영작|어순배열/.test(stem);
      const waLow = String(wa).trim();
      const hasMultiCommas = (waLow.match(/,/g) || []).length >= 2;
      const hasListAnd = /,\s*and\s+\w+/i.test(waLow);
      // "N가지를/개를 찾아 쓰시오" — multi-answer (bad)
      // "N가지 중 ~ 찾아 쓰시오" — single answer (OK, exempt)
      const stemMultiList = /(두|세|네|다섯|여섯|2|3|4|5|6)\s*(가지|개)(를|\s)\s*(모두|함께|다)?\s*(본문에서\s*)?찾아\s*쓰/.test(stem);
      const stemNMiddleOf = /(두|세|네|다섯|여섯|2|3|4|5|6)\s*(가지|개)\s*중/.test(stem);
      if (!isWriting) {
        if (hasListAnd) {
          result.add('S-MULTI-ITEM-WRITTEN', SEV.S, `Q${qid}: 서술형 wa가 "A, B, and C" 다중 항목 형식 — 쉼표/and 채점 모호. 단일 답 (1 항목) 원칙 위반`);
        } else if (hasMultiCommas && /찾아\s*쓰/.test(stem)) {
          result.add('S-MULTI-ITEM-WRITTEN', SEV.S, `Q${qid}: 서술형 wa에 쉼표 2+ 포함 + stem "찾아 쓰기" — 다중 항목 채점 모호. 단일 답 원칙 위반`);
        } else if (stemMultiList && !stemNMiddleOf) {
          result.add('S-MULTI-ITEM-WRITTEN', SEV.S, `Q${qid}: stem에 "N가지를 찾아 쓰시오" — 다중 항목 금지. 단일 답 + accept에 후보 여러 개 등록 원칙`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-STEM-NOT-IN-PASSAGE (2026-04-10): stem이 참조하는 단어가 passage에 없으면 차단
    // 원인: 다른 passage용 문항을 템플릿 복사한 후 stem/ch만 안 바꾼 경우
    // 적용: 동의어/반의어/함축의미 등 stem에 "<u>단어</u>" 참조가 있는 유형
    // ─────────────────────────────────────────────────────────────
    if (isMc && stem && passage) {
      // stem에서 <u>단어</u> 추출
      const stemUWords = [...stem.matchAll(/<u>([^<]+)<\/u>/g)].map(m => m[1].toLowerCase());
      for (const sw of stemUWords) {
        if (sw.length >= 3 && !passage.toLowerCase().includes(sw) && !(fullPassage || '').toLowerCase().includes(sw)) {
          result.add('S-STEM-NOT-IN-PASSAGE', SEV.S, `Q${qid}: stem이 참조하는 단어 "${sw}"가 passage에도 fullPassage에도 없음 — 다른 지문용 문항 복사 의심`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-DUPLICATE-PASSAGE-BLANK (2026-04-10): 같은 파일 내 빈칸 위치 중복 차단
    // 원인: 템플릿 복사 시 빈칸 문항이 전부 같은 단어를 비움
    // ─────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────
    // S-DET-FOREIGN-WORD (2026-04-10): det 해설에 passage에 없는 영어 핵심단어 참조 차단
    // 원인: 템플릿 복사 시 det.korean/analysis가 원래 passage 내용 그대로
    // 적용: det.korean에 <b>단어</b>가 있는데 그 단어가 passage/fp에 없으면 차단
    // ─────────────────────────────────────────────────────────────
    if (q.det && q.det.korean) {
      const detBoldWords = [...q.det.korean.matchAll(/<b>([A-Za-z][^<]*)<\/b>/g)].map(m => {
        // "training(훈련)" → "training", "took part(참여하다)" → "took part"
        let w = m[1].trim();
        w = w.replace(/\([^)]*\)/g, '').trim();  // Remove Korean in parentheses
        w = w.replace(/→.*$/, '').trim();         // Remove "→ correction" part
        return w.toLowerCase();
      });
      for (const dbw of detBoldWords) {
        if (dbw.length >= 4 && !(fullPassage || '').toLowerCase().includes(dbw) && !passage.toLowerCase().includes(dbw)) {
          // 예외: 어형변환(변형 형태), 동의어/반의어(정답 단어가 지문 밖), 영영풀이(정답 단어), 다의어
          const isMorph = typeNorm.includes('어형');
          const isSynAnt = typeNorm.includes('동의어') || typeNorm.includes('반의어');
          const isEngEng = typeNorm.includes('영영');
          const isPoly = typeNorm.includes('다의어');
          const isWriting = typeNorm.includes('영작') || typeNorm.includes('조건영작') || typeNorm.includes('한영');
          if (!isMorph && !isSynAnt && !isEngEng && !isPoly && !isWriting) {
            result.add('S-DET-FOREIGN-WORD', SEV.S, `Q${qid}: det 해설의 핵심단어 "${dbw}"가 지문에 없음 — 다른 지문용 문항 복사 의심`);
          }
        }
      }
    }

    // S-LENGTH-BIAS: mc 정답 길이가 오답 평균의 2.5배+
    // TODO: move lengthBiasRatio to schema (currently described in validateRules but no numeric field)
    if (isMc && ch.length === 4 && typeof q.ans === 'number' && q.ans >= 1 && q.ans <= 4) {
      const ansLen = ch[q.ans - 1].length;
      const wrong = ch.filter((_, idx) => idx !== q.ans - 1);
      const wrongAvg = wrong.reduce((s, c) => s + c.length, 0) / wrong.length;
      if (wrongAvg >= 5 && ansLen >= wrongAvg * 2.5) {
        result.add('S-LENGTH-BIAS', SEV.S, `Q${qid}: 정답 길이 ${ansLen}자 vs 오답 평균 ${wrongAvg.toFixed(1)}자 — 길이 편향`);
      }
    }

    // S-COND-WORD-MATCH (2026-04-08): 영작 서술형 [조건] 명시 단어와 wa 단어 일치 검증
    // stem에 "[조건] (1) X, Y, Z를 모두 사용" 패턴 → wa의 모든 단어가 X,Y,Z 안에 있어야 함
    // 메인 자기 편향 사고(and/a/or 등 기능어 빼먹기) 차단
    if (isWritten && q.wa && (typeNorm.includes('영작') || stem.includes('영작'))) {
      // [조건] 안의 "(1) X, Y, Z를 모두 사용" 패턴 추출
      const condMatch = stem.match(/\[?조건\]?[\s\S]*?\(1\)[^(]*?([a-zA-Z][\w,\s\-']*?)(?:를|을)\s*모두\s*사용/);
      if (condMatch) {
        const condStr = condMatch[1].trim();
        // 콤마로 분리, 각 단어 정리
        const condWords = condStr.split(/[,，]/).map(w => w.trim().toLowerCase()).filter(Boolean);
        if (condWords.length >= 2) {
          // wa의 단어들 (어법 변형 후 형태일 수 있으므로 stem 단어 기반으로 변형 허용)
          const waWords = String(q.wa).toLowerCase().split(/\s+/).filter(Boolean);
          // wa의 모든 단어가 조건 단어 (또는 변형) 안에 있는지
          // 간단 검증: wa 단어의 어근(첫 3~4글자)이 조건 단어에 있는지
          const condStems = condWords.map(w => w.substring(0, Math.min(4, w.length)));
          const missing = waWords.filter(ww => {
            const wwStem = ww.substring(0, Math.min(4, ww.length));
            // 조건 단어 또는 어근 매칭
            return !condWords.includes(ww) && !condStems.some(cs => wwStem.startsWith(cs.substring(0, 3)) || cs.startsWith(wwStem.substring(0, 3)));
          });
          if (missing.length > 0) {
            result.add('S-COND-WORD-MATCH', SEV.S, `Q${qid}: 영작 정답("${q.wa}")의 단어 중 [조건]에 명시 안 된 단어 있음: ${missing.join(', ')} — 학생이 만들 수 없음`);
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-WRITTEN-TOKEN-LEAK (2026-04-09): 영작 보기 토큰이 정답 순서 그대로 나열되면 차단
    // 학생이 보기를 베끼기만 하면 풀리는 가짜 영작 문제 영구 차단
    // 룰: stem 안 <b>...</b> 박스 또는 단독 슬래시-나열 토큰 시퀀스가 wa의 단어 순서와 일치하면 S급 FAIL
    // ─────────────────────────────────────────────────────────────
    if (isWritten && q.wa && stem) {
      const waNorm = String(q.wa).toLowerCase().replace(/[?.!,]/g, '').replace(/\s+/g, ' ').trim();
      // <b>...</b> 박스 또는 stem 마지막 줄의 슬래시 나열 추출
      const candidates = [];
      const bMatches = [...stem.matchAll(/<b>([^<]+)<\/b>/g)];
      for (const m of bMatches) {
        const inner = m[1];
        if (inner.includes('/') && inner.split('/').length >= 3) candidates.push(inner);
      }
      // stem 마지막 줄에 슬래시 나열만 있는 경우도 (HTML 태그 제거 후)
      const tail = stem.replace(/<[^>]+>/g, '').split(/\n|<br>/).map(s=>s.trim()).filter(Boolean).pop() || '';
      if (tail.includes('/') && tail.split('/').length >= 3) candidates.push(tail);
      for (const cand of candidates) {
        const tokens = cand.split('/').map(s => s.trim()).filter(Boolean);
        if (tokens.length < 3) continue;
        const seqNorm = tokens.join(' ').toLowerCase().replace(/[?.!,]/g, '').replace(/\s+/g, ' ').trim();
        if (seqNorm === waNorm) {
          result.add('S-WRITTEN-TOKEN-LEAK', SEV.S, `Q${qid}: 영작 보기 토큰 순서가 정답("${q.wa}") 그대로 — 학생이 베끼기만 하면 풀림. 알파벳순/셔플 필수`);
          break;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-TF-ORDER: T/F 2지선다는 ① T → ② F 순서 강제 (2026-04-09 추가)
    // ─────────────────────────────────────────────────────────────
    if (/T\/F|^TF$|TF 판별/.test(typeNorm) && Array.isArray(ch) && ch.length === 2) {
      const ch0 = ch[0].trim().toUpperCase();
      const ch1 = ch[1].trim().toUpperCase();
      const isF0 = ch0 === 'F' || ch0.startsWith('F ') || ch0.startsWith('FALSE');
      const isT1 = ch1 === 'T' || ch1.startsWith('T ') || ch1.startsWith('TRUE');
      if (isF0 && isT1) {
        result.add('S-TF-ORDER', SEV.S, `Q${qid}: T/F 순서가 F→T — 표준은 ① T → ② F`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2026-04-06 신규: passage 필수 + 빈칸 인접 정답 노출 + 패러프레이즈
    // ─────────────────────────────────────────────────────────────

    // S-NO-PASSAGE: mc/written 문항에 passage 필수
    // 예외: 영영풀이, 다의어(미니문장 (A)(B) 형식)
    if ((isMc || isWritten)) {
      const passageTrim = passage.replace(/\s+/g, ' ').trim();
      const hasNoPassage = passageTrim.length < 10;
      if (hasNoPassage) {
        const isEngDef = /영영풀이|영영 풀이|영영정의/.test(typeNorm);
        const isPolysemy = /다의어/.test(typeNorm);
        // 다의어는 stem에 (A)(B) 미니 문장이 있으면 통과
        const polysemyHasMini = isPolysemy && /\(A\)[\s\S]+\(B\)/.test(stem);
        // 순서배열/글순서/문장삽입은 stem에 본문 텍스트가 포함되므로 passage 없음 허용 (V63-B와 정합)
        const isOrderInsert = /순서배열|글순서|문장삽입|어순배열/.test(typeNorm);
        // 영작 서술형은 정답 노출 방지를 위해 passage 없음이 정상
        const isWritingTask = /조건영작|영작문|한영영작/.test(typeNorm);
        if (!isEngDef && !polysemyHasMini && !isOrderInsert && !isWritingTask) {
          result.add('S-NO-PASSAGE', SEV.S, `Q${qid}: passage 누락 (type=${typeNorm || '-'}, fmt=${q.fmt}) — passage 필수`);
        }
      }
    }

    // S-ANS-NEAR-BLANK: 빈칸형에서 빈칸 직후 5단어 이내에 정답 단어 그대로 노출
    // 본문 다른 위치 노출은 OK (EX-1에서 B급 경고로만 처리).
    if (isMc && ch.length >= 4 && typeof q.ans === 'number' && passage) {
      const isBlankType = /빈칸|연결사/.test(typeNorm);
      if (isBlankType) {
        const answer = (ch[q.ans - 1] || '').trim().toLowerCase();
        // 한 단어 또는 짧은 구만 검사 (너무 길면 의미 없음)
        if (answer.length >= 3 && answer.length <= 30) {
          const plain = passage.replace(/<[^>]+>/g, '');
          // 빈칸 위치: ____ 이상의 언더스코어
          const blankRe = /_{4,}/g;
          let m;
          while ((m = blankRe.exec(plain)) !== null) {
            const after = plain.slice(m.index + m[0].length, m.index + m[0].length + 200);
            // 직후 5단어 추출
            const next5 = (after.trim().split(/\s+/).slice(0, 5).join(' ') || '').toLowerCase();
            // 구두점 제거 후 단어 단위 매칭
            const next5Words = next5.replace(/[.,;:!?()'"]/g, '');
            const ansWords = answer.replace(/[.,;:!?()'"]/g, '');
            // 정답이 단일 단어이고, 직후 5단어 중에 정확히 포함되는지
            if (ansWords.split(/\s+/).length === 1) {
              const wordList = next5Words.split(/\s+/).filter(Boolean);
              if (wordList.includes(ansWords)) {
                result.add('S-ANS-NEAR-BLANK', SEV.S, `Q${qid}: 빈칸 직후 5단어 이내에 정답 "${answer}" 노출`);
                break;
              }
            } else if (next5Words.includes(ansWords)) {
              result.add('S-ANS-NEAR-BLANK', SEV.S, `Q${qid}: 빈칸 직후 5단어 이내에 정답 "${answer}" 노출`);
              break;
            }
          }
        }
      }
    }

    // S-PARAPHRASE-NEEDED (A급 경고): 내용일치/주제/제목 한국어 선지가 본문 영어 직역 패턴
    // 보수적으로: 한국어 선지가 없고 전부 영어면 skip (이미 다른 체크에서 잡힘)
    // 실제 구현은 A-PARAPHRASE로 A급 경고 (차단 아님 · false positive 방지)
    if (isMc && ch.length === 4 && typeof q.ans === 'number' && passage) {
      const isMatchType = /내용일치|내용 일치|내용불일치|내용 불일치|주제|제목|요지|대의/.test(typeNorm);
      if (isMatchType) {
        const ansCh = (ch[q.ans - 1] || '').trim();
        const koreanLen = (ansCh.match(/[가-힣]/g) || []).length;
        // 한국어 선지일 때만 검사
        if (koreanLen >= 5 && ansCh.length >= 10) {
          // 직역 탐지는 어려우므로 보수적: 선지 안에 영어 단어 2개 이상이 passage에 그대로 있을 때만
          const engWords = (ansCh.match(/[A-Za-z]{4,}/g) || []).map(w => w.toLowerCase());
          if (engWords.length >= 2) {
            const passLower = passage.toLowerCase();
            const exposed = engWords.filter(w => passLower.includes(w));
            if (exposed.length >= 2) {
              result.add('A-PARAPHRASE', SEV.S, `Q${qid}: 내용일치/주제 한국어 선지에 passage 영어 단어(${exposed.slice(0,3).join(',')}) 직역 의심 — 패러프레이즈 필수`);
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-MARKER-CLUSTER: 마커 분산 원칙 (2026-04-13)
    // 어법/부적절/오류찾기/(A)(B)(C) 마커가 본문 일부에만 몰리면 차단
    // ─────────────────────────────────────────────────────────────
    if (data && data.fullPassage && data.fullPassage.length >= 200) {
      const isMarkerType = /어법|부적절|오류찾기/.test(typeNorm) || /\(A\)\(B\)\(C\)|\(A\)\s*\(B\)\s*\(C\)/.test(typeNorm);
      if (isMarkerType && passage) {
        const fp = data.fullPassage;
        const quarterLen = Math.floor(fp.length / 4);
        // Extract marker words: ①②③④⑤ or (A)(B)(C)
        let markerPositions = [];
        const circledMarkers = ['①','②','③','④','⑤'];
        const abcMarkers = ['(A)','(B)','(C)'];
        const markers = /\(A\)/.test(passage) ? abcMarkers : circledMarkers;
        markers.forEach(m => {
          const idx = fp.indexOf(m);
          if (idx >= 0) markerPositions.push(idx);
        });
        if (markerPositions.length >= 3) {
          const quarters = new Set(markerPositions.map(pos => Math.min(3, Math.floor(pos / quarterLen))));
          if (quarters.size <= 1) {
            result.add('S-MARKER-CLUSTER', SEV.S, `Q${qid}: 마커가 본문 일부에만 몰려있음 — 전체 분산 필수`);
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-BLANK-MEMORIZATION: 빈칸 단어 선택 원칙 (2026-04-13)
    // 빈칸 정답이 단순 암기형(숫자/고유명사/요일/색깔 등)이면 차단
    // ─────────────────────────────────────────────────────────────
    {
      const isBlankType = /빈칸추론|빈칸\s*어휘\s*완성|빈칸\s*문맥\s*완성/.test(typeNorm);
      if (isBlankType) {
        let blankAnswer = '';
        if (isMc && Array.isArray(q.ch) && typeof q.ans === 'number' && q.ch[q.ans - 1]) {
          blankAnswer = q.ch[q.ans - 1].toString().trim();
        } else if (isWritten && wa) {
          blankAnswer = wa.trim();
        }
        if (blankAnswer) {
          const memorizeWords = [
            'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
            'january','february','march','april','may','june','july','august','september','october','november','december',
            'red','blue','green','yellow','black','white','orange','purple','pink','brown'
          ];
          const ansLower = blankAnswer.toLowerCase();
          if (/^\d+$/.test(blankAnswer)) {
            result.add('S-BLANK-MEMORIZATION', SEV.S, `Q${qid}: 빈칸 정답이 단순 암기형 (숫자: ${blankAnswer}) — 문맥 추론 가능한 단어만 출제`);
          } else if (/^[A-Z][a-z]*$/.test(blankAnswer) && !blankAnswer.includes(' ')) {
            result.add('S-BLANK-MEMORIZATION', SEV.S, `Q${qid}: 빈칸 정답이 단순 암기형 (고유명사 의심: ${blankAnswer}) — 문맥 추론 가능한 단어만 출제`);
          } else if (memorizeWords.includes(ansLower)) {
            result.add('S-BLANK-MEMORIZATION', SEV.S, `Q${qid}: 빈칸 정답이 단순 암기형 (${blankAnswer}) — 문맥 추론 가능한 단어만 출제`);
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // S-WORDORDER-RANGE: 어순배열 단어 수 범위 — derived from SCHEMA.questionTypes.어순배열.wordCount
    // ─────────────────────────────────────────────────────────────
    {
      const wordOrderSchema = SCHEMA.questionTypes['어순배열'];
      const woMin = (wordOrderSchema && wordOrderSchema.wordCount && wordOrderSchema.wordCount.min) || 8;
      const woMax = (wordOrderSchema && wordOrderSchema.wordCount && wordOrderSchema.wordCount.max) || 15;
      if (/어순배열/.test(typeNorm) && wa) {
        const wordCount = wa.trim().split(/\s+/).length;
        if (wordCount < woMin || wordCount > woMax) {
          result.add('S-WORDORDER-RANGE', SEV.S, `Q${qid}: 어순배열 wa가 ${wordCount}단어 — ${woMin}~${woMax}단어 범위 필수`);
        }
      }
    }

  });

  // ── A6: 정답 분포 — derived from SCHEMA.global.ansRules.maxSameAns ──
  const schemaMaxSameAns = SCHEMA.global.ansRules.maxSameAns;
  if (questions.length === schemaTotalQ) {
    const ansDist = {};
    questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number').forEach(q => {
      ansDist[q.ans] = (ansDist[q.ans] || 0) + 1;
    });
    Object.entries(ansDist).forEach(([ans, count]) => {
      if (count > schemaMaxSameAns) {
        result.add('A6', SEV.S, `정답 ${ans}번이 ${count}개 — ${schemaMaxSameAns + 1}개 이상 금지 (최대 ${schemaMaxSameAns}개)`);
      }
    });
  }

  // ── A7: 같은 정답 연속 금지 — derived from SCHEMA.global.ansRules.maxConsecutive ──
  const schemaMaxConsecutive = SCHEMA.global.ansRules.maxConsecutive;
  const mcQuestions = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
  for (let i = 0; i <= mcQuestions.length - (schemaMaxConsecutive + 1); i++) {
    let allSame = true;
    for (let j = 1; j <= schemaMaxConsecutive; j++) {
      if (mcQuestions[i].ans !== mcQuestions[i + j].ans) { allSame = false; break; }
    }
    if (allSame) {
      result.add('A7', SEV.S, `Q${mcQuestions[i].id}~Q${mcQuestions[i + schemaMaxConsecutive].id}: 정답 ${mcQuestions[i].ans}번 ${schemaMaxConsecutive + 1}연속 금지`);
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

  // ── F10-D: production NORM이 마침표 자동 제거 → 변형 강제 불필요 (2026-04-15 jacob 결정) ──

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

  // ── R51~R53: 모의고사 문항번호 적합성 — derived from SCHEMA.sourceTypes.모의고사 ──
  const mockSchema = SCHEMA.sourceTypes && SCHEMA.sourceTypes['모의고사'];
  const excludedNums = mockSchema && mockSchema.questionNumberTypeMap
    ? Object.entries(mockSchema.questionNumberTypeMap)
        .filter(([k, v]) => v.includes('제외'))
        .map(([k]) => parseInt(k))
    : [25, 27, 28]; // fallback
  const shortNums = (mockSchema && mockSchema.shortPassageRestrictions && mockSchema.shortPassageRestrictions.numbers || []).map(Number);
  const shortForbidden = (mockSchema && mockSchema.shortPassageRestrictions && mockSchema.shortPassageRestrictions.forbidden) || ['순서배열', '문장삽입', '어순배열'];

  if (ei.subject && ei.subject.includes('모의고사')) {
    const pubNum = parseInt(ei.pub);
    if (!isNaN(pubNum)) {
      // R51: excluded numbers
      if (excludedNums.includes(pubNum)) {
        result.add('R51', SEV.C, `문항번호 ${pubNum}번은 출제 제외 번호입니다`);
      }
      // R52: short passages shouldn't have forbidden types → S급 차단
      if (shortNums.includes(pubNum)) {
        questions.forEach(q => {
          if (shortForbidden.includes(q.type)) {
            result.add('R52', SEV.S, `Q${q.id}: 짧은 지문(${pubNum}번)에 ${q.type} 출제 — 금지 유형`);
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

  // ── TW: Type whitelist — derived from SCHEMA.testLayouts ──
  // Base types from schema slots
  const TYPE_WHITELIST_BASE = {};
  for (const [layoutName, layout] of Object.entries(SCHEMA.testLayouts)) {
    TYPE_WHITELIST_BASE[layoutName] = [...new Set(layout.slots.map(s => s.type))];
  }
  // Extend with known aliases/variants (schema has canonical names only; real data uses many aliases)
  const TYPE_ALIASES = {
    '단어': [
      '부적절한 어휘', '부적절어휘', '부적절',
      '다의어 / 문맥적 의미', '다의어·문맥적 의미', '다의어 / 영영풀이',
      '어형 변환 (서술형)',
      '한영', '내용이해',
      '어휘', '주제', '빈칸추론', '빈칸 추론'
    ],
    '워크북': [
      '내용이해', '내용일치', '내용불일치', '불일치', '내용 일치/불일치',
      'TF', 'TF 판별', 'T/F',
      '빈칸', '빈칸어휘', '빈칸(구)', '빈칸(문장)', '주제빈칸', '추론',
      '어법 빈칸', '어법빈칸', '어법 5지선다', '어법 밑줄형', '어법 빈칸형',
      '문장삽입', '순서배열', '순서', '글순서', '오류', '무관', '무관문장',
      '서술', '영작문 (서술형)', '서술형 — 핵심단어', '서술형 — 배열영작', '서술형 — 어형변환', '서술형 — 문장완성', '서술형 — 영작',
      '지칭추론', '지칭', '연결사',
      '주제', '주제/요지', '대의', '의미파악', '의미', '함축', '함축의미 추론', '요약', '요약문',
      '동의어 고르기', '반의어 고르기', '영영풀이 매칭',
      '다의어 문맥적 의미', '다의어 / 문맥적 의미',
      '문맥상 부적절한 어휘', '부적절어휘', '부적절',
      '(A)(B)(C) 조합형',
      '어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형',
      '어휘', '어순', '어순배열',
      '영한', '영→한', '영한해석', '한영영작', '한영', '한→영',
      '추론불가', '일치', '어휘 문맥', '종합',
      '글의 목적', '목적', '목적 추론',
      '빈칸 추론', '빈칸추론', '빈칸 문맥 완성', '빈칸 어휘 완성'
    ],
    '퀴즈': [
      '순서', '글순서', '순서배열', '문장삽입',
      '어법 빈칸', '어법 ⓐ~ⓔ', '어법 ⓐ~ⓓ', '어법 A/B/C', '어법 밑줄형', '어법 빈칸형', '어법빈칸', '어법 5지선다',
      '부적절어휘', '부적절',
      '어휘', '어휘 ①~⑤', '어휘 A/B/C',
      '빈칸', '빈칸(구)', '빈칸(문장)', '빈칸 추론', '빈칸추론', '빈칸 어휘 완성',
      '서술', '서술형요약', '서술형영작', '서술형어형', '서술형(요약)', '서술형(영작)', '서술형(어형)', '영작문 (서술형)', '서술형 — 핵심단어', '서술형 — 배열영작', '서술형 — 어형변환', '서술형 — 문장완성', '서술형 — 영작',
      '일치', '불일치', '내용이해', '내용일치', '내용불일치', '내용 일치/불일치',
      'TF', 'TF 판별', 'T/F', '내용이해 T/F',
      '어형 변환 (서술형)', '어형변화', '어형변형',
      '다의어 / 문맥적 의미',
      '주제/요지', '주제빈칸', '제목', '대의', '시사점', '무관문장', '무관', '함축', '요약', '요약문', '추론',
      '지칭', '지칭추론', '연결사', '무관한 문장 찾기',
      '한영', '한→영',
      '기타', '종합', '어휘 문맥',
      '글의 목적', '목적', '목적 추론'
    ]
  };
  const TYPE_WHITELIST = {};
  for (const [layout, baseTypes] of Object.entries(TYPE_WHITELIST_BASE)) {
    TYPE_WHITELIST[layout] = [...new Set([...baseTypes, ...(TYPE_ALIASES[layout] || [])])];
  }

  // 절대 금지 유형 (어떤 테스트에도 불가)
  // TODO: move banned types list to schema (e.g., SCHEMA.global.bannedTypes)
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── Q: 품질 게이트 — "학생이 풀 수 있는가" 검증 ──
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  for (const q of questions) {
    const { id: qid, type: qtype = '', fmt = '', passage = '', stem = '', ch = [], wa: _rawWa = '', det = {} } = q;
    const wa = (typeof _rawWa === 'string') ? _rawWa : String(_rawWa || '');
    const p = passage || '';

    // ── Q1: 어순배열 stem에 단어 수 조건 필수 ──
    if (/어순/.test(qtype) && fmt === 'written') {
      if (!/\d+단어/.test(stem) && !/단어로/.test(stem)) {
        // stem에 단어 수 힌트가 없으면 경고
        const waWords = (wa || '').split(/\s+/).length;
        if (waWords > 0 && !/\d/.test(stem)) {
          result.add('Q1-WORDCOUNT', SEV.S, `Q${qid}: 어순배열 stem에 단어 수 조건(${waWords}단어) 없음 — 학생이 정답 길이 모름`);
        }
      }
    }

    // ── Q2: 서술형 stem에 [조건] 또는 구체적 지시 필수 ──
    if (fmt === 'written' && !/어순/.test(qtype)) {
      const hasCondition = /조건|단어|괄호|찾아|빈칸|변형|바꿔|형태/.test(stem);
      if (!hasCondition) {
        result.add('Q2-NO-CONDITION', SEV.S, `Q${qid}: 서술형 stem에 조건/지시 없음 — 학생이 뭘 써야 하는지 모름`);
      }
    }

    // ── Q3: 빈칸형 정답이 fullPassage에 존재해야 함 ──
    // 빈칸 어휘 완성만 적용 (정답이 fullPassage에서 가려진 단어). 빈칸추론은 추론형이라 정답이 본문에 없을 수 있음
    if (/빈칸\s*어휘|빈칸\s*문맥/.test(qtype) && fmt === 'mc' && ch.length > 0 && q.ans >= 1 && q.ans <= ch.length) {
      const ansText = (ch[q.ans - 1] || '').trim();
      if (ansText && ansText.length >= 3 && fullPassage && !fullPassage.includes(ansText)) {
        result.add('Q3-ANS-NOT-IN-FP', SEV.S, `Q${qid}: 빈칸 정답 "${ansText}"이 fullPassage에 없음 — 지문과 무관한 정답`);
      }
    }

    // ── Q4: 영영풀이 대상 단어가 fullPassage에 존재해야 함 ──
    // 영영풀이 매칭은 정의(ch)가 아니라 대상 단어(stem의 <b>단어</b>)가 fullPassage에 있어야 함
    if (/영영풀이/.test(qtype) && fmt === 'mc' && fullPassage) {
      const stemText = String(q.stem || '');
      const boldMatch = stemText.match(/<b>(.*?)<\/b>/);
      const targetWord = boldMatch ? boldMatch[1].trim().toLowerCase() : '';
      if (targetWord && !fullPassage.toLowerCase().includes(targetWord)) {
        result.add('Q4-EIYOUNG-NOT-IN-FP', SEV.S, `Q${qid}: 영영풀이 대상 단어 "${targetWord}"이 fullPassage에 없음`);
      }
    }

    // ── Q5: 서술형 wa가 fullPassage에서 유도 가능해야 함 ──
    // 어순배열/순서배열/무관문장/문장삽입은 구조적 답변(번호/순서)이므로 제외
    const isStructuralAnswer = /어순|순서|무관|삽입/.test(qtype) || /^[A-Z]{2,4}$/.test((wa || '').trim()) || /^[1-5④⑤③②①]$/.test((wa || '').trim());
    if (fmt === 'written' && wa && typeof wa === 'string' && !isStructuralAnswer) {
      const waClean = wa.trim();
      // 어형변환은 변환형이 fullPassage에 없는 게 정상 (science→scientific)
      const isMorphChange = /어형\s*변환|어형변화|어형변형/.test(qtype);
      if (waClean.split(/\s+/).length === 1 && fullPassage && !isMorphChange) {
        // 단어 1개짜리: fullPassage에 있어야 함
        if (!fullPassage.includes(waClean) && !fullPassage.toLowerCase().includes(waClean.toLowerCase())) {
          result.add('Q5-WA-NOT-IN-FP', SEV.S, `Q${qid}: 서술형 wa "${waClean}"이 fullPassage에 없음 — 지문에서 유도 불가`);
        }
      }
    }

    // ── Q6: 빈칸형 오답 3개 이상이 fullPassage에 없으면 소거법으로 풀림 ──
    // 한국어 선지(빈칸추론 등)는 영어 fullPassage에 포함될 수 없으므로 제외
    if (/빈칸/.test(qtype) && fmt === 'mc' && ch.length >= 4 && q.ans >= 1 && fullPassage) {
      const hasKoreanChoice = ch.some(c => /[\uAC00-\uD7A3]/.test(c));
      if (!hasKoreanChoice) {
        const wrongNotInFp = ch.filter((c, i) => i !== q.ans - 1 && !fullPassage.includes(c.trim())).length;
        if (wrongNotInFp >= 3) {
          result.add('Q6-WEAK-DISTRACTOR', SEV.A, `Q${qid}: 오답 ${wrongNotInFp}개가 fullPassage에 없음 — 소거법으로 풀림`);
        }
      }
    }

    // ── Q7: det.analysis 비어있으면 해설 없음 ──
    if (det && (!det.analysis || det.analysis.length < 10)) {
      result.add('Q7-DET-EMPTY', SEV.A, `Q${qid}: det.analysis 비어있거나 너무 짧음 — 해설 부실`);
    }

    // ══════════════════════════════════════════════════════════════
    // 2026-04-13 신규 10종 — 파이프라인 전수 점검에서 발견된 결함
    // ══════════════════════════════════════════════════════════════

    // 찾기 유형은 wa가 passage에 보이는 게 정상 (유형 본질: 본문에서 찾기)
    // 대신 S-WRITTEN-NO-WORDCOUNT로 (N단어) 조건 누락을 잡음

    // S-WRITTEN-NO-WORDCOUNT: 서술형 stem에 (N단어) 조건 누락 → S급 차단
    // 1단어든 10단어든 학생이 답 길이를 모르면 풀 수 없음
    // 면제: 어형변환(원형 제시로 답이 명확), 영영풀이
    if (fmt === 'written' && wa) {
      const hasWC = /\d+\s*단어/.test(stem) || /한\s*단어/.test(stem) || /\d+\s*word/i.test(stem);
      const isEng = /영영|영영풀이/.test(qtype);
      const isMorph = /어형/.test(qtype);
      if (!hasWC && !isEng && !isMorph) {
        result.add('S-WRITTEN-NO-WORDCOUNT', SEV.S, `Q${qid}: 서술형 stem에 (N단어) 조건 없음 — 학생이 답 길이 모름 (wa: ${wa.trim().split(/\s+/).length}단어)`);
      }
    }

    // S-YJAKR-NO-BLANK: 조건영작 passage에 정답 부분 빈칸 없음
    if (fmt === 'written' && /조건영작/.test(qtype) && passage && passage.length > 50) {
      if (!passage.includes('____')) {
        result.add('S-YJAKR-NO-BLANK', SEV.S, `Q${qid}: 조건영작 passage에 빈칸(____) 없음 — 정답자리를 가려야 함`);
      }
    }

    // S-COND-EXTRA-WORD 삭제 (2026-04-13)
    // 조건영작 [조건] = wa 단어 전부 나열이 정상. "모두 사용" 규칙이므로 여분 단어 없어야 함
    // → S-COND-WORD-MATCH (wa→조건 방향)만 유지하면 충분

    // S-WORDCOUNT-MISMATCH-STRICT: stem "N단어" vs wa 실제 단어수 불일치
    // 기존 S-WORDCOUNT-MISMATCH 보완 — 모든 서술형에 적용
    if (fmt === 'written' && wa) {
      const wcMatch = stem.match(/(?:정확히\s*)?(\d+)\s*단어/);
      if (wcMatch) {
        const declared = parseInt(wcMatch[1]);
        const actual = wa.trim().split(/\s+/).length;
        if (declared !== actual) {
          result.add('S-WORDCOUNT-MISMATCH', SEV.S, `Q${qid}: stem "${declared}단어" vs wa 실제 ${actual}단어 — 학생이 맞춰도 틀림`);
        }
      }
    }

    // A-NO-RESPONSE-LANG: 서술형 stem에 "(영어로)" 응답언어 누락
    if (fmt === 'written') {
      const hasLang = /영어로|우리말로|한국어로|\(영어\)|\(한국어\)/.test(stem);
      if (!hasLang) {
        result.add('A-NO-RESPONSE-LANG', SEV.A, `Q${qid}: 서술형 stem에 응답 언어 명시 없음 — "(영어로)" 또는 "(우리말로)" 필요`);
      }
    }

    // A-MORPH-BASE-NOT-IN-FP: 어형변환 원형이 fullPassage에 없음
    // 밑줄(____) 패턴은 원형이 아니므로 제외, wa(변환 결과)가 FP에 있으면 OK
    if (/어형/.test(qtype) && passage) {
      const morphBase = passage.match(/\((\w{3,})\)/);
      if (morphBase && fullPassage) {
        const base = morphBase[1];
        const isUnderscore = /^_+$/.test(base);
        if (!isUnderscore && !fullPassage.toLowerCase().includes(base.toLowerCase())) {
          // 어형변환은 base→wa 변환이므로, wa가 FP에 있으면 정상
          const waInFp = wa && fullPassage.toLowerCase().includes(wa.trim().toLowerCase());
          if (!waInFp) {
            result.add('A-MORPH-BASE-NOT-IN-FP', SEV.A, `Q${qid}: 어형변환 원형 "(${base})"이 fullPassage에 없음`);
          }
        }
      }
    }

    // A-ACCEPT-MIN: 제거 (2026-04-15 jacob) — NORM 자동 정규화로 case/마침표/하이픈 변형 불필요. wa 1개로 충분

    // S-ORDER-MARKER-LEAK: 순서배열 (A)(B)(C) 마커가 비순서 유형 passage에 잔류
    if (passage && passage.length > 50) {
      const isOrderType = /순서|글순서|(A)(B)(C)|조합|다의어/.test(qtype);
      if (!isOrderType) {
        // plain (A) (B) 패턴 — <b> 없는 것만 (ABC 조합형의 <b>(A)</b>는 제외)
        const hasPlainABC = /(?<![<\w])\(A\)\s/.test(passage) && /(?<![<\w])\(B\)\s/.test(passage) && !/<b>\(A\)/.test(passage);
        if (hasPlainABC) {
          result.add('S-ORDER-MARKER-LEAK', SEV.A, `Q${qid}: 순서배열 (A)(B)(C) 마커가 비순서 유형에 잔류 — strip 필요`);
        }
      }
    }

    // A-EOSUN-NO-WORDS: 어순배열 stem에 셔플 단어 목록 없음
    if (/어순/.test(qtype) && fmt === 'written') {
      const hasWordList = /\[.*[a-zA-Z]+.*\/.*[a-zA-Z]+.*\]/.test(stem) || /[a-zA-Z]+,\s*[a-zA-Z]+,\s*[a-zA-Z]+/.test(stem) || /\[\s*단어\s*\]/.test(stem);
      if (!hasWordList) {
        result.add('A-EOSUN-NO-WORDS', SEV.A, `Q${qid}: 어순배열 stem에 셔플 단어 목록 없음 — 학생이 뭘 배열할지 모름`);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // S-BLIND-INCOMPLETE: blind.json 완전성 검증
  // 블라인드 풀이가 완료되지 않으면 배포 차단
  // ══════════════════════════════════════════════════════════════
  const blindPath = jsonPath.replace('.json', '.blind.json');
  if (fs.existsSync(blindPath)) {
    try {
      const blind = JSON.parse(fs.readFileSync(blindPath, 'utf8'));
      const solves = blind.solves || [];
      const needsAgent = solves.filter(s => s.needsAgent).length;
      const mismatched = solves.filter(s => s.match === false && !s.needsAgent).length;

      if (needsAgent > 0) {
        result.add('S-BLIND-INCOMPLETE', SEV.S, `블라인드 풀이 미완료: ${needsAgent}문항 에이전트 풀이 필요 — 20/20 완료 후 배포`);
      }
      if (mismatched > 0) {
        result.add('A-BLIND-MISMATCH', SEV.A, `블라인드 풀이 불일치: ${mismatched}문항 — 정답 확인 필요`);
      }
    } catch (e) {
      // blind.json 파싱 실패
    }
  } else {
    result.add('S-BLIND-MISSING', SEV.S, `blind.json 없음 — 블라인드 풀이 필수`);
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
      if (entry.name.startsWith('_')) continue;
      if (/\.(blind|blind-prompt|prompt|response)\.json$/.test(entry.name)) continue;
      results.push(full);
    }
  }
  return results;
}

// Export for use by build.js
module.exports = { validate };

if (require.main === module) main();
