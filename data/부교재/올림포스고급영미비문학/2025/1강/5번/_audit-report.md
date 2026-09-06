# 교차검증 리포트 — 올림포스고급영미비문학 2025 1강 5번

검증자: Sonnet (반대 모델, 독립 solver) — 정답 미확인 상태로 passage+stem+ch만 보고 20문항씩 풀이 후 원본 정답과 대조.

## STEP C — 교차블라인드 3종 결과

| 파일 | 일치 | 불일치 |
|---|---|---|
| 단어.json | 20/20 | 없음 |
| 워크북.json | 20/20 | 없음 (최초 3건은 T/F를 문자열 "T"/"F"로 표기해 형식상 FLAG 발생 → ch 인덱스(1/2)로 재인코딩 후 20/20 PASS. 의미상 판정은 처음부터 정답과 동일했음) |
| 퀴즈.json | 20/20 | 없음 (2026-09-06 재조립: Q17=어형변환·Q18=조건영작 신규 반영 후 blind 8건·cross-blind 전면 재풀이 → 20/20) |

전 문항 재작성 없이 원본 ans/wa와 일치. 문항 자체의 정답 타당성은 확보된 상태.

### 퀴즈.json 재조립 후 재검증 (2026-09-06)
- **재조립 배경**: N7 워크북 중복 제거 위해 Q17→서술형 어형변환(wa=`involves`), Q18→서술형 조건영작(wa=`Literary study like all disciplines has developed its own terminology and its own techniques`)으로 교체. blind.json 리셋됨.
- **독립 블라인드**: needsAgent 8건(Q8~Q14, Q18) 학생 관점 재풀이 + Q20 자동풀이 오흡수(빈칸 뒤 문장 전체) 교정 → **20/20 일치, 불일치 0건**.
- **교차블라인드**: 현행 마커 기준 전면 재작성(구 파일은 Q3 in which·구 Q18 stale) → **20/20 일치**.
- **validate.js**: `[PASS] (4 warnings)` — 경고는 전부 B급(마커/빈칸 passage 시작 P2 3건 + Q7 distractor 품질 권장 1건). S급 차단 0건, FAIL 0건.

## STEP D — 적대공격 3종 결과

| 파일 | HIGH | MED | LOW | 총계 |
|---|---|---|---|---|
| 단어.json | 0 | 0 | 0 | 0 |
| 워크북.json | 1 | 2 | 0 | 3 |
| 퀴즈.json (재조립 전) | 1 | 2 | 0 | 3 |
| 퀴즈.json (재조립 후 2026-09-06) | 0 | 2 | 1 | 3 |

### HIGH (배포 차단 대상)
- **해소됨(2026-09-06)**: 기존 HIGH(워크북 Q20 = 퀴즈 Q18 정답 문자열 `learning something about them can make all the difference` 완전 동일)는 퀴즈 Q18을 신규 조건영작 `Literary study like all disciplines has developed its own terminology and its own techniques`로 교체하여 제거. 현재 워크북↔퀴즈 wa 중복 0건. **현행 HIGH 0건.**

### MED (권장 수정, 재조립 후 현행)
- **워크북 Q4 ↔ 퀴즈 Q17 — 동일 절 재사용**: `a process that involves trying to put into words` 절을 워크북 Q4 어법(involves to try→trying, 정답에 involves 노출)과 퀴즈 Q17 어형변환(involve→involves)이 공유. wa 자체는 상이(WB Q17='considering' vs 퀴즈 Q17='involves')하나 워크북을 먼저 푼 학생에게 involves 형태가 힌트로 작용.
- **워크북 Q14 ↔ 퀴즈 Q1 — 문법포인트 계열 중복**: 주어-동사 수일치(워크북 falls / 퀴즈 has). 문장·마커는 다르나 학습 포인트 계열이 겹침.
  - **조치 권장(비차단)**: 여유 시 퀴즈 어법·어형변환 문항을 본문 내 미사용 포인트로 분산. 현 상태로도 배포 가능(HIGH 아님).

### LOW
- **퀴즈 Q18 단일 accept 어순**: subject-first 고정. 대문자 Literary 토큰·우리말 어순이 단일 정답을 강하게 유도하므로 오작성 소지 낮음.

## 종합 판정
- 문항별 정답 타당성(블라인드+교차블라인드): **PASS** — 재조립 후 퀴즈 20/20, 단어·워크북 20/20.
- 파일 간 중복 노출(적대검수): 퀴즈 재조립 후 **HIGH 0건 / MED 2 / LOW 1** — 배포 차단 사유 없음. (재조립 전 HIGH 1건은 Q18 재출제로 해소.)
- validate.js: 퀴즈 `[PASS] (4 warnings, 전부 B급)`.
