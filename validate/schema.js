#!/usr/bin/env node
/**
 * NaesinFit — Type-based Schema Validator
 *
 * 유형별로 반드시 있어야 하는 필드를 정의하고 검증.
 * "이 유형의 문항이라면 반드시 X가 있어야 한다"는 규칙을 코드화.
 *
 * Usage:
 *   const { validateBySchema } = require('./schema.js');
 *   const errors = validateBySchema(question, fileContext);
 */

const TYPE_SCHEMAS = {
  // === 어법 ===
  '어법': {
    fmt: 'mc',
    requireMarkerCh: true,        // ch=["①","②","③","④"]
    requireMarkers: ['①','②','③','④'], // passage에 ①②③④ 4개 다 있어야
    requireUnderline: 4,           // <u> 4개
    detKoreanPattern: /[a-zA-Z][a-zA-Z\s'\-]+\s*[→↔]/, // "X → Y" 형식
    description: '어법 — passage에 ①<u>word</u>...④<u>word</u>, det.korean에 "wrong → correct" 형식',
  },
  '문맥상 부적절한 어휘': {
    fmt: 'mc',
    requireMarkerCh: true,
    requireMarkers: ['①','②','③','④'],
    requireUnderline: 4,
    detKoreanRequireWord: true,    // det에 잘못된 단어 명시 필요
    description: '부적절 — passage에 ①②③④ 밑줄 4개, det.korean에 wrong word 명시',
  },

  // === 빈칸형 ===
  '빈칸 어휘 완성': {
    fmt: 'mc',
    requireBlankInPassage: true,   // passage에 ____ 또는 빈칸
    detKoreanContainsAns: true,    // det에 정답 단어 등장
    description: '빈칸 어휘 — passage에 ____, det에 정답단어',
  },
  '빈칸 문맥 완성': {
    fmt: 'mc',
    requireBlankInPassage: true,
    detKoreanContainsAns: true,
    description: '빈칸 문맥 — passage에 ____, det에 정답단어',
  },
  '빈칸추론': {
    fmt: 'mc',
    requireBlankInPassage: true,
    description: '빈칸추론 — passage에 ____',
  },

  // === T/F ===
  'T/F': {
    fmt: 'mc',
    requireTwoChoice: true,        // ch.length === 2
    chMustBeTF: true,              // ch는 T/F or True/False
    detKoreanRequireTF: true,      // det에 T 또는 F 명시
    description: 'T/F — ch=2, det에 판정 명시',
  },

  // === 동의어/반의어 ===
  '동의어': {
    fmt: 'mc',
    requireBoldInStem: true,       // stem에 <b>target</b>
    detKoreanContainsAns: true,
    description: '동의어 — stem에 <b>target</b>, det에 정답 등장',
  },
  '반의어': {
    fmt: 'mc',
    requireBoldInStem: true,
    detKoreanContainsAns: true,
    description: '반의어 — stem에 <b>target</b>, det에 정답 등장',
  },

  // === 영영풀이 ===
  '영영풀이': {
    fmt: 'mc',
    requireEnglishDef: true,       // stem에 영어 정의 (5+ 영단어)
    detKoreanContainsAns: true,
    description: '영영풀이 — stem에 영어 정의, det에 정답 단어',
  },

  // === 다의어 ===
  '다의어 문맥적 의미': {
    fmt: 'mc',
    requireBoldInStem: true,       // stem에 <b>target</b>
    description: '다의어 — stem에 target word',
  },

  // === (A)(B)(C) 조합형 ===
  '(A)(B)(C) 조합형': {
    fmt: 'mc',
    requireABCInPassage: true,     // passage에 (A) (B) (C) 마커 모두
    chMustBeABCFormat: true,       // ch는 "word1 — word2 — word3" 형식 4개
    description: 'ABC 조합 — passage에 (A)(B)(C), ch는 3단어 조합 4개',
  },

  // === 어순배열 ===
  '어순배열': {
    fmt: 'written',
    requireGivenWords: true,       // stem에 [단어 / 단어 / ...] 형식
    waNotInPassage: true,          // wa가 passage에 노출 안 됨
    description: '어순배열 — stem에 주어진 단어 목록, wa가 passage에 없음',
  },

  // === 문장삽입 ===
  '문장삽입': {
    fmt: 'mc',
    requireInsertMarkers: true,    // stem에 삽입할 문장 + passage에 ①②③④ 위치
    description: '문장삽입 — stem에 삽입 문장(<b>), passage에 ①②③④ 위치',
  },

  // === 순서배열 ===
  '순서배열': {
    fmt: 'mc',
    requireABCInStem: true,        // stem에 (A)(B)(C) 단락
    description: '순서배열 — stem에 (A)(B)(C) 단락',
  },
};

// 유형명 정규화 (오타/변형 매핑)
function normalizeType(type) {
  if (!type) return null;
  const t = type.replace(/\s+/g, '').toLowerCase();
  const map = {
    '어법': '어법',
    '어법오류': '어법',
    'grammar': '어법',
    '문맥상부적절한어휘': '문맥상 부적절한 어휘',
    '부적절': '문맥상 부적절한 어휘',
    '문맥상부적절': '문맥상 부적절한 어휘',
    '빈칸어휘완성': '빈칸 어휘 완성',
    '빈칸문맥완성': '빈칸 문맥 완성',
    '빈칸추론': '빈칸추론',
    '빈칸': '빈칸추론',
    't/f': 'T/F',
    'tf': 'T/F',
    '참거짓': 'T/F',
    '동의어': '동의어',
    '반의어': '반의어',
    '영영풀이': '영영풀이',
    '영영': '영영풀이',
    '다의어문맥적의미': '다의어 문맥적 의미',
    '다의어': '다의어 문맥적 의미',
    '(a)(b)(c)조합형': '(A)(B)(C) 조합형',
    'abc조합형': '(A)(B)(C) 조합형',
    'abc조합': '(A)(B)(C) 조합형',
    '어순배열': '어순배열',
    '어순': '어순배열',
    '문장삽입': '문장삽입',
    '순서배열': '순서배열',
    '순서': '순서배열',
  };
  return map[t] || null;
}

function validateBySchema(q, qid) {
  const errors = [];
  const type = normalizeType(q.testType || q.type);
  if (!type) return errors; // 알 수 없는 유형은 다른 체크에서

  const schema = TYPE_SCHEMAS[type];
  if (!schema) return errors;

  const passage = q.passage || '';
  const stem = q.stem || '';
  const ch = Array.isArray(q.ch) ? q.ch : [];
  const det = q.det || {};
  const detKor = (det.korean || '').replace(/<[^>]+>/g, '');

  // 마커형인지 사전 판정
  const isMarkerCh = ch.length === 4 && ch.every(c => typeof c === 'string' && /^[①②③④⑤]\s*$/.test(c.trim()));

  // fmt 일치
  if (schema.fmt && q.fmt !== schema.fmt) {
    errors.push({ id: 'SCHEMA-FMT', sev: 'B', msg: `Q${qid}: ${type}는 fmt=${schema.fmt} 필요 (현재 ${q.fmt})` });
  }

  // 마커형 ch 필수 → 단어형 어법도 허용 (경고만)
  if (schema.requireMarkerCh && !isMarkerCh) {
    // ch가 단어형이면 어법의 단어 변환 형태도 허용
    const isWordCh = ch.length === 4 && ch.every(c => typeof c === 'string' && /^[a-zA-Z\s'\-]+$/.test(c.trim()));
    if (!isWordCh) {
      errors.push({ id: 'SCHEMA-CH-MARKER', sev: 'B', msg: `Q${qid}: ${type}는 ch=["①","②","③","④"] 또는 단어형 권장` });
    }
  }

  // passage에 ①②③④ 마커 필수 (마커형 ch일 때만)
  if (schema.requireMarkers && isMarkerCh) {
    const missing = schema.requireMarkers.filter(m => !passage.includes(m));
    if (missing.length > 0) {
      errors.push({ id: 'SCHEMA-PASSAGE-MARKER', sev: 'B', msg: `Q${qid}: ${type} passage에 ${missing.join(',')} 마커 누락` });
    }
  }

  // <u> 4개 필수 (마커형 ch일 때만)
  if (schema.requireUnderline && isMarkerCh) {
    const uCount = (passage.match(/<u>/g) || []).length;
    if (uCount < schema.requireUnderline) {
      errors.push({ id: 'SCHEMA-UNDERLINE', sev: 'B', msg: `Q${qid}: ${type} passage <u> ${uCount}개 (${schema.requireUnderline}개 필요)` });
    }
  }

  // det.korean 형식 (참고용 — B급)
  if (schema.detKoreanPattern && !schema.detKoreanPattern.test(detKor) && detKor.length > 0) {
    errors.push({ id: 'SCHEMA-DET-PATTERN', sev: 'B', msg: `Q${qid}: ${type} det.korean이 "X → Y" 형식 권장` });
  }

  // 빈칸 마커 필수
  if (schema.requireBlankInPassage) {
    if (!passage.includes('____') && !passage.includes('______') && !stem.includes('____')) {
      errors.push({ id: 'SCHEMA-BLANK', sev: 'B', msg: `Q${qid}: ${type}인데 빈칸 마커(____) 없음` });
    }
  }

  // det에 정답 단어 등장 (영어 정답일 때만)
  if (schema.detKoreanContainsAns && q.ans >= 1 && q.ans <= ch.length) {
    const ansChoice = (ch[q.ans - 1] || '').toString().toLowerCase().trim();
    if (/^[a-z][a-z\s\-]*$/.test(ansChoice) && ansChoice.length > 3) {
      const detLow = detKor.toLowerCase();
      const tipLow = (det.tip || '').toLowerCase();
      const anaLow = (det.analysis || '').toLowerCase();
      if (!detLow.includes(ansChoice) && !tipLow.includes(ansChoice) && !anaLow.includes(ansChoice)) {
        errors.push({ id: 'SCHEMA-DET-ANS', sev: 'B', msg: `Q${qid}: ${type} 정답"${ansChoice}"이 det에 없음` });
      }
    }
  }

  // T/F: 2지선다 + T/F 선지
  if (schema.requireTwoChoice && ch.length !== 2) {
    errors.push({ id: 'SCHEMA-TF-CH', sev: 'B', msg: `Q${qid}: T/F는 ch.length=2 필요 (현재 ${ch.length})` });
  }
  if (schema.chMustBeTF && ch.length === 2) {
    const hasT = ch.some(c => /^(T|True|참)/i.test((c || '').toString().trim()));
    const hasF = ch.some(c => /^(F|False|거짓)/i.test((c || '').toString().trim()));
    if (!hasT || !hasF) {
      errors.push({ id: 'SCHEMA-TF-VALUES', sev: 'S', msg: `Q${qid}: T/F는 ch가 [T,F] 필요` });
    }
  }
  if (schema.detKoreanRequireTF) {
    const firstChars = detKor.trim().substring(0, 15);
    if (!/^(T|F|참|거짓|True|False|일치|불일치)/.test(firstChars)) {
      errors.push({ id: 'SCHEMA-TF-DET', sev: 'B', msg: `Q${qid}: T/F det.korean에 판정(T/F) 명시 권장` });
    }
  }

  // stem에 <b>target</b>
  if (schema.requireBoldInStem) {
    if (!/<b>[\s\S]+?<\/b>/.test(stem)) {
      errors.push({ id: 'SCHEMA-STEM-BOLD', sev: 'B', msg: `Q${qid}: ${type} stem에 <b>target</b> 필요` });
    }
  }

  // 영영풀이 — stem에 영어 정의
  if (schema.requireEnglishDef) {
    const stemPlain = stem.replace(/<[^>]+>/g, '');
    const engWords = (stemPlain.match(/[a-zA-Z]{3,}/g) || []).length;
    if (engWords < 5) {
      errors.push({ id: 'SCHEMA-EN-DEF', sev: 'S', msg: `Q${qid}: 영영풀이 stem에 영어 정의(5단어+) 필요` });
    }
  }

  // ABC 조합형 — passage에 (A)(B)(C)
  if (schema.requireABCInPassage) {
    if (!passage.includes('(A)') || !passage.includes('(B)') || !passage.includes('(C)')) {
      errors.push({ id: 'SCHEMA-ABC-PASSAGE', sev: 'B', msg: `Q${qid}: (A)(B)(C) 조합형 passage에 마커 누락` });
    }
  }

  // ABC 조합형 — ch가 "word — word — word" 형식
  if (schema.chMustBeABCFormat) {
    const valid = ch.every(c => typeof c === 'string' && c.split(/—|―|–|-/).length >= 3);
    if (!valid) {
      errors.push({ id: 'SCHEMA-ABC-CH', sev: 'B', msg: `Q${qid}: ABC 조합형 ch는 "word — word — word" 형식 필요` });
    }
  }

  // 어순배열 — stem에 [단어 목록]
  if (schema.requireGivenWords) {
    if (!/\[[^\]]+\]/.test(stem) && !/<b>[^<]*[\/,][^<]*<\/b>/.test(stem)) {
      errors.push({ id: 'SCHEMA-WORDS', sev: 'B', msg: `Q${qid}: 어순배열 stem에 주어진 단어 [...] 필요` });
    }
  }

  // 어순배열 — wa가 passage에 노출 안 됨
  if (schema.waNotInPassage && q.wa) {
    const wa = q.wa.toString().trim().replace(/\.$/, '');
    if (wa.length > 10 && passage.replace(/<[^>]+>/g, '').toLowerCase().includes(wa.toLowerCase())) {
      errors.push({ id: 'SCHEMA-WA-EXPOSED', sev: 'B', msg: `Q${qid}: 어순배열 정답이 passage에 노출` });
    }
  }

  // 문장삽입 — stem에 굵은 문장 + passage에 ①②③④
  if (schema.requireInsertMarkers) {
    const hasInsertSentence = /<b>[^<]{20,}<\/b>/.test(stem);
    const hasMarkers = ['①','②','③','④'].every(m => stem.includes(m) || passage.includes(m));
    if (!hasInsertSentence) {
      errors.push({ id: 'SCHEMA-INSERT-STEM', sev: 'B', msg: `Q${qid}: 문장삽입 stem에 삽입할 문장(<b>) 필요` });
    }
    if (!hasMarkers) {
      errors.push({ id: 'SCHEMA-INSERT-POS', sev: 'B', msg: `Q${qid}: 문장삽입 ①②③④ 위치 마커 누락` });
    }
  }

  // 순서배열 — stem에 (A)(B)(C)
  if (schema.requireABCInStem) {
    if (!stem.includes('(A)') || !stem.includes('(B)') || !stem.includes('(C)')) {
      errors.push({ id: 'SCHEMA-ORDER-STEM', sev: 'B', msg: `Q${qid}: 순서배열 stem에 (A)(B)(C) 단락 필요` });
    }
  }

  return errors;
}

module.exports = { validateBySchema, normalizeType, TYPE_SCHEMAS };

// CLI
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node validate/schema.js <file.json>');
    console.log('       node validate/schema.js --all');
    process.exit(1);
  }

  const ROOT = path.resolve(__dirname, '..');
  let files = [];
  if (arg === '--all') {
    const { execSync } = require('child_process');
    files = execSync(`find ${ROOT}/data -name "*.json" ! -path "*_passages*"`, { encoding: 'utf8' }).trim().split('\n');
  } else {
    files = [arg];
  }

  let totalErrors = 0;
  const byCode = {};
  for (const fp of files) {
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const qs = data.questions || [];
      for (let i = 0; i < qs.length; i++) {
        const errs = validateBySchema(qs[i], i + 1);
        for (const e of errs) {
          totalErrors++;
          byCode[e.id] = (byCode[e.id] || 0) + 1;
          if (totalErrors <= 30) {
            console.log(`${fp.replace(ROOT + '/', '')} [${e.sev}] ${e.msg}`);
          }
        }
      }
    } catch (e) {}
  }
  console.log('\n=== Schema 검증 결과 ===');
  for (const [code, count] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${count}건`);
  }
  console.log(`총 ${totalErrors}건`);
}
