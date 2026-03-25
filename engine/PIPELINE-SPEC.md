# NaesinFit Test Pipeline Specification v1.0

> 작성일: 2026-03-25
> 목적: 860+ HTML 파일의 CSS/JS 중복 제거, 데이터 분리, 자동 검증 파이프라인 구축
> 핵심 제약: 최종 산출물은 standalone HTML (GitHub Pages에서 서버 없이 동작)

---

## 1. 현재 문제점

| 문제 | 영향 | 규모 |
|------|------|------|
| CSS 114줄 + JS 400줄 + 데이터가 파일마다 복사됨 | 엔진 수정 시 860개 파일 모두 수정 필요 | 860 파일 |
| 3가지 테마(초록/보라/주황) CSS가 각 파일에 인라인 | 테마 변경 시 전체 파일 수정 | 860 파일 |
| 데이터(EI, FULL_PASSAGE, Q[])가 JS 내 하드코딩 | 추출/검증 불가능, 수정 시 JS 파싱 필요 | 860 파일 |
| 검증이 수동(validate-all.js가 HTML을 파싱) | 느리고 불안정, HTML 구조 변경에 취약 | 48 체크포인트 |
| Agent가 반복적으로 같은 실수 | 발췌 지문, ans 인덱스 오류, 마커 누락 | 매 작업 |

---

## 2. 목표 아키텍처

```
naesinfit-tests/
├── engine/                          # 엔진 (Single Source of Truth)
│   ├── PIPELINE-SPEC.md             # 이 문서
│   ├── common.css                   # 공통 CSS (테마 무관 부분)
│   ├── theme-green.css              # 단어테스트 테마 (:root 변수 + 테마별 오버라이드)
│   ├── theme-purple.css             # 워크북테스트 테마
│   ├── theme-orange.css             # 퀴즈테스트 테마
│   ├── engine.js                    # 테스트 엔진 (모든 함수)
│   ├── template.html                # HTML 셸 (빌드 시 CSS+JS+JSON 주입)
│   ├── build.js                     # 단일 JSON → standalone HTML 빌드
│   └── build-all.js                 # 전체 빌드 + 검증
│
├── data/                            # 문제 데이터 (JSON)
│   ├── 모의고사/
│   │   └── {학년}/{월}_{연도}/{번호}/
│   │       ├── 단어.json
│   │       ├── 워크북.json
│   │       └── 퀴즈.json
│   ├── 부교재/
│   │   └── 수능특강/영어/{강번호}/{지문명}/
│   │       ├── 단어.json
│   │       ├── 워크북.json
│   │       └── 퀴즈.json
│   └── 교과서/
│       └── {과목}/{출판사}/{과번호}/
│           ├── 단어.json
│           ├── 워크북.json
│           └── 퀴즈.json
│
├── validate/                        # 검증 도구
│   ├── schema.json                  # JSON Schema 정의
│   ├── validate.js                  # 48+ 체크포인트 검증기
│   ├── validate-content.js          # 내용 품질 검증 (동의어/반의어 사전 대조 등)
│   └── audit-report.js              # HTML 감사 보고서 생성
│
├── dist/                            # 빌드 산출물 (standalone HTML)
│   ├── 모의고사/                     # 현재 구조와 동일한 경로
│   │   └── 고1/3월/37번/
│   │       ├── 단어테스트.html
│   │       ├── 워크북테스트.html
│   │       └── 퀴즈테스트.html
│   ├── 부교재/
│   └── 교과서/
│
├── 모의고사/                         # 기존 파일 (마이그레이션 완료 후 제거)
├── 부교재/
├── 교과서/
└── scripts/
    ├── migrate.js                   # 기존 HTML → JSON 마이그레이션 스크립트
    └── extract-data.js              # HTML에서 EI, FULL_PASSAGE, Q[] 추출
```

---

## 3. JSON Schema

