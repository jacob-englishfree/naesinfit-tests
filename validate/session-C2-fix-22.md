# Session C2 Fix — 고1 3월_2024 22번 수정 리포트

작업일: 2026-04-06
대상: `data/모의고사/고1/3월_2024/22번/{단어,워크북,퀴즈}.json`
결과: 3파일 전부 `[PASS]` (S/A/C급 오류 0건, B급 경고만 잔존)

## 1) 워크북.json

| 항목 | Before | After |
|---|---|---|
| Q10 | type=내용이해, stem="요지", ans=1, ch[0]="역사적..." | type=주제, stem="주제로 가장 적절한 것은?", ans=1, ch[0]="누구나 리더가 될 수 있다." |
| Q11 | stem="...방법으로 가장 적절한 것은?" | stem="윗글의 내용에 따르면, 이 리더들이 아이디어를 개선한 방법은?" + det analysis 마커 정렬 수정(③→④) |
| Q13 | ans=1 (내용불일치인데 일치 문장 지칭) | ans=4, ch 재배치 (불일치 문장을 ch[3]로 이동), det analysis 재정렬 |

수정 이유:
- Q10: 요지/주제 문항인데 ans가 오답 선지를 가리킴 → 정답 선지를 ch[0]으로 이동 + type을 whitelist 허용값("주제")로 교정
- Q11: type="내용이해"인데 stem에 "내용" 키워드 없어 TSM-1 실패 → stem 보강 + det analysis ③/④ 불일치 수정
- Q13: 내용불일치 문항의 ans가 일치 문장을 지칭하던 버그 → ch 재배치 + ans=4
- A6 대응: ans=3 중복 7개였던 것을 Q10(→1), Q13(→4)로 분산 → 최대 5개 이하

## 2) 단어.json

| 항목 | Before | After |
|---|---|---|
| Q4 | 밑줄이 When/consider/like/Through (기능어) — 부적절 어휘 치환 없음 | 밑줄 content words: influence/noble/**lacked**/diligence, ③lacked→possessed 반의어 |
| Q5 | 밑줄 기능어 + ans↔det 불일치 | passage "If you consider..."로 시작, ①noble ②possessed ③improved ④**rarely**, ans=4, ④rarely→constantly |
| Q6 | 밑줄 기능어 + 치환 없음 | passage "But like all of us..."로 시작, ①**worsened** ②constantly ③accomplish ④potential, ans=1 |
| Q13 | ch[3]="오답 4" 플레이스홀더 | ch[3]="dignified" (noble 유사어) |
| Q16 | ch[2]="오답 4" 플레이스홀더 + det analysis 마커 순서 오류 | ch[2]="influence", det analysis 재정렬 |
| Q19 | type="내용이해" stem="주제" 불일치 | type="주제" (whitelist) |
| Q20 | type="내용이해" stem="요약" + 메타-distractor ch | type="내용이해", stem="윗글의 내용과 일치하는 것은?", 구체 선지 4개로 교체 |

Q4/Q5/Q6 passage 시작 문장을 각각 다르게 잘라 V83(stem+ch+passage 60자 중복) 해소.

## 3) 퀴즈.json

| 항목 | Before | After |
|---|---|---|
| Q4 | passage 기능어 밑줄 + det analysis 순서 [1423] 불일치 (CAO-1) | content words 밑줄 (historical/ignoble/possessed/improved), ②ignoble→noble, det analysis 정규화 |
| Q6 | type="내용이해" stem="요지" | type="주제/요지" (퀴즈 whitelist) |
| Q7 | type="내용이해" stem="방법으로" 키워드 누락 | stem="윗글의 내용에 따르면..." |
| Q13 | type="함축의미 추론" stem="요지" 불일치 + type="요지"(whitelist 미포함) | type="주제/요지", stem 유지 |
| Q14 | ch=["선택1","선택2","선택3","선택4"] 플레이스홀더 | ch=[leaders / these people (students, workers, and citizens) / Abraham Lincoln and Martin Luther King, Jr. / others], ans=2 |
| Q15 | ch=["선택2","선택3","선택1","선택4"] 플레이스홀더 | ch=[leaders at school / others / these people (students, workers, and citizens) / Abraham Lincoln and Martin Luther King, Jr.], ans=3 |
| Q20 | wa="answer", stem 빈 영작 지시 | stem="우리 모두는 리더가 될 잠재력을 가지고 있다"+단어 배열 조건, wa="We all have the potential to be leaders", passage="" (V61 대응) |

## 4) Validate 결과

```
[PASS] data/모의고사/고1/3월_2024/22번/단어.json (5 warnings, 0 S/A/C)
[PASS] data/모의고사/고1/3월_2024/22번/워크북.json (13 warnings, 0 S/A/C)
[PASS] data/모의고사/고1/3월_2024/22번/퀴즈.json (8 warnings, 0 S/A/C)
```

잔존 B급 경고(비차단):
- EX-3: (A)(B)(C) 조합형 정답 단어 지문 노출 (단어 Q1/Q2/Q3)
- P25: 어형 변환 변환 대상 표시 (단어 Q17/Q18)
- D46: det.korean/analysis 10자 미만 (짧은 해설)
- EX-1: 워크북 Q5 빈칸 정답 노출
- P2: passage 앞부분이 fullPassage에 없음 (passage가 부분 발췌라 정상)
- T39: 어순배열 FIRST group 정렬

## 5) 원칙 준수
- 원문 passage 의미 변경 없음 (단어 치환만)
- validate 체크 끄기 없음
- push 없음 (로컬 수정만)
