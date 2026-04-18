# Audit Report: 올림포스독해의기본1 / 2025 / 5강 / 전체

## 단어 테스트

| 항목 | 결과 |
|------|------|
| validate | PASS (S/A 0, B 7) |
| blind | 20/20 |
| cross-blind | 20/20 |
| adversarial | HIGH 0 / MEDIUM 0 / LOW 5 |
| 문항 수 | 20 |
| 총점 | 100 |
| 배점 분포 | 쉬움 5x4=20 / 보통 10x5=50 / 어려움 5x6=30 |
| ans 분포 | 1:4 / 2:5 / 3:5 / 4:4 |

### 유형 구성
- (A)(B)(C) 조합형: 3문항 (쉬움1/보통1/어려움1)
- 문맥상 부적절한 어휘: 3문항 (쉬움2/보통1)
- 빈칸 어휘 완성: 3문항 (쉬움1/보통2)
- 동의어 고르기: 3문항 (쉬움1/보통2)
- 반의어 고르기: 2문항 (보통1/어려움1)
- 다의어 문맥적 의미: 1문항 (어려움1)
- 영영풀이 매칭: 1문항 (보통1)
- 어형 변환: 2문항 (보통1/어려움1)
- 빈칸 문맥 완성: 2문항 (보통1/어려움1)

### B-level warnings (비차단)
- EX-3 x3: ABC 정답 단어 지문 노출 — 6문장 단문 불가피
- C20: histKey 패턴 — 자동 생성
- P2 x3: 마커형/다의어/어형변환 passage 구조 차이 — 정상

### 수정 이력
- Q18: identify→reduce 변경 (A-MORPH-BASE-NOT-IN-FP 해소)
- Q19: be fond of→thereby 변경 (Q6-WEAK-DISTRACTOR 해소)
- Q20: hold down→repercussions 변경 (Q6-WEAK-DISTRACTOR 해소)
- Q8, Q15: ans 재분배 (2→1, 동일번호 5개 초과 방지)

### 검수자
- claude-opus-4-6 (출제+blind+adversarial)
- claude-opus-4-6-cross (cross-blind)
