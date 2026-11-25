# 증적 리포트 — ReadingExpert5 15강

## Reading1 (Athens & Sparta, 고대 그리스 정치) — 워크북

- 파일: `data/부교재/ReadingExpert5/15강/Reading1/워크북.json`
- 문항: 20문항 / 총점 100점 (쉬움 5×4=20, 보통 10×5=50, 어려움 5×6=30)
- histKey: `workbooktest_readingexpert5_15_reading1__v6`
- 작성 모델: Opus (출제) / Sonnet (cross-blind) — Tier 2 교차검증

### 유형 분포
어법 4 (Q1~4) · 어휘(문맥부적절) 2 (Q5~6) · 내용이해 T/F 3 (Q7~9) · 빈칸추론 2 (Q10~11) · 내용일치/불일치 2 (Q12~13) · 오류찾기 1 (Q14) · 서술형 찾기 2 (Q15~16) · 어형변환 1 (Q17) · 주제/요지 2 (Q18~19) · 조건영작 1 (Q20)

### 정답 분포
mc 16문항 {1:4, 2:4, 3:4, 4:4} — 균등, 한 번호 5개 초과 없음, 3연속 없음.

### 검증 결과
- STEP 2 validate: **PASS** (S/A급 0, 경고 2건 — Q10·Q11 빈칸 오답 질 권고로 비차단)
- STEP 3 자체 블라인드: **20/20 일치**
- Tier 2 Cross-blind (Sonnet, 반대모델): **20/20 일치**
- STEP 5 적대적 공격: **HIGH 0건** (LOW 4 / INFO 4, 전부 유지 판정)

### 배점 분포 (난이도)
- 쉬움(4점): Q1, Q2, Q7, Q12, Q18 = 5문항 20점
- 보통(5점): Q3, Q5, Q6, Q8, Q9, Q10, Q13, Q15, Q17, Q19 = 10문항 50점
- 어려움(6점): Q4, Q11, Q14, Q16, Q20 = 5문항 30점

### 유형 규칙 위반
없음. 금지 유형(심경/도표/안내문/광고문) 미사용. 어법·오류찾기 각 1개 오류, 어휘 각 1개 부적절. 서술형 wa 단어수 조건 일치.

### cross-leak (단어.json 분리)
유형·접근각 완전 분리. 겹치는 wa/overlay.blank 없음.
- 단어: ruled·known·laws·masters·influence·legal and political rights·slave rebellion
- 워크북: Ephors·by lot·formed·election·In contrast to·competed with each other for power

### 수정 이력
- Q1·Q14 ① 마커를 witnessed→competed로 이동 (P2 거짓양성 해소)
- Q20 조건영작 accept에 유효 어순 변형 1종 추가 (자동채점 공정성)
