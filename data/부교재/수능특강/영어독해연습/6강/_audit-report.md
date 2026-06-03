# Audit Report: 수능특강 영어독해연습 6강 4번 단어

- Date: 2026-06-02
- Model: claude-opus-4-6
- Source: 부교재 / 수능특강/영어독해연습/6강/4번

## Summary
- Total: 20 questions, 100 points
- Distribution: Easy 5x4=20, Medium 10x5=50, Hard 5x6=30
- Ans distribution: {1:4, 2:5, 3:5, 4:4}
- Types: ABC(3), 부적절(3), 빈칸어휘(3), 동의어(3), 반의어(2), 다의어(1), 영영풀이(1), 어형변환(2), 빈칸문맥(2)

## Validate
- Result: PASS (0 S-level errors, 9 B-level warnings)
- B-warnings: EX-3(Q1-3 ABC 노출 구조적), EX-1(Q7/Q19 빈칸 원문 노출 거리 충분), C20(histKey), P2(passage 변환)

## Blind Solve
- Score: 20/20
- All answers matched

## Cross-blind
- Score: 20/20
- All answers matched

## Adversarial
- HIGH: 0, MEDIUM: 0, LOW: 6
- No blocking issues
