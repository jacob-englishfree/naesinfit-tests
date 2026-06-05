# Audit Report: 워크북 테스트
**ReadingPower유형편완성 / 15강 / Pr04**
**검수일: 2026-06-04**
**검수자: claude-opus-4-6**

---

## 1. Cross-Blind 결과

| 문항 | 유형 | 난이도 | blind pick | 실제 ans/wa | 일치 |
|------|------|--------|-----------|-------------|------|
| 1 | 어법 | 쉬움 | 2 | 2 | O |
| 2 | 어법 | 쉬움 | 3 | 3 | O |
| 3 | 어법 | 보통 | 3 | 3 | O |
| 4 | 어법 | 어려움 | 1 | 1 | O |
| 5 | 어휘 | 보통 | 2 | 2 | O |
| 6 | 어휘 | 보통 | 3 | 3 | O |
| 7 | 내용이해 T/F | 쉬움 | 1 (T) | 1 (T) | O |
| 8 | 내용이해 T/F | 보통 | 2 (F) | 2 (F) | O |
| 9 | 내용이해 T/F | 보통 | 1 (T) | 1 (T) | O |
| 10 | 빈칸추론 | 보통 | 4 | 4 | O |
| 11 | 빈칸추론 | 어려움 | 4 | 4 | O |
| 12 | 내용 일치/불일치 | 쉬움 | 3 | 3 | O |
| 13 | 내용 일치/불일치 | 보통 | 1 | 1 | O |
| 14 | 오류찾기 | 어려움 | 4 | 4 | O |
| 15 | 서술형 | 보통 | not without cost | not without cost | O |
| 16 | 서술형 | 어려움 | within his grasp | within his grasp | O |
| 17 | 서술형 — 핵심단어 | 보통 | time and money | time and money | O |
| 18 | 주제/요지 | 쉬움 | 3 | 3 | O |
| 19 | 주제/요지 | 보통 | 2 | 2 | O |
| 20 | 서술형 — 조건영작 | 어려움 | time and money can be wasted pursuing unrealistic goals | time and money can be wasted pursuing unrealistic goals | O |

**일치율: 20/20 = 100%**

---

## 2. Adversarial 검토

| 심각도 | 건수 |
|--------|------|
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 4 |

- MEDIUM 1건: 문항2 beside→beyond는 어법보다 어휘적 오류에 가까움 — 전치사가 어법 범주에 포함되므로 허용

---

## 3. 구조 검증

- 총 문항: 20문항 (OK)
- 배점 분포: 쉬움 5x4=20, 보통 10x5=50, 어려움 5x6=30 → 총점 100 (OK)
- 정답 분포 (mc만): 1번=4회, 2번=4회, 3번=5회, 4번=4회 (최대 5, OK)
- 연속 동일 정답: 최대 2연속 (OK)
- fmt 분포: mc 16, written 4 (OK)
- T/F 문항: 3개 (워크북 전용 유형, OK)

---

## 4. 판정

**PASS** — cross-blind 100% 일치, HIGH 0건, 구조 정상
