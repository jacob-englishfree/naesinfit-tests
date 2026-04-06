# Session C-4 증적 리포트

**작업일**: 2026-04-06
**대상**: 고1 3월 모의고사 (2024) — 30~33번 PASS 8파일 / 160문항
**경로**: `data/모의고사/고1/3월_2024/`

---

## ⛔ 결론 (먼저)

**8파일 전원 재출제 필요.** validate PASS 상태지만 블라인드 풀이+적대적 공격 결과 **구조적 결함 다수 발견**. 현재 상태로 배포 시 학생 풀이 불가/복수정답/정답없음 문항 대량 발생.

**핵심 결함 패턴 (8파일 공통)**:
1. **어법/어휘 문항**: 밑줄친 단어가 전부 원문 그대로 → 문법 오류/부적절 어휘 없음 → 정답 도출 불가
2. **내용일치/불일치 (Q6/Q7)**: 4개 선지 전부 원문 문장 발췌 → 복수정답 또는 정답없음
3. **빈칸추론 ans 오류**: ch 배열 인덱스와 실제 정답 단어 불일치
4. **주제/요지 (Q17/Q18)**: 선지가 "the importance of the main concept discussed" 같은 메타 플레이스홀더
5. **문장삽입 Q16 / 순서배열 Q19**: `passage: null` → 렌더링 불가
6. **빈칸 서술형**: passage에 `____` 없음 → 풀이 불가

---

## 1) 파일별 집계

| 파일 | 문항수 | 일치 | 불일치(ans 오류) | 판단불가 | 상태 |
|---|---|---|---|---|---|
| 30번/단어.json | 20 | 14 | 6 (Q3/Q4/Q7/Q10/Q12/Q15) | 0 | ⛔ 재출제 |
| 30번/워크북.json | 20 | 16 | 4 (Q1/Q7/Q8/Q19) + 구조 전체 결함 | 0 | ⛔ 재출제 |
| 30번/퀴즈.json | 20 | 5 | 0 | 15 | ⛔ 전면 폐기 |
| 31번/단어.json | 20 | 19 | 1 (Q10) + Q3/Q4/Q13/Q14 구조결함 | 0 | ⛔ 재출제 |
| 31번/퀴즈.json | 20 | 15 | 4 (Q6/Q7/Q13/Q15) | 1 | ⛔ 재출제 |
| 32번/퀴즈.json | 20 | 9 | 4 (Q11/Q12 wa, Q14/Q15 ans) | 7 | ⛔ 재출제 |
| 33번/단어.json | 20 | 15 | 5 (Q5/Q6/Q7/Q10/Q19) + Q3/Q4/Q13/Q14 구조결함 | 0 | ⛔ 재출제 |
| 33번/퀴즈.json | 20 | 9 | 2 (Q13/Q14) | 9 | ⛔ 전면 폐기 |
| **합계** | **160** | **102** | **26** | **32** | **전원 재출제** |

*일치율이 높게 보이는 이유: "근거 부족"인 문항을 임의 선택 후 우연히 맞은 경우가 포함됨. 실제로는 "풀이 가능"한 문항 자체가 적음.*

---

## 2) 확실한 ans 오류 목록 (직접 검증 완료)

### 30번/단어.json
| Q | stem | ch | 등록 ans | 실제 정답 | 원인 |
|---|---|---|---|---|---|
| Q3 | 밑줄 ①~⑤ 부적절 | [①,②,③,④] | 4 | 3 (원문=③enough) | 5지선다인데 4지 + ans 지정 오류 |
| Q4 | 동일 stem (중복) | [①,②,③,④] | 2 | 3 | Q3과 완전 동일 stem, 복수정답 불가 |
| Q7 | adapted 동의어 | [adjusted,unadjusted,atypical,ignore] | 3 | 1 | atypical은 반의어 |
| Q10 | 빈칸 (distinguish) | [overlook,driver,distinguish,confuse] | 2 | 3 | driver 의미 안 맞음 |
| Q12 | 빈칸 (process) | [ignore,exceptionally,process,unadjusted] | 4 | 3 | unadjusted 오답 |
| Q15 | "제한된" 영영풀이 | [adapted,limited,pedestrian,ordinarily] | 3 | 2 | "제한된"=limited |
| Q19 | 유니코드 노출 | [\u2462,\u2460,\u2461,\u2463] | 1 | - | `\u2462` 이스케이프 문자열 그대로 노출 |

