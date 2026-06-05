# Audit Report: ReadingPower유형편완성 / 16강 / 전체 — 단어

**생성일**: 2026-06-04
**검증 모델**: claude-opus-4-6

## 1. Validate 결과
- **PASS** (S급 에러 0건)

## 2. Cross-Blind 결과
- 일치: 19/20 (95.0%)
- 불일치: 1건

### 불일치 문항
- Q10: pick=2, actual=1 — estimate = approximate (synonym). Ch2 = approximate.

## 3. Adversarial 결과
- HIGH: 1건
- MEDIUM: 0건
- LOW: 1건

- [HIGH] Q10: X42-ANS-DET-MISMATCH — ans=1(establish) but det says approximate is correct. ans should be 2.
- [LOW] Q0: NO-CRITICAL — 나머지 문항은 양호.

## 4. 문항 구성
- 총 문항: 20, 총점: 100
- 쉬움: 5문항 × 4점 = 20점
- 보통: 10문항 × 5점 = 50점
- 어려움: 5문항 × 6점 = 30점
- 정답 분포: {"1":5,"2":4,"3":5,"4":4}

### 유형 분포
- (A)(B)(C) 조합형: 3문항
- 문맥상 부적절한 어휘: 3문항
- 빈칸 어휘 완성: 3문항
- 동의어 고르기: 3문항
- 반의어 고르기: 2문항
- 다의어 문맥적 의미: 1문항
- 영영풀이 매칭: 1문항
- 어형 변환: 2문항
- 빈칸 문맥 완성: 2문항

## 5. 최종 판정
**FAIL — Q10 ans/det 불일치 수정 필요**
