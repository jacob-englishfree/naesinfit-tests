# 퀴즈 테스트 출제 Agent 프롬프트 템플릿

**사용법**: Agent 호출 시 `{{var}}` 자리를 채워서 전달.

---

내신핏 테스트 출제 파이프라인 실행. **{{subject}}** 출제 대상: **{{path}}** / 유형: **퀴즈**.

## 작업 파일
- 프롬프트: `{{promptPath}}`
- 본문: `{{passagePath}}`
- 참고 PASS 템플릿: `{{referencePath}}`
- cross-leak 회피: `{{vocabPath}}`

## 절차 (STEP A~D, 단어/워크북 템플릿과 동일 구조)

### STEP A: 출제
1. prompt + fullPassage + 단어.json + 참고 읽기
2. `퀴즈.response.json` 작성
3. `node create-test.js --assemble {{responsePath}}` 
4. FAIL 시 재실행

### STEP B/C/D: blind → cross-blind → adversarial (워크북 템플릿과 동일 명령어)

## 유형 화이트리스트 (퀴즈)
순서배열/문장삽입/어순배열/어법/빈칸추론/주제/제목/요지/함축/지칭/서술형
(**내용이해 T/F 금지** — 워크북 전용)
(심경/도표/안내문/광고문 **금지**)

## 문제 순서
순서/삽입 FIRST → 어법/어휘 SECOND → 서술형/내용 LAST

## 짧은 지문 제한 (모의고사 18~20, 26번만 해당)
순서배열/문장삽입/어순배열 금지

## S급 금지 11종 0건 필수 + 퀴즈 특유
- 어순배열 wa 8~15 단어 (S-WORDORDER-RANGE)
- 순서배열: 도입 1~2문장 + (A)(B)(C) 각 2~3문장
- 문장삽입: fullPassage + `(①)~(⑤)` 위치 마커

## 완료 조건
- [ ] validate ALL PASS (S/A급 0)
- [ ] blind 20/20
- [ ] cross-blind 20/20
- [ ] adversarial HIGH 0건

## 보고 (250자)
- STEP A~D / 이슈 / 경로
