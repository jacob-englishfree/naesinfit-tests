# Audit Report: 빠른독해바른독해 구문독해 2과 6번

## 테스트 현황

| 테스트 | 문항 | 총점 | validate | blind | adversarial |
|--------|------|------|----------|-------|-------------|
| 단어 | 20 | 100 | PASS (7 warnings) | - | PASS (0 issues) |
| 워크북 | 20 | 100 | PASS (5 warnings) | - | PASS (0 issues) |
| 퀴즈 | 20 | 100 | PASS (4 warnings) | - | PASS (0 issues) |

## Validate Warnings (B급, 차단 아님)

### 단어
- EX-3 x3: ABC 조합형(Q1-3) 정답 단어가 지문 내 다른 곳에 노출 -- 부교재 단어테스트 구조적 특성으로 허용
- C20: histKey 패턴 불일치 (기능 영향 없음)
- P2 x3: 다의어(Q15)/어형변환(Q18) passage가 fullPassage 외 별도 작성 -- 유형 특성상 정상

### 워크북
- EX-2 x2: Q15/Q16 서술형 wa가 지문에 노출 -- 찾기 유형(stem에 "본문에서 찾아")이므로 정당
- C20: histKey 패턴 불일치
- P2 x2: 어법(Q1)/어휘(Q5) passage 마커 삽입으로 시작 위치 차이 -- 정상

### 퀴즈
- EX-2 x2: Q16/Q17 서술형 wa가 지문에 노출 -- 찾기 유형이므로 정당
- C20: histKey 패턴 불일치
- T39: Q18 어순배열 그룹 배치 권고 -- 기능 영향 없음

## Adversarial Issues

없음. 6개 테스트 60문항 전수 검토 결과 이중답안, 약한 오답, 비정상적 정답 노출, 모호성 발견되지 않음.

## Sign-off

- [ ] jacob 확인
