#!/usr/bin/env node
/**
 * generate.js — 내신핏 테스트 출제 (잠긴 프롬프트 + 즉시 검증 + 중복 차단 + 셔플)
 *
 * Usage:
 *   npm run generate -- --original originals/교과서/영어1/비상홍/2과/본문.txt --types 단어,워크북,퀴즈 --ei "영어I,비상홍,2과,본문"
 *   npm run generate -- --json data/.../단어.json --types 워크북,퀴즈  (기존 JSON에서 원문 추출)
 *
 * 내부 동작:
 *   1. 원문 읽기
 *   2. 중복 체크 (data/에 같은 경로 파일 있으면 경고)
 *   3. 잠긴 프롬프트로 Claude API 출제
 *   4. 정답 시퀀스 셔플 검증
 *   5. validate.js 즉시 실행 → FAIL이면 자동 재출제 (최대 3회)
 *   6. qa.js 자동 연동 (출제 후 바로 검수)
 */
const fs = require('fs');
const path = require('path');
const { findJsonFiles, ROOT } = require('./lib/path-mapper');

// 기존 generate-test.js 모듈 재사용
const generateTestPath = path.join(ROOT, 'scripts', 'generate-test.js');

// .env 로드
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  });
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const https = require('https');

// ── SPEC (잠긴 프롬프트 — 수정 금지) ──
const LOCKED_RULES = `
## 절대 위반 금지 규칙 (잠금)

### 선지 규칙
- 더미 선지 금지: ①②③④ 번호만 넣기 금지. 실제 단어/문장 필수.
- 가짜 영어 단어 금지: -lyly, -nessness 같은 기계적 접미사 조합 금지.
- placeholder 금지: "보기1", "선지 내용", "원문 일치 진술" 등 금지.
- 선지 중복 금지: 4개 선지가 모두 달라야 함.
- 정답 길이 편향 금지: 정답이 오답보다 2배 이상 길면 안 됨.

### 정답 규칙
- 정답 분포: 20문항에서 ans=1/2/3/4 각각 4~6개 (균등 분포).
- 이전 파일과 정답 시퀀스가 동일하면 안 됨. 반드시 랜덤하게 배치.
- det.analysis의 ✅/❌ 마커와 ans 값이 반드시 일치해야 함.

### passage 규칙
- 원문(fullPassage)을 임의로 변조/축약 금지. 글자 단위 정확 복사.
- 빈칸형: passage에 반드시 __________ 포함.
- 어법형: passage에 반드시 ①②③④ 마커 4개 포함.
- 밑줄형: passage에 반드시 <u>단어</u> 4개 포함.
- 문장삽입: passage에 반드시 ①②③④ 위치 마커 포함.

### 서술형 규칙
- wa: 2글자 이상의 의미있는 정답.
- accept: 대소문자 변형 + 마침표 유무 포함.

### 해설(det) 규칙
- korean: 10자 이상 한국어 해설.
- analysis: ✅ 정답 근거 + ❌ 오답 이유 (각 선지별).
- tip: 5자 이상 학습 팁.
`;

// ── 중복 체크 ──
function checkDuplicate(outputDir, testType) {
  const fileName = testType === '단어' ? '단어.json' : testType === '워크북' ? '워크북.json' : '퀴즈.json';
  const target = path.join(outputDir, fileName);
  if (fs.existsSync(target)) {
    return target;
  }
  return null;
}

// ── 정답 시퀀스 셔플 검증 ──
function validateAnsShuffle(data, existingFiles) {
  const questions = data.questions || [];
  const newSeq = questions.map(q => q.ans).filter(a => a != null).join(',');

  // 기존 파일들과 비교
  for (const f of existingFiles) {
    try {
      const existing = JSON.parse(fs.readFileSync(f, 'utf8'));
      const existSeq = (existing.questions || []).map(q => q.ans).filter(a => a != null).join(',');
      if (newSeq === existSeq && newSeq.length > 5) {
        return { pass: false, duplicate: path.relative(ROOT, f) };
      }
    } catch { /* skip */ }
  }

  // 편향 체크
  const dist = {};
  questions.forEach(q => {
    if (typeof q.ans === 'number') dist[q.ans] = (dist[q.ans] || 0) + 1;
  });
  const mcCount = Object.values(dist).reduce((a, b) => a + b, 0);
  if (mcCount >= 10) {
    for (const [ans, count] of Object.entries(dist)) {
      if (count / mcCount > 0.45) {
        return { pass: false, reason: `ans=${ans}가 ${(count/mcCount*100).toFixed(0)}% — 편향` };
      }
    }
  }

  return { pass: true };
}

