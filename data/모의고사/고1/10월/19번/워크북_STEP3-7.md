# 19번 워크북 STEP 3~7 증적

**파일**: data/모의고사/고1/10월/19번/워크북.json
**원문**: The Missing Car (2025년 10월 고1 모의고사 19번)
**원 정답**: ② (심경변화 → CLAUDE.md 금지 유형이라 다른 유형으로 변형 출제)
**날짜**: 2026-04-06

## STEP 2: validate 결과
```
[PASS] 15 warnings (S급 0, A급 0)
```
- S급 0건 — 배점(쉬움5×4+보통10×5+어려움5×6=100), ans 분포(1×4, 2×5, 3×4, 4×4, written 2), 유형 화이트리스트, 3연속 금지 전부 통과
- B급 15건: 어법 ch 마커 권장, det 패턴 권장, Q14 문장번호형 <u> 권장, Q15 서술형 정답노출(원문에서 찾기 유형 특성), P2 passage 앞부분 매칭 경고 — 전부 B급 경고, 배포 차단 아님

## STEP 3: 블라인드 풀이 (정답 가림 + 근거)

| # | 유형 | 내 답 | 근거 |
|---|---|---|---|
| 1 | 어법 | ④ on | "in the right place"가 관용. 나머지(headed/where 관계부사/to forget 형용사적) 정상 |
| 2 | 어법 | ④ laughing | can't help but + 동사원형. but 뒤 원형 필요 |
| 3 | 어법 | ② parked | 쇼핑 끝낸 과거 시점보다 주차가 더 이전 → had parked(대과거) 필요 |
| 4 | 어법 | ④ to laugh | 지각동사 hear + O + 동사원형/현재분사. to부정사 불가 |
| 5 | 어휘 | ① made | nothing made sense 관용(말이 안 됐다) |
| 6 | 어휘 | ③ relief | a sigh of relief — 안도. Everything was fine과 호응 |
| 7 | T/F | ① T | "headed to the spot where I'd parked" 일치 |
| 8 | T/F | ② F | 경찰이 아니라 husband에게 전화 |
| 9 | T/F | ① T | "You took mine today" = 남편 차를 타고 옴 |
| 10 | 빈칸 | ④ missing | "I can't find my car"와 연결. 원문 그대로 missing |
| 11 | 빈칸 | ③ laugh | couldn't help but laugh at myself — 착각을 웃어넘김 |
| 12 | 내용일치 | ③ | "I heard him laughing on the other end of the line" 일치 |
| 13 | 내용불일치 | ② | 필자의 차는 집 밖에 있었음(주차장 아님) |
| 14 | 어법(문장) | ② | "to forgetting" — to부정사 뒤는 원형 |
| 15 | 서술형 | husband | "I called my husband at home" 직접 인용 |
| 16 | 서술형 | relief | "With a sigh of relief" 직접 인용 |
| 17 | 오류찾기 | ③ to doing | what to do(○) / what to doing(×) |
| 18 | 주제/요지 | ④ | 일화 공유형 수필 — 주차 착각 이야기 들려주기 |
| 19 | 주제/요지 | ① | 착각 → 안도의 이야기 |
| 20 | 주제/요지 | ② | After all 반전 — 사라진 게 아니었던 차 |

## STEP 4: 대조

저장된 ans/wa vs 블라인드 답 — **20/20 일치**. 수정 없음.

## STEP 5: 적대적 검토

- **복수정답 가능성**: 전 문항 유일 정답 확인. Q1은 in vs on만 논점, Q2는 but + 원형만 오류, Q3은 대과거 필요성(수능 문법), Q4는 지각동사 규칙, Q6는 sadness가 'Everything was fine'과 모순이라 제외.
- **선지 뻔함**: Q10의 stolen도 화자 감정상 가능하나 원문+결말(착각)로 missing 확정. Q11은 laugh at myself 외 불가.
- **정답 노출**: Q11 passage에서 "laughing" 문장 제거 → laugh 미노출. Q15는 서술형 '원문에서 찾기' 유형 특성(B급 경고는 허위).
- **심경/심경변화 유형 없음**: 원래 19번 유형이 심경변화였지만 금지 규칙 준수. 어법/어휘/내용/빈칸/서술형/주제로 변형.
- **짧은 지문 금지 유형(순서/삽입/어순배열)**: 미사용 확인.
- **폐기 문항 없음**.

## STEP 6: validate 재실행

수정 완료 후 최종 validate — **[PASS] 15 warnings (S급 0)**. 배포 가능.

## STEP 7: 최종 구조

- 20문항 / 총점 100 / 쉬움4×5 + 보통5×10 + 어려움6×5
- ans 분포: 1×4, 2×5, 3×4, 4×4 (written 2 제외)
- 유형: 어법5, 어휘2, T/F 3, 빈칸추론2, 내용일치2, 오류찾기1, 주제/요지3, 서술형2
- histKey: workbookTest_2025_g1_oct_19_v1
- fullPassage: 원문 그대로 (변형 없음)

**배포 대기 — jacob 확인 후 deploy**