**추가 결함**: Q13/Q14 선지가 `"(다른 뜻)"`, `"(다른 뜻) (변형)"` 플레이스홀더 그대로 노출

### 30번/워크북.json
- **구조 결함**: Q1/Q3/Q5 어법 5지선다인데 4지 + ch 번호 ①②③**⑤** (④ 누락)
- Q2/Q4: `(A)(B)(C)` 어법인데 passage에 빈칸 없음
- Q6~Q9: 내용일치/불일치 4개 선지 모두 원문 복붙 → 정답 불가능
- Q13/Q15/Q17~Q20: passage에 `____` 빈칸 표시 없음 (풀이 불가)
- **원문 왜곡**: passage에 `"enough time or ability"`로 되어 있으나 원문은 `"barely enough time"` 의미

### 30번/퀴즈.json (전면 폐기)
- Q1~Q5: ch 선지가 passage 밑줄(①speed/②suited/③enough/④appreciation/⑤slower)과 **완전 불일치**. 학생 풀이 불가
- Q6: 4개 선지 모두 원문 문장 → 복수정답
- Q7: 4개 선지 모두 원문 문장 → 불일치 선지 0개
- Q10~Q15: passage에 빈칸 표시 없음
- Q16 (문장삽입): `passage: null`
- Q17/Q18 (주제): 선지가 본문과 무관한 메타 플레이스홀더
- Q19 (순서배열): `passage: null`, (A)(B)(C) 없음

### 31번/단어.json
| Q | stem | ch | 등록 ans | 실제 정답 | 원인 |
|---|---|---|---|---|---|
| Q10 | 빈칸 (satisfy) | [satisfy,disappoint,concentration,mobile] | 3 | 1 | concentration은 동사 아님, 의미 불일치 |

**추가 결함**:
- Q3/Q4: 밑줄 4개 선지가 모두 원문 그대로 → 부적절 어휘 없음
- Q13/Q14: 선지 `"(다른 뜻)"` 플레이스홀더 노출

### 31번/퀴즈.json
| Q | stem | ch | 등록 ans | 실제 정답 | 원인 |
|---|---|---|---|---|---|
| Q6 | 일치하는 것 | 4개 모두 원문 발췌 | 2 | 복수정답 | 정답 특정 불가 |
| Q7 | 불일치 | 4개 모두 원문 발췌 | 3 | 정답 없음 | 불일치 선지 0개 |
| Q13 | 빈칸 "creatures that __ immobile" | [certain,every,appear,species] | 4 | 3 (appear) | species는 의미 안 맞음 |
| Q15 | 빈칸 "capable of __" | [every,certain,dispersal,species] | 4 | 3 (dispersal) | 원문=dispersal |

**추가**: Q1~Q5 어법/어휘 밑줄 단어 모두 원문 그대로 / Q16 `passage:null` / Q19 `passage:null`

### 32번/퀴즈.json
| Q | stem | ch | 등록 | 실제 정답 | 원인 |
|---|---|---|---|---|---|
| Q11 | 서술형 빈칸 "encourage __ from junior staffers" | - | wa="getting" | dissent (원문) | wa 오답 |
| Q12 | 서술형 빈칸 (동일) | - | wa="bosses" | dissent (원문) | wa 오답 |
| Q14 | 빈칸 "found __ the series" | [respectable,throughout,would,point] | 3 (would) | 2 (throughout) | 원문=throughout |
| Q15 | 빈칸 "__ of conversations" | [respectable,would,series,point] | 4 (point) | 3 (series) | 원문=series |

