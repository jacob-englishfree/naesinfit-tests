# 16강 출제·검수 증적 리포트

**생성일**: 2026-06-05
**대상**: `data/부교재/수능특강/영어/16강`
**생성 방식**: `node scripts/generate-audit-report.js data/부교재/수능특강/영어/16강`

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 15 |
| validate PASS | 15/15 |
| blind.json 존재 | 15/15 |
| cross-blind.json 존재 | 15/15 |
| adversarial HIGH | 10건 |
| adversarial MEDIUM | 3건 |
| adversarial LOW | 9건 |

## 지문 구성

| 섹션 | 제목 | 문장/단어 |
|---|---|---|
| 1번 | 온라인 글쓰기와 결론 제시 순서 | 7/177 |
| 2번 | 뇌의 유연한 인식 경로 | 12/185 |
| 3번 | Bir Tawil과 국경 분쟁 | 8/187 |
| 4번 | 준거집단과 자기 평가 | 8/168 |

## 파일별 검수 상태

| 섹션 | 유형 | validate | blind | cross-blind | adversarial |
|---|---|---|---|---|---|
| 1번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 1번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 1번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (3) |
| 2번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 워크북 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |
| 3번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 3번 | 워크북 | ✅ | ✅ | ✅ | ⚠ (2) |
| 3번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (2) |
| 4번 | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| 4번 | 워크북 | ✅ | ✅ | ✅ | ⚠ (2) |
| 4번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (2) |
| Gateway | 단어 | ✅ | ✅ | ✅ | ⚠ (1) |
| Gateway | 워크북 | ✅ | ✅ | ✅ | ⚠ (2) |
| Gateway | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (2) |

## Adversarial HIGH 이슈 (수정 필요)

| 파일 | 문항 | 카테고리 | 설명 |
|---|---|---|---|
| 1번/퀴즈 | Qundefined | undefined | 순서배열 Q1: passage 필드가 null. 렌더러 크래시 위험. 부교재 문항은 fullPassage 기반으로 passage가 문자열이어야 함. |
| 1번/퀴즈 | Qundefined | undefined | 순서배열 Q1: det.analysis가 '✅ ③ (B)-(A)-(C)'를 정답으로 표시하지만, ch 배열은 ["(A)-(B)-(C)","(A)-(C)-(B)","(C)-(B)-(A)","(B)-(A)-(C)"]. ch[2]="(C)-(B)-(A)"이고 ch[3]="(B)-(A)-(C)". ans=4 이므로 정답은 ch[3]="(B)-(A)-(C)"인데 det에서는 ③이라고 잘못 표시. det의 번호 레이블과 ans가 불일치. |
| 1번/퀴즈 | Qundefined | undefined | 서술형조건영작 Q20: wa="you can more likely convince more readers" (7단어). [조건]에는 'you, can, more, likely, convince, readers'(6개 토큰 나열). 'more'가 wa에 2번 등장(more likely, more readers)하지만 [조건]에는 1번만 명시. 학생이 조건만 보고는 'more'를 2번 써야 함을 알 수 없음. |
| 3번/워크북 | Qundefined | undefined | 어법 Q1~Q5의 overlay.markers에서 오답 마커가 {"find": "원문", "replace": "오답"} 형식을 사용. 올바른 스키마는 {"find": "원문", "display": "오답"}. 렌더러는 'display' 키를 읽어 화면에 오답 단어를 보여주는데, 'replace' 키가 있으면 렌더러가 오답 단어를 표시하지 못하고 원문이 그대로 노출될 수 있음. 이 경우 어법 오류 마커가 보이지 않아 문항 자체가 성립하지 않음. |
| 3번/퀴즈 | Qundefined | undefined | 어법 Q2~Q6의 overlay.markers 오답 객체가 {"find": "원문", "replace": "오답"} 형식. 올바른 스키마는 {"find": "원문", "display": "오답"}. 3번/워크북.json과 동일한 시스템 오류. 렌더러가 어법 오류 단어를 화면에 표시하지 못하면 문항 자체가 성립 불가. |
| 4번/워크북 | Qundefined | undefined | 어법 Q1~Q5의 overlay.markers 오답 객체가 {"find": "원문", "replace": "오답"} 형식. 올바른 스키마는 {"find": "원문", "display": "오답"}. 3번 파일들과 동일한 시스템 오류. 렌더러가 어법 오류 단어를 표시하지 못하면 문항 자체가 성립 불가. |
| 4번/퀴즈 | Qundefined | undefined | 어법 Q4: det.analysis가 '✅ ① to feel — 원문은 feel... ←정답'이라고 표시하지만, passage의 실제 마커는 ② 위치에 'to feel'이 있고 ans=2. det에서 ①이 정답이라고 했지만 실제 정답은 ②. det 레이블과 ans가 불일치(X42). |
| 4번/퀴즈 | Qundefined | undefined | 어법 Q1~Q5의 overlay.markers 오답 객체가 {"find": "원문", "replace": "오답"} 형식. 올바른 스키마는 {"find": "원문", "display": "오답"}. 3번/4번 워크북과 동일 시스템 오류. |
| Gateway/워크북 | Qundefined | undefined | 어법 Q1~Q5의 overlay.markers 오답 객체가 {"find": "원문", "replace": "오답"} 형식. 올바른 스키마는 {"find": "원문", "display": "오답"}. 3번/4번 파일들과 동일한 시스템 오류. 렌더러가 어법 오류 단어를 표시하지 못하면 어법 문항 5개가 모두 정상 동작 불가.
- Q1 ②: {find: 'repeats', replace: 'repeating'}
- Q2 ①: {find: 'appears', replace: 'appearing'}
- Q3 ③: {find: 'yield', replace: 'yielding'}
- Q4 ④: {find: 'being', replace: 'be'}
- Q5 ④: {find: 'does', replace: 'is'} |
| Gateway/퀴즈 | Qundefined | undefined | 어법 Q1~Q5의 overlay.markers 오답 객체가 {"find": "원문", "replace": "오답"} 형식. 올바른 스키마는 {"find": "원문", "display": "오답"}. Gateway 워크북, 3번, 4번 파일들과 동일한 시스템 오류.
- Q1 ②: {find: 'repeats', replace: 'repeating'}
- Q2 ③: {find: 'readily', replace: 'ready'}
- Q3 ③: {find: 'yield', replace: 'yielding'}
- Q4 ④: {find: 'does', replace: 'is'}
- Q5 ②: {find: 'marked', replace: 'marking'} |

## 배포 가능 여부

⛔ **배포 불가** — 위 미비점 해결 필요

### jacob 본인 확인 필요
- [ ] 실기기 카카오톡에서 박선민/학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이 (1파일)
- [ ] 수업자료 PDF(합본) Dropbox 업로드 여부
