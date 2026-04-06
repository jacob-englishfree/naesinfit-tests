# 세션 C-2 Part 2 리포트

작업 경로: /Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/data/모의고사/고1/3월_2024/
검수자: Claude (Opus 4.6)
작업일: 2026-04-06

---

## 파일 1: 20번/워크북.json (Positive Statements)

| 문항 | 내답 | 정답(ans/wa) | 일치 | 근거 |
|---|---|---|---|---|
| 1 | 2 | 2 | ✅ | can 뒤 ②creating→create (조동사+동사원형) |
| 2 | 3 | 3 | ✅ | these+③statement→statements (these+복수) |
| 3 | 2 | 2 | ✅ | ②Sudden→Suddenly (문장수식=부사) |
| 4 | 3 | 3 | ✅ | let me ③to give→give (let+O+V원형) |
| 5 | 4 | 4 | ✅ | magic AND ___, 긍정 흐름 = ④confidence |
| 6 | **2** | **1** | ❌ | 원문은 surprised, ②disappointed가 부적절. 정답=2 |
| 7 | 1 | 1 | ✅ | "create magic" 원문과 일치=T |
| 8 | 2 | 2 | ✅ | struggle=힘들다, "쉽다면"과 반대=F |
| 9 | 1 | 1 | ✅ | "shift in the way you think"=T |
| 10 | 3 | 3 | ✅ | 주장=도전을 긍정적 문장으로 (ch[2]) |
| 11 | 4 | 4 | ✅ | ch[3]=shift, 빈칸=shift (단, det analysis 텍스트는 ch와 안 맞음) |
| 12 | 3 | 3 | ✅ | struggle→positive statement 원문 일치 (ch[2]) |
| 13 | **3** | **4** | ❌ | ch[2]=문장적어도변화없음(핵심과 반대=불일치). ch[3]=자신감얻는다는 원문과 일치. 정답=3 |
| 14 | 4 | 4 | ✅ | ④surprising→surprised (감정수동) |
| 15 | positive | positive | ✅ | "change into positive statements" |
| 16 | shift | shift | ✅ | "shift in the way you think" |
| 17 | Just change the challenge statement into positive statements | 동일 | ✅ | 원문 문장 그대로 |
| 18 | 3 | 3 | ✅ | 주제=긍정적 자기암시의 힘 (ch[2]) |
| 19 | 4 | 4 | ✅ | ch[3]=긍정적 문장→사고방식 바뀜 (단, det 분석 텍스트는 ch와 안 맞음) |
| 20 | powerful | powerful | ✅ | 강력한=powerful |

**불일치 문항**: Q6, Q13 (2건)
**적대적 공격 발견**:
- Q6: ans=1 오류 (정답은 2=disappointed). 재출제 또는 ans 수정 필요
- Q13: ans=4 오류 (정답은 3=변화없다). ans 수정 필요
- Q11: det.analysis 텍스트가 실제 ch 배열과 불일치 (표시 버그)
- Q19: det.analysis 텍스트가 실제 ch 배열과 불일치 (표시 버그)

---

## 파일 2: 21번/단어.json (Human Senses)

| 문항 | 내답 | 정답(ans/wa) | 일치 | 근거 |
|---|---|---|---|---|
| 1 | 1 | 1 | ✅ | (A)seemingly(B)doubt(C)perception |
| 2 | 2 | 2 | ✅ | (A)categorize(B)detect(C)limited |
| 3 | 3 | 3 | ✅ | (A)different(B)harder(C)simple |
| 4 | **판정불가** | **3** | ⚠️ | passage의 ①~④ 모두 원문 그대로. 부적절 어휘 교체 없음 |
| 5 | **판정불가** | **4** | ⚠️ | passage 동일, 어휘 교체 없음 |
| 6 | **판정불가** | **2** | ⚠️ | passage 동일, 어휘 교체 없음 |
| 7 | 3 | 3 | ✅ | ch[2]=different (body perception is ___ from touch) |
| 8 | 4 | 4 | ✅ | ch[3]=harder (senses ___ to categorize) |
| 9 | 1 | 1 | ✅ | ch[0]=simple (seemingly ___ question) |
| 10 | 2 | 2 | ✅ | seemingly≈apparently |
| 11 | 3 | 3 | ✅ | doubt≈question |
| 12 | 4 | 4 | ✅ | perception≈awareness |
| 13 | 1 | 1 | ✅ | seemingly↔obviously |
| 14 | 2 | 2 | ✅ | doubt↔believe |
| 15 | 3 | 3 | ✅ | 첫 sense=감각(5감각), 두번째 sense=분별력(책 제목 The Senses 제외 맥락) |
| 16 | 4 | 4 | ✅ | "put into groups by type"=categorize |
| 17 | perception | perception | ✅ | perceive→perception |
| 18 | different | different | ✅ | differ→different |
| 19 | 1 | 1 | ✅ | 주제=감각 수 5개 아닐 수 있다 |
| 20 | 2 | 2 | ✅ | ch[1]=핵심을 정확히 요약 (단, 메타텍스트 선지) |

