# Pathways 4 Unit 5 "The Smart Swarm" — 테스트 증적 리포트

부교재 / 양지원 시험범위 (PATHWAYS 5과). 통합 지문(Reading 연속 흐름, 1673단어) — 명시적 지문 경계 없어 통째 유지.

## 3종 게이트 결과 (총괄 직접 재검증 2026-08-30)

| 테스트 | 문항 | 총점 | histKey | validate | anomaly-sweep | self-blind | cross-blind |
|---|---|---|---|---|---|---|---|
| 단어 | 20 | 100 | wordtest_pathways4_unit5_reading_v6 | PASS (S/A 0) | PASS | 20/20 | 20/20 CLEAN |
| 워크북 | 20 | 100 | workbooktest_pathways4_unit5_reading_v6 | PASS (S/A 0) | PASS | 20/20 | 20/20 CLEAN |
| 퀴즈 | 20 | 100 | quiztest_pathways4_unit5_reading_v6 | PASS (S/A 0) | PASS | 20/20 | 20/20 CLEAN |

## cross-leak (XTYPE) 3종 상호
- 단어↔워크북 / 단어↔퀴즈 / 워크북↔퀴즈 = 중복 0
- 수정 이력: 워크북 Q17 어형변환 wa가 단어 Q17과 `demonstrating` 중복(XTYPE-DUP) → fullPassage 단일형태 단어 `detecting`으로 교체

## 서술형 검증 (퀴즈 5문항)
- 조건영작(Q16·18·20)·어순배열(Q19): 정답이 passage에 있으나 단어 셔플 배열 유형이라 정답 노출 무관(validate 허용)
- 어법고쳐쓰기(Q17): 밑줄 `spread`(주어 News 단수 → 수일치 오류) → 정답 `spreads`, passage 0회 노출 확인

## 배점 분포
- 쉬움 5×4=20 / 보통 10×5=50 / 어려움 5×6=30 = 100 (3종 동일)

배포: deploy-json + generate-catalog(Pathways4 units에 Unit5 반영). catalog sections Unit5=['전체'].
