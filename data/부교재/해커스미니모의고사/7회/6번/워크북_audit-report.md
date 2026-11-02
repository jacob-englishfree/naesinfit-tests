# 워크북 테스트 검증 리포트 — 해커스미니모의고사 7회 6번

- 파일: `data/부교재/해커스미니모의고사/7회/6번/워크북.json`
- 지문: Ireland tectonic geology — fullPassage 통째 + 오버레이 (오류찾기 Q14만 4문장 패러프레이즈, 스키마 허용)
- 문항/배점: 20문항 / 100점 (쉬움 5×4=20, 보통 10×5=50, 어려움 5×6=30)

## 유형 순서 (스키마 워크북 레이아웃 준수)
Q1-4 어법 · Q5-6 어휘 · Q7-9 내용이해 T/F · Q10-11 빈칸추론 · Q12-13 내용 일치/불일치 · Q14 오류찾기 · Q15-16 서술형(찾기) · Q17 서술형-어형변환 · Q18-19 주제/요지 · Q20 서술형-조건영작

## STEP A 출제/조립
- `create-test.js --assemble` 조립 후 validate PASS. 정답분포 1:4 / 2:4 / 3:4 / 4:4 (동일번호 ≤5, 3연속 없음). TF는 T/F/T.
- S/A급 0건. 잔여 warnings 2건 [B] 비차단: P2(Q5 sent1 초반 마커 tectonic, Q14 커스텀 패러프레이즈 지문 — fullPassage 시작과 다름).

## STEP B 자체 블라인드
- 20/20 일치. 자동솔버 9건 + 에이전트 직접풀이 11건(어법 Q4·TF·일치/불일치·오류·서술형찾기·주제/요지). `워크북.blind.json`.

## STEP C 적대적 공격
- HIGH 0건 (LOW 3건: 어법 포인트 중복 여부·Q10 유사어 인접·Q14 패러프레이즈 — 모두 정답 유일성 확인). `워크북.adversarial.json`.

## STEP D Cross-blind
- `워크북.cross-prompt.json` prep만 생성. **풀이 미실시 (반대 모델 별도 세션 필요)**.

## 단어와의 차별
- 어법/어휘 포인트(수동태·SV일치·전치사+관계대명사·병렬), 빈칸(combined/mountain ranges), 서술형 wa(sedimentary deposits / were initially divided by an ocean / creating / the land steadily drifted...) 모두 단어 테스트와 겹치지 않음.

## 판정: 구조 PASS · self-blind 20/20 · adversarial HIGH 0. cross-blind 풀이 대기.
