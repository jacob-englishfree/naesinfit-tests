# 9강 출제 완료 보고서

## 대상
- **교재**: 올림포스 영어독해 기본1 (2025)
- **단원**: Chapter 3-09 (어휘 적절성)
- **지문**: Analysis + 1번 + 2번 + 3번 + 전체

## 원문 PDF
`올림포스 영어독해 기본 1 수록 원문(2025) Chapter 3-09 본문분석.pdf` (22p)

## 지문 구조
| 지문 | 제목 | 문장수 | 단어수 |
|------|------|--------|--------|
| Analysis | When a Star Performer Becomes a Boss | 7 | 136 |
| 1번 | The Scarcity of Time and Human Choice | 9 | 157 |
| 2번 | Environmental Stress and Genetic Selection | 9 | 153 |
| 3번 | Relative Wealth and Happiness | 8 | 148 |
| 전체 | 종합 (4개 합본) | 33 | 594 |

## 출제 현황 (15세트, 300문항)

| 테스트 | Analysis | 1번 | 2번 | 3번 | 전체 | 소계 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| 단어 | 20 | 20 | 20 | 20 | 20 | 100 |
| 워크북 | 20 | 20 | 20 | 20 | 20 | 100 |
| 퀴즈 | 20 | 20 | 20 | 20 | 20 | 100 |
| **소계** | 60 | 60 | 60 | 60 | 60 | **300** |

## SOP 이행 (15세트 전부)

| 단계 | 상태 |
|------|------|
| STEP 0: 원문 추출 + fullPassage 대조 | PASS |
| STEP 1: 출제 (create-test.js --assemble) | 15/15 PASS |
| STEP 2: 구조 검증 (validate) | 15/15 PASS (S급 0건) |
| STEP 3: 블라인드 풀이 | 15/15 (300/300 일치) |
| STEP 4: 정답 대조 | 15/15 (불일치 0건) |
| STEP 5: 적대적 공격 | 15/15 (HIGH 0건) |
| STEP 6: 자동 검증 | 15/15 PASS |
| STEP 7: 증적 리포트 | 본 문서 |

## 배점 (전 세트 동일)
- 쉬움 5문항 x 4점 = 20점
- 보통 10문항 x 5점 = 50점
- 어려움 5문항 x 6점 = 30점
- **총점: 100점**

## 검증 요약
- validate S급 에러: **0건** (전 15세트)
- blind 일치율: **300/300** (100%)
- cross-blind 일치율: **300/300** (100%)
- adversarial HIGH: **0건** (전 15세트)

## 출제일
2026-06-08

## 출제 모델
- Generation: Claude Opus 4.6
- Cross-validation: Claude Sonnet 4.6
