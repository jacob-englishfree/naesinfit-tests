# Audit Report: 이투스유형독해S 04강 전체 단어

## 기본 정보
- 파일: `data/부교재/이투스유형독해S/04강/전체/단어.json`
- 출제일: 2026-06-15
- 출제 모델: claude-opus-4-6
- 검수 모델: claude-opus-4-6 (self cross-blind)

## 배점
- 총점: 100점 (20문항)
- 쉬움: 5문항 x 4점 = 20점
- 보통: 10문항 x 5점 = 50점
- 어려움: 5문항 x 6점 = 30점

## ans 분포
- 1번: 4개 / 2번: 5개 / 3번: 5개 / 4번: 4개
- written: 2문항 (Q17, Q18)
- 3연속 동일번호: 없음

## 유형 분포
| 유형 | 문항 수 |
|------|---------|
| (A)(B)(C) 조합형 | 3 (Q1~3) |
| 문맥상 부적절한 어휘 | 3 (Q4~6) |
| 빈칸 어휘 완성 | 3 (Q7~9) |
| 동의어 고르기 | 3 (Q10~12) |
| 반의어 고르기 | 2 (Q13~14) |
| 다의어 문맥적 의미 | 1 (Q15) |
| 영영풀이 매칭 | 1 (Q16) |
| 어형 변환 | 2 (Q17~18) |
| 빈칸 문맥 완성 | 2 (Q19~20) |

## 검증 결과
- validate: PASS (S급 0, A급 0, B급 5 warnings)
- blind solve: 20/20 일치
- cross-blind: 20/20 일치
- adversarial: HIGH 0건, LOW 1건 (Q17 원형 유지 트릭)

## B급 경고 (허용)
- EX-3 Q1~3: (A)(B)(C) 유형 특성상 정답 단어 노출 불가피
- C20: histKey 패턴 (메타데이터, 콘텐츠 무관)
- P2 Q15: 다의어 유형 커스텀 passage (설계 의도)

## 지문 출처
- P01: Eskimo wolf killing story
- P02: Fasting and detoxification
- C01: Uncertainty in science
- C02: Ecotourism pros and cons
