# 증적 리포트 — 수능특강 영어 Test2 16번 퀴즈

생성일: 2026-06-17

## 파일 정보
- 테스트: `퀴즈.json`
- 총 문항: 20문항 / 총점: 100점
- 배점: 쉬움(4점)×5 + 보통(5점)×10 + 어려움(6점)×5 = 100점

## SOP 8단계 이행 현황

| 단계 | 파일 | 상태 |
|------|------|------|
| STEP 0 | fullPassage 원문 확보 (16번.json) | ✅ |
| STEP 1 | 퀴즈.response.json (decisions 20개) | ✅ |
| STEP 2 | node create-test.js --assemble → 퀴즈.json | ✅ |
| STEP 3 | 퀴즈.blind.json (20/20 match) | ✅ |
| Tier 2 | 퀴즈.cross-blind.json (20/20 match) | ✅ |
| STEP 5 | 퀴즈.adversarial.json (HIGH 0건) | ✅ |
| STEP 7 | _audit-report.md (본 파일) | ✅ |

## validate 결과

```
[PASS] data/부교재/수능특강/영어/Test2/16번/퀴즈.json (8 warnings)
S급 오류: 0건
B급 경고: 8건 (권고사항, 배포 차단 아님)
```

## 문항 배분

| 유형 | 문항 수 | 번호 |
|------|---------|------|
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

## ans 분포

| 번호 | 문항 수 |
|------|---------|
| 1 | 4 |
| 2 | 5 |
| 3 | 3 |
| 4 | 3 |

A6 규칙 (최대 5개) 준수 확인.

## 블라인드 풀이 결과

- 자체 블라인드 (퀴즈.blind.json): 20/20 match, needsAgent=0
- 교차 검증 (퀴즈.cross-blind.json): 20/20 match, allMatch=true

## 적대적 공격 결과 (퀴즈.adversarial.json)

- HIGH: 0건 → 배포 차단 사유 없음
- MEDIUM: 1건 (Q17 accept 배열 관례 → 수정 완료)
- LOW: 1건 (Q9 선지① 해석 모호 가능성 — 정답 유일성 유지)

## STEP 8 — jacob 확인 후 배포 대기
