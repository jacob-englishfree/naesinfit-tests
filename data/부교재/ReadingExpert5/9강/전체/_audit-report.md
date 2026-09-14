# 증적 리포트 (STEP 7) — Reading Expert 5, Unit 9 "Whistled Languages" 전체

- 교재: Reading Expert 5 / 9강 U09 Reading 1 "Whistled Languages"
- 지문: fullPassage 20문장 / 373단어
- 원문 대조: `원문,참고자료 다모으기(내신핏)/ReadingExpert5_원문/U09_Reading1_Whistled_Languages.txt` (373단어) ↔ `_passages/전체.json` fullPassage(373단어) **정규화 100% 일치 (EQUAL)**
- 재검증 세션: 2026-09-13 (Opus 4.8), 이전 세션(2026-09-04 제작) 결과 맹신하지 않고 60문항 전량 재풀이
- 대상: 단어.json / 워크북.json / 퀴즈.json (3파일)

## 종합 결과

| 테스트 | validate | 문항/총점 | 배점분포(쉬움/보통/어려움) | 블라인드 일치 | 배포 판정 |
|---|---|---|---|---|---|
| 단어 | **PASS** (B경고 7) | 20 / 100 | 5 / 10 / 5 | 20/20 | GREEN |
| 워크북 | **PASS** (B경고 4) | 20 / 100 | 5 / 10 / 5 | 20/20 | GREEN |
| 퀴즈 | **PASS** (B경고 3) | 20 / 100 | 5 / 10 / 5 | 20/20 | GREEN |

- N7 워크북↔예상문제 정답중복: **0건 (PASS)**
- 정답 오류·복수정답: **0건**
- 증적 4종: response / json / blind / cross-blind / adversarial 전부 존재, adversarial HIGH **0건**

## Q17 유형 교체 이력 (2026-09-13, 차단 해소)

- 기존 퀴즈 Q17 = `서술형 — 어법고쳐쓰기` → **validate S급 FAIL (TW-TYPE / 규칙 24 S-QUIZ-WRITTEN-SAFE-TYPE)**. 예상문제 서술형은 조건영작/어순배열/어형변환만 허용.
- 조치: **`서술형 — 어형변환`으로 교체.** 정답 wa=`called` 보존.
  - passage: 3문장 발췌(원문 13~15번째 문장) + `a whistled language __________ (call) Silbo Gomero`
  - stem: "다음 글의 빈칸에 괄호 안의 단어를 알맞은 형태로 바꿔 쓰시오. (영어로)"
  - 정답 미노출: 발췌 내 `called`/`call`은 빈칸 마커에만 존재 (누출 0)
- 재검증: validate 퀴즈 **PASS** (TW-TYPE 소멸), 블라인드 재풀이 답 `called` = wa 일치, N7 재실행 0건("called"는 워크북 답과 미중복).

---

세부 항목별 리포트는 동일 폴더의 `_audit-report_단어.md`, `_audit-report_워크북.md`, `_audit-report_퀴즈.md` 참조.
