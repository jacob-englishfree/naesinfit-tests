# 워크북 테스트 출제 Agent 프롬프트 템플릿

**사용법**: Agent 호출 시 `{{var}}` 자리를 채워서 전달.

---

내신핏 테스트 출제 파이프라인 실행. **{{subject}}** 출제 대상: **{{path}}** / 유형: **워크북**.

## 작업 파일
- 프롬프트: `{{promptPath}}` (prompt.json)
- 본문: `{{passagePath}}` (fullPassage)
- 참고 PASS 템플릿: `{{referencePath}}`
- 같은 지문 단어 (cross-leak 회피): `{{vocabPath}}`

## 절차 (STEP A~D 전부 이행 필수 — 단어 템플릿과 동일 구조)

### STEP A: 출제
1. prompt.json + fullPassage + 단어.json + 참고 읽기
2. `워크북.response.json` 작성 (배점 100, ans 1-based, 5회↑/3연속 금지)
3. `cd /Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests && node create-test.js --assemble {{responsePath}}`
4. FAIL 시 수정 후 재실행 (최대 5회)

### STEP B: 블라인드
5. `node validate/blind-solve.js {{testPath}}`
6. 20문항 직접 풀이 → `워크북.blind.json` / 20/20 일치

### STEP C: Cross-blind
7. `node cross-blind.js --prep {{testPath}}`
8. `워크북.cross-blind.json` 작성 (포맷: `{"testFile":"...","solves":[...]}`)
9. `node cross-blind.js --verify {{testPath}}` → PASS

### STEP D: 적대적 공격
10. `워크북.adversarial.json` 저장. HIGH 있으면 재출제 후 STEP A~C 재실행

## 유형 화이트리스트 (워크북)
내용이해/T-F/빈칸추론/어법/문장삽입/오류찾기/서술형/주제/제목/요지/함축/지칭/일치불일치
(심경/도표/안내문/광고문 **금지**)

## S급 금지 11종 0건 필수

## 원칙
- 모의/부교재는 passage = fullPassage 통째 + overlay만 명시
- wa/blank는 fullPassage 정확 substring (한 글자 변형 금지)
- 마커(①~④) fullPassage 전체 분산
- cross-leak: 단어.json의 정답·선지와 겹치지 않게 (유형/접근각 분리)

## 서술형 stem 규칙
- 단어 수 조건 명시: "(N단어)"
- 한국어 단서 구체화 (S-MISSING-KOREAN 회피)
- "본문에서 찾아" 유형은 정답 노출 허용 (EX-2 예외)
- wa의 단어 수와 stem 단어 수 정확히 일치 (S-WORDCOUNT-MISMATCH)

## 조건영작 규칙
- [조건] (1)에 wa의 모든 단어 명시 (a/an/the/and/to 등 기능어 포함) — S-COND-WORD-MATCH
- 보기 토큰은 알파벳순 셔플

## 완료 조건
- [ ] validate ALL PASS (S/A급 0)
- [ ] blind 20/20
- [ ] cross-blind 20/20
- [ ] adversarial HIGH 0건

## 보고 (250자)
- STEP A~D 결과 / 이슈 / 경로 5개
