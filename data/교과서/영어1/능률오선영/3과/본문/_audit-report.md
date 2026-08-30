# 영어1 능률(오선영) 3과 본문 — 예상문제(퀴즈) 재출제 감사 리포트

- 대상: `data/교과서/영어1/능률오선영/3과/본문/퀴즈.json`
- 지문: "Under a Shared Roof" (Humanitas 세대 간 함께 살기, fullPassage 4,888자)
- 재출제일: 2026-08-30
- 출제/검수: Claude Opus 4.8 (교차풀이: Sonnet 서브에이전트)
- 재출제 사유: 구버전(2026-06-13) Q16~18이 서술형 찾기형/핵심단어형 → 현행 스펙(S-QUIZ-WRITTEN-SAFE-TYPE) 위반 FAIL. 20문항 전체를 현행 스펙으로 재출제.
- ⛔ 단어.json / 워크북.json 미변경 (요청대로 보존)

## 문항 구성 (20문항 / 100점)
| # | 유형 | 난이도 | 배점 | 정답 |
|---|------|--------|------|------|
| 1 | 어법(관계절 수일치 require) | 쉬움 | 4 | ② |
| 2 | 어법(수동 부정사 to be offered) | 보통 | 5 | ② |
| 3 | 어법(계속적 용법 which) | 어려움 | 6 | ④ |
| 4 | 문맥상 부적절 어휘(meaningful) | 보통 | 5 | ③ |
| 5 | 문맥상 부적절 어휘(empty) | 어려움 | 6 | ③ |
| 6 | 빈칸추론 | 보통 | 5 | ① |
| 7 | 빈칸추론 | 보통 | 5 | ② |
| 8 | 내용 일치 | 쉬움 | 4 | ③ |
| 9 | 내용 불일치 | 보통 | 5 | ③ |
| 10 | 내용 일치 | 보통 | 5 | ④ |
| 11 | 주제 | 보통 | 5 | ① |
| 12 | 제목(영어 선지) | 어려움 | 6 | ① |
| 13 | 함축의미(we were in our 20s again) | 어려움 | 6 | ② |
| 14 | 지칭추론(them) | 쉬움 | 4 | ④ |
| 15 | 빈칸추론(영어 선지) | 보통 | 5 | ① |
| 16 | 서술형 — 조건영작 | 쉬움 | 4 | — |
| 17 | 서술형 — 어법고쳐쓰기(informed) | 보통 | 5 | — |
| 18 | 서술형 — 조건영작 | 어려움 | 6 | — |
| 19 | 서술형 — 어순배열 | 쉬움 | 4 | — |
| 20 | 서술형 — 조건영작 | 보통 | 5 | — |

- 배점 분포: 쉬움 5×4=20 / 보통 10×5=50 / 어려움 5×6=30 = **100점**
- 정답 분포(mc 15문항): {1:4, 2:4, 3:4, 4:3} — 동일번호 최대 4개, 3연속 없음
- 서술형 5문항 전부 안전형(조건영작/어법고쳐쓰기/어순배열) — 찾기·핵심단어형 0건

## 검수 결과
- **validate**: `[PASS]` — S급/A급 0건, 경고 0건
- **blind-solve**: 20/20 일치 (자체 독립 풀이, reasoning 포함)
- **cross-blind**: 20/20 일치 (Sonnet 서브에이전트 독립 풀이 → cross-blind.js --verify PASS)
- **adversarial**: 11개 체크리스트 전수 공격 — HIGH/MEDIUM/LOW **0건**

## 수정 내역
- Q4 excerptRange [25,30]→[24,30]: P2(B) 경고(첫 50자 내 마커) 제거
- Q12 det.analysis: 잘못된 "❌ ① 안내" 도입 줄(중복 ① 마커) 제거 → 선지별 ❌/✅ 표준 포맷으로 정리

## Cross-leak 확인 (단어/워크북과 중복 회피)
- 어법 정답 포인트: 수일치/수동부정사/계속적용법 which — 워크북(began/required/gathered/what·that/create)과 상이
- 부적절 어휘 교체어(meaningful/empty) — 단어·워크북 교체어와 상이
- 빈칸/서술형 wa: spending time.../a community.../a more youthful.../the students held.../there is still.../elderly residents share.../I see all... + informed — 단어·워크북 blank/wa와 전부 상이

## 산출물
- 퀴즈.response.json / 퀴즈.json / 퀴즈.blind.json / 퀴즈.cross-blind.json / 퀴즈.adversarial.json

## 배포
- **미배포** (로컬 검증까지만). git push / deploy-json / sync 미실행.
