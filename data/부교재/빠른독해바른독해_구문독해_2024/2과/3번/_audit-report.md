# Audit Report: 빠른독해바른독해 구문독해 2과 3번

**지문**: CBT: Changing Thoughts to Change Behavior
**검수일**: 2026-04-20
**검수자**: opus-adversarial

## 테스트 현황

| 테스트 | 문항 | 총점 | validate | blind | adversarial |
|--------|------|------|----------|-------|-------------|
| 단어   | 20   | 100  | PASS (10w) | - | HIGH 0 / MEDIUM 0 / LOW 1 |
| 워크북 | 20   | 100  | PASS (8w)  | - | HIGH 0 / MEDIUM 0 / LOW 2 |
| 퀴즈   | 20   | 100  | PASS (7w)  | - | HIGH 0 / MEDIUM 0 / LOW 1 |

## Adversarial Issues

### LOW

1. **단어 Q6 (부적절어휘, 5점)**: 마커 번호가 passage 순서(②→③→①→④)와 불일치. 학생 혼란 가능하나 채점 영향 없음.
2. **워크북 Q14 (오류찾기, 6점)**: 마커 ④가 ①②③보다 passage 앞에 위치. 순서 비정상.
3. **워크북 Q17 (어순배열, 5점)**: 'it'이 주어진 단어에 소문자로 포함되어 있으나 원문에서는 대문자 'It'. 채점 NORM이 처리하므로 실질 영향 없음.
4. **퀴즈 Q15 (지칭추론, 5점)**: passage에서 <u>They</u> 밑줄 위치가 'the way They think'에 있어 They=people(사람들 일반)을 가리킬 수 있으나, det은 They=Some patients로 해석. 밑줄 위치 재확인 필요.

### INFO

- 워크북 Q15, Q16: 찾기형 정답 노출 (규칙상 OK)
- 퀴즈 Q16, Q17: 찾기형 정답 노출 (규칙상 OK)

## validate 경고 요약

- C20 histKey 패턴 불일치 (3건)
- P2 passage 앞부분 불일치 (마커/다의어/어형변환 문항)
- EX-3 (A)(B)(C) 정답 노출 (3건) -- 단어 테스트 수용
- EX-2 찾기형 정답 노출 (4건) -- 규칙상 OK
- SCHEMA-DET-PATTERN (3건) -- det.korean 형식 권장
- T39 어순배열 순서 (1건)

## Sign-off

- [ ] jacob 확인
- [ ] 퀴즈 Q15 밑줄 위치 확인
