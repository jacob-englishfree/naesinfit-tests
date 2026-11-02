# 공통영어2/능률오선영/4과/본문 단어 v5 — 2026-11-02

## 단어.json (20문항, 100점 — 쉬움 5×4 / 보통 10×5 / 어려움 5×6)

- validate: PASS (S/A 0건, B 경고 8건 — EX-3는 (A)(B)(C) 괄호표시 형식상 오탐, P2는 다의어/어형변환 커스텀 발췌 예상 경고)
- validate-ans: ALL PASS (L1~L3 0건)
- blind: 20/20 일치 (자동 12 + 에이전트 8, 전 문항 reasoning 기재)
- cross-blind: 20/20 일치 (반대 모델 Opus, cross-prompt만 열람)
- adversarial: HIGH 0 / MEDIUM 0 / LOW 1 (Q9 curved 약성립 지적 — 원문 단서 solid 명확, 정답 우위 유지로 수용)
- ans 분포: 1×4, 2×5, 3×5, 4×4 / 3연속 없음

## 수정 이력
- _passage.json: fullPassage 말미 Culture Notes 섹션 오염 절단 (S-SECTION-LEAK, 섹션 분리 원칙)
- Q4: ④ everyone → accessible (제목 "Everyone"에 첫 매칭되어 S-MARKER-ORDER ④①②③ 발생 → 교정)
- Q2: (A) visual → understanding, (B) 오답 ignore → cause (발췌 내 "visual disabilities"로 정답 노출 EX-3 해소)
- Q5: 자동 블라인드솔버 마커-문맥 정렬 오탐(①≠minor) — 문항 재검토 결과 정상, 에이전트 풀이 ④로 일치 확인
