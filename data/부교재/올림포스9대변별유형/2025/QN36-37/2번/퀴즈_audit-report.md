# Cross-Blind Audit — QN36-37 2번 / 퀴즈(예상문제)

- 검증 모델: Opus (cross-blind, 정답 미열람 풀이)
- 지문: "How Social Norms Emerge"
- 결과: **PASS 20/20** (cross-blind 답 = 원본 ans/wa 전부 일치)

## 풀이 근거 요약
- 어법 Q1~3: occur→occurs / behave→behaving / prescribe→prescribed 단일 오류
- 어휘부적절 Q4~5: reward / irregularity(문맥 반대어) 단일
- 빈칸/일치/주제/제목/함축/지칭: 원문 대조로 단일 정답
- 서술형 Q16~20: 조건단어·단어수(6/9/9/7단어)로 유일 수렴
  - Q16 the start of a norm occurs / Q17 decide / Q18 she may threaten to sanction them for not behaving
  - Q19 This will cause some to conform to her wishes / Q20 others ought to behave as she behaves

## 오류 판정
- 진짜 정답 오류: **없음**
- 복수정답·정답노출: 없음
- 참고(비오류): Q19 보기 토큰 'to' 2개(to conform / to her)로 어순 실수 유발 가능하나 한국어 뜻·문법상 정답 배열 유일 확정
- 참고(LOW, 비오류): Q17 '어법고쳐쓰기'는 예상문제 서술형 화이트리스트 밖이나 정답 'decide' 1단어 유일이라 채점 안전 (기존 2번 퀴즈.adversarial.json에 기록됨)
