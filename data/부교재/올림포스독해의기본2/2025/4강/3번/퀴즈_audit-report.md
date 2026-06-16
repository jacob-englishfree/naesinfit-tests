# Audit Report: 올림포스독해의기본2 2025 4강 3번 퀴즈

## Summary
- **문항수**: 20 (mc 15 + written 5)
- **총점**: 100 (쉬움 5x4=20, 보통 10x5=50, 어려움 5x6=30)
- **ans 분포**: {1:3, 2:4, 3:4, 4:4} — max 4, max consecutive 2
- **validate**: PASS (0 errors, 2 B-level warnings)
- **blind solve**: 20/20 match
- **adversarial**: PASS — 0 HIGH issues

## Validate Warnings (non-blocking)
- C20: histKey auto-generated pattern
- P2: Q1 passage starts with overlay markers (expected)

## Question Summary
| ID | Type | Diff | Pts | Ans | Key Point |
|----|------|------|-----|-----|-----------|
| 1 | 어법 | 쉬움 | 4 | 2 | was/were 수일치 |
| 2 | 어법 | 보통 | 5 | 3 | which can be revealed → reveal (능동/수동) |
| 3 | 어법 | 어려움 | 6 | 4 | had worked out and warning → had warned (과거완료 병렬) |
| 4 | 부적절 | 보통 | 5 | 4 | obviously → subtly |
| 5 | 부적절 | 어려움 | 6 | 2 | unconscious → conscious (report와의 논리) |
| 6 | 빈칸추론 | 보통 | 5 | 1 | far more profitable than others |
| 7 | 빈칸추론 | 보통 | 5 | 1 | far quicker than their conscious minds |
| 8 | 내용일치 | 쉬움 | 4 | 3 | four decks of cards |
| 9 | 내용불일치 | 보통 | 5 | 2 | 10번→50번 숫자 혼동 |
| 10 | 내용불일치 | 보통 | 5 | 4 | 피부전도도 의식 이전/이후 |
| 11 | 주제 | 보통 | 5 | 4 | 무의식 패턴 감지 |
| 12 | 주제/제목 | 어려움 | 6 | 3 | When Your Body Knows... |
| 13 | 함축의미 | 어려움 | 6 | 2 | They knew before they knew |
| 14 | 지칭 | 쉬움 | 4 | 3 | them = participants |
| 15 | 지칭 | 보통 | 5 | 1 | their behaviour = gamblers' card patterns |
| 16 | 서술형 | 쉬움 | 4 | - | worked out what was happening far quicker |
| 17 | 서술형 | 보통 | 5 | - | some of the piles were far more profitable than others |
| 18 | 핵심단어 | 어려움 | 6 | - | warning them against the bad decks after just ten turns |
| 19 | 조건영작 | 쉬움 | 4 | - | as much money as they could |
| 20 | 조건영작 | 보통 | 5 | - | the electrical conductance of their skin |

## Cross-file Check
- 워크북과 동일 blank/wa: 없음 (3건 수정 완료)
- 워크북과 동일 문법 포인트: 없음 (Q3 수정 완료)

## SOP Completion
- [x] STEP 1: 출제
- [x] STEP 2: validate PASS
- [x] STEP 3: blind solve 20/20
- [x] STEP 4: 정답 대조 ALL MATCH
- [x] STEP 5: adversarial PASS
- [x] STEP 6: validate PASS (final)
- [x] STEP 7: audit report (this file)
- [ ] STEP 8: jacob 확인 후 배포
