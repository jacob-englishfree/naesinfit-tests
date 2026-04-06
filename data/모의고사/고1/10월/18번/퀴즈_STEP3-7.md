# 18번 퀴즈 STEP 3~7 증적 리포트

원문: 2025년 10월 고1 모의 18번 (Lomos Tours Letter), 정답 ②(글의 목적)
파일: data/모의고사/고1/10월/18번/퀴즈.json (20문항, 100점)

---

## STEP 3 — 블라인드 풀이 (정답 가린 채)

| Q | 유형 | 풀이 | 근거 |
|---|---|---|---|
| 1 | 어법(쉬움) | ③ including | plan to + 동사원형(include) |
| 2 | 어법(보통) | ④ willingly | be + 형용사 → willing |
| 3 | 어법(어려움) | ② invaluably | be + 형용사 보어 → invaluable |
| 4 | 부적절어휘(쉬움) | ③ exclude | 광고에 valued client 포함 취지와 모순(→include) |
| 5 | 부적절어휘(보통) | ③ worthless | 부탁 글에서 피드백 가치 격하 모순(→invaluable) |
| 6 | 부적절어휘(어려움) | ② rudely | 정중한 비즈니스 요청과 모순(→kindly) |
| 7 | 빈칸(보통) | ④ valued | most valued clients = 광고 후보 |
| 8 | 빈칸(어려움) | ① invaluable | feedback would be invaluable in helping |
| 9 | 일치(쉬움) | ③ Mr.Kelly 지난여름 여행 | "Since you traveled with us last summer" |
| 10 | 불일치(보통) | ② 본인이 직접 연락 | 회사가 먼저 연락("we will be in touch") |
| 11 | 주제(쉬움) | ④ 후기 공유 요청 | 글 전체 요지 |
| 12 | 목적(보통) | ① 후기 작성 부탁 | "ask if you would be willing to share" |
| 13 | 함축 invaluable(보통) | ② 홍보에 결정적 도움 | helping us promote our services |
| 14 | 지칭 you(어려움) | ③ Mr.Kelly | Dear Mr. Kelly 수신인 |
| 15 | 제목(보통) | ④ Request to Share Travel Experience | 핵심 요지 |
| 16 | 서술형 | experience | share a few words about your experience |
| 17 | 서술형(매우귀중 형용사) | invaluable | 원문 직접 단어 |
| 18 | 영작(연락하다 3단어) | be in touch | will be in touch with you |
| 19 | 영작(air 형태) | airing | will be airing |
| 20 | 영작(appreciate 명사) | appreciation | I express our sincere appreciation |

## STEP 4 — 정답 대조

20/20 풀이 정답과 json.ans 일치.
다만 **ans 인덱스 vs passage 마커 정렬 오류** 2건 발견:

- **Q4**: passage ①appreciation ②promotional ③exclude ④invaluable, 정답 exclude=③. 기존 ch=[appreciation,exclude,promotional,invaluable], ans=2 → 학생 화면에는 ans=2가 promotional로 표시되어 **오답**. ch 재정렬 + ans=3으로 수정.
- **Q6**: passage ①promotional ②rudely ③promote ④touch, 정답 rudely=②. 기존 ch=[rudely,promotional,promote,touch], ans=1 → 학생 화면에는 ans=1이 promotional로 표시. ch 재정렬 + ans=2로 수정.

Q1/Q2/Q3/Q5는 ch 순서가 passage 마커와 일치, 이상 없음.

## STEP 5 — 적대적 검토

- **Q16 정답 노출 경고**: stem `share his ___ as a customer` + 원문 `share a few words about your experience` 어휘 그대로 노출 우려. **stem을 패러프레이즈로 수정**:
  변경: `Mr. Smith wants Mr. Kelly to talk about what happened during his trip — in other words, his __________ with Lomos Tours.`
- 복수정답/뻔함/모호: 없음
- 정답 시퀀스 편향: 없음

## STEP 6 — validate 재실행

`npm run validate -- data/모의고사/고1/10월/18번/퀴즈.json`
결과: **[PASS] (7 warnings)** — B급 권장사항만(SCHEMA-CH-MARKER, SCHEMA-TF-DET, RENDER-ANS-NOT-UNDERLINED), S/A급 0건.

## STEP 7 — 결론

수정 3건 적용 후 PASS 확정. 배포 가능 상태(jacob 확인 대기).
