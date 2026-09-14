# 22번 출제·검수 증적 리포트 (워크북 / 퀴즈)

**생성일**: 2026-09-13
**대상**: `data/모의고사/고2/6월_2022/22번`
**지문**: 22번 — Custom-Design Your Parenting (요지, 정원사 비유 / 2022년 고2 6월 모의고사, 5문장·140단어)
**비고**: 모의고사 번호 폴더는 테스트 파일이 직접 위치(하위 지문 폴더 없음)하여 `generate-audit-report.js` 자동 집계가 0으로 나옴 → 실측 결과로 수동 작성. 단어.json은 기존 완성본(수정하지 않음).

## 최종 요약

| 항목 | 워크북 | 퀴즈 |
|---|---|---|
| 문항 수 | 20 | 20 |
| 총점 | 100 | 100 |
| 배점 분포 | 쉬움 5×4 / 보통 10×5 / 어려움 5×6 | 쉬움 5×4 / 보통 10×5 / 어려움 5×6 |
| validate | **PASS** (S/A 0, warn 6) | **PASS** (S/A 0, warn 5) |
| blind 풀이 | **20/20 일치** | **20/20 일치** |
| cross-blind | **20/20 일치** | **20/20 일치** |
| adversarial HIGH | **0** | **0** (Q18 HIGH 재출제로 해소) |
| ans 분포 | {1:5, 2:4, 3:3, 4:4} | {1:4, 2:5, 3:4, 4:2} |

## 유형 구성

**워크북**: 어법×4(Q1~4), 문맥어휘×2(Q5~6), 내용이해 T/F×3(Q7~9), 빈칸추론×2(Q10~11), 내용일치/불일치×2(Q12~13), 오류찾기×1(Q14), 서술형 찾기×2(Q15~16), 어형변환×1(Q17), 주제/요지×2(Q18~19), 조건영작×1(Q20)

**퀴즈**: 어법×3(Q1~3), 문맥부적절어휘×2(Q4~5), 빈칸추론×3(Q6·7·15), 내용일치/불일치×3(Q8~10), 주제×1(Q11), 제목×1(Q12), 함축의미×1(Q13), 지칭추론×1(Q14), 조건영작×3(Q16·18·20), 어형변환×1(Q17), 어순배열×1(Q19)

## 난이도 위계 확인
- 워크북(중간): 기본 어법·T/F·주제 중심. 서술형은 찾기·기본 조건영작.
- 퀴즈(어려움): 복합 어법(병렬·주어일치), 영어 제목 선지, 함축·간접지칭, 조건영작 3종+어순배열. 워크북보다 상위.

## N7 크로스파일 (워크북 ↔ 퀴즈)
- **PASS — 정답 중복 0건** (`validate/check-wb-quiz-leak.py`).
- 워크북 정답 토큰: possible / who our children really are / one style of parenting / the natural needs of each individual child / accepting / make changes in our parenting style.
- 퀴즈 wa·blank: the right conditions / each individual child / how to make changes / it ignores the most important variable in the equation / adopting / one style of parenting will work with every child / once we understand who our children really are / we parents need to custom-design our parenting.
- 세 답안군 상호 배타. 빈칸·어형변환(암기 유출 벡터) 정답은 이미 완성된 단어.json 정답(flourish/resistance/variable/custom-design/uniqueness/ignores/blessed/thrive/needs/hard/negative/easy)과 회피.

## 적대 검수 이력
- 퀴즈 Q18: 초기 양보문(although/that/it) → it·that 대칭으로 동일 의미 대체 배열 성립(HIGH) → S2 문장 'one style of parenting will work with every child'로 재출제하여 해소.
- 잔여 이슈: 워크북 2 low(주제/요지 주제축 중복, 찾기형 정답 지문 노출=EX-2 예외), 퀴즈 2 low(Q20 대체배열은 우리말 뜻이 유일 수렴, Q18 재출제이력). HIGH·MED 0.

## 배포 가능 여부
- **워크북·퀴즈 모두 게이트 통과** (validate PASS + blind 20/20 + cross 20/20 + adversarial HIGH 0 + N7 PASS).
- 배포·DB등록·catalog·shared는 총괄 담당(본 세션 미실행).
