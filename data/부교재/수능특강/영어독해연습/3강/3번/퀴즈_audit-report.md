══════════════════════════════════════════
  테스트 검증 리포트
  파일: data/부교재/수능특강/영어독해연습/3강/3번/퀴즈.json
  생성일: 2026-04-18
══════════════════════════════════════════

[STEP A] 출제: 20문항 생성 (퀴즈.response.json → create-test.js --assemble)
  - 어법 3, 부적절어휘 2, 빈칸추론 2, 내용일치/불일치 3, 주제 2, 함축의미 1, 지칭추론 2, 서술형 2, 어순배열 1, 조건영작 2
  - 배점: 쉬움5×4=20 + 보통10×5=50 + 어려움5×6=30 = 100점
  - ans 분포: {1:4, 2:3, 3:3, 4:5} — 최대5개, 3연속 없음

[STEP 2] 구조 검증: PASS (0 S/A errors, 6 B warnings)
  - B-level: EX-1(Q7), EX-2(Q16,Q17 찾기유형), C20(histKey), T39(어순배열위치), P2(마커변환)

[STEP 3] 블라인드 풀이: 20/20 풀이 완료 (퀴즈.blind.json)
  - solver: opus-4.6-1m
  - 20문항 전부 풀이근거 기록

[STEP 4] 정답 대조: 20/20 일치
  - 불일치 0건

[STEP 5] 적대적 공격: HIGH 0건, MEDIUM 0건, LOW 2건 (퀴즈.adversarial.json)
  - Q7 LOW: focal objects 본문 노출 (빈칸으로 가려짐, EX-1 허용)
  - Q16 LOW: 찾기 유형 의도적 노출

[STEP 6] 자동 검증:
  - validate.js: PASS
  - validate-fulltext.js: PASS
  - validate-scoring.js: PASS

최종 판정: PASS — 배포 가능
══════════════════════════════════════════
