# 30번 출제·검수 증적 리포트

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/10월_2024/30번` (2024년 10월 고1 모의고사 30번 — Socially Distributed Cognition)
**출제 모델**: Opus 4.8 (1M)

## 최종 요약

| 항목 | 결과 |
|---|---|
| 테스트 종류 | 단어 / 워크북 / 퀴즈(예상문제) 3종 |
| 각 20문항 / 100점 (쉬움5×4 + 보통10×5 + 어려움5×6) | ✅ |
| validate | 단어 PASS / 워크북 PASS / 퀴즈 PASS (S·A급 0건, B급 경고만) |
| blind.json | 3/3 존재, 자체 20/20 일치 |
| cross-blind | 3/3 독립 재풀이 20/20 일치 |
| adversarial HIGH | 0건 (3파일 전부) |
| N7 크로스파일(워크북↔퀴즈) | PASS (정답 중복 0건) |

## 파일별 검수 상태

| 섹션 | validate | blind | cross-blind | adversarial(H/M/L) |
|---|---|---|---|---|
| 단어.json | PASS(9 B경고) | 20/20 | 20/20 | 0 / 0 / 1 |
| 워크북.json | PASS(5 B경고) | 20/20 | 20/20 | 0 / 0 / 2 |
| 퀴즈.json | PASS(3 B경고) | 20/20 | 20/20 | 0 / 1 / 1 |

B급 경고는 마커/어형변환/(A)(B)(C) 유형 특성상 발생하는 비차단 경고(원문 대조 안내·정답 단어 지문 내 자연 노출)로, 실제 출제 결함 아님.

## 배점 분포 (3종 공통)
- 쉬움 5문항 × 4점 = 20점
- 보통 10문항 × 5점 = 50점
- 어려움 5문항 × 6점 = 30점
- 총 100점 / ans 분포 최대 5개·연속 2개 이하 준수

## 유형 구성
- **단어**: (A)(B)(C) 조합형 ×3, 문맥부적절 어휘 ×3, 빈칸어휘 ×3, 동의어 ×3, 반의어 ×2, 다의어, 영영풀이, 어형변환 ×2, 빈칸문맥 ×2
- **워크북**: 어법 ×4, 어휘 ×2, 내용이해 T/F ×3, 빈칸추론 ×2, 일치/불일치 ×2, 오류찾기, 서술형(찾기) ×2, 어형변환, 주제/요지 ×2, 조건영작
- **퀴즈**: 어법 ×3(복합 포인트), 문맥부적절 어휘 ×2, 빈칸추론 ×3(구절 단위), 일치/불일치 ×3, 주제, 제목, 함축의미, 지칭추론, 서술형 조건영작 ×3+어형변환+어순배열

## N7 크로스파일 분리 (워크북 vs 퀴즈)
- 워크북 정답/빈칸: computation, a larger whole, independently, "We are just doing our part in a larger computation", generation by generation, how to interact with technologies
- 퀴즈 정답/빈칸: compute answers independently, socially learn the right answers, use the interface and flush, "We understand things well enough to benefit from them", works, "All that needs to be transmitted is which button to push", "As we lack the resources to compute answers", "Herbert Simon won his Nobel Prize for recognizing our limitations"
- 두 집합 교집합 0건 → `check-wb-quiz-leak.py` PASS

## 규칙 준수 체크
- [x] 모의고사 mc passage = fullPassage 통째 (어형변환·영영풀이·다의어만 발췌 예외)
- [x] overlay 마커/빈칸/밑줄 = fullPassage 정확 substring, 본문 전체 분산
- [x] 퀴즈 서술형 = 조건영작/어형변환/어순배열만 (찾기·핵심단어형 미사용)
- [x] 조건영작 [조건]에 wa 전 토큰(기능어 포함) 명시, 알파벳 셔플, 정답 미노출
- [x] 퀴즈 빈칸 = 구절(2단어+), 영어선지 → det.analysis 한국어 해석 병기
- [x] 오류찾기 passage에 `<u>` 미사용
- [x] 난이도 위계: 단어(쉬움) < 워크북(중간) < 퀴즈(내신 예상문제 수준)
- [x] _passages/30번.json 원문 미수정

## 배포 가능 여부
✅ 배포 게이트 충족 — validate PASS + blind + cross-blind(일치) + adversarial(HIGH 0) + N7 PASS

### jacob 본인 확인 권장
- [ ] 실기기 카카오톡 링크 접속 렌더 확인
- [ ] 무작위 스팟 풀이 (퀴즈 5문항)
