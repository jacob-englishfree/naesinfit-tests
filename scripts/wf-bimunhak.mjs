export const meta = {
  name: 'bimunhak-60-tests',
  description: '올림포스 고급영미비문학 5·8·9·10강 20지문 × 3종(단어·워크북·퀴즈) = 60 테스트 출제+validate',
  phases: [{ title: 'Generate', detail: '60 agents, each generate→validate→fix loop' }],
}

const ROOT = '/Users/woobumpark/nf-tests-deploy'
const GANGS = [5, 8, 9, 10]
const TYPES = ['단어', '워크북', '퀴즈']
const HK = { '단어': 'wordtest', '워크북': 'workbooktest', '퀴즈': 'quiztest' }

const SPEC_TABLE = {
  '단어': `- (A)(B)(C) 조합형 (3문항, mc) — 지문 빈칸 3개 (A)(B)(C) 각 2택 조합. passage에 <b>(A)</b> <b>(B)</b> <b>(C)</b> 마커
- 문맥상 부적절한 어휘 (3문항, mc) — passage에 <u>단어</u> 밑줄 4개(①~④), 그 중 문맥상 틀린 것
- 빈칸 어휘 완성 (3문항, mc) — passage에 __________ 필수, 정답 단어 교체
- 동의어 고르기 (2문항, mc) — 밑줄 단어와 가장 가까운 의미
- 반의어 고르기 (2문항, mc) — 밑줄 단어와 가장 먼 의미 (접두사 제거 조작 금지)
- 다의어 문맥적 의미 (1문항, mc) — 나머지와 다른 의미로 쓰인 것
- 영영풀이 매칭 (1문항, mc) — 영영 정의에 해당하는 단어 (passage 없음)
- 어형 변환 (2문항, written) — passage 2~4문장 발췌에 __________ + (원형). 괄호 단어를 어법에 맞게 변형
- 빈칸 문맥 완성 (3문항, mc) — passage에 __________ 필수, 적절한 구/표현`,
  '워크북': `- 어법 (5문항, mc) — passage에 ①②③④ 마커 4개, 밑줄 오류 or (A)(B)(C) 선택. 문법포인트 명확히
- 어휘 (2문항, mc) — 단어 뜻/의미 파악
- 내용이해 (2문항, mc) — 글 내용 일치/불일치
- 빈칸추론 (2문항, mc) — passage에 __________ 필수
- 문장삽입 (1문항, mc) — passage에 ①②③④ 위치 마커, 주어진 문장 넣을 곳
- 순서배열 (1문항, mc) — 도입문 + (A)(B)(C) 문단 순서
- 오류찾기 (1문항, mc) — passage에 ①②③④ 마커, 어법상 틀린 부분
- 서술형 (3문항, written) — 핵심단어 찾기 / 조건영작 / 어형변환 중. 영작엔 [조건]+(N단어) 필수
- T/F (2문항, mc) — True/False 판별
- 주제 (1문항, mc) — 글 전체 주제/요지`,
  '퀴즈': `※ 퀴즈(예상문제)는 PDF 실전형. ⛔서술형은 반드시 조건영작/어순배열/어형변환만 (핵심단어 찾기 금지 — 자동채점 복수정답 위험). ⛔T/F·내용이해 T/F 금지.
- 순서배열 (1문항, mc) — 도입문 + (A)(B)(C) 문단 순서
- 문장삽입 (1문항, mc) — passage에 ①②③④ 위치 마커
- 어순배열 (1문항, written) — passage에 __________ (빈칸은 passage 안!) + stem에 셔플된 단어 보기. [조건] 필수
- 어법 (3문항, mc) — passage에 ①②③④ 마커, 밑줄 오류 or (A)(B)(C)
- 문맥상 부적절한 어휘 (2문항, mc) — passage에 <u>단어</u> 밑줄 4개
- 빈칸추론 (2문항, mc) — passage에 __________ 필수
- 내용 일치/불일치 (2문항, mc) — 선지 키워드는 반드시 passage(발췌문) 안에 있어야 함
- 주제 (2문항, mc) — 주제/제목/요지
- 함축의미 추론 (1문항, mc) — passage에 <u>비유표현</u>, 그 의미
- 무관문장 (1문항, mc) — 흐름과 무관한 문장
- 조건영작 (2문항, written) — passage에 __________ + stem에 [조건](wa 단어 포함)+(N단어). 보기 토큰 정답순 나열 금지
- 어형변환 (2문항, written) — passage 발췌에 __________ + (원형)`,
}

