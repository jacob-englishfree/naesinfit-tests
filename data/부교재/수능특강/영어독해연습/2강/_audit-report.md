# Audit Report: 수능특강 영어독해연습 2강 1번 단어

## 대상
- 파일: `data/부교재/수능특강/영어독해연습/2강/1번/단어.json`
- 유형: 단어 테스트 (20문항, 100점)
- 배점: 쉬움 5x4=20 / 보통 10x5=50 / 어려움 5x6=30

## SOP 이행 결과

| 단계 | 결과 |
|------|------|
| STEP A: 출제 (assemble) | PASS (S/A급 0건) |
| STEP B: 블라인드 풀이 | 20/20 일치 |
| STEP C: Cross-blind | 20/20 일치 |
| STEP D: 적대적 공격 | HIGH 0건, LOW 1건 |

## validate 결과
- S급 위반: 0건
- A급 위반: 0건
- B급 경고: 9건 (모두 정보성 — ABC/마커형 passage 변형, histKey 패턴)

## ans 분포
- 1번: 4개 / 2번: 5개 / 3번: 4개 / 4번: 5개
- 3연속 동일번호: 없음

## 적대적 공격 발견 사항
- Q8 (LOW): judgments vs ratings 문법적 중복 가능성. 원문 기준 judgments가 유일 정답이며, make judgments가 더 자연스러운 연어. 유지 판정.

## 생성 artifact
- `단어.response.json` (AI 판단)
- `단어.json` (최종 테스트)
- `단어.blind.json` (블라인드 20/20)
- `단어.cross-blind.json` (교차 20/20)
- `단어.adversarial.json` (공격 HIGH 0)

## 날짜
2026-04-18
