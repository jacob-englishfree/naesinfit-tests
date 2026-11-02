══════════════════════════════════════════
  테스트 검증 리포트
  파일: data/부교재/해커스미니모의고사/7회/2번/워크북.json
  생성일: 2026-09-07
  지문: 해커스 수능영어독해 미니 모의고사 완성 7회 2번 (Art Nouveau, 6문장/161단어)
══════════════════════════════════════════

[STEP 1] 출제: create-test.js 파이프라인 (response → assemble). 20문항 / 100점.
  배점: 쉬움 5×4=20 + 보통 10×5=50 + 어려움 5×6=30 = 100

[STEP 2] 구조 검증(validate.js): ✅ PASS (0 errors, 4 warnings)
  - S급 11종 위반 0건
  - 경고 4건 모두 B급(비차단):
    · P2 Q3/Q14: 마커가 도입부에 위치/오류찾기 커스텀 지문 → 정상
    · Q6-WEAK-DISTRACTOR Q10/Q11: 빈칸추론 오답이 본문 밖 어휘(추론형 특성상 정상, 권장 경고)

[STEP 3] 블라인드 풀이: 20/20 (워크북.blind.json), 정답 미확인 상태로 풀이

[STEP 4] 정답 대조: 20/20 일치 ✅ (mismatched 0)

[STEP 5] 적대적 공격(워크북.adversarial.json): HIGH 0건
  - Q2: 어법 오류 마커가 4단어 구로 밑줄됨 (판단 지장 없음) → severity low. 유지.

[STEP 6] cross-blind prep: ✅ 워크북.cross-prompt.json 생성 (별도 세션 풀이)

[출제 유형]
  - 어법 ×4 (Q1~4): 병렬(on+동명사) / 주어-동사 수일치 / 관계대명사 that vs what / 능동 분사구문
  - 문맥상 부적절한 어휘 ×2 (Q5~6): symmetrical→asymmetrical / poorly→perfectly
  - 내용이해 T/F ×3 (Q7~9)
  - 빈칸추론 ×2 (Q10 nature / Q11 copying or reinterpreting)
  - 내용 일치/불일치 ×2 (Q12 일치 / Q13 불일치)
  - 오류찾기 ×1 (Q14, seeing→seen 수동태)
  - 서술형 찾기 ×2 (Q15 total works of the arts / Q16 works from past artistic movements)
  - 서술형 어형변환 ×1 (Q17 become→became)
  - 주제/제목 ×2 (Q18 주제 / Q19 제목)
  - 서술형 조건영작 ×1 (Q20)

정답 분포: {1:4, 2:4, 3:4, 4:4} — 균등, 동일번호 최대 4개, 3연속 없음

[cross-leak 대조] 단어테스트 정답(reflected/integrated, blank: inspiration/emphasis/landscape, such as/depart from)과
  워크북 정답(blank: nature, copying or reinterpreting; wa: total works of the arts, works from past artistic movements, became, They drew...objects) — 동일 wa/blank 겹침 0건

최종 판정: ✅ 검수 통과
══════════════════════════════════════════
