# 교차검증 + 적대검수 리포트

대상: `올림포스고급영미비문학/2025/1강/1번` — 단어.json / 워크북.json / 퀴즈.json (각 20문항)
검수자: Sonnet (독립 solver, 출제 모델과 반대 모델) + check-cross-leak.py (자동 게이트)

## STEP C: 교차 블라인드 (Cross-Blind)

블라인드 풀이는 `node cross-blind.js --prep`으로 정답 필드(ans/wa/accept/det)를 제거한 `.cross-prompt.json`을 생성한 뒤, 오염되지 않은 새 세션(fresh sub-agent)에게 passage/stem/ch만 전달하여 풀게 하고, `node cross-blind.js --verify`로 원본 정답과 자동 대조했다.

| 파일 | 일치 | 불일치 문항 |
|---|---|---|
| 단어.json | **20/20 PASS** | 없음 |
| 워크북.json | **20/20 PASS** | 없음 |
| 퀴즈.json | **20/20 PASS** | 없음 |

3종 전부 cross-blind 완전 일치. 불일치 0건.

**퀴즈.json 재검증 (2026-09-06, 재조립 후 blind 리셋 대응):**
- Self-blind(퀴즈.blind.json): needsAgent 9건(Q8~14 내용일치/주제/제목/함축/지칭 + Q17 어형변환 + Q20 조건영작) + Q19 오기록 1건을 정답 가리고 전수 재풀이 → **20/20 일치, 불일치 0건**. needsAgent 0, pending 0.
- Cross-blind(퀴즈.cross-blind.json): 새로 바뀐 Q17(어형변환 'has')·Q20(조건영작) 독립 재풀이 갱신 → 정답 일치 유지, 20/20.
- 이전 Q19 self-blind 오기록(auto-solver가 빈칸 뒤 문장까지 통째로 긁어 myAnswer가 wa보다 길어 match:false였던 것)은 정확한 8단어 배열로 정정 → match:true.

## STEP D: 적대적 공격 (Adversarial)

각 20문항을 공격자 관점으로 재검토했고, `validate/check-cross-leak.py`로 문항 간 정답 노출을 기계적으로 재확인했다. 세 파일 모두 **같은구역(same-section) 노출 0건**으로 하드 게이트는 PASS이지만, 만점짜리 스캔은 아니다 — 아래 발견 사항은 잭이 검토해야 하는 실제 이슈다.

### 공통 구조적 원인 (3종 전부 해당)
올림포스고급영미비문학 1강 1번 원문이 약 230단어로 짧고, 부교재 규칙상 모든 mc 문항이 fullPassage를 통째로 보여줘야 하므로(발췌 금지), 한 문항의 정답 단어/구절이 다른 19문항의 지문에 평문으로 그대로 나타나는 게 구조적으로 불가피하다. check-cross-leak.py는 이를 "다른구역(우연)"으로 분류해 차단하지 않지만, 실제 학생 입장에서는 답이 보이는 것과 같다.

- 단어.json: 다른구역 노출 108건
- 워크북.json: 다른구역 노출 103건
- 퀴즈.json: 다른구역 노출 123건

### 퀴즈.json 재평가 (2026-09-06) — HIGH 0건으로 하향

이전 검수는 서술형 4문항의 원문 문장 노출을 HIGH로 표기했으나, 재조립 후 재검수에서 **HIGH 0건 / MEDIUM 3건 / LOW 2건**으로 재분류했다. 근거:
- `check-cross-leak.py` 재실행: **같은구역(same-section) 0건, 다른구역(우연) 117건, 게이트 exit 0 [PASS]**.
- jacob 정책(`feedback_no_cross_question_answer_leak.md`): "같은구역 0건 하드 / 어형변환·짧은지문 gap없음 = 다른구역 수용". 원문 약 230단어 + 부교재 fullPassage 통째 노출 규칙상 정답 구/문장이 타 문항 지문에 등장하는 것은 구조적으로 불가피하며 배포 차단 대상 아님.
- 각 서술형은 자기 지문 내에서는 정답이 `__________`로 빈칸 처리됨(자기구역 노출 0).
- 이번 재조립에서 Q17이 조건영작 → **어형변환('has')**으로 교체되어 전사 가능한 완전문장 서술형 수가 4→ (16·18·19·20) 유지되나 어형변환 1문항 추가로 완화 방향.

