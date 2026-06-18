# Audit Report: 수능특강 영어독해연습 11강 2번 퀴즈

## 기본 정보
- **파일**: 퀴즈.json
- **출제일**: 2026-06-17
- **출제 모델**: claude-opus-4-6
- **총 문항**: 20문항 / 100점
- **배점 분포**: 쉬움 5문항(4점×5=20점) / 보통 10문항(5점×10=50점) / 어려움 5문항(6점×5=30점)

## 유형 분포
| 유형 | 문항 수 | 문항 번호 |
|------|---------|-----------|
| 어법 | 3 | Q1(쉬움), Q2(보통), Q3(어려움) |
| 문맥상 부적절한 어휘 | 2 | Q4(보통), Q5(어려움) |
| 빈칸추론 | 2 | Q6(보통), Q7(보통) |
| 내용 일치/불일치 | 3 | Q8(쉬움), Q9(보통), Q10(보통) |
| 주제 | 2 | Q11(보통), Q12(어려움) |
| 함축의미 추론 | 1 | Q13(어려움) |
| 지칭추론 | 2 | Q14(쉬움), Q15(보통) |
| 서술형 | 2 | Q16(쉬움), Q17(보통) |
| 서술형 — 핵심단어 | 1 | Q18(어려움) |
| 서술형 — 조건영작 | 2 | Q19(쉬움), Q20(보통) |

## 정답 분포
| 번호 | 개수 | 문항 |
|------|------|------|
| 1 | 4 | Q3, Q7, Q11, Q14 |
| 2 | 4 | Q1, Q4, Q9, Q13 |
| 3 | 5 | Q2, Q5, Q6, Q10, Q15 |
| 4 | 2 | Q8, Q12 |

- 최대 동일번호: 5개 (③) — 규칙 충족 (max 5)
- 최대 연속: 2개 — 규칙 충족 (max 2)

## SOP 이행 결과
| 단계 | 상태 | 비고 |
|------|------|------|
| STEP 0: 원문 확보 | PASS | fullPassage PDF 원문 확인 완료 (8문장, 173단어) |
| STEP 1: 출제 | PASS | 20문항 response.json 작성 |
| STEP 2: 구조 검증 | PASS | validate PASS (S급 에러 0건, B급 경고 4건) |
| STEP 3: 블라인드 풀이 | PASS | 20/20 일치 |
| STEP 4: 정답 대조 | PASS | blind 20/20 전문항 일치 |
| STEP 5: 적대적 공격 | PASS | HIGH 0건, LOW 4건 |
| STEP 6: 자동 검증 | PASS | validate PASS |
| STEP 7: 증적 리포트 | 본 문서 |

## validate 결과
- **S급 에러**: 0건
- **B급 경고**: 4건 (Q2 korean 형식 권장, histKey 패턴, Q6 passage/distractor 권장)
- **판정**: PASS

## Blind Solve 결과
- **점수**: 20/20 (100%)
- **불일치**: 0건

## Cross-Blind 결과
- **모델**: claude-opus-4-6
- **점수**: 20/20 (100%)
- **불일치**: 0건

## Adversarial 결과
- **HIGH**: 0건
- **MEDIUM**: 0건
- **LOW**: 4건 (Q6 관용표현 빈칸, Q7 오답 구조, Q16/Q18 서술형 답범위)
- **판정**: PASS — 배포 가능

## 문법 포인트 커버리지
| 문법 포인트 | 출제 문항 |
|------------|-----------|
| so...that 결과 구문 | Q3 |
| capable of + Ving | Q3, Q19 |
| 부사 vs 형용사 수식 | Q1, Q2 |
| 수동태 (be + p.p.) | Q1 |
| 비교급 형용사 | Q2 |
| 형용사 후치수식 | Q2 |
| to부정사 목적 용법 | Q3, Q7 |
| 현재분사 전치사적 용법 | Q3 |
| 가주어 it + take + to V | Q3, Q18 |
| 간접의문문 | Q18 |
| 전치사구 도치 | Q20 |
| 전치사 + 동명사 | Q1, Q20 |

## 수정 이력
1. Q3: 마커 순서 위반 수정 (①that→①capable, ans 4→1)
2. Q17: 다중 항목(A, B, and C) 금지 위반 → 단일 답으로 재출제

---

# Audit Report: 수능특강 영어독해연습 11강 9번 퀴즈

