# 예상문제(퀴즈) 테스트 검증 리포트 — 해커스미니모의고사 7회 6번

- 파일: `data/부교재/해커스미니모의고사/7회/6번/퀴즈.json`
- 지문: Ireland tectonic geology — fullPassage 통째 + 오버레이 (어형변환 Q17만 3문장 발췌)
- 문항/배점: 20문항 / 100점 (쉬움 5×4=20, 보통 10×5=50, 어려움 5×6=30)

## 유형 순서 (스키마 퀴즈 레이아웃 준수)
Q1-3 어법 · Q4-5 문맥상 부적절한 어휘 · Q6-7 빈칸추론 · Q8-10 내용 일치/불일치 · Q11 주제 · Q12 제목 · Q13 함축의미 추론 · Q14 지칭추론 · Q15 빈칸추론 · Q16 조건영작 · Q17 어형변환 · Q18 조건영작 · Q19 어순배열 · Q20 조건영작

## STEP A 출제/조립
- `create-test.js --assemble` PASS. 정답분포 1:4 / 2:4 / 3:4 / 4:3 (동일번호 ≤5, 3연속 없음). T/F 미사용(퀴즈 규정).
- V63(어형변환 지문 짧음) 1회 발생 → Q17 excerpt 3문장으로 확장하여 해소. 
- 최종 S/A급 0건. 잔여 warnings 2건 [B] 비차단: P2(Q4 초반 마커, Q17 발췌 지문).
- 서술형 5개 전부 조건영작/어형변환/어순배열 (S-QUIZ-WRITTEN-SAFE-TYPE 준수).

## STEP B 자체 블라인드
- 20/20 일치. 자동솔버 13건 + 에이전트 직접풀이 7건(일치/불일치·주제·제목·함축·지칭). `퀴즈.blind.json`.

## STEP C 적대적 공격
- HIGH 0건 (LOW 4건: 어법 포인트 차별·빈칸 구절 유일성·서술형 안전유형·영어선지 한국어병기 — 모두 확인). `퀴즈.adversarial.json`.

## STEP D Cross-blind
- `퀴즈.cross-prompt.json` prep만 생성. **풀이 미실시 (반대 모델 별도 세션 필요)**.

## 워크북 대비 난이도 상향 + 중복 회피
- 어법: 병렬 시제·분사구문·계속적용법 which (워크북=수동태·SV·전치사+관계대명사와 다름)
- 내용일치: 패러프레이즈 선지, 세부 교차검증(암석 변형·대륙 귀속·방향)
- 주제/제목: 영어 선지 + det 한국어 번역 / 함축: 소면적↔다양지질 함의 / 지칭: 두 대륙
- 서술형 wa (The force of this collision created immense pressure / intriguing / the boundary along which the continents converged / the southern part was located on the continent of Gondwana / which forms parts of North America today) 모두 단어·워크북과 겹치지 않음.

## cross-leak
- `check-cross-leak.py`: 같은구역 노출 0건 PASS (부교재 fullPassage 특성상 다른구역 노출은 검토권고, 비차단).

## 판정: 구조 PASS · self-blind 20/20 · adversarial HIGH 0 · cross-leak 같은구역 0. cross-blind 풀이 대기.
