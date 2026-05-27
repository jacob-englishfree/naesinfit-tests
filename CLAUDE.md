# 내신핏 테스트 출제/검수/수정 규칙

> 이 파일은 테스트 관련 작업 시에만 로드됩니다.
> 글로벌 규칙은 `~/.claude/CLAUDE.md` 참조.

---

## ⛔ 모델 자가진단 (출제/검수/수정 작업 시작 전 1순위 실행)

1. 현재 모델이 **claude-sonnet** 계열이면:
   - 출제/검수/수정 작업 전체를 `Agent(model: 'opus')`로 **즉시 위임**
   - Sonnet은 결과 수령 + jacob 보고 역할만 담당
   - **"Sonnet이 직접 출제/검수했습니다" 보고 절대 금지**

2. 현재 모델이 **claude-opus** 계열이면:
   - 자가진단 통과 → 직접 진행

> 이 규칙은 jacob이 매번 확인하지 않아도 자동 적용됩니다.
> 위임 없이 Sonnet이 직접 출제/검수한 결과물은 미완료로 간주합니다.

---

<!-- SYNC-RULES-START -->

> **아래 섹션은 `question-schema.json`에서 자동 생성됩니다. 직접 수정하지 마세요.**
> 규칙 추가/수정: `naesinfit-tests/validate/question-schema.json` → `node scripts/sync-rules.js`

### 자동 생성 규칙 (schema 기준)

- 총 문항: 20문항, 총점: 100점
- 쉬움: 5문항 × 4점 = 20점
- 보통: 10문항 × 5점 = 50점
- 어려움: 5문항 × 6점 = 30점
- ans: 1-based (1,2,3,4), 최대 동일번호 5개, 최대 연속 2개

### 모의고사 특수 규칙

- 짧은 지문(18, 19, 20, 26번): **순서배열, 문장삽입, 어순배열** 금지
- 출제 제외 번호: 25, 27, 28번

### 유형별 규칙

