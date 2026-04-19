══════════════════════════════════════════
  테스트 검증 리포트
  파일: data/부교재/수능특강/영어독해연습/3강/2번/단어.json
  생성일: 2026-04-18
══════════════════════════════════════════

[STEP 1] 출제: 20문항 완료
  - 배점: 쉬움5x4=20 + 보통10x5=50 + 어려움5x6=30 = 100점
  - ans분포: {1:3, 2:5, 3:5, 4:5}
  - 유형: ABC조합3, 부적절3, 빈칸어휘3, 동의어3, 반의어2, 다의어1, 영영풀이1, 어형변환2, 빈칸문맥2

[STEP 2] 구조 검증: PASS (0 S/A errors, 3 B warnings)
  - B warnings: histKey pattern, P2 marker passage start (non-blocking)

[STEP 3] 블라인드 풀이: 20/20 풀이 완료

[STEP 4] 정답 대조: 20/20 일치
  - 불일치 0건

[STEP 5] 적대적 공격: HIGH 0건, LOW 3건
  - Q14: absent 반의어 existing (present도 가능하나 existing 명확)
  - Q17: free→freedom (freed 가능성 있으나 관사+명사 패턴으로 명확)
  - Q20: 빈칸 뒤 that power 힌트 (어려움 난이도로 적절)

[STEP 6] 자동 검증:
  - validate.js: PASS
  - validate-fulltext.js: PASS
  - validate-scoring.js: PASS

[STEP C] Cross-blind: 20/20 일치

최종 판정: PASS — 배포 가능
══════════════════════════════════════════
