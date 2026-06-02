# Audit Report: 수능특강 영어 27강 2번 단어

- **Date**: 2026-06-02
- **Source**: 부교재 / 수능특강/영어/27강/2번
- **TestType**: 단어
- **Version**: 5
- **histKey**: wordTest_suneung_27_ex2_v5

## Summary
- Total: 20 questions, 100 points
- Easy 5 x 4pt = 20pt
- Normal 10 x 5pt = 50pt
- Hard 5 x 6pt = 30pt
- Ans distribution: {1:5, 2:4, 3:5, 4:4}
- Max consecutive same ans: 2

## Validate
- Result: **PASS** (0 S-errors, 6 B-warnings)
- B-warnings: EX-1 (Q7 suburbs exposure, acceptable), P2 x5 (overlay-modified passages)

## Blind Solve (STEP 3)
- Solver: claude-opus-4-6
- Match: **20/20 (100%)**

## Cross-Blind (Tier 2)
- Solver: claude-opus-4-6-cross
- Match: **20/20 (100%)**

## Adversarial (STEP 5)
- HIGH issues: **0**
- LOW issues: 3 (Q7 answer exposure LOW, Q18 difficulty LOW, Q20 choice-length LOW)
- Verdict: **PASS**

## Question Types
| # | Type | Diff | Pts | Ans |
|---|------|------|-----|-----|
| 1 | (A)(B)(C) 조합형 | 쉬움 | 4 | 2 |
| 2 | (A)(B)(C) 조합형 | 보통 | 5 | 1 |
| 3 | (A)(B)(C) 조합형 | 어려움 | 6 | 3 |
| 4 | 문맥상 부적절한 어휘 | 쉬움 | 4 | 3 |
| 5 | 문맥상 부적절한 어휘 | 쉬움 | 4 | 1 |
| 6 | 문맥상 부적절한 어휘 | 보통 | 5 | 4 |
| 7 | 빈칸 어휘 완성 | 쉬움 | 4 | 4 |
| 8 | 빈칸 어휘 완성 | 보통 | 5 | 2 |
| 9 | 빈칸 어휘 완성 | 보통 | 5 | 1 |
| 10 | 동의어 고르기 | 쉬움 | 4 | 3 |
| 11 | 동의어 고르기 | 보통 | 5 | 4 |
| 12 | 동의어 고르기 | 보통 | 5 | 2 |
| 13 | 반의어 고르기 | 보통 | 5 | 3 |
| 14 | 반의어 고르기 | 어려움 | 6 | 4 |
| 15 | 다의어 문맥적 의미 | 어려움 | 6 | 1 |
| 16 | 영영풀이 매칭 | 보통 | 5 | 1 |
| 17 | 어형 변환 | 보통 | 5 | characterized |
| 18 | 어형 변환 | 어려움 | 6 | decentralization |
| 19 | 빈칸 문맥 완성 | 보통 | 5 | 2 |
| 20 | 빈칸 문맥 완성 | 어려움 | 6 | 3 |