## 기본 정보
- **파일**: 9번/퀴즈.json
- **검수일**: 2026-06-18
- **검수 모델**: claude-opus-4-6 (1M context)
- **총 문항**: 20문항 / 100점
- **배점 분포**: 쉬움 5문항(4점x5=20점) / 보통 10문항(5점x10=50점) / 어려움 5문항(6점x5=30점)
- **지문**: "Control of Expression in Ancient Greece" (8문장, fullPassage 완전 수록)

## 유형 분포
| 유형 | 문항 수 | 문항 번호 |
|------|---------|-----------|
| 어법 | 3 | Q1(쉬움), Q2(보통), Q3(어려움) |
| 문맥상 부적절한 어휘 | 2 | Q4(보통), Q5(어려움) |
| 빈칸추론 | 2 | Q6(보통), Q7(보통) |
| 내용 일치/불일치 | 3 | Q8(쉬움), Q9(보통), Q10(보통) |
| 주제 | 1 | Q11(보통) |
| 주제(요지) | 1 | Q12(어려움) |
| 함축의미 추론 | 1 | Q13(어려움) |
| 지칭추론 | 2 | Q14(쉬움), Q15(보통) |
| 서술형(찾기) | 2 | Q16(쉬움), Q17(보통) |
| 서술형 — 핵심단어(찾기) | 1 | Q18(어려움) |
| 서술형 — 조건영작 | 2 | Q19(쉬움), Q20(보통) |

## 정답 분포 (MC Q1~Q15)
| 번호 | 개수 | 문항 |
|------|------|------|
| 1 | 3 | Q6, Q8, Q11 |
| 2 | 3 | Q2, Q4, Q7 |
| 3 | 5 | Q1, Q3, Q5, Q9, Q13 |
| 4 | 4 | Q10, Q12, Q14, Q15 |

- 최대 동일번호: 5개 (③) — 규칙 충족 (max 5)
- 최대 연속: 2개 — 규칙 충족 (max 2)

## SOP 이행 결과
| 단계 | 상태 | 비고 |
|------|------|------|
| STEP 2: 구조 검증 | PASS | validate PASS (S급 0건, B급 2건: histKey 패턴, Q1 passage 경고) |
| STEP 5: 적대적 공격 | PASS | HIGH 0건, MEDIUM 1건, LOW 0건 |
| STEP 7: 증적 리포트 | 본 섹션 |

## validate 결과
- **S급 에러**: 0건
- **B급 경고**: 2건
  - C20: histKey 패턴 불일치 (기능 영향 없음)
  - P2: Q1 passage 앞부분 fullPassage 미매칭 경고 (마커 ①<u>preventing</u> 삽입 때문, 정상)
- **판정**: PASS

## Adversarial 결과 (STEP 5)
- **HIGH**: 0건
- **MEDIUM**: 1건
  - Q7 (빈칸추론, 보통): 오답 3개(protect&strengthen / educate&reform / honor&celebrate)가 전부 검열의 본질과 명백히 모순. '검열로 반대파를 보호/교육/기린다'는 상식적으로 불가하여 passage 없이도 소거 가능. 변별력 다소 손상.
- **LOW**: 0건
- **판정**: PASS — HIGH 0건으로 배포 가능. Q7 MEDIUM은 보통 난이도 빈칸추론으로 허용 범위 내.

## 20문항 적대적 검토 요약

### 어법 (Q1~Q3): CLEAN
- Q1: universal→universally 오류 명확 (부사 수식). 나머지 마커 정확.
- Q2: what→that 오류 명확 (완전한 절 앞 접속사). 나머지 마커 정확.
- Q3: banning→banned 오류 명확 (수동태 필요). 나머지 마커 정확.
- 3문항 모두 정답이 유일하고, 다른 마커에서 추가 오류 없음.

### 부적절 어휘 (Q4~Q5): CLEAN
- Q4: passively→actively. 신이 수동적이면 불경죄 처벌 논리 성립 안 됨. 유일한 부적절.
- Q5: amplify→silence. 검열로 반대파를 '증폭'은 정반대. 유일한 부적절.

### 빈칸추론 (Q6~Q7): Q7 MEDIUM
- Q6: "in the name of"가 유일하게 뒤의 "seeking to protect" 논리와 연결. "with regard to"는 어색하지만 완전 불가는 아님 → 그래도 정답 유일.
- Q7: MEDIUM (위 상세 참조). 다만 보통 난이도로 허용.

