# 10강 검수 리포트

## 2번 단어
- 날짜: 2026-06-17
- 모델: opus-4.6
- 문항: 20문항 / 100점
- 배점: 쉬움5(4pt)=20 / 보통10(5pt)=50 / 어려움5(6pt)=30
- ans 분포: {1:4, 2:5, 3:4, 4:5}
- validate: PASS (B-level warnings 6건, S-level 0건)
- blind: 20/20 일치
- cross-blind: 20/20 일치
- adversarial: HIGH 0건, PASS
- 유형: ABC조합3/부적절어휘3/빈칸어휘3/동의어3/반의어2/다의어1/영영풀이1/어형변환2/빈칸문맥2
- 수정 이력: Q8 선지 교체(Q16 중복 해소: scavenger/herbivore/parasite → competitor/prey/forager), korean 필드 길이 보강(Q7/Q8/Q9/Q12)

## 10번 단어
- 날짜: 2026-06-17
- 모델: opus-4.6
- 문항: 20문항 / 100점
- 배점: 쉬움5(4pt)=20 / 보통10(5pt)=50 / 어려움5(6pt)=30
- ans 분포: {1:4, 2:5, 3:4, 4:5}
- validate: PASS (B-level 5건, S-level 0건)
- blind: 20/20 일치
- cross-blind: 20/20 일치
- adversarial: HIGH 0건, PASS
- 유형: ABC조합3/부적절어휘3/빈칸어휘3/동의어3/반의어2/다의어1/영영풀이1/어형변환2/빈칸문맥2
- fullPassage↔PDF 대조: 11문장 전부 일치 OK
- 수정 이력: D46 korean 8건 보강(Q7/Q8/Q9/Q10/Q11/Q12/Q19/Q20)

## 10번 워크북
- 날짜: 2026-06-17
- 모델: opus-4.6
- 문항: 20문항 / 100점
- 배점: 쉬움5(4pt)=20 / 보통10(5pt)=50 / 어려움5(6pt)=30
- ans 분포: {1:5, 2:5, 3:3, 4:3}
- validate: PASS (B-level 2건, S-level 0건)
- blind: 20/20 일치
- cross-blind: 20/20 일치
- adversarial: HIGH 0건, PASS
- 유형: 어법4/어휘2/내용이해TF3/빈칸추론2/내용일치불일치2/오류찾기1/서술형2/핵심단어1/주제요지2/조건영작1

## 10번 퀴즈
- 날짜: 2026-06-17
- 모델: opus-4.6
- 문항: 20문항 / 100점
- 배점: 쉬움5(4pt)=20 / 보통10(5pt)=50 / 어려움5(6pt)=30
- ans 분포: {1:2, 2:4, 3:5, 4:4}
- validate: PASS (B-level 2건, S-level 0건)
- blind: 20/20 일치
- cross-blind: 20/20 일치
- adversarial: HIGH 0건, PASS
- 유형: 어법3/부적절어휘2/빈칸추론2/내용일치불일치3/주제2/함축1/지칭2/서술형2/핵심단어1/조건영작2
- 스팟체크: 어려움 문항 7개 직접 풀이 전부 정답 확인

## 10강 전체 요약 (2026-06-18 완벽검수)
- 지문: 10개 (Ex01~12, Ex05~06/Ex11~12 합본)
- 테스트: 30파일 (10지문 × 단어/워크북/퀴즈)
- 총 문항: 600문항
- validate: 30/30 ALL PASS, S급 0건
- 10번 신규출제: SOP 8단계 완료 (passage↔PDF대조 + 출제 + validate + blind + cross-blind + adversarial + 스팟체크)
- det↔ans 교차검증: 0건 이슈
- 서술형 단어수/조건 검증: 0건 이슈