// ── Claude API 호출 ──
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) return reject(new Error('ANTHROPIC_API_KEY 미설정'));
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.content[0].text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── SPEC ──
const SPEC = {
  '단어': {
    totalQ: 20, total: 100, time: 1200,
    distribution: '쉬움5×4점 + 보통10×5점 + 어려움5×6점 = 100점',
    types: [
      { type: '(A)(B)(C) 조합형', count: 3, fmt: 'mc' },
      { type: '문맥상 부적절한 어휘', count: 3, fmt: 'mc' },
      { type: '빈칸 어휘 완성', count: 3, fmt: 'mc' },
      { type: '동의어 고르기', count: 2, fmt: 'mc' },
      { type: '반의어 고르기', count: 2, fmt: 'mc' },
      { type: '다의어 문맥적 의미', count: 1, fmt: 'mc' },
      { type: '영영풀이 매칭', count: 1, fmt: 'mc' },
      { type: '어형 변환 (서술형)', count: 2, fmt: 'written' },
      { type: '빈칸 문맥 완성', count: 3, fmt: 'mc' },
    ],
  },
  '워크북': {
    totalQ: 20, total: 100, time: 1200,
    distribution: '쉬움5×4점 + 보통10×5점 + 어려움5×6점 = 100점',
    types: [
      { type: '어법', count: 5, fmt: 'mc' },
      { type: '어휘', count: 2, fmt: 'mc' },
      { type: '내용이해', count: 2, fmt: 'mc' },
      { type: '빈칸추론', count: 2, fmt: 'mc' },
      { type: '문장삽입', count: 1, fmt: 'mc' },
      { type: '순서배열', count: 1, fmt: 'mc' },
      { type: '오류찾기', count: 1, fmt: 'mc' },
      { type: '서술형', count: 3, fmt: 'written' },
      { type: 'T/F', count: 2, fmt: 'mc' },
      { type: '주제', count: 1, fmt: 'mc' },
    ],
  },
  '퀴즈': {
    totalQ: 20, total: 100, time: 1200,
    distribution: '쉬움5×4점 + 보통10×5점 + 어려움5×6점 = 100점',
    types: [
      { type: '순서배열', count: 1, fmt: 'mc' },
      { type: '문장삽입', count: 1, fmt: 'mc' },
      { type: '어순배열', count: 1, fmt: 'written' },
      { type: '어법', count: 3, fmt: 'mc' },
      { type: '문맥상 부적절한 어휘', count: 2, fmt: 'mc' },
      { type: '빈칸추론', count: 2, fmt: 'mc' },
      { type: '내용이해', count: 2, fmt: 'mc' },
      { type: 'T/F', count: 1, fmt: 'mc' },
      { type: '서술형', count: 3, fmt: 'written' },
      { type: '주제', count: 2, fmt: 'mc' },
      { type: '함축의미 추론', count: 1, fmt: 'mc' },
      { type: '무관문장', count: 1, fmt: 'mc' },
    ],
  },
};

function buildPrompt(testType, fullPassage, eiInfo) {
  const spec = SPEC[testType];
  const typeTable = spec.types.map(t => `- ${t.type} (${t.count}문항, ${t.fmt})`).join('\n');

  return `당신은 한국 고등학교 영어 내신 시험 출제 전문가입니다.
아래 지문을 기반으로 "${testType}테스트" JSON을 생성하세요.

## 원문 (fullPassage)
${fullPassage}

## 시험 정보
- subject: "${eiInfo.subject}"
- pub: "${eiInfo.pub}"
- lesson: "${eiInfo.lesson}"
- title: "${eiInfo.title || ''}"
- testType: "${testType}"

## 문항 구성 (총 ${spec.totalQ}문항)
${typeTable}

## 배점
${spec.distribution}

${LOCKED_RULES}

## 출력
순수 JSON만 출력. \`\`\`json 마커 없이 { 로 시작 } 로 끝.
ans는 1-indexed (1,2,3,4).
version: 3.`;
}

