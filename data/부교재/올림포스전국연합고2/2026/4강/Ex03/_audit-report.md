# Ex03 퀴즈 출제/검수 증적 리포트

- 대상: 올림포스전국연합고2 2026 4강 Ex03
- 테스트: 퀴즈 (20문항 / 100점)
- 작성: 2026-04-14
- 모델: Opus 4.6 (1M context) — 단일 모델 출제 + cross-blind 자체 검증

## 본문 요약

Zagzebski의 미덕 윤리학 — 약 한 알(generosity booster)로는 진정한 미덕이 만들어지지 않는다. 미덕은 personal history와 emotional habit의 결과이며 한 번의 행위로 환원될 수 없다.

## 8단계 SOP 이행

| STEP | 항목 | 결과 |
|------|------|------|
| 0 | 원문 확보 (_passage.json) | ✅ 930자 fullPassage 확보 |
| 1 | 출제 (Opus 4.6, 단어/워크북 cross-leak 회피) | ✅ 20 decisions |
| 2 | 구조 검증 (validate) | ✅ PASS (4 warnings, S/A 0건) |
| 3 | blind solve (출제자 자체) | ✅ 20/20 일치 |
| 4 | 정답 대조 | ✅ 0 mismatch |
| 5 | adversarial 공격 검수 | ✅ HIGH/MEDIUM 0, LOW 1 (Q3 Thus 마커 약함, 비차단) |
| 6 | 자동 재검증 | ✅ validate PASS |
| 7 | 증적 리포트 (본 파일) | ✅ |
| 8 | 배포 | ⏳ Supabase update 대기 |

## 5종 artifact

- 퀴즈.response.json — 출제 판단 20개
- 퀴즈.json — 조립 + overlay 적용 + det
- 퀴즈.blind.json — 출제자 자체 blind 20/20 PASS
- 퀴즈.cross-blind.json — 학생/검수자 시점 재풀이 20/20 PASS
- 퀴즈.adversarial.json — 11종 공격 체크 (HIGH 0)

## 슬롯 구성 (prompt 고정 슬롯 준수)

| Q | 유형 | 난이도 | 점수 | ans/wa |
|---|------|--------|------|--------|
| 1 | 어법 | 쉬움 | 4 | 1 (mean→meaning 병렬) |
| 2 | 어법 | 보통 | 5 | 3 (cannot make→makes 조동사) |
| 3 | 어법 | 어려움 | 6 | 4 (how→which 관계부사) |
| 4 | 부적절어휘 | 보통 | 5 | 3 (moral→immoral) |
| 5 | 부적절어휘 | 어려움 | 6 | 4 (nontypical→typical) |
| 6 | 빈칸추론 | 보통 | 5 | 2 (action) |
| 7 | 빈칸추론 | 보통 | 5 | 4 (impulse) |
| 8 | 일치 | 쉬움 | 4 | 1 |
| 9 | 불일치 | 보통 | 5 | 2 (충동결과 X) |
| 10 | 일치 | 보통 | 5 | 3 (부분만족) |
| 11 | 주제 | 보통 | 5 | 2 |
| 12 | 요지 | 어려움 | 6 | 1 |
| 13 | 함축의미 | 어려움 | 6 | 3 (Popping a pill 비유) |
| 14 | 지칭(he) | 쉬움 | 4 | 1 (인색한 친구) |
| 15 | 지칭(They) | 보통 | 5 | 2 (virtues) |
| 16 | 서술형찾기 | 쉬움 | 4 | moral identity |
| 17 | 서술형찾기 | 보통 | 5 | change of heart |
| 18 | 어순배열 | 어려움 | 6 | an emotional habit that is part of who you are |
| 19 | 조건영작 | 쉬움 | 4 | he is not really generous |
| 20 | 조건영작 | 보통 | 5 | they are part of who you are |

총점 4×5 + 5×10 + 6×5 = 100 ✓

