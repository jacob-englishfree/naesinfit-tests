# Audit Report: 퀴즈 테스트
**ReadingPower유형편완성 / 15강 / Pr04**
**검수일: 2026-06-04**
**검수자: claude-opus-4-6**

---

## 1. Cross-Blind 결과

| 문항 | 유형 | 난이도 | blind pick | 실제 ans/wa | 일치 |
|------|------|--------|-----------|-------------|------|
| 1 | 어법 | 쉬움 | 3 | 3 | O |
| 2 | 어법 | 보통 | 1 | 1 | O |
| 3 | 어법 | 어려움 | 4 | 4 | O |
| 4 | 문맥상 부적절한 어휘 | 보통 | 2 | 2 | O |
| 5 | 문맥상 부적절한 어휘 | 어려움 | 1 | 1 | O |
| 6 | 빈칸추론 | 보통 | 3 | 3 | O |
| 7 | 빈칸추론 | 보통 | 2 | 2 | O |
| 8 | 내용 일치/불일치 | 쉬움 | 4 | 4 | O |
| 9 | 내용 일치/불일치 | 보통 | 3 | 3 | O |
| 10 | 내용 일치/불일치 | 보통 | 1 | 1 | O |
| 11 | 주제 | 보통 | 2 | 2 | O |
| 12 | 주제 | 어려움 | 4 | 4 | O |
| 13 | 함축의미 추론 | 어려움 | 1 | 1 | O |
| 14 | 지칭추론 | 쉬움 | 3 | 3 | O |
| 15 | 지칭추론 | 보통 | 4 | 4 | O |
| 16 | 서술형 | 쉬움 | a common feature of large public projects | a common feature of large public projects | O |
| 17 | 서술형 | 보통 | to neutral observers is beyond his capability | to neutral observers is beyond his capability | O |
| 18 | 서술형 — 핵심단어 | 어려움 | a significant amount of time and money | a significant amount of time and money | O |
| 19 | 서술형 — 조건영작 | 쉬움 | can be wasted pursuing unrealistic goals | can be wasted pursuing unrealistic goals | O |
| 20 | 서술형 — 조건영작 | 보통 | hesitant in the future to strive for | hesitant in the future to strive for | O |

**일치율: 20/20 = 100%**

---

## 2. Adversarial 검토

| 심각도 | 건수 |
|--------|------|
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 4 |

- MEDIUM 1건: 문항4 optimism→realism 변환에서 학생이 'lack of optimism'을 맥락에 맞다고 오판할 가능성 — 실제로는 맥락상 명확히 구분됨

---

## 3. 구조 검증

- 총 문항: 20문항 (OK)
- 배점 분포: 쉬움 5x4=20, 보통 10x5=50, 어려움 5x6=30 → 총점 100 (OK)
- 정답 분포 (mc만): 1번=3회, 2번=4회, 3번=4회, 4번=4회 (최대 4, OK)
- 연속 동일 정답: 최대 2연속 (OK)
- fmt 분포: mc 15, written 5 (OK)

---

## 4. 판정

**PASS** — cross-blind 100% 일치, HIGH 0건, 구조 정상
