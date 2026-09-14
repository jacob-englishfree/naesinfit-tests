# 30번 출제·검수 증적 리포트

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/6월_2024/30번` — 2024년 6월 고1 30번 "Saving for Future Consumption" (어휘부적절 지문)
**담당**: Opus 출제자 (단어/워크북/예상문제 3종)

## 최종 요약

| 항목 | 결과 |
|---|---|
| 테스트 종류 | 단어 / 워크북 / 예상문제(퀴즈) 3종 |
| validate | 3/3 PASS (S/A급 0건) |
| blind 20/20 일치 | 3/3 PASS |
| cross-blind verify | 3/3 PASS (각 20/20) |
| adversarial HIGH | 0건 (전 종) |
| N7 워크북↔퀴즈 정답중복 | PASS (0건) |

## 파일별 검수 상태

| 종류 | 문항 | 총점 | 난이도(쉬움/보통/어려움) | mc ans 분포 | validate | blind | cross | adv(H/M/L) |
|---|---|---|---|---|---|---|---|---|
| 단어 | 20 | 100 | 5/10/5 | 1:5 2:5 3:4 4:4 | PASS | 20/20 | 20/20 | 0/0/3 |
| 워크북 | 20 | 100 | 5/10/5 | 1:4 2:4 3:4 4:4 | PASS | 20/20 | 20/20 | 0/1/2 |
| 예상문제 | 20 | 100 | 5/10/5 | 1:3 2:4 3:4 4:4 | PASS | 20/20 | 20/20 | 0/2/2 |

- 배점: 쉬움 5×4 + 보통 10×5 + 어려움 5×6 = 100 (3종 동일)
- ans 규칙: 1-based, 동일번호 최대 5 이내, 3연속 없음 (3종 모두 준수)

## 유형 구성

- **단어**: (A)(B)(C) 조합형×3, 문맥상 부적절 어휘×3, 빈칸 어휘×3, 동의어×3, 반의어×2, 다의어×1, 영영풀이×1, 어형변환×2, 빈칸 문맥완성×2
- **워크북**: 어법×4, 어휘(부적절)×2, 내용이해 T/F×3, 빈칸추론×2, 내용일치/불일치×2, 오류찾기×1, 서술형(찾기/어형변환/조건영작)×4, 주제/요지×2
- **예상문제**: 어법×3(분사 태·전치사·부사/형용사), 부적절 어휘×2, 빈칸추론×3(구절 단위), 내용일치/불일치×3(패러프레이즈), 주제×1·제목×1(영어 선지), 함축×1, 지칭×1, 서술형 조건영작×3·어형변환×1·어순배열×1

## 난이도 위계 (단어 < 워크북 < 예상문제)

- 단어: 단어 의미/철자 중심, 부적절 어휘 정답 1개만 반의어 교체
- 워크북: 어법 수일치·병렬·목적 to부정사, T/F·일치, 서술형 찾기형 허용
- 예상문제: 복합 어법(분사 태·전치사 콜로케이션·부사 vs 형용사), 구절 단위 빈칸추론, 영어 주제·제목 선지, 조건영작/어순배열/어형변환만(룰24 준수)

## N7 크로스파일 (워크북↔예상문제)

- 워크북 정답영역: future consumption, the greatest benefit(빈칸), summer vacation·weakness of will·envisioned·the agent gives up some immediate pleasure(서술형), 부적절 strength/differently
- 예상문제 정답영역: uses their savings prematurely·a delayed reward over an immediate one·temptation for immediate pleasure(빈칸), a preference of a delayed reward·prematurely·resolve to spend their savings in a certain way·an employee might set aside money to buy Christmas presents·many human and non-human animals save commodities(서술형)
- → 정답 중복 0건. 서로 다른 지문영역·문법포인트·정답 확인 (check-wb-quiz-leak.py PASS)

## adversarial 잔여 이슈 (HIGH 0)

- 단어: LOW 3 (EX-3 abc 노출은 조합형 정상형식·validate 오탐 / 빈칸 오답 본문 미등장 — 어휘학습 허용)
- 워크북: MED 1 (Q20 조건영작 'gives up' 분리형 구동사 → 분리형 accept 추가로 완화), LOW 2 (Q1~4 유사구조 반복·Q15 찾기형 관사)
- 예상문제: MED 2 (Q19 어순배열 set aside 분리형 accept 추가·Q20 human/non-human 어순은 우리말로 고정), LOW 2 (Q3 differently 구어논란·Q15 원문 논리)

## 배포 가능 여부

✅ **증적 충족** — validate PASS + blind 20/20 + cross-blind 20/20 + adversarial HIGH 0 + N7 PASS (3종 전부)
⛔ 배포·DB등록·shared·catalog는 총괄 담당. 본 세션은 파일 생성까지만 수행.

### jacob 본인 확인 권장
- [ ] 실기기 카카오톡에서 학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이
