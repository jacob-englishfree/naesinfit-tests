# 검증 리포트 — 공통영어2 YBM(김은형) 1과 본문

**지문**: Young Change-Makers Shaping the Future
**contentId**: C2-YBM김-1과 / 섹션: 본문
**검증일**: 2026-09-01 / 검증자: Opus 4.8 (세션②)

## STEP 0 원문 대조
- 원본 PDF `(2022개정)2025년_공통영어2_YBM(김은형)_1과_본문` 대조. fullPassage = 단어 overlay 전부 정확 substring 매칭 + validate PASS로 교차 확인.
- Read More 섹션(Appropriate Technology)은 본문 fullPassage에 미포함(오염 0) 확인.

## 3종 검증 결과

| 테스트 | validate | 블라인드(Opus) | cross-blind(Sonnet) | adversarial |
|---|---|---|---|---|
| 단어 | ✅ PASS | ✅ 20/20 | ✅ 20/20 | HIGH 0 |
| 워크북 | ✅ PASS | ✅ 20/20 | ✅ 20/20 | HIGH 0 |
| 예상문제 | ✅ PASS | ✅ 20/20 | ✅ 20/20 | HIGH 0 |

## 수정 이력 (검수 중 근본 수정)
- **단어**: 기존 세션 초안 S급 5건 수정 — Q5 마커 ②가 소제목 "Discarded"에 오매칭 → find="discarded electronics"(본문); Q6 정답 마커를 위치상 마지막 restore→destroy로 재설계; Q2·Q3 ABC 라벨을 본문 등장순서로 재배열; Q11 한국어 해설 보강.
- **워크북**: Q12(내용불일치)·Q13(내용일치) 정답/오답 근거 문장이 발췌(end-exclusive) 밖 → excerptRange 확장([12,16]→[12,17], [19,24]→[19,25]). 93%·salt water 문장 포함 실측 확인.

## 배점/분포
- 각 20문항 100점(쉬움5×4+보통10×5+어려움5×6). ans 분포 한 번호 ≤5, 3연속 0.
- cross-leak: 단어↔워크북↔예상문제 wa/blank/overlay/문법포인트 전부 상이.

**최종 판정: ✅ 3종 배포 가능**
