# 37번 출제·검수 증적 리포트

**대상**: `data/모의고사/고1/6월_2024/37번` — 2024년 6월 고1 모의고사 37번
**지문**: Exotic Species: Grey vs Red Squirrels (순서형, 원문 인쇄순 도입+(A)+(B)+(C), 정답배열 (B)-(A)-(C))
**생성일**: 2026-09-13 (Opus 출제자 직접 작성 — generate-audit-report.js가 모의고사 폴더 구조를 집계하지 못해 수기 작성)

## 최종 요약

| 항목 | 단어 | 워크북 | 퀴즈(예상문제) |
|---|---|---|---|
| 문항 수 | 20 | 20 | 20 |
| 총점 | 100 | 100 | 100 |
| validate | ✅ PASS ([S] 0) | ✅ PASS ([S] 0) | ✅ PASS ([S] 0) |
| blind 20문항 | ✅ 20/20 완결, 불일치 0 | ✅ 20/20 완결, 불일치 0 | ✅ 20/20 완결, 불일치 0 |
| cross-blind | ✅ 20/20 일치 | ✅ 20/20 일치 | ✅ 20/20 일치 |
| adversarial HIGH | 0 (low 5) | 0 (low 3) | 0 (low 5) |
| ans 분포 | 4/5/5/4 | 4/4/4/4 | 4/4/3/4 |

**N7 크로스파일(워크북↔예상문제 정답 중복)**: ✅ PASS — 중복 0건

## 배점 분포 (각 테스트 공통 스키마)
- 쉬움 5문항 × 4점 = 20
- 보통 10문항 × 5점 = 50
- 어려움 5문항 × 6점 = 30
- 합계 100점 ✅

## 유형 구성
- **단어**: (A)(B)(C) 조합형 ×3 / 문맥상 부적절한 어휘 ×3 / 빈칸 어휘 완성 ×3 / 동의어 ×3 / 반의어 ×2 / 다의어(edge) ×1 / 영영풀이(habitat) ×1 / 어형변환 ×2(extinct→extinction, easy→easily) / 빈칸 문맥 완성 ×2
- **워크북**: 어법 ×4(수동태 is introduced / 완료수동 has been destroyed / 계속용법 which / 수일치 have survived) / 어휘 ×2(native, destroy) / T·F ×3 / 빈칸추론 ×2(habitat, extinction) / 내용일치 ×2 / 오류찾기 ×1(be able to+원형) / 서술형 찾기 ×2(its diet, close to extinction) / 어형변환 ×1(dense→densely) / 주제·요지 ×2 / 조건영작 ×1(both squirrel species competed for the same food and habitat)
- **예상문제(퀴즈)**: 어법 ×3(its/it's, 부사 easily, 정동사 have survived) / 부적절 어휘 ×2(adapt, survived) / 빈칸추론 ×3(under pressure, have a bite, a clear example — 모두 2단어+ 구절) / 내용일치 ×3 / 주제·제목(영어선지)·함축(had the edge)·지칭(it) / 서술형 = 조건영작 ×3 + 어형변환 ×1(introduce→introduced) + 어순배열 ×1 (룰24 준수: 찾기·핵심단어형 없음)

## N7 분리 근거 (워크북 vs 예상문제)
- 어법 포인트 전면 상이: 워크북(수동태·완료수동·which·수일치·be able to) ↔ 예상(its/it's·부사·정동사 vs 준동사)
- 서술형 정답 상이: 워크북 {its diet, close to extinction, densely, "both squirrel species competed for the same food and habitat"} ↔ 예상 {grey squirrels can destroy the food supply, introduced, the red can only digest mature acorns, the red squirrel has come close to extinction in England, greys can also live more densely and in varied habitats}
- 빈칸 정답 상이: 워크북 {habitat, extinction} ↔ 예상 {under pressure, have a bite, a clear example}
- check-wb-quiz-leak.py 실측 중복 0건

## 남은 경고([B]·비차단)
- EX-3 (단어 Q1~3): (A)(B)(C) 박스 `[w1/w2]` 형식상 정답 단어가 지문에 노출 — 렌더 형식 고유(regex가 대괄호 미파싱), 전 ABC 문항 공통·채점 무관
- Q6-WEAK-DISTRACTOR (빈칸 오답이 본문 단어 아님): 의미축이 명확히 구분되어 정답 유일성 유지
- EX-1 (워크북 Q10): 빈칸 habitat의 복수형 habitats가 뒤 문단 등장 — 인접 노출 아님
- P2 (Q1 등): 순서형 원문 특성상 passage 앞부분 대조 경고 — 비차단

## adversarial LOW 처리 내역 (HIGH 0)
- 조건영작/어순배열 복수 어순 가능 항목(워크북 Q20, 예상 Q18·19·20)은 accept[]에 유효 대체 배열을 모두 등록하여 자동채점 억울 감점 차단
- 나머지 low는 형식 고유(EX-3)·오답 품질 참고·지칭 거리(쉬움 슬롯 의도)로 채점 영향 없음

## 배포 가능 여부
✅ 증적 4종(blind·cross-blind·adversarial·audit) 완비, [S] 0 / HIGH 0 / N7 PASS — 배포 게이트 충족.
배포·DB등록·catalog·shared는 총괄 담당(본 세션 범위 밖).