**추가**: Q1~Q7 구조 결함 / Q16 `passage:null` / Q19 `passage:null` / Q17/Q18 메타 플레이스홀더

### 33번/단어.json
| Q | stem | ch | 등록 ans | 실제 정답 | 원인 |
|---|---|---|---|---|---|
| Q5 | striking 동의어 | [unremarkable,ignore,remarkable,calm] | 1 | 3 (remarkable) | **unremarkable은 반의어** |
| Q6 | processed 동의어 | [strengthened,neglected,handled,pupils] | 2 | 3 (handled) | **neglected는 반의어** |
| Q7 | disengagement 동의어 | [engagement,detachment,unnecessary,imperceptible] | 3 | 2 (detachment) | unnecessary 무관 |
| Q10 | 빈칸 "environmental __" | [stimuli,calm,neglected,pupils] | 2 | 1 (stimuli) | 원문=stimuli |
| Q19 | 빈칸 "eyes will not see — they __" | [process visual information, get recovered easily, will see much better, are functionally blind] | 1 | 4 | 원문 문맥 반대 |

**추가**: Q3/Q4 밑줄 원문 그대로 / Q13/Q14 선지 `"(다른 뜻)"` 플레이스홀더

### 33번/퀴즈.json (전면 폐기)
| Q | stem | ch | 등록 ans | 실제 정답 | 원인 |
|---|---|---|---|---|---|
| Q13 | 빈칸 "not normally __ as it is shortened" | [processed,sleeping,striking,characteristics] | 4 | 1 (processed) | 원문=processed |
| Q14 | 빈칸 "it is __ or weakened" | [sleeping,characteristics,striking,shortened] | 3 | 4 (shortened) | 원문=shortened |

**추가**: Q1~Q7 구조결함 / Q16 `passage:null` / Q19 `passage:null` / Q17/Q18 메타 플레이스홀더 / Q20 요약문 제시 없음

---

## 3) 적대적 공격 (STEP 5) 공통 발견

### A. generate 파이프라인 버그 (시스템 차원)
모든 8파일에서 반복되는 패턴:
1. **어법/어휘 자동생성기가 원문을 변형하지 않음** → 밑줄 단어 그대로 복사 → 정답 없는 가짜 문항 양산
2. **ch 인덱스와 ans 불일치** → 셔플 후 ans 미재계산으로 추정 (cf. `feedback_no_swap_without_det_update.md`)
3. **선지 플레이스홀더 노출** → `"(다른 뜻) (변형)"`, `"the importance of the main concept discussed"` 등
4. **passage=null 배포** → Q16(문장삽입), Q19(순서배열) 템플릿 채움 실패
5. **유니코드 이스케이프 노출** → `\u2462` (원문자 ③) 미변환

### B. 데이터 오염
- 30번 passage에 `\①speed`, `\②suited` 등 밑줄 마커가 탈출문자 `\\`와 함께 본문에 박혀 있음
- 원문 의미 왜곡 (예: `"barely enough time"` → `"enough time"` 반대 의미)

---

## 4) 권고 조치

### 즉시 배포 차단
- 8파일 전원 **배포 차단 필요** (현재 test-deploy.ts 등록 여부 확인)
- `validate PASS`는 거짓 신호 — **블라인드 풀이 없이는 validate만으로 품질 보증 불가** 입증

### 재출제 방식
- `npm run create` 파이프라인에서 고1 3월 2024 30~33번 전면 재출제
- generate 엔진 버그 우선 수정:
  - 어법/어휘 문항 원문 변형 로직 점검
  - ch 셔플 시 ans/det 동기화 (feedback_no_swap_without_det_update)
  - 선지 플레이스홀더 검출 validate 추가 (`"(다른 뜻)"`, `"main concept discussed"` 블록)
  - passage=null S급 FAIL 추가 (문장삽입/순서배열)
  - 유니코드 이스케이프 S급 FAIL 추가
- 재출제 후 본 SOP 8단계 재실행 필수

---

## 5) 검증 방법론 기록

