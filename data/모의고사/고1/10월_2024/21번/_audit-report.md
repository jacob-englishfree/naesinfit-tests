# 21번 출제·검수 증적 리포트

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/10월_2024/21번` (2024년 10월 고1 모의고사 21번 — Seeing Is Not Believing / 함축의미 추론 지문)
**출제자**: Opus

## 최종 요약

| 테스트 | 문항 | 총점 | validate | blind | cross-blind | adversarial HIGH |
|---|---|---|---|---|---|---|
| 단어 | 20 | 100 | PASS | 20/20 | 20/20 일치 | 0 |
| 워크북 | 20 | 100 | PASS | 20/20 | 20/20 일치 | 0 |
| 퀴즈(예상문제) | 20 | 100 | PASS | 20/20 | 20/20 일치 | 0 |

- **N7 크로스파일(워크북↔예상문제) 정답 중복**: 0건 (PASS)
- 모든 mc passage = fullPassage 통째(85%+). 어형변환/영영풀이/오류찾기만 발췌.

## 배점 분포 (3종 공통: 쉬움 5×4 + 보통 10×5 + 어려움 5×6 = 100)

| 테스트 | 쉬움(4점) | 보통(5점) | 어려움(6점) |
|---|---|---|---|
| 단어 | Q1,4,5,7,10 | Q2,6,8,9,11,12,13,16,17,19 | Q3,14,15,18,20 |
| 워크북 | Q1,2,7,12,18 | Q3,5,6,8,9,10,13,15,17,19 | Q4,11,14,16,20 |
| 퀴즈 | Q1,8,14,16,19 | Q2,4,6,7,9,10,11,15,17,20 | Q3,5,12,13,18 |

## 정답 분포 (동일번호 ≤5, 연속 ≤2 — 전부 충족)

- 단어 mc ans: {1:5, 2:5, 3:5, 4:3}
- 워크북 mc ans: {1:4, 2:4, 3:5, 4:3}
- 퀴즈 mc ans: {1:4, 2:4, 3:4, 4:3}

## 유형 구성

- **단어**: (A)(B)(C) 조합형×3 / 문맥상 부적절한 어휘×3 / 빈칸 어휘 완성×3 / 동의어×3 / 반의어×2 / 다의어×1 / 영영풀이×1 / 어형변환×2 / 빈칸 문맥 완성×2
- **워크북**: 어법×4 / 어휘(부적절)×2 / 내용이해 T·F×3 / 빈칸추론×2 / 내용 일치·불일치×2 / 오류찾기×1 / 서술형(찾기)×2 / 서술형-어형변환×1 / 주제·요지×2 / 서술형-조건영작×1
- **퀴즈**: 어법×3 / 부적절 어휘×2 / 빈칸추론×3 / 내용 일치·불일치×3 / 주제×1 / 제목×1(영어선지) / 함축의미×1(Seeing is not believing 밑줄) / 지칭추론×1 / 서술형-조건영작×3 / 어형변환×1 / 어순배열×1

## N7 회피 설계 (워크북 ↔ 퀴즈 정답 분리)

- 워크북 서술형/빈칸 정답: `eyewitness testimony`, `the lens of everything we know`, `reconstructed`, `seeing the world as it is`, `played back like a movie`, `We reconstruct memories rather than retrieving the video from memory`
- 퀴즈 서술형/빈칸 정답: `a more efficient way to store information`, `learned`, `make connections between what they have learned`, `We recode what we see through the lens of everything we know`, `we see the world through our assumptions`, `an optimal image compression algorithm`, `break it up into shapes, colors, and concepts`, `assumptions, motivations, and past experiences`
- 겹치는 exact 정답 0건 → N7 PASS
- 어법 포인트도 분리: 워크북(동명사주어 comes/주어일치 struggle/관계사 what/동격 that/병렬 make) vs 퀴즈(형용사적 to부정사 to store/전치사+동명사 seeing/병렬 수동 played)

## 난이도 위계

- 단어(쉬움: 동의어·반의어·(A)(B)(C)) < 워크북(중간: 어법·T/F·서술형 찾기) < 퀴즈(어려움: 복합 어법·영어선지 제목·함축·간접 추론·구문활용 조건영작)

## 게이트 결과

- validate 3파일 PASS (S/A급 0). 잔여 B급 경고: 단어(EX-3/P2/Q6-WEAK — (A)(B)(C)·빈칸 어휘 오답 본문부재, 비차단), 워크북(RENDER-ANS-NOT-UNDERLINED Q14 — 오류찾기는 `<u>` 금지 규칙상 정상, 비차단)
- blind 3파일 20/20, cross-blind 3파일 20/20 일치, FLAG 0
- adversarial HIGH 0 / MED 0 / LOW 6 (단어 2·워크북 2·퀴즈 2, 전부 채점 안전·정답 유일 확인된 관례 항목)

## 배포 가능 여부

✅ **배포 가능** — 3종 전 증적 충족, HIGH 0건, N7 PASS

### jacob 본인 확인 권장
- [ ] 실기기 카카오톡에서 학생 링크 접속 테스트
- [ ] 무작위 스팟 풀이
- [ ] 배포/DB등록/catalog는 총괄 담당