async function generate(testType, fullPassage, eiInfo, outputPath, siblingFiles) {
  const { validate } = require(path.join(ROOT, 'validate', 'validate.js'));

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`  📝 ${testType} 출제 시도 ${attempt}/3...`);

    const prompt = buildPrompt(testType, fullPassage, eiInfo);
    let responseText;
    try {
      responseText = await callClaude(prompt);
    } catch (e) {
      console.error(`     ❌ API 실패: ${e.message}`);
      continue;
    }

    let data;
    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
      data = JSON.parse(cleaned);
    } catch (e) {
      console.error(`     ❌ JSON 파싱 실패`);
      continue;
    }

    // 정답 셔플 검증
    const shuffleCheck = validateAnsShuffle(data, siblingFiles);
    if (!shuffleCheck.pass) {
      console.log(`     ⚠️ 정답 시퀀스 문제: ${shuffleCheck.reason || shuffleCheck.duplicate} → 재출제`);
      continue;
    }

    // validate
    const tmpPath = path.join(ROOT, '.tmp_generate.json');
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    const result = validate(tmpPath);
    fs.unlinkSync(tmpPath);

    if (result.pass) {
      console.log(`     ✅ PASS (${result.warnings.length} warnings)`);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
      return outputPath;
    } else {
      console.log(`     ❌ FAIL (${result.errors.length} errors)`);
      result.errors.slice(0, 3).forEach(e => console.log(`        [${e.sev}] ${e.msg}`));
    }
  }

  console.error(`  ❌ ${testType} 3회 실패`);
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const originalFile = getArg('--original');
  const jsonFile = getArg('--json');
  const typesStr = getArg('--types') || '단어,워크북,퀴즈';
  const eiStr = getArg('--ei');
  const outDir = getArg('--out');

  const types = typesStr.split(',').map(t => t.trim());

  let fullPassage, eiInfo, outputDir;

  if (jsonFile) {
    const existing = JSON.parse(fs.readFileSync(path.resolve(jsonFile), 'utf8'));
    fullPassage = existing.fullPassage;
    eiInfo = { subject: existing.ei.subject, pub: existing.ei.pub, lesson: existing.ei.lesson, title: existing.ei.title || '' };
    outputDir = outDir ? path.resolve(outDir) : path.dirname(path.resolve(jsonFile));
  } else if (originalFile && eiStr) {
    fullPassage = fs.readFileSync(path.resolve(originalFile), 'utf8').trim();
    const parts = eiStr.split(',');
    eiInfo = { subject: parts[0] || '', pub: parts[1] || '', lesson: parts[2] || '', title: parts[3] || '' };
    outputDir = outDir ? path.resolve(outDir) : path.join(ROOT, 'data', '생성');
  } else {
    console.error('Usage:');
    console.error('  npm run generate -- --original originals/파일.txt --ei "subject,pub,lesson,title" [--types 단어,워크북,퀴즈] [--out dir]');
    console.error('  npm run generate -- --json data/.../단어.json [--types 워크북,퀴즈]');
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  내신핏 출제 — ${types.join(', ')}`);
  console.log(`  ${eiInfo.subject} / ${eiInfo.pub} / ${eiInfo.lesson}`);
  console.log(`${'═'.repeat(50)}\n`);

  // 중복 체크
  for (const t of types) {
    const dup = checkDuplicate(outputDir, t);
    if (dup) {
      console.log(`  ⚠️ 이미 존재: ${path.relative(ROOT, dup)}`);
      if (!args.includes('--force')) {
        console.log(`     --force 옵션으로 덮어쓰기 가능. 건너뜁니다.`);
        types.splice(types.indexOf(t), 1);
      }
    }
  }

  if (types.length === 0) {
    console.log('  출제할 유형이 없습니다.');
    process.exit(0);
  }

  // 같은 폴더의 기존 파일 (정답 시퀀스 비교용)
  const siblingFiles = fs.existsSync(outputDir)
    ? fs.readdirSync(outputDir).filter(f => f.endsWith('.json')).map(f => path.join(outputDir, f))
    : [];

  const results = [];
  for (const t of types) {
    const fileName = t === '단어' ? '단어.json' : t === '워크북' ? '워크북.json' : '퀴즈.json';
    const outputPath = path.join(outputDir, fileName);
    const result = await generate(t, fullPassage, eiInfo, outputPath, siblingFiles);
    if (result) {
      results.push(result);
      siblingFiles.push(result); // 다음 타입 출제 시 비교 대상에 추가
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  출제 완료: ${results.length}/${types.length}`);
  results.forEach(r => console.log(`  ✅ ${path.relative(ROOT, r)}`));

  if (results.length > 0) {
    console.log(`\n  다음 단계: npm run qa -- ${path.relative(ROOT, outputDir)}`);
  }
  console.log(`${'═'.repeat(50)}\n`);
}

module.exports = { generate, SPEC, LOCKED_RULES };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
