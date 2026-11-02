══════════════════════════════════════════
  테스트 검증 리포트
  파일: data/부교재/해커스미니모의고사/7회/1번/워크북.json
  출처: 해커스 수능영어독해 미니 모의고사 완성 7회 1번 (요지 파악하기)
  생성일: 2026-09-07
══════════════════════════════════════════

## 기본 정보
- 문항 수: 20문항
- 총점: 100점 (쉬움 5×4=20 / 보통 10×5=50 / 어려움 5×6=30)
- ans 분포: {1:4, 2:5, 3:5, 4:2} — 최대 5개 이내, 3연속 없음
- passage: fullPassage 통째 + 유형별 오버레이 (부교재 원칙 준수, 발췌 없음. 오류찾기 Q14만 자체 작성 패러프레이즈 지문)

## 유형 구성
어법 4 / 어휘(부적절어휘) 2 / 내용이해 T/F 3 / 빈칸추론 2 / 내용 일치/불일치 2 /
오류찾기 1 / 서술형(찾기) 2(written) / 서술형—어형변환 1(written) / 주제/요지 2 / 서술형—조건영작 1(written)

## [STEP 2] 구조 검증: ✅ PASS (0 errors, 3 warnings — 전부 B급 비차단)
- EX-1 (Q10 빈칸 정답이 지문 다른 곳에 등장 — 규정상 참고용, 빈칸 직후 5단어 내 노출 아니므로 비차단)
- RENDER-ANS-NOT-UNDERLINED (Q14 — 오류찾기 유형은 `<u>` 태그 사용이 오히려 금지 규칙(L.1)이라 정상)
- P2 (Q14 자체 작성 지문이라 원문 접두부 비교 오탐)

## [STEP 3] 자체 블라인드 풀이: 20/20 완료
- ans/wa/det 제거 후 독립 풀이, 20/20 일치 (불일치 0건)
- 상세 근거: 워크북.blind.json

## [STEP 5] 적대적 공격: 이슈 0건
- 어법 마커 4문항(Q1-Q4) 각각 문법 포인트 명확(주어-동사 수일치/병렬구조/관계대명사 who·that/consider+목적격보어) 확인
- 내용일치·T/F 문항의 "범위=보편적 vs 선호=문화마다 다름" 트랩 재검증 — 단일 정답 확인
- 최종: 워크북.adversarial.json — issues: [], totalIssues: 0

## [STEP 6] 자동 검증
- validate.js: ✅ PASS (S/A급 0건)
- Cross-blind (Tier 2, 반대 모델): 20/20 일치 ✅ PASS — 워크북.cross-blind.json

## Cross-leak (워크북↔퀴즈)
- `python3 validate/check-cross-leak.py 워크북.json` → 같은구역 노출 0건 (다른구역 우연노출 99건은 fullPassage 통째 표시 원칙상 불가피, 참고용)
- 워크북과 퀴즈의 wa/overlay.blank 값 전수 대조 — 동일 값 없음 확인 (differ/engaging/that·who/desirable·desirably/agree/demanding·relaxing/excitement/high-arousal/values/S1절 vs 퀴즈의 별도 타깃)

## 최종 판정: ✅ 배포 가능 (jacob 확인 후 배포)
══════════════════════════════════════════
