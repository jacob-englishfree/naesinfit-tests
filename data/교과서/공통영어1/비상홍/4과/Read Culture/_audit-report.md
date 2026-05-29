# Audit Report: 공통영어1 비상홍 4과 Read Culture 단어 (v2)

## 메타
- 날짜: 2026-05-29
- 모델: opus
- 총점: 100점 (20문항)
- 배점: 쉬움5×4=20 + 보통10×5=50 + 어려움5×6=30

## ans 분포
1→5, 2→5, 3→4, 4→4 (연속 최대 2)

## validate
- PASS (0 errors, 11 B-level warnings)
- B-level: EX-3 (ABC 정답 노출 3건), EX-1 (wrestling 노출 1건), C20/P2/Q6 경고

## blind-solve
- 20/20 일치 (0 mismatch)

## cross-blind
- 20/20 일치 (0 flag)

## adversarial
- HIGH: 0, MEDIUM: 0, LOW: 1 (Q7 wrestling 노출 — 허용 범위)
- 정답 2개 가능 문항: 없음
- 선지 뻔함 문항: 없음

## 기존 단어.json 중복 체크
- 기존 overlay targets와 0건 중복 확인
- 기존: unique/archery/participate/important/reunion/respect/unclear/traditional/considered/popular→forgotten/opened→closed/good→bad/competitions/gather/meaningful/features/passed away/practice/popular/share/race/athlete/give→given/visit→visited/pay respect to/the gates of heaven
- 신규: male/long/dead/souls/remember/build/singing/visit(부적절 marker)/dark/culture/sports/male→female/arrows/remember→forget/homes/photos/foods/origin/traditional→unfamiliar/neighbors/drink/wrestling/souls/custom/celebrate/origin/commonly/living/favorite/stand/parade/celebrating/meaningful(어형변환)/the living world/first footing

## 결론
배포 가능.
