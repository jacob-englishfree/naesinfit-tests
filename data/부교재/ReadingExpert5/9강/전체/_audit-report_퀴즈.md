# 증적 리포트 — 예상문제(퀴즈) 테스트 (Reading Expert 5, U09 Whistled Languages / 전체)

- 파일: `data/부교재/ReadingExpert5/9강/전체/퀴즈.json`
- 재검증 + 수정: 2026-09-13 (Opus 4.8)

## 1. 구성
- 문항 수: **20** / 총점: **100**
- 배점 분포: 쉬움 5 × 4점(20) + 보통 10 × 5점(50) + 어려움 5 × 6점(30) = 100
- 형식: 객관식 15 + 서술형 5 (조건영작 3 / 어순배열 1 / **어형변환 1**) — 전부 예상문제 안전유형(S-QUIZ-WRITTEN-SAFE-TYPE)
- 유형 분포: 어법 3 / 문맥상 부적절한 어휘 2 / 빈칸추론 3 / 내용 일치·불일치 3 / 주제 1 / 제목 1 / 함축의미 추론 1 / 지칭추론 1 / 서술형 — 조건영작 3 / 서술형 — 어형변환 1 / 서술형 — 어순배열 1 — 전부 퀴즈 화이트리스트 내
- mc 정답 분포: ①3 ②4 ③4 ④4 (한 번호 5개 이하, 3연속 없음 — A6 PASS)

## 2. Q17 유형 교체 (차단 해소 핵심)
- **변경 전**: `서술형 — 어법고쳐쓰기` → validate **[S] TW-TYPE FAIL** (규칙 24 위반: 예상문제 서술형은 조건영작/어순배열/어형변환만 허용)
- **변경 후**: `서술형 — 어형변환` (정답 wa=`called` 보존)
  - passage(3문장 발췌): "Some groups have been fairly successful in preserving their whistled languages. On the island of La Gomera, near northern Africa, a whistled language __________ (call) Silbo Gomero allows people to communicate in Spanish over long distances. It works by simplifying the sounds of Spanish into two whistled vowels and four whistled consonants."
  - stem: "다음 글의 빈칸에 괄호 안의 단어를 알맞은 형태로 바꿔 쓰시오. (영어로)"
  - wa: `called` / accept: `["called"]`
  - 정답 미노출: 발췌 내 `call`/`called`는 빈칸 마커에만 존재 (누출 0)
  - V74(어형변환 2~4문장): 3문장 → PASS
- response.json / blind.json / adversarial.json 동기 갱신 완료

## 3. validate 결과
**[PASS]** (경고 3건, 전부 B급 비차단; TW-TYPE 에러 소멸)
- P2(B) Q1/Q4: 어법·부적절 마커가 지문 첫머리에 붙어 prefix 매칭 오탐 — 실제 passage는 fullPassage 전체
- Q6-WEAK(B) Q15: 빈칸추론 오답이 지문 미등장 — 변별용 오답으로 정상

## 4. 블라인드 재풀이 (정답 가리고 원문 대조로 직접 풀이)
**20/20 일치** (Q17 교체 후 재풀이 포함). 대표 근거:
- Q1 using→used(②), Q2 teaching→to teach(③), Q3 seen→saw(④)
- Q4 complex←simple 부적절(①), Q5 forgetting←preserving 부적절(③)
- Q6 from farther away(①), Q7 isolated places(④)
- Q8 일치=산악·숲(②), Q9 불일치=원래 자유롭게 가르쳐졌다("not done historically"와 모순, ③), Q10 일치=문화와 역사(①)
- Q11 주제=endangered 휘파람 언어 보존 노력(④), Q12 제목=Voices in the Wind: Saving Whistled Languages(②)
- Q13 함축=각 문화의 고유한 세계관·표현 방식(③), Q14 지칭 they=휘파람 언어들(②), Q15 빈칸=long distances(④)
- Q16 조건영작 6단어=whistling can be heard more clearly
- **Q17 어형변환 called (앞 명사 수식 수동 분사 → call을 과거분사 called로) — wa 일치**
- Q18 조건영작 10단어=the people of Antia agreed to teach it to outsiders
- Q19 어순배열=They revived classes in schools and introduced programs for adults
- Q20 조건영작 8단어=some people use whistling to have entire conversations

## 5. 적대검수 + N7
- 서술형 5문항 [조건]/제시어 개수 = wa 단어수 완전 일치
- 정답 2개 가능/정답 노출/뻔한 오답/길이편향: 0건
- LOW: Q14 지칭추론이 근접 지칭(규칙 J의 간접 지칭 권고 대비 다소 직접적) — 정답 명확, 비차단
- **N7 (워크북↔예상문제 정답중복): 0건** — 신규 Q17 답 `called`도 워크북 답과 미중복 재확인
- adversarial HIGH: 0건

## 6. 판정
- validate PASS · 블라인드 20/20 · 원문 100% 일치 · 정답오류 0 · N7 0
- 증적: response/json/blind/cross-blind/adversarial 존재, adversarial HIGH 0
- **배포 가능 (GREEN)** — 단, 실제 배포/push/test-deploy/catalog는 총괄 승인 대기(본 작업 범위 외)
