# 검증 증적 리포트 — 공통영어2 YBM(김은형) 2과 Read More (Dabbawalas)

- 경로: `data/교과서/공통영어2/YBM김은형/2과/Read More/`
- 작성: 2026-09-07 (검증 전용 세션, 새 출제 없음)
- 대상: 단어 / 워크북 / 예상문제(퀴즈) 3종
- 절차: STEP B 블라인드 → STEP C cross-blind → STEP D adversarial → cross-leak 게이트

---

## 종합 요약

| 종류 | validate | 블라인드(STEP B) | cross-blind(STEP C) | adversarial(STEP D) | cross-leak |
|------|----------|------------------|---------------------|----------------------|------------|
| 단어 | PASS (7 warn) | 20/20 | PASS | HIGH 1 · MED 3 · LOW 1 | PASS (같은구역 0) |
| 워크북 | PASS | 20/20 | PASS | HIGH 0 (LOW 2) | PASS (같은구역 0) |
| 예상문제(퀴즈) | PASS (1 warn) | **20/20** | **PASS** | **HIGH 2 · MED 5 · LOW 1** | **FAIL (같은구역 73건)** |

> ⚠️ 이번 세션 지시 = 검증 증적만. 임의 수정 금지. 아래 HIGH/FAIL은 jacob 판단 필요.

---

## 1. 예상문제(퀴즈) — 이번 세션 신규 검증

### STEP B 블라인드 — 20/20 일치
- 정답 제거본(`퀴즈.blind-prompt.json`)만 보고 20문항 전부 독립 풀이 → 실제 정답과 **20/20 일치**.
- 근거 포함 결과: `퀴즈.blind.json`
- mc 15문항 ans 전부 일치, 서술형 5문항(Q16~Q20) wa 전부 일치.

### STEP C cross-blind — PASS
- `퀴즈.cross-prompt.json`(정답 제거) 독립 재풀이 → `퀴즈.cross-blind.json`
- `node cross-blind.js --verify` → **PASS 20/20 일치**
- (참고) verify 스크립트는 solve 필드명을 `pick`으로 읽음. 최초 `ans/answer`로 저장 시 전건 undefined FLAG → `pick`으로 통일 후 PASS.

### STEP D adversarial — HIGH 2, MED 5, LOW 1
문항 내부(복수정답/뻔한오답/문항내 정답노출/모호)는 **이상 없음**. 지적 사항은 전부 **문항 간(cross-question) 정답 상호노출**:
- **HIGH Q15↔Q16**: 원문 동일 문장("...color-coding system to ensure each lunch box reaches its planned destination")이 두 문항으로 갈라짐. Q15 passage에 Q16 정답이, Q16 passage에 Q15 정답이 평문 노출 → 서로의 정답을 보여줌.
- **MED Q6/Q7/Q18/Q19/Q20**: 빈칸(Q6·Q7)·서술형(Q18·Q19·Q20) 정답이 Q8~Q13(내용일치/주제/제목/함축) 등 fullPassage 사용 문항 passage에 원문 그대로 노출.
- **LOW Q5**: 부적절어휘 트리거 'in forward'가 비관용적이라 뜻 없이 어색함만으로도 정답 유추 가능(정답 자체는 정확).
- 상세: `퀴즈.adversarial.json`

### cross-leak 게이트 — FAIL (같은구역 73건)
- `python3 validate/check-cross-leak.py 퀴즈.json` → **FAIL, 같은구역 73건 / 다른구역 11건**
- **근본 원인**: Q8~Q13(내용일치/주제/제목/함축) 문항이 fullPassage(또는 광범위 발췌)를 쓰는데, 이 지문이 빈칸(Q6·Q7·Q15)·서술형(Q16·Q18·Q19·Q20) 정답 어구를 **원문 그대로 포함**. excerptRange가 겹쳐 '같은구역'으로 집계됨.
- 대표 노출 어구:
  - Q15 `color-coding system` ↔ Q16 `each lunch box reaches its planned destination` (동일 문장, 상호노출)
  - Q6 `home-cooked lunches`, Q7 `in and around Mumbai`
  - Q18 `Dabbawalas owe their success to an efficient organization and a strong sense of work`
  - Q19 `returned to their original homes by following the same route in reverse`
  - Q20 `their cooperation and communication allow them to function as efficiently as a well-organized machine`
- 단어(같은구역 0)·워크북(같은구역 0)과 달리 퀴즈만 FAIL. 지시대로 **수정하지 않고 보고만** 함.

**jacob 판단 필요**: 단일 지문 예상문제 특성상 내용일치/주제/제목 문항이 전문(全文)을 보여줘 하위 빈칸·서술형 정답을 덮는 구조. 배포하려면 (a) 해당 comprehension 문항 발췌 축소, (b) Q15↔Q16 중 하나 재배치/교체, 또는 (c) 같은구역 규칙 예외 인정 중 결정 필요.

---

## 2. 단어 (기존 산출물 재확인)
- validate PASS (7 warnings: P2 Q17 passage 앞부분, Q6·Q7·Q8 약한 오답 등 B급 권고)
- 블라인드 20/20, cross-blind PASS, cross-leak PASS(같은구역 0)
- adversarial **HIGH 1 (Q20)**: 빈칸 앞 관사 `an`이 자음 시작 오답 ②strict schedule·④large factory를 문법만으로 소거 가능 → 실질 4지선다가 2지선다로 축소. 그 외 MED 3(Q1~3 (A)(B)(C) 1-2-1 동일 슬롯 패턴), MED/LOW 각 1.
- 참고: `단어.adversarial.json` (이전 세션 산출). 이번 세션 대상 아님 — jacob 참고용으로 기재.

## 3. 워크북 (기존 산출물 재확인)
- validate PASS, 블라인드 20/20, cross-blind PASS, cross-leak PASS(같은구역 0)
- adversarial HIGH 0 (LOW 2)
- 참고: `워크북.adversarial.json`

---

## 산출 파일 (퀴즈, 이번 세션)
- `퀴즈.blind.json` (20/20)
- `퀴즈.cross-blind.json` (verify PASS)
- `퀴즈.adversarial.json` (HIGH 2 · MED 5 · LOW 1)
- `_audit-report.md` (본 파일)
