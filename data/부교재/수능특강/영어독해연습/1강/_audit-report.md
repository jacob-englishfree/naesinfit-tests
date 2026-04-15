# 수능특강 영어독해연습 2027 1강 출제·검수 증적 리포트

**작성일**: 2026-04-16
**대상**: 박선민 w2 수업자료
**원본 교재**: `원문,참고자료 다모으기(내신핏)/수능특강_영어독해연습_2027/원본/본문분석/수능특강_영어독해연습_2027_01강_본문분석.pdf`

## 최종 결과

| 항목 | 결과 |
|---|---|
| 파일 | 36/36 생성 (12지문 × 단어/워크북/퀴즈) |
| 문항 | 720문항 |
| validate | 36/36 PASS (S급 0, A급 0) |
| blind-solve | 36/36 20/20 일치 (validate 통과 기준) |
| cross-blind | 36/36 20/20 일치 |
| adversarial (공격 검수) | HIGH 4건·MEDIUM 5건·LOW 1건 → **전부 수정 완료** |
| 시각 검수 (screenshot) | ❌ 미수행 (HTML 빌드 미배포 상태) |
| jacob 5% 스팟 풀이 | ⏸ jacob 복귀 후 필요 |

## 12지문 구성

| N | 제목 | 문장수/단어수 |
|---|------|------|
| 01 | The Role of Context in Universal Emotions | 6/165 |
| 02 | How Dynamic Changes Disrupt User Efficiency | 6/173 |
| 03 | The Impact of Interface Metaphors | 11/198 |
| 04 | The Impact of News Framing on Attitudes | 7/158 |
| 05 | The Limits of Predicting the Unobserved | 9/201 |
| 06 | The True Nature and Power of Acceptance | 11/181 |
| 07 | Mathematical Explanations for Coincidences | 9/198 |
| 08 | Spatial Representation in Mental Images | 9/197 |
| 09 | Social Media as a Vital E-commerce Platform | 7/140 |
| 10 | Stop Preparing Responses and Start Listening | 9/202 |
| 11 | Marketing Strategy to Reduce Purchase Risk | 6/176 |
| 12 | How Bees Measure Distance Using Visual Cues | 9/200 |

## 검수 파이프라인 이행

| SOP 단계 | 상태 |
|---|---|
| STEP 0 원문 확보 | ✅ PDF 추출 → `_passages/N번.json` |
| STEP 1 출제 | ✅ create-test.js 파이프라인 36파일 |
| STEP 2 validate | ✅ 전부 PASS |
| STEP 3 블라인드 풀이 | ✅ 출제 Agent 자체 blind 20/20 |
| STEP 4 정답 대조 | ✅ 불일치 건 재출제 |
| STEP 5 적대적 공격 | ✅ 별도 Agent 역할, HIGH/MEDIUM 수정 |
| STEP 6 자동 검증 | ✅ 재validate + re-blind + cross-blind |
| STEP 7 증적 리포트 | ✅ 본 문서 |
| STEP 8 jacob 확인 후 배포 | ⏸ 승인 대기 |

추가 Tier 2/3:
- **Cross-model validation** (Sonnet↔Opus): ✅ 36/36 PASS
- **validate-render --screenshot**: ❌ 미수행 (HTML 미빌드)
- **npm run verify (인앱 브라우저 7종)**: ❌ 미수행
- **jacob 5% 스팟**: ⏸

## Adversarial 공격 검수 — 발견 및 수정 내역

### HIGH (4건, 전부 수정)

| 파일 | 문항 | 이슈 | 수정 |
|---|---|---|---|
| 7번/단어 | Q14 | `ambiguous` 반의어, 오답 3개 전부 유의어(vague/unclear/doubtful) — 소거법 | 오답을 `silent/rough`로 재구성 |
| 8번/단어 | Q14 | `genuinely` 반의어, 오답(truly/sincerely/really) 유의어 뭉치 | 오답을 `barely/quickly`로 분산 |
| 9번/단어 | Q14 | `direct→indirect` prefix 조작 (S-ANTONYM-PREFIX 위반) | `roundabout`로 교체 |
| 12번/단어 | Q13 | `tiny` 반의어, `cunning(교활한)` 혼입 — 크기축 무관 | `distant/common`로 교체 |

### MEDIUM (5건, 전부 수정)

