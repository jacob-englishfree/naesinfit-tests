# 전수 재검증 리포트 (2026-04-15 오후)

## 신규 4종 규칙 위반 (올림포스 3강+5강 한정, 총 36파일)

### 3강 — 6파일 (모두 S-DISTRACTOR-ALL-FIRST-SENT)
- Ex03/단어, Ex05/단어, Ex05/퀴즈, Ex07/단어, Ex07/퀴즈, Ex12/워크북

### 5강 — 30파일
- Ex01~Ex12 × (워크북+퀴즈) = 24파일: **S-DUPLICATE-ITEM + S-DISTRACTOR-ALL-FIRST-SENT**
- Ex01~Ex12 × 단어 일부: 6파일

## 위반 유형 분석

### S-DUPLICATE-ITEM (내가 만든 인위적 중복)
5강 워크북 Q18(주제) ↔ Q19(요지) 선지 동일 — 제가 오늘 topic data 공통 사용한 결과. **real 중복임**. 재출제 시 Q18/Q19 중 하나를 다른 유형(제목/글의 흐름)으로 교체 필요.

### S-DISTRACTOR-ALL-FIRST-SENT (빈칸 추론 오답 3개가 passage 첫 문장 단어)
내 휴리스틱이 엄격. 일부는 실제 편법, 일부는 false positive 가능성. 수동 확인 후 true positive만 수정.
