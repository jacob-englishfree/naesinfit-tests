# 32번 출제·검수 증적 리포트 (Framing of Pain)

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/10월_2024/32번` (2024년 10월 고1 모의고사 32번, 빈칸 지문)
**작성**: Opus 출제자 (generate-audit-report.js가 파일 0개로 오집계 → 직접 작성)

## 최종 요약

| 항목 | 단어 | 워크북 | 퀴즈 |
|---|---|---|---|
| 문항 수 | 20 | 20 | 20 |
| 총점 | 100 | 100 | 100 |
| validate | PASS | PASS | PASS |
| blind (자체) | 20/20 | 20/20 | 20/20 |
| cross-blind (독립재풀이) | 20/20 일치 | 20/20 일치 | 20/20 일치 |
| adversarial HIGH | 0 | 0 | 0 |
| adversarial MED/LOW | 0 / 1 | 0 / 2 | 0 / 2 |
| ans 분포(mc) | — | {1:4,2:5,3:2,4:5} | {1:4,2:5,3:3,4:3} |

- **N7 크로스파일**: `[PASS] 워크북↔예상문제 정답 중복 0건`
- validate 잔여 경고는 전부 [B]급(비차단): 마커형 passage 프리픽스 대조(P2), 추론 빈칸 오답이 본문 밖(Q6-WEAK-DISTRACTOR) — 정상.

## 배점 분포 (쉬움4 / 보통5 / 어려움6, 규칙 준수)

- 워크북: 쉬움5×4 + 보통10×5 + 어려움5×6 = 100
- 퀴즈: 쉬움5×4 + 보통10×5 + 어려움5×6 = 100

## 유형 구성

**워크북**: 어법×4, 어휘(부적절)×2, 내용이해 T/F×3, 빈칸추론×2, 내용 일치/불일치×2, 오류찾기×1, 서술형(찾기)×2, 어형변환×1, 주제/요지×2, 조건영작×1
**퀴즈**: 어법×3, 문맥상 부적절한 어휘×2, 빈칸추론×3, 내용 일치/불일치×3, 주제×1, 제목×1, 함축의미 추론×1, 지칭추론×1, 조건영작×3, 어형변환×1, 어순배열×1
(퀴즈 서술형 = 조건영작/어형변환/어순배열만 — 룰24 준수. 내용이해 T/F는 워크북 전용, 퀴즈 미사용.)

## 지문 특이사항 반영

- 32번은 빈칸 지문으로 원문 정답 "how we frame the pain in our mind"가 이미 채워져 있음 → 새 빈칸/서술형 정답으로 이 표현 **미사용**(정답 노출 방지).
- 단어 테스트 기출 정답/포인트(extreme·friends·value·passive·deeply·sore·deficit·crazy·endurance·mobilise·boundaries·psychologically·covering·making friends·good pain 등)와 **다른 정답 스팬**으로 워크북·퀴즈 출제.

## N7 정답 스팬 분리 (워크북 ↔ 퀴즈, 정확 문자열 무중복)

- 워크북 정답 토큰: screaming / will be of value / practitioner / tissues / exploding / beyond the normal boundaries of human endurance
- 퀴즈 정답 토큰: sore tissues / to win a race / deep pressure treatment / some form of passive back pain therapy / believes / the practitioner pushes deeply into a painful part / those people who are crazy enough to push themselves / the patient calls that good pain
- 교집합 0 (check-wb-quiz-leak.py PASS)

## adversarial 상세 (HIGH 0)

- 워크북 Q10(추론 오답 본문 밖·소거 다소 쉬움/LOW), Q17(explode→exploding 병렬로 유일수렴/LOW)
- 퀴즈 Q14(지칭 they 동일문장·오답에 다음문장 주어 함정/LOW), Q18(부사 deeply 위치 2형태 → accept 배열로 양쪽 정답 처리, 억울감점 없음/LOW)

## 배포 가능 여부

✅ 증적 4종(blind·cross-blind·adversarial·audit) + validate + N7 충족, HIGH 0건. **배포는 총괄 담당(본 세션 미수행).**

### jacob 확인 권장
- [ ] 실기기 카카오톡 링크 스팟 풀이
- [ ] 워크북 Q17 / 퀴즈 Q18 서술형 accept 자동채점 확인
