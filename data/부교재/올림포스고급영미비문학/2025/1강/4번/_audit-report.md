# 교차검증(cross-blind) + 적대검수 리포트

대상: 올림포스고급영미비문학 / 2025 / 1강 / 4번 (소재: Disney Sleeping Beauty)
검증 방식: 반대 모델(Sonnet) 독립 solver — 정답 제거본(cross-prompt.json)만 보고 20문항 풀이 → 원본 대조 + 적대공격
날짜: 2026-09-06 (Q17 어형변환 전환 후 재검증)

---

## 1. Cross-blind 일치율 (독립 solver vs 원본 정답)

| 테스트 | 일치 | 불일치 문항 |
|--------|------|-------------|
| 단어   | 20/20 PASS | 없음 |
| 워크북 | 20/20 PASS | 없음 |
| 퀴즈   | 20/20 PASS | 없음 |

**총 60/60 일치.** 정답을 보지 않은 반대 모델이 본문 단서만으로 전 문항 동일 정답 도출 → 정답이 억지가 아니라 본문에서 실제로 도출 가능함을 확인.

**self-blind(퀴즈.blind.json) 재풀이:** 20/20 일치 (autoSolved 20 / needsAgent 0 / matched 20 / mismatched 0 / pending 0). 재조립 후 리셋됐던 needsAgent 8문항(내용일치 8·9·10, 주제 11, 제목 12, 함축 13, 지칭 14, 어형변환 17)을 정답 비공개로 독립 재풀이 후 대조 전건 일치. auto-solver가 빈칸 이후 전체 문장을 잘못 캡처해 mismatch로 잡혔던 Q20(조건영작)은 정답 'a good fairy reduces the punishment'로 정정 → 일치. Q17 cross-blind도 어형변환 기준으로 재풀이(pick 'manifests') 갱신.

## 2. 공식 게이트 결과 (참고 실측)

- `validate.js`: 단어 PASS(5 warn), 워크북 PASS(1 warn), 퀴즈 PASS(0 warn)
- `check-cross-leak.py`: **같은구역 노출 3종 모두 0건** (하드 기준 통과)
  - 다른구역(우연) 노출: 단어 107건 / 워크북 107건 / 퀴즈 139건 → 게이트는 "검토 권고"로 수용 처리

## 3. Adversarial 발견 사항

### 다른구역 cross-question 노출 (구조적, 게이트 수용 범위)
- 단어/워크북/퀴즈 모두 단일 짧은 지문(Sleeping Beauty)을 20문항에 통째 오버레이하고 해당 문항만 국소 변형하는 구조.
- 결과: 한 문항의 빈칸/변환/영작 정답이 **다른 문항의 passage 원문**에 살아있음.
  - 워크북 Q10(unconsciousness)·Q11(removing all dangerous things)·Q17(awakens)·Q20(the two monarchs are overprotecting their beloved daughter)
  - 퀴즈 Q6·Q7·Q15(빈칸) 및 Q16·Q17·Q18·Q19·Q20(서술형 wa 전체 문장)
- **판정**: jacob 확정 규칙(`feedback_no_cross_question_answer_leak`)은 "같은구역 0건 하드, 다른구역·어형변환·짧은지문은 수용". 같은구역 0건이므로 게이트상 **PASS**. 다만 학생이 문항 간 passage를 대조하면 일부 정답을 베낄 여지는 구조적으로 남음 → 부교재 단일지문 오버레이 방식의 공통 특성. adversarial.json에서는 이 다른구역 노출을 전부 **MED**(게이트 PASS, 배포 차단 아님)로 분류.

### 유형 규칙 — Q17 어형변환 전환으로 해소 (이전 MED → 해결)
- 퀴즈 Q17 type = **"서술형 — 어형변환"** (이전 "서술형 — 어법고쳐쓰기"에서 변경). passage는 3문장 발췌 + 빈칸(_____), 괄호 안 (manifest)를 3인칭 단수 현재형 manifests로 변환. CLAUDE.md 규칙24(S-QUIZ-WRITTEN-SAFE-TYPE)의 예상문제 서술형 허용 유형(조건영작/어순배열/어형변환)에 **포함** → 이전에 지적됐던 유형 규칙 위반 우려 **해소**.
- 워크북 중복 점검: 퀴즈 Q17('manifests')·Q20('a good fairy reduces the punishment') wa는 워크북 서술형 wa(awakens / A portal / the three good fairies / the two monarchs are overprotecting their beloved daughter)와 **중복 없음**.

### LOW
- 워크북 Q6 선지 원문 "a evil fairy" → 문맥상 "an evil"이 관사 정확(단, 어휘 부적절 찾기 정답이 ②good이라 채점엔 무영향).
- 워크북 어법/오류찾기 1·3·14 세 문항이 주어-동사 수일치로 편중.

### 이상 없음 확인
- 정답 2개 가능 / 뻔한 오답 소거 / 문법(본문·stem) 오류 / 한국어 오역 / 서술형 단어수 불일치 / 접두사형 기계적 반의어: **3종 전부 미발견.**

## 4. 결론

- cross-blind 60/60 일치 + self-blind(퀴즈) 20/20 일치 + 3종 공식 게이트 PASS.
- adversarial **HIGH 0건**. 이전 리포트에서 HIGH로 잡혔던 cross-question leak 13건은 실측(check-cross-leak.py: 같은구역 0건 / 다른구역 139건, PASS) + jacob 확정 규칙에 따라 전부 **MED**(다른구역, 게이트 수용)로 재분류.
- 퀴즈 Q17 유형이 어형변환으로 확정되어 이전 (b) 항목(어법고쳐쓰기 허용 여부) **해소**.
- 배포 차단급(하드) 결함 0건. jacob 판단 필요 항목 1건: 다른구역 노출을 더 줄이려면 문항별 발췌구간 분산 재출제(선택, 하드 차단 아님).