### 3.1 최상위 구조

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "naesinfit-test-v1",
  "type": "object",
  "required": ["version", "testType", "ei", "fullPassage", "questions"],
  "properties": {
    "version": {
      "const": 1,
      "description": "스키마 버전. 향후 구조 변경 시 증가."
    },
    "testType": {
      "enum": ["단어", "워크북", "퀴즈"],
      "description": "테스트 종류. 빌드 시 테마 CSS 결정에 사용."
    },
    "ei": { "$ref": "#/$defs/EI" },
    "fullPassage": {
      "type": "string",
      "minLength": 1,
      "description": "원문 전체 텍스트. 모든 문항의 passage가 이 텍스트의 일부여야 함."
    },
    "questions": {
      "type": "array",
      "minItems": 20,
      "maxItems": 20,
      "items": { "$ref": "#/$defs/Question" }
    }
  }
}
```

### 3.2 EI 객체

```json
"EI": {
  "type": "object",
  "required": ["subject", "pub", "lesson", "title", "total", "time", "totalQ", "histKey"],
  "properties": {
    "subject": {
      "type": "string",
      "minLength": 1,
      "description": "시험 이름. 예: '2025 고1 3월 모의고사', '지학사 영어I', '2027 수능특강 영어'",
      "examples": ["2025 고1 3월 모의고사", "지학사 영어I", "2027 수능특강 영어"]
    },
    "pub": {
      "type": "string",
      "minLength": 1,
      "description": "단원/번호. 예: '37번', '1과', '1강'",
      "examples": ["37번", "1과", "1강"]
    },
    "lesson": {
      "type": "string",
      "minLength": 1,
      "description": "단원 이름 또는 문제 유형. 예: '순서', 'The Power of Words', 'Exercise 1'"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "지문 제목 (영어). 예: 'Cartilage & Knee Joint'"
    },
    "total": { "const": 100 },
    "time": { "const": 1200, "description": "시험 시간(초). 항상 20분 = 1200초." },
    "totalQ": { "const": 20 },
    "histKey": {
      "type": "string",
      "pattern": "^(wordTest|workbookTest|quizTest)_.+_v[0-9]+$",
      "description": "localStorage 키. 형식: {testType}_{식별자}_v{버전}",
      "examples": [
        "wordTest_2025_g1_mar_37_v1",
        "workbookTest_jihaksa_eng1_L1_v2",
        "quizTest_ebs_eng_1_v2"
      ]
    }
  }
}
```

### 3.3 Question 객체

```json
"Question": {
  "type": "object",
  "required": ["id", "type", "diff", "pts", "fmt", "passage", "stem", "det"],
  "properties": {
    "id": {
      "type": "integer",
      "minimum": 1,
      "maximum": 20,
      "description": "문항 번호 (1~20, 연속, 중복 없음)"
    },
    "type": {
      "type": "string",
      "description": "문항 유형명",
      "enum": [
        "(A)(B)(C) 조합형", "문맥상 부적절한 어휘", "동의어 고르기", "반의어 고르기",
        "빈칸 어휘 완성", "다의어 문맥적 의미", "영영풀이 매칭", "어형 변환 (서술형)",
        "빈칸 문맥 완성",
        "어법 빈칸", "내용일치", "내용불일치", "T/F", "서술형", "빈칸 추론",
        "문장삽입", "어순배열", "어법", "어휘", "빈칸추론", "내용이해",
        "순서배열", "글순서"
      ]
    },
    "diff": {
      "enum": ["쉬움", "보통", "어려움"]
    },
    "pts": {
      "enum": [4, 5, 6],
      "description": "배점. 쉬움=4, 보통=5, 어려움=6"
    },
    "fmt": {
      "enum": ["mc", "written"],
      "description": "mc=객관식(선택), written=서술형(텍스트 입력)"
    },
    "ans": {
      "type": "integer",
      "minimum": 0,
      "maximum": 4,
      "description": "fmt=mc일 때 필수. 정답 인덱스(0-based). ch[ans]가 정답."
    },
    "ch": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "minItems": 5,
      "maxItems": 5,
      "description": "fmt=mc일 때 필수. 5지선다 선택지. 빈 문자열 및 중복 금지."
    },
    "wa": {
      "type": "string",
      "minLength": 1,
      "description": "fmt=written일 때 필수. 대표 정답 텍스트."
    },
    "accept": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "minItems": 1,
      "description": "fmt=written일 때 필수. 허용되는 정답 변형 목록 (대소문자 변형, 축약형 등)."
    },
    "passage": {
      "type": "string",
      "description": "해당 문항의 지문 HTML. 영영풀이는 빈 문자열(''). HTML 태그 허용(<u>, <b>, <br> 등)."
    },
    "stem": {
      "type": "string",
      "minLength": 1,
      "description": "발문(문제 지시문). HTML 태그 허용."
    },
    "det": { "$ref": "#/$defs/Detail" }
  },
  "allOf": [
    {
      "if": { "properties": { "fmt": { "const": "mc" } } },
      "then": { "required": ["ans", "ch"] }
    },
    {
      "if": { "properties": { "fmt": { "const": "written" } } },
      "then": { "required": ["wa", "accept"] }
    }
  ]
}
```

### 3.4 Detail(해설) 객체

```json
"Detail": {
  "type": "object",
  "required": ["korean", "analysis", "tip"],
  "properties": {
    "korean": {
      "type": "string",
      "minLength": 10,
      "description": "핵심 내용 한국어 해석. HTML 태그 허용."
    },
    "analysis": {
      "type": "string",
      "minLength": 10,
      "description": "정답 근거 + 각 오답 분석. 모든 선택지 커버 필수. HTML/줄바꿈 허용."
    },
    "tip": {
      "type": "string",
      "minLength": 5,
      "description": "학습 포인트. 학생에게 실질적 도움이 되는 팁."
    }
  }
}
```

### 3.5 예시 JSON (퀴즈테스트)

```json
{
  "version": 1,
  "testType": "퀴즈",
  "ei": {
    "subject": "2025 고1 3월 모의고사",
    "pub": "37번",
    "lesson": "순서",
    "title": "Cartilage & Knee Joint",
    "total": 100,
    "time": 1200,
    "totalQ": 20,
    "histKey": "quizTest_2025_g1_mar_37_v1"
  },
  "fullPassage": "Cartilage is extremely important for the healthy functioning of a joint...",
  "questions": [
    {
      "id": 1,
      "type": "순서배열",
      "diff": "어려움",
      "pts": 6,
      "fmt": "mc",
      "ans": 1,
      "ch": ["(A) - (C) - (B)", "(B) - (A) - (C)", "(B) - (C) - (A)", "(C) - (A) - (B)", "(C) - (B) - (A)"],
      "passage": "Cartilage is extremely important...<br><br><b>(A)</b> This squeezing...",
      "stem": "주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?",
      "det": {
        "korean": "주어진 글에서 연골의 중요성을 언급한 뒤...",
        "analysis": "정답 ② (B)-(A)-(C): 원래 모의고사 정답...",
        "tip": "순서 문제: 지시어(This, then)와 논리적 흐름을 따라 연결"
      }
    }
  ]
}
```

---

## 4. 배점 검증 규칙 (불변)

| 난이도 | 문항 수 | 배점 | 소계 |
|--------|--------|------|------|
| 쉬움 | 5 | 4점 | 20점 |
| 보통 | 10 | 5점 | 50점 |
| 어려움 | 5 | 6점 | 30점 |
| **합계** | **20** | | **100점** |

위반 시 빌드 차단.

---

## 5. CSS 분리 전략

### 5.1 파일 구성

| 파일 | 내용 | 크기(추정) |
|------|------|----------|
| `common.css` | 레이아웃, 컴포넌트, 애니메이션, 반응형 (114줄 중 테마 무관 부분) | ~100줄 |
| `theme-green.css` | `:root` 변수 + 테마 오버라이드 (단어테스트) | ~15줄 |
| `theme-purple.css` | `:root` 변수 + 테마 오버라이드 (워크북테스트) | ~15줄 |
| `theme-orange.css` | `:root` 변수 + 테마 오버라이드 (퀴즈테스트) | ~15줄 |

### 5.2 테마 변수 매핑

현재 3가지 테마의 CSS 변수 차이점:

```
단어(green):  --g:#16A34A  --gd:#14532D  --gl:#E8F5E9  --bg:#F4F8F5
워크북(purple): --o:#7C3AED  --od:#5B21B6  --ol:#A78BFA  --bg:#F5F3FF
퀴즈(orange):  --o:#E8772E  --od:#B85A1A  --ol:#F5A623  --bg:#F6F2EE
```

공통 CSS에서는 `--primary`, `--primary-dark`, `--primary-light` 등의 시맨틱 변수명을 사용하고, 각 테마 CSS에서 이를 오버라이드하는 방식으로 통합한다.

### 5.3 빌드 시 CSS 주입

`build.js`가 `common.css` + 해당 `theme-{color}.css`를 읽어서 `<style>` 태그로 인라인 주입. 최종 HTML에는 외부 CSS 참조가 없어야 함 (standalone 요구사항).

---

## 6. JS 엔진 분리 전략

### 6.1 engine.js 함수 목록

현재 HTML 안에 포함된 모든 함수를 그대로 추출:

| 함수 | 역할 |
|------|------|
| `getHistory()` | localStorage에서 시험 기록 조회 |
| `saveToHistory(r, elapsed)` | 시험 결과 저장 |
| `updateHCount()` | 기록 개수 표시 |
| `toggleHistory()` | 기록 패널 토글 |
| `getLevel(score)` | 점수 → 레벨 (마스터/챌린저/파이터/루키/스타터) |
| `getTypeAdvice(type)` | 유형별 학습 조언 |
| `fmtTime(seconds)` | 초 → "X분 Y초" 형식 |
| `toast(msg)` | 토스트 메시지 |
| `showScreen(id)` | 화면 전환 |
| `shuffle(arr)` | 배열 셔플 |
| `startExam()` | 시험 시작 |
| `showQ(idx, direction)` | 문항 표시 (슬라이드 전환) |
| `renderContent(idx, qi, q, tc, mk, pp)` | 문항 렌더링 |
| `selectAns(idx, ci)` | 객관식 답 선택 |
| `writeAns(idx, val)` | 서술형 답 입력 |
| `navQ(dir)` | 이전/다음 문항 |
| `updateProgress()` | 진행 바 업데이트 |
| `initSwipe()` | 스와이프 네비게이션 |
| `startTimer()` | 타이머 시작 |
| `submitExam()` | 시험 제출 |
| `grade()` | 채점 |
| `renderResults(r, elapsed)` | 결과 화면 렌더링 |
| `getWeakTypes()` | 약점 유형 추출 |
| `getTestName()` | 테스트 종류명 |
| `copyResult()` | 결과 텍스트 복사 |
| `shareImage()` | 결과 이미지 공유 |
| `reviewHistory(idx)` | 과거 기록 해설 보기 |
| `retake()` | 재시험 |
| `goHome()` | 홈으로 |

### 6.2 engine.js가 기대하는 전역 변수

빌드 시 template.html 내에 `<script>` 블록으로 주입:

```javascript
// JSON 데이터에서 추출하여 주입
const EI = { /* ... */ };
const FULL_PASSAGE = `...`;
const Q = [ /* ... */ ];
const typeTag = { /* 유형→CSS 클래스 매핑 */ };
```

이후 `engine.js` 코드가 이어짐. 전역 변수 `S` (상태)는 engine.js 내부에서 선언.

### 6.3 typeTag 자동 생성

`typeTag` 매핑은 현재 하드코딩되어 있으나, engine.js 내부에 고정 상수로 포함:

```javascript
const typeTag = {
  '문장삽입': 'tag-insert',
  '어순배열': 'tag-order',
  '순서배열': 'tag-order',
  '글순서': 'tag-order',
  '어법': 'tag-grammar',
  '어휘': 'tag-vocab',
  '빈칸추론': 'tag-blank',
  '빈칸 추론': 'tag-blank',
  '서술형': 'tag-written',
  '내용이해': 'tag-content',
  '내용일치': 'tag-content',
  '내용불일치': 'tag-content',
  'T/F': 'tag-tf',
  '(A)(B)(C) 조합형': 'tag-combo',
  '문맥상 부적절한 어휘': 'tag-wrong',
  '동의어 고르기': 'tag-syn',
  '반의어 고르기': 'tag-ant',
  '빈칸 어휘 완성': 'tag-blank',
  '다의어 문맥적 의미': 'tag-poly',
  '영영풀이 매칭': 'tag-eng',
  '어형 변환 (서술형)': 'tag-morph',
  '빈칸 문맥 완성': 'tag-ctx',
  '어법 빈칸': 'tag-grammar'
};
```

---

## 7. template.html 구조

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>{{TITLE}}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<style>
{{CSS}}
</style>
</head>
<body>
<div class="toast" id="toast"></div>

<div id="startScreen" class="screen active">
<div class="start-container">
  <div class="brand-badge">{{BRAND_BADGE}}</div>
  <h1 class="start-title">{{TEST_TITLE_HTML}}</h1>
  <p class="start-subtitle">{{SUBTITLE}}</p>
  <div class="info-card">
    <div class="info-card-header">{{INFO_HEADER}}</div>
    <div class="info-rows">
      <div class="info-row"><span class="info-label">시험</span><span class="info-value">{{EI_SUBJECT}}</span></div>
      <div class="info-row"><span class="info-label">문항</span><span class="info-value">{{EI_PUB_LESSON}}</span></div>
      <div class="info-row"><span class="info-label">지문</span><span class="info-value">{{EI_TITLE}}</span></div>
    </div>
  </div>
  <div class="chip-row">
    <div class="chip">20문항</div>
    <div class="chip">20분</div>
    <div class="chip">80점 이상 통과</div>
    <div class="chip">100점 만점</div>
  </div>
  <div class="input-group"><label>이름 *</label><input type="text" id="inpName" placeholder="이름을 입력하세요"></div>
  <div class="input-row">
    <div class="input-group" style="flex:1"><label>학교</label><input type="text" id="inpSchool" placeholder="선택"></div>
    <div class="input-group" style="flex:.6"><label>학년</label><select id="inpGrade"><option>고1</option><option>고2</option><option>고3</option><option>중3</option></select></div>
  </div>
  <button class="btn btn-primary" onclick="startExam()">시험 시작하기</button>
  <button class="btn btn-outline" onclick="toggleHistory()">시험 기록 보기 <span class="history-badge" id="hCount">0</span></button>
  <div id="historyPanel"></div>
</div>
</div>

<div id="examScreen" class="screen">
  <div class="exam-topbar">
    <div class="topbar-left"><div class="topbar-dot"></div><div class="topbar-info">{{TOPBAR_INFO}}</div></div>
    <div class="timer" id="timer">20:00</div>
    <button class="btn-submit" onclick="submitExam()">제출하기</button>
  </div>
  <div class="exam-progress"><div class="exam-progress-fill" id="progressFill"></div></div>
  <div class="ans-count" id="ansCount">0/20</div>
  <div class="exam-scroll" id="examScroll"></div>
  <div class="slide-wrap" id="slideWrap">
    <div class="slide-passage" id="slidePassage"></div>
    <div class="slide-bottom" id="slideBottom"></div>
  </div>
</div>

<div id="resultScreen" class="screen"></div>

<script>
{{DATA_BLOCK}}
{{ENGINE_JS}}
updateHCount();
</script>
</body>
</html>
```

