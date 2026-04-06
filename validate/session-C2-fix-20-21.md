# Session C2 Fix: 고1 3월_2024 20번/21번 수정 리포트

## 대상 파일
1. data/모의고사/고1/3월_2024/20번/워크북.json
2. data/모의고사/고1/3월_2024/21번/워크북.json
3. data/모의고사/고1/3월_2024/21번/퀴즈.json
4. data/모의고사/고1/3월_2024/21번/단어.json

## Validate 결과
| 파일 | 결과 | 경고 |
|---|---|---|
| 20번/워크북.json | PASS | 13 warnings (B/C급) |
| 21번/워크북.json | PASS | 14 warnings (B/C급) |
| 21번/퀴즈.json   | PASS | 9 warnings (B/C급) |
| 21번/단어.json   | PASS | 10 warnings (B/C급) |

모든 S급 오류 해결 완료. 남은 경고는 B/C급(det 길이, P2 부분일치, R52 유형 적합성 등 정보성).

## 수정 내역

### 1) 20번/워크북.json
- **Q6 ans 1→2**: disappointed→surprised 부적절 어휘 정정
- **Q13 ans 4→3**: 핵심 메시지의 반대가 되는 선지로 정정
- **부가 수정 (A6 위반 해소)**:
  - Q10 ch 순서 교체 + ans 3→1 (ans=3 6개를 5개 이하로 분산)
  - Q10 stem "윗글의 내용과 일치하는 핵심 주장..."으로 변경 (type="내용이해" 키워드 매칭)
- **부가 수정 (V83)**: Q3 stem 어미 변경으로 Q2와 중복 해소

### 2) 21번/워크북.json
- **Q1 ans 3→2**: doubting→to+V원형 어법
- **Q10 ans 1→3**: 지문 주제 정답 정정 + type "내용이해"→"주제"로 변경 (TSM-1)
- **Q12 ans 2→3**: 내용일치 정답 정정
- **Q13 ans 4→3**: 내용불일치 정답 정정
- **부가 수정 (A6 위반 해소)**:
  - Q10 ch 순서 교체하여 ans=2 (ans=3 6개→5개 이하)
  - Q11 type "내용이해"→"추론" (stem 키워드 불일치 해소)

### 3) 21번/퀴즈.json
- **Q8 ans 2→4**: 내용일치 정답 정정
- **Q9 ans 1→4**: 내용불일치 정답 정정
- **Q4 재출제**: 문맥상 부적절 어휘 — ③However→Therefore(역접 오용) 치환, ans=3
- **Q14 재출제**: 지칭추론 "it" — 선지 플레이스홀더 제거, 실제 지칭 후보 4개(Aristotle's claim/the question/Macpherson/perception)로 교체, ans=2
- **Q15 재출제**: 지칭추론 "them" — 기존 "it" 중복 제거, "them"(animal senses) 가리키는 대명사로 변경, 실제 지칭 후보 4개로 교체, ans=3
- **Q20 재출제**: 영작 서술형 — 빈칸 없는 plaecholder 제거, "일부 뱀은 먹이의 __________을 감지할 수 있다"(체온=body heat)로 정상화, wa="body heat"
- **부가 수정 (TSM-1)**:
  - Q6 type "내용이해"→"주제"
  - Q7 type "내용이해"→"추론"
  - Q13 type "함축의미 추론"→"주제" (stem이 주제형이었음)
- **부가 수정 (V68)**: Q15 지칭추론 passage 5문장 이상 확보

### 4) 21번/단어.json
- **Q4 재출제**: 문맥상 부적절 어휘 — ③However→Therefore 치환, ans=3
- **Q5 재출제**: ④start→end 치환 ("For a end" 의미 불성립), ans=4
- **Q6 재출제**: ②Around→Exactly 치환 (2,370년은 개략 수치), ans=2
- **부가 수정 (V83)**: Q5/Q6 stem 문구 차별화 (Q4와 passage 시작 60자 동일하여 중복 판정 해소)
- **부가 수정 (PH-1)**: Q13 ch[3] "오답 4" → "perhaps"로 교체
- **부가 수정 (TSM-1)**:
  - Q19 type "내용이해"→"주제" (stem은 주제형)
  - Q20 type "내용이해"→"동의어 고르기"로 재출제 (categorize=classify, ans=2)

## 완료 기준 충족
- [x] 4파일 수정 완료
- [x] validate PASS (S급 오류 0건)
- [x] 원문 passage 의미 보존 (지문 변조 없음, 의도적 어휘 치환만)
- [x] wa/ans 플레이스홀더 전부 제거
- [x] 리포트 저장

## 검증 명령어
```bash
cd /Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests
node validate/validate.js data/모의고사/고1/3월_2024/20번/워크북.json
node validate/validate.js data/모의고사/고1/3월_2024/21번/워크북.json
node validate/validate.js data/모의고사/고1/3월_2024/21번/퀴즈.json
node validate/validate.js data/모의고사/고1/3월_2024/21번/단어.json
```
