══════════════════════════════════════════
  전성현 수능유형PICK 테스트 검증 리포트
  생성일: 2026-11-25
  학생: 전성현 (시험 12/10)
  원문: 수능유형 PICK 독해 기본 (능률) — 프린트 #11~#20 10지문
  소스: 내신해방공식_교안/lessons/jsh_pick/lesson.json (sections 10개 en 문장)
══════════════════════════════════════════

## 출제 현황

| 유형 | 전체 | 문항 | 총점 | 배점 분포 |
|------|------|------|------|-----------|
| 단어 | ✅ | 20 | 100 | 쉬움 5×4 + 보통 10×5 + 어려움 5×6 |
| 워크북 | ✅ | 20 | 100 | 쉬움 5×4 + 보통 10×5 + 어려움 5×6 |
| 퀴즈 | ✅ | 20 | 100 | 쉬움 5×4 + 보통 10×5 + 어려움 5×6 |

**총 3파일 × 20문항 = 60문항** / histKey: {wordtest,workbooktest,quiztest}_jsh_pick_전체_v6

## SOP 이행 결과

| 단계 | 결과 | 근거 |
|------|------|------|
| STEP 0 원문확보 | ✅ PASS | lesson.json en 문장 → fullPassage 바이트 단위 일치 (3파일 공통), 89문장/10문단 누락 0 |
| STEP 1 출제 | ✅ PASS | 3파일 60문항 (create-test.js prompt → response → assemble) |
| STEP 2 구조검증 | ✅ 3/3 PASS | validate.js S급·A급 0건 (B 경고만: EX-3 등 비차단) |
| STEP 3 블라인드 | ✅ 3/3 PASS | 자체 blind 60/60 일치 (단어 20/20, 워크북 20/20, 퀴즈 20/20) |
| Cross-blind (Tier2) | ✅ 3/3 PASS | Sonnet 반대모델 60/60 일치, FLAG 0 |
| STEP 5 적대적공격 | ✅ PASS | HIGH 1건(퀴즈 Q19 어순배열 복수정답) → 우리말 단서 추가+accept 변형 보강으로 해결. low 5건 중 조사 오류 2건·오류찾기 응집성 1건 수정, 나머지 2건 수용 가능 판정 |
| STEP 6 자동검증 | ✅ 3중 PASS | validate + validate-fulltext + validate-scoring 전부 PASS |

## 품질 체크

- 정답 분포: 단어 {1:5,2:5,3:4,4:4} / 워크북 {1:5,2:4,3:5,4:2} / 퀴즈 {1:4,2:4,3:4,4:3} — 동일번호 ≤5, 3연속 0건
- 3종 간 cross-leak: wa/blank/underline/오류마커 교집합 0건 (스크립트 전수 대조)
- 퀴즈 서술형: 조건영작 3 + 어형변환 1 + 어순배열 1 — S-QUIZ-WRITTEN-SAFE-TYPE 준수 (찾기형 0)
- 워크북 내용이해 T/F 3문항 (워크북 전용 유형, 퀴즈 미사용)
- passage: 커스텀 합본(10지문) 선례(박지민 수능1up)와 동일하게 문항별 해당 문단만 표시

## 수정 이력

1. 퀴즈 Q2 X42(ans↔det 표기 불일치) → det.korean "to do so → doing so" 형식 수정
2. 퀴즈 Q11/Q13 영어 선지 50자 초과 → 50자 미만으로 압축
3. 퀴즈 Q19 A-EOSUN-NO-WORDS → [보기] 쉼표 나열 형식으로 수정
4. 워크북 Q14 오류찾기 → 선례(박지민) ①<u>word</u> 형식 적용 + '100 million' 문장 복원(지시어 응집성)
5. 단어 Q12/Q14 stem 조사(와→과) 수정
6. 퀴즈 Q19 [adversarial HIGH] 우리말 단서 추가 + accept 어순 변형("never master either language fully") 추가

## 파일 경로

data/부교재/전성현/수능유형PICK/전체/{단어,워크북,퀴즈}.json (+ .response/.blind/.cross-blind/.adversarial)
data/부교재/전성현/수능유형PICK/_passages/전체.json
