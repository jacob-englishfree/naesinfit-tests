# Audit Report: 고2/11월_2021/35번 퀴즈

## Summary
- **Date**: 2026-06-14
- **Model**: claude-opus-4-6
- **Questions**: 20문항, 총점 100점
- **배점**: 쉬움 5x4=20, 보통 10x5=50, 어려움 5x6=30
- **ans 분포**: {1:2, 2:4, 3:5, 4:4}

## SOP Steps
- [x] STEP A: 출제 (response.json → assemble → quiz.json)
- [x] STEP B: 블라인드 풀이 20/20
- [x] STEP C: 크로스블라인드 20/20
- [x] STEP D: 적대적 검수 HIGH 0건
- [x] STEP 6: validate PASS (S급 0, A급 0, B급 5 warnings)

## Validate Result
```
[PASS] 퀴즈.json (5 warnings)
  [B] C20: histKey pattern
  [B] P2: Q2,Q3,Q5 passage overlay
  [B] Q6-WEAK-DISTRACTOR: expected for 빈칸추론
```

## Question Types
| ID | Type | Diff | Pts | Ans |
|----|------|------|-----|-----|
| 1 | 어법 | 쉬움 | 4 | 2 |
| 2 | 어법 | 보통 | 5 | 3 |
| 3 | 어법 | 어려움 | 6 | 4 |
| 4 | 부적절 어휘 | 보통 | 5 | 3 |
| 5 | 부적절 어휘 | 어려움 | 6 | 4 |
| 6 | 빈칸추론 | 보통 | 5 | 2 |
| 7 | 빈칸추론 | 보통 | 5 | 3 |
| 8 | 내용 일치 | 쉬움 | 4 | 2 |
| 9 | 내용 일치 | 보통 | 5 | 1 |
| 10 | 내용 불일치 | 보통 | 5 | 4 |
| 11 | 주제 | 보통 | 5 | 3 |
| 12 | 주제 | 어려움 | 6 | 2 |
| 13 | 함축의미 | 어려움 | 6 | 4 |
| 14 | 지칭추론 | 쉬움 | 4 | 1 |
| 15 | 지칭추론 | 보통 | 5 | 3 |
| 16 | 서술형 찾기 | 쉬움 | 4 | written |
| 17 | 서술형 찾기 | 보통 | 5 | written |
| 18 | 서술형 핵심단어 | 어려움 | 6 | written |
| 19 | 조건영작 | 쉬움 | 4 | written |
| 20 | 조건영작 | 보통 | 5 | written |

## N7 Cross-leak Check
워크북 wa: cognitive biases, individual human reasoning, social interactions, arriving at timeless truths
퀴즈 wa/blank: 모두 다른 표현 사용 → N7 위반 없음
