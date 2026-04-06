# 세션 C-2 Part 1 리포트

**작업 경로**: data/모의고사/고1/3월_2024/
**담당 파일**: 18번/단어, 19번/단어, 19번/워크북, 19번/퀴즈 (4파일 80문항)
**작업일**: 2026-04-06

---

## 파일: 18번/단어.json (Letter to Ms. Jane Watson)

| 문항 | 내답 | 정답(ans) | 일치 | 근거 |
|---|---|---|---|---|
| 1 | 4 | 4 | ✅ | 감명받음+환경책+토론: impressed—environment—discussion |
| 2 | 2 | 2 | ✅ | visit+lecture+suit (학교방문+강의+일정맞춤) |
| 3 | 3 | 3 | ✅ | fantastic+grateful+latest (훌륭한+감사+최신) |
| 4 | 1 | 1 | ✅ | ③avoid→visit 부적절, ch[0]="③" |
| 5 | 3 | 3 | ✅ | ③earliest→latest 부적절, ch[2]="③" |
| 6 | 2 | 2 | ✅ | ②clash→suit 부적절, ch[1]="②" |
| 7 | 3 | 3 | ✅ | give a special lecture |
| 8 | 4 | 4 | ✅ | fantastic experience (ch[3]=fantastic) |
| 9 | 4 | 4 | ✅ | suit your schedule (ch[3]=suit) |
| 10 | 2 | 2 | ✅ | impressed=moved (감동) |
| 11 | 3 | 3 | ✅ | grateful=thankful |
| 12 | 4 | 4 | ✅ | latest=most recent |
| 13 | 1 | 1 | ✅ | visit↔avoid (반의어) |
| 14 | 2 | 2 | ✅ | environment↔interior |
| 15 | 3 | 3 | ✅ | suit: 맞추다(동사)—정장(명사) |
| 16 | 2 | 2 | ✅ | "feeling thanks"=grateful |
| 17 | impressed | impressed | ✅ | be+impressed by(수동태) |
| 18 | discussion | discussion | ✅ | a class+discussion(명사) |
| 19 | 3 | 3 | ✅ | a fantastic experience for the students |
| 20 | 1 | 1 | ✅ | visit our school and give a special lecture (글의 목적) |

**불일치 문항**: 없음 (20/20)
**적대적 공격 발견**: 없음

---

## 파일: 19번/단어.json (Marilyn & Sarah 심경변화)

| 문항 | 내답 | 정답(ans) | 일치 | 근거 |
|---|---|---|---|---|
| 1 | 1 | 1 | ✅ | enormous+destroyed+streamed |
| 2 | 2 | 2 | ✅ | broken+joy+gift (ch[1]) |
| 3 | 3 | 3 | ✅ | enthusiasm+loved+closer |
| 4 | - | 3 | ⚠️ | **적대적**: passage에 변조 없음, 오류단어 없음. 문항 자체 폐기 |
| 5 | - | 4 | ⚠️ | **적대적**: passage에 변조 없음, 오류단어 없음. 문항 자체 폐기 |
| 6 | - | 2 | ⚠️ | **적대적**: passage에 변조 없음, 오류단어 없음. 문항 자체 폐기 |
| 7 | 3 | 3 | ✅ | enthusiasm (ch[2]) |
| 8 | 4 | 4 | ✅ | loved (ch[3]) |
| 9 | 1 | 1 | ✅ | closer (ch[0]) |
| 10 | 2 | 2 | ✅ | enormous=huge |
| 11 | 3 | 3 | ✅ | destroyed=ruined |
| 12 | 4 | 4 | ✅ | responded=reacted |
| 13 | 1 | 1 | ✅ | enormous↔tiny. **적대적**: ch[3]="오답 4" placeholder 노출 |
| 14 | 2 | 2 | ✅ | destroyed↔preserved |
| 15 | 3 | 3 | ✅ | trip: 여행(명)—걸려넘어짐(동) |
| 16 | 4 | 4 | ✅ | "strong feeling of excitement"=enthusiasm |
| 17 | destroyed | destroyed | ✅ | enormous wave destroyed castle |
| 18 | loss | loss | ✅ | lose→loss (명사) |
| 19 | 1 | 1 | ✅ | 상실을 긍정적으로 재해석하는 부모의 지혜 |
| 20 | - | 2 | ⚠️ | **적대적**: 선지가 메타적("핵심을 정확히 요약한 것"), 실제 요약 내용 없음. 문항 폐기 |

