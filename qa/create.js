#!/usr/bin/env node
/**
 * create.js — 내신핏 테스트 통합 출제 파이프라인
 *
 * 원문 PDF 자동 로드 → 데이터 추출 → 잠긴 프롬프트로 출제 → validate → 블라인드 풀이
 *
 * Usage:
 *   npm run create -- "수능특강Light" "1강" "Gateway" "단어"
 *   npm run create -- "수능특강Light" "1강" "Gateway" --all (단어+워크북+퀴즈)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

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
  console.error('❌ ANTHROPIC_API_KEY 환경변수가 없습니다.');
  process.exit(1);
}

// ── 인자 파싱 ──
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: npm run create -- "교재명" "강/과" "섹션" "유형(단어/워크북/퀴즈/--all)"');
  console.error('예시: npm run create -- "수능특강Light" "1강" "Gateway" "단어"');
  process.exit(1);
}

const [bookName, lesson, section, typeArg] = args;
const testTypes = typeArg === '--all' ? ['단어', '워크북', '퀴즈'] : [typeArg];

// ── STEP 0: 원문 확보 ──
console.log('\n━━━ STEP 0: 원문 확보 ━━━');

// 원문 PDF 경로 탐색
const SOURCE_BASE = path.join(process.env.HOME, 'Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)');
const BOOK_FOLDERS = {
  '수능특강Light': '수능특강Light영어(2026학년도_2025출판)/본문분석',
  '수능특강': '수능특강영어(2027학년도_2026출판)/본문분석',
};

const bookFolder = BOOK_FOLDERS[bookName];
if (!bookFolder) {
  console.error(`❌ "${bookName}"에 대한 원문 경로를 모르겠습니다.`);
  console.error(`   등록된 교재: ${Object.keys(BOOK_FOLDERS).join(', ')}`);
  process.exit(1);
}

// 강 번호 추출
const lessonNum = lesson.replace(/[^0-9]/g, '').padStart(2, '0');
const pdfPattern = `${lessonNum}강_본문분석.pdf`;
const pdfDir = path.join(SOURCE_BASE, bookFolder);
const pdfPath = path.join(pdfDir, pdfPattern);

// 대체 패턴 시도
let actualPdfPath = null;
if (fs.existsSync(pdfPath)) {
  actualPdfPath = pdfPath;
} else {
  // 다른 패턴 시도
  const files = fs.readdirSync(pdfDir).filter(f => f.includes(lessonNum + '강') && f.endsWith('.pdf'));
  if (files.length > 0) {
    actualPdfPath = path.join(pdfDir, files[0]);
  }
}

if (!actualPdfPath) {
  console.error(`❌ 원문 PDF를 찾을 수 없습니다.`);
  console.error(`   탐색 경로: ${pdfDir}`);
  console.error(`   탐색 패턴: *${lessonNum}강*.pdf`);
  console.error('\n⛔ 원문 없이 출제할 수 없습니다. SOP STEP 0 위반.');
  process.exit(1);
}

console.log(`✅ 원문 PDF: ${path.basename(actualPdfPath)}`);

// ── 기존 JSON에서 fullPassage 로드 (있으면) ──
const dataDir = path.join(ROOT, 'data/부교재', bookName.includes('Light') ? '수능특강Light/영어' : '수능특강/영어', lesson, section);
let fullPassage = '';
const existingFile = path.join(dataDir, '단어.json');
if (fs.existsSync(existingFile)) {
  try {
    const d = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
    fullPassage = d.fullPassage || '';
    console.log(`✅ fullPassage 로드: ${fullPassage.length}자 (기존 JSON)`);
  } catch {}
}

if (!fullPassage) {
  console.error('❌ fullPassage를 찾을 수 없습니다. 기존 JSON에 없습니다.');
  console.error('   수동으로 원문 텍스트를 입력하거나, 기존 파일에서 추출하세요.');
  process.exit(1);
}

// ── 출제_가이드라인 전문 로드 ──
const guidelinePath = path.join(ROOT, '출제_가이드라인.md');
let guidelineText = '';
if (fs.existsSync(guidelinePath)) {
  guidelineText = fs.readFileSync(guidelinePath, 'utf8');
  console.log(`✅ 출제_가이드라인.md 로드: ${guidelineText.length}자`);
} else {
  console.error('❌ 출제_가이드라인.md를 찾을 수 없습니다.');
  process.exit(1);
}

// ── SPEC (유형 배분) ──
const SPEC = {
  '단어': {
    totalQ: 20, total: 100, time: 1200,
    types: 'Q1~3:(A)(B)(C)조합형(쉬움/보통/어려움), Q4~6:부적절어휘(쉬움/보통/어려움), Q7~9:빈칸어휘완성(쉬움/보통/어려움), Q10~12:동의어(쉬움/보통/어려움), Q13~14:반의어(보통/어려움), Q15:다의어(어려움), Q16:영영풀이(보통,passage없음), Q17~18:어형변환서술형(보통/어려움), Q19~20:빈칸문맥완성(보통/어려움)'
  },
  '워크북': {
    totalQ: 20, total: 100, time: 1200,
    types: 'Q1~4:어법(쉬움/쉬움/보통/어려움), Q5~6:어휘빈칸/부적절(보통/보통), Q7~9:T/F(쉬움/보통/보통), Q10~11:빈칸추론(보통/어려움), Q12~13:내용일치/불일치(보통/어려움), Q14:오류찾기(어려움), Q15~16:서술형핵심단어/어형변환(보통/어려움), Q17:어순배열(어려움), Q18~19:주제/요약(보통/어려움), Q20:영작서술형(어려움)'
  },
  '퀴즈': {
    totalQ: 20, total: 100, time: 1200,
    types: 'Q1~3:어법(쉬움/보통/어려움), Q4~5:부적절어휘(보통/어려움), Q6~7:빈칸추론(보통/어려움), Q8~10:내용일치/불일치(쉬움/보통/어려움), Q11~12:주제/대의/제목(보통/어려움), Q13:함축의미추론(어려움), Q14~15:지칭추론(보통/보통), Q16~17:서술형핵심단어/어형변환(보통/어려움), Q18:어순배열(어려움), Q19~20:영작서술형(보통/어려움)'
  }
};

// ── Claude API 호출 ──
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

// ── 프롬프트 빌드 (가이드라인 전문 내장) ──
function buildPrompt(testType) {
  const spec = SPEC[testType];

  return `당신은 한국 고등학교 영어 내신 시험 출제 전문가입니다.
아래 원문과 가이드라인을 **반드시** 준수하여 "${testType}테스트" JSON을 생성하세요.

━━━ 원문 (fullPassage) ━━━
${fullPassage}

━━━ 시험 정보 ━━━
- subject: "${bookName}"
- pub: "영어"
- lesson: "${lesson}"
- section: "${section}"
- testType: "${testType}"
- totalQ: ${spec.totalQ}
- total: ${spec.total}
- histKey: "${testType === '단어' ? 'wordTest' : testType === '워크북' ? 'workbookTest' : 'quizTest'}_${bookName.replace(/\s/g,'')}_${lesson}_${section}_v3"

━━━ 유형 배분 (절대 변경 금지) ━━━
${spec.types}

배점: 쉬움5문항×4점=20 + 보통10문항×5점=50 + 어려움5문항×6점=30 = 100점

━━━ 출제 가이드라인 전문 (절대 위반 금지) ━━━
${guidelineText}

━━━ 핵심 규칙 (추가 강조) ━━━

1. **빈칸 위치**: 빈칸어휘/빈칸추론/빈칸문맥 → 빈칸(__________)은 반드시 passage 안에. stem에 넣지 마.
2. **passage 발췌**: passage는 fullPassage에서 5~8문장 발췌. fullPassage 전체를 그대로 넣지 마.
3. **서술형 조건**: 서술형은 반드시 조건 명시 (단어 수, 품사, 사용할 단어 등).
4. **영작**: passage 없어야 함. 원문 문장 그대로 번역시키지 마. 패러프레이징한 문장으로 출제.
5. **어형변환**: passage 2~4문장. 빈칸+(원형) 형태. 정답이 passage 다른 곳에 노출 금지.
6. **영영풀이**: passage 없음. stem에 영영 정의 제시.
7. **어법**: passage에 ①②③④ 마커. stem에는 "밑줄 친 부분 중 어법상 틀린 것은?" 만.
8. **순서배열/문장삽입**: passage null. stem에 (A)(B)(C) 또는 삽입 문장.
9. **어순배열**: passage에 빈칸(__________)이 반드시 있어야 함. stem에는 단어 목록+조건만.
10. **정답 분포**: ans 1~4 각각 4~5개. 3연속 같은 번호 금지.
11. **det 필수**: korean(한국어해석), analysis(✅❌ 마커), tip(학습팁) 전부 필수.
12. **accept 배열**: 서술형은 대소문자/마침표/하이픈 변형 최소 3개.
13. **필드명**: diff (쉬움/보통/어려움), pts (4/5/6). difficulty/points 쓰지 마.
14. **T/F**: 워크북 전용. ch=["T","F"]. 퀴즈/단어에서 사용 금지.

━━━ 출력 형식 ━━━
순수 JSON만 출력. \`\`\`json 마커 없이 { 로 시작 } 로 끝.
version: 3, ans는 1-indexed (1,2,3,4).
wa와 ans 둘 다 있어야 함 (서술형).

## ⛔ 출제 절대 금지 11종 (위반 시 폐기)

다음 11종은 출제 시 절대 금지. 출제 후 자가 검증 필수.

1. **메타텍스트 노출 금지**: passage/stem/ch에 "(원문에 없는 내용)", "(원문에 없음)", "[3점]", "✅", "❌", "(보기)", "출제자", "정답:" 등 출제 메타텍스트 노출 금지. 학생 화면에 그대로 보임.

2. **4선지 동일 prefix 금지**: ch 4개 중 3개 이상이 동일한 10자+ prefix("It is not mentioned that..." 등)로 시작 금지. 정답 패턴 노출.

3. **자기 정의 stem 금지**: 서술형(written) 문항에서 wa(영어 정답)가 stem에 그대로 노출 금지. 예: "'reason'을 의미하는 단어를 본문에서 찾아 쓰시오" + wa=reason은 자기 정의. 한국어 뜻으로 stem 작성 ("이유를 의미하는...").

4. **한국어 단서 누락 금지**: stem에 "다음 우리말에 맞도록"이 있으면 한국어 단서를 5자 이상 명시 필수.

5. **단어 수 조건 모순 금지**: stem "(N단어)" 또는 "(조건: N단어)" 명시 시 wa의 단어 수와 정확히 일치해야 함.

6. **선지 잘림 금지**: ch 4개 모두 완결된 단어/문장으로 끝나야 함. "tha", "co", "fr" 같은 미완결 영어 끝 금지. 한국어 조사 누락 금지.

7. **passage 마커 잔여 금지**: 동의어/반의어/빈칸어휘/빈칸추론/주제/요약 등에서 passage에 ①②③④⑤ 출제 마커 노출 금지. (A)(B)(C)/어법/오류찾기/내용일치/문장삽입/순서배열 같은 마커가 의미 있는 유형만 마커 허용.

8. **type vs 실제 문항 모순 금지**: type="내용일치"인데 ch 4개가 모두 부정문(It is not, 원문에 없 등) 시작하면 모순. type 라벨과 실제 ch 패턴 일치 필수.

9. **passage 1문장 금지**: 모든 mc 문항(어법 빈칸/어휘 빈칸/내용일치 등 전부 포함)에서 passage는 5문장 이상. 1문장만으로 출제 금지. 영영풀이만 예외.

10. **서술형 정답 passage 노출 금지**: 서술형(written) 문항에서 wa가 passage에 그대로 등장하면 안 됨. 단, stem에 "본문에서 찾아 쓰시오", "발췌하여" 같은 표현이 명시된 경우만 예외.

11. **정답 길이 편향 금지**: ch 4개 중 정답 길이가 오답 3개 평균의 2.5배 이상이면 차단. 길이로 정답 추측 가능 패턴 금지.

## 출제 후 자가 검증 체크리스트 (의무)

출제한 모든 문항에 대해 아래 11개 질문에 "예"가 나와야 함. 하나라도 "아니오"면 폐기 + 재출제.

[ ] 1. passage/stem/ch에 메타텍스트("(원문에 없는 내용)" 등) 0건인가?
[ ] 2. ch 4개 중 3개+ 동일 prefix로 시작하지 않는가?
[ ] 3. 서술형 wa가 stem에 영어로 그대로 노출되지 않았는가?
[ ] 4. "우리말에 맞도록" stem에 한국어 단서가 충분한가?
[ ] 5. (N단어) 조건과 wa 단어 수가 일치하는가?
[ ] 6. ch 4개 모두 완결된 단어/문장으로 끝나는가?
[ ] 7. passage에 마커(①②③④⑤)가 무관 유형에서 노출되지 않았는가?
[ ] 8. type 라벨과 실제 ch 패턴이 일치하는가?
[ ] 9. passage가 5문장 이상인가? (영영풀이 제외)
[ ] 10. 서술형 wa가 passage에 그대로 노출되지 않았는가? (찾기 유형 예외)
[ ] 11. 정답 길이가 오답 평균의 2.5배 미만인가?

이 11개를 출제 시점에 자체 점검하지 않으면 사고 100% 발생.`;
}

// ── 메인 ──
async function main() {
  for (const testType of testTypes) {
    console.log(`\n━━━ STEP 1: ${testType} 출제 ━━━`);
    const spec = SPEC[testType];
    if (!spec) {
      console.error(`❌ 알 수 없는 테스트 유형: ${testType}`);
      continue;
    }

    const outputPath = path.join(dataDir, `${testType}.json`);
    let passed = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`  📝 시도 ${attempt}/3...`);

      const prompt = buildPrompt(testType);
      let responseText;
      try {
        responseText = await callClaude(prompt);
      } catch (e) {
        console.error(`  ❌ API 실패: ${e.message}`);
        continue;
      }

      let data;
      try {
        let cleaned = responseText.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
        data = JSON.parse(cleaned);
      } catch (e) {
        console.error(`  ❌ JSON 파싱 실패`);
        continue;
      }

      // STEP 2: validate
      console.log('\n━━━ STEP 2: validate 검증 ━━━');
      const tmpPath = path.join(ROOT, '.tmp_create.json');
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');

      try {
        const vResult = execSync(`node validate/validate.js "${tmpPath}"`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        console.log(`  ✅ validate PASS`);
      } catch (e) {
        const output = (e.stdout || '') + (e.stderr || '');
        const errors = output.split('\n').filter(l => l.includes('[S]') || l.includes('[A]'));
        console.log(`  ❌ validate FAIL: ${errors.length}건`);
        errors.slice(0, 10).forEach(err => console.log(`    ${err.trim()}`));
        fs.unlinkSync(tmpPath);
        continue;
      }

      fs.unlinkSync(tmpPath);

      // 저장
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  ✅ 저장: ${path.relative(ROOT, outputPath)}`);
      passed = true;
      break;
    }

    if (!passed) {
      console.error(`\n❌ ${testType} 3회 시도 실패. 수동 출제 필요.`);
    }
  }

  console.log('\n━━━ 완료 ━━━');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
