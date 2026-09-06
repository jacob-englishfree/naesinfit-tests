# 검증 증적 리포트 — 공통영어2 YBM(김은형) 2과 본문 (K-Delivery)

- 대상 폴더: `data/교과서/공통영어2/YBM김은형/2과/본문/`
- 테스트 3종: 단어 / 워크북 / 예상문제(퀴즈)
- 작성일: 2026-09-07
- 검증 범위: STEP C(cross-blind) + STEP D(adversarial) + check-cross-leak + 요약

---

## 종합 요약

| 종류 | validate | blind(self) | cross-blind | cross-leak(같은구역) | adversarial HIGH | 상태 |
|------|----------|-------------|-------------|----------------------|------------------|------|
| 단어 | PASS(기존) | 20/20 | 20/20 PASS | 0건 | 0 | ✅ 배포가능 |
| 워크북 | PASS(기존) | 20/20 | 20/20 PASS | 0건 (다른구역 3) | 0 | ✅ 배포가능 |
| 예상문제(퀴즈) | PASS(기존) | 20/20 | 20/20 PASS | **26건 FAIL** | **5** | ⛔ 배포차단 |

**핵심 결론: 퀴즈는 cross-blind 정답 도출성은 완벽(20/20)하나, 교차문항 정답노출(같은구역 26건)로 배포 부적합.** 단어·워크북은 전 게이트 통과.

---

## 단어 (단어.json)

- cross-blind: `node cross-blind.js --verify` → **PASS 20/20** (독립 재풀이 전문항 일치)
- check-cross-leak: **같은구역 0건** (다른구역 47건 = 어휘 특성상 본문 반복, 정상)
- adversarial: HIGH 0 / 이슈 2건(LOW)
  - Q14 반의어 rapid→slow: swift/safe/cheap 오답이 본문에 나란히 있으나 '반대' 문두로 정답 유일. 혼동 낮음.
  - Q15 다의어 charged: (A) 'charged with the safety'가 이론상 '기소' 여지 있으나 뒤 문장이 '맡기다'로 확정. 정답 유일.

## 워크북 (워크북.json)

- cross-blind: **PASS 20/20**
- check-cross-leak: **같은구역 0건** (다른구역 3건, 찾기유형 특성상 정상)
- adversarial: HIGH 0 / 이슈 3건
  - Q20(RESOLVED): 분리형 구동사 'pick the item up' 대체어순 복수정답 위험 → accept 확장으로 해결
  - Q15(LOW): 찾기 서술형 'the local areas' 다른구역 노출 = 찾기유형 정상
  - Q4(LOW): 어법 복수주어 수일치 오답 실재, 단일정답 유지
- 단어.json과 wa/blank/overlay 정답 전면 상이 (같은구역 0건)

## 예상문제 / 퀴즈 (퀴즈.json)

### STEP C — cross-blind
- `node cross-blind.js --verify "…/퀴즈.json"` → **[PASS] 20/20 cross-blind 일치**
- 정답 제거본(퀴즈.cross-prompt.json)만 보고 20문항 독립 재풀이 → 원본 ans/wa와 전건 일치
- (참고) verify 스크립트는 solves[].**pick** 필드를 읽음. 태스크 지시의 `ans`/`answer` 형식이 아니라 `pick`으로 저장해야 인식됨.
- mc 15문항 답 분포: 3,2,4,3,4,2,1,3,3,1,4,2,3,1,4 — 연속 2 이하, 동일번호 5 이하 준수

### STEP D — adversarial (⛔ HIGH 5건)
개별 문항 논리·오답설계·문법포인트는 모두 정상(단일정답 성립). 그러나 **교차문항 정답노출**이 심각:

| id | 유형 | 정답 | 노출된 형제 문항 passage(같은구역) |
|----|------|------|-----------------------------------|
| 16 | 조건영작 | Delivery is not limited to Korea | Q4·Q7·Q11·Q12·Q19 |
| 18 | 조건영작 | modern Korean life cannot function as it does without its delivery services | Q3·Q5·Q10·Q11·Q12 |
| 19 | 어순배열 | People in Korea can order whatever they want | Q4·Q7·Q11·Q12·Q16 |
| 20 | 조건영작 | a South Korean uses taekbae sixty-five times per year | Q11·Q12 (+Q1 밑줄문장 전체노출) |
| 7  | 빈칸추론 | at the tips of your fingers | Q4·Q11·Q12·Q16·Q19 |
| 6  | 빈칸추론(MED) | mutual trust | Q11·Q12 |
| 15 | 빈칸추론(MED) | on the same day | Q11·Q12 |

### 근본원인 (2가지)
1. **Q11(주제)·Q12(제목)가 fullPassage near-full 발췌** → 거의 모든 서술형/빈칸 정답을 verbatim으로 덮음. (메모리 `feedback_no_cross_question_answer_leak` 의 "주제/제목 넓은발췌가 서술형정답 덮는건 제거" 사례 재발)
2. **도입부/말미 문단을 여러 mc 발췌가 공유** — Q4/Q7/Q16/Q19가 첫 문단("Delivery is not limited to Korea … at the tips of your fingers … People in Korea can order whatever they want")을 공유, Q3/Q5/Q10이 말미 문단("It is fair to say that modern Korean life cannot function …")을 공유.

### check-cross-leak 결과
```
같은구역 노출: 26건 | 다른구역(우연) 노출: 3건
[FAIL] 같은구역 노출 0건 아님 — 해당 문항 재배치 필요
```
Q17 정답 'filled'만 다른구역(우연) 3건으로 수용 가능.

### 조치 권고 (임의 수정 안 함 — jacob 확인 필요)
- Q11/Q12 주제·제목 passage 발췌 범위를 축소해 서술형·빈칸 정답 구간을 덮지 않게 재배치, 또는 서술형 정답 문장을 발췌에서 제외
- Q4/Q7/Q16/Q19 도입부 공유, Q3/Q5/Q10 말미 공유 → 각 문항 발췌 구간을 분산시켜 정답 문장 중복 노출 제거
- 재배치 후 `python3 validate/check-cross-leak.py` 같은구역 0건 + cross-blind 재검증 필요

---

## 아티팩트 존재 확인
- 단어: blind ✅ / cross-blind ✅ / adversarial ✅
- 워크북: blind ✅ / cross-blind ✅ / adversarial ✅
- 퀴즈: blind ✅ / cross-prompt ✅ / cross-blind ✅ / adversarial ✅ / _audit-report ✅

**배포 게이트: 퀴즈는 adversarial HIGH 5건 + cross-leak FAIL로 STRICT_GATE 차단 대상. 단어·워크북은 통과.**