## ans 분포 (mc 15개)

- 1: 4개 (Q1, Q8, Q12, Q14)
- 2: 4개 (Q6, Q9, Q11, Q15)
- 3: 4개 (Q2, Q4, Q10, Q13)
- 4: 3개 (Q3, Q5, Q7)
- 한 번호 ≤5 ✓ / 3연속 없음 ✓

## cross-leak 회피 (단어/워크북 vs 퀴즈)

| 영역 | 단어/워크북 사용 | 퀴즈 | 회피 |
|------|------------------|------|------|
| 어법 마커 | buying/taking/gives/who/formed/impossible/generous/booster | mean,entirely,various,Instant,receive,According,make,better,say,Thus,result,how | ✅ 0 충돌 |
| 부적절 마커 정답 | stable→unstable, satisfying→dissatisfying, personal→impersonal (단어) / stable→temporary, pleased→disappointed (워크북) | moral→immoral, nontypical→typical | ✅ |
| 빈칸 단어 | generous,stable,virtues,booster,personal_history,identity | action, impulse | ✅ |
| 영작/어순 | virtues as opposed to ... personal history (워크북 영작), Popping a pill cannot make ... (워크북 어순), a stable part of (워크북 찾기) | an emotional habit that is part of who you are, he is not really generous, they are part of who you are, moral identity, change of heart | ✅ 별개 문장 |

## passage fullPassage 100% 적용 (S-PASSAGE-NOT-FULL 체크)

모든 mc 문항 passage = fullPassage + 해당 마커/빈칸/밑줄만 오버레이. 발췌 0건. 어순배열/조건영작도 fullPassage + 해당 위치만 빈칸.

## P2 (첫 50자 매칭) 회피

모든 어법/부적절 ① 마커는 fullPassage 첫 50자(`Imagine that your usually stingy friend delights i`) 이후에 위치하도록 배치. Q1 ①=mean(168), Q2 ①=receive(135), Q3 ①=say(170), Q4 ①=kind(415), Q5 ①=Christmas(64).

## validate 결과

```
[PASS] 퀴즈.json (4 warnings)
  [B] EX-2: Q16/Q17 — 찾기 유형 정답 노출 (의도적, false positive)
  [B] C20: histKey 패턴 (메타, 비차단)
  [B] T39: Q18 어순배열 위치 (prompt 슬롯 고정, Ex04와 동일)
```

S/A급 0건. B급 4건은 모두 비차단 false positive 또는 prompt 구조에 따른 것 (Ex04 동일).

## blind / cross-blind 결과

- blind 20/20 PASS (출제자 자체 풀이)
- cross-blind 20/20 PASS (학생/검수자 시점 재풀이)
- mismatches: 0
- ambiguous: 0

## adversarial 11종 공격 검수

- HIGH: 0
- MEDIUM: 0
- LOW: 1 (Q3 ② Thus 마커는 접속부사로 어법 평가 의의 약함, 비차단)
- 정답 단일성 20/20
- prefix 조작 반의어 0건 (immoral, typical은 글 논지 검증으로 작동)
- 의미축 뭉치 오답 0건
- 배포 차단 사유 없음

## 배포 게이트 체크

- [x] 퀴즈.json
- [x] 퀴즈.blind.json
- [x] 퀴즈.cross-blind.json
- [x] 퀴즈.adversarial.json (HIGH 0)
- [x] _audit-report.md (본 파일)

## 배포 액션

- DB: contents 테이블 `assets.quiz.Ex03.has = true` 업데이트
- 학생 영향: 김리원 (w3, 4/21 화 2차 마감) 퀴즈 응시 가능

## 알림/주의

- T39 warning: Ex04와 동일한 구조이므로 prompt 슬롯 변경은 별도 작업으로 분리 권장
- EX-2 warning: validate.js의 EX-2 룰이 "찾기 유형" 예외처리 미적용 — 추후 룰 보강 후보
