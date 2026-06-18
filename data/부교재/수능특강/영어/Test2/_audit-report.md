# Audit Report — 수능특강/영어/Test2/2번 단어

**출제일**: 2026-06-17
**출제자**: Sonnet 4.6 (Tier 1)
**검수자**: Sonnet 4.6 Cross-blind + Adversarial

## 결과 요약

| 항목 | 결과 |
|---|---|
| validate | PASS (경고 5건 — B급, S급 0) |
| blind 20/20 | ✅ 일치 |
| cross-blind 20/20 | ✅ 일치 |
| adversarial HIGH | 0건 |
| 총점 | 100점 |
| ans 분포 | {1:4, 2:5, 3:5, 4:4} |

## 문항 구성

| 유형 | 쉬움(4pt) | 보통(5pt) | 어려움(6pt) |
|---|---|---|---|
| (A)(B)(C) 조합형 | Q1 | Q2 | Q3 |
| 문맥상 부적절한 어휘 | Q4, Q5 | Q6 | — |
| 빈칸 어휘 완성 | Q7 | Q8, Q9 | — |
| 동의어 고르기 | Q10 | Q11, Q12 | — |
| 반의어 고르기 | — | Q13 | Q14 |
| 다의어 문맥적 의미 | — | — | Q15 |
| 영영풀이 매칭 | — | Q16 | — |
| 어형 변환 | — | Q17 | Q18 |
| 빈칸 문맥 완성 | — | Q19 | Q20 |

## S급 11종 체크

- S-META-LEAK: 없음 ✅
- S-PREFIX-DOMINANT: 없음 ✅
- S-CIRCULAR-STEM: 없음 (서술형 없음) ✅
- S-MISSING-KOREAN: 없음 ✅
- S-WORDCOUNT-MISMATCH: 없음 ✅
- S-CH-TRUNCATED: 없음 ✅
- S-MARKER-LEAK: 없음 ✅
- S-TYPE-CONTENT-MISMATCH: 없음 ✅
- S-PASSAGE-1-SENTENCE: fullPassage 14문장 ✅
- S-WA-IN-PASSAGE: 없음 ✅
- S-LENGTH-BIAS: 없음 ✅
- S-ANTONYM-PREFIX: 없음 (contented↔dissatisfied 접두사 조작 아님) ✅
- S-ANTI-CHEESE-GATE: 오답 모두 다른 의미축 ✅

## B급 경고 (배포 차단 아님)

- C20: histKey 패턴 미일치 (시스템 자동 처리)
- P2: Q15 다의어 AI 직접 작성 passage (유형 규칙상 허용)
- Q6-WEAK-DISTRACTOR: Q7/Q8/Q9 오답이 fullPassage 외부 단어 (단어테스트 특성상 허용)

## 배포 승인 — 2번 단어

- validate PASS ✅
- blind 20/20 ✅
- cross-blind 20/20 ✅
- adversarial HIGH 0 ✅

---

# Audit Report — 수능특강/영어/Test2/1번 단어

**출제일**: 2026-06-17  
**출제자**: Sonnet 4.6 (Tier 1)  
**검수자**: Sonnet 4.6 Cross-blind

## 결과 요약

| 항목 | 결과 |
|---|---|
| validate | PASS (경고 4건 — B급, S급 0) |
| blind 20/20 | ✅ 일치 |
| cross-blind 20/20 | ✅ 일치 |
| adversarial HIGH | 0건 |
| 총점 | 100점 |
| ans 분포 | {1:4, 2:5, 3:5, 4:4} |

## 문항 구성

| 유형 | 쉬움(4pt) | 보통(5pt) | 어려움(6pt) |
|---|---|---|---|
| (A)(B)(C) 조합형 | Q1 | Q2 | Q3 |
| 문맥상 부적절한 어휘 | Q4, Q5 | Q6 | — |
| 빈칸 어휘 완성 | Q7 | Q8, Q9 | — |
| 동의어 고르기 | Q10 | Q11, Q12 | — |
| 반의어 고르기 | — | Q13 | Q14 |
| 다의어 문맥적 의미 | — | — | Q15 |
| 영영풀이 매칭 | — | Q16 | — |
| 어형 변환 | — | Q17 | Q18 |
| 빈칸 문맥 완성 | — | Q19 | Q20 |

