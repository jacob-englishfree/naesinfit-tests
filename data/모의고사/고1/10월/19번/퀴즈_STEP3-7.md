# 19번 퀴즈 STEP 3~7 증적 리포트

- 파일: `data/모의고사/고1/10월/19번/퀴즈.json`
- 원문: 2025학년도 10월 고1 모의고사 19번 (The Missing Car)
- 원본 정답: ② (심경 — 출제 금지 유형이므로 퀴즈는 다른 유형으로 변형 출제)
- 생성 일자: 2026-04-06
- 총점: 100 / 문항: 20 / 분포: 쉬움 5×4=20, 보통 10×5=50, 어려움 5×6=30

## 유형 분포
- 어법 3 (1~3)
- 문맥상 부적절한 어휘 3 (4~6)
- 빈칸추론 2 (7~8)
- 내용일치/불일치 2 (9~10)
- 주제 1 (11), 대의 1 (12)
- 함축의미 추론 1 (13), 지칭추론 1 (14), 제목 1 (15)
- 서술형(찾아쓰기) 2 (16~17), 서술형 영작/어형 3 (18~20)

※ 심경/심경변화/도표/안내문/광고문 금지 유형 출제 안 함. 원문의 심경 성격을 주제/대의/함축/제목으로 변형.

## ans 분포 (mc Q1~Q15)
- 1번: 4 / 2번: 4 / 3번: 4 / 4번: 3 → 모두 ≤5 ✅
- 3연속 동일 정답 없음 ✅

---

## STEP 3 — 블라인드 풀이 (ans/wa 가리고 독립 풀이)

| Q | 내 답 | 근거 |
|---|---|---|
| 1 | ④ at | "in the right place" 관용 표현 — at은 어색 |
| 2 | ④ laughing | can't help but + 동사원형 → laugh여야 함 |
| 3 | ③ overly | 원문 "walked over to the car" — 방향 부사 over |
| 4 | ② remember | 원문 "not the kind of person to forget" — 자부 방향 반대 |
| 5 | ① cry | 원문 "laugh at myself" — 안도+자조 상황에 울다는 모순 |
| 6 | ② inside | 원문 "here outside the house" — 집 안 주차 불가 |
| 7 | ① took | 남편 차를 타고 나간 게 착각의 핵심 원인 |
| 8 | ③ relief | "a sigh of relief" 정형 표현 + fine after all |
| 9 | ① 남편에게 전화해 차가 사라졌다고 말했다 | called husband + missing 일치 |
| 10 | ② 주차 장소를 기억하지 못함 | 원문 "I knew I was in the right place" 반대 |
| 11 | ③ 남편 차 타고 나간 것 깜빡한 경험 | 글 전체 서사 |
| 12 | ① 자신의 사소한 착각을 유쾌하게 회상 | laugh at myself + fine after all |
| 13 | ④ 자조적 수용 | laugh at oneself = 자기 실수 인정 |
| 14 | ② 남편의 차 | 발화자=남편, "You took mine" |
| 15 | ③ The Missing Car That Was Never Missing | 반전 요지 |
| 16 | relief | "With a sigh of relief" |
| 17 | forget | "not the kind of person to forget" |
| 18 | laugh | "couldn't help but laugh at myself" |
| 19 | knowing | "Not knowing what to do" 분사구문 |
| 20 | parked | "where I'd parked my car" 과거완료 |

## STEP 4 — 정답 대조
- mc 15문항 + 서술형 5문항 = **20/20 전부 일치** ✅
- 불일치 0건 → 재출제 없음

## STEP 5 — 적대적 공격 (모호/복수정답/정답노출 점검)
- Q2: 선지 ②/④ 둘 다 "laughing" 표기 → 마커 ②/④로 구분 가능, ②는 지각동사 구문으로 정상 / ④만 원형 원칙 위반 → 단일 정답 성립 ✅
- Q4: 'remember' vs 'forget' → 화자 자부 방향(잊지 않는다)이 원문이므로 remember가 부적절 단일 ✅
- Q7: 대체 선지(sold/washed/parked) 맥락 불가 → took 단일 ✅
- Q14: 발화자 남편(직접인용) → "mine" = 남편 차, 화자 차 혼동 유도 선지 있으나 직전 문장 "Your car is here" 로 차단 ✅
- **폐기/재출제 0건**
- **발견·수정 사항 1건**: Q18 stem "(3단어)" ↔ 답 "laugh"(1단어) 불일치 → stem을 "(1단어)"로 수정

## STEP 6 — validate 재검증
```
[PASS] data/모의고사/고1/10월/19번/퀴즈.json (11 warnings)
```
- 에러 0건
- 경고 11건 (모두 B급): SCHEMA-CH-MARKER(어법 선지 스타일 권장), SCHEMA-DET-PATTERN(det.korean 패턴 권장), P2(passage 앞부분 탐지 실패 — 변형지문/부분발췌이므로 정상)
- **18번 퀴즈 동일 수준의 B급 경고**이며 배포 허용 범주

## STEP 7 — 배포 전 체크리스트
- [x] validate PASS
- [x] 블라인드 20/20 일치
- [x] 적대적 통과 (수정 1건 반영)
- [x] 심경/도표/안내문/광고문 없음
- [x] 짧은 지문 — 순서/삽입/어순배열 출제 안 함
- [x] 총점 100, 분포 4×5/5×10/6×5
- [x] ans 1~4 분포 ≤5, 3연속 없음
- [ ] STEP 8: jacob 확인 후 배포
