#!/usr/bin/env node
/**
 * 내신해방공식 테스트 자동 생성기 v1.0
 *
 * 천재 개발자 접근: 1문항씩 생성 + 즉시 검증 + AI는 판단만 + 스크립트가 조립
 *
 * 사용법:
 *   node create-test.js --source 부교재 --path 수능특강Light/영어/16강/Gateway --type 단어
 *   node create-test.js --source 모의고사 --path 고1/3월_2026/18번 --type 워크북
 *   node create-test.js --source 교과서 --path 영어1/YBM박준언/1과/본문 --type 퀴즈
 *
 * 내부 동작:
 *   1. passage + 스키마 로드
 *   2. 20개 슬롯 순회: 각 슬롯마다 AI에게 최소한의 판단 요청
 *   3. 스크립트가 JSON 조립 + 즉시 validate
 *   4. 전체 검증 + blind-solve
 *   5. .json + .blind.json 출력
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'validate/question-schema.json'), 'utf8'));

// ── 스키마 questionTypes 퍼지 매칭: 슬롯 type명 → schema questionType 키 ──
function findQuestionType(typeName) {
  // 1. 정확 매칭
  if (SCHEMA.questionTypes[typeName]) return SCHEMA.questionTypes[typeName];
  // 2. typeAliases 테이블 매칭 (schema에 별칭 정의)
  const aliases = SCHEMA.typeAliases || {};
  if (aliases[typeName] && SCHEMA.questionTypes[aliases[typeName]]) {
    return SCHEMA.questionTypes[aliases[typeName]];
  }
  // 3. 부분 매칭: 슬롯 type에 포함된 키워드로 schema에서 찾기
  const keys = Object.keys(SCHEMA.questionTypes);
  for (const k of keys) {
    if (k.includes(typeName) || typeName.includes(k)) return SCHEMA.questionTypes[k];
  }
  // 4. 키워드 분할 매칭: "주제/요지" → "주제" 또는 "요지"
  const subKeys = typeName.split(/[/·\s]+/);
  for (const sub of subKeys) {
    if (sub.length < 2) continue;
    for (const k of keys) {
      if (k.includes(sub)) return SCHEMA.questionTypes[k];
    }
  }
  return {};
}

// ── CLI 파싱 ──
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return parsed;
}

// ── passage 로드 ──
function loadPassage(source, sourcePath) {
  const dataDir = path.join(ROOT, 'data');
  let passagePath;

  if (source === '부교재') {
    // 부교재: data/부교재/{path}/_passages/{section}.json
    const parts = sourcePath.split('/');
    const section = parts.pop(); // Gateway, 1번, 2번 등
    const dir = parts.join('/');
    passagePath = path.join(dataDir, '부교재', dir, '_passages', `${section}.json`);
  } else if (source === '모의고사') {
    passagePath = path.join(dataDir, '모의고사', sourcePath, '_passage.json');
  } else if (source === '교과서') {
    passagePath = path.join(dataDir, '교과서', sourcePath, '_passage.json');
  }

  if (!passagePath || !fs.existsSync(passagePath)) {
    // _passages 폴더에서 찾기
    const altParts = sourcePath.split('/');
    const section = altParts.pop();
    const dir = altParts.join('/');
    const altPath = path.join(dataDir, source, dir, '_passages', `${section}.json`);
    if (fs.existsSync(altPath)) {
      passagePath = altPath;
    } else {
      // 폴백: 기존 출제본(단어.json/워크북.json/퀴즈.json)에서 fullPassage 추출
      const testDir = path.join(dataDir, source === '교과서' ? '교과서' : source, sourcePath);
      for (const testFile of ['단어.json', '워크북.json', '퀴즈.json']) {
        const testPath = path.join(testDir, testFile);
        if (fs.existsSync(testPath)) {
          const testData = JSON.parse(fs.readFileSync(testPath, 'utf8'));
          if (testData.fullPassage) {
            console.log(`   ℹ️  passage를 기존 ${testFile}에서 로드`);
            return {
              fullPassage: testData.fullPassage,
              title: testData.ei?.title || testData.ei?.lesson || '',
              id: testData.ei?.section || section
            };
          }
        }
      }
      console.error(`❌ passage 파일 없음: ${passagePath || sourcePath}`);
      console.error(`   먼저 _passages/ 폴더에 passage JSON을 만들거나, 기존 출제본이 필요합니다.`);
      process.exit(1);
    }
  }

  return JSON.parse(fs.readFileSync(passagePath, 'utf8'));
}

// ── 스키마에서 슬롯 로드 ──
function getSlots(testType, source, sourcePath) {
  const layout = SCHEMA.testLayouts[testType];
  if (!layout) {
    console.error(`❌ 알 수 없는 테스트 타입: ${testType}`);
    process.exit(1);
  }

  const slots = [];
  for (const slot of layout.slots) {
    const [start, end] = slot.qRange;
    for (let i = start; i <= end; i++) {
      const idx = i - start;
      slots.push({
        id: i,
        type: slot.type,
        diff: slot.diffs[idx] || slot.diffs[slot.diffs.length - 1],
        pts: SCHEMA.global.diffDistribution[slot.diffs[idx] || slot.diffs[slot.diffs.length - 1]].pts,
        fmt: slot.fmt || 'mc',
        choiceCount: slot.choiceCount || SCHEMA.global.ansRules.choiceCount
      });
    }
  }

  // ── 모의고사 짧은 지문 번호별 금지 유형 자동 필터링 (SCHEMA에서 로드) ──
  if (source === '모의고사' && sourcePath) {
    const numMatch = sourcePath.match(/(\d+)번/);
    if (numMatch) {
      const qNum = parseInt(numMatch[1]);
      const shortRestrictions = SCHEMA.sourceTypes['모의고사']?.shortPassageRestrictions || {};
      const shortPassageNums = (shortRestrictions.numbers || []).map(n => parseInt(n));
      if (shortPassageNums.includes(qNum)) {
        const forbiddenTypes = [...(shortRestrictions.forbidden || []), '서술형 — 조건영작'];
        for (let i = 0; i < slots.length; i++) {
          if (forbiddenTypes.includes(slots[i].type)) {
            const oldType = slots[i].type;
            // 보통 난이도 → 빈칸추론, 그 외 → 내용 일치/불일치
            if (slots[i].diff === '보통') {
              slots[i].type = '빈칸추론';
              slots[i].fmt = 'mc';
              slots[i].choiceCount = SCHEMA.global.ansRules.choiceCount;
            } else {
              slots[i].type = '내용 일치/불일치';
              slots[i].fmt = 'mc';
              slots[i].choiceCount = SCHEMA.global.ansRules.choiceCount;
            }
            console.log(`   ⚠️ 짧은 지문(${qNum}번): ${oldType} → ${slots[i].type} 자동 교체`);
          }
        }
      }
    }
  }

  return slots;
}

// ── ei 메타데이터 생성 ──
function buildEi(source, sourcePath, testType, passageData) {
  const sourceConfig = SCHEMA.sourceTypes[source];
  const parts = sourcePath.split('/');
  const testTypeMap = { '단어': 'wordTest', '워크북': 'workbookTest', '퀴즈': 'quizTest' };
  // 생성/재출제 세대 마커. 기존 v5는 무접촉(재응시 방지), 이 파이프라인으로 새로 만드는 것만 v6.
  const HIST_VER = 'v6';

  let ei = {
    total: 100,
    time: 1200,
    totalQ: 20,
    title: passageData.title || ''
  };

  if (source === '부교재') {
    const [bookName, subject, lesson, section] = [parts[0], parts[1], parts[2], parts[3]];
    if (passageData.lesson) {
      // Pathways4 스타일: 메타데이터가 passage json에 존재 (2-part sourcePath)
      ei.subject = passageData.subject || bookName;
      ei.pub = passageData.pub || subject || '';
      ei.lesson = passageData.lesson;
      ei.section = passageData.section || section || '';
    } else {
      // 빠른독해/이투스/올림포스 스타일: sourcePath parts에서 추출
      ei.subject = bookName;
      ei.pub = subject;
      ei.lesson = lesson;
      ei.section = section;
    }
    const hkBook = (bookName || '').toString();
    const hkLesson = (ei.lesson || lesson || '').toString();
    const hkSection = (ei.section || section || '').toString();
    ei.histKey = `${testTypeMap[testType]}_${hkBook}_${hkLesson}_${hkSection}_${HIST_VER}`
      .replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  } else if (source === '모의고사') {
    const [grade, exam, num] = parts;
    ei.subject = `${exam} ${grade} 모의고사`;
    ei.pub = num;
    ei.lesson = passageData.title || num;
    ei.histKey = `${testTypeMap[testType]}_${grade}_${exam}_${num}_${HIST_VER}`
      .replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  } else if (source === '교과서') {
    ei.subject = parts[0];
    ei.pub = parts[1];
    ei.lesson = parts[2];
    ei.section = parts[3] || '본문';
    ei.histKey = `${testTypeMap[testType]}_${parts.join('_')}_${HIST_VER}`
      .replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  }

  return ei;
}

// ── (A)(B)(C) 괄호 순서 혼합패턴 (정답 앞배치 누출 방지) ──
// 정답이 전부-앞/전부-뒤가 되지 않도록 결정론적으로 섞는다. 위치 단서 제거.
function abcFlipPattern(n, seedStr) {
  if (n < 2) return [0];
  const pats = [];
  for (let m = 0; m < (1 << n); m++) {
    const bits = []; let ones = 0;
    for (let b = 0; b < n; b++) { const v = (m >> b) & 1; bits.push(v); ones += v; }
    if (ones !== 0 && ones !== n) pats.push(bits); // all-same 제외
  }
  let h = 0;
  for (const ch of seedStr) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
  return pats[h % pats.length];
}

// ── passage 오버레이 (스크립트가 처리) ──
function applyPassageOverlay(fullPassage, questionType, source, overlayData) {
  const sourceConfig = SCHEMA.sourceTypes[source];
  const typeConfig = findQuestionType(questionType);

  // typeConfig 없어도 overlay는 적용 (validate 허용 유형이 schema questionTypes보다 넓음)

  // 영영풀이: passage 없음
  if (questionType === '영영풀이 매칭') return '';

  // 어형변환: 2~4문장 발췌 (prompt 생성기는 '서술형 — 어형변환' 라벨을 emit하므로 alias 처리)
  if (questionType === '어형 변환' || questionType === '서술형 — 어형변환') {
    if (overlayData && overlayData.excerptSentences) {
      return overlayData.excerptSentences;
    }
    // 기본: 첫 3문장
    const sentences = fullPassage.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).join(' ');
  }

  // 영작 서술형: passage 필수 + 정답자리 빈칸 (overlay.blank로 처리됨 — 빈칸추론과 동일 로직)
  // 2026-04-13: "passage 없음" 규칙 폐기 → 모든 서술형에 passage 필수 (CLAUDE.md)

  // 1단계: fullPassage에 overlay 적용 (교과서 발췌 전에 먼저 적용해야 마커가 발췌본에 포함됨)
  let overlaid = fullPassage;

  // 문장삽입 이외 유형: fullPassage에 내재된 마커를 strip
  // (38번 등 문장삽입 원문 지문에서 동의어/반의어/빈칸 출제 시 S-MARKER-LEAK 방지)
  // (35번 등 무관한문장 원문 지문: ①문장 형태(괄호 없음)도 함께 제거)
  const insertionMarkerTypes = ['문장삽입', '문장 삽입'];
  if (!insertionMarkerTypes.some(t => questionType.includes(t))) {
    // 괄호형 ( ① ) 제거
    overlaid = overlaid.replace(/\s*\(\s*[①②③④⑤]\s*\)/g, '');
    // 괄호없는 ①②③④⑤ (무관한문장 등 원문 번호 마커)도 제거
    // 마커형 유형(부적절어휘/어법/오류찾기)은 overlay.markers로 재삽입하므로 먼저 제거해도 무방
    overlaid = overlaid.replace(/[①②③④⑤]/g, '');
  }

  if (overlayData) {
    if (overlayData.markers) {
      for (const [marker, val] of Object.entries(overlayData.markers)) {
        if (typeof val === 'object' && val.find && val.display) {
          overlaid = overlaid.replace(
            new RegExp(`\\b${escapeRegex(val.find)}\\b`, 'i'),
            `${marker}<u>${val.display}</u>`
          );
        } else {
          const word = typeof val === 'string' ? val : String(val);
          overlaid = overlaid.replace(
            new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'),
            `${marker}<u>${word}</u>`
          );
        }
      }
    }
    if (overlayData.blank) {
      overlaid = overlaid.replace(
        new RegExp(`\\b${escapeRegex(overlayData.blank)}\\b`, 'i'),
        '__________'
      );
    }
    if (overlayData.underline) {
      const underlines = Array.isArray(overlayData.underline) ? overlayData.underline : [overlayData.underline];
      for (const word of underlines) {
        const escaped = escapeRegex(word);
        // Try with word boundaries first, fall back to without (for parenthetical markers like "(a) him")
        const withBoundary = new RegExp(`\\b${escaped}\\b`, 'i');
        if (withBoundary.test(overlaid)) {
          overlaid = overlaid.replace(withBoundary, `<u>${word}</u>`);
        } else {
          overlaid = overlaid.replace(new RegExp(escaped, 'i'), `<u>${word}</u>`);
        }
      }
    }
    if (overlayData.abc) {
      const abcEntries = Object.entries(overlayData.abc);
      const flips = abcFlipPattern(abcEntries.length, overlaid);
      abcEntries.forEach(([label, [correct, wrong]], i) => {
        const [first, second] = flips[i] ? [wrong, correct] : [correct, wrong];
        overlaid = overlaid.replace(
          new RegExp(`\\b${escapeRegex(correct)}\\b`, 'i'),
          `<b>(${label})</b>[${first} / ${second}]`
        );
      });
    }
    if (overlayData.insertionMarkers) {
      const sentences = overlaid.match(/[^.!?]+[.!?]+/g) || [];
      const markers = ['(①)', '(②)', '(③)', '(④)'];
      const positions = overlayData.insertionMarkers;
      for (let i = positions.length - 1; i >= 0; i--) {
        const sentIdx = positions[i];
        if (sentIdx < sentences.length) {
          sentences[sentIdx] = sentences[sentIdx] + ` ${markers[i]}`;
        }
      }
      overlaid = sentences.join(' ');
    }
  }

  // 2단계: 교과서=발췌, 나머지=overlaid 그대로
  if (sourceConfig && sourceConfig.passageRule === 'excerpt') {
    const sentences = overlaid.match(/[^.!?]+[.!?]+/g) || [overlaid];
    let start, end;

    if (overlayData && overlayData.excerptRange) {
      [start, end] = overlayData.excerptRange;
    } else {
      start = 0;
      end = Math.min(8, sentences.length);
    }

    // 자동 확장: overlay 마커가 excerpt 밖에 있으면 범위를 넓힘
    const overlayIndicators = ['①', '②', '③', '④', '⑤', '<u>', '__________', '<b>(A)</b>', '<b>(B)</b>', '<b>(C)</b>'];
    let excerpt = sentences.slice(start, end).join(' ');
    const missingIndicators = overlayIndicators.filter(ind => overlaid.includes(ind) && !excerpt.includes(ind));

    if (missingIndicators.length > 0) {
      // 빠진 마커가 있는 문장을 찾아서 범위 확장
      for (let i = 0; i < sentences.length; i++) {
        if (i >= start && i < end) continue; // 이미 포함
        const hasMissing = missingIndicators.some(ind => sentences[i].includes(ind));
        if (hasMissing) {
          if (i < start) start = i;
          if (i >= end) end = i + 1;
        }
      }
      excerpt = sentences.slice(start, end).join(' ');
    }

    return excerpt.trim();
  }

  return overlaid;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── ans 분포 추적 ──
class AnsTracker {
  constructor() {
    const choiceCount = SCHEMA.global.ansRules.choiceCount;
    this.counts = {};
    for (let i = 1; i <= choiceCount; i++) this.counts[i] = 0;
    this.sequence = [];
    this.maxSameAns = SCHEMA.global.ansRules.maxSameAns;
    this.maxConsecutive = SCHEMA.global.ansRules.maxConsecutive;
  }

  canUse(ans) {
    if (this.counts[ans] >= this.maxSameAns) return false;
    // maxConsecutive+1 연속 금지
    const len = this.sequence.length;
    if (len >= this.maxConsecutive) {
      let allSame = true;
      for (let i = 1; i <= this.maxConsecutive; i++) {
        if (this.sequence[len - i] !== ans) { allSame = false; break; }
      }
      if (allSame) return false;
    }
    return true;
  }

  record(ans) {
    if (ans >= 1 && ans <= 4) {
      this.counts[ans]++;
      this.sequence.push(ans);
    }
  }

  suggestAns() {
    // 가장 적게 사용된 번호 반환
    const min = Math.min(...Object.values(this.counts));
    const candidates = Object.entries(this.counts)
      .filter(([k, v]) => v === min)
      .map(([k]) => parseInt(k));
    return candidates.filter(a => this.canUse(a));
  }

  getStats() {
    return { counts: { ...this.counts }, sequence: [...this.sequence] };
  }
}

// ── overlay 정규화: AI 응답의 다양한 형식을 통일 ──
function normalizeOverlay(overlay) {
  if (!overlay) return {};
  const norm = { ...overlay };

  // markers가 배열 형식이면 객체로 변환
  // [{ pos: 1, find: "word", display: "word" }] → { "①": "word" } or { "①": { find, display } }
  if (Array.isArray(norm.markers)) {
    const markerSymbols = ['①', '②', '③', '④', '⑤'];
    const converted = {};
    for (const item of norm.markers) {
      const sym = markerSymbols[(item.pos || item.idx || 1) - 1];
      if (sym) {
        if (item.find === item.display) {
          converted[sym] = item.display;
        } else {
          converted[sym] = { find: item.find, display: item.display };
        }
      }
    }
    norm.markers = converted;
  }

  return norm;
}

// ── JSON 뼈대 조립 ──
function assembleQuestion(slot, passageText, aiDecision) {
  // det 필드: 최상위 또는 det 객체 안에 있을 수 있음
  const det = aiDecision.det || {};
  const korean = aiDecision.korean || det.korean || '';
  const analysis = aiDecision.analysis || det.analysis || '';
  const tip = aiDecision.tip || det.tip || '';

  // 다의어 등 AI가 직접 passage를 제공한 경우 우선 사용
  const customPassageTypes = ['다의어 문맥적 의미', '다의어 / 문맥적 의미', '오류찾기'];
  const useCustomPassage = customPassageTypes.includes(slot.type) && aiDecision.passage;

  const q = {
    id: slot.id,
    type: slot.type,
    diff: slot.diff,
    pts: slot.pts,
    fmt: slot.fmt,
    passage: useCustomPassage ? aiDecision.passage : passageText,
    stem: aiDecision.stem,
    det: { korean, analysis, tip }
  };

  if (slot.fmt === 'mc') {
    q.ans = aiDecision.ans;
    q.ch = aiDecision.ch;
    // T/F 문항은 verdict 필드 필수 (validate-ans L1). ans=1→T, ans=2→F
    if (Array.isArray(q.ch) && q.ch.length === 2 &&
        q.ch.map(c => String(c).trim().toUpperCase()).join('') === 'TF') {
      q.verdict = aiDecision.verdict || (q.ans === 1 ? 'T' : 'F');
    }
  } else {
    q.wa = aiDecision.wa;
    q.accept = aiDecision.accept || [aiDecision.wa, aiDecision.wa.charAt(0).toUpperCase() + aiDecision.wa.slice(1), aiDecision.wa + '.'];
  }

  return q;
}

// ── 단일 문항 validate (경량) ──
function validateSingleQuestion(q, slot, fullPassage, source) {
  const errors = [];
  const typeConfig = findQuestionType(slot.type);

  // 1. passage 존재 확인 (영영풀이만 제외 — 조건영작도 passage 필수)
  if (slot.type !== '영영풀이 매칭') {
    if (!q.passage || q.passage.length < 30) {
      errors.push(`Q${q.id}: passage 없거나 너무 짧음 (${(q.passage || '').length}자)`);
    }
  }

  // 2. stem 존재
  if (!q.stem || q.stem.length < 5) {
    errors.push(`Q${q.id}: stem 없거나 너무 짧음`);
  }

  // 3. mc: ch 개수 + ans 범위
  if (slot.fmt === 'mc') {
    const expectedCh = slot.choiceCount || 4;
    if (!q.ch || q.ch.length !== expectedCh) {
      errors.push(`Q${q.id}: ch ${expectedCh}개 필요, ${(q.ch || []).length}개 있음`);
    }
    if (!q.ans || q.ans < 1 || q.ans > expectedCh) {
      errors.push(`Q${q.id}: ans=${q.ans} 범위 초과 (1~${expectedCh})`);
    }
  }

  // 4. written: wa 존재
  if (slot.fmt === 'written') {
    if (!q.wa || q.wa.length < 1) {
      errors.push(`Q${q.id}: wa(정답) 없음`);
    }
    // accept 변형 강제 제거 (2026-04-15 jacob): 채점이 NORM 자동 정규화 → wa 1개만 있어도 충분
  }

  // 5. det 필수 필드
  if (!q.det || !q.det.korean || !q.det.analysis || !q.det.tip) {
    errors.push(`Q${q.id}: det 필수 필드(korean/analysis/tip) 누락`);
  }

  // 6. S-META-LEAK: 메타텍스트 노출
  const metaPatterns = ['(원문에 없', '(보기)', '출제자', '정답:', '✅', '❌', '[3점]'];
  const passageStem = (q.passage || '') + (q.stem || '');
  for (const pat of metaPatterns) {
    if (passageStem.includes(pat) && !q.det?.analysis?.includes(pat)) {
      // det.analysis 안의 ✅❌는 OK
      if (pat === '✅' || pat === '❌') continue;
      errors.push(`Q${q.id}: S-META-LEAK — "${pat}" 노출`);
    }
  }

  // 7. S-PASSAGE-NOT-FULL: 부교재/모의고사 passage 85% 미만
  if ((source === '부교재' || source === '모의고사') && fullPassage) {
    const exemptTypes = ['영영풀이 매칭', '어형 변환', '서술형 — 어형변환', '서술형 — 조건영작', '다의어 문맥적 의미', '오류찾기'];
    if (!exemptTypes.includes(slot.type)) {
      const ratio = (q.passage || '').length / fullPassage.length;
      if (ratio < 0.85) {
        errors.push(`Q${q.id}: S-PASSAGE-NOT-FULL — passage가 fullPassage의 ${(ratio * 100).toFixed(0)}% (85% 미만)`);
      }
    }
  }

  // 8. S-LENGTH-BIAS: 정답 길이 2.5배 이상
  if (slot.fmt === 'mc' && q.ch && q.ans >= 1) {
    const ansLen = (q.ch[q.ans - 1] || '').length;
    const otherLens = q.ch.filter((_, i) => i !== q.ans - 1).map(c => c.length);
    const avgOther = otherLens.reduce((a, b) => a + b, 0) / otherLens.length;
    if (avgOther > 0 && ansLen / avgOther > 2.5) {
      errors.push(`Q${q.id}: S-LENGTH-BIAS — 정답 길이(${ansLen}) / 오답 평균(${avgOther.toFixed(0)}) = ${(ansLen / avgOther).toFixed(1)}배`);
    }
  }

  // 9. S-CH-TRUNCATED: 선지 잘림
  if (q.ch) {
    for (let i = 0; i < q.ch.length; i++) {
      const c = q.ch[i].trim();
      if (c.length > 3 && /^[a-zA-Z]/.test(c) && /[a-z]{1,3}$/i.test(c) && !c.endsWith('.') && !c.endsWith('?') && !c.endsWith('!') && c.length > 50) {
        // 50자 이상인데 구두점 없이 끝나는 건 의심
        errors.push(`Q${q.id}: S-CH-TRUNCATED 가능성 — ch[${i + 1}] "${c.slice(-20)}"`);
      }
    }
  }

  // 10. S-CIRCULAR-STEM: 서술형 wa가 stem에 그대로 노출
  if (slot.fmt === 'written' && q.wa && q.stem) {
    if (q.stem.toLowerCase().includes(q.wa.toLowerCase()) && !(q.stem.includes('찾아') || q.stem.includes('본문에서'))) {
      errors.push(`Q${q.id}: S-CIRCULAR-STEM — wa "${q.wa}"가 stem에 노출`);
    }
  }

  return errors;
}

// ── assemble 모드: .response.json → 최종 .json + validate + blind-solve ──
function assembleMode(responseFile) {
  const { execSync } = require('child_process');

  const responseFilePath = path.resolve(responseFile);
  if (!fs.existsSync(responseFilePath)) {
    console.error(`❌ 파일 없음: ${responseFile}`);
    process.exit(1);
  }

  const response = JSON.parse(fs.readFileSync(responseFilePath, 'utf8'));
  const { source, sourcePath, testType, decisions } = response;

  if (!source || !sourcePath || !testType || !decisions) {
    console.error(`❌ response.json 필수 필드 누락: source, sourcePath, testType, decisions`);
    process.exit(1);
  }

  console.log(`\n🔧 ASSEMBLE: ${source} / ${sourcePath} / ${testType}`);
  console.log(`   ${decisions.length}개 판단 수신\n`);

  // 1. passage + 슬롯 로드
  const passageData = loadPassage(source, sourcePath);
  const slots = getSlots(testType, source, sourcePath);
  const ei = buildEi(source, sourcePath, testType, passageData);
  const tracker = new AnsTracker();

  if (decisions.length !== slots.length) {
    console.error(`❌ 슬롯 ${slots.length}개 vs 판단 ${decisions.length}개 불일치`);
    process.exit(1);
  }

  // 2. 1문항씩 조립 + 즉시 검증
  const questions = [];
  const allErrors = [];
  let failCount = 0;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const decision = decisions[i];

    if (!decision || decision.id !== slot.id) {
      console.error(`❌ Q${slot.id}: decision.id(${decision?.id}) !== slot.id(${slot.id})`);
      process.exit(1);
    }

    // overlay 정규화 + decision 최상위 필드 병합 (excerptRange, passage 등)
    const overlay = normalizeOverlay(decision.overlay || {});
    // excerptRange가 overlay 밖(decision 최상위)에 있을 수 있음
    if (decision.excerptRange && !overlay.excerptRange) {
      overlay.excerptRange = decision.excerptRange;
    }
    // excerptSentences도 동일
    if (decision.excerptSentences && !overlay.excerptSentences) {
      overlay.excerptSentences = decision.excerptSentences;
    }
    const passageText = applyPassageOverlay(
      passageData.fullPassage,
      slot.type,
      source,
      overlay
    );

    // JSON 조립
    const q = assembleQuestion(slot, passageText, decision);

    // overlay 적용 결과 검증: 마커/빈칸/밑줄이 실제로 passage에 들어갔는지
    if (overlay.markers && Object.keys(overlay.markers).length > 0) {
      const missingMarkers = Object.keys(overlay.markers).filter(m => !passageText.includes(m));
      if (missingMarkers.length > 0) {
        console.log(`   ⚠️  Q${q.id}: overlay 마커 ${missingMarkers.join(',')} 미적용 — 해당 단어가 passage에 없음`);
      }
    }
    if (overlay.blank && !passageText.includes('__________')) {
      console.log(`   ⚠️  Q${q.id}: overlay.blank "${overlay.blank}" 미적용 — 단어가 passage에 없음`);
    }
    if (overlay.underline && !passageText.includes('<u>')) {
      console.log(`   ⚠️  Q${q.id}: overlay.underline 미적용 — 단어가 passage에 없음`);
    }

    // ans 분포 추적
    if (slot.fmt === 'mc' && q.ans) {
      if (!tracker.canUse(q.ans)) {
        // ans 분포 위반 — 경고만 (AI 판단 존중)
        console.log(`   ⚠️  Q${q.id}: ans=${q.ans} 분포 위반 (${JSON.stringify(tracker.counts)})`);
      }
      tracker.record(q.ans);
    }

    // 즉시 검증
    const errors = validateSingleQuestion(q, slot, passageData.fullPassage, source);
    if (errors.length > 0) {
      failCount++;
      allErrors.push(...errors);
      console.log(`   ❌ Q${q.id} [${slot.type}] — ${errors.length}건`);
      errors.forEach(e => console.log(`      ${e}`));
    } else {
      console.log(`   ✅ Q${q.id} [${slot.type}] ${slot.diff} ${slot.pts}점`);
    }

    questions.push(q);
  }

  // 3. ans 분포 최종 확인
  const stats = tracker.getStats();
  console.log(`\n── ans 분포: ${JSON.stringify(stats.counts)} ──`);
  const maxCount = Math.max(...Object.values(stats.counts));
  if (maxCount > 5) {
    console.log(`   ⚠️  최대 ${maxCount}개 — A6 위반 가능`);
  }

  // 4. 최종 JSON 조립
  const outputData = {
    version: 5,
    testType,
    ei,
    fullPassage: passageData.fullPassage,
    questions
  };

  // 5. 출력 경로
  const outputDir = path.join(ROOT, 'data', source === '교과서' ? '교과서' : source, sourcePath);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${testType}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');

  const relOutput = path.relative(ROOT, outputFile);
  console.log(`\n📄 JSON 출력: ${relOutput}`);

  if (failCount > 0) {
    console.log(`\n⚠️  ${failCount}문항 경량검증 실패 — validate에서 최종 확인`);
  }

  // 6. validate 실행
  console.log(`\n── validate 실행 ──`);
  try {
    const validateResult = execSync(
      `node validate/validate.js "${outputFile}"`,
      { cwd: ROOT, encoding: 'utf8', timeout: 30000 }
    );
    console.log(validateResult);
  } catch (e) {
    console.log(e.stdout || '');
    console.error(e.stderr || '');
    console.error(`\n❌ validate 실패. 수정 후 재실행 필요.`);
    console.log(`   수정 후: node create-test.js --assemble ${responseFile}`);
    // validate 실패해도 blind-solve는 건너뜀
    process.exit(1);
  }

  // 7. blind-solve 실행
  console.log(`\n── blind-solve 실행 ──`);
  try {
    const blindResult = execSync(
      `node validate/run-blind-solve.js "${outputFile}"`,
      { cwd: ROOT, encoding: 'utf8', timeout: 60000 }
    );
    console.log(blindResult);
  } catch (e) {
    console.log(e.stdout || '');
    console.error(e.stderr || '');
    console.error(`\n⚠️  blind-solve 일부 실패 — 에이전트 풀이 필요한 문항 있을 수 있음`);
  }

  // 8. 최종 보고 + 블라인드 완전성 체크
  const blindFile = outputFile.replace('.json', '.blind.json');
  const hasBlind = fs.existsSync(blindFile);
  let needsAgentCount = 0;
  let blindMismatch = 0;

  if (hasBlind) {
    try {
      const blindData = JSON.parse(fs.readFileSync(blindFile, 'utf8'));
      const solves = blindData.solves || [];
      needsAgentCount = solves.filter(s => s.needsAgent).length;
      blindMismatch = solves.filter(s => s.match === false && !s.needsAgent).length;
    } catch (e) { /* ignore */ }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`  ASSEMBLE 완료: ${relOutput}`);
  console.log(`  문항: ${questions.length}개`);
  console.log(`  총점: ${questions.reduce((s, q) => s + q.pts, 0)}점`);
  console.log(`  ans분포: ${JSON.stringify(stats.counts)}`);
  console.log(`  blind.json: ${hasBlind ? '✅ 생성됨' : '❌ 미생성'}`);
  if (needsAgentCount > 0) {
    console.log(`  ⛔ 에이전트 풀이 필요: ${needsAgentCount}문항`);
  }
  if (blindMismatch > 0) {
    console.log(`  ⚠️  불일치: ${blindMismatch}문항 — 정답 확인 필요`);
  }
  console.log(`══════════════════════════════════════`);

  if (needsAgentCount > 0) {
    console.log(`\n⛔ 블라인드 풀이 미완료! 다음 단계 필수:`);
    console.log(`  1. ${relOutput}의 ${needsAgentCount}문항을 정답 보지 않고 직접 풀기`);
    console.log(`  2. .blind.json의 needsAgent 문항에 myAnswer + reasoning 채우기`);
    console.log(`  3. 정답 대조 → 불일치 시 문항 수정`);
    console.log(`  ⛔ 이 작업 없이 커밋하면 validate S-BLIND-INCOMPLETE로 차단됩니다.`);
  }

  if (!hasBlind) {
    console.log(`\n⚠️  blind.json 미생성 — 에이전트 블라인드 풀이 필요:`);
    console.log(`   node validate/blind-solve.js "${outputFile}"`);
  }

  // ── 다음 단계 안내 (SOP 이행 체크리스트) ──
  const cbFile = outputFile.replace(/\.json$/, '.cross-blind.json');
  const advFile = outputFile.replace(/\.json$/, '.adversarial.json');
  const gangDir = path.dirname(path.dirname(outputFile));
  const reportFile = path.join(gangDir, '_audit-report.md');
  const hasCross = fs.existsSync(cbFile);
  const hasAdv = fs.existsSync(advFile);
  const hasReport = fs.existsSync(reportFile);

  console.log(`\n── SOP 이행 체크리스트 ──`);
  console.log(`  [${hasBlind ? '✅' : '❌'}] STEP 3 자체 블라인드 (.blind.json)`);
  console.log(`  [${hasCross ? '✅' : '❌'}] Tier 2 Cross-blind (.cross-blind.json) — 반대 모델 풀이`);
  console.log(`  [${hasAdv ? '✅' : '❌'}] STEP 5 적대적 공격 (.adversarial.json)`);
  console.log(`  [${hasReport ? '✅' : '❌'}] STEP 7 증적 리포트 (${path.relative(ROOT, reportFile)})`);

  const missing = [];
  if (!hasCross) missing.push(`node cross-blind.js --prep "${outputFile}" → 반대모델이 .cross-blind.json 작성 → node cross-blind.js --verify "${outputFile}"`);
  if (!hasAdv) missing.push(`다른 Agent에게 prompts/agent_adversarial.md 템플릿 전달 → .adversarial.json 작성`);
  if (!hasReport) missing.push(`지문 폴더에 _audit-report.md 작성 (배포 시 필수)`);
  if (missing.length) {
    console.log(`\n⛔ 다음 단계 필수 (미완료 시 deploy-json.js --strict-gate 차단):`);
    missing.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
  } else {
    console.log(`\n✅ 모든 SOP 단계 이행 완료 — 배포 가능 상태`);
  }

  return { outputFile, relOutput, hasBlind, hasCross, hasAdv, hasReport, failCount };
}

