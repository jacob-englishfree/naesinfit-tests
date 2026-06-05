# Audit Report: ReadingPower유형편완성 14강 Pr03 단어

- Date: 2026-06-04
- Solver: claude-opus-4-6

## Summary
- Total: 20 questions, 100 points
- Distribution: easy 5x4=20, normal 10x5=50, hard 5x6=30
- Answer distribution: {1:5, 2:3, 3:5, 4:5}
- Validate: PASS (0 S-errors, 11 B-warnings)
- Blind: 20/20 match
- Cross-blind: 20/20 match
- Adversarial: 0 HIGH, 3 LOW

## Type Breakdown
| # | Type | Diff | Pts | Ans |
|---|------|------|-----|-----|
| 1 | (A)(B)(C) 조합형 | easy | 4 | 1 |
| 2 | (A)(B)(C) 조합형 | normal | 5 | 4 |
| 3 | (A)(B)(C) 조합형 | hard | 6 | 4 |
| 4 | 부적절 어휘 | easy | 4 | 2 |
| 5 | 부적절 어휘 | easy | 4 | 4 |
| 6 | 부적절 어휘 | normal | 5 | 3 |
| 7 | 빈칸 어휘 | easy | 4 | 1 |
| 8 | 빈칸 어휘 | normal | 5 | 3 |
| 9 | 빈칸 어휘 | normal | 5 | 4 |
| 10 | 동의어 | easy | 4 | 1 |
| 11 | 동의어 | normal | 5 | 2 |
| 12 | 동의어 | normal | 5 | 3 |
| 13 | 반의어 | normal | 5 | 1 |
| 14 | 반의어 | hard | 6 | 3 |
| 15 | 다의어 | hard | 6 | 3 |
| 16 | 영영풀이 | normal | 5 | 2 |
| 17 | 어형변환 | normal | 5 | written |
| 18 | 어형변환 | hard | 6 | written |
| 19 | 빈칸 문맥 | normal | 5 | 4 |
| 20 | 빈칸 문맥 | hard | 6 | 1 |

## B-level Warnings (non-blocking)
- EX-3 Q1/Q2/Q3: ABC 정답 단어 지문 다른 곳 노출 (ABC 유형 특성상 불가피)
- EX-1 Q8: commitment 지문 노출 (빈칸 뒤 반복 등장, 문맥 추론 목적)
- C20: histKey pattern mismatch (metadata, 기능 무관)
- P2 Q1/Q15/Q18: passage 앞부분 불일치 (ABC/다의어/어형변환 유형 특성)
- Q6 Q7/Q8/Q9: 오답이 fullPassage에 없음 (본문 어휘 제한으로 외부 오답 사용)
