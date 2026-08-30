# 워크북 테스트 증적 리포트 — Pathways4 / Unit5 "The Smart Swarm"

- **대상**: 부교재 National Geographic Pathways RW3 / Unit5 Reading "The Smart Swarm" (양지원)
- **유형**: 워크북 (20문항 / 100점)
- **파일**: `data/부교재/Pathways4/Unit5/워크북.json`
- **histKey**: `workbooktest_pathways4_unit5_reading_v6`

## STEP A — 출제 + validate
- `create-test.js --assemble` 조립 성공, 20문항 전부 조립.
- 초기 FAIL 4건 → 전부 해결:
  1. `F7 ei.lesson missing` — 2단계 부교재 경로(Pathways4/Unit5)에서 buildEi가 `_passages` 메타데이터를 무시하던 엔진 버그. `passageData.lesson` 우선 사용 로직(폴백 가드 포함)으로 근본 수정 → subject/pub/lesson/section 정상 채움.
  2. `A-PARAPHRASE Q12` — 선지에 영어 'smart swarm' 직역 노출 → 한국어('똑똑한 무리')로 패러프레이즈.
  3. `A-PARAPHRASE Q13` — 선지에 'Fort A. P. Hill'(fort/hill) 노출 → '군사 실험'으로 일반화.
  4. `P2 Q17` — 어형변환 발췌문 앞부분 blank로 원문 대조 실패 → 온전한 원문 문장을 앞에 배치하도록 발췌 재구성.
- **최종 validate: [PASS]** (S/A급 0, 경고 0).

## STEP B — 블라인드 (정답 비공개 풀이)
- 20문항 독립 풀이 → `워크북.blind.json`.
- 정답키 대조 스크립트: **20/20 일치** (mc=ans, written=accept NORM 정규화 비교).

## STEP C — Cross-blind prep
- `cross-blind.js --prep` → `워크북.cross-prompt.json` 생성 완료(반대 모델 풀이용). cross-blind.json 미작성(지시대로 prep까지만).

## STEP D — 적대적 공격
- 20문항 재검토: 복수정답·정답노출·뻔한오답·마커오배치·모호stem **0건**.
- 마커/빈칸 렌더 실측: ①②③④ 단조증가·fullPassage 전체 분산 확인. 어법/어휘/오류 각 정답 1개만 오류, 나머지 3개 대입 시 완전문장.
- 서술형(15/16/17/20) 정답 passage 미노출 확인(찾기형 15·16 제외, 17·20은 blank 처리).
- **HIGH 0건**, LOW 4건(허용). → `워크북.adversarial.json`.

## 배점 분포
- 쉬움 4점 × 5 = 20 (Q1,2,7,12,18)
- 보통 5점 × 10 = 50 (Q3,5,6,8,9,10,13,15,17,19)
- 어려움 6점 × 5 = 30 (Q4,11,14,16,20)
- **총 100점** ✅

## ans 분포 (mc 16문항)
- `{"1":4, "2":5, "3":3, "4":4}` — 최대 5(한도 5)·연속 최대 1. 위반 없음.

## 유형 구성
- 어법 4 / 어휘 2 / 내용이해 T·F 3 / 빈칸추론 2 / 내용일치·불일치 2 / 오류찾기 1 / 서술형(찾기 2·어형변환 1·조건영작 1) 4 / 주제·요지 2. 워크북 화이트리스트 준수, 금지유형 0.

## 완료 조건 체크
- [x] validate ALL PASS (S/A급 0)
- [x] blind 20/20
- [x] cross-prompt 생성(cross-blind 미작성 — 지시 준수)
- [x] adversarial HIGH 0건
- [x] 산출물 6종 생성
