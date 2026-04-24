# 2026 고3 3월 모의고사 Audit Report

**생성일**: 2026-04-23
**검수자**: claude-opus-4.6 (1M context)
**대상**: 22개 번호 x 3종(단어/워크북/퀴즈) = 66파일, 1,320문항
**원문 출처**: 2026_고3_3월_모의고사_내신핏버전합본.pdf

---

## 1. SOP 단계별 완료 현황

| STEP | 단계명 | 상태 | 비고 |
|------|--------|------|------|
| 0 | 원문 확보 | DONE | _passages/ 폴더에 22개 번호 fullPassage JSON 확보 |
| 1 | 출제 | DONE | 66파일 전부 .prompt.json + .response.json + .json 생성 |
| 2 | 구조 검증 (validate) | PARTIAL | 아래 상세 참조 |
| 3 | 블라인드 풀이 | DONE | 66/66 .blind.json 존재 |
| 4 | 정답 대조 (cross-blind) | DONE | 66/66 .cross-blind.json 존재 |
| 5 | 적대적 공격 | PARTIAL | 63/66 .adversarial.json 존재 (29번 3파일 + 40번 1파일 미완) |
| 6 | 자동 검증 | PARTIAL | validate FAIL 잔존 |
| 7 | 증적 리포트 | THIS FILE | |
| 8 | jacob 확인 후 배포 | PENDING | |

---

## 2. validate 결과 요약

### PASS (37/66)

| 번호 | 단어 | 워크북 | 퀴즈 |
|------|------|--------|------|
| 24번 | PASS | PASS | PASS |
| 30번 | PASS | PASS | PASS |
| 34번 | PASS | PASS | PASS |
| 36번 | PASS | PASS | PASS |
| 39번 | PASS | PASS | PASS |

18/19/20/21/22/23/26/29/31/32/33/40번: 워크북+퀴즈 PASS, 단어만 FAIL
38번: 워크북+퀴즈 PASS, 단어만 FAIL (23 errors)
41-42번: 워크북 PASS, 단어+퀴즈 FAIL

### FAIL (29/66)

주요 FAIL 원인별 분류:

| 원인 | 해당 파일 수 | 설명 |
|------|-------------|------|
| A6 정답 분포 초과 | ~18 | 단어 테스트에 집중. 정답 1번 편중 |
| A7 연속 정답 | ~18 | 3연속 이상 동일 번호 |
| S-ORDER-MARKER-LEAK | 43-45번 전체 (3파일) | 장문 (A)(B)(C)(D) 마커 잔류 |
| Q6-WEAK-DISTRACTOR | 산재 | 소거법 가능 오답 |
| A-MORPH-BASE-NOT-IN-FP | 산재 | 어형변환 원형 미포함 |
| 37번 전체 | 3파일 | 대규모 에러 (16+19+20) |

### 긴급 수정 필요 (S급 위반)

- **41-42번 단어**: A6 (정답 1번 14개/20) + A7 (10개 연속 위반)
- **43-45번 단어**: A6 (정답 1번 7개, 2번 7개) + A7 (4개 연속 위반)
- **43-45번 워크북/퀴즈**: S-ORDER-MARKER-LEAK 20문항씩 (장문 마커 미제거)

---

## 3. blind / cross-blind 결과 요약

- **blind**: 66/66 완료
- **cross-blind**: 66/66 완료
- 불일치 건수: 별도 cross-blind 분석 필요 (본 audit에서는 존재 여부만 확인)

---

## 4. adversarial 이슈 요약 (41-42번 / 43-45번)

### 41-42번

| 파일 | HIGH | MEDIUM | LOW | 판정 |
|------|------|--------|-----|------|
| 단어 | 2 | 3 | 2 | FAIL |
| 워크북 | 0 | 3 | 2 | CONDITIONAL PASS |
| 퀴즈 | 0 | 3 | 2 | CONDITIONAL PASS |

**41-42번 단어 HIGH 이슈**:
1. A6/A7 정답 분포 — 20문항 중 14문항이 정답 1번. 찍기만 해도 70점.
2. Q8 복수정답 가능 — vision vs version, 원문 암기 없이 구별 불가.