function commonRules(testType, ei, histKey) {
  return `## 공통 규칙 (절대 위반 금지)
### 배점 (정확히 100점)
- 쉬움 5문항×4점=20 / 보통 10문항×5점=50 / 어려움 5문항×6점=30. diff="쉬움"|"보통"|"어려움", pts=4|5|6
### 선지(mc)
- 모든 mc는 4지선다 (ch 배열 정확히 4개). ans는 0-based(0~3). 정답번호 고르게 분포(한번호 5개초과 금지, 연속 2개까지).
- 더미선지(—,-,None) 금지. 뻔한 오답(메타서술 "본문에서/관련없는") 금지. 접두사제거 반의어 금지.
### passage 마킹
- 빈칸형: passage에 반드시 __________ (밑줄10개) 포함, 정답을 ____로 교체. 정답이 passage 다른 곳에 노출 금지.
- 마커형(어법/부적절/삽입/오류/조합): passage에 해당 마커(①②③④ 또는 <u></u> 또는 <b>(A)</b>) 삽입. 마커 없으면 FAIL.
- 비마커형(동의어/반의어/주제/내용이해 등): passage는 fullPassage 그대로(85%이상, 5문장이상).
### 서술형(written)
- wa: 모범답안(단일 항목, "N가지"/"A,B,and C" 금지). accept: 대소문자·마침표 변형 배열.
- 영작/어순배열: stem에 [조건]과 (N단어) 명시. [조건]에 wa의 핵심단어 포함. 보기 토큰을 정답 순서대로 나열 금지(셔플).
- wa가 stem이나 passage에 그대로 노출 금지(찾기유형 제외). 어형변환은 passage 발췌 2~4문장만.
### det (해설, 필수)
- korean: 한국어 해석 / analysis: 정답❌근거+오답✅ (어법·부적절은 정답에 ❌, 정답3개에 ✅ / 일반은 정답에 ✅) — ✅❌ 마커로 ans와 일치시킬 것 / tip: 학습팁
### 출력 JSON 구조
{"version":6,"testType":"${testType}","ei":{"total":100,"time":1200,"totalQ":20,"title":"${ei.title}","subject":"올림포스고급영미비문학","pub":"2025","lesson":"${ei.lesson}","section":"${ei.section}","histKey":"${histKey}"},"fullPassage":"(원문전체)","questions":[20개]}
문항 구조: {"id":1,"type":"유형명","diff":"쉬움","pts":4,"fmt":"mc"|"written","passage":"(마커포함 or 전체)","stem":"발문","det":{"korean":"","analysis":"","tip":""},"ans":0,"ch":["선지1","선지2","선지3","선지4"]}  // written은 ans/ch 대신 "wa","accept":[]`
}

const items = []
for (const g of GANGS) for (let n = 1; n <= 5; n++) for (const t of TYPES) items.push({ g, n, type: t })

phase('Generate')
const results = await parallel(items.map(({ g, n, type }) => async () => {
  const outPath = `${ROOT}/data/부교재/올림포스고급영미비문학/2025/${g}강/${n}번/${type}.json`
  const passPath = `${ROOT}/data/부교재/올림포스고급영미비문학/2025/${g}강/_passages/${n}번.json`
  const histKey = `${HK[type]}__${g}_${n}_v6`
  const ei = { lesson: `${g}강`, section: `${n}번`, title: `올림포스 영미비문학 Field ${g} ${n}번 (Theme)` }
  const prompt = `당신은 한국 고등학교 영어 내신 출제 전문가입니다. 올림포스 고급영미비문학 ${g}강 ${n}번 지문으로 "${type}테스트"(20문항) JSON을 출제합니다.

1) 먼저 원문을 읽으세요: \`cat "${passPath}"\` — 그 안의 fullPassage가 원문이고 theme로 title의 (Theme)를 교체하세요(예 "Theme 49", 한글설명 떼고 "Theme N"만). fullPassage는 한 글자도 바꾸지 말고 그대로 쓰되, 마커(①②③④,<u>,<b>,____)만 삽입하세요.

2) 아래 유형 구성대로 20문항 출제:
${SPEC_TABLE[type]}

${commonRules(type, ei, histKey)}

3) 작성한 JSON을 \`${outPath}\`에 저장(Write). 디렉토리는 \`mkdir -p\`로 생성.

4) 검증 루프 (반드시 수행): \`cd ${ROOT} && node validate/validate.js "${outPath}"\` 실행.
   - [S] 에러 중 S-BLIND-MISSING은 무시(정상 — 블라인드는 별도 단계). 그 외 [S]나 [A] 에러가 있으면 해당 문항을 수정해 다시 저장하고 재검증. 최대 5회 반복.
   - PASS 또는 (S-BLIND-MISSING만 남음)이 될 때까지 반복.

5) 마지막으로 \`node validate/validate.js "${outPath}"\` 결과를 확인하고, 아래 JSON만 반환:
{"g":${g},"n":${n},"type":"${type}","pass":true/false,"remaining":"남은 S/A 에러 요약(S-BLIND-MISSING 제외, 없으면 '')"}`

  const r = await agent(prompt, {
    label: `${g}강${n}번 ${type}`,
    phase: 'Generate',
    model: 'sonnet',
    schema: {
      type: 'object',
      required: ['g', 'n', 'type', 'pass'],
      properties: {
        g: { type: 'number' }, n: { type: 'number' }, type: { type: 'string' },
        pass: { type: 'boolean' }, remaining: { type: 'string' },
      },
    },
  })
  return r
}))

const clean = results.filter(Boolean)
const passed = clean.filter(r => r.pass)
const failed = clean.filter(r => !r.pass)
log(`출제 완료: PASS ${passed.length}/${clean.length}`)
return { total: items.length, returned: clean.length, pass: passed.length, failed }
