# Audit Report: ReadingPower유형편완성 14강 Ex01 퀴즈

## 기본 정보
- **파일**: data/부교재/ReadingPower유형편완성/14강/Ex01/퀴즈.json
- **출제 모델**: claude-opus-4-6
- **검수 일시**: 2026-06-04
- **fullPassage 주제**: 은어의 다양성과 언어학적 연구의 어려움

## 문항 구성
| 번호 | 유형 | 난이도 | 배점 | ans |
|------|------|--------|------|-----|
| 1 | 어법 | 쉬움 | 4 | 4 |
| 2 | 어법 | 보통 | 5 | 1 |
| 3 | 어법 | 어려움 | 6 | 4 |
| 4 | 문맥상 부적절한 어휘 | 보통 | 5 | 3 |
| 5 | 문맥상 부적절한 어휘 | 어려움 | 6 | 2 |
| 6 | 빈칸추론 | 보통 | 5 | 2 |
| 7 | 빈칸추론 | 보통 | 5 | 4 |
| 8 | 내용 일치/불일치 | 쉬움 | 4 | 2 |
| 9 | 내용 일치/불일치 | 보통 | 5 | 4 |
| 10 | 내용 일치/불일치 | 보통 | 5 | 3 |
| 11 | 주제 | 보통 | 5 | 1 |
| 12 | 주제 | 어려움 | 6 | 3 |
| 13 | 함축의미 추론 | 어려움 | 6 | 1 |
| 14 | 지칭추론 | 쉬움 | 4 | 3 |
| 15 | 지칭추론 | 보통 | 5 | 2 |
| 16 | 서술형 | 쉬움 | 4 | - |
| 17 | 서술형 | 보통 | 5 | - |
| 18 | 서술형 — 핵심단어 | 어려움 | 6 | - |
| 19 | 서술형 — 조건영작 | 쉬움 | 4 | - |
| 20 | 서술형 — 조건영작 | 보통 | 5 | - |

## 배점 분포
- 쉬움: 5문항 x 4점 = 20점
- 보통: 10문항 x 5점 = 50점
- 어려움: 5문항 x 6점 = 30점
- **총점: 100점**

## 정답 분포 (mc 15문항)
- 1번: 3개 (Q2, Q11, Q13)
- 2번: 4개 (Q5, Q6, Q8, Q15)
- 3번: 4개 (Q4, Q10, Q12, Q14)
- 4번: 4개 (Q1, Q3, Q7, Q9)
- 최대 연속: 2 (규칙 준수)

## SOP 이행
- [x] STEP 0: fullPassage 원문 확인
- [x] STEP 1: 출제 (response.json)
- [x] STEP 2: assemble + validate PASS
- [x] STEP 3: 블라인드 풀이 20/20 일치
- [x] STEP 4: 정답 대조 완료
- [x] STEP 5: 적대적 공격 — HIGH 0건
- [x] STEP 6: validate PASS (S급 0건)
- [ ] STEP 7: 증적 리포트 (본 문서)
- [ ] STEP 8: jacob 확인 후 배포

## validate 결과
- **S급 에러: 0건**
- **B급 경고: 3건** (histKey 패턴, P2 overlay 정상동작)

## 워크북 크로스 중복 확인
- 워크북과 동일 overlay 타겟/wa 없음
- 어법: 워크북(that you use, likely, told, heard 등) vs 퀴즈(what it was, areas, using by, finally year 등) — 전부 상이
- 빈칸: 워크북(the kind of slang, no way I would ever know) vs 퀴즈(several different kinds of slang, quite difficult for linguists) — 전부 상이
- 서술형: 워크북(several different kinds of, very different from their, listened out for, there are often differences in) vs 퀴즈(actually quite difficult for linguists to find, words that are used differently within a, likely to be different from what is used, unless you told me what it was, the slang used by first-year students was very different from) — 전부 상이
