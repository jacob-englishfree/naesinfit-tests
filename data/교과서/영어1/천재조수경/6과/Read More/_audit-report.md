# 천재조수경 테스트 검수 증적 리포트

**출판사**: 영어1
**단원**: 천재조수경

## 단어
- 문항: 20문항 / 100점
- validate: PASS (S급 0건)
- blind: ✅ 20/20
- cross-blind: ✅ 20/20
- adversarial: ✅ HIGH 0건

## 워크북
- 문항: 20문항 / 100점
- validate: PASS (S급 0건)
- blind: ✅ 20/20
- cross-blind: ✅ 20/20
- adversarial: ✅ HIGH 0건

## 퀴즈 (예상문제) — 2026-08-31 현행 스펙 전면 재출제
- 파트: 6과 / Read More ("The Science Behind the Mona Lisa")
- 문항: 20문항 / 100점 (쉬움5×4=20 / 보통10×5=50 / 어려움5×6=30)
- ans 분포: {1:4, 2:4, 3:4, 4:3}, 3연속 없음
- validate: PASS (S급/A급 0건, [B] P2 경고 4건 = 발췌 시작부 오버레이 마커/빈칸 아티팩트, 비차단)
- blind: ✅ 20/20
- cross-blind: ✅ 20/20 (Sonnet 독립 풀이 일치)
- adversarial: ✅ HIGH 0건 (Q18 전치사 후치 대체배열 → accept 등록, Q19 콤마 유무/부사 위치 4배열 → accept 등록으로 해소)
- 재출제 사유: 구버전(2026-06-13) Q16~18 찾기/핵심단어 서술형(현행 금지) + Q10 S-CHOICE-NOT-IN-PASSAGE 위반으로 FAIL → 현행 예상문제 스펙(조건영작/어법고쳐쓰기/어순배열, 내용일치 발췌 내 선지)으로 20문항 전면 재출제
- 워크북과 cross-leak 회피: 상이한 문법포인트·wa·빈칸 사용 확인

---
생성일: 2026-05-23 (단어/워크북) · 2026-08-31 (퀴즈 재출제)
검수 모델: Claude Opus 4.6 (단어/워크북) · Claude Opus 4.8 출제 + Claude Sonnet 교차검증 (퀴즈)