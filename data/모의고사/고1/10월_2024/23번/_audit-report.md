# 23번 출제·검수 증적 리포트

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/10월_2024/23번`
**지문**: 2024년 10월 고1 모의고사 23번 — "Concrete Questions for Reliable Data" (주제, 원문 정답 ⑤)

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 3 (단어/워크북/퀴즈) |
| validate PASS | 3/3 |
| blind.json 20/20 | 3/3 |
| cross-blind 20/20 일치 | 3/3 |
| adversarial HIGH | 0건 |
| adversarial MED | 0건 |
| adversarial LOW | 8건 (단어 2·워크북 3·퀴즈 3, 채점 무영향 관례 메모) |
| N7 (워크북↔퀴즈 정답 중복) | PASS (0건) |

## 파일별 검수 상태

| 파일 | 문항 | 총점 | 배점분포 | validate | blind | cross-blind | adv HIGH |
|---|---|---|---|---|---|---|---|
| 단어.json | 20 | 100 | 쉬움5×4+보통10×5+어려움5×6 | PASS | 20/20 | 20/20 일치 | 0 |
| 워크북.json | 20 | 100 | 쉬움5×4+보통10×5+어려움5×6 | PASS | 20/20 | 20/20 일치 | 0 |
| 퀴즈.json | 20 | 100 | 쉬움5×4+보통10×5+어려움5×6 | PASS | 20/20 | 20/20 일치 | 0 |

## 유형 구성

- **단어**: (A)(B)(C) 조합형×3, 문맥상 부적절한 어휘×3, 빈칸 어휘×3, 동의어×3, 반의어×2, 다의어×1, 영영풀이×1, 어형변환×2, 빈칸 문맥×2
- **워크북**: 어법×4, 어휘(부적절)×2, 내용이해 T/F×3, 빈칸추론×2, 내용 일치/불일치×2, 오류찾기×1, 서술형(찾기)×1, 서술형 조건영작×2, 서술형 어형변환×1, 주제/요지×2
- **퀴즈(예상문제)**: 어법×3, 문맥상 부적절한 어휘×2, 빈칸추론×3, 내용 일치/불일치×3, 주제×1, 제목×1, 함축의미×1, 지칭추론×1, 서술형 조건영작×3, 어형변환×1, 어순배열×1

## 난이도 위계 (단어 < 워크북 < 퀴즈)

- 단어: 어휘 인지 중심 (동의어/반의어/조합형)
- 워크북: 어법·내용이해·빈칸추론 + 서술형(찾기/조건영작)
- 퀴즈: 복합 어법(전치사+동명사·병렬), 패러프레이즈 내용일치, 함축·지칭, 서술형 3종(조건영작/어형변환/어순배열)

## N7 분리 확인 (워크북 vs 퀴즈)

- 워크북 정답 토큰: abstract, seek concrete responses, quantitative data, help make abstract concepts clearer, smiles, but it might not be reliable
- 퀴즈 정답/빈칸 토큰: a concrete answer, vary widely, consistency from one study to the next, you can afford to pay them, definitions, instead of asking people to rate, a study of happiness might measure the number of times someone smiles, the number of items an individual can recall
- 교집합 0건 → `check-wb-quiz-leak.py` PASS

## 적대 검수 잔여(LOW, 채점 무영향)

- 단어 Q1/(A)(B)(C) 정답 원문 노출: 조합형 유형 본질(오답 문맥 변별 필요)
- 워크북 Q15 찾기형 정답 노출: EX-2 예외(찾기 유형)
- 퀴즈 Q18/Q19 서술형: 후속 문맥·부사 부재로 정답 배열 유일, 복수정답 위험 없음

## 배포 가능 여부

✅ **배포 가능** — 3종 전부 validate PASS + blind/cross-blind 20/20 일치 + adversarial HIGH 0 + N7 PASS

### jacob 본인 확인 필요
- [ ] 실기기 카카오톡에서 학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이
- [ ] 배포(DB/catalog/test-deploy)는 총괄 담당
