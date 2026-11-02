══════════════════════════════════════════
  테스트 검증 리포트
  파일: data/부교재/해커스미니모의고사/7회/2번/퀴즈.json
  생성일: 2026-09-07
  지문: 해커스 수능영어독해 미니 모의고사 완성 7회 2번 (Art Nouveau, 6문장/161단어)
══════════════════════════════════════════

[STEP 1] 출제: create-test.js 파이프라인. 20문항 / 100점.
  배점: 쉬움 5×4=20 + 보통 10×5=50 + 어려움 5×6=30 = 100
  난이도 위계: 워크북보다 상향 (복합 어법·패러프레이즈 일치·영어 선지 주제/제목/함축·간접 지칭·구절 빈칸·구문활용 서술형)

[STEP 2] 구조 검증(validate.js): ✅ PASS (0 errors, 2 warnings)
  - S급 위반 0건 (S-QUIZ-BLANK-SINGLE 없음: 모든 빈칸이 구절 2단어+, S-EN-CHOICE-NO-KR 없음: 영어 선지 전부 한국어 해석 병기)
  - 경고 2건 B급(비차단): P2 Q4(마커 도입부)/Q18(조건영작 도입부 빈칸) — 정상
  - ⚠️ 라이트 사전검사의 Q11/Q12 S-CH-TRUNCATED는 오탐(긴 선지 말미 heuristic), 정식 validate 미표출

[STEP 3] 블라인드 풀이: 20/20 (퀴즈.blind.json), 정답 미확인 상태로 풀이
  (assemble 자동 solver는 마커/빈칸 12문항만 자동, 내용유형 8문항은 에이전트가 풀이 완료)

[STEP 4] 정답 대조: 20/20 일치 ✅ (mismatched 0)

[STEP 5] 적대적 공격(퀴즈.adversarial.json): HIGH 0건
  - 서술형 복수정답 위험 근본 차단: Q16 'of Art Nouveau' 위치 대체배열 accept 추가, Q20 병렬 순서 대체배열 accept 추가
  - Q14/Q17/Q19 low 3건(변별력·난이도·채점안전) — 정답 유일성 확인, 유지

[STEP 6] cross-blind prep: ✅ 퀴즈.cross-prompt.json 생성 (별도 세션 풀이)
[STEP 6b] cross-leak(check-cross-leak.py): 같은구역 노출 0건 [PASS] (다른구역은 fullPassage 특성상 비차단)

[출제 유형]
  - 어법 ×3 (Q1 계속적용법 which/that / Q2 병렬 명사·형용사 / Q3 with+분사 부대상황)
  - 문맥상 부적절한 어휘 ×2 (Q4 hallmarks→weaknesses / Q5 elements→obstacles)
  - 빈칸추론(구절) ×3 (Q6 revive craftsmanship / Q7 create a sense of harmony / Q15 reflect the changing times)
  - 내용 일치/불일치 ×3 (Q8 일치 / Q9 불일치 / Q10 일치, 패러프레이즈)
  - 주제 ×1 (Q11, 영어 선지) / 제목 ×1 (Q12, 영어 선지)
  - 함축의미 추론 ×1 (Q13, 영어 선지) / 지칭추론 ×1 (Q14, 한국어 선지, 간접 지칭)
  - 서술형: 조건영작 ×3 (Q16/Q18/Q20) / 어형변환 ×1 (Q17 place→placed) / 어순배열 ×1 (Q19)

정답 분포: {1:4, 2:4, 3:3, 4:4} — 동일번호 최대 4개, 3연속 없음

[cross-leak 대조] 단어(reflected/integrated·inspiration/emphasis/landscape·such as/depart from) /
  워크북(nature·copying or reinterpreting·total works of the arts·works from past artistic movements·became·They drew...) /
  퀴즈(revive craftsmanship·create a sense of harmony·reflect the changing times·the practitioners...used these elements·placed·is a style of art that emerged...·This focus on nature was reflected...·In an effort to revive...)
  → 동일 wa/blank 겹침 0건, 워크북↔퀴즈 문법포인트·정답 전부 상이

최종 판정: ✅ 검수 통과
══════════════════════════════════════════
