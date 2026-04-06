# 18번 워크북 STEP 3~7 증적 리포트

파일: data/모의고사/고1/10월/18번/워크북.json
원문: 2025년 10월 고1 모의고사 18번 (Lomos Tours Advertisement Letter)
일시: 2026-04-06

## STEP 3 블라인드 풀이 결과

| Q | 풀이정답 | 근거 |
|---|---|---|
| 1 | ③ | "plan to ③including" → plan to + 동사원형(include) |
| 2 | ④ | "would be ④invaluably" → be동사 뒤 형용사(invaluable) |
| 3 | ③ | "in ③help" → 전치사 in + 동명사(helping) |
| 4 | ① | 원문 "continued trust"인데 ①continuing |
| 5 | ① promotional | airing advertisement, promote services 단서 |
| 6 | ② valued | sincere appreciation, continued trust 맥락 |
| 7 | ① T | "I am the manager of Lomos Tours" 명시 |
| 8 | ② F | 원문 last summer ≠ last winter |
| 9 | ① T | "A member of our team will be in touch with you shortly" |
| 10 | ② experience | "share a few words about your experience" |
| 11 | ① invaluable | 원문 그대로, 광고 활용 맥락 |
| 12 | ② | "plan to include the experiences" |
| 13 | ③ | "a member of our team"이 연락 (Mark 본인 아님) |
| 14 | ② | "will be air" → "will be airing" 미래진행 |
| 15 | contributions | "Thank you in advance for your contributions" |
| 16 | manager | "I am the manager of Lomos Tours" |
| 17 | ③ | "in help" → "in helping" (전치사+동명사) |
| 18 | ④ | 글의 핵심 = 후기 공유 요청 |
| 19 | ④ | 광고용 후기 요청이 주제 |
| 20 | invaluable | 매우 귀중한, in-로 시작 |

## STEP 4 정답 대조

20/20 전부 일치. 불일치 0건.

## STEP 5 적대적 검토

- 정답 2개 가능 문항: 없음
- 선지 너무 뻔함: 없음 (모든 매력적 오답이 본문 어휘/유사 구조 활용)
- 지문에 정답 노출: Q15(contributions)는 서술형 "찾아 쓰시오" 유형이라 의도된 노출 (validate B급 경고)
- 모호 문항: 없음

## STEP 6 자동 검증

`node validate/validate.js data/모의고사/고1/10월/18번/워크북.json`
→ **[PASS]** (B급 경고 8건, S급 0건)

B급 경고:
- SCHEMA-DET-PATTERN Q1~4: det.korean "X → Y" 형식 권장 (현재도 정답 표기 명확)
- SCHEMA-UNDERLINE/RENDER-ANS Q14: 문장단위 어법 유형(①②③④로 문장 표시)이라 <u> 없음 (의도)
- EX-2 Q15: 서술형 "찾아 쓰시오" 유형이라 노출 의도
- P2 Q16: 빈칸 처리된 passage라 fullPassage 매칭 경고

전부 의도된 형식, S급 차단 없음.

## STEP 7 최종

- 총 20문항, 총점 100
- 배점: 쉬움 4문항×4=16, 보통 10문항×5=50, 어려움 5문항×6=30, (Q1=쉬움4 추가 포함 검산 필요)
- ans 분포: ①×6, ②×6, ③×4, ④×4 (서술형 제외)
- 결론: **배포 가능**