**불일치 문항**: 없음 (ans 기준)
**적대적 공격 발견**:
- Q4, Q5, Q6: 문맥상 부적절한 어휘 3문항 모두 passage에 실제 변조(오류 단어)가 없음. 원문과 동일. → 정답 도출 불가, 재출제 필요
- Q13: ch[3]="오답 4" placeholder 문자열 노출 (디자인 에러)
- Q20: 선지가 문항 유형을 서술("핵심 요약한 것")하는 메타 선지, 실제 요약문 없음 → 재출제 필요

---

## 파일: 19번/워크북.json (Marilyn & Sarah 심경변화)

| 문항 | 내답 | 정답(ans) | 일치 | 근거 |
|---|---|---|---|---|
| 1 | 2 | 1 | ❌ | passage ②destroying이 오류(주절동사 필요). ch=[①,②,③,④] → "②"=index 2 |
| 2 | 3 | 2 | ❌ | passage ③other 오류(castle 단수→another). ch=[②,①,③,④] → "③"=index 3 |
| 3 | 3 | 1 | ❌ | passage ③said 오류(분사구문 saying). ch=[①,②,③,④] → "③"=index 3 |
| 4 | 3 | 1 | ❌ | passage ③for 오류(give it as a gift). ch=[①,②,③,④] → "③"=index 3 |
| 5 | 4 | 4 | ✅ | loss (파괴→상실) |
| 6 | 3 | 3 | ✅ | ③despised→loved 부적절 |
| 7 | 2 | 2 | ✅ | 첫 모래성=T, ch=[F,T] → index 2 |
| 8 | 1 | 1 | ✅ | 포기 아님=F, ch=[F,T] → index 1 |
| 9 | 2 | 2 | ✅ | closer≠더 멀리=F, ch=[T,F] → index 2 |
| 10 | 3 | 3 | ✅ | 상실도 아름다운 나눔 |
| 11 | 4 | 4 | ✅ | heartbroken→enthusiastic (ch[3]) |
| 12 | 3 | 3 | ✅ | 거대한 파도가 파괴 (ch[2]) |
| 13 | 2 | 4 | ❌ | "더 먼 곳"(closer 변조) ch[1]. det도 ③로 기재하지만 ans=4는 "Marilyn은 선물"(일치). **불일치** |
| 14 | 3 | 2 | ❌ | passage ③"tears streaming down" 동사없음. ch=[②,①,③,④] → "③"=index 3 |
| 15 | gift | gift | ✅ | a gift to the ocean |
| 16 | streamed | streamed | ✅ | tears streamed down |
| 17 | She ran to Marilyn, saying... | accept 일치 | ✅ | 12단어 배열 |
| 18 | 3 | 3 | ✅ | 상실을 긍정적으로 재해석 (ch[2]) |
| 19 | 4 | 4 | ✅ | Marilyn 재해석으로 Sarah 재도전 |
| 20 | enthusiasm | enthusiasm | ✅ | 열정=enthusiasm |

**불일치 문항**: Q1, Q2, Q3, Q4, Q13, Q14 (6건)
- Q1~Q4: **어법 문제 ch 배열 순서와 ans 인덱스 불일치** (det.korean은 올바른 오류 지적하는데 ans가 선지 배열 반영 안 함)
- Q13: 불일치 찾기 문제에서 "closer를 farther로 변조한 선지"가 실제 불일치인데, ans=4는 Marilyn 선물(원문일치)을 가리킴
- Q14: 오류찾기 문제 동일 — ch 배열 셔플과 ans 인덱스 불일치

**적대적 공격 발견**: 없음 (구조적 ans 오류만)

---

## 파일: 19번/퀴즈.json (Marilyn & Sarah 심경변화)

