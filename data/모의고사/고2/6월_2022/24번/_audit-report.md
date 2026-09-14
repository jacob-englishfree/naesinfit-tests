# 24번 출제·검수 증적 리포트 — Buildings Do Talk

**생성일**: 2026-09-13
**대상**: `data/모의고사/고2/6월_2022/24번` (2022년 고2 6월 모의고사 24번, 제목: Buildings Do Talk)
**작성**: leaf 지문 폴더라 generate-audit-report.js가 하위 섹션 0건으로 집계 → 3종(단어/워크북/퀴즈) 실측 직접 작성.
**지문**: 8문장 / 150단어. fullPassage 무수정(_passages/24번.json 원문 그대로).

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 3 (단어·워크북·퀴즈) |
| validate PASS | 3/3 (S/A급 0) |
| blind 20/20 | 3/3 |
| cross-blind 20/20 | 3/3 |
| adversarial HIGH | 0건 |
| adversarial MEDIUM | 0건 |
| adversarial LOW | 3건 (단어1·워크북1·퀴즈1, 채점·변별 영향 없음) |
| N7 (워크북↔퀴즈 정답중복) | PASS (0건) |

## 파일별 검수 상태

| 유형 | 문항/총점 | 난이도(쉬움/보통/어려움) | ans 분포 | validate | blind | cross | adv HIGH |
|---|---|---|---|---|---|---|---|
| 단어 | 20 / 100 | 5 / 10 / 5 | {1:5, 2:4, 3:5, 4:4} | PASS | 20/20 | 20/20 | 0 |
| 워크북 | 20 / 100 | 5 / 10 / 5 | {1:4, 2:4, 3:4, 4:4} | PASS | 20/20 | 20/20 | 0 |
| 퀴즈 | 20 / 100 | 5 / 10 / 5 | {1:4, 2:4, 3:4, 4:3}(mc15) | PASS | 20/20 | 20/20 | 0 |

배점 규칙: 쉬움5×4 + 보통10×5 + 어려움5×6 = 100. ans 동일번호 ≤5, 3연속 없음(전 파일 준수).

## 유형 구성 (워크북/퀴즈 — 난이도 위계 워크북<퀴즈)

- **워크북**: 어법4 / 부적절어휘2 / 내용이해T·F 3 / 빈칸추론2 / 내용일치2 / 오류찾기1 / 서술형(찾기2·어형변환1·조건영작1) / 주제·요지2.
  - 어법 오류: silent→silently · welcome→welcomes · make→makes · speaks→speak · (오류찾기)surrounding→surrounded. 부적절: gradually↔instantly · refuses↔welcomes.
  - 서술형 정답: consciously(찾기) · All kinds of buildings(찾기) · designed(어형변환) · we may not register their messages(조건영작).
  - 빈칸: makes a statement · communicate with us.
- **퀴즈**: 어법3 / 부적절어휘2 / 빈칸추론3 / 내용일치3 / 주제1 / 제목1(영어선지) / 함축1 / 지칭1 / 서술형(조건영작3·어형변환1·어순배열1).
  - 어법 오류(복합포인트): expressing→expressed(수동분사) · communicates→communicate(강조구문 복수일치) · acting→to act(to부정사 병렬). 부적절: rejects↔welcomes · living↔inanimate.
  - 서술형 정답: a building is an inanimate object · welcomes(어형변환) · a store or restaurant can be designed · even the simplest house always makes a statement(어순배열8단어) · buildings tell us what to think.
  - 빈칸: get a message · speak to us silently · loud and obvious. 함축 underline: speak to us silently. 지칭 underline: these cases(간접지칭→트레일러/대저택).

## N7 크로스파일 (워크북 ↔ 퀴즈)

- `check-wb-quiz-leak.py` → **PASS (중복 0건)**. 워크북 정답셋(consciously·All kinds of buildings·designed·we may not register their messages·makes a statement·communicate with us)과 퀴즈 wa/blank(get a message·speak to us silently·loud and obvious·a building is an inanimate object·welcomes·a store or restaurant can be designed·even the simplest house always makes a statement·buildings tell us what to think) 정확일치 0.
- 단어 정답(rusting·expressed·abandoned·inarticulate·deliberate·silently·Stay Out of Here·what to think and how to act)도 워크북·퀴즈 wa/blank에서 정확일치 회피.

## adversarial LOW 상세 (HIGH/MED 0)

- 단어: (A)(B)(C) 조합형 정답 단어가 본문 타 위치 등장 — 조합형 본질, 채점 무영향.
- 워크북 Q10: 빈칸 'makes a statement' 오답이 본문 어휘 미활용 — 정답 수렴 명확, 변별 무영향.
- 퀴즈 Q16: 조건영작 역순 이론적 가능성 — 한국어 주격조사 '은'이 배열 수렴, NORM 정규화로 채점 안전.

## 배포 가능 여부

✅ 워크북·퀴즈 2종 신규 출제 완료. validate PASS + blind 20/20 + cross 20/20 + adversarial HIGH 0 + N7 PASS.
**배포·DB등록·catalog·shared는 총괄 담당** (본 세션은 파일 생성만 수행).

### jacob 본인 확인 권장
- [ ] 실기기 카카오톡에서 학생 링크로 24번 워크북·퀴즈 스팟 풀이
- [ ] 어법/서술형 정답 무작위 대조
