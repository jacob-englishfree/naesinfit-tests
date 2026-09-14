# 37번 출제·검수 증적 리포트

**대상**: `data/모의고사/고1/10월_2024/37번` — 2024년 10월 고1 모의고사 37번 (Depression as a Problem of Consciousness)
**지문 특성**: 원래 순서배열(주어진글→(A)→(C)→(B)) 지문. fullPassage에 (A)(B)(C) 문단 라벨 상존.
**작성일**: 2026-09-13

## 최종 요약

| 테스트 | 문항 | 총점 | validate | blind | cross-blind | adversarial HIGH |
|---|---|---|---|---|---|---|
| 단어 | 20 | 100 | PASS | 20/20 | PASS (FLAG 0) | 0 |
| 워크북 | 20 | 100 | PASS | 20/20 | PASS (FLAG 0) | 0 |
| 퀴즈(예상문제) | 20 | 100 | PASS | 20/20 | PASS (FLAG 0) | 0 |

**N7 크로스파일(워크북↔예상문제 정답 중복)**: PASS (0건)
**배점 분포(전 테스트 공통)**: 쉬움 5×4=20 + 보통 10×5=50 + 어려움 5×6=30 = 100

## 특이사항 대응 — (A)(B)(C) 문단 라벨 충돌
- 이 지문은 fullPassage에 `(A)/(B)/(C)` 문단 라벨이 그대로 들어 있어, 단어 슬롯 1~3의 기본 유형인 **(A)(B)(C) 조합형**을 쓰면 `<b>(A)</b>[x/y]` 마커가 문단 라벨과 겹쳐 학생 혼란을 유발.
- 따라서 단어 1~3번을 **비마커 유형(동의어·부적절어휘·빈칸어휘)으로 오버라이드**(create-test.js decision.type 오버라이드 지원). ①②③④·`__________`·`<u>` 마커는 (A)(B)(C) 라벨과 기호가 달라 충돌 없음.
- 내용·주제·일치 문항은 논리 순서(주어진글→(A)→(C)→(B)) 기준으로 판정.

## 테스트별 상세

### 단어 (쉬움)
- 유형: 동의어(1,10,11,12) · 문맥상 부적절 어휘(2,4,5,6) · 빈칸 어휘(3,7,8,9) · 반의어(13,14) · 다의어(15) · 영영풀이(16) · 어형변환(17,18) · 빈칸 문맥(19,20)
- 정답 분포: {1:5, 2:5, 3:4, 4:4} (동일번호 ≤5, 3연속 없음)
- 어형변환 정답: functioning(the ___ of the brain, accept functions) / distortion(a ___ of ~)
- 잔여 비차단 경고: P2(마커가 문단 앞) · Q6-WEAK-DISTRACTOR(선지 일부 본문 밖 — 품질 목적의 의도적 어휘) — B급, 채점 무관

### 워크북 (중간)
- 유형: 어법(1,2,3,4,14) · 문맥 부적절 어휘(5,6) · 내용이해 T/F(7,8,9) · 빈칸추론(10,11) · 내용 일치/불일치(12,13) · 서술형 찾기(15,16) · 서술형 어형변환(17) · 주제/요지(18,19) · 서술형 조건영작(20)
- 정답 분포: {1:4, 2:5, 3:3, 4:4}
- 어법 포인트: 관계절 수일치(goes) · 현재완료 p.p.(believed) · 3인칭 단수(causes) · 재귀대명사(consciousness itself) · to부정사(to reframe)
- 서술형 정답: 찾기 neurotransmitters/revised · 어형변환 explanation · 조건영작 "the brain is no more than an organ of consciousness"

### 퀴즈(예상문제) (어려움)
- 유형: 어법(1,2,3) · 문맥 부적절 어휘(4,5) · 빈칸추론(6,7,15) · 내용 일치/불일치(8,9,10) · 주제(11) · 제목(12) · 함축의미(13) · 지칭추론(14) · 서술형 조건영작(16,18,20) · 어형변환(17) · 어순배열(19)
- 정답 분포: {1:4, 2:4, 3:3, 4:4}
- 어법 포인트(워크북과 중복 최소화): 현재완료 p.p.(lost→lose) · 부정관사 a/an(an organ) · 수동태(caused→causing)
- 주제·제목·함축 = 영어 선지(det에 각 선지 한국어 번역 병기, S-EN-CHOICE-NO-KR 충족)
- 서술형(조건영작/어형변환/어순배열만, 룰24 준수): "depression causes a decrease in brain substances" · believed · "a consciousness that has lost its sense of self" · "such a disease of consciousness may manifest itself in the form of depression" · "the imbalance of substances in the brain"

## 게이트 결과
- validate: 3/3 PASS (S/A급 0). 잔여는 전부 B급 권고(P2·WEAK-DISTRACTOR)로 채점 무관.
- 블라인드(자체): 3/3 × 20문항 = 60/60 정답 일치
- cross-blind(독립 인스턴스 재풀이): 3/3 PASS, FLAG 0
- adversarial(독립 검수): HIGH 0 (단어 low 1, 퀴즈 low 2 — 채점 무관 품질 노트)
- N7: 워크북↔예상문제 정답(wa/blank) 중복 0건

## adversarial 잔여(비차단)
- 단어 Q15: 다의어 sense 의미축 인접 — 정답 ① 유효(low)
- 퀴즈 Q17: 어형변환 believed 포인트가 워크북 어법과 인접 — 형식·정답 형태 상이(low)
- 퀴즈 Q14: 지칭 its가 같은 문장 내 지칭 — 쉬움 슬롯(4점) 적합, 정답 유일(low)