### 내용 일치/불일치 (Q8~Q10): CLEAN
- Q8: ① "학식 있는 사람들도 검열 대상" = "even learned men were banned" 정확.
- Q9: ③ "경제적 사상에도 적용" = 본문에 없는 내용(경제 미언급). 불일치 명확.
- Q10: ④ "군국주의 보호 목적" = "to protect its militarism" 정확.

### 주제/요지 (Q11~Q12): CLEAN
- Q11: ① 글 전체 주제 포괄. 나머지는 민주주의/관용/아테네 등 본문 없는 내용.
- Q12: ④ 명분(공공선) vs 실질(억압) 괴리가 핵심 요지. 정확.

### 함축의미 (Q13): CLEAN
- "identical with harsh repression" = "잔혹한 탄압과 다를 바 없는 것". 직역 수준의 함축.

### 지칭추론 (Q14~Q15): CLEAN
- Q14: "it" = society. "protect it from heresy" → 사회를 보호 (의미상 유일).
- Q15: "they" = the ancient Greeks. 4문장의 선행사 참조 (당국도 가능하지만 문맥상 Greeks가 자연스러움).

### 서술형 찾기 (Q16~Q18): CLEAN
- Q16: wa 10단어 = "the gods could actively help or harm the city state". passage에 존재. 단어수 일치.
- Q17: wa 8단어 = "exercised censorship to silence and eliminate their opponents". passage에 존재. 단어수 일치.
- Q18: wa 9단어 = "a rigid system of censorship to protect its militarism". passage에 존재. 단어수 일치.

### 조건영작 (Q19~Q20): CLEAN
- Q19: 조건 9단어 = wa 9단어. 누락/잉여 없음. accept에 콤마 유무 변형 포함.
- Q20: 조건 9단어 = wa 9단어. 누락/잉여 없음. "관계대명사 that 주격 관계사절" 조건 정확. accept에 대문자 변형 포함.

## 수정 이력
- 없음 (HIGH 이슈 0건으로 수정 불필요)

---

# Audit Report: 수능특강 영어독해연습 11강 10번 퀴즈

## 기본 정보
- **파일**: 10번/퀴즈.json
- **검수일**: 2026-06-17
- **검수 모델**: claude-opus-4-6 (1M context)
- **총 문항**: 20문항 / 100점
- **배점 분포**: 쉬움 5문항(4점x5=20점) / 보통 10문항(5점x10=50점) / 어려움 5문항(6점x5=30점)
- **지문**: "Bridging Science and the Humanities" (10문장, 233단어)

## 유형 분포
| 유형 | 문항 수 | 문항 번호 |
|------|---------|-----------|
| 어법 | 3 | Q1(쉬움), Q2(보통), Q3(어려움) |
| 문맥상 부적절한 어휘 | 2 | Q4(보통), Q5(어려움) |
| 빈칸추론 | 2 | Q6(보통), Q7(보통) |
| 내용 일치/불일치 | 3 | Q8(쉬움), Q9(보통), Q10(보통) |
| 주제 | 1 | Q11(보통) |
| 주제(요지) | 1 | Q12(어려움) |
| 함축의미 추론 | 1 | Q13(어려움) |
| 지칭추론 | 2 | Q14(쉬움), Q15(보통) |
| 서술형(찾기) | 2 | Q16(쉬움), Q17(보통) |
| 서술형 — 핵심단어(찾기) | 1 | Q18(어려움) |
| 서술형 — 조건영작 | 2 | Q19(쉬움), Q20(보통) |

## 정답 분포 (MC Q1~Q15)
| 번호 | 개수 | 문항 |
|------|------|------|
| 1 | 2 | Q2, Q12 |
| 2 | 5 | Q4, Q6, Q8, Q11, Q13 |
| 3 | 5 | Q1, Q5, Q7, Q10, Q14 |
| 4 | 3 | Q3, Q9, Q15 |

- 주의: ans=2와 ans=3이 각 5개로 최대 동일번호 한계치(5)
- 최대 연속: 2개 — 규칙 충족 (max 2)

