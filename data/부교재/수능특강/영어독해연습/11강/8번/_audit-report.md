# Audit Report: 수능특강 영어독해연습 11강 8번 퀴즈

| 항목 | 값 |
|------|-----|
| 파일 | 퀴즈.json |
| 버전 | v5 |
| 총 문항 | 20 |
| 총점 | 100 |
| 배점 분포 | 쉬움 5×4=20, 보통 10×5=50, 어려움 5×6=30 |
| 정답 분포 | 1번=2, 2번=5, 3번=5, 4번=3 |
| 최대 연속 동일 | 2 |

## SOP 체크리스트

| STEP | 상태 | 비고 |
|------|------|------|
| STEP 0: 원문 확보 | DONE | fullPassage 확보 |
| STEP 1: 출제 | DONE | 20문항 |
| STEP 2: 구조 검증 | PASS | validate 0 FAIL, 3 B-level warnings |
| STEP 3: 블라인드 풀이 | DONE | 퀴즈.blind.json |
| STEP 4: 정답 대조 | DONE | 퀴즈.cross-blind.json |
| STEP 5: 적대적 공격 | DONE | 퀴즈.adversarial.json |
| STEP 6: 자동 검증 | PASS | validate PASS (수정 후 재검증) |
| STEP 7: 증적 리포트 | 본 문서 | |

## 수정 사항

### Q3 (HIGH — 수정 완료)
- **문제**: passage 텍스트 중복. `<u>` 태그가 "it was through infectious imitation, rather than an understanding of its long-term benefit, which"까지 전체를 감싸면서, 그 뒤에 원본 텍스트 ", rather than an understanding of its long-term benefit, that agriculture became fashionable"이 그대로 이어져 "rather than an understanding of its long-term benefit"가 2번 출현
- **원인**: overlay 적용 시 ③ 마커 범위가 과도하게 넓게 설정됨
- **수정**: `③<u>which</u>` 로 축소. 에러 단어(which, that→which)만 밑줄 표시. 중복 텍스트 제거
- **검증**: validate PASS, passage에 "rather than" 1회만 출현 확인

## Validate 결과

```
[PASS] 퀴즈.json (3 warnings)
  [B] C20: histKey pattern mismatch (cosmetic)
  [B] Q6-WEAK-DISTRACTOR: Q6 오답 3개 fullPassage 외 표현
  [B] Q7-WEAK-DISTRACTOR: Q7 오답 3개 fullPassage 외 표현
```

## 유형 분포

| 유형 | 문항 | 난이도 |
|------|------|--------|
| 어법 | Q1, Q2, Q3 | 쉬움, 보통, 어려움 |
| 문맥상 부적절한 어휘 | Q4, Q5 | 보통, 어려움 |
| 빈칸추론 | Q6, Q7 | 보통, 보통 |
| 내용 일치/불일치 | Q8, Q9, Q10 | 쉬움, 보통, 보통 |
| 주제 | Q11 | 보통 |
| 주제 (요지) | Q12 | 어려움 |
| 함축의미 추론 | Q13 | 어려움 |
| 지칭추론 | Q14, Q15 | 쉬움, 보통 |
| 서술형 | Q16, Q17 | 쉬움, 보통 |
| 서술형 — 핵심단어 | Q18 | 어려움 |
| 서술형 — 조건영작 | Q19, Q20 | 쉬움, 보통 |

## 적대적 공격 요약

- HIGH: 1건 (Q3 passage 중복 — **수정 완료**)
- MEDIUM: 2건 (Q6/Q7 빈칸추론 오답이 fullPassage 외 표현이나 구조적 단서 존재하여 허용)
- LOW: 17건 (이슈 없음)

---
Generated: 2026-06-17
Model: Claude Opus 4.6
