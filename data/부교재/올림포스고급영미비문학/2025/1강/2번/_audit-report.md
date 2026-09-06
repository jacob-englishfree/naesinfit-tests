# 교차검증 + 적대검수 리포트 — 올림포스고급영미비문학 1강 2번 (Field 1, Theme 2)

- 검증자: Sonnet (독립 solver, Opus 출제물 반대모델 교차검증)
- 대상: 단어.json / 워크북.json / 퀴즈.json (각 20문항)
- 방식: cross-blind.js --prep 으로 정답 제거된 cross-prompt.json만 보고 20문항 전부 직접 풀이 → --verify로 실제 정답과 대조. 이후 정답 공개본을 다시 읽어 STEP D 적대공격 수행.

## STEP C 결과 — 3종 cross-blind 일치율

| 파일 | 일치 | 불일치 |
|---|---|---|
| 단어.json | 20/20 | 없음 |
| 워크북.json | 20/20 | 없음 |
| 퀴즈.json | 20/20 | 없음 |

`node cross-blind.js --verify` 3종 전부 `[PASS] 20/20 cross-blind 일치` 확인됨. 불일치 문항 0건.

## STEP D 적대공격 결과

### 어법/어휘 단일오류 검증 (2개 정답 가능성)
워크북·퀴즈의 모든 어법(문법오류 1개 주입) 및 부적절 어휘(마커 1개 오용) 문항을 원문과 대조하여, 표시된 정답 마커 외 나머지 3개 마커가 전부 원문과 일치함을 확인. 2개 정답 가능 사례 0건.
- 워크북 Q1~4, 6, 14 / 퀴즈 Q1~5: 각 문항 정답 마커 외 3개 전부 원문 그대로 — 복수정답 위험 없음.

### 정답 노출 (찾기형 제외)
- 단어 Q17(understands)/Q18(closer), 워크북 Q17(seen)/Q20(they seem to be conveyed directly to us), 퀴즈 Q16~20(조건영작/어형변환/어순배열) — 해당 문항 **자기 passage**(어형변환 Q17은 2~4문장 발췌 + 빈칸, 나머지는 빈칸 처리) 안에는 wa가 노출되지 않음. 찾기형인 워크북 Q15("seeing is believing")·Q16("This Is Not a Pipe")는 규칙상 노출 허용 유형.
- `validate/check-cross-leak.py` 3종 전부 실행 → **같은구역(같은 발췌 경계 안) 노출 0건**, PASS. "다른구역(우연) 노출" 106~150건은 부교재 규칙(passage=fullPassage 통째)상 구조적으로 불가피한 패턴(예: 단어 Q17 정답 "understands"가 fullPassage를 그대로 쓰는 다른 MC 문항들의 passage에 등장) — 기존에도 이 패턴은 "다른구역 수용" 기준으로 처리되어온 것과 동일. 심각도 LOW, 별도 조치 불요.

### 뻔한 오답만 있는지 (C7)
내용일치/불일치·주제/제목·함축의미·지칭추론 문항의 오답 3개를 원문과 대조 — 전부 원문 특정 부분과 모순(반대 의미)되는 구체적 오답이며, "본문에서 다루지 않음/관련 없음" 류의 메타서술형 오답 0건 확인 (S-META-CHOICE 해당 없음).

### 모호한 stem
전 문항 stem이 "가장 적절한/틀린/일치하는" 형태로 명확. 애매한 stem 0건.

### 문법오류(passage 자체 오문)
어법 유형은 의도적으로 1개 오류를 주입하는 설계이므로 정상. 그 외 서술형/mc passage 문장 구조 검토 결과 의도치 않은 오문 0건.

### passage 무관 여부
20문항 전부 fullPassage(또는 어형변환 발췌/영영풀이 예외)에서 직접 도출되는 내용으로 passage와 무관한 문항 0건.

### 서술형 단어수 조건 vs wa 일치
| 문항 | 조건 단어 수 | wa 단어 수 | 결과 |
|---|---|---|---|
| 워크북 Q15 | 3단어 | seeing/is/believing = 3 | 일치 |
| 워크북 Q16 | 5단어 | This/Is/Not/a/Pipe = 5 | 일치 |
| 워크북 Q20 | 8단어(be,conveyed,directly,seem,they,to,to,us) | 8 | 일치 |
| 퀴즈 Q16 | 7단어 | 7 | 일치 |
| 퀴즈 Q18 | 7단어 | 7 | 일치 |
| 퀴즈 Q19 | 12단어 | 12 | 일치 |
| 퀴즈 Q20 | 6단어 | 6 | 일치 |
| 퀴즈 Q17 | 1단어(어형변환, (come)→형태변환) | comes(1) | 일치 |

불일치 0건. [조건]에 나열된 단어가 wa에 전부 포함되고 더미 단어도 없음(S-COND-WORD-MATCH/S-COND-REVERSE 해당 없음).

### 그 외 자동 게이트
`node validate/validate.js` 3종 전부 **PASS**(S급 0건). B등급 참고성 경고만 존재:
- 단어: EX-3(ABC 정답 단어가 지문 다른 곳에도 노출, Q1~3) 3건, P2(passage 앞부분 fullPassage 매칭 이슈, Q1/4/15/17) 4건
- 워크북: P2(Q17) 1건, Q6-WEAK-DISTRACTOR(Q10 오답이 지문에 없음—오히려 정상적 어휘 오답 설계) 1건
- 퀴즈: P2(Q1/4) 2건

전부 [B] 등급(구조적 참고사항)이며 S급 차단 없음. ABC형(단어 Q1~3)의 "정답 단어 지문 다른 곳 노출"은 (A)(B)(C) 조합형의 구조적 특성(정답 조합 3/4가 A 또는 B값을 공유)으로 실제 유출이 아님.

## 재검수 (2026-09-06) — 퀴즈 Q17 유형 변경 반영
- **배경**: 재조립(assemble) 과정에서 퀴즈.blind.json이 리셋되고 Q17 유형이 '서술형 — 어법고쳐쓰기'(밑줄 오류 고쳐쓰기)→'서술형 — 어형변환'((come) 알맞은 형태 쓰기)으로 변경됨.
- **메인 블라인드**: 미완이던 Q8~14(내용일치×3/주제/제목/함축/지칭) 7문항 독립 풀이 완료 → 정답 대조 20/20 일치(퀴즈.blind.json autoSolved=20, mismatched=0).
- **cross-blind**: 퀴즈.cross-prompt.json 재생성(Q17=어형변환 신버전) 후 Q17 재풀이('the particular kind of food that _____'의 단수 선행사 관계절 동사 → comes). `node cross-blind.js --verify` → **[PASS] 20/20**.
- **adversarial**: 구버전 'Q17 허용유형 아님' 이슈 무효 처리(어형변환은 S-QUIZ-WRITTEN-SAFE-TYPE 허용). Q17 wa='comes'는 워크북 Q17('seen')과 중복 없음, 단일 결정 정답, 자기 발췌 passage 내 미노출. **HIGH 0건**, 잔여 LOW 1건(cross-leak 다른구역, 구조적 수용).
- **validate**: `node validate/validate.js` → **[PASS]** (B등급 P2 경고 2건, S급 0건).

## 종합 결론
- cross-blind 3종 20/20 전부 일치, 불일치 문항 0건 (퀴즈 Q17 신버전 포함 재검증 완료).
- adversarial HIGH 이슈 0건.
- MED/LOW: cross-leak "다른구역" 노출(구조적, 기존 기준상 수용 범위) — 별도 재출제 불요.
- 배포 게이트(cross-blind + adversarial + validate) 전부 통과 상태.
