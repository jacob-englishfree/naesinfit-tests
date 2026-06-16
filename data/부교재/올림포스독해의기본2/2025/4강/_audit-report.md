# 단어 테스트 감사 리포트

## 대상
- **교재**: 올림포스독해의기본2 / 2025 / 4강 / 1번
- **테스트 종류**: 단어
- **파일**: `data/부교재/올림포스독해의기본2/2025/4강/1번/단어.json`

## 문항 구성
- **총 문항**: 20문항
- **총점**: 100점
- **배점 분포**: 쉬움 5×4=20 / 보통 10×5=50 / 어려움 5×6=30

## 유형 분포
| 유형 | 문항수 | 문항번호 |
|------|--------|----------|
| (A)(B)(C) 조합형 | 3 | Q1, Q2, Q3 |
| 문맥상 부적절한 어휘 | 3 | Q4, Q5, Q6 |
| 빈칸 어휘 완성 | 3 | Q7, Q8, Q9 |
| 동의어 고르기 | 3 | Q10, Q11, Q12 |
| 반의어 고르기 | 2 | Q13, Q14 |
| 다의어 문맥적 의미 | 1 | Q15 |
| 영영풀이 매칭 | 1 | Q16 |
| 어형 변환 | 2 | Q17, Q18 |
| 빈칸 문맥 완성 | 2 | Q19, Q20 |

## 정답 분포
| 정답 | 개수 | 문항 |
|------|------|------|
| ① | 4 | Q6, Q9, Q14, Q20 |
| ② | 5 | Q3, Q5, Q8, Q12, Q15 |
| ③ | 4 | Q1, Q4, Q10, Q16 |
| ④ | 5 | Q2, Q7, Q11, Q13, Q19 |
| 서술형 | 2 | Q17(resulting), Q18(emphasizing) |

## SOP 이행
- [x] STEP 0: fullPassage 원문 확인
- [x] STEP 1: 출제 (response.json)
- [x] STEP 2: 구조 검증 (validate PASS)
- [x] STEP 3: 블라인드 풀이 (blind.json — 20/20 일치)
- [x] STEP 4: 정답 대조 (0건 불일치)
- [x] STEP 5: 적대적 공격 (adversarial.json — HIGH 0건)
- [x] STEP 6: 자동 검증 (validate PASS + 11 warnings)
- [x] STEP 7: 증적 리포트 (본 문서)

## validate 결과
- **S급 에러**: 0건
- **B급 경고**: 11건 (EX-3 ×3, C20 ×1, P2 ×3, Q6-WEAK ×4)
- **판정**: PASS

## 수정 이력
1. 초기 출제: ans 분포 불균형 (1번 10개) → 선지 재배치로 4:5:4:5 달성
2. Q13: familiar→unfamiliar (S-ANTONYM-PREFIX 위반) → tragic→fortunate로 교체
3. Q6: S-MARKER-ORDER 위반 → 마커를 complex/considerable/subsequent/inherent로 재배치

## 최종 판정
**배포 가능**
