# 21강 출제·검수 증적 리포트

**생성일**: 2026-06-05
**대상**: `data/부교재/수능특강/영어/21강`
**생성 방식**: `node scripts/generate-audit-report.js data/부교재/수능특강/영어/21강`

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 12 |
| validate PASS | 12/12 |
| blind.json 존재 | 12/12 |
| cross-blind.json 존재 | 12/12 |
| adversarial HIGH | 3건 |
| adversarial MEDIUM | 4건 |
| adversarial LOW | 1건 |

## 지문 구성

| 섹션 | 제목 | 문장/단어 |
|---|---|---|
| 1번 | Spatial Information in Human-Environment Studies | 7/163 |
| 2번 | Descartes: Senses and Certainty | 7/180 |
| 3번 | Sharing as Insurance in the Ache Tribe | 8/167 |

## 파일별 검수 상태

| 섹션 | 유형 | validate | blind | cross-blind | adversarial |
|---|---|---|---|---|---|
| 1번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 1번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 1번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 2번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (2) |
| 3번 | 단어 | ✅ | ✅ | ✅ | ✅ (0) |
| 3번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 3번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |
| Gateway | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| Gateway | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| Gateway | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |

## Adversarial HIGH 이슈 (수정 필요)

| 파일 | 문항 | 카테고리 | 설명 |
|---|---|---|---|
| 2번/퀴즈 | Q1 | 정답노출 | 순서배열 문제. fullPassage 필드에 '(C) He realized... (A) It might... (B) But Descartes...' 형태로 (A)(B)(C) 단락 순서 마커가 원문에 삽입되어 있음. passage가 렌더링되면 정답(C-A-B)이 그대로 노출됨. S-META-LEAK 해당. fullPassage에서 (A)(B)(C) 마커 제거 또는 도입문+단락 분리 구조로 수정 필요. |
| 3번/퀴즈 | Q2 | 정답2개가능 | 문장삽입 문제 (ans=④). 삽입 문장: 'In other words, the success of hunting is highly variable and impossible to store.' — ④ 위치(본문 후반, 공유 행동 일반화 이후)를 정답으로 제시하지만, ③ 위치(deep-freeze 냉장고 언급 직후)도 논리적으로 동등하게 성립 가능. 냉장고 맥락이 '저장 불가'를 직접 뒷받침하기 때문에 ③ 삽입도 자연스러움. 학생 이의 제기 가능성 높음. 삽입 문장 앞뒤 문장 간 연결 논리를 검토하고 정답 위치를 명확히 차별화할 것. |
| Gateway/퀴즈 | Q1 | 정답2개가능 | 문장삽입 문제 (ans=④). 삽입 문장: 'In other words, the significance of spatial thinking extends far beyond simple questions of location.' — ④ 위치(일상적 예시들 이후, scale 이동 단락 이전)를 정답으로 제시하지만, ③ 위치(일상 활동 예시 열거 직후)에서도 동일하게 '즉, 공간적 사고의 중요성은 단순한 위치 문제를 넘어선다'는 요약이 자연스럽게 성립 가능. 두 위치의 차별성을 담보할 근거가 passage에서 명확히 드러나지 않음. 학생 이의 제기 가능성 있음. |

## 배포 가능 여부

⛔ **배포 불가** — 위 미비점 해결 필요

### jacob 본인 확인 필요
- [ ] 실기기 카카오톡에서 박선민/학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이 (1파일)
- [ ] 수업자료 PDF(합본) Dropbox 업로드 여부
