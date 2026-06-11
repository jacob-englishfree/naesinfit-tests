# Audit Report: 수능특강 영어 28강 1번 (Exercise 01)

## 지문: Savanna Hypothesis and Landscape Preference
- fullPassage: 10문장, 사바나 선호 가설 + Synek/Grammer 오스트리아 연구

## 단어 테스트
- 20문항, 총점 100 (쉬움5x4=20, 보통10x5=50, 어려움5x6=30)
- ans 분포: {1:5, 2:5, 3:5, 4:3}
- validate: PASS (B-level warnings only)
- blind: 20/20
- cross-blind: 20/20
- adversarial: HIGH 0건
- 유형: ABC 3, 부적절 3, 빈칸어휘 3, 동의어 3, 반의어 2, 다의어 1, 영영풀이 1, 어형변환 2, 빈칸문맥 2

## 워크북 테스트
- 20문항, 총점 100
- ans 분포: {1:5, 2:4, 3:5, 4:2}
- validate: PASS
- blind: 20/20
- cross-blind: 20/20
- adversarial: HIGH 0건
- 유형: 어법 4, 어휘 2, T/F 3, 빈칸추론 2, 내용일치 2, 오류찾기 1, 서술형 2, 핵심단어 1, 주제/요지 2, 조건영작 1

## 퀴즈 테스트
- 20문항, 총점 100
- ans 분포: {1:3, 2:4, 3:4, 4:4}
- validate: PASS
- blind: 20/20
- cross-blind: 20/20
- adversarial: HIGH 0건
- 유형: 어법 3, 부적절 2, 빈칸추론 2, 내용일치 3, 주제 2, 함축의미 1, 지칭추론 2, 서술형 1, 핵심단어 1, 조건영작 3

## 크로스파일 중복 체크
- 워크북↔퀴즈 동일 wa/overlay.blank: 없음
  - 워크북 blank: the savanna hypothesis, where they have lived
  - 퀴즈 blank: into their brains, scenes that resemble the savanna, shifted to areas with denser trees and higher mountains, prefer landscapes thinly dotted with trees, this preference gets modified by where
  - 겹침 없음

## 완료: 2026-06-11
- 모델: claude-opus-4-6
- 3파일 x 4 artifact = 12 artifact 완료