## S급 11종 체크

- S-META-LEAK: 없음 ✅
- S-PREFIX-DOMINANT: 없음 ✅
- S-CIRCULAR-STEM: 없음 (서술형 없음) ✅
- S-MISSING-KOREAN: 없음 ✅
- S-WORDCOUNT-MISMATCH: 없음 ✅
- S-CH-TRUNCATED: 없음 ✅
- S-MARKER-LEAK: 없음 ✅
- S-TYPE-CONTENT-MISMATCH: 없음 ✅
- S-PASSAGE-1-SENTENCE: fullPassage 10문장+ ✅
- S-WA-IN-PASSAGE: 없음 (어형변환 제외) ✅
- S-LENGTH-BIAS: 없음 ✅
- S-ANTONYM-PREFIX: 없음 (harshly/appropriate = 접두사 조작 아님) ✅
- S-ANTI-CHEESE-GATE: 오답 모두 다른 의미축 ✅

## B급 경고 (배포 차단 아님)

- C20: histKey 패턴 미일치 (시스템 자동 처리)
- P2: Q5/Q15/Q17 passage 체크 (다의어/어형변환 excerpt는 정상)

## 배포 승인

- validate PASS ✅
- blind 20/20 ✅  
- cross-blind 20/20 ✅
- adversarial HIGH 0 ✅

---

# Audit Report — 수능특강/영어/Test2/5번 단어

**출제일**: 2026-06-17  
**출제자**: Sonnet 4.6 (Tier 1, jacob 승인 fallback)  
**검수자**: Sonnet 4.6 Cross-blind

## 결과 요약

| 항목 | 결과 |
|---|---|
| validate | PASS (경고 4건 — B급, S급 0) |
| blind 20/20 | ✅ 일치 |
| cross-blind 20/20 | ✅ 일치 |
| adversarial HIGH | 0건 |
| 총점 | 100점 |
| ans 분포 | {1:4, 2:5, 3:5, 4:4} |

## 문항 구성

| 유형 | 쉬움(4pt) | 보통(5pt) | 어려움(6pt) |
|---|---|---|---|
| (A)(B)(C) 조합형 | Q1 | Q2 | Q3 |
| 문맥상 부적절한 어휘 | Q4, Q5 | Q6 | — |
| 빈칸 어휘 완성 | Q7 | Q8, Q9 | — |
| 동의어 고르기 | Q10 | Q11, Q12 | — |
| 반의어 고르기 | — | Q13 | Q14 |
| 다의어 문맥적 의미 | — | — | Q15 |
| 영영풀이 매칭 | — | Q16 | — |
| 어형 변환 | — | Q17 | Q18 |
| 빈칸 문맥 완성 | — | Q19 | Q20 |

## S급 에러 0건 확인

- S-META-LEAK: 없음 ✅
- S-PREFIX-DOMINANT: 없음 ✅
- S-CIRCULAR-STEM: 없음 ✅
- S-MISSING-KOREAN: 없음 ✅
- S-WORDCOUNT-MISMATCH: 없음 ✅
- S-CH-TRUNCATED: 없음 ✅
- S-MARKER-LEAK: 없음 ✅
- S-TYPE-CONTENT-MISMATCH: 없음 ✅
- S-PASSAGE-1-SENTENCE: fullPassage 8문장 ✅
- S-WA-IN-PASSAGE: 없음 ✅
- S-LENGTH-BIAS: 없음 ✅
- S-ANTONYM-PREFIX: 없음 (dynamic/disposable = 접두사 조작 아님) ✅
- S-ANTI-CHEESE-GATE: 오답 모두 다른 의미축 ✅

## B급 경고 (배포 차단 아님)

- C20: histKey 패턴 미일치 (시스템 자동 처리)
- P2: Q15 다의어 AI 직접 작성 passage (유형 규칙상 허용)
- P2: Q17/Q18 어형변환 excerptSentences (발췌 허용 예외)

## 배포 승인 — 5번 단어

- validate PASS ✅
- blind 20/20 ✅
- cross-blind 20/20 ✅
- adversarial HIGH 0 ✅