**불일치 문항**: 없음 (단, Q4~Q6은 판정 불가=사실상 오류)
**적대적 공격 발견**:
- **Q4, Q5, Q6 (심각)**: "문맥상 부적절한 어휘" 문항인데 passage에 어휘 교체가 전혀 없음. 원문 ①Consider②Around③However④start 그대로. 정답 도출 불가능한 오류 문항. **재출제 필수**
- Q13: ch[3]="오답 4" placeholder 텍스트 (실제 단어 아님). 선지 수정 필요
- Q20: 선지가 메타텍스트("핵심을 정확히 요약한 것")로 실제 요약문 아님. 문항 품질 낮음

---

## 파일 3: 21번/워크북.json (Human Senses)

| 문항 | 내답 | 정답(ans/wa) | 일치 | 근거 |
|---|---|---|---|---|
| 1 | **2** | **3** | ❌ | passage ①wrote ②doubting ③harder ④are. ②doubting→doubt (to부정사). 정답=2 |
| 2 | 2 | 2 | ✅ | ②missing→missed (주절동사 필요) |
| 3 | 4 | 4 | ✅ | ④that→what (study for what they are) |
| 4 | 2 | 2 | ✅ | ②tells→tell (examples 복수주어) |
| 5 | 3 | 3 | ✅ | ch[2]=doubt (For a start, reasons to ___) |
| 6 | 3 | 3 | ✅ | ③overlook→detect (뱀이 체온 감지) |
| 7 | 1 | 1 | ✅ | 5감각 주장=T |
| 8 | 2 | 2 | ✅ | Macpherson doubt≠동의=F |
| 9 | 1 | 1 | ✅ | 뱀 체온 감지=T |
| 10 | **3** | **1** | ❌ | ch:①업적②뱀③5개아닐수④윤리. 정답=③=3 |
| 11 | 4 | 4 | ✅ | ch[3]=추가감각+분류어려움 (missed+harder) |
| 12 | **3** | **2** | ❌ | ch:①7개②동의③뱀체온감지④5가지분류. 정답=③=3 (ch[1]Macpherson동의는 거짓) |
| 13 | **3** | **4** | ❌ | ch:①균형감각②의문제기③모든5가지④2370년전. 정답=③=3 (모든5가지=핵심반대) |
| 14 | 4 | 4 | ✅ | ④for detect→for detecting (전치사+동명사) |
| 15 | doubt | doubt | ✅ | "reasons to doubt it" |
| 16 | detect | detect | ✅ | "snakes can detect the body heat" |
| 17 | We should study them for what they are | 동일 | ✅ | 원문 마지막 문장 |
| 18 | 3 | 3 | ✅ | ch[2]=감각5가지제한안됨+유연연구 |
| 19 | 4 | 4 | ✅ | ch[3]=5가지한정보다 있는 그대로 연구 |
| 20 | divided | divided | ✅ | "cannot be clearly divided" |

**불일치 문항**: Q1, Q10, Q12, Q13 (4건)
**적대적 공격 발견**:
- Q1: ans=3 오류 (정답=2=doubting)
- Q10: ans=1 오류 (ch[0]=업적이 아닌 ch[2]=감각5개아닐수가 정답)
- Q12: ans=2 오류 (Macpherson 동의는 거짓, ch[2]=뱀체온감지가 일치)
- Q13: ans=4 오류 (2370년 전은 원문 일치, ch[2]=모든5가지가 불일치)

---

## 파일 4: 21번/퀴즈.json (Human Senses)