## SOP 이행 결과
| 단계 | 상태 | 비고 |
|------|------|------|
| STEP 2: 구조 검증 | PASS | validate PASS (S급 0건, B급 3건) |
| STEP 5: 적대적 공격 | PASS | HIGH 1건 → 수정 완료, MEDIUM 1건 |
| STEP 7: 증적 리포트 | 본 섹션 |

## validate 결과
- **S급 에러**: 0건
- **B급 경고**: 3건
  - C20: histKey 패턴 불일치 (기능 영향 없음)
  - P2: Q1, Q4 passage 앞부분 fullPassage 미매칭 (마커 삽입 때문, 정상)
- **판정**: PASS

## Adversarial 결과 (STEP 5)
- **HIGH**: 1건 → **수정 완료**
  - Q18 (서술형 핵심단어, 어려움): stem "the __________ of science and the arts" + wa "distance and even animosity that existed between" = "between of" 비문. stem에 "the 'two cultures'" 삽입하여 해소.
- **MEDIUM**: 1건
  - Q7 (빈칸추론, 보통): Ch1(명사구), Ch2(중복), Ch4(전치사구)는 "to" 뒤 문법적 불가. 문법 소거만으로 정답 Ch3 도출 가능. 보통 난이도 빈칸추론으로 허용 범위 내.
- **LOW**: 0건
- **판정**: PASS — HIGH 수정 완료, MEDIUM 허용 범위.

## 20문항 적대적 검토 요약

### 어법 (Q1~Q3): CLEAN
- Q1: existing→existed 오류 명확 (관계사절 본동사 부재). 나머지 마커 정확.
- Q2: to be→being 오류 명확 (전치사+동명사). 나머지 마커 정확.
- Q3: put→puts 오류 명확 (단수 주어 수 일치). 나머지 마커 정확.
- 3문항 모두 정답 유일, 다른 마커 추가 오류 없음.

### 부적절 어휘 (Q4~Q5): CLEAN
- Q4: affinity→animosity. distance와 affinity의 의미 모순으로 유일한 부적절.
- Q5: indifferent→informed. 긍정적 논지에 무관심은 정반대. 유일한 부적절.

### 빈칸추론 (Q6~Q7): Q7 MEDIUM
- Q6: "central to being a cultured individual"만 역접(when in fact) 구조에 부합. 오답 3개 모두 내용적으로 명확히 부적절.
- Q7: MEDIUM (위 상세 참조). 오답이 문법적으로 불가해 passage 읽기 불필요.

### 내용 일치/불일치 (Q8~Q10): CLEAN
- Q8: ② Snow 1959년 강연 = 본문 3문장 정확 일치.
- Q9: ④ "과학 없이도" = "through the application of science" 핵심 조건 삭제. 불일치 명확.
- Q10: ③ 속물근성 아님 = 본문 7문장 정확 일치.

### 주제/요지 (Q11~Q12): CLEAN
- Q11: ② 분열 극복+통합. 나머지는 부분적/배경적.
- Q12: ① 과학=교양의 본질+예술과 협력. 본문 핵심 정확 포착.

### 함축의미 (Q13): CLEAN
- "the very opposite" = "not a mark of philistinism"의 반대 = 교양의 표시. 정답 유일.

### 지칭추론 (Q14~Q15): CLEAN
- Q14: "it is central" = scientific knowledge. 선행사 명확.
- Q15: "those laws" = the laws it(the world) follows. 자연법칙. 정답 유일.

### 서술형 찾기 (Q16~Q17): CLEAN
- Q16: wa 7단어 = "how to renew and protect the environment". passage에 존재. 단어수 일치.
- Q17: wa 9단어 = "helpful action through the application of science and understanding". passage에 존재. 단어수 일치.

### 서술형 핵심단어 (Q18): FIXED
- wa 7단어 = "distance and even animosity that existed between". passage에 존재.
- stem 수정: "of science" → "the 'two cultures' of science"로 비문 해소.

### 조건영작 (Q19~Q20): CLEAN
- Q19: 조건 7단어(central, fact, in, is, it, it, to) = wa 7단어. 누락/잉여 없음. 토큰 순서 비정답순.
- Q20: 조건 9단어(a, about, is, knowing, mark, not, of, philistinism, science) = wa 9단어. 누락/잉여 없음. 토큰 순서 비정답순.

## 수정 이력
1. Q18: stem "the __________ of science and the arts" → "the __________ the 'two cultures' of science and the arts" (between+of 비문 해소)
