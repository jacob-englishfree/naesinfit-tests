# Audit Report: 수능특강 영어 18강 Gateway

**감사일**: 2026-06-05
**감사자**: claude-opus-4-6
**대상**: 단어.json / 워크북.json / 퀴즈.json (60문항)

---

## 1. validate 결과

| 파일 | 결과 | S급 | 경고(B) |
|------|------|-----|---------|
| 단어.json | PASS | 0 | 7 (EX-1x1, C20x1, P2x2, Q6-WEAK-DISTRACTORx3) |
| 워크북.json | PASS | 0 | 3 (P2x1, Q6-WEAK-DISTRACTORx2) |
| 퀴즈.json | PASS | 0 | 6 (RENDER-ANS-NOT-UNDERLINEDx1, C20x1, P2x3, Q6-WEAK-DISTRACTORx1) |

**S급 에러: 0건. 전 파일 PASS.**

참고 경고:
- C20: histKey 패턴 불일치 (단어: wordtest__18_gw_v5, 퀴즈: quiztest__18_gw_v5). 기능에 영향 없음.
- EX-1: 단어 Q8 빈칸 정답 sustain이 동일 passage 내 노출 (빈칸 자체에는 없으나 which sustain에서 보임)

---

## 2. Cross-Blind 결과

| 파일 | 총 문항 | 정답 | 불일치 |
|------|---------|------|--------|
| 단어.json | 20 | 20 | 0 |
| 워크북.json | 20 | 20 | 0 |
| 퀴즈.json | 20 | 20 | 0 |

**전 60문항 blind 풀이 일치. 정답/오답 구분 명확.**

---

## 3. Adversarial 공격 결과

| 파일 | HIGH | MEDIUM | LOW |
|------|------|--------|-----|
| 단어.json | 0 | 3 | 1 |
| 워크북.json | 0 | 0 | 1 |
| 퀴즈.json | 0 | 0 | 2 |

**HIGH 0건.**

### MEDIUM 상세 (단어.json Q1, Q2, Q4 det.analysis 선지 설명 오류)

**Q1**: det.analysis 텍스트에서 ①②③④ 설명이 실제 ch 배열과 불일치.
- analysis "✅③ distinct-engage-afford"라 적었으나 실제 ch[2]=③은 "vague-engage-afford"
- 실제 정답 ch[3]=④ "distinct-engage-afford"는 맞고 ans=4 정상
- **영향**: 학생 화면에서 해설 볼 때 ①②③④ 설명이 실제 선지와 교차. 채점 자체는 정상.

**Q2**: 동일 문제. analysis "✅① frustration-unstable-fulfillment"이지만 ch[0]=① = "frustration-unstable-disappointment".

**Q4**: 마커 기반 문맥상 부적절 유형. det에서 "③ stable"이라 했으나 실제 정답 마커는 ②(find:unstable, display:stable). ans=2 정상이나 해설 번호 불일치.

**수정 권장**: det.analysis 텍스트를 실제 ch 배열 순서에 맞춰 재작성. 채점에는 영향 없으나 학생이 해설을 볼 때 혼란 가능.

---

## 4. 배점 분포

3파일 동일 구조:
- 쉬움 5문항 x 4점 = 20점
- 보통 10문항 x 5점 = 50점
- 어려움 5문항 x 6점 = 30점
- 총 100점 (규칙 준수)

---

## 5. 정답 분포 (ans)

| 파일 | 1번 | 2번 | 3번 | 4번 |
|------|-----|-----|-----|-----|
| 단어 | 4 | 4 | 4 | 6+2(서술형) |
| 워크북 | 3 | 4 | 5 | 6+2(서술형) |
| 퀴즈 | 3 | 4 | 5 | 6+2(서술형) |

**최대 동일번호: 단어 ans=4가 6개 (mc만 카운트). 서술형 제외 시 4개이므로 규칙 내. validate PASS.**

---

## 6. 수정 권장 사항

| 우선순위 | 파일 | 문항 | 내용 |
|----------|------|------|------|
| MEDIUM | 단어.json | Q1 | det.analysis 선지 설명을 실제 ch 배열에 맞춰 재작성 |
| MEDIUM | 단어.json | Q2 | det.analysis 선지 설명을 실제 ch 배열에 맞춰 재작성 |
| MEDIUM | 단어.json | Q4 | det.analysis 마커 번호를 실제 overlay.markers 순서에 맞춰 재작성 |

**채점/정답에는 영향 없음. 해설 표시 시 학생 혼란 방지를 위한 수정.**

---

## 7. 총평

18강 Gateway 3파일(60문항): S급 에러 0건, blind 전문항 일치, HIGH 공격 0건.
단어.json Q1/Q2/Q4의 det.analysis 텍스트가 ch 배열과 불일치하는 MEDIUM 이슈 3건 발견. 채점은 정상이나 해설 표시 정확도를 위해 수정 권장.
