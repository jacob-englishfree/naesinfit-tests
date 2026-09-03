# Cross-Blind Audit — QN36-37 1번 / 퀴즈(예상문제)

- 검증 모델: Opus (cross-blind, 정답 미열람 풀이)
- 지문: "The Danger of Inflexible Stereotypes"
- 결과: **PASS 20/20** (cross-blind 답 = 원본 ans/wa 전부 일치)

## 풀이 근거 요약
- 어법 Q1~3: ③sorts(→sort) / ②we examine(→do we examine, 도치) / ④to preserve(→to be preserved) 단일 오류
- 어휘부적절 Q4~5: ②positive connotations / ①high benefit(→high cost) 단일
- 빈칸 Q6/7/15: a useful feature / negative connotations / the differences between them
- 내용일치 Q8~10, 주제/제목/함축/지칭 Q11~14: 본문 대응 명확
- 서술형 Q16~20: 조건영작·어순배열·어법고쳐쓰기 전부 유일 수렴 (accept에 등위/부사 어순 변형 반영)

## 오류 판정
- 진짜 정답 오류: **없음**
- 복수정답·정답노출: 없음 (빈칸 정답구 전부 블랭크 처리·해당 위치 유일 등장)
- 서술형 자동채점: 전 항목 유일 수렴 확인 (Q18/19/20 대안 어순 accept 반영)

## 참고 (LOW, 비오류)
- Q17 유형 '어법고쳐쓰기'는 예상문제 서술형 화이트리스트(조건영작/어순배열/어형변환) 밖. 단 정답 'differentiated' 1단어 유일 수렴이라 채점 안전. 2번 퀴즈 Q17도 동일 설계. → adversarial.json에 기록.