// ── --status 모드: test.json의 SOP 단계별 이행 여부 리포트 ──
function statusMode(testPath) {
  const abs = path.isAbsolute(testPath) ? testPath : path.join(ROOT, testPath);
  if (!fs.existsSync(abs) || !abs.endsWith('.json')) {
    console.error(`❌ 파일 없음: ${testPath}`);
    process.exit(1);
  }
  const responseFile = abs.replace(/\.json$/, '.response.json');
  const blindFile = abs.replace(/\.json$/, '.blind.json');
  const cbFile = abs.replace(/\.json$/, '.cross-blind.json');
  const advFile = abs.replace(/\.json$/, '.adversarial.json');
  const gangDir = path.dirname(path.dirname(abs));
  const reportFile = path.join(gangDir, '_audit-report.md');

  const check = (p) => fs.existsSync(p) ? '✅' : '❌';
  console.log(`\n── SOP 상태: ${path.relative(ROOT, abs)} ──`);
  console.log(`  ${check(responseFile)} STEP 1 response.json (Agent 출제)`);
  console.log(`  ${check(abs)} STEP 2 ${path.basename(abs)} (assemble+validate)`);
  console.log(`  ${check(blindFile)} STEP 3 blind.json (자체 블라인드)`);
  console.log(`  ${check(cbFile)} Tier 2 cross-blind.json (반대모델)`);
  console.log(`  ${check(advFile)} STEP 5 adversarial.json (공격 검수)`);
  console.log(`  ${check(reportFile)} STEP 7 _audit-report.md (증적)`);

  // adversarial HIGH 이슈 검사
  if (fs.existsSync(advFile)) {
    try {
      const adv = JSON.parse(fs.readFileSync(advFile, 'utf8'));
      const highs = (adv.issues || []).filter(i => (i.severity || '').toLowerCase() === 'high');
      if (highs.length) {
        console.log(`\n⛔ adversarial HIGH ${highs.length}건 미해결: ${highs.map(h => `Q${h.id}(${h.category})`).join(', ')}`);
      }
    } catch (e) { /* ignore */ }
  }
  console.log('');
}