| 유형 | passage | overlay | 비고 |
|------|---------|---------|------|
| (A)(B)(C) 조합형 | source별 상이 | overlay.abc = { "A": ["원문단어","오답단어"], "B |  |
| 문맥상 부적절한 어휘 | source별 상이 | overlay.markers = { "①": "원문단어", "②": "원 |  |
| 빈칸 어휘 완성 | source별 상이 | overlay.blank = "빈칸으로 만들 단어/구" (fullPass |  |
| 빈칸 문맥 완성 | source별 상이 | overlay.blank = "빈칸으로 만들 단어/구" (fullPass |  |
| 동의어 고르기 | source별 상이 | overlay.underline = "밑줄칠단어" (fullPassage |  |
| 반의어 고르기 | source별 상이 | overlay.underline = "밑줄칠단어" (fullPassage |  |
| 다의어 문맥적 의미 | ALL: (A)(B) 두 문맥 각 2~3문장 + <u>target</u> | overlay = {} (passage는 스크립트가 아닌 AI가 직접 작 |  |
| 영영풀이 매칭 | ALL: passage 없음 (빈 문자열) | overlay = {} (passage 없음) |  |
| 어형 변환 | ALL: 2~4문장만 (fullPassage에서 발췌 허용). _____ | overlay.excerptSentences = "2~4문장 발췌 (__ |  |
| 어법 | source별 상이 | overlay.markers = { "①": "원문단어", "②": {  |  |
| 내용이해 T/F | source별 상이 | overlay = {} (passage는 스크립트가 fullPassage | 워크북 전용. 퀴즈(예상문제) 사용 금지 |
| 내용 일치/불일치 | source별 상이 | overlay = {} |  |
| 주제 | source별 상이 | overlay = {} |  |
| 함축의미 추론 | source별 상이 | overlay.underline = "비유표현/관용구" (fullPass |  |
| 지칭추론 | source별 상이 | overlay.underline = "대명사" (fullPassage에  |  |
| 오류찾기 | ALL: 4~5문장 (번호 마커 포함) | overlay.markers = { "①": { "find": "원문", |  |
| 서술형 — 핵심단어 | source별 상이 | overlay = {} |  |
| 서술형 — 조건영작 | source별 상이 | overlay.blank = "빈칸으로 만들 문장/구" (passage의 | 조건 단어 수 > wa 단어 수이거나, 조건에 wa에  |
| 어순배열 | source별 상이 | overlay.blank = "빈칸으로 만들 문장/구" (passage에 | 짧은 지문(모의고사 18~20, 26번) 사용 금지 |
| 순서배열 | 도입문 1~2문장 + (A)(B)(C) 각 2~3문장 | overlay = {} | 짧은 지문(모의고사 18~20, 26번) 사용 금지 |
| 문장삽입 | fullPassage + (①)(②)(③)(④) 위치 마커 | overlay.insertionMarkers = [문장인덱스1, 문장인덱 | 짧은 지문(모의고사 18~20, 26번) 사용 금지 |

### validate S급 차단 규칙

- **0**: A6: 정답 분포 한 번호 5개 초과
- **1**: S-LENGTH-BIAS: 정답 길이가 오답 평균의 2.5배 이상
- **2**: S-CH-TRUNCATED: 선지 미완결 단어 잘림
- **3**: S-META-LEAK: passage에 출제 메타텍스트 노출
- **4**: S-PREFIX-DOMINANT: 4선지 중 3개+ 동일 prefix
- **5**: S-CIRCULAR-STEM: 서술형 wa가 stem에 노출
- **6**: S-MISSING-KOREAN: 한국어 단서 누락
- **7**: S-WORDCOUNT-MISMATCH: 단어수 조건 vs wa 불일치
- **8**: S-MARKER-LEAK: 무관 유형에 마커 노출
- **9**: S-PASSAGE-NOT-FULL: 부교재/모의고사 passage 85% 미만
- **10**: S-WA-IN-PASSAGE: 서술형 wa가 passage에 노출 (찾기 유형 제외)
- **11**: S-COND-WORD-MATCH: 영작 [조건]에 wa 단어 누락
- **12**: S-WRITTEN-TOKEN-LEAK: 영작 보기 토큰 정답순 나열
- **13**: S-PASSAGE-1-SENTENCE: passage 5문장 미만
- **14**: S-TYPE-CONTENT-MISMATCH: type과 ch 패턴 불일치
- **15**: TW-TYPE: 테스트 종류별 허용 유형 위반
- **16**: TW-BAN: 금지 유형 사용 (심경변화, 도표, 안내문 등)
- **17**: X42: ans와 det 불일치
- **18**: RENDER-MARKER-MISSING: 마커형 ch인데 passage에 마커 없음

### 금지 목록

- C1: 교과서 원문 전체를 passage에 넣기
- C2: 마커 없는 빈칸/부적절/어법
- C3: 번호만 있고 단어 없는 선지
- C4: 더미 선지
- C5: 5지선다
- C6: 정답이 passage에 노출
- C7: 뻔한 오답만
- C9: 문법포인트 없는 어법
- C10: accept 변형 1개만
- C12: passage와 무관한 문제
- C13: 빈칸형 passage 2~3문장
- C14: 어순배열 4~5단어
- C22: 단순 암기형 영작

<!-- SYNC-RULES-END -->

---

## ⛔ 8단계 SOP (절대 우회 금지)

**상세 SOP: `~/Desktop/영어해방공식&내신핏/naesinfit-tests/TEST-SOP.md` 필수 참조**

```
STEP 0: 원문 확보 (글자 단위 정확성)
STEP 1: 출제 (가이드라인 준수)
STEP 2: 구조 검증 (validate 60체크 + auto-fix)
STEP 3: 블라인드 풀이 (정답 가리고 20문항 직접 풀기 — 풀이 근거 필수)
STEP 4: 정답 대조 (Solver 답 vs 출제 정답 — 불일치 시 재출제)
STEP 5: 적대적 공격 (오류 찾기 역할 — 모호한 문항 폐기)
STEP 6: 자동 검증 (validate + fulltext + scoring)
STEP 7: 증적 리포트 출력 (리포트 없으면 배포 차단)
STEP 8: jacob 확인 후 배포
```

**핵심 규칙:**
- STEP 3에서 **20문항 전부 풀이 + 근거** 출력 필수. "전부 맞았습니다" 한 줄 보고 금지.
- STEP 3에서 **정답(ans/wa)을 보지 않고** 풀이. 정답 보고 풀이하면 의미 없음.
- STEP 4에서 **1건이라도 불일치** → 해당 문항 수정 후 STEP 3부터 재실행.
- STEP 5에서 **정답 2개 가능, 선지 뻔함, 정답 노출** 발견 시 폐기 + 재출제.
- STEP 7 **증적 리포트 없이 배포 절대 금지**.
- 이전 세션 결과 맹신 금지 — **새 세션에서는 재검증 필수**.

**금지 사항:**
- HTML 직접 편집 절대 금지 → pre-commit hook이 차단
- dist/ 직접 수정 절대 금지 → pre-commit hook이 차단
- `--no-verify` 절대 금지
- validate FAIL인 상태로 배포 절대 금지
- "나중에 고치겠다"며 FAIL 무시 절대 금지

---

## 출제 절대 원칙 — passage 필수 + 정답 노출 규칙 (2026-04-08 강화)

**모든 출제(모의고사 + 교과서 + 부교재)에 공통 적용. 학생이 본문 문맥을 보고 풀 수 있어야 함.**

### A. passage 필수 원칙
- **모든 mc + 서술형 문항에 passage 필수** (학생이 문맥 보고 판단)
- 예외 (passage 없어도 OK):
  - 영영풀이 매칭 (영영 정의 자체가 stem)
  - 다의어 문맥적 의미 (A)(B) 두 미니 문장만으로 OK
- 한영 번역 유형도 passage 필수 (본문 단서 활용)

### B. 정답 노출 규칙 (케이스별)
- **빈칸 어휘/추론**: 본문 흐름 유지 + 빈칸 자리만 `____`. 본문 다른 곳에 정답 단어가 자연스럽게 등장하는 건 OK (학생이 흐름 보고 추론). **단, 빈칸 바로 옆 5단어 이내 정답 직접 노출 금지** (시각적 베끼기 차단).
- **본문에서 찾기 유형**: 정답 단어 본문에 그대로 OK (찾기 본질). stem에 "본문에서 찾아 쓰시오" 명시 필수.
- **함축의미 추론**: 밑줄 구절(`<u>...</u>`) 본문 그대로 OK (밑줄 대상 표시 필수).
- **어법/어휘 (부적절)**: 밑줄 표시된 단어 그대로 OK.
- **내용일치/주제/제목 (한국어 선지)**: 본문 표현 직역 금지. 패러프레이즈 필수.
- **한영 번역**: passage 있되 영어 정답 단어 자리만 `____`로 가림. 한국어 단서 + 본문 다른 단어를 보고 추론.

### C. passage 길이 원칙 (2026-04-09 전면 개정)

**⛔ 모의고사/부교재**: passage = **fullPassage 통째** + 그 문항 고유 마커/빈칸/(A)(B)(C)/<u>밑줄</u>만 해당 위치에 오버레이. **발췌 절대 금지**. 학생은 항상 원문 전체 맥락에서 푼다.

**교과서**: 기존 발췌 유지 (1과 본문이 너무 길어서). passage = 단원 본문에서 5문장 이상 발췌, 짧은 지문은 전체.

**예외 (모의/부교재에서도 발췌 유지)**:
- **어형변환**: 2~4문장 권장 (정답 단어 노출 방지, V74)
- **영영풀이 매칭**: 정의 기반, passage 불필요
- **문장단위 어법** (`①My name...` 형식, `<u>` 없음): 4문장 paraphrase라 splice 불가

**유형별 오버레이**:
- 동의어/반의어/다의어/T-F/일치/주제/제목/요지/함축/지칭: fullPassage 그대로 + `<u>` 보존
- (A)(B)(C) 조합형: fullPassage + 3자리 `<b>(A)</b>[X / Y]`
- 어법 (밑줄찾기): fullPassage + 4-5자리 `①②③④⑤<u>...</u>` (단조증가 순서)
- 부적절 어휘: fullPassage + 4-5자리 마커
- 빈칸 어휘/추론: fullPassage + `____` 빈칸
- 문장삽입: fullPassage + `(①)~(⑤)` 위치 마커
- 서술형 영작: fullPassage + 정답 자리 `____`
- 서술형 찾기: fullPassage 그대로 (정답 노출 의도)

**validate 강제**: `S-PASSAGE-NOT-FULL` — 모의/부교재 mc passage가 fullPassage 85% 미만이면 차단.

**⛔ 마커/빈칸 분산 원칙 (2026-04-09 추가)**: 오버레이(마커/빈칸/`<u>`/`(A)(B)(C)`)는 fullPassage **전체에 골고루 분산**. 한쪽에 몰리면 학생이 일부만 읽고 풀 수 있어 풀 패시지 의미 없음.
- 어법 ①②③④: 본문 처음/중간/뒤에 분산 (한 문단에 4개 몰림 금지)
- 부적절 어휘 ①②③④⑤: 본문 전체 분산
- (A)(B)(C) 조합형: 본문 앞/중간/뒤 각 1개씩
- 빈칸 어휘/추론: 문맥 추론 핵심 위치 (중간~후반 권장)
- 무관문장/문장삽입: 본문 전체에 후보 위치
- 함축/지칭 `<u>`: 문맥 해석에 핵심인 위치 (도입부 회피)
- 출제 시 의식적으로 분산. 검수 시 마커 클러스터링 발견 → 재출제

### D. 적용 범위
- **모의고사**: passage = 해당 번호의 fullPassage
- **교과서**: passage = 단원 본문 (1과 본문, Read More, Further Reading 등)
- **부교재**: passage = 강별 지문 (수능특강 등)
- **출제 유형/규칙/검수 기준은 동일**, fullPassage 출처만 다름
- **차이는 ei.subject/pub/lesson 메타데이터뿐**

### E. 검수 시 11종 체크리스트 + passage 체크 추가
- 위 11종 + "모든 mc/서술형에 passage 있는가?" + "빈칸 자리 옆 정답 직접 노출 없는가?" 같이 검사

### F. 빈칸 출제 단어 선택 원칙 (2026-04-08 추가)
**빈칸은 학생이 본문 문맥으로 추론 가능한 단어만 선택. 단순 암기형 폐기.**

✅ 추론 가능 (출제 가능):
- 동사 (행동/상태): plant, divide, join, take 등
- 형용사: beautiful, colorful, special, required 등
- 핵심 명사 (주제어): manager, teams, weather, community 등
- 연결사: however, therefore, but, so 등
- 어휘 (반의/동의): 본문 흐름으로 추론 가능

❌ 출제 금지 (단순 암기형):
- 숫자 (날짜 13, 가격 $100, 시간 9 a.m. 등)
- 고유명사 (사람 이름, 지명, 회사명 등)
- 특정 사실 (요일, 색깔, 단순 정보 등 본문 외 단서 0인 것)

**판단 기준:** 학생이 본문 단서만으로 답을 떠올릴 수 있는가? 떠올릴 수 없으면 단순 암기 → 폐기.

### G. 영작 [조건] 모든 단어 명시 (2026-04-08 추가, S-COND-WORD-MATCH)
**서술형 영작 stem의 [조건]에 wa의 모든 단어를 빠짐없이 명시.**

✅ 올바른 예:
```
[조건] (1) plant, flowers, small, trees, and를 모두 사용
       (2) 정확히 5단어로 쓸 것
정답: plant flowers and small trees
```

❌ 잘못된 예 (and 빠짐 → 학생이 5단어 못 만듦):
```
[조건] (1) plant, flowers, small, trees를 모두 사용
       (2) 5단어로 쓸 것
정답: plant flowers and small trees
```

**규칙:**
- wa를 split해서 각 단어가 [조건] (1)에 모두 나와야 함
- 기능어(a, an, the, and, or, to, of, is, are 등)도 빠짐없이 명시
- validate.js의 S-COND-WORD-MATCH가 자동 차단

### I. 3-Tier 하이브리드 출제 시스템 (2026-04-15 확정)

**모든 출제는 이 룰 따른다. 메모리 `feedback_hybrid_test_creation_3tier.md` 참조.**

**Tier 1 — Generation:**
- Sonnet 4.6 (90%): 단어/워크북/평이한 퀴즈/교과서/모의 18-40번/부교재 표준
- Opus 4.6 (10%): 함축의미·다의어·모의 41-45번·새 교재 첫출제

**Tier 2 — Cross-Model Validation (필수):**
- Sonnet 출제 → Opus blind-solve로 검증
- Opus 출제 → Sonnet blind-solve로 검증
- 답 1개라도 불일치 → flag → 재출제 또는 검토
- 명령: `node create-test.js --cross-blind <test.json>` 또는 cross-blind.js

**Tier 3 — 시각 + Spot Check:**
- 배포 전 `validate-render.js --all --screenshot`
- `npm run verify` (인앱 브라우저 7종)
- jacob 무작위 5% 직접 풀이

**자동 escalation:** validate FAIL 3회 → Opus 전환. cross-blind 불일치 → Opus 재출제.

**효과:** Opus 100% 대비 35% 비용 + 99% 품질.

### H. 채점 NORM 자동 정규화 — case 조건 절대 금지 (2026-04-15 추가)
**서술형 채점은 production index.html + 검수.html 둘 다 NORM 자동 정규화:**
- `.trim()` + 공백 1개로 압축 + 끝 구두점(.!?,;:'\"`) 제거 + 하이픈→공백 + 소문자
- 학생이 `Network connections matter` / `network-connections-matter` / `NETWORK CONNECTIONS MATTER.` 어떻게 써도 정답

**⛔ stem에 case/마침표 조건 절대 금지:**
- ❌ "(N) 필요시 첫 글자는 대문자로 쓸 것"
- ❌ "(N) 마침표를 붙일 것"
- ❌ "(N) 첫 글자는 소문자로"

**⛔ accept 배열에 case/마침표 변형 수동 추가 금지:**
- ❌ `accept: ["X", "x", "X.", "x."]`
- ✅ `accept: ["X"]` 또는 의미적 변형(동의어/축약/패러프레이즈)만 추가

**조건은 의미 있는 것만:** 단어 목록(모든 토큰), 단어 수, 어순/구문 제약

**Why:** 잭 결정. 채점이 NORM 자동 처리하므로 case 조건은 무의미한 노이즈.
**관련 변경:** validate.js F10-B/F10-D 제거, create-test.js accept≥3 강제 제거.

### J. 퀴즈(예상문제) 난이도 기준 (2026-05-27 확정)

**퀴즈 = 내신 예상문제 수준. 워크북/단어보다 반드시 어렵게 출제.**

**난이도 위계:** 단어(쉬움) → 워크북(중간) → 퀴즈(어려움)

**퀴즈 전용 기준 (워크북과 차별):**
- 서술형: 찾기형 최소 7단어 문장완성 / 조건영작 최소 6단어 + 구문활용(By+동명사, 관계사, 가주어 등)
- 빈칸추론: 단어 1개 금지, 구절/표현 단위(2단어+) 필수
- 어법 어려움: 복합 문법 포인트 (계속적용법, 분사구문, 가주어/진주어)
- 내용일치/불일치: 패러프레이즈된 선지, 세부 정보 교차 검증
- 함축의미/주제/요지: 영어 선지 권장
- 지칭추론: 2문장 이상 떨어진 간접 지칭

### K. 해설(det) 3단계 기준 (2026-05-27 확정)

**단어 해설:** det.analysis에 단어 뜻 + 용례. 간결하게.
**워크북 해설:** det.analysis에 문법 규칙명 + 원문 인용. 중간 상세도.
**퀴즈 해설:** det.analysis에 이그잼포유 수준 풀 해설:
- 영어 선지 → 한국어 번역(괄호) 필수
- → 본문: 원문 인용 + 왜 맞는지/틀린지
- 서술형은 구문 분석 (주어+동사+목적어, 품사 변형)
- 선지마다 줄바꿈(\n\n)으로 분리

**validate 자동 차단 (2026-05-27 추가):**
- S-STEM-UL-MISMATCH: stem "밑줄 친 X" → passage `<u>` 범위가 X 포함 필수
- S-EN-CHOICE-NO-KR: 영어 선지 → det.analysis 한국어 최소 20자
- S-DET-NO-LINEBREAK: mc 4선지 → det.analysis 줄바꿈 최소 3개

**참고본:** `~/.claude/projects/-Users-woobumpark/memory/reference_quiz_det_standard.md`

---

## 출제 절대 금지 11종 (S급 — 즉시 차단, 2026-04-08 추가)

**모든 출제/검수 시 아래 11종 사고는 즉시 차단. validate.js S-XXX 코드로 자동 검사. 위반 = 배포 금지.**

1. **S-META-LEAK**: passage/stem/ch에 출제 메타텍스트 노출 금지
2. **S-PREFIX-DOMINANT**: 4선지 중 3개 이상 동일 prefix(10자+) 시작 금지
3. **S-CIRCULAR-STEM**: 서술형(written)에서 wa(영어)가 stem에 그대로 노출 금지
4. **S-MISSING-KOREAN**: stem "다음 우리말에 맞도록"인데 한국어 단서 누락 금지
5. **S-WORDCOUNT-MISMATCH**: stem "(N단어)" 조건과 wa 단어 수 일치 필수
6. **S-CH-TRUNCATED**: ch 미완결 단어 잘림 금지
7. **S-MARKER-LEAK**: passage에 ①②③④⑤ 출제 마커가 무관 유형에 노출 금지
8. **S-TYPE-CONTENT-MISMATCH**: type 라벨과 실제 ch 패턴 일치 필수
9. **S-PASSAGE-1-SENTENCE**: 모든 mc passage 5문장 이상 (영영풀이 제외)
10. **S-WA-IN-PASSAGE**: 서술형 wa가 passage에 그대로 노출 금지 (찾기 유형 예외)
11. **S-LENGTH-BIAS**: 정답 길이가 오답 평균의 2.5배 이상 금지

**근본 원칙:**
- validate PASS = 형식 통과일 뿐, 출제 정상 보장 아님
- 사고 1건 발견 = validate 규칙 1개 추가 의무
- 자동 fix < 재출제 — 의심되면 재출제. 땜질 금지.
- 검수 위계: validate → AI/메인 블라인드 → 메타 검수 → 시각 검수 → 학생 신고

**출제 후 자가 검증 체크리스트 (출제 시 의무):**
1. 메타텍스트 노출 0건 확인
2. 4선지 동일 prefix 0건
3. stem에 wa 영어 그대로 노출 0건
4. 한국어 단서 (해당 시) 충분
5. 단어 수 조건 vs wa 일치
6. ch 잘림 0건
7. passage 마커 잔여 0건
8. type vs ch 패턴 일치
9. passage 5문장 이상
10. 정답이 passage에 직접 노출 안 됨 (찾기 유형 제외)
11. 자기 정의 stem 없음

---

## 유형 화이트리스트 (TW)
- **금지**: 심경, 심경변화, 도표, 안내문, 광고문
- **단어**: 동의어/반의어/영영풀이/빈칸어휘/(A)(B)(C)/부적절/다의어/어형변환/한영
- **워크북**: 내용이해/T/F/빈칸추론/어법/문장삽입/오류찾기/서술형 등
- **퀴즈**: 순서배열/문장삽입/어순배열/어법/빈칸추론/서술형 등
- 목록에 없는 유형 → S급 FAIL → 배포 차단

---

## 자동 출제 파이프라인 (create-test.js --assemble)
**테스트 출제 시 반드시 이 파이프라인 사용. 수동 JSON 작성 금지.**

```
STEP 1: 프롬프트 생성
  node create-test.js --source <교과서|부교재|모의고사> --path <경로> --type <단어|워크북|퀴즈>
  → .prompt.json 생성 (슬롯+overlay규칙+validate규칙+fullPassage 포함)

STEP 2: AI 판단 (에이전트가 .prompt.json 읽고 판단만 출력)
  → .response.json 저장 (stem/ch/ans/overlay/det만. passage 복붙 금지)

STEP 3: 자동 조립+검증
  node create-test.js --assemble <response.json 경로>
  → passage 자동 주입 + overlay 적용 + validate + blind-solve 한 번에 실행
  → PASS 시 .json + .blind.json 출력
```

**핵심 원칙:**
- AI는 판단만 (타겟단어, 오답선지, 해설), 스크립트가 JSON 조립
- overlay.markers: 마커형(어법/부적절/오류) 반드시 4개, find/display 형식 지원
- overlay.blank: 빈칸형 반드시 존재, fullPassage에 있는 단어
- 교과서: excerptRange로 발췌, overlay 단어는 발췌 범위 내에서만 (자동 확장 있음)
- 다의어: AI가 passage 직접 작성 (유일한 예외)
- 스키마: `validate/question-schema.json` (유형별 슬롯+배점+규칙 단일 진실 소스)

### 검수 명령어
- `npm run validate:all` — 4단 전체 검증
- `npm run deploy -- data/.../단어.json` — 검증+배포 원스톱
- `node validate/validate-render.js --all --screenshot` — 스크린샷 포함
- `node create-test.js --status data/.../단어.json` — SOP 6단계(response/json/blind/cross-blind/adversarial/report) 이행 여부 체크리스트
- `STRICT_GATE=true node deploy-json.js <경로>` — 증적 artifact 없으면 배포 차단 (cross-blind + adversarial + _audit-report.md 필수)

### Agent 프롬프트 템플릿 (프롬프트 직접 작성 금지)
**반드시 아래 파일을 사용하고 변수만 치환**. 매 세션 프롬프트 새로 쓰면 SOP 단계 누락 재발 위험:
- `prompts/agent_vocab.md` — 단어 테스트 출제 (STEP A~D 전부)
- `prompts/agent_workbook.md` — 워크북 테스트 출제
- `prompts/agent_quiz.md` — 퀴즈 테스트 출제
- `prompts/agent_cross_blind.md` — Tier 2 교차검증 풀이 (반대 모델)
- `prompts/agent_adversarial.md` — STEP 5 적대적 공격 검수

### 재발 방지 문서
- `guardrails/POSTMORTEM-2026-04-15-sop-skipped.md` — SOP 건너뛴 사고 & 재발 방지 구조

### 배포 게이트 (2026-04-16 추가)
`deploy-json.js`가 각 test.json에 **`.blind.json` + `.cross-blind.json` + `.adversarial.json` + `_audit-report.md`** 4종 artifact 존재를 확인. adversarial.json의 HIGH 이슈가 남아 있으면 차단. `STRICT_GATE=true` 환경변수 또는 `--strict-gate` 플래그로 강제 차단 활성화.

### 문항번호별 유형 규칙
- **출제 제외**: 25번(도표), 27~28번(안내문)
- **짧은 지문 (18~20, 26번)**: 순서/삽입/어순배열 금지
- **중간 지문 (21~24, 29~34번)**: 빈칸 추론 강화, 문장삽입은 길이에 따라
- **긴 지문 (35~40번)**: 전 유형 가능
- **장문 (41~45번)**: 전 유형 가능

### 퀴즈 순서
순서/삽입 FIRST → 어법/어휘 SECOND → 서술형/내용/TF LAST

### 배점
총점 = 정확히 100 (쉬움4×5=20, 보통5×10=50, 어려움6×5=30)

---

## ⛔ 부교재 출제 필수 체크리스트 (2026-04-19 추가, 절대 위반 금지)

> **사고 경위**: 올림포스독해기본1 출제 시 "전체"만 만들고 개별 지문(1번/2번/3번) 테스트 누락 + textbooks.ts path 미등록 + catalog 미생성 = 학생에게 테스트 안 뜸. 3중 누락 사고.

### STEP 0: 지문 구조 파악 (출제 전 1순위 — 코드 한 줄 쓰기 전에)
- **본문분석 PDF 전 페이지 확인** (Analysis + 1번/2번/3번/... 끝까지)
- 지문 수 확정 후 보고: "이 강은 Analysis + 1번 + 2번 + 3번 = 4개 지문"
- **⛔ 첫 5페이지만 보고 "1개 지문"이라고 판단 금지**
- 올림포스, 수능특강 등 부교재는 강당 여러 지문이 있는 게 정상

### 개별 지문 테스트 = 필수
- 각 지문(Analysis/1번/2번/3번)별로 단어/워크북/퀴즈 **전부** 출제
- **⛔ "전체"만 만들고 끝내면 절대 안 됨**
- "전체" = 해당 강 모든 지문 합쳐서 출제하는 종합 테스트

### test-deploy.ts sections
- sections에 개별 지문 + 전체 전부 등록
- 예: `{ "4강": ["Analysis","1번","2번","3번","전체"] }`
- **⛔ sections가 `["전체"]`만 있으면 개별 지문 테스트 누락 의심**

### textbooks.ts path 필수
- SUPPLEMENTS에 `path` 필드 반드시 확인
- **⛔ path 없으면 generate-catalog.js가 해당 교재를 스킵 → 앱에 안 뜸**
- 새 부교재 추가 시 path 필드 반드시 포함

### 배포 완료 전 필수 실행
```bash
# 1. shared 동기화
bash naesinfit-shared/sync.sh

# 2. catalog 재생성
node scripts/generate-catalog.js

# 3. 3곳 push
git push (naesinfit-tests + naesinfit-app + ehg-academy)

# 4. 실제 확인 (push 후 1~2분 대기)
# naesinfit-tests.vercel.app에서 해당 교재 펼쳐서 개별 지문 보이는지 확인
# "push 했으니 됐겠지" 금지 — 직접 웹에서 확인
```
