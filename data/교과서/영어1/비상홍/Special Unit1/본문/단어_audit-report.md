# 단어 테스트 검수 리포트

## 기본 정보
- **교재**: 영어I 비상(홍민표) Special Unit1 본문
- **유형**: 단어
- **문항 수**: 20문항 / 총점 100점
- **검수일**: 2026-04-22
- **출제 모델**: Opus 4.6

## 배점 분포
| 난이도 | 문항 수 | 배점 | 소계 |
|--------|---------|------|------|
| 쉬움 | 5 | 4점 | 20점 |
| 보통 | 10 | 5점 | 50점 |
| 어려움 | 5 | 6점 | 30점 |
| **합계** | **20** | | **100점** |

## 정답 분포
| 번호 | 개수 | 문항 |
|------|------|------|
| ① | 4 | Q2, Q7, Q11, Q15 |
| ② | 5 | Q3, Q5, Q9, Q13, Q20 |
| ③ | 5 | Q1, Q4, Q8, Q12, Q16 |
| ④ | 4 | Q6, Q10, Q14, Q19 |
| 서술형 | 2 | Q17, Q18 |

3연속 동일 번호: 0건

## 유형 분포
| 유형 | 문항 |
|------|------|
| (A)(B)(C) 조합형 | Q1(쉬움), Q2(보통), Q3(어려움) |
| 문맥상 부적절한 어휘 | Q4(쉬움), Q5(쉬움), Q6(보통) |
| 빈칸 어휘 완성 | Q7(쉬움), Q8(보통), Q9(보통) |
| 동의어 고르기 | Q10(쉬움), Q11(보통), Q12(보통) |
| 반의어 고르기 | Q13(보통), Q14(어려움) |
| 다의어 문맥적 의미 | Q15(어려움) |
| 영영풀이 매칭 | Q16(보통) |
| 어형 변환 | Q17(보통), Q18(어려움) |
| 빈칸 문맥 완성 | Q19(보통), Q20(어려움) |

## SOP 이행 체크리스트
- [x] STEP 0: 원문 확보 (본문.pdf → fullPassage 4831자)
- [x] STEP 1: 출제 (create-test.js --assemble)
- [x] STEP 2: 구조 검증 (validate PASS — S/A급 0건)
- [x] STEP 3: 블라인드 풀이 (20/20 일치)
- [x] STEP 4: 정답 대조 (blind vs ans 전수 일치)
- [x] STEP 5: 적대적 공격 (HIGH 0건, LOW 3건 — 모두 KEEP)
- [x] STEP 6: 자동 검증 (validate PASS)
- [x] STEP 7: 증적 리포트 (본 문서)

## validate 결과
- **S급**: 0건
- **A급**: 0건
- **B급**: 6건 (모두 허용 사유 있음)
  - EX-3 Q1~Q3: 교과서 단일 본문 특성상 단어 반복 불가피
  - SCHEMA-STEM-BOLD Q15: 다의어 유형 특성
  - C20: Special Unit 특수 histKey 패턴
  - P2 Q15: 다의어는 AI 직접 passage 작성

## 블라인드 풀이 결과
20/20 일치 (100%)

## Cross-blind 결과
20/20 일치 (100%)

## 적대적 공격 결과
- HIGH: 0건
- LOW: 3건
  - Q3: sustain/maintain 유사성 — convert 문맥으로 변별력 확보
  - Q8: essential도 가능하나 "the ___ energy required" 구조에서 minimum 유일
  - Q16: consumption vs expenditure — 정의의 "amount spent" 기준 expenditure 정확

## Artifact 목록
1. `단어.json` — 최종 테스트 파일
2. `단어.response.json` — AI 판단 원본
3. `단어.blind.json` — 블라인드 풀이
4. `단어.cross-blind.json` — 교차 검증
5. `단어.adversarial.json` — 적대적 공격
6. `단어_audit-report.md` — 본 리포트