**남은 MEDIUM(잭 판단용, 차단 아님):** Q18(6점·12단어 완전문장), Q20(도입 문장), Q19(어순배열 완전문장)은 정답 문장이 타 문항 지문에 그대로 보여 문법 없이 전사로 풀 여지 존재. 짧은 지문 섹션에서 완전문장 조건영작/어순배열 비중을 더 줄일지는 잭 검토 권고(즉시 재출제 불요). Q16은 6단어 절 단위로 LOW.

**N7 크로스파일 중복(워크북↔퀴즈):** 동일 wa/overlay.blank 0건 확인(PASS). Q17은 양쪽 어형변환이나 대상 단어 lacking(lack) vs has(have)로 상이.

### MED — 3종 공통 (단일 구/절 단위 노출)
- 단어.json Q19: 빈칸 정답 "lost through translation"이 13개 문항 지문에 그대로 노출
- 워크북.json Q11: 빈칸 정답 "closely related to words"가 13개 문항 지문에 노출
- 워크북.json Q20: 조건영작 정답 문장 "Each country creates its literature with its own language"가 17개 문항 지문에 그대로 노출 (구조상 퀴즈.json의 HIGH 사례와 동일 패턴이나, 워크북은 서술형 1문항만 해당되어 상대적으로 영향 범위가 작음)
- 퀴즈.json Q7, Q15: 빈칸 정답 구절이 각각 17곳, 16곳에 노출

### LOW — 참고용
- 단어.json: "manifestation"이 Q3(조합형)·Q8(빈칸)·Q11(동의어) 3문항에서 반복 타깃 — 오답 유출은 아니고 20문항 내 어휘 커버리지가 다소 좁아지는 정도
- 단어.json Q7/Q13 "faithful", 퀴즈.json Q6 "impossible for laymen" 등 단일 단어/구 단위 노출은 4지선다 안에서 소거 난이도를 살짝 낮추는 정도로 영향 제한적

### 그 외 확인 사항 (이상 없음)
- 어법 오류 지점(워크북 1-4번, 퀴즈 1-3·17번) 문법적으로 전부 명확·단일 정답 확인
- 조건영작/어순배열 [조건] 단어 목록 ↔ wa 토큰 수·구성 전부 일치 (S-COND-WORD-MATCH 위반 없음)
- stem 단어수 조건 ↔ wa 단어수 전부 일치 (S-WORDCOUNT-MISMATCH 없음)
- 3종 전부 배점 정확히 100점, 난이도별 문항수(쉬움5·보통10·어려움5) 스키마 정확히 일치
- 정답 번호 분포 3종 모두 최대 5개 이하, 연속 동일 정답 최대 2개 이하로 규정 내
- 5지선다·더미 선지·미완결 선지(C3/C4/C5/S-CH-TRUNCATED) 없음
- 내용일치/불일치·T-F·주제/제목 문항 오답 전부 지문 근거로 명확히 반박 가능(뻔한 소거형 아님)

## 결론
- Blind/Cross-blind: 3종 전부 20/20 완전 일치, 불일치 0건. 퀴즈.json은 재조립으로 리셋된 self-blind를 2026-09-06 전수 재풀이하여 20/20 복구(needsAgent 0, pending 0), Q19 오기록 정정.
- Adversarial(퀴즈.json 재평가 2026-09-06): **HIGH 0건**, MEDIUM 3건(Q18·20·19 완전문장 서술형 다른구역 노출), LOW 2건(Q16 절 단위 + FILE-LEVEL 구조적). N7 워크북↔퀴즈 중복 0건, Q17 type='서술형 — 어형변환' 확인.
- validate.js(퀴즈.json): **[PASS]**, exit 0. S급 차단 0건, B급 경고 2건(Q5·Q20 passage 앞부분 — 마커/빈칸이 지문 첫 문장에 놓여 발생하는 비차단 경고).
- 게이트: check-cross-leak.py 같은구역 0건(exit 0 PASS). 다른구역 117건은 짧은 지문 구조상 불가피, jacob 정책상 수용.
- 이전 검수의 HIGH 4건은 짧은 지문(230단어)+부교재 fullPassage 규칙상 구조적으로 불가피한 다른구역 노출이며 게이트·정책상 배포 차단 대상이 아니라 판단하여 MEDIUM/LOW로 재분류함. 완전문장 조건영작/어순배열 비중 축소는 잭 검토 권고(차단 아님).
