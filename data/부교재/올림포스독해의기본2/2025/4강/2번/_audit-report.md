# Audit Report: 올림포스독해의기본2/2025/4강/2번 단어

## 기본 정보
- 파일: 단어.json
- 총 문항: 20 (mc 18 + written 2)
- 총점: 100 (쉬움5x4=20, 보통10x5=50, 어려움5x6=30)
- ans 분포: {1:3, 2:5, 3:5, 4:5}

## SOP 이행
- [x] STEP 1: response.json 출제
- [x] STEP 2: assemble + validate PASS
- [x] STEP 3: blind solve 20/20 일치
- [x] Tier 2: cross-blind 20/20 일치
- [x] STEP 5: adversarial HIGH 0건
- [x] STEP 7: 본 리포트

## validate 결과
- S급 에러: 0건
- A급 에러: 0건
- B급 경고: 10건 (EX-3 ABC 정답노출 3건 = ABC 유형 특성상 허용, P2 overlay 4건 = 정상, C20 histKey 1건, Q6 오답질 2건)

## 유형 분포
| 유형 | 문항수 |
|------|--------|
| (A)(B)(C) 조합형 | 3 |
| 문맥상 부적절한 어휘 | 3 |
| 빈칸 어휘 완성 | 3 |
| 동의어 고르기 | 3 |
| 반의어 고르기 | 2 |
| 다의어 문맥적 의미 | 1 |
| 영영풀이 매칭 | 1 |
| 어형 변환 | 2 |
| 빈칸 문맥 완성 | 2 |

## 적대적 공격 결과
- HIGH: 0건
- LOW: 4건 (ABC 정답노출, Q7/Q8 오답 미등장, Q17 considered 중복)
- 정답 2개 가능: 없음
- 뻔한 오답: 없음

## 결론
배포 가능.
