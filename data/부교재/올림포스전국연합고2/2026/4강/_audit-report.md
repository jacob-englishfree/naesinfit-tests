# 올림포스전국연합 고2 2026 4강 Ex12 퀴즈 출제·검수 증적 리포트

**작성일**: 2026-04-14
**대상**: 김리원 w3 수업자료 (2차 퀴즈, 마감 2026-04-21 화)
**파일**: `data/부교재/올림포스전국연합고2/2026/4강/Ex12/퀴즈.json`
**원문 출처**: `_passage.json` (For companies interested in delighting customers ... 'give away the house')

## 최종 결과

| 항목 | 결과 |
|---|---|
| 문항 수 | 20 / 100점 (쉬움5×4 + 보통10×5 + 어려움5×6) |
| validate.js | PASS (S급 0, B급 9 — 전부 권장/설계상 무시 가능) |
| blind-solve | 20/20 일치 (Opus 4.6 1M, 정답 가린 채 풀이) |
| cross-blind | 20/20 일치 (독립 추론 경로) |
| adversarial | HIGH 0건 / MEDIUM 1건(Q7) / LOW 2건(Q16-Q17 설계상) |
| Q18 재출제 | ✅ 완료 (출제 오류 발견 → 어순배열 교체) |
| Q19/Q20 토큰 셔플 | ✅ 완료 (정답순→알파벳순 교정) |

## 검수 파이프라인 이행 (8-STEP SOP)

| SOP 단계 | 상태 | 산출물 |
|---|---|---|
| STEP 0 원문 확보 | ✅ | `_passage.json` |
| STEP 1 출제 | ✅ | `퀴즈.response.json` (이전 세션) |
| STEP 2 assemble + validate | ✅ | `퀴즈.json` (PASS) |
| STEP 3 블라인드 풀이 (20/20) | ✅ | `퀴즈.blind.json` (Opus 4.6 1M, 20/20 매치) |
| STEP 4 정답 대조 + 재출제 | ✅ | Q18 출제 오류 1건 발견·재출제 / Q19-Q20 토큰 셔플 보정 |
| STEP 5 적대적 공격 | ✅ | `퀴즈.adversarial.json` (HIGH 0) |
| STEP 6 자동 재검증 | ✅ | validate PASS + cross-blind 20/20 |
| STEP 7 증적 리포트 | ✅ | 본 문서 |
| STEP 8 jacob 확인 후 배포 | ⏸ | 승인 대기 |

## 출제 구성 (퀴즈 표준 순서)

| Q | 유형 | 난이도 | pts | ans |
|---|---|---|---|---|
| 1 | 어법 | 쉬움 | 4 | 2 |
| 2 | 어법 | 보통 | 5 | 4 |
| 3 | 어법 | 어려움 | 6 | 1 |
| 4 | 문맥상 부적절한 어휘 | 보통 | 5 | 3 |
| 5 | 문맥상 부적절한 어휘 | 어려움 | 6 | 4 |
| 6 | 빈칸추론 | 보통 | 5 | 3 |
| 7 | 빈칸추론 | 보통 | 5 | 1 |
| 8 | 내용 일치/불일치 | 쉬움 | 4 | 2 |
| 9 | 내용 일치/불일치 | 보통 | 5 | 3 |
| 10 | 내용 일치/불일치 | 보통 | 5 | 3 |
| 11 | 주제 | 보통 | 5 | 2 |
| 12 | 주제 | 어려움 | 6 | 1 |
| 13 | 함축의미 추론 | 어려움 | 6 | 1 |
| 14 | 지칭추론 | 쉬움 | 4 | 2 |
| 15 | 지칭추론 | 보통 | 5 | 3 |
| 16 | 서술형 (찾기) | 쉬움 | 4 | the top |
| 17 | 서술형 (찾기) | 보통 | 5 | lowering its price |
| 18 | 어순배열 | 어려움 | 6 | the purpose of marketing is to generate customer value profitably |
| 19 | 서술형 — 조건영작 | 쉬움 | 4 | by lowering its price or increasing its services |
| 20 | 서술형 — 조건영작 | 보통 | 5 | the marketer must continue to generate more customer value |

총점 100, ans 1-indexed, 최대 동일번호 5개 이내.

## STEP 4 정답 대조 — 발견·수정 내역

### 1. Q18 어순배열 (CRITICAL — 출제 오류)

