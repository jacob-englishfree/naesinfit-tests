# Audit Report: YBM(김은형) 공통영어1 3과 본문

**일시**: 2026-05-21
**출제자**: Opus 4.6
**검수자**: Opus 4.6 (self + cross-blind)
**원문**: Why Fashion Needs to Be More Sustainable

---

## 단어 테스트 (단어.json)

| 항목 | 값 |
|------|-----|
| 문항 수 | 20 |
| 총점 | 100 |
| 배점 분포 | 쉬움 5x4=20, 보통 10x5=50, 어려움 5x6=30 |
| ans 분포 | {1:5, 2:4, 3:5, 4:4} |
| validate | PASS (B-level 경고 9건, S급 0건) |
| blind | 20/20 일치 |
| cross-blind | 20/20 일치 |
| adversarial | HIGH 0, MEDIUM 0, LOW 3 |
| 유형 | ABC 3, 부적절 3, 빈칸어휘 3, 동의어 3, 반의어 2, 다의어 1, 영영 1, 어형변환 2, 빈칸문맥 2 |

---

## 워크북 테스트 (워크북.json)

| 항목 | 값 |
|------|-----|
| 문항 수 | 20 |
| 총점 | 100 |
| 배점 분포 | 쉬움 5x4=20, 보통 10x5=50, 어려움 5x6=30 |
| ans 분포 | {1:3, 2:5, 3:5, 4:3} |
| validate | PASS (B-level 경고 12건, S급 0건) |
| blind | 20/20 일치 |
| cross-blind | 20/20 일치 |
| adversarial | HIGH 0, MEDIUM 0, LOW 1 |
| 유형 | 어법 4, 어휘 2, T/F 3, 빈칸추론 2, 일치/불일치 2, 오류찾기 1, 서술형 2, 핵심단어 1, 주제/요지 2, 조건영작 1 |

---

## 퀴즈 테스트 (퀴즈.json)

| 항목 | 값 |
|------|-----|
| 문항 수 | 20 |
| 총점 | 100 |
| 배점 분포 | 쉬움 5x4=20, 보통 10x5=50, 어려움 5x6=30 |
| ans 분포 | {1:3, 2:5, 3:4, 4:3} |
| validate | PASS (B-level 경고 7건, S급 0건) |
| blind | 20/20 일치 |
| cross-blind | 20/20 일치 |
| adversarial | HIGH 0, MEDIUM 0, LOW 0 |
| 유형 | 어법 3, 부적절 2, 빈칸추론 2, 일치/불일치 3, 주제 2, 함축의미 1, 지칭추론 2, 서술형 2, 핵심단어 1, 조건영작 2 |

---

## Cross-leak 확인

- 단어 ↔ 워크북: 동일 정답+passage 조합 없음
- 단어+워크북 ↔ 퀴즈: 동일 정답+passage 조합 없음
- 퀴즈에 T/F 유형 없음 (금지 준수)

## 결론

3개 테스트 모두 validate PASS, blind 20/20, cross-blind 20/20, adversarial HIGH 0건.
배포 가능.