### 7.1 플레이스홀더 치환 규칙

| 플레이스홀더 | 소스 | 예시 |
|-------------|------|------|
| `{{TITLE}}` | `ei.subject + " " + ei.pub + " 온라인" + testTypeName + "TEST"` | "2025 고1 3월 37번 온라인퀴즈TEST" |
| `{{CSS}}` | `common.css` + `theme-{color}.css` 파일 내용 결합 | 인라인 CSS |
| `{{BRAND_BADGE}}` | testType에 따라 결정 | "온라인퀴즈 TEST" |
| `{{TEST_TITLE_HTML}}` | testType에 따라 결정 | `온라인퀴즈 <span>TEST</span>` |
| `{{SUBTITLE}}` | `ei.subject + " · " + ei.pub + " · " + ei.lesson + " · 20문항"` | |
| `{{INFO_HEADER}}` | "시험 정보" (고정) | |
| `{{EI_SUBJECT}}` | `ei.subject` | |
| `{{EI_PUB_LESSON}}` | `ei.pub + " (" + ei.lesson + ")"` | "37번 (순서)" |
| `{{EI_TITLE}}` | `ei.title` | "Cartilage & Knee Joint" |
| `{{TOPBAR_INFO}}` | `ei.subject 축약 + " · <span>" + ei.pub + "</span>"` | |
| `{{DATA_BLOCK}}` | JS 변수 선언: `const EI=...;const FULL_PASSAGE=...;const Q=[...];` | |
| `{{ENGINE_JS}}` | `engine.js` 파일 내용 전체 | |

