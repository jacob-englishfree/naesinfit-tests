# 증적 리포트 — 워크북 테스트 (Reading Expert 5, U09 Whistled Languages / 전체)

- 파일: `data/부교재/ReadingExpert5/9강/전체/워크북.json`
- 재검증: 2026-09-13 (Opus 4.8)

## 1. 구성
- 문항 수: **20** / 총점: **100**
- 배점 분포: 쉬움 5 × 4점(20) + 보통 10 × 5점(50) + 어려움 5 × 6점(30) = 100
- 형식: 객관식 16 + 서술형 4 (찾기 2 / 어형변환 1 / 조건영작 1)
- 유형 분포: 어법 4 / 어휘 2 / 내용이해 T/F 3 / 빈칸추론 2 / 내용 일치·불일치 2 / 오류찾기 1 / 서술형(찾기) 2 / 서술형 — 어형변환 1 / 주제·요지 2 / 서술형 — 조건영작 1 — 전부 워크북 화이트리스트 내
- mc 정답 분포: ①3 ②5 ③5 ④3 (한 번호 5개 이하 — A6 PASS)

## 2. validate 결과
**[PASS]** (경고 4건, 전부 B급 비차단)
- P2(B) Q4/Q5: 어법·어휘 마커가 지문 첫머리에 붙어 prefix 매칭이 어긋난 오탐 — 실제 passage는 fullPassage 전체
- P2(B) Q14: 오류찾기는 4문장 패러프레이즈 지문(설계상 발췌) — 정상
- Q6-WEAK(B) Q10: 빈칸추론 오답이 지문 미등장 — 변별용 오답으로 정상

## 3. 블라인드 재풀이 (정답 가리고 원문 대조로 직접 풀이)
**20/20 일치.** 대표 근거:
- Q1 allow→allows 수일치(②), Q2 simplify→simplifying(②), Q3 which→who(③), Q4 attracting→attracted(③)
- Q5 secret←widespread 부적절(②), Q6 canceled←revived 부적절(④)
- Q7 T / Q8 F(인구 37로 감소) / Q9 T, Q10 attention(③), Q11 the culture and history(④)
- Q12 일치=섬에서 먼 거리 소통(③), Q13 불일치=1950년대 기술로 사용 급증(③), Q14 오류찾기 Speaking→Spoken(①)
- Q15 Silbo Gomero(2단어), Q16 Different combinations of whistled tones represent vowels(7단어), Q17 lose→losing
- Q18 주제=사라지는 휘파람 언어 보존 노력(④), Q19 제목=Fading Voices Worth Saving(②)
- Q20 조건영작 11단어=Some groups have been fairly successful in preserving their whistled languages

## 4. 적대검수 + N7
- 조건영작 Q20 / 찾기 Q16: [조건] 단어수 = wa 단어수 완전 일치
- 정답 2개 가능/정답 노출/뻔한 오답: 0건
- **N7 (워크북↔예상문제 정답중복): 0건** — 워크북 서술형 답과 퀴즈 서술형 답 완전 상이

## 5. 판정
- validate PASS · 블라인드 20/20 · 원문 100% 일치 · 정답오류 0 · N7 0
- 증적: response/json/blind/cross-blind/adversarial 존재, adversarial HIGH 0
- **배포 가능 (GREEN)**
