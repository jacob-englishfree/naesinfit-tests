# 증적 리포트 — 수능특강Light 영어 10강 6번 (단어/워크북/퀴즈)

- 지문: Ex6 "The idea that we are living moments of more..." (대면 vs 온라인 소통과 정서적 유대)
- fullPassage: 6문장 / 146단어 (`_passages/6번.json`, PDF 원문 대조 일치)
- 대상 학생/주차: 이지호 W3 (2차 예상문제 화요일 마감)
- 출제: Opus 4.8 / 교차검증: Sonnet(반대모델)

## 게이트 결과 (STEP 2~6)

| 테스트 | validate | 자체 blind | cross-blind(Sonnet) | adversarial HIGH | 문항/배점 |
|--------|----------|-----------|---------------------|------------------|-----------|
| 단어   | PASS (7 B급 경고) | 20/20 | 20/20 | 0 | 20문항 100점 |
| 워크북 | PASS | 20/20 | 20/20 | 0 | 20문항 100점 |
| 퀴즈   | PASS | 20/20 | 20/20 | 0 | 20문항 100점 |

- S/A급 차단 규칙 위반 0건. 잔여 경고는 전부 B급 자문(EX-3 abc 대괄호 렌더 오탐, P2 커스텀 passage 대조) — 비차단.
- ans 분포: 동일번호 최대 5개, 3연속 없음.

## 크로스파일 중복 (N7)
- `check-wb-quiz-leak.py 6번` → **PASS (워크북↔예상문제 정답 중복 0건)**
- 기존 10강 1~4번과 서술형·빈칸 정답 크로스 중복 0쌍 (지문 상이).

## 적대적 검수 요약
- 단어: LOW 4 (Q19 관용구 빈칸 MED 1 → 대조 문맥 단서 충분, 복수정답 없음)
- 워크북: LOW 3 (Q16/Q17 찾기형 단복수 변형 위험은 NORM 자동정규화로 무해)
- 퀴즈: LOW 유지, Q18 조건영작 대체 어순 accept 보강 완료

## 증적 파일
- 각 유형별 `.response.json` / `.json` / `.blind.json` / `.cross-blind.json` / `.adversarial.json` 존재 확인.

## 배포 상태
- ⛔ 배포·test-deploy sections 추가·이지호 subKeys 배정 = 총괄 대기.