### 7.2 testType → 테마/이름 매핑

| testType | 테마 파일 | 브랜드 이름 | histKey 접두사 |
|----------|----------|------------|--------------|
| 단어 | theme-green.css | 온라인단어 TEST | wordTest_ |
| 워크북 | theme-purple.css | 온라인워크북 TEST | workbookTest_ |
| 퀴즈 | theme-orange.css | 온라인퀴즈 TEST | quizTest_ |

---

## 8. 검증 파이프라인 (48+ 체크포인트)

### 8.1 구조 검증 (S1~S6) -- 빌드 차단

| ID | 검증 항목 | 기대값 | 심각도 |
|----|----------|--------|--------|
| S1 | `questions.length` | = 20 | S |
| S2 | `sum(q.pts)` | = 100 | S |
| S3 | `count(diff === "쉬움" && pts === 4)` | = 5 | S |
| S4 | `count(diff === "보통" && pts === 5)` | = 10 | S |
| S5 | `count(diff === "어려움" && pts === 6)` | = 5 | S |
| S6 | `ei.totalQ === 20 && ei.total === 100` | true | S |

### 8.2 필드 완전성 (F7~F14) -- 빌드 차단

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| F7 | EI 8개 필드 전부 존재 (subject, pub, lesson, title, total, time, totalQ, histKey) | S |
| F8 | 각 Q: id, type, diff, pts, fmt 존재 | S |
| F9 | fmt=mc인 Q: ans(정수) + ch(배열) 존재 | S |
| F10 | fmt=written인 Q: wa(문자열) + accept(배열) 존재 | S |
| F11 | 각 Q: passage 키 존재 (빈 문자열 허용) | S |
| F12 | 각 Q: stem 존재 + 비어있지 않음 | S |
| F13 | 각 Q: det 존재 + det.korean 존재 | A |
| F14 | 각 Q: det.analysis + det.tip 존재 | A |

