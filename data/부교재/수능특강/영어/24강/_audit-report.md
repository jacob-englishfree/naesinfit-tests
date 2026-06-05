# 24강 출제·검수 증적 리포트

**생성일**: 2026-06-05
**대상**: `data/부교재/수능특강/영어/24강`
**생성 방식**: `node scripts/generate-audit-report.js data/부교재/수능특강/영어/24강`

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 9 |
| validate PASS | 9/9 |
| blind.json 존재 | 9/9 |
| cross-blind.json 존재 | 9/9 |
| adversarial HIGH | 8건 |
| adversarial MEDIUM | 0건 |
| adversarial LOW | 0건 |

## 지문 구성

| 섹션 | 제목 | 문장/단어 |
|---|---|---|
| 1번 | Jessie's Thrilling Big Catch | 10/129 |
| 2번 | Evolution of Cultural Tourism to Daily Life | 7/196 |
| 3번 | The Crucial Role of Numbers in Football | 9/156 |

## 파일별 검수 상태

| 섹션 | 유형 | validate | blind | cross-blind | adversarial |
|---|---|---|---|---|---|
| 1번 | 단어 | ✅ | ✅ | ✅ | ⚠ (3) |
| 1번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 1번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 2번 | 퀴즈 | ✅ | ✅ | ✅ | ✅ (0) |
| Gateway | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| Gateway | 워크북 | ✅ | ✅ | ✅ | ⚠ (1) |
| Gateway | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |

## Adversarial HIGH 이슈 (수정 필요)

| 파일 | 문항 | 카테고리 | 설명 |
|---|---|---|---|
| 1번/단어 | Q10 | 뻔한 오답 (C7) | 동의어 'shoreline'의 선지에 'mountain'이 포함됨. 주제(낚시/해변)와 전혀 무관한 선지로 passage 없이 소거 가능. 학생이 낚시 지문임을 알기만 해도 'mountain'은 즉시 제거. |
| 1번/단어 | Q14 | 의미축 뭉치 오답 (S-ANTI-CHEESE-GATE) | 반의어 대상어 'fading'의 선지: disappearing / weakening / strengthening / reducing. 정답 'strengthening'을 제외한 disappearing·weakening·reducing 3개가 모두 '감소/소멸' 방향의 의미축에 집중되어 있어, passage 읽지 않고 소거법만으로 정답 도출 가능. |
| 1번/단어 | Q16 | passage 무관 + 뻔한 오답 (C7) | 영영풀이 'great enthusiasm and eagerness'의 오답 선지: sadness / calmness / confusion. 세 오답 모두 'enthusiasm/eagerness'와 대척점에 있는 추상·감정어로, 지문 없이 정의만 읽어도 정답 'excitement' 도달 가능. S-ANTI-CHEESE-GATE 해당. |
| 1번/퀴즈 | Q14 | 모호한 stem — 마커 불일치 | passage의 <u>it</u> 밑줄은 'Jessie pulled out the line and cast <u>it</u> back into the water' 문장의 it(=the line)을 가리키지만, stem은 'Jessie excitedly held onto the fishing pole as it began to move around wildly.'의 it(=the fishing pole)을 묻고 있음. 밑줄 위치와 stem이 묻는 it이 서로 다른 문장을 지시하여 학생이 항의할 근거가 명확함. |
| 2번/단어 | Q13 | 반의어 prefix 조작 (S-ANTONYM-PREFIX) | 'relevant'의 반의어로 정답 'unrelated'(un- + related) 사용. 'relevant'의 표준 접두사 반의어는 'irrelevant'이며, 'unrelated'는 un-+related로 파생된 별도 단어. 규칙 암기가 아닌 'un-' 접두사 제거 패턴으로 정답 유추 가능. S-ANTONYM-PREFIX 해당. |
| Gateway/단어 | Q18 | 어형 변환 오류 — 비생산적 파생 | 'The quarterback's __________ (live) depends on those numbers.'의 정답 'livelihood'. live→livelihood는 현대 영어에서 생산적 파생 규칙이 없는 어휘적 파생(어원: livelihood < Middle English). 학생은 living/life/lives 등 일반 어형 변환 규칙을 적용할 수밖에 없어 정답 예측 불가. 어형 변환 유형의 목적(파생 규칙 적용)에 맞지 않음. |
| Gateway/워크북 | Q3 | S-TYPE-CONTENT-MISMATCH — 어법 유형에 어휘/맥락 오류 출제 | type='어법'이지만 ④번 마커 'satisfactory'(원문: 'unsatisfactory')는 문법적으로 완전히 올바른 형용사. 오류의 본질은 '벤치에 앉히는 이유가 만족스럽다(satisfactory)는 것은 문맥상 맞지 않음'이라는 어휘/맥락 판단. 어법 문제라고 명시되어 있어 학생은 문법 관점으로만 분석하는데, 문법 오류가 없으므로 항의 근거가 명확함. S-TYPE-CONTENT-MISMATCH 해당. |
| Gateway/퀴즈 | Q3 | S-TYPE-CONTENT-MISMATCH — 어법 유형에 어휘/맥락 오류 출제 | 워크북 Q3와 동일한 문제. type='어법'이지만 ④번 마커 'satisfactory'(원문: 'unsatisfactory')는 문법 오류 없음. 오류 본질은 맥락상 어휘 선택의 문제. 어법 유형으로 출제되어 있어 학생이 문법 관점으로만 풀면 오류를 찾지 못하고 항의할 가능성 높음. S-TYPE-CONTENT-MISMATCH 해당. |

## 배포 가능 여부

⛔ **배포 불가** — 위 미비점 해결 필요

### jacob 본인 확인 필요
- [ ] 실기기 카카오톡에서 박선민/학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이 (1파일)
- [ ] 수업자료 PDF(합본) Dropbox 업로드 여부
