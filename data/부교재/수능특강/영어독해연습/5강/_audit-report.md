# Audit Report: 수능특강 영어독해연습 5강 5번 퀴즈

- Date: 2026-04-20
- Model: claude-opus-4-6
- Source: 부교재 / 수능특강/영어독해연습/5강/5번
- Type: 퀴즈
- Title: The Search for Approval and Its Pitfalls

## Summary

| Item | Result |
|------|--------|
| Total | 20문항 / 100점 |
| Easy | 5 x 4pt = 20pt |
| Normal | 10 x 5pt = 50pt |
| Hard | 5 x 6pt = 30pt |
| Ans Distribution | 1:3, 2:5, 3:2, 4:5 |
| validate | PASS (7 B-warnings) |
| blind | 20/20 |
| cross-blind | 20/20 |
| adversarial | HIGH 0 |

## Type Breakdown

| # | Type | Diff | Pts | Ans |
|---|------|------|-----|-----|
| 1 | 어법 | 쉬움 | 4 | 2 |
| 2 | 어법 | 보통 | 5 | 3 |
| 3 | 어법 | 어려움 | 6 | 1 |
| 4 | 문맥상 부적절한 어휘 | 보통 | 5 | 4 |
| 5 | 문맥상 부적절한 어휘 | 어려움 | 6 | 2 |
| 6 | 빈칸추론 | 보통 | 5 | 3 |
| 7 | 빈칸추론 | 보통 | 5 | 2 |
| 8 | 내용 일치/불일치 | 쉬움 | 4 | 1 |
| 9 | 내용 일치/불일치 | 보통 | 5 | 4 |
| 10 | 내용 일치/불일치 | 보통 | 5 | 4 |
| 11 | 주제 | 보통 | 5 | 2 |
| 12 | 주제 | 어려움 | 6 | 2 |
| 13 | 함축의미 추론 | 어려움 | 6 | 1 |
| 14 | 지칭추론 | 쉬움 | 4 | 4 |
| 15 | 지칭추론 | 보통 | 5 | 4 |
| 16 | 서술형 | 쉬움 | 4 | effectiveness |
| 17 | 서술형 | 보통 | 5 | unworthy |
| 18 | 어순배열 | 어려움 | 6 | 10 words |
| 19 | 서술형 조건영작 | 쉬움 | 4 | 3 words |
| 20 | 서술형 조건영작 | 보통 | 5 | 8 words |

## B-Level Warnings (non-blocking)

- EX-1 Q7: unconditional이 S7에 재등장 (빈칸은 S6, 다른 문장이므로 허용)
- EX-2 Q16/Q17: 찾기 유형이므로 passage 노출 의도적
- C20: histKey 패턴 (cosmetic)
- T39: 어순배열 위치 (prompt 슬롯 순서 고정)
- P2 Q1/Q4: 마커 삽입으로 passage 앞부분 변경 (정상 동작)

## Conclusion

All 20 items verified. No S/A-level issues. Ready for jacob review.
