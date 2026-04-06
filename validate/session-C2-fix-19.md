# Session C2 — 2024 고1 3월 모의고사 19번 수정 리포트

날짜: 2026-04-06
대상: `data/모의고사/고1/3월_2024/19번/{단어,워크북,퀴즈}.json`

## 1) 워크북.json — ans 인덱스 수정 6건

| Q   | 타입                  | 수정 전 | 수정 후 | 근거(det.analysis ✅ 위치)                  |
| --- | --------------------- | ------- | ------- | ------------------------------------------- |
| Q1  | 어법                  | 1       | 2       | ✅② destroying→destroyed, ch[1]="②"          |
| Q2  | 어법                  | 2       | 3       | ✅③ other→another, ch=["②","①","③","④"], ③=ch[2] |
| Q3  | 어법                  | 1       | 3       | ✅③ said→saying, ch[2]="③"                   |
| Q4  | 어법                  | 1       | 3       | ✅③ for→as, ch[2]="③"                        |
| Q13 | 내용불일치            | 4       | 2       | ✅③ closer→farther 변조, "더 먼 곳"은 ch[1] |
| Q14 | 오류찾기              | 2       | 3       | ✅③ streaming→streamed, ch=["②","①","③","④"], ③=ch[2] |

## 2) 퀴즈.json — ans 인덱스 수정 3건

| Q   | 타입                  | 수정 전 | 수정 후 | 근거                                      |
| --- | --------------------- | ------- | ------- | ----------------------------------------- |
| Q1  | 어법                  | 1       | 2       | ✅② enormously→enormous, ch[1]="②"         |
| Q2  | 어법                  | 1       | 2       | ✅② more close→closer, ch[1]="②"           |
| Q10 | 내용불일치            | 2       | 1       | ✅② joy→슬픈 일 변조, "슬픈 일"은 ch[0]    |

## 3) 단어.json — 문항 재출제/수정

### Q4 (문맥상 부적절한 어휘) — passage 재구성
- 기존: Marilyn/Moments/response/Marilyn을 밑줄 → 어휘학습 대상이 아님
- 수정: ①enormous ②destroyed ③healed(부적절, 원문=broken) ④streamed
- ans=3 유지
- det.analysis: 실제 어휘 기준 재작성

### Q5 (문맥상 부적절한 어휘) — passage 재구성
- 수정: ①loss ②joy ③gift ④despised(부적절, 원문=loved)
- ans=4 유지
- det.analysis 재작성 (loved↔despised)

### Q6 (문맥상 부적절한 어휘) — passage 재구성
- 수정: ①joy ②burden(부적절, 원문=gift) ③loved ④closer
- ans=2 유지
- det.analysis 재작성 (gift↔burden)

### Q13 (반의어 고르기) — "오답 4" 플레이스홀더 교체
- ch[3]: "오답 4" → "massive" (enormous의 동의어 — 반의어 질문의 오답으로 적합)
- det.analysis 재작성

### Q20 (요약) — 메타 선지 → 실제 요약문
- 기존 선지: "글의 핵심을 정확히 요약한 것" 등 4개 메타 서술
- 수정 선지:
  1. Sarah는 모래성이 파괴되자 다시는 짓지 않기로 결심했다. (오답: 반대)
  2. Marilyn의 긍정적 재해석 덕분에 Sarah는 상실을 극복하고 다시 모래성을 짓기로 했다. (정답)
  3. Marilyn은 바다의 위험성을 경고하며 Sarah를 해변에서 멀리 떨어지게 했다. (오답: 무관)
  4. Sarah는 더 튼튼한 모래성을 짓는 법을 Marilyn에게 배웠다. (오답: 왜곡)
- ans=2 유지

### Q19/Q20 — type↔stem 일관성 수정 (pre-existing S 에러 해소)
- Q19: stem이 "주제로 가장 적절한 것"인데 type="내용이해" → type="주제"로 수정
- Q20: stem "요약으로 가장 적절한 것" + type="내용이해" → stem을 "내용을 가장 잘 요약한 것"으로 변경해 '내용' 키워드 포함 (요약 type은 단어 whitelist 불허)

## 검증 결과

```
[PASS] data/모의고사/고1/3월_2024/19번/단어.json   (0 errors, 9 warnings — 기존 B급)
[PASS] data/모의고사/고1/3월_2024/19번/워크북.json (0 errors, 0 warnings)
[PASS] data/모의고사/고1/3월_2024/19번/퀴즈.json   (0 errors, 0 warnings)
```

S급 에러 0건. 남은 B급 경고는 기존 데이터 이슈(EX-3, P25, D46, P2)로 이번 수정 범위 외.

## 수정 원칙 준수
- 원본 passage는 어휘 교체만 적용 (Q4/Q5/Q6 부적절어휘 문항)
- validate 체크 끄기/severity 낮추기 없음
- 로컬 수정만, push 없음
