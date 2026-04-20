# Audit Report: 빠른독해바른독해 구문독해 2과 2번

**지문**: Kalpana Chawla: A Space Pioneer
**검수일**: 2026-04-20
**검수자**: opus-adversarial

## 테스트 현황

| 테스트 | 문항 | 총점 | validate | blind | adversarial |
|--------|------|------|----------|-------|-------------|
| 단어   | 20   | 100  | PASS (7w) | - | HIGH 0 / MEDIUM 0 / LOW 2 |
| 워크북 | 20   | 100  | PASS (7w) | - | HIGH 0 / MEDIUM 0 / LOW 1 |
| 퀴즈   | 20   | 100  | PASS (8w) | 20/20 | HIGH 0 / MEDIUM 0 (1 RESOLVED) / LOW 1 |

## Adversarial Issues

### MEDIUM (모두 해결됨)

1. **퀴즈 Q8 (내용일치, 4점)**: ~~선지 ②와 ③ 둘 다 본문 내용과 일치하여 이중정답 가능~~ **RESOLVED**: 선지 ②를 '콜로라도 대학에서 학사 학위를 받았다'로 변경. 원문은 a doctorate(박사학위)이므로 학사 학위는 명확한 불일치. 정답 ③ 단일 보장.

### LOW

2. **단어 Q8 (빈칸어휘, 5점)**: 빈칸 정답 'mission'이 passage 뒤에 '16-day mission'으로 노출. 빈칸에서 4문장 거리이므로 시각적 베끼기 수준 아님.
3. **단어 Q19 (빈칸문맥, 5점)**: 오답 3개가 다소 뻔함.
4. **워크북 Q8 (T/F, 5점)**: 'Later that year' 해석 미세 차이 가능하나 시간 순서 명확.
5. **퀴즈 Q13 (함축의미, 6점)**: 유형 라벨이 '함축의미 추론'이나 실질적으로 '지칭추론' 문항. 채점 영향 없음.

### INFO

- 워크북 Q15, Q16: 찾기형 정답 노출 (규칙상 OK)
- 퀴즈 Q16, Q17: 찾기형 정답 노출 (규칙상 OK)

## validate 경고 요약

- C20 histKey 패턴 불일치 (3건)
- P2 passage 앞부분 불일치 (다의어/어형변환/오류찾기/어순배열 문항)
- EX-3 (A)(B)(C) 정답 노출 (3건) -- 단어 테스트 수용
- EX-1 빈칸 정답 노출 (1건) -- 거리 충분, LOW
- EX-2 찾기형 정답 노출 (4건) -- 규칙상 OK
- SCHEMA-DET-PATTERN (2건) -- det.korean 형식 권장
- T39 어순배열 순서 (1건)

## Sign-off

- [ ] jacob 확인
- [x] 퀴즈 Q8 선지 ② 수정 완료 (학사→박사 불일치 명확화)