| 문항 | 내답 | 정답(ans) | 일치 | 근거 |
|---|---|---|---|---|
| 1 | 2 | 1 | ❌ | passage ②enormously 오류(wave수식=형용사). ch=[①,②,③,④] → "②"=index 2 |
| 2 | 2 | 1 | ❌ | passage ②"more close" 오류(closer). ch=[①,②,③,④] → "②"=index 2 |
| 3 | 2 | 2 | ✅ | passage ②build 오류(of+동명사=building). ch=[①,②,③,④] → "②"=index 2 |
| 4 | 1 | 1 | ✅ | ②misery→joy, ch=[②,①,③,④] → "②"=index 1 |
| 5 | 2 | 2 | ✅ | ②farther→closer, ch=[①,②,③,④] → "②"=index 2 |
| 6 | 2 | 2 | ✅ | 상실을 긍정적으로 재해석하여 위로 |
| 7 | 3 | 3 | ✅ | 상실 극복 적극 도전(enthusiasm+closer) |
| 8 | 4 | 4 | ✅ | 거대한 파도에 파괴 |
| 9 | 4 | 4 | ✅ | 더 가까이(closer) |
| 10 | 1 | 2 | ❌ | "joy를 슬픈 일로 변조한 것"이 불일치. ch[0]="Marilyn은 파괴를 슬픈 일이라고" → index 1. det도 ②로 기재하지만 **선지 배열 상 index 1** |
| 11 | 3 | 3 | ✅ | 상실을 긍정적 재해석 |
| 12 | 4 | 4 | ✅ | A Gift to the Ocean: Turning Loss into Joy |
| 13 | 1 | 1 | ✅ | 상실은 자연스러운 나눔의 과정 |
| 14 | 3 | 3 | ✅ | she=Sarah |
| 15 | 3 | 3 | ✅ | it=sandcastle |
| 16 | enormous | enormous | ✅ | 거대한 파도 |
| 17 | loved | loved | ✅ | love 과거형 |
| 18 | this time even closer to the water | accept 일치 | ✅ | 7단어 배열 |
| 19 | destroyed | destroyed | ✅ | 파괴하다 |
| 20 | joy | joy | ✅ | 기쁨 |

**불일치 문항**: Q1, Q2, Q10 (3건)
- Q1, Q2: **어법 문제 ch 배열과 ans 인덱스 불일치** (det.korean은 ②를 정답으로 하지만 ans=1이 되어 있음)
- Q10: 불일치 찾기에서 "joy를 슬픈 일로 변조"가 실제 불일치인데 ch 배열 상 index 1. det는 ②로 기재

**적대적 공격 발견**: 없음 (구조적 ans 오류만)

---

## 종합

- **총 검수**: 80문항 (4파일)
- **불일치**: 9건
  - 18번/단어: 0건
  - 19번/단어: 0건 (단 적대적 폐기 4건)
  - 19번/워크북: 6건 (Q1, Q2, Q3, Q4, Q13, Q14)
  - 19번/퀴즈: 3건 (Q1, Q2, Q10)
- **적대적 공격(폐기)**: 4건
  - 19번/단어 Q4, Q5, Q6: 문맥상 부적절한 어휘 문제인데 passage에 실제 오류 단어가 없음 → 재출제 필요
  - 19번/단어 Q20: 선지가 메타 서술("핵심을 요약한 것")로 실제 요약 내용 없음 → 재출제 필요
- **디자인 에러**: 1건
  - 19번/단어 Q13: ch[3]="오답 4" placeholder 문자열 노출

## 재출제 필요 목록

### 어법 ch 셔플-ans 불일치 (ans 필드 수정 필요)
- **19번/워크북.json**:
  - Q1: ans 1→2
  - Q2: ans 2→3
  - Q3: ans 1→3
  - Q4: ans 1→3
  - Q13: ans 4→2 (내용불일치 — closer→farther 변조 선지)
  - Q14: ans 2→3 (오류찾기 — streaming 동사없음)
- **19번/퀴즈.json**:
  - Q1: ans 1→2
  - Q2: ans 1→2
  - Q10: ans 2→1 (내용불일치 — joy를 슬픈 일로 변조)

### 문항 재출제 필요 (passage 변조 삽입)
- **19번/단어.json Q4, Q5, Q6**: 문맥상 부적절한 어휘 문제인데 passage에 원문 그대로 사용 → 오류 단어를 삽입해야 함
- **19번/단어.json Q20**: 요약문 선지를 실제 요약 내용으로 교체

### 디자인 수정
- **19번/단어.json Q13**: ch[3] "오답 4" → 실제 오답 선지로 교체 (예: "enormous", "broken" 등)

---

## 비고 (det 분석 필드 관찰)

워크북/퀴즈의 어법 문제에서 det.analysis의 ✅/❌ 마커가 ans 필드와 불일치하는 패턴이 많이 발견됨. 이는 ch 배열을 셔플한 후 ans 인덱스를 업데이트하지 않은 것으로 추정됨. feedback_no_swap_without_det_update.md 위반 사례로 파악됨.
