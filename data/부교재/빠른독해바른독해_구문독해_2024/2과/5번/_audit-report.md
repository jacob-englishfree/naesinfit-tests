# Audit Report: 빠른독해바른독해 구문독해 2과 5번

> The Misunderstanding of the Manhattan Deal

## 테스트 현황

| 테스트 | 문항 | 총점 | 배점(쉬움/보통/어려움) | validate | blind | adversarial |
|--------|------|------|------------------------|----------|-------|-------------|
| 단어 | 20 | 100 | 4x5=20 / 5x10=50 / 6x5=30 | PASS (7 warnings) | PASS | PASS (HIGH 0) |
| 워크북 | 20 | 100 | 4x5=20 / 5x10=50 / 6x5=30 | PASS (5 warnings) | PASS | PASS (HIGH 0) |
| 퀴즈 | 20 | 100 | 4x5=20 / 5x10=50 / 6x5=30 | PASS (4 warnings) | PASS | PASS (HIGH 0) |

## Validate Warnings (B-level only, no S-level)

- **histKey pattern**: C20 warning -- histKey에 undefined 포함. 기능상 문제 없음.
- **EX-2 서술형 정답 노출**: 워크북 Q15(Lenape), Q16(sold), 퀴즈 Q16($24), Q17(cultural differences) -- 전부 "찾기" 유형으로 의도된 노출.
- **EX-3 (A)(B)(C) 정답 노출**: 단어 Q3 -- (A)(B)(C) 유형 특성상 불가피.
- **T39 어순배열 순서**: 퀴즈 Q18 -- 어순배열이 FIRST 그룹이 아닌 LAST 그룹에 배치. B-level warning.
- **P2 passage 앞부분**: 단어 Q4, Q15, Q17 -- 어형변환/다의어 유형 발췌 허용.
- **SCHEMA-DET-PATTERN**: 워크북 Q4 -- 어법 det.korean 형식 권장 미준수. B-level.

## Adversarial Issues

### 단어 테스트
| Q | Severity | Tag | 내용 |
|---|----------|-----|------|
| 15 | LOW | MULTI-SENSE-EDGE | place 다의어: take place(발생하다) vs place(장소). 선지 순서 혼동 가능성 낮음 |
| 6 | LOW | MARKER-ORDER | 마커 순서 ②①③④. 본문 흐름 순서이므로 무관 |
| 3 | LOW | SIMILAR-DISTRACTORS | 선지 ③④ 차이가 (C) 하나뿐. 어려움 난이도에 적합 |

### 워크북 테스트
| Q | Severity | Tag | 내용 |
|---|----------|-----|------|
| 4 | LOW | LONG-MARKER | ①<u>would have likely cause</u> 5단어 마커. 오류 포인트 명확 |
| 11 | LOW | LONG-CHOICE | 정답 9단어 vs 오답 5-6단어. S-LENGTH-BIAS 기준(2.5배) 미달로 통과 |

### 퀴즈 테스트
| Q | Severity | Tag | 내용 |
|---|----------|-----|------|
| 14 | LOW | DUAL-REFERENT-CHECK | They = the Dutch. 지불 주체로 정답 유일 |
| 15 | LOW | DUAL-REFERENT-CHECK | they = Lenape. 문맥(In their eyes) 연결로 정답 유일 |
| 13 | LOW | METAPHOR-CLARITY | 'In their eyes' 함축의미. 문자적 오독 선지와 명확히 구분 |

## 정답 분포

### 단어
| ans=1 | ans=2 | ans=3 | ans=4 |
|-------|-------|-------|-------|
| 3 (Q1,14,19) | 4 (Q4,7,10,12) | 4 (Q3,8,13,20) | 5 (Q2,5,9,11,16+17+18=written) |

### 워크북
| ans=1 | ans=2 | ans=3 | ans=4 |
|-------|-------|-------|-------|
| 4 (Q1,4,7,8+15~20=written) | 4 (Q2,3,5,10) | 3 (Q9,13,16+written) | 5 (Q6,11,12,14,19+written) |

### 퀴즈
| ans=1 | ans=2 | ans=3 | ans=4 |
|-------|-------|-------|-------|
| 4 (Q1,4,8,11+16~20=written) | 4 (Q2,7,9,14) | 5 (Q3,5,7,13,15) | 3 (Q6,10,12+written) |

## Sign-off

- [ ] jacob 확인
- [x] validate PASS (6 files)
- [x] blind PASS (6 files)
- [x] adversarial PASS -- HIGH 0건 (6 files)
- [x] Opus 4.6 adversarial 검토 완료 (2026-04-20)
