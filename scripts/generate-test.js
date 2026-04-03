#!/usr/bin/env node
/**
 * NaesinFit — generate-test.js
 * 가이드라인 기반 테스트 자동 출제
 *
 * Usage:
 *   node scripts/generate-test.js --type 단어 --passage passage.txt --ei "수능특강 영어,1강,글의 목적 파악"
 *   node scripts/generate-test.js --type 워크북 --passage passage.txt --ei "모의고사,18번,고1 3월"
 *   node scripts/generate-test.js --type 퀴즈 --json data/모의고사/고1/3월/18번/단어.json  (기존 단어JSON에서 원문 추출)
 *
 * 출력: data/ 경로에 JSON 파일 생성 → validate → auto-fix → 최종 저장
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');

// .env 로드
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  });
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY 미설정. .env 파일에 추가해주세요.');
  process.exit(1);
}

// ── 가이드라인에서 추출한 핵심 규격 ──

const SPEC = {
  '단어': {
    totalQ: 20, total: 100, time: 1200,
    distribution: '쉬움5×4점 + 보통10×5점 + 어려움5×6점 = 100점',
    types: [
      { type: '(A)(B)(C) 조합형', count: 3, fmt: 'mc', desc: '지문 빈칸 3개 (A)(B)(C), 각 2택 조합' },
      { type: '문맥상 부적절한 어휘', count: 3, fmt: 'mc', desc: '밑줄 ①②③④ 중 부적절 어휘' },
      { type: '빈칸 어휘 완성', count: 3, fmt: 'mc', desc: '지문 빈칸에 적절한 어휘 → passage에 __________ 필수' },
      { type: '동의어 고르기', count: 2, fmt: 'mc', desc: '밑줄 단어와 가장 가까운 의미' },
      { type: '반의어 고르기', count: 2, fmt: 'mc', desc: '밑줄 단어와 가장 먼 의미' },
      { type: '다의어 문맥적 의미', count: 1, fmt: 'mc', desc: '나머지와 다른 의미로 쓰인 것' },
      { type: '영영풀이 매칭', count: 1, fmt: 'mc', desc: '영영 정의에 해당하는 단어' },
      { type: '어형 변환 (서술형)', count: 2, fmt: 'written', desc: '괄호 단어를 어법에 맞게 변형' },
      { type: '빈칸 문맥 완성', count: 3, fmt: 'mc', desc: '빈칸에 적절한 구/표현 → passage에 __________ 필수' },
    ],
    chCount: 4,
  },
  '워크북': {
    totalQ: 20, total: 100, time: 1200,
    distribution: '쉬움5×4점 + 보통10×5점 + 어려움5×6점 = 100점',
    types: [
      { type: '어법', count: 5, fmt: 'mc', desc: '문법 선택/빈칸' },
      { type: '어휘', count: 2, fmt: 'mc', desc: '단어 뜻/의미 파악' },
      { type: '내용이해', count: 2, fmt: 'mc', desc: '글 내용 T/F' },
      { type: '빈칸추론', count: 2, fmt: 'mc', desc: '빈칸에 적절한 단어/구 → passage에 __________ 필수' },
      { type: '문장삽입', count: 1, fmt: 'mc', desc: '①②③④ 위치에 문장 넣기' },
      { type: '순서배열', count: 1, fmt: 'mc', desc: '(A)(B)(C) 문단 순서' },
      { type: '오류찾기', count: 1, fmt: 'mc', desc: '어법상 틀린 부분' },
      { type: '서술형', count: 3, fmt: 'written', desc: '핵심단어/영작/어형변환' },
      { type: 'T/F', count: 2, fmt: 'mc', desc: 'True/False 판별' },
      { type: '주제', count: 1, fmt: 'mc', desc: '글 전체 주제/요지' },
    ],
    chCount: 4,
  },
  '퀴즈': {
    totalQ: 20, total: 100, time: 1200,
    distribution: '쉬움5×4점 + 보통10×5점 + 어려움5×6점 = 100점',
    types: [
      { type: '순서배열', count: 1, fmt: 'mc', desc: '(A)(B)(C) 문단 순서' },
      { type: '문장삽입', count: 1, fmt: 'mc', desc: '①②③④ 위치에 문장 넣기' },
      { type: '어순배열', count: 1, fmt: 'written', desc: '주어진 단어 올바른 순서' },
      { type: '어법', count: 3, fmt: 'mc', desc: '밑줄 오류, (A)(B)(C) 선택' },
      { type: '문맥상 부적절한 어휘', count: 2, fmt: 'mc', desc: '부적절 어휘 찾기' },
      { type: '빈칸추론', count: 2, fmt: 'mc', desc: '빈칸에 적절한 구/문장 → passage에 __________ 필수' },
      { type: '내용이해', count: 2, fmt: 'mc', desc: '내용 일치/불일치' },
      { type: 'T/F', count: 1, fmt: 'mc', desc: 'True/False 판별' },
      { type: '서술형', count: 3, fmt: 'written', desc: '핵심단어/영작/어형변환' },
      { type: '주제', count: 2, fmt: 'mc', desc: '주제/제목/시사점' },
      { type: '함축의미 추론', count: 1, fmt: 'mc', desc: '비유적 표현의 의미' },
      { type: '무관문장', count: 1, fmt: 'mc', desc: '흐름과 관계없는 문장' },
    ],
    chCount: 4,
  },
};

function buildPrompt(testType, fullPassage, eiInfo) {
  const spec = SPEC[testType];
  const typeTable = spec.types.map(t =>
    `- ${t.type} (${t.count}문항, ${t.fmt}) — ${t.desc}`
  ).join('\n');

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

## 필수 규격 (절대 위반 금지)

### 문항 구성 (총 ${spec.totalQ}문항)
${typeTable}

### 배점
${spec.distribution}
- 쉬움 5문항 × 4점 = 20점
- 보통 10문항 × 5점 = 50점
- 어려움 5문항 × 6점 = 30점
- 합계 정확히 100점

### 선지
- 모든 객관식(mc)은 반드시 **4지선다** (ch 배열 4개)
- 정답(ans)은 0~3 사이 (0-based 인덱스)
- 정답 번호를 고르게 분포 (한 번호에 몰리지 않게)
- 더미 선지(—, -, None) 절대 금지

### passage 마킹 규칙 (중요!)
- **빈칸형** (빈칸추론, 빈칸 어휘 완성, 빈칸 문맥 완성): passage에 반드시 __________ (밑줄 10개) 포함. 정답 단어를 ____로 교체.
- **어법 4지선다**: passage에 ①②③④ 마커를 4개 모두 삽입
- **문맥상 부적절한 어휘**: passage에 <u>단어</u> 밑줄 4개 (①~④)
- **(A)(B)(C) 조합형**: passage에 <b>(A)</b> <b>(B)</b> <b>(C)</b> 마커
- **문장삽입**: passage에 ①②③④ 위치 마커
- **어형 변환**: passage에 __________ (정답) + (원형) 표시
- **동의어/반의어**: passage 없이 stem만으로 출제 가능

### 정답 노출 금지
- 빈칸 정답이 passage 다른 곳에 그대로 보이면 안 됨
- 서술형 정답(wa)이 passage에 그대로 노출되면 안 됨 (어형변환 제외)

### 서술형(written) 필드
- wa: 모범 답안 (문자열)
- accept: 허용 답안 배열 — 반드시 대소문자 변형, 마침표 유무 포함
  예: wa: "running" → accept: ["running", "Running", "running."]

### det (해설) 객체
- korean: 한국어 해석
- analysis: 정답 근거 + 오답 이유 (✅/❌ 이모지)
- tip: 학습 팁

## 출력 형식
순수 JSON만 출력하세요 (마크다운 코드블록 없이).
\`\`\`json 같은 마커 없이 { 로 시작해서 } 로 끝나야 합니다.

{
  "version": 1,
  "testType": "${testType}",
  "ei": {
    "subject": "${eiInfo.subject}",
    "pub": "${eiInfo.pub}",
    "lesson": "${eiInfo.lesson}",
    "title": "${eiInfo.title || ''}",
    "total": 100,
    "time": 1200,
    "totalQ": ${spec.totalQ},
    "histKey": "${testType === '단어' ? 'wordTest' : testType === '워크북' ? 'workbookTest' : 'quizTest'}_${eiInfo.pub.replace(/[^a-zA-Z0-9]/g, '')}_${eiInfo.lesson.replace(/[^a-zA-Z0-9가-힣]/g, '')}_v1"
  },
  "fullPassage": "(원문 전체)",
  "questions": [ ... 20개 문항 ... ]
}`;
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
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

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const testType = getArg('--type');
  const passageFile = getArg('--passage');
  const eiStr = getArg('--ei');
  const jsonFile = getArg('--json');
  const outFile = getArg('--out');

  if (!testType || !SPEC[testType]) {
    console.error('Usage: node scripts/generate-test.js --type 단어|워크북|퀴즈 --passage file.txt --ei "subject,pub,lesson"');
    console.error('  또는: --json existing.json (기존 JSON에서 원문 추출)');
    process.exit(1);
  }

  let fullPassage, eiInfo;

  if (jsonFile) {
    const existing = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    fullPassage = existing.fullPassage;
    eiInfo = { subject: existing.ei.subject, pub: existing.ei.pub, lesson: existing.ei.lesson, title: existing.ei.title || '' };
  } else if (passageFile && eiStr) {
    fullPassage = fs.readFileSync(passageFile, 'utf8').trim();
    const parts = eiStr.split(',');
    eiInfo = { subject: parts[0] || '', pub: parts[1] || '', lesson: parts[2] || '', title: parts[3] || '' };
  } else {
    console.error('--passage + --ei 또는 --json 필요');
    process.exit(1);
  }

  console.log(`\n🎯 ${testType}테스트 출제 시작`);
  console.log(`   지문: ${fullPassage.substring(0, 80)}...`);
  console.log(`   EI: ${eiInfo.subject} / ${eiInfo.pub} / ${eiInfo.lesson}\n`);

  // ── 출제 (최대 3회 시도) ──
  const { validate } = require(path.join(ROOT, 'validate', 'validate.js'));
  const { fix: autoFix } = require(path.join(ROOT, 'scripts', 'auto-fix.js'));

  let finalData = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`📝 출제 시도 ${attempt}/3...`);

    const prompt = buildPrompt(testType, fullPassage, eiInfo);
    let responseText;
    try {
      responseText = await callClaude(prompt);
    } catch (e) {
      console.error(`   ❌ API 호출 실패: ${e.message}`);
      continue;
    }

    // JSON 파싱
    let data;
    try {
      // 마크다운 코드블록 제거
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
      }
      data = JSON.parse(cleaned);
    } catch (e) {
      console.error(`   ❌ JSON 파싱 실패: ${e.message}`);
      console.error(`   응답 첫 200자: ${responseText.substring(0, 200)}`);
      continue;
    }

    // 임시 파일로 저장 → validate
    const tmpPath = path.join(ROOT, '.tmp_generate.json');
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');

    // auto-fix
    try {
      const { fixes, data: fixedData } = autoFix(tmpPath);
      if (fixes.length > 0) {
        data = fixedData;
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`   🔧 auto-fix: ${fixes.length}건 수정`);
      }
    } catch (e) { /* ignore */ }

    // ans 자동도출: det.analysis ✅/❌ 그룹 파싱 → ans 강제 세팅
    // AI가 ans와 analysis를 독립 작성해 불일치하는 버그 원천 차단
    {
      const MARKERS_LOCAL = [['①',1],['②',2],['③',3],['④',4],['⑤',5],['ⓐ',1],['ⓑ',2],['ⓒ',3],['ⓓ',4]];
      const checkGroupRe = /✅\s*([①②③④⑤ⓐⓑⓒⓓ]+)/g;
      const crossGroupRe = /❌\s*([①②③④⑤ⓐⓑⓒⓓ]+)/g;
      let ansFixed = 0;
      const questions = data.questions || (Array.isArray(data) ? data : []);
      for (const q of questions) {
        if (q.fmt !== 'mc' || !q.det || !q.det.analysis) continue;
        const analysis = q.det.analysis;
        const checkMarks = [], crossMarks = [];
        let gm;
        checkGroupRe.lastIndex = 0; crossGroupRe.lastIndex = 0;
        while ((gm = checkGroupRe.exec(analysis)) !== null) {
          for (const [marker, idx] of MARKERS_LOCAL) {
            if (gm[1].includes(marker) && !checkMarks.find(c => c.idx === idx)) checkMarks.push({ marker, idx });
          }
        }
        while ((gm = crossGroupRe.exec(analysis)) !== null) {
          for (const [marker, idx] of MARKERS_LOCAL) {
            if (gm[1].includes(marker) && !crossMarks.find(c => c.idx === idx)) crossMarks.push({ marker, idx });
          }
        }
        let derived = null;
        if (checkMarks.length >= 2 && crossMarks.length === 1) derived = crossMarks[0].idx; // 어법/부적절
        else if (checkMarks.length === 1 && crossMarks.length >= 1) derived = checkMarks[0].idx; // 일반
        if (derived !== null && q.ans !== derived) {
          q.ans = derived;
          ansFixed++;
        }
      }
      if (ansFixed > 0) {
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`   🎯 ans 자동도출: ${ansFixed}건 수정`);
      }
    }

    // validate
    const result = validate(tmpPath);
    if (result.pass) {
      console.log(`   ✅ PASS (${result.warnings.length} warnings)`);
      finalData = data;
      fs.unlinkSync(tmpPath);
      break;
    } else {
      console.log(`   ❌ FAIL (${result.errors.length} errors)`);
      result.errors.forEach(e => console.log(`      [${e.sev}] ${e.msg}`));
      fs.unlinkSync(tmpPath);

      if (attempt < 3) {
        console.log(`   → 에러 정보를 포함하여 재출제...`);
      }
    }
  }

  if (!finalData) {
    console.error('\n❌ 3회 시도 모두 실패. 수동 출제가 필요합니다.');
    process.exit(1);
  }

  // ── 저장 ──
  const outputPath = outFile
    ? path.resolve(outFile)
    : path.join(ROOT, 'data', '생성', `${eiInfo.pub}_${eiInfo.lesson}_${testType}.json`);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2), 'utf8');
  console.log(`\n✅ 저장: ${path.relative(ROOT, outputPath)}`);
  console.log(`   다음 단계: node scripts/deploy.js ${path.relative(ROOT, outputPath)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