| 문항 | 내답 | 정답(ans/wa) | 일치 | 근거 |
|---|---|---|---|---|
| 1 | 2 | 2 | ✅ | ②doubting→doubt (reasons to+V원형) |
| 2 | 2 | 2 | ✅ | ②missing→missed |
| 3 | 4 | 4 | ✅ | ④that→what |
| 4 | **판정불가** | **2** | ⚠️ | passage ①Consider②Around③However④start 원문 그대로, 교체 없음 |
| 5 | 3 | 3 | ✅ | ③overlook→detect |
| 6 | 1 | 1 | ✅ | ch[0]=5개아닐수 (주제) |
| 7 | 3 | 3 | ✅ | ch[2]=추가감각+분류어려움 |
| 8 | **4** | **2** | ❌ | ch:①7개②동의③5가지분류④뱀체온. 정답=④=4 |
| 9 | **4** | **1** | ❌ | ch:①2370년전②균형감각③의문제기④모든5가지. 정답=④=4 |
| 10 | 2 | 2 | ✅ | ch[1]=5가지제한안됨 |
| 11 | 3 | 3 | ✅ | ch[2]=5가지제한안됨 |
| 12 | 4 | 4 | ✅ | ch[3]=있는그대로연구 |
| 13 | 1 | 1 | ✅ | ch[0]=5개아닐수 (단, type=함축의미인데 주제문항) |
| 14 | **판정불가** | **4** | ⚠️ | ch=["선택1","선택4","선택3","선택2"] 전부 placeholder |
| 15 | **판정불가** | **3** | ⚠️ | ch=["선택2","선택3","선택1","선택4"] 전부 placeholder |
| 16 | doubt | doubt | ✅ | |
| 17 | detect | detect | ✅ | |
| 18 | We should study them for what they are | 동일 | ✅ | |
| 19 | divided | divided | ✅ | |
| 20 | **판정불가** | **answer** | ⚠️ | stem에 빈칸/문맥 없음, wa="answer" 무의미 |

**불일치 문항**: Q8, Q9 (2건)
**적대적 공격 발견**:
- **Q4 (심각)**: "문맥상 부적절한 어휘" 문항인데 passage에 교체 없음. 원문 그대로. 재출제 필수
- Q8: ans=2 오류 (정답=4=뱀체온감지)
- Q9: ans=1 오류 (2370년전=일치, 정답=4=모든5가지=불일치)
- **Q13**: type="함축의미 추론"인데 stem/ch는 주제 문항. type 또는 내용 불일치
- **Q14, Q15 (심각)**: 지칭추론인데 선지가 "선택1","선택2"... placeholder 문자열. 실제 선지 없음. 재출제 필수
- **Q20 (심각)**: 영작 문항인데 stem="다음 빈칸을 영어로 완성하시오." 빈칸/문맥 없음, wa="answer" placeholder. 재출제 필수

---

## 종합

| 항목 | 값 |
|---|---|
| 총 검수 문항 | 80 |
| 일치 (✅) | 66 |
| 불일치 (❌) | 8 |
| 판정불가/오류문항 (⚠️) | 6 |
| 전체 통과율 | 82.5% (66/80) |

### 불일치 8건 (ans 수정 필요)
1. **20번/워크북 Q6**: ans 1→2 (문맥상 부적절 어휘, disappointed가 부적절)
2. **20번/워크북 Q13**: ans 4→3 (내용불일치, "변화없다"가 불일치)
3. **21번/워크북 Q1**: ans 3→2 (어법, doubting이 오류)
4. **21번/워크북 Q10**: ans 1→3 (주제, ch[2]=5개아닐수)
5. **21번/워크북 Q12**: ans 2→3 (내용일치, 뱀체온감지만 일치)
6. **21번/워크북 Q13**: ans 4→3 (내용불일치, 모든5가지가 불일치)
7. **21번/퀴즈 Q8**: ans 2→4 (내용일치, 뱀체온감지=ch[3])
8. **21번/퀴즈 Q9**: ans 1→4 (내용불일치, 모든5가지=ch[3])

### 재출제 필요 (6건, 심각)
1. **21번/단어 Q4**: 문맥상 부적절 어휘 출제 실패 (passage에 교체 없음)
2. **21번/단어 Q5**: 동일 문제
3. **21번/단어 Q6**: 동일 문제
4. **21번/퀴즈 Q4**: 동일 문제 (문맥상 부적절, passage 원문 그대로)
5. **21번/퀴즈 Q14**: 지칭추론 선지 placeholder ("선택1","선택2"...)
6. **21번/퀴즈 Q15**: 동일 (선지 placeholder)
7. **21번/퀴즈 Q20**: 영작 stem/wa placeholder ("answer")

### 경미한 이슈 (참고용)
- 20번/워크북 Q11, Q19: det.analysis 텍스트가 ch 배열과 불일치 (정답 자체는 맞음)
- 21번/단어 Q13: ch[3]="오답 4" placeholder
- 21번/단어 Q20: 선지가 메타텍스트 (실제 요약문 아님)
- 21번/퀴즈 Q13: type="함축의미"인데 실제 문항은 주제

### 결론
4개 파일 중 **20번/워크북 + 21번/단어 + 21번/퀴즈는 재출제 필수**.
21번/워크북은 ans 4건만 수정하면 통과 가능.
특히 21번/단어 Q4~6, 21번/퀴즈 Q4/Q14/Q15/Q20은 문항 자체가 성립하지 않아 데이터 재생성 필요.
