# /create-test — 테스트 출제 원스톱

Usage: /create-test {카테고리} {경로} {유형}

예시:
- `/create-test 모의고사 고1/3월/31번 워크북`
- `/create-test 교과서 공통영어1/YBM박준언/1과/본문 단어`
- `/create-test 부교재 수능특강/영어/4강 퀴즈`

## 실행 절차 (자동, 순서 위반 금지)

### STEP 1: 원문 로드
- `data/{카테고리}/{경로}/` 폴더에서 기존 JSON의 `fullPassage` 로드
- 기존 파일이 없으면 `_passages/` 또는 같은 폴더 내 다른 유형(단어/워크북/퀴즈)에서 fullPassage 확보
- fullPassage 없으면 즉시 중단 → "원문을 먼저 등록해주세요" 안내

### STEP 2: 격리 출제
- **이 파일의 fullPassage만 사용**. 다른 번호의 파일 절대 참조 금지.
- 20문항 생성 (쉬움5×4점 + 보통10×5점 + 어려움5×6점 = 100점)
- 유형 규칙 (CLAUDE.md TW-TYPE 화이트리스트 준수)
- **어형변환**: `__________ (원형)` 포맷 강제, 2~4문장
- **어법**: passage에 ①②③④ `<u>` 밑줄 4개, ch = 밑줄 순서 일치, 1개만 문법 오류
- **서술형 영작**: passage = null (원문 노출 방지)
- **영영풀이**: passage = null

### STEP 3: validate 5단 검증
```bash
node validate/validate.js "data/{카테고리}/{경로}/{유형}.json"
```
- S/A급 0건이어야 PASS
- FAIL 시 자동 수정 → 재검증 (최대 3라운드)
- 3라운드 후에도 FAIL → 중단, 수동 개입 필요 보고

### STEP 4: 셀프 블라인드 5문항
- ans/wa/det를 가리고 랜덤 5문항 직접 풀기
- 풀이 근거 1줄씩 기록
- JSON 정답과 대조
- **1문항이라도 불일치** → 해당 문항 + 유사 유형 전체 재점검

### STEP 5: 저장 + 보고
- `data/{카테고리}/{경로}/{유형}.json` 저장
- 보고: 문항수, 총점, 배점분포, 유형별 개수, validate 결과, 블라인드 일치율

### STEP 6: (선택) 배포
- jacob이 "배포해"라고 하면 deploy-json.js 실행
- push는 jacob 승인 후에만

## 금지 사항
- 다른 번호 파일 복사(cp) 후 수정 — 절대 금지
- validate FAIL 상태로 "완료" 보고 — 절대 금지
- 셀프 블라인드 생략 — 절대 금지
- fullPassage 없이 출제 — 절대 금지
