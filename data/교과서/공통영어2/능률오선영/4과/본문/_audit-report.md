# 테스트 검증 리포트 — 공통영어2 NE능률(오선영) 4과 본문

- 교재: 공통영어2 / 능률오선영 / 4과 / 본문
- 제목: Opening Up the Web to Everyone
- 생성일: 2026-11-11
- 출제 모델: Opus (자가진단 통과 → 직접 출제)
- 테스트 3종: 단어 / 워크북 / 퀴즈(예상문제)

## STEP 0 — 원문 확보 (글자 단위)
- 원문 PDF `/tmp/neung_c2_4.pdf` (3p) → Read(vision) 전사 + `pdftotext -layout` 교차검증.
- 본문(Culture Notes 제외) 영어 753단어 → PDF 영어 좌단과 **전수 1:1 대조, 753/753 완전 일치**.
- `_passage.json` 저장. 교과서 발췌 방식(excerptRange)으로 각 문항 passage 자동 주입.

## STEP 1~6 — 공통 결과
| 항목 | 단어 | 워크북 | 퀴즈 |
|---|---|---|---|
| 문항 수 | 20 | 20 | 20 |
| 총점 | 100 | 100 | 100 |
| 배점(쉬움5×4/보통10×5/어려움5×6) | 20/50/30 | 20/50/30 | 20/50/30 |
| validate.js | ✅ PASS (S/A 0) | ✅ PASS (S/A 0) | ✅ PASS (S/A 0) |
| validate-fulltext | ✅ PASS | ✅ PASS | ✅ PASS |
| validate-scoring | ✅ PASS | ✅ PASS | ✅ PASS |
| ans 분포 | 1:5 2:5 3:5 4:3 | 1:5 2:5 3:3 4:3 | 1:4 2:4 3:3 4:4 |
| STEP3 자체 블라인드 | 20/20 일치 | 20/20 일치 | 20/20 일치 |
| Tier2 cross-blind(Sonnet) | 20/20 일치 | 20/20 일치 | 20/20 일치 |
| STEP5 적대적 HIGH | 0 (폐기/재출제 0) | 0 (폐기/재출제 0) | 0 (폐기/재출제 0) |

## 수정/재출제 이력
- 단어 Q2: (A)(B)(C) C단어 benefit → clear (benefit이 본문 뒤쪽에 재등장 = 유추 누설 차단).
- 단어 Q8/Q9: 오답 선지를 본문 등장 단어로 교체(distractor 품질).
- 워크북 Q10: 빈칸 "providing alternative text"(직후 'alt text'로 누설) → "can be used by everyone"(정의 추론).
- 퀴즈 Q2/Q4: S-MARKER-ORDER(마커 ①②③④ 순서) 위반 → 라벨 재배치 + ans 분포 재조정.
- 퀴즈 Q17: 어형변환 발췌 'cannot read images' → 원문대로 'cannot "read" images'(FT-20 정합).

## 유형 구성
- 단어: (A)(B)(C)×3 / 부적절어휘×3 / 빈칸어휘×3 / 동의어×3 / 반의어×2 / 다의어 / 영영 / 어형변환×2 / 빈칸문맥×2
- 워크북: 어법×4 / 어휘×2 / T·F×3 / 빈칸추론×2 / 내용일치×2 / 오류찾기 / 서술형(찾기)×2 / 어형변환 / 주제·요지×2 / 조건영작
- 퀴즈: 어법×3 / 부적절어휘×2 / 빈칸추론×3 / 내용일치×3 / 주제 / 제목 / 함축 / 지칭 / 조건영작×3 / 어형변환 / 어순배열 (영어 선지+한국어 해설)
- 워크북↔퀴즈 cross-leak: 동일 wa/blank/문법포인트 없음(N7 준수).

## 최종 판정
✅ 전 3종 validate/fulltext/scoring PASS + 자체·교차 블라인드 20/20 + 적대적 HIGH 0.
※ 배포는 미실행(jacob 확인 대기).
