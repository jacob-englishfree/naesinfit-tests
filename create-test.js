#!/usr/bin/env node
/**
 * 내신핏 테스트 자동 생성기 v1.0
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

  let ei = {
    total: 100,
    time: 1200,
    totalQ: 20,
    title: passageData.title || ''
  };

  if (source === '부교재') {
    const [bookName, subject, lesson, section] = [parts[0], parts[1], parts[2], parts[3]];
    ei.subject = bookName;
    ei.pub = subject;
    ei.lesson = lesson;
    ei.section = section;
    ei.histKey = `${testTypeMap[testType]}_${bookName}_${lesson}_${section}_v3`
      .replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  } else if (source === '모의고사') {
    const [grade, exam, num] = parts;
    ei.subject = `${exam} ${grade} 모의고사`;
    ei.pub = num;
    ei.lesson = passageData.title || num;
    ei.histKey = `${testTypeMap[testType]}_${grade}_${exam}_${num}_v3`
      .replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  } else if (source === '교과서') {
    ei.subject = parts[0];
    ei.pub = parts[1];
    ei.lesson = parts[2];
    ei.section = parts[3] || '본문';
    ei.histKey = `${testTypeMap[testType]}_${parts.join('_')}_v3`
      .replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  }

  return ei;
}

// ── passage 오버레이 (스크립트가 처리) ──
function applyPassageOverlay(fullPassage, questionType, source, overlayData) {
  const sourceConfig = SCHEMA.sourceTypes[source];
  const typeConfig = findQuestionType(questionType);

  // typeConfig 없어도 overlay는 적용 (validate 허용 유형이 schema questionTypes보다 넓음)

  // 영영풀이: passage 없음
  if (questionType === '영영풀이 매칭') return '';

  // 어형변환: 2~4문장 발췌
  if (questionType === '어형 변환') {
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
        overlaid = overlaid.replace(
          new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'),
          `<u>${word}</u>`
        );
      }
    }
    if (overlayData.abc) {
      for (const [label, [correct, wrong]] of Object.entries(overlayData.abc)) {
        overlaid = overlaid.replace(
          new RegExp(`\\b${escapeRegex(correct)}\\b`, 'i'),
          `<b>(${label})</b>[${correct} / ${wrong}]`
        );
      }
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
  const customPassageTypes = ['다의어 문맥적 의미', '다의어 / 문맥적 의미'];
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
    if (!q.accept || q.accept.length < 3) {
      errors.push(`Q${q.id}: accept 변형 3개 이상 필요 (${(q.accept || []).length}개)`);
    }
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
    const exemptTypes = ['영영풀이 매칭', '어형 변환', '서술형 — 조건영작', '다의어 문맥적 의미'];
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
    version: 3,
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

  // 8. 최종 보고
  const blindFile = outputFile.replace('.json', '.blind.json');
  const hasBlind = fs.existsSync(blindFile);

  console.log(`\n══════════════════════════════════════`);
  console.log(`  ASSEMBLE 완료: ${relOutput}`);
  console.log(`  문항: ${questions.length}개`);
  console.log(`  총점: ${questions.reduce((s, q) => s + q.pts, 0)}점`);
  console.log(`  ans분포: ${JSON.stringify(stats.counts)}`);
  console.log(`  blind.json: ${hasBlind ? '✅ 생성됨' : '❌ 미생성'}`);
  console.log(`══════════════════════════════════════`);

  if (!hasBlind) {
    console.log(`\n⚠️  blind.json 미생성 — 에이전트 블라인드 풀이 필요:`);
    console.log(`   node validate/blind-solve.js "${outputFile}"`);
  }

  return { outputFile, relOutput, hasBlind, failCount };
}

// ── 메인 ──
function main() {
  const args = parseArgs();

  // --assemble 모드
  if (args.assemble) {
    assembleMode(args.assemble);
    return;
  }

  if (!args.source || !args.path || !args.type) {
    console.log(`
내신핏 테스트 자동 생성기 v1.0

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
      passageRule: typeConfig.passageRule?.[source] || typeConfig.passageRule || 'fullPassage',
      stem: typeConfig.stem || '',
      answerRule: typeConfig.answerRule || '',
      distractorRule: typeConfig.distractorRule || '',
      suggestedAns: suggested,
      choiceCount: slot.choiceCount
    };
  });

  // 프롬프트 파일 생성
  const outputDir = path.join(ROOT, 'data', source, sourcePath);
  fs.mkdirSync(outputDir, { recursive: true });

  // ── 유형별 overlay 필수 규칙 생성 (SCHEMA.questionTypes에서 로드, 퍼지 매칭) ──
  const overlayRules = {};
  const usedTypes = [...new Set(aiPromptSlots.map(s => s.type))];
  for (const t of usedTypes) {
    const tc = findQuestionType(t);
    if (tc.overlayRequired || tc.overlayNote) {
      overlayRules[t] = {
        required: tc.overlayRequired || '',
        note: tc.overlayNote || ''
      };
    } else {
      // SCHEMA-TODO: 이 유형의 overlay 규칙을 question-schema.json에 추가
      overlayRules[t] = {
        required: 'overlay = {}',
        note: `(${t} — schema에 overlayRequired 미정의)`
      };
    }
  }

  const promptFile = path.join(outputDir, `${testType}.prompt.json`);
  const promptData = {
    _instruction: [
      "AI에게 전달: 각 슬롯의 판단만 채워주세요. JSON 구조/passage 복붙은 스크립트가 합니다.",
      "⛔ passage를 직접 작성하지 마세요 — 스크립트가 overlay 기반으로 fullPassage에서 자동 생성합니다.",
      "⛔ 다의어 문맥적 의미만 예외: 이 유형은 decision에 passage 필드를 직접 넣으세요.",
      "⛔ 모든 overlay 단어는 반드시 fullPassage에 존재해야 합니다 (find 키의 단어)."
    ],
    _responseInstruction: "응답 파일명: 같은 경로에 .response.json으로 저장 → node create-test.js --assemble <경로>",
    source,
    sourcePath,
    testType,
    passageRule: SCHEMA.sourceTypes[source]?.passageRule === 'excerpt'
      ? `excerpt (${SCHEMA.sourceTypes[source]?.passageLength || '5~10문장 발췌'}) — overlay 단어는 excerptRange 안 문장에서만 선택!`
      : `fullPassage 통째 + overlay만 (${SCHEMA.sourceTypes[source]?.passageLength || ''})`,
    fullPassage: passageData.fullPassage,
    title: passageData.title,
    // 교과서: 문장 인덱스 목록 제공 (AI가 excerptRange 결정에 활용)
    ...(source === '교과서' ? {
      sentenceIndex: (() => {
        const sentences = passageData.fullPassage.match(/[^.!?]+[.!?]+/g) || [];
        return sentences.map((s, i) => ({
          idx: i,
          preview: s.trim().substring(0, 80) + (s.trim().length > 80 ? '...' : '')
        }));
      })(),
      _excerptGuide: [
        "⛔ excerptRange = [시작인덱스, 끝인덱스] (0-based, 끝 미포함)",
        "⛔ overlay의 모든 단어(markers, blank, underline)는 반드시 excerptRange 안의 문장에 존재해야 함",
        "⛔ 한 문항의 마커 4개가 모두 같은 excerptRange 안에 있어야 함",
        "⛔ excerptRange는 5~10문장 (너무 짧거나 길면 안 됨)",
        "예: excerptRange: [12, 19] → sentenceIndex[12]~[18]의 문장만 사용"
      ]
    } : {}),
    ei,
    slots: aiPromptSlots,
    overlayRules,
    validateRules: (() => {
      // SCHEMA.validateRules에서 S급/A급 규칙 로드
      const rules = {
        _description: "아래 규칙 위반 시 validate가 즉시 차단합니다. 반드시 준수하세요."
      };
      // S급 규칙 추가
      if (SCHEMA.validateRules && SCHEMA.validateRules['S급 (즉시 차단)']) {
        for (const rule of SCHEMA.validateRules['S급 (즉시 차단)']) {
          const colonIdx = rule.indexOf(':');
          if (colonIdx > 0) {
            const code = rule.substring(0, colonIdx).trim();
            const desc = rule.substring(colonIdx + 1).trim();
            rules[code] = desc;
          }
        }
      }
      // 스크립트 고유 규칙 (schema에 없는 overlay 관련)
      rules['S-MARKER-MUST-EXIST'] = rules['S-MARKER-MUST-EXIST'] || '마커형(어법/부적절/오류찾기) → overlay.markers에 ①②③④ 4개 필수';
      rules['S-BLANK-MUST-EXIST'] = rules['S-BLANK-MUST-EXIST'] || '빈칸형(빈칸추론/빈칸어휘) → overlay.blank 필수';
      rules['S-UNDERLINE-MUST-EXIST'] = rules['S-UNDERLINE-MUST-EXIST'] || '밑줄형(동의어/반의어/함축/지칭) → overlay.underline 필수';
      rules['ACCEPT-MIN-3'] = '서술형 accept 변형 3개 이상 필수 (대소문자, 마침표 등)';
      rules['ANS-RULES'] = `ans는 ${SCHEMA.global.ansRules.indexed}. 같은 번호 최대 ${SCHEMA.global.ansRules.maxSameAns}개. ${SCHEMA.global.ansRules.maxConsecutive + 1}연속 금지.`;
      rules['WORDCOUNT'] = '어순배열/영작 stem에 반드시 (N단어) 조건 포함';
      // A급 규칙
      const aGrade = {};
      if (SCHEMA.validateRules && SCHEMA.validateRules['A급 (재출제 권장)']) {
        for (const rule of SCHEMA.validateRules['A급 (재출제 권장)']) {
          const colonIdx = rule.indexOf(':');
          if (colonIdx > 0) {
            const code = rule.substring(0, colonIdx).trim();
            const desc = rule.substring(colonIdx + 1).trim();
            aGrade[code] = desc;
          }
        }
      }
      rules['_A급 (재출제 권고 — 이것도 지켜야 PASS)'] = aGrade;
      return rules;
    })(),
    responseFormat: {
      _description: "response.json 구조 — decisions 배열에 20개 판단",
      _structure: { source, sourcePath, testType, decisions: "[...20개]" },
      mc_example: {
        id: 1,
        stem: "다음 글의 (A), (B), (C)에 들어갈 말로 가장 적절한 것끼리 짝지은 것은?",
        ch: ["w1 — w2 — w3", "w4 — w2 — w3", "w1 — w5 — w3", "w1 — w2 — w6"],
        ans: 1,
        overlay: { abc: { A: ["correct", "wrong"], B: ["correct", "wrong"], C: ["correct", "wrong"] } },
        korean: "한국어 해석 (5자 이상)",
        analysis: "✅ ① 정답근거\n❌ ② 오답이유\n❌ ③ 오답이유\n❌ ④ 오답이유",
        tip: "학습 팁"
      },
      marker_example: {
        _comment: "어법/부적절/오류찾기 — ch는 반드시 ['①','②','③','④']",
        id: 4,
        stem: "다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?",
        ch: ["①", "②", "③", "④"],
        ans: 3,
        overlay: { markers: { "①": "original_word1", "②": "original_word2", "③": { find: "original_word3", display: "wrong_replacement" }, "④": "original_word4" } },
        korean: "해석", analysis: "분석", tip: "팁"
      },
      blank_example: {
        id: 7,
        stem: "다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
        ch: ["정답(fp에있음)", "오답1(fp에있음)", "오답2(fp에있음)", "오답3(fp에있음)"],
        ans: 1,
        overlay: { blank: "fullPassage에_있는_단어" },
        korean: "해석", analysis: "분석", tip: "팁"
      },
      written_example: {
        id: 17,
        stem: "다음 글의 빈칸에 괄호 안의 단어를 알맞은 형태로 바꿔 쓰시오.",
        wa: "changed",
        accept: ["changed", "Changed", "changed."],
        overlay: { excerptSentences: "She __________ (change) her mind." },
        korean: "해석", analysis: "분석", tip: "팁"
      },
      writing_example: {
        _comment: "영작 서술형 — passage 필수(정답자리 빈칸) + 응답 언어 명시",
        id: 20,
        stem: "다음 우리말에 맞도록 주어진 조건에 따라 영작하시오. (영어로)\n\"그는 집에서 그녀를 기다리기로 결정했다.\"\n[조건] (1) he, decided, to, wait, for, her, home, at을 모두 사용 (2) 정확히 7단어로 쓸 것",
        wa: "He decided to wait for her at home",
        accept: ["He decided to wait for her at home", "He decided to wait for her at home.", "he decided to wait for her at home"],
        overlay: { blank: "He decided to wait for her at home" },
        korean: "해석", analysis: "분석", tip: "팁"
      }
    }
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