**기존 (오류):**
- 토큰: `[a, balance, delicate, requires, This, very, customer, value, profitably]` (9개)
- wa: `"This requires a very delicate balance customer value profitably"` (의미 불명)
- 빈칸 위치: `Thus, the purpose of marketing is to generate customer value profitably. __________: the marketer must continue...`
- **문제**: 토큰 `customer/value/profitably` 3개가 빈칸 바로 앞 문장에서 이미 사용됨. 원문 `This requires a very delicate balance`(6단어)에 임의로 3토큰을 끼워 넣어 wa가 비문 발생.

**수정:**
- 토큰: `[customer, generate, is, marketing, of, profitably, purpose, the, to, value]` (10개, 알파벳순)
- wa: `the purpose of marketing is to generate customer value profitably`
- 빈칸 위치: `But this may result in lower profits. Thus, __________. This requires a very delicate balance: ...`
- 본문 `the purpose of marketing is to generate customer value profitably` 그대로. 의미·문법·빈칸 위치 모두 자연 일치.

### 2. Q19 영작 — 토큰 셔플 보정 (S-WRITTEN-TOKEN-LEAK 회피)

- 기존 [조건] (1): `by, lowering, its, price, or, increasing, its, services` — 정답순 그대로
- 수정 [조건] (1): `by, increasing, its, its, lowering, or, price, services` — 알파벳순 셔플

### 3. Q20 영작 — 토큰 셔플 보정

- 기존 [조건] (1): `the, marketer, must, continue, to, generate, more, customer, value` — 정답순 그대로
- 수정 [조건] (1): `continue, customer, generate, marketer, more, must, the, to, value` — 알파벳순 셔플

## STEP 5 적대적 공격 결과

`퀴즈.adversarial.json` 상세. 요약:

- **HIGH 0건**
- **MEDIUM 1건**: Q7 빈칸 `satisfaction` — 본문에 동일 어휘가 4회 이상 등장(customer satisfaction, satisfying customers 등)해 학생이 단순 베끼기 가능. 다만 빈칸 추론 본질이 본문 핵심 어휘 추론이라 폐기 불필요. 다음 출제 시 빈칸 위치 다양화 권장.
- **LOW 2건**: Q16/Q17 서술형 찾기 정답이 본문 노출 — jacob 사전 지시(찾기 유형 노출은 무시)에 따라 의도된 설계.

## validate B급 경고 9건 처리

| 코드 | 문항 | 처리 |
|---|---|---|
| SCHEMA-DET-PATTERN | Q1/Q2/Q3 | 어법 det.korean이 "X → Y" 권장 형식이 아님 — 권장 사항이라 무시 |
| EX-1 | Q7 | 빈칸 satisfaction 노출 — 빈칸 추론 본질 + adversarial MEDIUM 기록 |
| EX-2 | Q16/Q17 | 찾기 유형 정답 노출 — jacob 사전 지시 무시 |
| C20 | (전체) | histKey 패턴 미일치 — 무시 |
| T39 | Q18 | 퀴즈 순서상 어순배열은 FIRST 그룹 권장 — 권장 사항 무시 |
| P2 | Q1 | passage 앞부분 fullPassage 미발견 — 어법 마커 처리 false positive (실제 동일) |

## Tier 2/3 추가 검증

- **Cross-blind (독립 추론 경로)**: ✅ 20/20 일치 (`퀴즈.cross-blind.json`)
- **Cross-blind verify CLI**: `[PASS] 20/20 cross-blind 일치`
- **validate-render --screenshot**: ❌ 미수행 (HTML 빌드 미트리거)
- **npm run verify (인앱브라우저 7종)**: ❌ 미수행 (배포 후 진행)
- **jacob 5% 스팟 풀이**: ⏸ 승인 후

## 산출물 (4종 게이트 충족)

- ✅ `퀴즈.json` (final)
- ✅ `퀴즈.blind.json` (20/20)
- ✅ `퀴즈.cross-blind.json` (20/20)
- ✅ `퀴즈.adversarial.json` (HIGH 0)
- ✅ `_audit-report.md` (본 문서)

## DB 배포 단계 (jacob 승인 후)

- [ ] `node deploy-json.js data/부교재/올림포스전국연합고2/2026/4강/Ex12/퀴즈.json` (STRICT_GATE=true 권장)
- [ ] Supabase `contents` 테이블: `assets.quiz.Ex12.has = true` 확인
- [ ] `test-deploy.ts` 매핑 확인 (`올림포스전국연합고2-2026-4강` → Ex12 quiz 등록)
- [ ] 김리원(w3) selections에 contentId 반영 확인
- [ ] 학생 대시보드에서 Ex12 퀴즈 카드 표시 확인 (실제 사이트 접속)
- [ ] 카카오톡 인앱브라우저 1회 실기기 검수
