# 교차검증(cross-blind) + 적대검수(adversarial) 감사 리포트

대상: `data/부교재/올림포스고급영미비문학/2025/1강/3번/` (단어.json / 워크북.json / 퀴즈.json)
검증자: Sonnet (독립 solver, 반대 모델 — Opus 출제물 검증)

## STEP C — Cross-Blind 결과 (passage·stem·ch만 보고 20문항 독립 풀이)

| 파일 | 일치율 | 불일치 문항 |
|---|---|---|
| 단어.json | 20/20 | 없음 |
| 워크북.json | 20/20 | 없음 |
| 퀴즈.json | 20/20 | 없음 |

`node cross-blind.js --verify` 3종 전부 `[PASS]` (정답/wa 재현 완전 일치). 자동채점(mc ans) + 서술형 wa 문자열까지 모두 원 출제 정답과 동일하게 도출됨 — 문항 자체의 정답 논리는 정상.

## STEP D — 적대공격 결과 (정답노출·복수정답·뻔한오답·crossfile 등)

| 파일 | totalIssues | HIGH | MED | LOW |
|---|---|---|---|---|
| 단어.json | 1 | 0 | 0 | 1 |
| 워크북.json | 5 | 2 | 2 | 1 |
| 퀴즈.json (재조립 후) | 2 | 0 | 1 | 1 |

> **퀴즈 재검수 갱신 (재조립 후):** 이전 퀴즈 HIGH 3건은 재출제로 전부 해소됨.
> - Q17: `서술형 — 어법고쳐쓰기`(유형위반) → `서술형 — 어형변환`(wa=`bringing`, 화이트리스트 허용)으로 교체.
> - Q18: 워크북 Q18과 wa 중복 → 워크북 Q18이 mc `주제/요지`로 바뀌어 중복 해소(퀴즈 Q18 조건영작 유지).
> - Q20: 워크북 Q20(`you never forget how to ride a bicycle`)과 완전중복 → 퀴즈 Q20 wa=`Concert pianists spend much more of their lifetimes practising than they do playing concerts`(14단어)로 재출제, 다른 문장·다른 답. **N7 미저촉 확인.**
> - 잔여: **MED 1건**(Q17 `bringing`이 워크북 Q14 오류찾기 정답단어와 동일 문장·동일 단어 — 재출제 권장, 하드블록 아님), **LOW 1건**(Q15 `look ahead not underneath`가 단어 Q19와 중복).
> - blind 20/20, cross-blind Q17/Q20 재풀이 일치, validate `[PASS]`(B급 경고 2건: Q20 빈칸 앞부분 미매칭=정상, Q6 오답질 권장).

### HIGH (배포 전 반드시 재출제/수정 필요)

1. **워크북 Q18 ≡ 퀴즈 Q18 완전 중복** — 한국어 stem·[조건] 단어목록·wa(`we make our time offstage best serve our briefer time onstage`)가 글자 하나 안 틀리고 100% 동일. N7(워크북↔퀴즈 크로스파일 동일 wa 금지) 정면 위반.
2. **워크북 Q20 ≡ 퀴즈 Q20 완전 중복** — 한국어 stem·[조건]·wa(`you never forget how to ride a bicycle`) 100% 동일. 1과 동일한 유형의 사고, 같은 강에서 2건 발생.
3. **퀴즈 Q17 유형 위반** — `type: "서술형 — 어법고쳐쓰기"`는 S-QUIZ-WRITTEN-SAFE-TYPE 화이트리스트(퀴즈 서술형은 조건영작/어순배열/어형변환만 허용)에 없는 유형. 규정상 즉시 배제 대상.

### MED

- 워크북 Q14(오류찾기 정답 bring→bringing) ↔ 퀴즈 Q17(어법고쳐쓰기 wa=bringing): 형식만 다를 뿐 같은 문장·같은 정답단어 재사용.
- 워크북 Q17: passage 필드(에세이 도입부 3문장)가 실제 빈칸 문장("Onstage, accept the situation without wishing...")과 무관한 위치에서 발췌됨 — 어형변환 발췌 규칙 상 문맥 힌트 역할을 못 함.

### LOW

- 워크북 Q15: stem "(1단어)" 조건인데 accept 배열에 2단어 "a perfectionist" 포함(모순).
- 단어 Q19 ↔ 퀴즈 Q15: 같은 빈칸 위치·같은 정답 표현("look ahead not underneath") 재사용 — 학생이 단어 테스트를 먼저 풀면 퀴즈 정답을 유추 가능.

## 결론

- 정답 로직(ans/wa)은 3종 모두 20/20 정확 — cross-blind 관점에서는 문제 없음.
- **[갱신] 퀴즈 재조립 후:** 이전 퀴즈 HIGH 3건(Q18/Q20 워크북 중복, Q17 유형위반)은 재출제로 전부 해소. 현재 퀴즈 HIGH 0건. blind 20/20, cross-blind Q17/Q20 재풀이 일치, validate [PASS].
- **잔여 권고(비차단):** 퀴즈 Q17(`bringing`)이 워크북 Q14 오류찾기 정답단어와 동일 문장·동일 단어 — MED. 완전 분리하려면 Q17을 다른 문장의 어형변환으로 재출제 권장.
- 워크북 자체 이슈(HIGH 2·MED 2·LOW 1)는 별도 — 이 갱신은 퀴즈 섹션만 반영. "완벽" 아님 — 발견분 그대로 보고.
