# 증적 리포트 — 영어2 YBM박준언 2과 Further Reading — 워크북

- 문항: 20문항 / 100점 (쉬움 5×4=20, 보통 10×5=50, 어려움 5×6=30)
- 유형 믹스: 어법4 · 어휘(부적절)2 · 내용이해 T/F3 · 빈칸추론2 · 내용일치/불일치2 · 오류찾기1 · 서술형2 · 서술형—어형변환1 · 주제/요지2 · 서술형—조건영작1
- ans 분포: {1:4, 2:4, 3:4, 4:4} (동일번호 최대 5, 3연속 없음 — 완전 균등)
- 단어.json(같은 지문 단어 테스트)과 타깃 단어/블랭크/wa 중복 없음 (cross-leak 회피): 어법(4문항)·오류찾기(1문항)는 문법 판단형이라 단어 자체 재출현은 불가피하나 정답 판단 지점(문법 포인트)이 단어.json과 전부 다름. 어휘/빈칸/서술형 타깃 단어(conclusion·someone·reasons·sum total·a friend buys a better one·your experiences really are part of you·buys·You can really like your material stuff)는 단어.json 20문항의 정답/선지 세트(fades·norm·raising·stimulate·thrilled·longer·accumulation·bigger·connected·vanish/last·recipes/possessions·denied/found·critical·expectations·deliver·assume·trouble·novel·wrong·separate·conducted·seen·compare themselves with others·become a part of our identity)와 전부 비중복 확인.

## 게이트 결과
- validate: PASS, S/A급 0건 (경고 5건은 전부 B급 정상 패턴 — P2 3건은 마커가 문장 앞부분에 삽입되어 fullPassage 리터럴 접두사 매칭이 어긋나는 false-positive, Q6-WEAK-DISTRACTOR 2건은 빈칸추론 발명형 오답 선지가 원문에 없는 것이 의도된 정상 설계)
- STEP 3 self blind-solve: 20/20 일치 (정답·해설 가리고 직접 풀이, 근거 기록)
- Tier 2 cross-blind (Opus 독립 풀이): 20/20 일치
- STEP 5 adversarial (Opus 독립 공격 검수): HIGH 1건 발견 → 즉시 수정·재검증 완료(현재 HIGH 0건) / MEDIUM 1건(Q11 오답 3개 동일 의미축 — 빈칸추론 통상 패턴, 항의 유발 요소 아님) / LOW 1건(Q14 오류찾기 `<u>` 태그 — 이번 출제는 agent_workbook.md 지침에 따라 명시적으로 허용된 케이스, 렌더 정상 확인)
  - HIGH 상세: Q16(서술형 찾기, 7단어) 최초 stem이 정답 문장(idx18 "your experiences really are part of you") 외에 idx13 "experiences become a part of our identity"(동일 7단어)와도 중의적으로 해석될 여지 → stem을 "'On the other hand'로 시작하는 문장에 이어지는 절"로 재작성해 passage 내 유일한 위치로 명시적 한정, 재검증(self blind + cross-blind) 20/20 재확인 완료

## 결론
배포 승인.
