# Audit Report — 수능특강 영어 Test2 19번 퀴즈

**생성일**: 2026-06-17  
**출제 모델**: claude-sonnet-4-6  
**검수 모델**: claude-sonnet-4-6 (cross-validator)

---

## 1. 파일 현황

| 파일 | 상태 |
|------|------|
| 퀴즈.response.json | DONE |
| 퀴즈.json | DONE (validate PASS) |
| 퀴즈.blind.json | DONE (20/20 all match) |
| 퀴즈.cross-blind.json | DONE (20/20 agreed) |
| 퀴즈.adversarial.json | DONE (HIGH 0건) |

---

## 2. 문항 구성

- **총 문항**: 20문항 / 총점: 100점
- **쉬움(4점)**: Q1, Q8, Q14, Q16, Q19 — 5문항 × 4점 = 20점
- **보통(5점)**: Q2, Q4, Q6, Q7, Q9, Q10, Q11, Q15, Q17, Q20 — 10문항 × 5점 = 50점
- **어려움(6점)**: Q3, Q5, Q12, Q13, Q18 — 5문항 × 6점 = 30점

## 3. 유형 분포

| 유형 | 문항 수 | 문항 ID |
|------|---------|---------|
| 어법 | 3 | Q1, Q2, Q3 |
| 문맥상 부적절한 어휘 | 2 | Q4, Q5 |
| 빈칸추론 | 2 | Q6, Q7 |
| 내용 일치/불일치 | 3 | Q8, Q9, Q10 |
| 주제 | 2 | Q11, Q12 |
| 함축의미 추론 | 1 | Q13 |
| 지칭추론 | 2 | Q14, Q15 |
| 서술형 | 2 | Q16, Q17 |
| 서술형 — 핵심단어 | 1 | Q18 |
| 서술형 — 조건영작 | 2 | Q19, Q20 |

## 4. 정답 분포

| 번호 | 1 | 2 | 3 | 4 |
|------|---|---|---|---|
| 개수 | 3 | 4 | 5 | 3 |

- 동일번호 최대 5개(3번): 기준 통과 ✅
- 3연속 금지: 없음 ✅

## 5. SOP 8단계 이행 현황

| 단계 | 상태 | 비고 |
|------|------|------|
| STEP 0: 원문 확보 + fullPassage 대조 | ✅ | 19번.json fullPassage 확인 |
| STEP 1: 출제 | ✅ | response.json 작성 완료 |
| STEP 2: 구조 검증 (validate) | ✅ | S급 0건, B급 6건 경고 |
| STEP 3: 블라인드 풀이 | ✅ | blind.json 20/20 all match |
| STEP 4: 정답 대조 | ✅ | 불일치 0건 |
| STEP 5: 적대적 공격 | ✅ | adversarial.json HIGH 0건 |
| STEP 6: 자동 검증 | ✅ | validate PASS |
| STEP 7: 증적 리포트 | ✅ | 이 파일 |
| STEP 8: jacob 확인 후 배포 | ⏳ | 대기 중 |

## 6. validate 결과 요약

- **S급 오류**: 0건 ✅
- **B급 경고**: 6건 (배포 차단 아님)
  - det.korean "X→Y" 형식 권장
  - histKey 패턴 불일치
  - 기타 경고

## 7. 블라인드 풀이 결과 (STEP 3)

- **총 20문항 직접 풀이 완료**
- 자동 대조 가능(마커/빈칸): 7문항 자동 match
- 에이전트 직접 풀이: 13문항 (Q8-Q18 + Q19, Q20)
- **최종 match: 20/20** ✅
- 불일치: 0건

## 8. Cross-Blind 결과 (Tier 2 교차검증)

- **20문항 전체 blind 풀이와 일치**
- 충돌(conflict): 0건 ✅
- 플래그(flag): 0건 ✅

## 9. Adversarial 결과 (STEP 5)

- **HIGH**: 0건 ✅
- **MEDIUM**: 0건 ✅
- **LOW**: 20건 (모두 PASS — 오히려 출제 의도 명확 확인)

---

**배포 승인 상태**: jacob 확인 대기 (STEP 8)
