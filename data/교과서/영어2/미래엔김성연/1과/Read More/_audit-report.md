# 영어II 미래엔(김성연) 1과 Read More 워크북 감사 리포트

- 출제일: 2026-08-30
- 검수일: 2026-08-30 (동일 세션 내 블라인드+크로스블라인드+적대적 공격 전체 SOP 이행)
- 버전: v1 (신규 출제)
- 출제자: Claude Sonnet 5 (jacob 승인 하 직접 출제, 위임 없음)
- 유형 믹스: 어법4 / 어휘(부적절)2 / 내용이해T-F3 / 빈칸추론2 / 내용일치·불일치2 / 오류찾기1 / 서술형(찾기)2 / 서술형-어형변환1 / 주제·요지2 / 서술형-조건영작1 = 20문항, 100점 (쉬움5×4=20 / 보통10×5=50 / 어려움5×6=30)
- validate: PASS (S급 0건, A급 0건, B급 warning 1건 — Q20 P2: 조건영작 blank가 첫 문장 도입부에 위치해 발생하는 구조적 불가피 오탐, 정답 텍스트 자체는 fullPassage와 정확 일치 확인)
- fullPassage: _passage.json ↔ 워크북.json 일치 확인 (스크립트 자동 주입, 수기 복붙 없음)
- 크로스리크 회피: 같은 지문 단어.json(20문항, (A)(B)(C)/부적절어휘/빈칸어휘/동의어/반의어/다의어/영영풀이/어형변환)과 정답·타깃단어 전수 대조 — 겹침 0건 (development/interaction/value/inclusive/affection/different ways/material gifts 등 vocab 기출 타깃 전부 회피, 어형변환은 communication으로 분리)
- 블라인드: 20/20 일치 (정답 가리고 재풀이, reasoning 포함)
- 크로스블라인드: 20/20 일치 (node cross-blind.js --verify PASS)
- 적대적 공격: 1건 발견 → 즉시 수정 (Q20 조건영작 'at concerts' 위치 어순 복수정답 가능성 → accept 배열에 대안 어순 추가) → 최종 이슈 0건
- 배포 상태: 미배포 (jacob 확인 대기)
