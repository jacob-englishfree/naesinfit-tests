# 퀴즈(예상문제) 검수 증적 — Pathways4 Unit6

- 대상: 부교재 Pathways 4 / Unit6 "Is Joy the Same in Every Language?"
- 테스트: 퀴즈(예상문제) 20문항 / 총점 100
- 일자: 2026-09-06

## STEP A — 조립 + validate
- `node create-test.js --assemble …/퀴즈.response.json` → **PASS**
- `node validate/validate.js …/퀴즈.json` → **[PASS]** (S/A급 0건)
- ans 분포: {"1":3,"2":4,"3":4,"4":4} — 한 번호 최대 4개, 최대 연속 2개 준수. 배점 100.

## 수정 내역
### Q9 (내용 일치/불일치) — A-PARAPHRASE 결함 근본 수정
- 원인: 정답 선지(ans=2)가 passage 영어 고유명사/원어(Baranczak·szczesliwy·happiness)를 그대로 직역해 A-PARAPHRASE(S급) 발동.
- 조치: 4선지 전부 고유명사 제거 후 패러프레이즈로 재작성. 정답(ans=2)은 "어느 언어에서 '행복'의 번역어로 제시되는 낱말이 실제로는 영어의 그것과 정서적 뉘앙스가 다르다"로 내용 유지·표현 변형. 오답 3개는 본문 세부를 미묘하게 뒤집음(견딤↔못견딤, hygge↔sisu 뒤바꿈, 문화너머↔문화안만). det(korean/analysis) 동기화.
- ans는 2로 유지(X42 없음).

### Q17 (서술형) — 마커 미적용(학생이 풀 수 없음) 구조 결함 수정
- 원인: 스키마 testLayouts["퀴즈"] slot 17 타입이 02:59에 "어법고쳐쓰기"→"어형변환"으로 변경된 뒤 03:18 조립됨. response는 어법고쳐쓰기(markers ①supporting)로 작성돼 있었으나 조립 타입이 어형변환이라 overlay.markers가 무시되고 passage가 도입부 3문장(424자)만 발췌 → ① 마커·정답 대상어 모두 사라져 **학생이 고칠 밑줄이 화면에 없음**.
- 조치: 현재 스키마 슬롯(어형변환)에 맞춰 재작성. `overlay.excerptSentences`에 대상 문장 포함 발췌(2문장) + `__________ (support)` 빈칸. stem="빈칸에 괄호 안 단어를 알맞은 형태로 바꿔 쓰시오". 정답어(supported)·문법 포인트(수동 과거분사) 동일 유지, 이제 정답 노출 없이 풀이 가능.
- 참고: 참고 PASS(Unit5)는 slot 17이 "어법고쳐쓰기"(전문 지문)였음. 스키마 변경은 다른 세션 소행으로 판단되어 공유 스키마는 건드리지 않고 문항을 현재 슬롯에 정합.

## STEP B — 블라인드 풀이 (정답 비공개, Opus 독립 풀이)
- `퀴즈.blind.json` → **20/20 일치**, 전 문항 reasoning 포함.

## STEP C — 교차검증 (독립 재풀이)
- `node cross-blind.js --prep` → 독립 Opus 재풀이 → `퀴즈.cross-blind.json`
- `node cross-blind.js --verify` → **[PASS] 20/20 일치**

## STEP D — 적대적 검수
- `퀴즈.adversarial.json` → **HIGH 0건**
- MED 2건: 부교재 fullPassage-overlay 설계상 빈칸/서술형 정답이 형제 문항의 반복 지문에 노출되는 교차문항 누출(관례 수용, 엔진 단일 문항 노출로 실사용 무영향).
- 복수정답/정답오류/자기지문 노출/det 불일치: **0건**.

## 교차 누출 게이트
- `validate/check-cross-leak.py` → **[PASS]** 같은구역 노출 0건 (다른구역 145건은 fullPassage 반복, 수용).
- 단어.json / 워크북.json 정답·빈칸 중복: **none**.

## 결론
validate PASS(S/A급 0) · blind 20/20 · cross-blind 20/20 · adversarial HIGH 0 · cross-leak PASS. 배포 가능.
