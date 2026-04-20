# Audit Report: 빠른독해바른독해 구문독해 1과 3번

## 테스트 현황

| 테스트 | 문항 | 총점 | validate | blind | adversarial |
|--------|------|------|----------|-------|-------------|
| 단어 | 20 | 100 | PASS (15 warnings) | 20/20 | 0 HIGH, 0 MEDIUM, 4 LOW |
| 워크북 | 20 | 100 | PASS (6 warnings) | 20/20 | 0 HIGH, 1 MEDIUM, 4 LOW |
| 퀴즈 | 20 | 100 | PASS (4 warnings) | 20/20 | 0 HIGH, 1 MEDIUM, 4 LOW |

## 배점 분포 (전 테스트 공통)

- 쉬움: 5문항 x 4점 = 20점
- 보통: 10문항 x 5점 = 50점
- 어려움: 5문항 x 6점 = 30점

## Adversarial Issues

### 단어 (0 HIGH, 0 MEDIUM, 4 LOW)
- Q7, Q8, Q9, Q19: 빈칸 정답이 fullPassage에 노출 (부교재 passage=fullPassage 원칙에 의한 구조적 특성)

### 워크북 (0 HIGH, 1 MEDIUM, 4 LOW)
- **MEDIUM Q20**: 조건영작에 8단어 전부 제공 — 사실상 어순배열과 동일. 조건영작 고유의 사고력 부족
- Q5: 마커 순서가 passage 등장 순서와 불일치 (풀이 지장 없음)
- Q10, Q15, Q16: passage 노출 (구조적/찾기 유형)

### 퀴즈 (0 HIGH, 1 MEDIUM, 4 LOW)
- **MEDIUM Q4**: identical vs similar 구분이 미묘. 원문 대조 시 정답 명확하나 학생이 혼동할 여지 있음
- Q7, Q16, Q17, Q19: passage 노출/찾기 유형/쉬운 조건

## Validate Warnings 요약

- histKey 패턴 불일치 (6건) — 기존 구조 유지
- (A)(B)(C) 정답 단어 passage 노출 (3건) — 부교재 fullPassage 원칙
- 빈칸/서술형 정답 passage 노출 (B급, 찾기 유형 포함)
- passage 앞부분 fullPassage 불일치 (마커/빈칸 오버레이에 의한 차이)
- 어순배열 그룹 순서 (1건)

## Sign-off

- [ ] jacob 확인
