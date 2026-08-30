# 적대적 공격 검수 리포트 (STEP 5)

- **대상**: `data/부교재/Pathways4/Unit5/퀴즈.json`
- **제목**: The Smart Swarm — Pathways 4 Unit5 Reading (예상문제)
- **histKey**: `quiztest_pathways4_unit5_reading_v6`
- **검수일**: 2026-08-30
- **검수 역할**: 공격자 (출제자 아님)

## 구조 요약
- 문항 수: **20문항** / 총점 **100점** (검산 일치)
- 난이도 분포: 쉬움 5×4=20 / 보통 10×5=50 / 어려움 5×6=30 → 100 ✅
- 유형 분포: 어법 3, 문맥상 부적절한 어휘 2, 빈칸추론 3, 내용 일치/불일치 3, 주제 1, 제목 1, 함축의미 추론 1, 지칭추론 1, 서술형(조건영작 3·어법고쳐쓰기 1·어순배열 1) 5
- ans 분포: 1→4, 2→4, 3→4, 4→3 (동일번호 최대 4 ≤ 5, OK)
- code validate: **[PASS]**

## S-QUIZ-WRITTEN-SAFE-TYPE 점검
서술형 5문항 전부 안전유형(조건영작/어순배열/어법고쳐쓰기)만 사용. 찾기·핵심단어형 **0건** → 자동채점 복수정답 위험 없음. ✅

## 서술형 복수정답(유일 수렴) 최종 판정
- **Q16 조건영작**(8단어): `coordinate its actions like a flock of birds` — 우리말·토큰상 대체 배열 없음. **유일** ✅
- **Q18 조건영작**(11단어): `there are very few examples where you have a central agent` — 대체 배열 없음. **유일** ✅ (직전 세션이 지적한 all/each floating quantifier 문장은 이 버전에서 제거됨 — 현 문장에 floating quantifier 없음)
- **Q19 어순배열**(10단어): `Google surveys billions of Web pages on its index servers` — 토큰만으론 Web/index 교차 배열이 이론상 성립하나 우리말 단서(웹 페이지·색인 서버)로 **유일 확정** (LOW 기록)
- **Q20 조건영작**(11단어): `each robot searched for objects of interest with a small camera` — 'objects of interest'(관심 대상) 고정구, 우리말이 each→robot·small→camera 확정. **유일** ✅
- **Q17 어법고쳐쓰기**(1단어): `spread → spreads` — 주어 News 단수일치. 인용문 전체 현재시제라 과거형 오독 차단. **유일** (LOW 기록)
- 조건 토큰 ↔ wa 단어수 전건 일치, 더미 토큰 0. 정답 노출(S-WA-IN-PASSAGE) 0 — 서술형 5문항 모두 해당 위치 `__________` 처리 확인.

## MC 공격 결과 (20문항)
- **어법 Q1~3**: 밑줄 3개 정상 항목 대입 시 dangling/복수정답 없음. 오답(비문) 1개만 존재 → 정답 유일. (Q1 resembled→resembling, Q2 giving→given, Q3 them→which) ✅
- **어법고쳐쓰기 Q17**: 밑줄이 문법 독립단위(주어 News + 동사) → 병렬/공유목적어 절반밑줄 아님 ✅
- **부적절 어휘 Q4·Q5**: 반의어 치환(possible↔impossible, failure↔success)으로 문맥 모순 1개만 → 유일 ✅
- **빈칸 Q6·Q7·Q15**: 관용구/주제어 추론, passage 문맥 의존. 오답이 주제(분산·자기조직화)와 상충해 anti-cheese 통과 ✅
- **내용일치 Q8·Q9·Q10**: 수치·사실 오류 삽입(three→four, 66→over 100, 링크수 무시). 선지 키워드 passage 내 존재(S-CHOICE-NOT-IN-PASSAGE 무해). 오답 유일 ✅
- **주제 Q11·제목 Q12·함축 Q13·지칭 Q14**: 오답이 반대/지엽/오독 유형, 메타서술 선지 0(S-META-CHOICE 무). 지칭 Q14 선지 한국어 준수. ✅

## 발견 이슈
| id | severity | type | 요약 |
|----|----------|------|------|
| 17 | LOW | 시제 중의성(해소) | spread 과거형 오독 여지, 현재시제 문맥이 spreads로 확정 |
| 19 | LOW | 토큰 중의성(해소) | Web/index 교차배열 이론상 성립, 우리말 단서로 유일 확정 |

- **HIGH: 0 / MED: 0 / LOW: 2**

## 최종 판정
- 서술형 복수정답 가능성: **없음** (5문항 전부 유일 수렴)
- HIGH 결함: **0건**
- **배포 가능 (DEPLOYABLE)**. LOW 2건은 채점(accept=wa 단일)과 우리말/문맥 단서로 이미 해소되어 수정 불요. 파일 무수정 원칙 준수.
