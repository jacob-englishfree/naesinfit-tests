# 올림포스 9대변별 실전모의 2회 — 단어 테스트 검수 리포트

- 대상: 부교재 / 올림포스9대변별실전모의 / 2회 / 전체 / **단어**
- 재출제 사유: P07(156)·P08(157) 2개 지문 추가 → 8지문 전체 재분산 출제
- 작성일: 2026-11-25

## 구성
- 총 20문항 / 100점 (쉬움 5×4=20, 보통 10×5=50, 어려움 5×6=30)
- ans 분포: {1:5, 2:4, 3:5, 4:4} (동일번호 최대 5개, 3연속 없음)

## 지문별 분산 (8지문 전체 커버)
| 지문 | 문항 | 수 |
|---|---|---|
| P01 | 4, 13 | 2 |
| P02 | 5, 12 | 2 |
| P03 | 6, 14 | 2 |
| P04 | 2, 11 | 2 |
| P05 | 7, 20 | 2 |
| P06 | 8, 17 | 2 |
| **P07(156)** | **1, 10, 18** | **3** |
| **P08(157)** | **3, 9, 19** | **3** |
| standalone | 15(다의어), 16(영영풀이) | 2 |

→ P07·P08 각 최소 2문항 요건 충족 (각 3문항).

## 검수 결과 (STEP A~D)
- **STEP A validate: PASS** — S급 0, A급 0 (B급 경고 8건: EX-3/P2/Q6-WEAK-DISTRACTOR = 비차단)
- **STEP B 블라인드: 20/20 일치** (자체 풀이, 단어.blind.json)
- **STEP C 교차 블라인드: 20/20 일치** (반대 모델 Sonnet 독립 풀이, 단어.cross-blind.json / --verify PASS)
- **STEP D 적대적 공격: HIGH 0건** (totalIssues 1 = MEDIUM, 단어.adversarial.json)
  - MEDIUM(Q17): 어형변환 ingenious→ingenuity, 희귀 변형 'ingeniousness' 미채점 우려 → accept 배열에 추가 반영 완료

## 유형 규칙 위반 여부
- 반의어(Q13 thriving↔declining, Q14 grisly↔pleasant): 진짜 반의어 + 동의어 함정 + off-axis 오답 구성, prefix 조작 없음 → 규칙 준수
- (A)(B)(C) 조합형(Q1·2·3): 마커 전부 passage 내 존재, 지문 ABC 순서 정합
- 서술형(어형변환 Q17·18): 단일 정답, 빈칸 자리 품사/문법 명확

## 산출 파일
- data/부교재/올림포스9대변별실전모의/2회/전체/단어.json (배포용)
- 단어.response.json / 단어.blind.json / 단어.cross-blind.json / 단어.adversarial.json
