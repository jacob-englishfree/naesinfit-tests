# Audit Report: 올림포스독해의기본1/2025/5강/1번 워크북

## 기본 정보
- 교재: 올림포스 영어독해 기본1
- 강/지문: 5강/1번 (Elders as Cognitive Gatekeepers)
- 테스트 유형: 워크북
- 문항 수: 20문항 / 총점: 100점

## 배점 분포
- 쉬움: 5문항 x 4점 = 20점 (Q1,2,7,12,18)
- 보통: 10문항 x 5점 = 50점 (Q3,5,6,8,9,10,13,15,17,19)
- 어려움: 5문항 x 6점 = 30점 (Q4,11,14,16,20)

## ans 분포
- 1: 4개 (Q4,6,9,14)
- 2: 4개 (Q1,7,8,10)
- 3: 5개 (Q2,5,11,12,19)
- 4: 3개 (Q3,13,18)
- 최대 5개 이하 — PASS

## 유형 분포
- 어법: 4문항 (Q1-4)
- 어휘(부적절): 2문항 (Q5-6)
- 내용이해 T/F: 3문항 (Q7-9)
- 빈칸추론: 2문항 (Q10-11)
- 내용 일치/불일치: 2문항 (Q12-13)
- 오류찾기: 1문항 (Q14)
- 서술형(찾기): 2문항 (Q15-16)
- 어순배열: 1문항 (Q17)
- 주제/요지: 2문항 (Q18-19)
- 서술형 조건영작: 1문항 (Q20)

## 검증 결과
- validate.js: PASS (B-level warnings only)
- blind solve: 20/20 일치
- cross-blind: 20/20 일치
- adversarial: HIGH 0건, LOW 2건

## cross-leak 확인
- 단어.json과 워크북.json 간 overlay 단어 중복 최소화
- 어법 마커: 단어에서 미사용 포인트 활용 (principally, overseeing병렬, elderly, to have accumulated)
- 어휘 마커: wise↔foolish, define↔obscure (단어에서는 다른 단어 사용)

## 플래그
- Q3: 'an elder' vs 'an elderly' 미묘한 구분. LOW severity. 원문 기준 유효.
- Q15/Q16: 서술형 찾기형이므로 passage에 정답 노출은 의도된 것 (EX-2 경고 무시 가능)
