# Audit Report: 단어 테스트
- **교재**: ReadingPower유형편완성 16강 Ex01
- **검수일**: 2026-06-04
- **검수자**: Claude Opus 4.6 (Cross-Blind + Adversarial)

## 1. Cross-Blind 결과
| 항목 | 값 |
|------|-----|
| 총 문항 | 20 |
| 일치 | 20 |
| 불일치 | 0 |
| **일치율** | **100% (20/20)** |

### 불일치 문항
없음.

### 참고
- Q18(어형변환): pick="advertising", wa="advertising-soaked". accept 배열에 "advertising" 포함되어 실질 일치.

## 2. Adversarial Review 결과
| 심각도 | 건수 |
|--------|------|
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |

### MEDIUM 이슈
- **Q18 (AMBIGUOUS-WA)**: wa가 advertising-soaked이나 학생이 advertising을 답할 가능성. accept에 포함되어 채점 문제 없음.

### LOW 이슈
- Q3: traced vs attributed 유사성 — 원문 기준 traced 확정
- Q15: 영향력 vs 권한 구분 미묘 — det 해설 충분

## 3. 구조 검증
- 총점: 100점 (쉬움4x5=20 + 보통5x10=50 + 어려움6x5=30) ✅
- 문항수: 20문항 ✅
- ans 분포: 정상 ✅
- fullPassage: 원문 완전 ✅

## 4. 판정
**PASS** — 배포 가능. HIGH 이슈 0건, cross-blind 100% 일치.
