# 증적 리포트 — 단어 테스트 (Reading Expert 5, U09 Whistled Languages / 전체)

- 파일: `data/부교재/ReadingExpert5/9강/전체/단어.json`
- 재검증: 2026-09-13 (Opus 4.8)

## 1. 구성
- 문항 수: **20** / 총점: **100**
- 배점 분포: 쉬움 5 × 4점(20) + 보통 10 × 5점(50) + 어려움 5 × 6점(30) = 100
- 형식: 객관식 18 + 서술형(어형변환) 2
- 유형 분포: (A)(B)(C) 조합형 3 / 문맥상 부적절한 어휘 3 / 빈칸 어휘 완성 3 / 동의어 3 / 반의어 2 / 다의어 문맥적 의미 1 / 영영풀이 매칭 1 / 어형 변환 2 / 빈칸 문맥 완성 2 — 전부 단어 화이트리스트 내
- mc 정답 분포: ①5 ②5 ③4 ④4 (한 번호 5개 이하, 3연속 없음 — A6 PASS)

## 2. validate 결과
**[PASS]** (경고 7건, 전부 B급 비차단)
- EX-3(B) Q1/Q2/Q3: (A)(B)(C) 정답어가 지문 타 위치 존재 — 조합형 특성상 불가피, 선지 없이 유추 불가하므로 무영향
- P2(B) Q15: 다의어 (A)(B) 미니문맥은 AI작성이라 fullPassage 대조 대상 아님 — 정상
- Q6-WEAK(B) Q7/Q9/Q20: 어휘 오답(deserts/cities/oceans 등)이 지문에 없음 — 어휘 변별용 오답으로 정상·권장 사항

## 3. 블라인드 재풀이 (정답 가리고 원문 대조로 직접 풀이)
**20/20 일치.** 대표 근거:
- Q1 heard-declined-preserving(①), Q4 destroy←preserve 부적절(④), Q6 end←save 부적절(②)
- Q10 thick=dense(③), Q12 revived=restored(④), Q13 simple↔complex(③), Q14 successful↔failed(②)
- Q15 다의어 step (A)조치 (B)계단(①), Q16 vowel(③)
- Q17 어형변환 consonants are ___(reproduce)→reproduced, Q18 new ___(communicate) technology→communication

## 4. 적대검수
- 정답 2개 가능/정답 노출/뻔한 오답/길이편향: 발견 0건
- 서술형(Q17/Q18) 정답이 발췌문 내 타 위치 미노출 확인

## 5. 판정
- validate PASS · 블라인드 20/20 · 원문 100% 일치 · 정답오류 0
- 증적: response/json/blind/cross-blind/adversarial 존재, adversarial HIGH 0
- **배포 가능 (GREEN)**
