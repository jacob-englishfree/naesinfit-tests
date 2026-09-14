# 증적 리포트 — 수능특강Light 영어 10강 8번 (단어/워크북/퀴즈)

- 지문: Ex8 "When we switch from empathy to compassion..." (공감→연민 전환의 긍정적 변화)
- fullPassage: 10문장 / 158단어 (`_passages/8번.json`, PDF 원문 대조 일치)
- 대상 학생/주차: 이지호 W3 (2차 예상문제 화요일 마감)
- 출제: Opus 4.8 / 교차검증: Sonnet(반대모델)

## 게이트 결과 (STEP 2~6)

| 테스트 | validate | 자체 blind | cross-blind(Sonnet) | adversarial HIGH | 문항/배점 |
|--------|----------|-----------|---------------------|------------------|-----------|
| 단어   | PASS (7 B급 경고) | 20/20 | 20/20 | 0 | 20문항 100점 |
| 워크북 | PASS (3 B급 경고) | 20/20 | 20/20 | 0 | 20문항 100점 |
| 퀴즈   | PASS (1 B급 경고) | 20/20 | 20/20 | 0 | 20문항 100점 |

- S/A급 차단 규칙 위반 0건. 잔여 경고는 전부 B급 P2(마커/빈칸이 지문 앞 문장 위치) — 비차단.
- ans 분포: 동일번호 최대 5개, 3연속 없음.

## 크로스파일 중복 (N7)
- 최초 검사에서 **퀴즈 Q17(어형변환) 정답 'activated'가 워크북 Q17과 동일** → 적발.
- 조치: 워크북 유지, 퀴즈 Q17을 다른 문장·다른 문법포인트로 교체
  ("...our compassion connects us ... and ___ (strengthen) our social ties" → 정답 **strengthens**, connects와 병렬 + 주어 compassion 3인칭 단수 수일치).
- 재조립·재blind(20/20)·재adversarial(HIGH 0) 후 `check-wb-quiz-leak.py 8번` → **PASS (중복 0건)**.
- 기존 10강 1~4번과 서술형·빈칸 정답 크로스 중복 0쌍.

## 적대적 검수 요약
- 단어: LOW 3 (지문 대조로 정답 유일성 확정)
- 워크북: LOW 2 (Q10 concern 인접·Q16 따옴표 표기 → NORM 자동정규화로 무해)
- 퀴즈: 조건영작 [조건] 토큰 알파벳순 셔플로 S-WRITTEN-TOKEN-LEAK 해소, Q19 등위쌍 순서 accept 보강, Q20 내부 따옴표 문장 교체(채점 안전)

## 증적 파일
- 각 유형별 `.response.json` / `.json` / `.blind.json` / `.cross-blind.json` / `.adversarial.json` 존재 확인.

## 배포 상태
- ⛔ 배포·test-deploy sections 추가·이지호 subKeys 배정 = 총괄 대기.