### 8.3 정합성 (C15~C21) -- 빌드 차단

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| C15 | mc의 `ans >= 0 && ans < ch.length` | S |
| C16 | mc의 `ch.length === 5` | S |
| C17 | ch 내 빈 문자열 없음 | S |
| C18 | ch 내 중복 선택지 없음 (`new Set(ch).size === ch.length`) | A |
| C19 | id 값 1~20 연속, 중복 없음 | S |
| C20 | histKey가 정규식 패턴 통과 | B |
| C21 | diff 값이 "쉬움"/"보통"/"어려움" 중 하나 | S |

### 8.4 지문-유형 교차 (P22~P29) -- 빌드 차단(S/A)

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| P22 | 빈칸 유형 → passage에 `__________` 1개 이상 | S |
| P23 | "문맥상 부적절한 어휘" / "어휘" → passage에 `<u>` 태그 5개 | S |
| P24 | "(A)(B)(C) 조합형" → passage에 `(A)`, `(B)`, `(C)` 각 1개 | S |
| P25 | "어형 변환" → passage에 `__________` + `(원형)` 패턴 | S |
| P26 | "동의어 고르기"/"반의어 고르기" → passage가 1~3문장 (전체 지문이 아님) | A |
| P27 | "영영풀이 매칭" → passage가 빈 문자열 | A |
| P28 | "어법" (5지선다) → passage에 `<u>` + ①②③④⑤ 각 1개 | S |
| P29 | "문장삽입" → passage에 ①②③④ 위치 마커 4개 | S |

### 8.5 콘텐츠 오염 (X30~X34) -- 빌드 차단

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| X30 | `[ERROR]`, `[error]`, `ERROR:` 패턴 없음 | S |
| X31 | `undefined`, `null`, `NaN` 리터럴 텍스트 없음 (JSON 값이 아닌 문자열 내) | S |
| X32 | `TODO`, `FIXME`, `PLACEHOLDER`, `INSERT HERE` 없음 | A |
| X33 | `???`, `xxx`, `---` (플레이스홀더) 없음 | A |
| X34 | 한글 깨짐 문자 없음 (U+FFFD 등) | A |

