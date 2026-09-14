# 40번 출제·검수 증적 리포트 (고1/10월_2024)

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/10월_2024/40번` — Trick-Punishments (Álvaro Bilbao, 8문장/156단어)
**출제**: Opus 출제자 (단어·워크북·퀴즈 3종 신규)

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 3 (단어/워크북/퀴즈) |
| validate PASS | 3/3 (S/A급 0, [B] 경고만) |
| blind 20/20 일치 | 3/3 |
| cross-blind 20/20 일치 | 3/3 |
| adversarial HIGH | 0건 (LOW 7건) |
| N7 워크북↔퀴즈 정답중복 | 0건 (PASS) |

## 파일별 검수 상태

| 섹션 | 문항 | 총점 | 배점분포(쉬움/보통/어려움) | validate | blind | cross-blind | adv HIGH |
|---|---|---|---|---|---|---|---|
| 단어 | 20 | 100 | 5×4 / 10×5 / 5×6 | PASS | 20/20 | 20/20 | 0 |
| 워크북 | 20 | 100 | 5×4 / 10×5 / 5×6 | PASS | 20/20 | 20/20 | 0 |
| 퀴즈 | 20 | 100 | 5×4 / 10×5 / 5×6 | PASS | 20/20 | 20/20 | 0 |

## 유형 구성

- **단어**: (A)(B)(C) 조합형 ×3, 문맥상 부적절 어휘 ×3, 빈칸 어휘완성 ×3, 동의어 ×3, 반의어 ×2, 다의어 ×1, 영영풀이 ×1, 어형변환 ×2, 빈칸 문맥완성 ×2
- **워크북**: 어법 ×4, 어휘(부적절) ×2, 내용이해 T/F ×3, 빈칸추론 ×2, 내용 일치/불일치 ×2, 오류찾기 ×1, 서술형(찾기) ×2, 서술형-어형변환 ×1, 주제/요지 ×2, 서술형-조건영작 ×1
- **퀴즈**: 어법(복합) ×3, 부적절 어휘 ×2, 빈칸추론 ×3, 내용 일치/불일치 ×3, 주제 ×1(영어선지), 제목 ×1(영어선지), 함축 ×1, 지칭 ×1, 서술형-조건영작 ×3, 서술형-어형변환 ×1, 서술형-어순배열 ×1

## 정답 분포 (동일번호 ≤5, 연속 ≤2 준수)

- 단어(mc 18): 1×4, 2×5, 3×4, 4×5
- 워크북(mc 16): 1×3, 2×5, 3×5, 4×3
- 퀴즈(mc 15): 1×4, 2×5, 3×3, 4×3

## N7 (워크북↔퀴즈 서로 다른 지문영역·문법포인트·정답)

- 워크북 정답축: 어법=수일치/gerund주어/현재완료, 서술형 wa=invisible·congratulate·feeling·being scolded is much better than feeling invisible, 빈칸=reward the positives·adopting a different strategy
- 퀴즈 정답축: 어법=encourage+to부정사/비교병렬/관계대명사 what, 서술형 wa=punishing a child may not be effective·scolds·instead of constantly pointing out the negatives·the mother clearly cannot allow the child to hit his little brother·it encourages them to do it
- `check-wb-quiz-leak.py` → **PASS (중복 0건)**

## 규칙 준수 확인

- 모의 mc passage = fullPassage 통째 + overlay만 (85%+). 발췌 예외: 어형변환(2~4문장 excerptSentences), 영영풀이(passage 없음), 다의어(AI 작성 (A)(B))
- overlay 마커/빈칸/밑줄/wa 전부 fullPassage 정확 substring, 마커 본문 전체 분산(단조증가)
- 빈칸 정답에 숫자·고유명사 미사용(Hugh/Álvaro Bilbao 등 제외)
- 퀴즈 서술형 = 조건영작/어형변환/어순배열만(찾기·핵심단어 금지, 룰24). Q17 어형변환은 excerptSentences로 정답 미노출
- 조건영작 [조건]에 wa 모든 토큰(기능어 포함) 명시, case/마침표 조건 없음
- 영어선지(퀴즈 주제·제목) det.analysis에 각 선지 한국어 번역 병기

## 잔여 [B] 경고 (비차단)

- 단어 EX-3 Q1~3: (A)(B)(C) 정답 단어가 본문 내 존재 — 조합형 유형 특성상 불가피(원문 단어 조합이 정답)
- 단어/퀴즈 P2, Q6-WEAK-DISTRACTOR: 다의어·어형변환 커스텀 passage, 일부 빈칸 오답이 본문 외 단어 — 유형 특성상 정상

## 배포 가능 여부

✅ 모든 증적 충족, HIGH 0건, N7 PASS. (배포·DB등록·catalog는 총괄 담당)
