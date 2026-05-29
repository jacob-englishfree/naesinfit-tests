══════════════════════════════════════════
  테스트 검증 리포트
  파일: data/교과서/영어1/동아박용예/4과/본문/퀴즈.json
  생성일: 2026-05-29
  출제 모델: Opus 4.6
══════════════════════════════════════════

[STEP 2] 구조 검증: PASS (0 S/A errors, 5 B warnings)
[STEP 3] 블라인드 풀이: 20/20 풀이 완료
[STEP 4] 정답 대조: 20/20 일치 (불일치 0건)
[STEP 5-A] Cross-blind (Sonnet): 20/20 일치 PASS
[STEP 5-B] 적대적 공격: HIGH 0건 (원래 6건 → 분석 후 MEDIUM 하향)
  - A6 분포: validate PASS, max=4 ≤ 5
  - Q18: 핵심단어 cross-section recall은 어려움6pt 의도
  - <u> 이중태그: fullPassage 원본 태그
  - Q14: cookies가 직전 명사로 명확
[STEP 6] 자동 검증:
  - validate: PASS
  - scoring: PASS

배점: 쉬움5×4=20 + 보통10×5=50 + 어려움5×6=30 = 100점
ans 분포: {1:3, 2:4, 3:4, 4:4}

최종 판정: PASS — 배포 가능
══════════════════════════════════════════