### 8.6 UI/CSS 검증 (U35~U38) -- 경고

JSON 기반 파이프라인에서는 빌드 후 생성된 HTML에 대해 검증:

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| U35 | 지문 영역 `text-align: justify` 적용 (CSS 확인) | B |
| U36 | 유동 폰트 사이즈 적용 (clamp 확인) | B |
| U37 | Pretendard Variable CDN 로드 | B |
| U38 | `@media(max-width:640px)` 반응형 존재 | B |

### 8.7 테스트 종류별 (T39~T42) -- 빌드 차단

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| T39 | 퀴즈: 순서/삽입 FIRST, 어법/어휘 SECOND, 서술형/내용/TF LAST | A |
| T40 | 퀴즈: 8유형 x 지정 문항 수 (문장삽입2, 어순배열2, 어법3, 어휘2, 빈칸3, 서술형4, 내용이해2, T/F2) | A |
| T41 | 단어: 9유형 x 지정 문항 수 | A |
| T42 | 워크북: 6유형 x 지정 문항 수 | A |

### 8.8 정답-해설 정합성 (D43~D48) -- 빌드 차단(A)

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| D43 | mc: `ch[ans]`가 해설 분석의 정답 선지와 일치 | A |
| D44 | mc: `det.analysis`에 5개 선택지 언급 (①②③④⑤ 또는 숫자) | A |
| D45 | 결과 화면에서 Q id 순서대로 해설 렌더링 | B |
| D46 | `det.korean`, `det.analysis`, `det.tip` 각 10자 이상 | A |
| D47 | 해설에 "② 정답" 기술 시 `ans === 1` (0-indexed) 확인 | A |
| D48 | 해설에 각 오답 선지 영어+한국어 해석 포함 | A |

### 8.9 어순배열 특수 검증 (W49~W50) -- 빌드 차단

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| W49 | 어순배열: passage에 정답(wa) 문장이 그대로 보이면 S등급 (빈칸 처리 필수) | S |
| W50 | 모든 빈칸은 `__________` (밑줄 10개) 형태. 괄호+공백 형태 금지 | A |

### 8.10 문항번호별 유형 적합성 (R51~R53) -- 경고

모의고사 테스트에만 적용 (교과서/부교재는 해당 없음):

| ID | 검증 항목 | 심각도 |
|----|----------|--------|
| R51 | 출제 제외 번호(25, 27, 28번) 사용 시 경고 | C |
| R52 | 짧은 지문(18~20, 26번)에 순서/삽입/어순배열 출제 시 경고 | C |
| R53 | 중간 지문(21~24, 29~34번)에 문장삽입 시 길이 확인 경고 | C |

---

## 9. 빌드 파이프라인

### 9.1 단일 파일 빌드 (build.js)

```
입력: data/모의고사/고1/3월/37번/퀴즈.json
출력: dist/모의고사/고1/3월/37번/퀴즈테스트.html
```

**단계:**

```
1. JSON 파일 읽기 + JSON.parse
2. JSON Schema 검증 (schema.json)
3. 48+ 체크포인트 검증 (validate.js)
   ├─ S등급 1개라도 → 빌드 중단, 오류 출력
   ├─ A등급 → 빌드 중단, 오류 출력
   └─ B/C등급 → 경고 출력, 빌드 계속
4. CSS 로드: common.css + theme-{testType}.css
5. JS 로드: engine.js
6. template.html 로드
7. 플레이스홀더 치환:
   ├─ {{CSS}} ← common.css + theme CSS
   ├─ {{DATA_BLOCK}} ← const EI=...; const FULL_PASSAGE=...; const Q=[...];
   ├─ {{ENGINE_JS}} ← engine.js 내용
   └─ 기타 {{...}} ← ei 데이터에서 추출
8. dist/ 경로에 HTML 파일 쓰기
9. 빌드 결과 출력 (파일 크기, 검증 결과)
```

### 9.2 전체 빌드 (build-all.js)

```
1. data/ 하위 모든 *.json 파일 탐색
2. 각 JSON에 대해 build.js 실행
3. 결과 집계:
   ├─ 총 파일 수
   ├─ 빌드 성공
   ├─ 빌드 실패 (S/A등급)
   ├─ 경고 (B/C등급)
   └─ 실패한 파일 목록 + 오류 상세
4. histKey 중복 검사 (파일 간)
5. 빌드 요약 출력
```

### 9.3 CLI 인터페이스

```bash
# 단일 파일 빌드
node engine/build.js data/모의고사/고1/3월/37번/퀴즈.json

# 전체 빌드
node engine/build-all.js

# 검증만 (빌드 없이)
node validate/validate.js data/모의고사/고1/3월/37번/퀴즈.json

# 전체 검증
node validate/validate.js --all

# 감사 보고서 생성
node validate/audit-report.js --output report.html
```

