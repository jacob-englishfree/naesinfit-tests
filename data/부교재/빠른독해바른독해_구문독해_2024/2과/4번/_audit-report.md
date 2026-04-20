# Audit Report: 빠른독해바른독해 구문독해 2과 4번

> Petra: The Lost City in the Desert

## 테스트 현황

| 테스트 | 문항 | 총점 | 배점(쉬움/보통/어려움) | validate | blind | adversarial |
|--------|------|------|------------------------|----------|-------|-------------|
| 단어 | 20 | 100 | 4x5=20 / 5x10=50 / 6x5=30 | PASS (6 warnings) | PASS | PASS (HIGH 0) |
| 워크북 | 20 | 100 | 4x5=20 / 5x10=50 / 6x5=30 | PASS (4 warnings) | PASS | PASS (HIGH 0) |
| 퀴즈 | 20 | 100 | 4x5=20 / 5x10=50 / 6x5=30 | PASS (5 warnings) | PASS | PASS (HIGH 0) |

## Validate Warnings (B-level only, no S-level)

- **histKey pattern**: C20 warning -- histKey에 undefined 포함. 기능상 문제 없음.
- **EX-2 서술형 정답 노출**: 워크북 Q15(carve), Q16(earthquake), 퀴즈 Q16(the Nabataeans), Q17(prosper) -- 전부 "찾기" 유형으로 의도된 노출.
- **EX-3 (A)(B)(C) 정답 노출**: 단어 Q2, Q3 -- (A)(B)(C) 유형 특성상 원문 단어가 passage에 있는 것은 불가피.
- **T39 어순배열 순서**: 퀴즈 Q18 -- 어순배열이 FIRST 그룹이 아닌 LAST 그룹에 배치. B-level warning.
- **P2 passage 앞부분**: 어형변환(단어 Q15, Q18) passage가 fullPassage 발췌 -- 어형변환 유형은 발췌 허용.

## Adversarial Issues

### 단어 테스트
| Q | Severity | Tag | 내용 |
|---|----------|-----|------|
| 13 | LOW | ANTONYM-PREFIX | directly->indirectly (in- 접두사). 실사용 빈도 높은 대립쌍이므로 통과 |
| 1 | LOW | EASY-ABC | 3자리 모두 원문/반의어 대립. 쉬움 난이도에 맞음 |
| 15 | INFO | MULTI-SENSE-MINOR | trade 다의어: 교환 vs 무역 구분 가능 |

### 워크북 테스트
| Q | Severity | Tag | 내용 |
|---|----------|-----|------|
| 10 | LOW | NEAR-SYNONYM-DISTRACTOR | commerce vs trade 유의어. 원문 일치로 정답 유일 |
| 14 | LOW | GRAMMAR-OVERLAP | 어법 포인트 중복 없음 확인 |

### 퀴즈 테스트
| Q | Severity | Tag | 내용 |
|---|----------|-----|------|
| 2 | LOW | COMPLEX-ERROR | has forgotten -> had been forgotten (시제+태 이중오류). 보통 난이도에 적합 |
| 13 | LOW | METAPHOR-LITERAL | crossroads 함축의미. 선지 구분 가능 |

## 정답 분포

### 단어
| ans=1 | ans=2 | ans=3 | ans=4 |
|-------|-------|-------|-------|
| 5 (Q1,7,10,11,15) | 4 (Q5,8,13,19) | 5 (Q4,9,12,16,20) | 5 (Q2,3,6,14,17+18=written) |

### 워크북
| ans=1 | ans=2 | ans=3 | ans=4 |
|-------|-------|-------|-------|
| 4 (Q4,7,9,10) | 4 (Q2,5,11,15+16+17=written) | 4 (Q1,3,14,19) | 4 (Q6,8,13,18+20=written) |

### 퀴즈
| ans=1 | ans=2 | ans=3 | ans=4 |
|-------|-------|-------|-------|
| 4 (Q4,8,13,14+16~20=written) | 5 (Q1,6,11,12,15) | 4 (Q3,5,7,10) | 3 (Q2,9,14+written) |

## Sign-off

- [ ] jacob 확인
- [x] validate PASS (6 files)
- [x] blind PASS (6 files)
- [x] adversarial PASS -- HIGH 0건 (6 files)
- [x] Opus 4.6 adversarial 검토 완료 (2026-04-20)