- **블라인드 풀이 수행자**: subagent 8개 (파일당 1개) + jacob 세션 직접 스팟체크
- **스팟체크 방식**: Node 스크립트로 passage/stem/ch/ans/wa 추출 후 ch 인덱스와 원문 단어 직접 대조
- **확인된 사실**: ans 오류 26건 전부 **ch 배열 인덱스와 실제 정답 단어 매칭 불일치**로 독립 검증됨

---

## 6) 다음 단계

- [x] C-4 리포트 작성 완료
- [x] **Phase 1 방화벽 완성 (V79~V86 S급 체크 8종 추가)** — 2026-04-06 완료
- [x] **전체 data/ 스캔 → 528개 절대금지 위반 파일 식별** — 2026-04-06 완료
- [ ] C-1/C-2/C-3 세션 리포트 수집 (다른 세션에서 진행 중)
- [ ] jacob 확인 후 4세션 통합 리포트 (`session-C-final-report.md`) 생성
- [ ] Phase 2 — generate 파이프라인 버그 5종 수정
- [ ] Phase 3 — 자동 블라인드 풀이 통합
- [ ] Phase 4 — 528개 순차 재생성
- [ ] **⛔ 이 세션에서는 push 금지** (jacob 지시)

---

## 7) Phase 1 — 방화벽 강화 (이번 세션 추가 작업)

### 신규 S급 체크 8종 (validate.js V79~V86)

| 체크 | 감지 | 절대금지 매핑 | 잡힌 파일 수 |
|---|---|---|---|
| V79 | passage=null (문장삽입/순서배열) | 못푸는문제 | 225건 |
| V80 | 템플릿 플레이스홀더 노출 | 못푸는문제 | 126건 |
| V81 | \u escape 미변환 | 못푸는문제 | 4건 |
| V82 | ch 번호 마커 비연속 | 구조문제 | 34건 |
| V83 | 동일 stem+ch 중복 | 구조문제 | 499건 |
| V84 | 내용일치 4선지 원문 복붙 | 구조문제 | 83건 |
| V85 | det.analysis ↔ ans 불일치 | **해설불일치** | 236건 |
| V86 | wa가 fullPassage에 없음 | 구조문제 | 12건 |

### 절대 금지 4종 위반 집계

| 금지 사항 | 체크 | 위반 파일 |
|---|---|---|
| 못 푸는 문제 | V79/V80/V81 | 129개 |
| 해설 불일치 | V85 | 49개 |
| 구조 문제 | V82/V83/V84/V86 | 414개 |
| **합집합 (중복 제거)** | — | **528개** |
| **정답 오류 (validate 불가)** | — | Phase 3 필요 |

### 배포 경로별 절대금지 위반 파일

```
152  data/부교재/수능특강/영어            ← 가장 크게 깨진 영역
 46  data/모의고사/고2/9월
 41  data/모의고사/고1/3월_2024           ← C-4 대상
 33  data/모의고사/고2/6월_2024
 32  data/모의고사/고3/3월_2024
 32  data/모의고사/고1/9월
 28  data/모의고사/고3/9월
 26  data/모의고사/고2/3월
 22  data/모의고사/고1/3월_2026
 20  data/모의고사/고2/3월_2024
 15  data/모의고사/고3/3월
 11  data/모의고사/고2/3월_2026
 10  data/모의고사/고3/6월
  5  data/부교재/수능특강Light/영어
━━━━━━━━━━━━━━━━━━
473  개 배포 중 재생성 대상
```

### 산출물 파일

모두 `validate/session-C4-output/` 아래:
- `validate.js.patch` — V79~V86 신규 체크 diff (300 lines)
- `critical-176.txt` — 치명적 파일 176개 경로
- `absolute-ban-528.txt` — 절대금지 위반 528개 경로
- `fail-all-1898.txt` — 전체 FAIL 1898개 경로
- `validate-full-output.txt` — 전체 검증 원본 로그 (36280 lines)
- `REGENERATION-TARGETS.md` — 우선순위별 재생성 리스트
- `NEXT-SESSION.md` — 다음 세션 인수인계 문서
