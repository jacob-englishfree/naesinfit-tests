# 교과서 전수 블라인드 풀이 — 복붙 명령어 12개

새 세션 열고 해당 세션 텍스트를 그대로 복사 → 붙여넣기하면 됩니다.

---

## 세션 1/12

```
교과서 블라인드 풀이 세션 1/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '1,32p'
범위: 공통영어1/YBM김은형 1과RM~4과본문 + 공통영어1/YBM박준언 1~3과FR워크북

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조. 먼저 보면 블라인드 아님
- 자동 스크립트/API 절대 금지. 직접 읽고 풀어야 함
- 풀이불가 문항도 이유와 함께 기록
- "전부 맞았습니다" 한 줄 보고 금지. Q1~Q20 전부 결과 보고

⛔ 에이전트 프롬프트에 반드시 포함:
"각 JSON 파일을 읽고 fullPassage(원문)를 먼저 파악한다. 그 다음 각 문항의 passage, stem, ch만 보고 직접 풀이한다. ans와 wa 필드는 풀이 후에만 본다. 20문항 모두 풀고 Q1~Q20 전부 결과를 보고한다. 생략 금지. 불일치 발견 시 파일명, Q번호, 내 답, 실제 ans, 이유를 보고한다."

완료 후: blind-solve-progress.json의 completed에 파일 추가. 불일치 있으면 즉시 수정.
```

---

## 세션 2/12

```
교과서 블라인드 풀이 세션 2/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '33,64p'
범위: 공통영어1/YBM박준언 3과FR퀴즈~4과 + 능률민병천 전부 + 능률오선영 1과~3과본문단어

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조. 먼저 보면 블라인드 아님
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

⛔ 능률민병천 주의: 이 출판사에서 이미 18건 셔플 오류 발견됨. 선지(ch) 안에 ①②③④ 라벨이 배열 위치와 다를 수 있음. 반드시 내용 기준으로 풀이.

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 3/12

```
교과서 블라인드 풀이 세션 3/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '65,96p'
범위: 공통영어1/능률오선영 3과본문워크북~4과 + 동아이병민 전부 + 미래엔김성연 1~2과본문퀴즈

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 4/12

```
교과서 블라인드 풀이 세션 4/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '97,128p'
범위: 공통영어1/미래엔김성연 3과DL~4과 + 비상홍 1~4과RC워크북

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 5/12

```
교과서 블라인드 풀이 세션 5/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '129,160p'
범위: 공통영어1/비상홍 4과RC퀴즈~4과본문 + 지학사신상근 전부 + 천재강상구 1과본문단어

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 6/12

```
교과서 블라인드 풀이 세션 6/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '161,192p'
범위: 공통영어1/천재강상구 1과본문워크북~4과 + 천재조수경 1~2과본문퀴즈

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 7/12

```
교과서 블라인드 풀이 세션 7/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '193,224p'
범위: 공통영어1/천재조수경 3과RM~4과 + 영어1/YBM박준언 1~4과FR워크북

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 8/12

```
교과서 블라인드 풀이 세션 8/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '225,256p'
범위: 영어1/YBM박준언 4과FR퀴즈 + 능률오선영 E1 전부 + 동아박용예 E1 전부 + 미래엔김성연 E1 1과추가지문단어

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 9/12

```
교과서 블라인드 풀이 세션 9/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '257,288p'
범위: 영어1/미래엔김성연 1과추가지문워크북~4과 + 비상홍 E1 1~2과본문퀴즈

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 10/12

```
교과서 블라인드 풀이 세션 10/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '289,320p'
범위: 영어1/비상홍 3과~ + 지학사신상근 E1 1~4과IC워크북

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 11/12

```
교과서 블라인드 풀이 세션 11/12.
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '321,352p'
범위: 영어1/지학사신상근 4과IC퀴즈 + 천재강상구 E1 전부 + 천재조수경 E1 1과본문단어

⛔ 천재강상구 E1 주의: 3~4과 워크북/퀴즈에서 이미 11건 ans=1 하드코딩 수정됨. 1~2과는 정상이었지만 재검증 필요.
⛔ 지학사 E1 4과 IC: 서술형 ans=-1 → 0 수정됨. 재검증.

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후: blind-solve-progress.json 업데이트. 불일치 즉시 수정.
```

---

## 세션 12/12 (마지막)

```
교과서 블라인드 풀이 세션 12/12 (마지막).
naesinfit-tests/validate/blind-solve-progress.json 읽어.

대상 32파일: find data/교과서 -name "*.json" | sort | sed -n '353,384p'
범위: 영어1/천재조수경 1과본문워크북~4과 + 영어2/YBM한상호 전부 + 중2/YBM김은형 전부

⛔ 천재조수경 E1 주의: 2과 본문에서 이미 4건 수정됨. 나머지 과도 같은 패턴 가능.
⛔ YBM한상호 E2 주의: 1과 퀴즈 Q9/Q10 수정됨. 2과도 확인 필요.

⛔ 절대 규칙:
- 에이전트 6개 병렬로 5~6파일씩 나눠서 진행
- 각 파일 20문항 전부 passage+stem+ch를 읽고 직접 풀이. 한 문항도 빠짐없이
- ans/wa는 풀이 후에만 대조
- 자동 스크립트/API 절대 금지
- Q1~Q20 전부 결과 보고. 생략 금지

완료 후:
1. blind-solve-progress.json 최종 업데이트 (전체 completed)
2. 12세션 전체 오류 총합 보고
3. 교과서 384파일 7,680문항 전수 블라인드 풀이 완료 선언
```
