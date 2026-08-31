# 퀴즈(예상문제) 검수 증적 — 올림포스9대변별유형 2025 QN23-24 2번

- 지문: The Assumptions Behind Overtourism (fullPassage 10문장, 미수정)
- 배점: 100점 (쉬움 5×4=20 / 보통 10×5=50 / 어려움 5×6=30)
- ans 분포: {1:3, 2:4, 3:4, 4:4} — 최대 동일 5 이하, 3연속 없음

## STEP A — validate
`[PASS] 퀴즈.json (3 warnings)` — S/A급 0건. 잔여는 [B] P2 경고 3건(Q4·Q5 첫 어절 마커, Q20 선두 빈칸 — 정상 오버레이 산물, 비차단).

## STEP B — self-blind (독립 에이전트, 정답 미열람)
20/20 일치 (ALL_MATCH). 어법 3문항은 마커 원문 대조로 유일 오답 확인.

## STEP C — cross-blind (Sonnet, 반대 인스턴스)
`[PASS] 20/20 cross-blind 일치`.

## STEP D — adversarial
HIGH 0 / MEDIUM 0 / LOW 1. LOW=Q18 이론적 대체어순("...to be full of people for a place") — 부자연스럽고 한국어 단서와 불일치, self/cross 두 솔버 모두 표준형만 산출 → 실분쟁 위험 미미.

## cross-leak 회피 (단어/워크북 대비)
- 워크북 어법 정답(rests·framed·have·become·does) 전면 회피 → 퀴즈 어법은 treated·to be·What(관계사)·described 등 신규 포인트.
- 단어 소비 어휘(shifting/limitless/absolute/destructions/openings 등) 재사용 안 함 → 부적절 어휘 정답은 full·victims(신규).
- 워크북 조건영작(places can be full of tourists)·찾기 정답과 중복 없음.

## 유형 배치
순서/삽입 없음(단일지문) → 어법 3 → 어휘/빈칸 → 일치/주제/제목/함축/지칭 → 서술형 LAST(조건영작·어법고쳐쓰기·어순배열).

완료: validate PASS · blind 20/20 · cross-blind 20/20 · adversarial HIGH 0.