---

## 10. 마이그레이션 전략

### 10.1 기존 HTML → JSON 추출 (scripts/extract-data.js)

860개 기존 HTML에서 데이터를 자동 추출:

```
1. HTML 파일 읽기
2. <script> 블록에서 정규식으로 추출:
   ├─ const EI = {...}; → JSON 파싱
   ├─ const FULL_PASSAGE = `...`; → 문자열 추출
   └─ const Q = [...]; → JSON 파싱 (함수/변수 참조 해결)
3. testType 결정:
   ├─ 파일명 "단어테스트" → "단어"
   ├─ 파일명 "워크북테스트" → "워크북"
   └─ 파일명 "퀴즈테스트" → "퀴즈"
4. JSON 조립 + 검증
5. data/ 경로에 저장
```

**주의 사항:**
- `FULL_PASSAGE` 변수 참조: `Q` 배열 내 `passage: FULL_PASSAGE` 같은 참조를 실제 텍스트로 대체해야 함
- 템플릿 리터럴 내 이스케이프 처리
- HTML 엔티티 (`&amp;`, `&lt;` 등) 보존

### 10.2 마이그레이션 단계

```
Phase 1: 추출 + 검증 (파괴 없음)
  1. extract-data.js로 860개 HTML → 860개 JSON 생성
  2. validate.js로 전체 검증
  3. 검증 실패 파일 수동 수정

Phase 2: 빌드 + 비교 (파괴 없음)
  1. build-all.js로 860개 JSON → 860개 HTML (dist/)
  2. 기존 HTML과 빌드된 HTML의 동작 비교 (render-test.js)
  3. 차이 있는 파일 수동 확인

Phase 3: 전환
  1. dist/ 내용을 기존 경로로 복사
  2. GitHub Pages 배포 경로 변경
  3. 기존 HTML 파일 아카이브 또는 제거
```

### 10.3 FULL_PASSAGE 참조 해결

현재 HTML에서 `passage: FULL_PASSAGE`처럼 변수 참조를 사용하는 문항이 있음. 추출 시 이를 실제 텍스트로 치환해야 함.

JSON에서는 FULL_PASSAGE 참조를 사용하지 않는다. 대신:
- `fullPassage` 필드에 원문 전체 저장
- 각 문항의 `passage`에는 실제 텍스트 또는 `"__FULL__"` 마커 사용
- `"__FULL__"` 마커가 있으면 빌드 시 `FULL_PASSAGE` 변수 참조로 치환 (JS 크기 최적화)

```json
{
  "passage": "__FULL__"
}
```

빌드 시:
```javascript
// __FULL__ 마커가 있는 문항 → JS에서 FULL_PASSAGE 참조
{ passage: FULL_PASSAGE }

// 그 외 → 문자열 리터럴
{ passage: "Cartilage is extremely important..." }
```

---

## 11. 테스트 생성 워크플로우

### 11.1 새 테스트 생성 (사람 + AI)

```
1. 원본 확보
   ├─ 모의고사: PDF에서 지문 텍스트 추출
   ├─ 교과서: 교과서 본문 텍스트
   └─ 부교재: 수능특강 지문 텍스트

2. JSON 생성 (Claude가 수행)
   ├─ 가이드라인 파일 필수 로드
   ├─ ei 객체 작성
   ├─ fullPassage 원문 전체 입력
   ├─ 20문항 출제 (유형별 배분 준수)
   └─ 해설(det) 작성

3. 검증
   $ node validate/validate.js data/모의고사/고1/3월/37번/퀴즈.json
   ├─ ALL PASS → 다음 단계
   └─ FAIL → 오류 수정 후 재검증

4. 빌드
   $ node engine/build.js data/모의고사/고1/3월/37번/퀴즈.json
   → dist/모의고사/고1/3월/37번/퀴즈테스트.html

5. 로컬 확인
   ├─ 브라우저에서 dist/ 파일 열기
   ├─ 20문항 직접 풀이 확인
   └─ 모바일 뷰 확인

6. 배포
   ├─ git add + commit + push (dist/ 내 HTML)
   └─ GitHub Pages 자동 배포

7. DB 등록
   └─ Supabase contents 테이블 + TEST_APP_DEPLOY 매핑 등록
```

### 11.2 기존 테스트 수정

```
1. data/ 내 해당 JSON 수정
2. 검증: node validate/validate.js <path>
3. 빌드: node engine/build.js <path>
4. 확인 + 배포
```

엔진 수정 시:
```
1. engine/ 내 CSS 또는 JS 수정
2. 전체 빌드: node engine/build-all.js
3. 변경된 파일 확인 + 배포
```

### 11.3 Agent에게 JSON 생성 위임 시 규칙

Claude/Agent가 JSON을 생성할 때 반드시 지켜야 할 사항:

