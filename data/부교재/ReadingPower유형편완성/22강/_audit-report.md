# 감사 리포트 — ReadingPower유형편완성 22강 전체 (단어/워크북/퀴즈)

**출제일**: 2026-11-25
**출제 모델**: claude-fable-5 (직접 출제) / cross-blind: 반대 모델 에이전트
**검증 완료**: SOP STEP 0~7 (원문복원 대조 · validate · blind · cross-blind · adversarial)

## 1. 기본 정보
- 지문: Unit 22 장문(2) — 몰래 책 읽은 William / 성자와 동행자 / 질투하는 Elaine
- 지문 출처: EBS Reading Power 유형편 [완성] Unit 22 (Example 01-03, Practice 01-03, Practice 04-06)
- 원문 복원: typeC 변형문제 지문의 (A)/(B) 한글 밑줄 문장을 정답지 영작 정답으로 치환 + 정답지 14)~16) 교정 원문 교차 대조 (OCR 분할 단어 전수 복원 확인)
- fullPassage: 905단어 / 61문장 (3지문 합본, \n\n 구분)

## 2. 테스트별 결과

| 테스트 | 문항 | 총점 | 쉬움/보통/어려움 | ans 분포(mc) | validate | blind | cross-blind | adversarial |
|---|---|---|---|---|---|---|---|---|
| 단어 | 20 | 100 | 5/10/5 | {1: 5, 2: 5, 3: 4, 4: 4} | PASS (S/A 0) | 20/20 | 20/20 | HIGH 0 |
| 워크북 | 20 | 100 | 5/10/5 | {1: 4, 2: 4, 3: 4, 4: 4} | PASS (S/A 0) | 20/20 | 20/20 | HIGH 0 |
| 퀴즈 | 20 | 100 | 5/10/5 | {1: 4, 2: 5, 3: 3, 4: 3} | PASS (S/A 0) | 20/20 | 20/20 | HIGH 0 |

## 3. 게이트 상세
- validate: 6종 전부 [PASS], S급·A급 0건 (B급 경고는 EX-3 대괄호 렌더 포맷 오탐·SCHEMA-DET-PATTERN 권장 등 비차단)
- blind: 자동+에이전트 풀이 20/20 일치 (자동 휴리스틱의 어포스트로피 토큰화 오탐은 실풀이로 교체)
- cross-blind: 반대 모델 독립 풀이 20/20 일치 (cross-blind.js --verify PASS)
- adversarial: 파일당 4건 low 노트, HIGH 0건 — 재출제 대상 없음
- 크로스파일 중복: 단어↔워크북↔퀴즈 wa/blank/정답 전수 대조 — 중복 0건

## 4. 특이사항
- 어형변환 travelled: 영국식 원문 철자 + 미국식 traveled 둘 다 accept (22강 단어 18번)
