# 증적 리포트 — 영어2 YBM박준언 5과 본문 (The Perfect Match)

## 단어 테스트
- 문항 20 / 총점 100점 (쉬움5×4+보통10×5+어려움5×6)
- 유형: (A)(B)(C) 조합형3 · 문맥상 부적절한 어휘3 · 빈칸 어휘 완성3 · 동의어 고르기3 · 반의어 고르기2 · 다의어 문맥적 의미1 · 영영풀이 매칭1 · 어형 변환2 · 빈칸 문맥 완성2
- ans 분포(객관식): {1: 5, 2: 4, 4: 4, 3: 5}
- validate: PASS (S/A급 0, [B]경고는 발췌 시작부/마커 정상 부작용)
- STEP3 self-blind + Tier2 cross-blind(반대모델 Sonnet): 20/20 일치, 불일치/needsAgent 0
- STEP5 adversarial: HIGH 0

## 워크북 테스트
- 문항 20 / 총점 100점 (쉬움5×4+보통10×5+어려움5×6)
- 유형: 어법4 · 어휘2 · 내용이해 T/F3 · 빈칸추론2 · 내용 일치/불일치2 · 오류찾기1 · 서술형2 · 서술형 — 어형변환1 · 주제/요지2 · 서술형 — 조건영작1
- ans 분포(객관식): {2: 4, 1: 4, 4: 4, 3: 4}
- validate: PASS (S/A급 0, [B]경고는 발췌 시작부/마커 정상 부작용)
- STEP3 self-blind + Tier2 cross-blind(반대모델 Sonnet): 20/20 일치, 불일치/needsAgent 0
- STEP5 adversarial: HIGH 0

## 예상문제(퀴즈) 테스트
- 문항 20 / 총점 100점 (쉬움5×4+보통10×5+어려움5×6)
- 유형: 어법3 · 문맥상 부적절한 어휘2 · 빈칸추론3 · 내용 일치/불일치3 · 주제1 · 제목1 · 함축의미 추론1 · 지칭추론1 · 서술형 — 조건영작3 · 서술형 — 어법고쳐쓰기1 · 서술형 — 어순배열1
- ans 분포(객관식): {1: 4, 3: 3, 2: 4, 4: 4}
- validate: PASS (S/A급 0, [B]경고는 발췌 시작부/마커 정상 부작용)
- STEP3 self-blind + Tier2 cross-blind(반대모델 Sonnet): 20/20 일치, 불일치/needsAgent 0
- STEP5 adversarial: HIGH 0

## 특기사항
- 워크북 Q4(어법): 마커① 조기매칭으로 passage 86% 폭발 → 유일문자열 "remember things"로 교정, excerpt 8%로 축소(실측). Q11 빈칸: excerptRange 확장으로 6문장 확보.
- 예상문제 Q19(어순배열)·Q16/Q20: 복수정답 없음 확인(cross-blind), accept에 대체어순 등록.
- 원문: e2_ybm_l5 source.json 본문 130문장(단어멀티셋 원문 100% 일치본)에서 fullPassage 구성.

## 결론: 3종 배포 승인.