1. 가이드라인 파일 먼저 로드
2. JSON Schema에 맞게 출력
3. `node validate/validate.js` 실행하여 ALL PASS 확인
4. FULL_PASSAGE 원문이 PDF와 글자 하나까지 일치하는지 확인
5. 어순배열 문항: passage에 정답 문장이 보이지 않는지 확인
6. 모든 선택지가 5개인지 직접 확인
7. ans 인덱스와 해설 번호 교차 확인

---

## 12. dist/ 배포 구조

### 12.1 경로 매핑 (data/ → dist/)

| data/ 경로 | dist/ 경로 |
|-----------|-----------|
| `data/모의고사/고1/3월/37번/퀴즈.json` | `dist/모의고사/고1/3월/37번/퀴즈테스트.html` |
| `data/모의고사/고1/3월/37번/단어.json` | `dist/모의고사/고1/3월/37번/단어테스트.html` |
| `data/모의고사/고1/3월/37번/워크북.json` | `dist/모의고사/고1/3월/37번/워크북테스트.html` |
| `data/부교재/수능특강/영어/1강/Gateway/단어.json` | `dist/부교재/수능특강/영어/1강/Gateway/단어테스트.html` |
| `data/교과서/공통영어1/YBM김은형/1과/단어.json` | `dist/교과서/공통영어1/YBM김은형/1과/단어테스트.html` |

### 12.2 GitHub Pages 설정

현재는 repo 루트가 Pages 루트. 전환 후:

**Option A (권장)**: `dist/`를 Pages 루트로 변경
- GitHub Pages 설정에서 Source를 `dist/` 폴더로 지정
- 기존 URL 구조 유지: `naesinfit-tests.vercel.app/모의고사/고1/3월/37번/퀴즈테스트.html`
- `dist/` 내에 `index.html` 포함

**Option B**: 빌드 결과를 루트에 직접 출력 (기존 구조 유지)
- 마이그레이션 완료 후 data/ 와 engine/ 만 별도, 빌드 결과는 현재 위치에 덮어쓰기

---

## 13. 의존성

### 13.1 빌드 시 (개발 머신)

| 패키지 | 용도 | 버전 |
|--------|------|------|
| Node.js | 빌드 스크립트 실행 | >= 18 |
| ajv | JSON Schema 검증 | latest |
| ajv-formats | 추가 포맷 검증 | latest |

`package.json` 에 devDependencies로 추가.

### 13.2 런타임 (브라우저)

| 리소스 | CDN URL |
|--------|---------|
| Pretendard Variable | `cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/...` |
| html2canvas | `cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` |

런타임 의존성은 CDN 참조. 빌드 산출물(standalone HTML)에 인라인하지 않음.

---

## 14. 구현 우선순위

### Phase 1: 기반 (1~2일)
1. `engine/common.css` + 3개 테마 CSS 추출
2. `engine/engine.js` 추출 (현재 HTML에서 복사)
3. `engine/template.html` 작성
4. `engine/build.js` 구현 (단일 파일 빌드)
5. 기존 HTML 1개로 검증: 빌드 결과 == 원본과 동일 동작

### Phase 2: 검증기 (1~2일)
1. `validate/schema.json` 작성
2. `validate/validate.js` 구현 (48+ 체크포인트)
3. 기존 HTML 3개에서 데이터 수동 추출 → JSON → 검증 → 빌드 → 비교

### Phase 3: 마이그레이션 도구 (2~3일)
1. `scripts/extract-data.js` 구현
2. 860개 HTML → JSON 자동 추출
3. 전체 검증 실행
4. 실패 파일 수동 수정

### Phase 4: 전환 (1일)
1. `engine/build-all.js` 구현
2. 전체 빌드 실행
3. 기존 HTML과 비교 검증
4. GitHub Pages 배포 전환

---

## 15. 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| FULL_PASSAGE 변수 참조 추출 실패 | 마이그레이션 누락 | eval 기반 추출 + 수동 확인 |
| 템플릿 리터럴 내 특수문자 | JSON 파싱 실패 | 이스케이프 처리 로직 |
| 기존 HTML 간 미세한 엔진 차이 | 빌드 결과 불일치 | 최신 엔진 기준 통일 (차이 로그 기록) |
| CDN 장애 시 폰트/html2canvas 로드 실패 | 사용자 경험 저하 | fallback 폰트 지정 (현재와 동일) |
| dist/ 경로 변경 시 기존 URL 깨짐 | 학생 접속 불가 | Option B 채택 시 기존 경로 유지 |

---

## 16. 검증 완료 기준

파이프라인이 "완성"되었다고 판단하는 기준:

1. `node engine/build-all.js` 실행 시 860개 전체 빌드 성공 (S/A 등급 0건)
2. 빌드된 HTML이 현재 HTML과 기능적으로 동일 (render-test.js 통과)
3. 새 테스트 JSON 작성 → 검증 → 빌드 → 배포가 5분 이내 완료
4. 엔진(CSS/JS) 수정 → 전체 재빌드 → 배포가 1분 이내 완료
5. Agent가 JSON만 생성하면 되므로 HTML 직접 수정 실수 원천 차단