// ── 메인 ──
function main() {
  const args = parseArgs();

  // --assemble 모드
  if (args.assemble) {
    assembleMode(args.assemble);
    return;
  }

  // --status 모드: SOP 이행 상태 확인
  if (args.status) {
    statusMode(args.status);
    return;
  }

  if (!args.source || !args.path || !args.type) {
    console.log(`
내신해방공식 테스트 자동 생성기 v1.0

사용법:
  프롬프트 생성:
    node create-test.js --source <교과서|부교재|모의고사> --path <경로> --type <단어|워크북|퀴즈>

  JSON 조립 (AI 응답 후):
    node create-test.js --assemble <response.json 경로>

예시:
  node create-test.js --source 부교재 --path 수능특강Light/영어/16강/Gateway --type 단어
  node create-test.js --assemble data/부교재/수능특강Light/영어/16강/Gateway/단어.response.json

스키마: validate/question-schema.json
`);
    process.exit(0);
  }

  const { source, path: sourcePath, type: testType } = args;

  // 1. passage 로드
  console.log(`\n📝 ${source} / ${sourcePath} / ${testType}`);
  const passageData = loadPassage(source, sourcePath);
  console.log(`   fullPassage: ${passageData.fullPassage.length}자, "${passageData.title}"`);

  // 2. 슬롯 로드
  const slots = getSlots(testType, source, sourcePath);
  console.log(`   슬롯: ${slots.length}개`);

  // 3. ei 생성
  const ei = buildEi(source, sourcePath, testType, passageData);

  // 4. ans 추적기
  const tracker = new AnsTracker();

  // 5. 각 슬롯 정보 출력 (AI에게 전달할 프롬프트 생성)
  console.log(`\n── 슬롯 목록 (AI에게 전달) ──`);

  const aiPromptSlots = slots.map(slot => {
    const typeConfig = findQuestionType(slot.type);
    const suggested = tracker.suggestAns();

    return {
      id: slot.id,
      type: slot.type,
      diff: slot.diff,
      pts: slot.pts,
      fmt: slot.fmt,
      overlay: typeConfig.overlayRequired || typeConfig.overlayNote || '',
      suggestedAns: suggested,
      choiceCount: slot.choiceCount
    };
  });

  // 프롬프트 파일 생성
  const outputDir = path.join(ROOT, 'data', source, sourcePath);
  fs.mkdirSync(outputDir, { recursive: true });

  // 유형별 규칙 — 사용되는 유형만, 1번만
  const typeRules = {};
  const usedTypes = [...new Set(aiPromptSlots.map(s => s.type))];
  for (const t of usedTypes) {
    const tc = findQuestionType(t);
    typeRules[t] = {
      fmt: tc.fmt || 'mc',
      stem: tc.stem || '',
      overlay: tc.overlayRequired || tc.overlayNote || '',
      passageRule: tc.passageRule?.[source] || tc.passageRule || 'fullPassage',
      answerRule: tc.answerRule || '',
      ch: tc.ch || (tc.fmt === 'written' ? undefined : '4개')
    };
  }

  const promptFile = path.join(outputDir, `${testType}.prompt.json`);
  const promptData = {
    _: [
      "각 슬롯 판단만. passage 복붙 금지(스크립트가 overlay로 생성). 다의어만 passage 직접 작성.",
      "overlay 단어=fullPassage에 존재. 서술형: stem에 (N단어)+(영어로)+accept 3개+.",
      `ans: ${SCHEMA.global.ansRules.indexed}, 최대${SCHEMA.global.ansRules.maxSameAns}개, ${SCHEMA.global.ansRules.maxConsecutive + 1}연속금지`,
      "mc: {id,stem,ch,ans,overlay,korean,analysis,tip} / written: {id,stem,wa,accept,overlay,korean,analysis,tip}"
    ],
    source,
    sourcePath,
    testType,
    fullPassage: passageData.fullPassage,
    title: passageData.title,
    ...(source === '교과서' ? {
      sentenceIndex: (() => {
        const sentences = passageData.fullPassage.match(/[^.!?]+[.!?]+/g) || [];
        return sentences.map((s, i) => ({
          idx: i,
          preview: s.trim().substring(0, 80) + (s.trim().length > 80 ? '...' : '')
        }));
      })()
    } : {}),
    typeRules,
    slots: aiPromptSlots
  };

  fs.writeFileSync(promptFile, JSON.stringify(promptData, null, 2), 'utf8');

  console.log(`\n✅ 프롬프트 생성: ${path.relative(ROOT, promptFile)}`);
  console.log(`\n다음 단계:`);
  console.log(`  1. AI 에이전트에게 ${path.relative(ROOT, promptFile)} 전달`);
  console.log(`  2. AI가 각 슬롯의 판단을 .response.json으로 저장`);
  console.log(`  3. node create-test.js --assemble ${path.relative(ROOT, promptFile).replace('.prompt.json', '.response.json')}`);
  console.log(`     → 스크립트가 JSON 조립 + validate + blind-solve 자동 실행`);

  // 요약
  const diffCounts = {};
  slots.forEach(s => { diffCounts[s.diff] = (diffCounts[s.diff] || 0) + 1; });
  const score = Object.entries(diffCounts).reduce((sum, [d, c]) => sum + c * SCHEMA.global.diffDistribution[d].pts, 0);
  console.log(`\n── 배점 검증 ──`);
  console.log(`   쉬움${diffCounts['쉬움']}×4=${diffCounts['쉬움']*4} + 보통${diffCounts['보통']}×5=${diffCounts['보통']*5} + 어려움${diffCounts['어려움']}×6=${diffCounts['어려움']*6} = ${score}점`);

  if (score !== 100) {
    console.error(`   ❌ 배점 합계 ${score} ≠ 100!`);
  }
}

main();
