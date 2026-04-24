# Audit Report: 빠른독해바른독해 구문독해 1과 4번

## 테스트 현황

| 테스트 | 문항 | 총점 | validate | blind | adversarial |
|--------|------|------|----------|-------|-------------|
| 단어 | 20 | 100 | PASS (9 warnings) | 20/20 | 0 HIGH, 1 MEDIUM, 1 LOW |
| 워크북 | 20 | 100 | PASS (7 warnings) | 20/20 | 0 HIGH, 0 MEDIUM, 5 LOW |
| 퀴즈 | 20 | 100 | PASS (7 warnings) | 20/20 | 0 HIGH, 1 MEDIUM, 4 LOW |

## 배점 분포 (전 테스트 공통)

- 쉬움: 5문항 x 4점 = 20점
- 보통: 10문항 x 5점 = 50점
- 어려움: 5문항 x 6점 = 30점

## Adversarial Issues

### 단어 (0 HIGH, 1 MEDIUM, 1 LOW)
- **MEDIUM Q2**: (A)(B)(C) 마커 중첩 포맷 — (C)가 (A) 내부에 중첩되어 렌더링 문제 가능성
- Q15: condition의 '질환' vs '상태' 구분 미묘하나 문맥상 정답 명확

### 워크북 (0 HIGH, 0 MEDIUM, 5 LOW)
- Q10, Q15, Q16: passage 노출 (구조적/찾기 유형)
- Q14: 문법포인트(be+V-ing) 테스트 내 반복
- Q17: 어순배열 stem 단어수 표기(13단어)와 정답 단어수(14단어) 불일치

### 퀴즈 (0 HIGH, 1 MEDIUM, 4 LOW)
- **MEDIUM Q1**: det.analysis 설명이 passage 내용과 불일치 (make 문맥 vs have been 문맥). 정답 자체는 정확
- Q3: common→commonly 문법포인트 워크북과 중복
- Q13: 이중 부정 함축의미가 6점 어려움 대비 쉬움
- Q16, Q17: 찾기 유형 passage 노출

## Validate Warnings 요약

- histKey 패턴 불일치 (3건) — 기존 구조 유지
- (A)(B)(C) 정답 단어 passage 노출 (3건) — 부교재 fullPassage 원칙
- 빈칸/서술형 정답 passage 노출 (B급, 찾기 유형 포함)
- passage 앞부분 fullPassage 불일치 (마커/빈칸 오버레이에 의한 차이)
- 어순배열 그룹 순서 (1건)

## Sign-off

- [ ] jacob 확인
