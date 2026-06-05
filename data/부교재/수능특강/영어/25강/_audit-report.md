# 25강 출제·검수 증적 리포트

**생성일**: 2026-06-05
**대상**: `data/부교재/수능특강/영어/25강`
**생성 방식**: `node scripts/generate-audit-report.js data/부교재/수능특강/영어/25강`

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 12 |
| validate PASS | 12/12 |
| blind.json 존재 | 12/12 |
| cross-blind.json 존재 | 12/12 |
| adversarial HIGH | 1건 |
| adversarial MEDIUM | 4건 |
| adversarial LOW | 3건 |

## 지문 구성

| 섹션 | 제목 | 문장/단어 |
|---|---|---|
| 1번 | The Role of Order in Effective Teaching | 6/178 |
| 2번 | How Negative Words Affect Kids' Brains | 6/175 |
| 3번 | From Conscious Learning to Automatization | 7/200 |
| Gateway | Note-Taking for Active Class Discussions | 10/175 |

## 파일별 검수 상태

| 섹션 | 유형 | validate | blind | cross-blind | adversarial |
|---|---|---|---|---|---|
| 1번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 1번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 1번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 2번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |
| 3번 | 단어 | ✅ | ✅ | ✅ | ✅ (0) |
| 3번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 3번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |
| Gateway | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| Gateway | 워크북 | ✅ | ✅ | ✅ | ⚠ (2) |
| Gateway | 퀴즈 | ✅ | ✅ | ✅ | ✅ (0) |

## Adversarial HIGH 이슈 (수정 필요)

| 파일 | 문항 | 카테고리 | 설명 |
|---|---|---|---|
| 1번/단어 | Q13 | 정답노출 | Q13 반의어 고르기: 타겟 단어 'external'의 정답이 'internal'인데, fullPassage에 'external and internal control'이 나란히 등장해 밑줄 단어 바로 옆에서 정답이 직접 노출됨. C6 위반 — passage 읽지 않고 베끼기만으로 풀 수 있음. |

## 배포 가능 여부

⛔ **배포 불가** — 위 미비점 해결 필요

### jacob 본인 확인 필요
- [ ] 실기기 카카오톡에서 박선민/학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이 (1파일)
- [ ] 수업자료 PDF(합본) Dropbox 업로드 여부