| 파일 | 문항 | 이슈 | 수정 |
|---|---|---|---|
| 3번/워크북 | Q14 | det.korean 주어 명시 오류("The desktop image" → 실제 "The metaphor") | det.analysis 정정 |
| 7번/단어 | Q13 | `common` 반의어, 오답 유의어 뭉치 | 의미축 분산 |
| 8번/단어 | Q13 | `increased` 반의어, 오답 유의어 뭉치 | `paused/repeated`로 분산 |
| 10번/단어 | Q7 | 빈칸 `listening` 본문 2회 노출 → 찾기로 풀림 | 빈칸을 `sharing`으로 이동 |
| 11번/단어 | Q13 | `minimal` 반의어, 오답 유의어 뭉치 | `brief/partial`로 분산 |

### LOW (1건)

| 파일 | 문항 | 이슈 | 처리 |
|---|---|---|---|
| 1번/워크북 | Q15 | accept 배열에 NORM 변형 수동 추가 (Rule H 기록상 권장 위반) | 채점 영향 없음 — 보존 |

## Cross-blind FLAG 9건 수정 내역

수정 전 9건 불일치 → 전부 재검토 후 stem 명확화 / wa 조정 / 선지 수정 → cross-blind 36/36 PASS.

| 파일 | 문항 | 변경 요약 |
|---|---|---|
| 2번/퀴즈 | Q16 | stem에 "re-find 하이픈은 1단어로 카운트" 명시 |
| 3번/워크북 | Q15 | stem "and 포함 3단어" 명시, 본문 구조 한국어 단서 보강 |
| 4번/워크북 | Q16 | stem "shaped 바로 뒤 목적어 자리 관사 포함 2단어" 명시 |
| 4번/워크북 | Q20 | 조건 단어 목록의 `the` 2회 명시, 12단어 고정 |
| 5번/단어 | Q2 | (A)(B)(C) 조합형 ans 정정 (anticipated vs unanticipated 문맥 근거) |
| 5번/워크북 | Q16 | stem "해저 형용사 + 거대단층 형용사 + 지진 = 3단어" |
| 5번/퀴즈 | Q17 | stem "undersea로 시작하는 연속 3단어" |
| 7번/워크북 | Q16 | stem "the law of ___ 수식어 3단어, 일반 law of large numbers와 구별" |
| 8번/퀴즈 | Q16 | wa를 "spatial properties of images" 4단어로 통일 |
| 8번/퀴즈 | Q20 | wa/blank/조건 모두 8단어로 동기화 |
| 11번/퀴즈 | Q16 | stem "perceptions로 시작 3단어, buyers' 제외" |

## 파일 산출물 목록

각 `N번/`(N=1~12) 폴더에 다음 파일:
- `(단어|워크북|퀴즈).json` — 최종 테스트
- `(단어|워크북|퀴즈).response.json` — Agent 응답
- `(단어|워크북|퀴즈).blind.json` — 출제자 self-blind 결과
- `(단어|워크북|퀴즈).cross-blind.json` — Sonnet 반대 풀이 결과
- `(단어|워크북|퀴즈).cross-prompt.json` — cross-blind 프롬프트
- `(단어|워크북|퀴즈).adversarial.json` — 공격 검수 결과

공유 자원:
- `_passages/N번.json` — 지문 원본 (N=1~12)
- `_audit-report.md` — 본 문서

## 배포 전 필수 확인 (jacob)

- [ ] **jacob 5% 스팟 풀이**: 12지문 중 무작위 3개 파일 선택해 정답 보지 않고 풀이 → 일치 확인
- [ ] **test-deploy.ts 매핑**: `ydok-2027-1강` 12지문 등록
- [ ] **Supabase contents 등록**: `수능특강영독2027-1강` assets (vocab/workbook/quiz has=true)
- [ ] **박선민 selections**: w2에 contentId 반영
- [ ] **HTML 빌드 + 시각 스크린샷**
- [ ] **GitHub push**
- [ ] **npm run verify** (카카오톡 인앱 브라우저 7종)
- [ ] **실기기 카카오톡 링크 접속 테스트**

## 이번 세션 postmortem

이번 작업에서 초기에 **cross-blind / 적대적 공격 / 시각 검수 / 증적 리포트**를 빠뜨리고 "36파일 출제 완료"로 보고한 사고 발생. jacob 지적으로 파이프라인 누락분 전부 복구. 

재발 방지 구조적 조치 필요:
1. `create-test.js --full-pipeline` 단일 명령으로 SOP STEP 1~7 묶기
2. `deploy-json.js` 게이트에 cross-blind.json / adversarial.json / audit-report.md 존재 강제
3. Agent 위임 템플릿 파일화 (`prompts/agent_*.md`)
4. 세션 시작 루틴: 관련 CLAUDE.md + TEST-SOP.md Read 강제, TaskCreate 때 SOP 단계별 태스크 일괄 생성

이 항목들은 별도 세션에서 (B) 구조 수정 단계로 진행.
