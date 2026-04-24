# Audit Report: 빠른독해바른독해 구문독해 2과 1번

**지문**: Unwelcome Guests in Our New Home
**검수일**: 2026-04-20
**검수자**: opus-adversarial

## 테스트 현황

| 테스트 | 문항 | 총점 | validate | blind | adversarial |
|--------|------|------|----------|-------|-------------|
| 단어   | 20   | 100  | PASS (8w) | - | HIGH 0 / MEDIUM 0 / LOW 2 |
| 워크북 | 20   | 100  | PASS (4w) | - | HIGH 0 / MEDIUM 1 / LOW 0 |
| 퀴즈   | 20   | 100  | PASS (5w) | 20/20 | HIGH 0 (2 RESOLVED) / MEDIUM 0 / LOW 0 |

## Adversarial Issues

### HIGH (모두 해결됨)

1. **퀴즈 Q1 (어법, 4점)**: ~~지각동사 saw + mice + run vs running 이중정답~~ **RESOLVED**: 마커 ④를 `felt→feeling`으로 변경. 'Our new home no longer feeling safe'는 주절 동사 부재로 명백한 비문. 단일 정답 보장.

2. **퀴즈 Q18 (어순배열, 6점)**: ~~주어진 단어 목록에 'and' 누락, 미사용 'a'/'but' 포함~~ **RESOLVED**: 주어진 단어를 `and / gently / it / it / just / outside / picked / put / up`으로 수정. wa 9단어와 정확히 일치.

### MEDIUM

3. **워크북 Q5 (어휘, 5점)**: ② 'after long'은 영어에 존재하지 않는 표현으로 오답이 뻔함. before long 관용구를 모르더라도 소거 가능.

### LOW/INFO

- 단어 Q15: 다의어 edge case (수용)
- 단어 Q17: accept에 realised 미포함 (한국 교육과정 기준 수용)
- 워크북 Q15, Q16: 찾기형 정답 노출 (규칙상 OK)

## validate 경고 요약

- C20 histKey 패턴 불일치 (3건) -- 시스템 이슈, 문항 품질 무관
- P2 passage 앞부분 불일치 (다의어/어형변환 문항) -- 이 유형은 발췌 passage 사용이 허용됨
- EX-3 (A)(B)(C) 정답 노출 (3건) -- 단어 테스트 특성상 수용
- EX-2 찾기형 정답 노출 (4건) -- 규칙상 OK
- T39 어순배열 순서 경고 (1건)

## Sign-off

- [ ] jacob 확인
- [x] 퀴즈 Q1 재출제 완료 (felt→feeling)
- [x] 퀴즈 Q18 주어진 단어 수정 완료
