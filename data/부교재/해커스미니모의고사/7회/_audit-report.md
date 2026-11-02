══════════════════════════════════════════
  테스트 검증 리포트 (폴더 단위) — 해커스 수능영어독해 미니모의고사 완성 7회
  폴더: data/부교재/해커스미니모의고사/7회/
  생성일: 2026-09-07
  사유: 총괄 교차점검 [0] 후속 — 교안(hm_r07) 예상문제와 정답 완전중복 7건 재출제
══════════════════════════════════════════

[대상] 7회 4지문 × 3종 = 12파일 (1번 요지 / 2번 주제 / 6번 빈칸 / 8번 순서)
  * 이번 작업은 교안 중복 7건이 걸린 5파일(2번 워크북 · 6번 워크북 · 6번 퀴즈 · 8번 퀴즈 · 8번 워크북)만 재출제.
  * 나머지 7파일(1번 3종, 2번 단어/퀴즈, 6번 단어, 8번 단어)은 원본 유지(교안 겹침 0 재확인).

────────────────────────────────────────────
[재출제 7건] 같은 지문 · 다른 문장/타깃 (create-test.js 파이프라인: response.json 편집 → --assemble)
────────────────────────────────────────────
| # | 파일 | 문항 | 기존(교안중복·삭제) | → 재출제 정답 | 문법포인트 |
|---|------|------|--------------------|--------------|-----------|
| 1 | 2번 워크북 | Q20 조건영작 | They drew much of their inspiration from natural objects (교안 set1 Q9) | with columns seemingly sprouting from their natural surroundings | with+분사 부대상황 |
| 2 | 6번 워크북 | Q20 조건영작 | the land steadily drifted north and was covered by water (교안 set2 Q14) | It also triggered the transformation of existing rock | trigger the transformation of |
| 3 | 6번 퀴즈 | Q7 빈칸 | significant geological changes (교안 set2 Q11) | the formation of mountain ranges | 빈칸추론(방향성 단서) |
| 4 | 8번 퀴즈 | Q6 빈칸 | avoid confrontation (교안 set3 Q19) | trying to understand others | 빈칸추론(대칭구조) |
| 5 | 8번 퀴즈 | Q18 조건영작 | this approach may strengthen the unfair systems and divisive attitudes (교안 set2 Q20) | push people toward applying either compassion or judgment | 전치사+동명사·either/or |
| 6 | 8번 퀴즈 | Q20 조건영작 | Feeling sympathy is crucial in pursuing social justice (교안 set3 Q20) | There are conflicting sides and uncomfortable debates along the way | There be+병렬명사구 |
| 7 | 8번 워크북 | Q11 빈칸 | kindness with courage (교안 set1 Q19) | genuine dialogue | 빈칸추론 |

────────────────────────────────────────────
[STEP 2] 구조 검증 (validate.js) — 5파일 전부 ✅ PASS (S급 0)
────────────────────────────────────────────
  · 2번 워크북 PASS(4 warn) / 6번 워크북 PASS(2 warn) / 6번 퀴즈 PASS(2 warn) / 8번 퀴즈 PASS(5 warn) / 8번 워크북 PASS(3 warn)
  · 잔여 warning은 전부 [B]급(P2 어법 마커 앞부분·긴 영어선지 truncation 오탐) — 비차단
  · 재출제 중 적발·수정한 실제 결함:
    - #2 최초 타깃 "Ireland's northern region existed on..." → S-WA-CONTRACTION(아포스트로피)+빈칸 미적용 → "It also triggered the transformation of existing rock"로 교체(어순 유일·아포스트로피/콤마/하이픈 없음)

[STEP 3+4] 블라인드 풀이 + 정답 대조 — 5파일 각 20/20 일치
────────────────────────────────────────────
  · 재출제 빈칸 3건(6번퀴즈 Q7·8번퀴즈 Q6·8번워크북 Q11): 결정론 solver self-blind 일치(match=True)
  · 재출제 서술형 4건(2번WB Q20·6번WB Q20·8번퀴즈 Q18·Q20): fullPassage 재구성 self-blind 일치
  · 미변경 문항 전체: 독립 Opus 에이전트 5기(파일별)가 정답 숨긴 프롬프트로 재풀이 → 전건 정답키 일치(불일치 0)
  · 8번 워크북 Q14(오류찾기) 결정론 solver 오답(4) → 독립 풀이로 ③powering→powered 확정(ans=3) 정정

[STEP 5] 적대적 공격 (adversarial) — 재적대검수 후 5파일 HIGH 0
────────────────────────────────────────────
  · 초기 적발·해소:
    - #1 2번WB Q20: HIGH 복수정답('their'가 columns/surroundings 양쪽 부착 성립) → accept에 두 어순 등록으로 자동채점 오답 사고 차단
    - #4 8번퀴즈 Q6: MED 톤소거(오답 3개 전부 부정어) → 긍정형 오답 'defending our own beliefs boldly'(용기축 중복=오답)로 교체
    - #5 8번퀴즈 Q18(either/or 교환)·#6 8번퀴즈 Q20(and 교환): LOW → accept 대체어순 등록
    - #7 8번WB Q11: 톤충돌 오답 'violent conflict'→'creative freedom' 교체(변별력)
  · 재검증: 보정된 #4·#7 독립 재풀이 → 정답 유일(unique=true), 방어 가능한 오답 0

[cross-blind] Tier 2 반대관점 독립 재풀이 — 재출제 7문항 전건 출제정답과 일치
[cross-leak] check-cross-leak / N7(워크북↔퀴즈 같은구역) — 재출제 후 같은구역 정답 중복 0건

────────────────────────────────────────────
[⭐ 교안 겹침 대조] hm_r07 exam1~3(set1~3) 정답 vs 7회 테스트 3종 — ✅ 겹침 0건
────────────────────────────────────────────
  · 스크립트: scratchpad/xcheck_gyoan.py (번호→교안passage 매핑 1번=A·2번=B·6번=C·8번=D, 정규화 정확일치)
  · 7회 전 테스트 정답 84개(wa+빈칸) + accept 변형 포함 134개 ↔ 교안 passage별 정답(A3·B9·C9·D6) 전수 대조
  · 결과: **겹침 0건** — 재출제 7건 포함 7회 테스트 정답이 교안 완결교안(정답·해설 인쇄본)과 완전 분리
  · 교안 재타깃 함정 회피: #1을 다른 절로 옮기면 교안 set2 Q10 문장전환 정답에 그대로 포함 → columns 절(교안-clean) 유지+accept 보강으로 해결

[증적 산출물] 5파일 각 .blind.json + .cross-blind.json + .adversarial.json 갱신 완비 + 본 폴더단위 _audit-report.md

최종 판정: ✅ 데이터 게이트 통과 (교안 겹침 0 / validate PASS / blind 20/20 / adversarial HIGH 0)
⛔ 배포·push 금지 — 배포는 ⑦ 세션(총괄 승인) 담당
══════════════════════════════════════════
