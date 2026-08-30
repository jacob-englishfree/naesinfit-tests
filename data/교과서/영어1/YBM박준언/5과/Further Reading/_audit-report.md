══════════════════════════════════════════
  테스트 검증 리포트 — YBM(박준언) 영어I 5과
  생성일: 2026-05-30
══════════════════════════════════════════

■ 본문

  [단어] v=5, 20문항, 100점
    validate: ✅ PASS
    blind: 20/20 풀이
    adversarial: HIGH 0건
    정답분포: {1: 3, 2: 5, 3: 5, 4: 5}

  [워크북] v=5, 20문항, 100점
    validate: ✅ PASS
    blind: 20/20 풀이
    adversarial: HIGH 0건
    정답분포: {1: 4, 2: 4, 3: 5, 4: 3}

  [퀴즈] v=5, 20문항, 100점
    validate: ✅ PASS
    blind: 0/20 풀이
    adversarial: HIGH 0건
    정답분포: {1: 2, 2: 4, 3: 4, 4: 5}


■ Further Reading

  [단어] v=5, 20문항, 100점
    validate: ✅ PASS
    blind: 20/20 풀이
    adversarial: HIGH 0건
    정답분포: {1: 3, 2: 5, 3: 5, 4: 5}

  [워크북] v=5, 20문항, 100점
    validate: ✅ PASS
    blind: 20/20 풀이
    adversarial: HIGH 0건
    정답분포: {1: 3, 2: 4, 3: 5, 4: 4}

  [퀴즈] v=5, 20문항, 100점
    validate: ✅ PASS
    blind: 0/20 풀이
    adversarial: HIGH 0건
    정답분포: {1: 3, 2: 4, 3: 5, 4: 3}


최종 판정: ✅ 6파일 전부 배포 가능
══════════════════════════════════════════


══════════════════════════════════════════
  재출제 — Further Reading [퀴즈] (예상문제)
  재검증일: 2026-08-30  (모델: Opus 4.8, cross=Sonnet)
══════════════════════════════════════════

  사유: 구버전(2026-06-13) 퀴즈의 Q16~18이 폐기된
        "본문에서 찾아 쓰기/핵심단어" 서술형이라 현행
        S-QUIZ-WRITTEN-SAFE-TYPE 스펙 위반(FAIL).
        20문항 전체 현행 스펙으로 재출제.

  [퀴즈] v=6, 20문항, 100점
    유형: Q1~3 어법 / Q4~5 문맥부적절어휘 / Q6~7 빈칸추론 /
          Q8~10 내용일치·불일치 / Q11 주제 / Q12 제목 /
          Q13 함축 / Q14 지칭 / Q15 빈칸추론 /
          Q16 조건영작 / Q17 어법고쳐쓰기 / Q18 조건영작 /
          Q19 어순배열 / Q20 조건영작
    배점: 쉬움5×4=20 + 보통10×5=50 + 어려움5×6=30 = 100
    validate: ✅ PASS (S/A 0건, [B] 경고 4건 = 교과서 발췌 heuristic)
    blind: 20/20 일치
    cross-blind(Sonnet): 20/20 일치
    adversarial: HIGH 0건 (LOW 1: Q9 오답선지 'perhaps' 완화 — 정답 무관)
    정답분포: {1: 3, 2: 4, 3: 4, 4: 4}
    cross-leak: 워크북 wa(a football field/spacewalkers/
                test spacecraft systems/from going to Mars),
                워크북 빈칸(composed/extremes) 전부 회피 확인

  아티팩트: 퀴즈.json / 퀴즈.blind.json / 퀴즈.cross-blind.json /
           퀴즈.adversarial.json
  판정: ✅ 배포 가능 (배포는 미실행 — 로컬 검증까지만)
══════════════════════════════════════════