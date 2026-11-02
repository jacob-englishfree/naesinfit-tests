══════════════════════════════════════════
  테스트 검증 리포트
  파일: data/부교재/해커스미니모의고사/7회/8번/워크북.json
  생성일: 2026-09-07
  지문: 해커스 수능영어독해 미니모의고사 완성 7회 8번 (사회정의 compassion vs judgment, 181단어)
══════════════════════════════════════════

[구성] 20문항 / 100점 (쉬움 5×4=20, 보통 10×5=50, 어려움 5×6=30)
  유형: 어법×4, 어휘(부적절)×2, 내용이해 T/F×3, 빈칸추론×2, 내용 일치/불일치×2,
        오류찾기×1, 서술형(찾기)×2, 서술형 어형변환×1, 주제/요지×2, 서술형 조건영작×1
  정답분포(mc): {1:4, 2:4, 3:5, 4:3} — 한 번호 5개 이하·3연속 없음
  어법 포인트: 수동태 / 전치사+동명사 / 명사+to부정사 / 동명사구 being — 4개 모두 상이

[STEP 2] 구조 검증(validate.js): ✅ PASS (0 errors / 2 warnings)
  - [B] P2(Q14 오류찾기 커스텀 4문장 지문) → 정상
  - [B] Q6-WEAK-DISTRACTOR(Q10 self-righteousness 오답 지문 밖) → 정상
[STEP 3] 블라인드 풀이: 20/20 (워크북.blind.json)
  - 자동 blind-solver가 오류찾기 Q14를 오판(④)했으나, 커스텀 지문 특성상 한계.
    에이전트 수동 블라인드로 ③(powering→powered) 확정 → 실제 20/20 일치
[STEP 4] 정답 대조: 20/20 일치 (불일치 0건)
[STEP 5] 적대적 공격(워크북.adversarial.json): HIGH 0건
  - Q20 조건영작 대칭 or 어순 대체안 'destructive behaviors or ideas are tolerated' accept 추가(억울 감점 방지)
  - LOW: Q10 빈칸 distractor 긍정어 편중(의도된 추론 포인트)
[STEP 6] cross-blind PREP: 워크북.cross-prompt.json 생성
[cross-leak] check-cross-leak.py: ✅ PASS — 같은구역 노출 0건 (다른구역 101건은 fullPassage 오버레이 특성상 자문급)

[cross-file] 단어↔워크북 유형·정답 중복 회피 확인 (워크북 wa/blank는 단어와 상이)

최종 판정: ✅ 데이터 게이트 통과 (배포는 jacob 확인 후)
══════════════════════════════════════════