### 43-45번

| 파일 | HIGH | MEDIUM | LOW | 판정 |
|------|------|--------|-----|------|
| 단어 | 2 | 2 | 1 | FAIL |
| 워크북 | 1 | 1 | 2 | FAIL |
| 퀴즈 | 1 | 3 | 1 | FAIL |

**43-45번 공통 HIGH 이슈**:
1. S-ORDER-MARKER-LEAK — 장문 지문의 (A)(B)(C)(D) 단락 마커가 비순서배열 유형에 잔류.
   - 43-45번은 순서가 뒤섞인 장문(서사)이 아니라 4개 단락 구성이므로, passage에서 "(A)\n"/"(B)\n" 등의 마커를 제거하고 빈 줄만으로 단락 구분해야 함.
2. 단어: 정답 분포 A6/A7 위반.

**43-45번 퀴즈 MEDIUM 이슈**:
- Q18 어순배열이 LAST 그룹에 배치 (FIRST 그룹 규칙 위반)
- Q20 서술형 영작 wa가 문장 미완성 ('prepared an extra mattress so that her')

---

## 5. 전체 파일 현황 (22번호)

| 번호 | 단어V | 워크북V | 퀴즈V | blind | cross-blind | adversarial | 배포가능 |
|------|-------|---------|-------|-------|-------------|-------------|---------|
| 18 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 19 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 20 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 21 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 22 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 23 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 24 | PASS | PASS | PASS | 3/3 | 3/3 | 3/3 | YES |
| 26 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 29 | FAIL | PASS | PASS | 3/3 | 3/3 | 0/3 | NO |
| 30 | PASS | PASS | PASS | 3/3 | 3/3 | 3/3 | YES |
| 31 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 32 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 33 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 34 | PASS | PASS | PASS | 3/3 | 3/3 | 3/3 | YES |
| 35 | FAIL | FAIL | FAIL | 3/3 | 3/3 | 3/3 | NO |
| 36 | PASS | PASS | PASS | 3/3 | 3/3 | 3/3 | YES |
| 37 | FAIL | FAIL | FAIL | 3/3 | 3/3 | 3/3 | NO |
| 38 | FAIL | PASS | PASS | 3/3 | 3/3 | 3/3 | NO |
| 39 | PASS | PASS | PASS | 3/3 | 3/3 | 3/3 | YES |
| 40 | FAIL | PASS | PASS | 3/3 | 3/3 | 2/3 | NO |
| 41-42 | FAIL | PASS | FAIL | 3/3 | 3/3 | 3/3 | NO |
| 43-45 | FAIL | FAIL | FAIL | 3/3 | 3/3 | 3/3 | NO |

---

## 6. 배포 판정

### 즉시 배포 가능 (5개 번호 / 15파일)
24번, 30번, 34번, 36번, 39번

### 수정 후 배포 가능 (17개 번호 / 51파일)
나머지 전부. 주요 수정 사항:

1. **단어 테스트 정답 분포**: 대부분 단어 테스트에서 A6/A7 위반. 정답 번호 재분배 필요.
2. **43-45번 (A)(B)(C)(D) 마커 strip**: 장문 지문의 단락 마커를 비순서배열 유형에서 제거.
3. **37번 전체 재출제**: 3종 모두 대규모 에러 (55 errors 합계).
4. **41-42번 단어 Q8**: vision/version 복수정답 해소.
5. **퀴즈 어순배열 순서**: 41-42번, 43-45번 퀴즈의 어순배열을 FIRST 그룹으로 이동.
6. **29번 adversarial 미완**: 3파일 adversarial 검수 필요.
7. **40번 adversarial 1파일 미완**: 퀴즈 adversarial 검수 필요.

---

## 7. 다음 단계

1. 단어 테스트 정답 분포 일괄 수정 (18~43-45번)
2. 43-45번 passage (A)(B)(C)(D) 마커 strip
3. 37번 전면 재출제
4. 29번/40번 adversarial 검수 완료
5. validate 전체 재실행 → ALL PASS 확인
6. jacob 최종 확인 후 배포
