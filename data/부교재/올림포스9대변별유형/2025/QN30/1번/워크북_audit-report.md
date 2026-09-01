# 감사 리포트 — QN30 1번 워크북

- **대상**: `data/부교재/올림포스9대변별유형/2025/QN30/1번/워크북.json`
- **지문**: Price Setting in Bazaar Economies

## 검증 결과
| 단계 | 결과 |
|---|---|
| validate (구조/S급) | **PASS** (warnings 2, S급 0) |
| self-blind (.blind.json) | **20/20 일치** |
| cross-blind (Opus 교차, STEP C) | **FLAG 19/20** (Q16 불일치) |

> ⚠️ 주의: cross-blind --prep 실행(02:47) 이후 이 파일이 다른 세션에 의해 **02:48:37에 재작성**됨 → 최초 풀이 무효 → 현재 json으로 **재-prep·재풀이·재검증** 완료. 나머지 5개 파일은 prep 시점보다 json이 과거라 영향 없음.

## FLAG 상세 — Q16 (서술형, 어려움)
- **stem**: "…서로의 선호와 한계에 **'관계됨으로써'**라는 의미의 표현을 본문에서 찾아 3단어로 쓰시오."
- **원출제 wa**: `preferences and limitations` (= 선호와 한계)
- **Opus 풀이**: `by relating to` (= 관계됨으로써)
- **원문 구간**: "…establishes a price consensus **by relating to** each other's **preferences and limitations**…"

### 판정: **문항 설계 결함 (stem↔wa 의미 불일치)**
- 어느 쪽도 "사실오답"은 아님 — 두 표현 모두 본문에 존재하는 **3단어** 구간.
- 그러나 stem이 따옴표로 **강조·인용한 목표 의미는 '관계됨으로써' = `by relating to`** 인데, 정답 키는 그 앞 명사구 `preferences and limitations`(선호와 한계)를 요구 → **stem이 가리키는 것과 정답이 어긋남**.
- 자동채점은 `preferences and limitations`만 정답 처리 → **stem을 그대로 따른 학생(`by relating to`)이 오답 처리**되는 실채점 사고 위험.

### 권고(상위 세션 판단) — 둘 중 하나
1. stem에서 '관계됨으로써' 인용 제거 → "서로의 선호와 한계를 나타내는 표현을 3단어로" 로 명확화 (wa 유지), 또는
2. wa를 `by relating to`로 바꾸고 stem은 '관계됨으로써' 유지.
- **정답은 임의 수정하지 않음(보고만).**

## 나머지 19문항
정답이 본문/문법으로 유일 수렴, 이슈 없음.
