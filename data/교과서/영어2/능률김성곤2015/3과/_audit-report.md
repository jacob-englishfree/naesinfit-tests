# 퀴즈 검수 보고서 — 영어2 능률김성곤2015 3과 본문

- 일시: 2026-06-20
- 모델: claude-opus-4-6
- 파일: 퀴즈.json (20문항, 100점)

## validate
- PASS (3 B-level warnings: P2 x2, Q6-WEAK-DISTRACTOR x1)
- S-level errors: 0

## 배점
- 쉬움 5문항 x 4점 = 20점
- 보통 10문항 x 5점 = 50점
- 어려움 5문항 x 6점 = 30점
- 총점: 100점

## ans 분포
- 1번: 3개 (Q4, Q11, Q13)
- 2번: 5개 (Q3, Q5, Q6, Q8, Q14)
- 3번: 3개 (Q1, Q7, Q12)
- 4번: 4개 (Q2, Q9, Q10, Q15)
- 최대 연속: 2 (규칙 준수)

## 블라인드 풀이
- 자체: 20/20 일치
- Cross-blind: 20/20 일치

## 적대적 공격
- HIGH: 0건
- MEDIUM: 0건
- LOW: 4건 (오답 품질, passage 매칭, 워크북 범위 차이)

## 워크북 중복 확인
- overlay/wa 직접 중복: 0건
- 부분 겹침(범위 차이): Q19 come up with any results 구문 공유 (5단어 vs 11단어)
