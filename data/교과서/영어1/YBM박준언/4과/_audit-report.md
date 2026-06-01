# Audit Report: YBM박준언 영어1 4과

## Further Reading 퀴즈 v5 (2026-06-01)

### 결과
- validate: PASS (S급 0, B급 4 warnings)
- blind: 20/20 일치
- cross-blind: 20/20 일치
- adversarial: HIGH 0, MEDIUM 0, LOW 0

### 배점
- 총점: 100점 (쉬움 4x5=20, 보통 5x10=50, 어려움 6x5=30)
- ans 분포: {1:3, 2:4, 3:5, 4:3} (최대 5개 미만, 3연속 없음)

### 유형 분포
| 유형 | 문항수 | 난이도 |
|------|--------|--------|
| 어법 | 3 | 쉬움/보통/어려움 |
| 문맥상 부적절한 어휘 | 2 | 보통/어려움 |
| 빈칸추론 | 2 | 보통/보통 |
| 내용 일치/불일치 | 3 | 쉬움/보통/보통 |
| 주제 | 2 | 보통/어려움 |
| 함축의미 추론 | 1 | 어려움 |
| 지칭추론 | 2 | 쉬움/보통 |
| 서술형 | 2 | 쉬움/보통 |
| 서술형 핵심단어 | 1 | 어려움 |
| 서술형 조건영작 | 2 | 쉬움/보통 |

### cross-leak 확인
- 단어.json: ABC조합/동의어/반의어/다의어/영영풀이/어형변환/빈칸어휘 — 중복 없음
- 워크북.json: 어법(utilized/practically/known/serving), 부적절(welcome/abundant/inside→outside), 오류(less), T/F, 빈칸(invaders/agriculture), 어순배열, 서술형(higher ground/scarce farmland/strengths/strong walls and defenses) — 중복 없음
- Q3(fewer/less)와 워크북 Q14(less/fewer) 동일 문법 포인트지만 다른 유형(어법 vs 오류찾기), 다른 발췌 범위

### B급 warnings
- C20: histKey 패턴 — 기존 히스토리 호환성 유지
- P2: Q2/Q4/Q5 passage 앞부분 — 교과서 발췌 방식으로 정상
