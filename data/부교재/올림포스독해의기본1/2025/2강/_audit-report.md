# Audit Report: 올림포스독해의기본1 / 2025 / 2강 / 전체 / 단어

## 기본 정보
- 파일: `data/부교재/올림포스독해의기본1/2025/2강/전체/단어.json`
- 출제일: 2026-04-18
- 모델: claude-opus-4-6 (1M context)
- 총 문항: 20문항 / 총점: 100점

## 배점 분포
- 쉬움: 5문항 x 4점 = 20점
- 보통: 10문항 x 5점 = 50점
- 어려움: 5문항 x 6점 = 30점

## 유형 분포
- (A)(B)(C) 조합형: 3문항 (Q1-Q3)
- 문맥상 부적절한 어휘: 3문항 (Q4-Q6)
- 빈칸 어휘 완성: 3문항 (Q7-Q9)
- 동의어 고르기: 3문항 (Q10-Q12)
- 반의어 고르기: 2문항 (Q13-Q14)
- 다의어 문맥적 의미: 1문항 (Q15)
- 영영풀이 매칭: 1문항 (Q16)
- 어형 변환: 2문항 (Q17-Q18)
- 빈칸 문맥 완성: 2문항 (Q19-Q20)

## 정답 분포
- 1번: 4개, 2번: 5개, 3번: 5개, 4번: 4개
- 최대 연속 동일 번호: 2 (허용 범위 내)

## SOP 이행
- [x] STEP A: 출제 + assemble PASS
- [x] STEP B: 블라인드 풀이 20/20 일치
- [x] STEP C: Cross-blind 20/20 일치
- [x] STEP D: 적대적 공격 HIGH 0건

## validate 결과
- S급 에러: 0건
- A급 에러: 0건
- B급 경고: 7건 (ABC 노출 3건 - 짧은 지문 불가피, histKey 패턴 1건, 다의어/어형변환 passage 3건 - 정상)

## 수정 이력
1. Q7: blank "Hostilities" → "cease" (S-BLANK-MEMORIZATION 해소)
2. Q8: 오답 denied/doubted/ignored → heard/shouting/waved (fullPassage 내 단어)
3. Q9: 오답 disappear/fade/shrink → returned/cease/gathered (fullPassage 내 단어)
4. Q20: ch "wave him down" → "waved him down" (fullPassage 시제 일치)

## 결론
배포 가능. HIGH 이슈 0건, S급 위반 0건.
