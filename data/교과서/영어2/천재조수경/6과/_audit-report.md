# 증적 리포트 — 영어2 천재조수경 6과 Read More ("AI in Cinema Industry")

- 작업: Read More 퀴즈(예상문제) 테스트 신규 출제 (판매교안급 난이도, 4지선다 유지)
- 지문: 12문장 짧은 지문 → fullPassage 통째 사용(excerptRange 전 문항 [0,11]). 교과서라 모의고사 짧은지문 제한(순서/삽입/어순배열 금지) 미적용
- 검수 위계: validate(S/A급) → 자체 블라인드 20/20 → cross-blind(Sonnet 반대모델) 20/20 → adversarial HIGH 0

## 게이트 결과

| 파일 | validate | self-blind | cross-blind(Sonnet) | adversarial |
|---|---|---|---|---|
| Read More/퀴즈 | PASS (S/A 0) | 20/20 | 20/20 | HIGH 0, total 0 |

- 총점 100 / 20문항 / 배점분포 쉬움5(4점)·보통10(5점)·어려움5(6점)
- mc(15) ans 분포 {1:4, 2:4, 3:4, 4:3} — 한 번호 최대 4개(<5), 연속 중복 0

## 유형 믹스 (실전 시험지처럼 골고루)
- 어법(Q1~3): 쉬움/보통/어려움 — 마커 4개 중 1개 오류. 오류 위치 회전(③/②/①). 포인트: 분사 후치수식 vs 동사(ranging), 분사구문 수동(provided), 사역동사 make+원형부정사(come)
- 문맥상 부적절한 어휘(Q4~5): 보통/어려움 — 반의·문맥역전(delays↔accelerates, altered↔maintained)
- 빈칸추론(Q6·7·15): 전부 2단어 이상 구/표현(accelerates the process / the addition or removal of wrinkles / varied facial expressions) — S-QUIZ-BLANK-SINGLE 회피
- 내용 일치/불일치(Q8~10): 패러프레이즈 선지, 오답 3개는 세부(속도·과정·자동화)를 미묘히 역전
- 주제(Q11)·제목(Q12): 영어 선지 + det에 각 선지 한국어 해석(S-EN-CHOICE-NO-KR 충족)
- 함축(Q13, come alive)·지칭(Q14, this technique): 한국어 선지, 간접 지칭(먼 선행 대상)
- 서술형(슬롯 고정): Q16 조건영작 / Q17 어법고쳐쓰기 / Q18 조건영작 / Q19 어순배열 / Q20 조건영작 — 전부 자동채점 안전형(조건영작·어순배열·어법고쳐쓰기). 찾기·핵심단어형 배제(S-QUIZ-WRITTEN-SAFE-TYPE)

## 주요 수정 이력 (adversarial 반영 — 2회 재출제)
- **Q20(HIGH, 1차)**: 원안 "It was then trained to learn how faces change as people age" → 부사 then 문두 이동('Then it was trained...')이 문법 동급인데 accept 미포함 = 억울오답 위험. **이동가능 부사가 없는 SVO 문장** "the program can manipulate the facial changes of actors"로 교체
- **Q19(HIGH, 2차)**: 원안 "the AI program generates different facial images at different ages" → 문장끝 부사구 'at different ages' 문두전치가 여전히 성립. **부사구 자체가 없는 문장** "the newly developed automatic program accelerates the process"로 교체 → 대안 배열 원천 차단
- **Q9(MEDIUM)**: 정답(불일치) 선지의 '전혀'라는 절대표현이 소거 단서가 됨 → "기존 기술도 복잡한 과정 없이 비슷한 결과를 낼 수 있었다"로 순화(사실 왜곡 = required an extensive process 제거). 절대부정 없이 미묘한 오류로 변별력 확보

## 잔여 B급 경고 (배포 비차단)
- P2(Q1): 마커 <u> 태그가 passage 앞부분에 삽입되어 발생하는 오탐. 실제 passage 텍스트는 fullPassage 원문과 정확히 일치 확인
- Q6-WEAK-DISTRACTOR(Q6·Q15): 빈칸추론 오답 선지가 fullPassage 밖 표현. 빈칸추론(문맥추론) 특성상 정당한 오답이며 [B] 권장 수준

## 원문 무결성
- fullPassage = _passage.json 원문 그대로. 모든 overlay 마커 find 단어·빈칸 substring·underline이 fullPassage 내 유일 매칭 확인
- 서술형 wa 전부 passage 빈칸 처리(정답 노출 없음). [조건] 단어 = wa 토큰과 1:1(중복 the 포함) 일치

배포 승인: 전 게이트 통과 (validate S/A급 0, self-blind 20/20, cross-blind 20/20, adversarial HIGH 0).

---
