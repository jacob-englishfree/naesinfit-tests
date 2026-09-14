# 40번 출제·검수 증적 리포트

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/6월_2024/40번` (2024년 6월 고1 모의고사 40번 — Accessibility of Digital Resources, 요약 지문)
**출제 모델**: Opus 4.8

## 최종 요약

| 항목 | 결과 |
|---|---|
| 테스트 종류 | 단어 / 워크북 / 예상문제(퀴즈) 3종 |
| validate [S] | 3종 전부 0건 (PASS) |
| blind 20/20 | 3종 전부 완결·불일치 0 |
| cross-blind verify | 3종 전부 PASS (20/20 일치) |
| adversarial HIGH | 3종 전부 0건 |
| N7 크로스파일(워크북↔퀴즈) | PASS (정답 중복 0건) |

## 파일별 검수 상태

| 유형 | 문항 | 총점 | 배점(쉬움/보통/어려움) | validate | blind | cross-blind | adv HIGH |
|---|---|---|---|---|---|---|---|
| 단어 | 20 | 100 | 5×4 / 10×5 / 5×6 | PASS | 20/20 | PASS | 0 |
| 워크북 | 20 | 100 | 5×4 / 10×5 / 5×6 | PASS | 20/20 | PASS | 0 |
| 예상문제 | 20 | 100 | 5×4 / 10×5 / 5×6 | PASS | 20/20 | PASS | 0 |

## 유형 구성

- **단어**: (A)(B)(C) 조합형×3, 문맥상 부적절한 어휘×3, 빈칸 어휘×3, 동의어×3, 반의어×2, 다의어×1, 영영풀이×1, 어형변환×2, 빈칸 문맥×2
- **워크북**: 어법×4, 어휘(부적절)×2, 내용이해 T/F×3, 빈칸추론×2, 내용 일치/불일치×2, 오류찾기×1, 서술형(찾기)×2, 어형변환×1, 주제/요지×2, 조건영작×1
- **예상문제**: 어법×3(형용사/부사·have difficulty~ing·분사vs본동사), 문맥 부적절 어휘×2, 빈칸추론×3, 내용 일치/불일치×3, 주제×1, 제목×1(영어선지), 함축의미×1, 지칭추론×1, 조건영작×3, 어형변환×1, 어순배열×1

## 정답 분포 (예상문제 mc)

- {1:4, 2:4, 3:4, 4:3} — 동일번호 최대 4 (≤5), 연속 최대 2 이내

## N7 크로스파일 분리 근거 (워크북 ↔ 예상문제)

- 워크북 서술형/빈칸: standards, educational technology, developed(어형), "This situation would be much improved", "keep the largest possible audience in mind", "serves the needs of those with disabilities as well as those without"
- 예상문제 서술형/빈칸: "if more projects embraced the idea", distinguishing(어형), "many of the otherwise most valuable digital resources are useless", "have made significant progress in meeting the needs of such users", "people who are deaf or hard of hearing", "fail to take these needs into account", "the needs of people with disabilities"
- → 정답·지문영역·문법포인트 전부 상이. check-wb-quiz-leak.py PASS.

## 규칙 준수 확인

- 모의고사 mc passage = fullPassage 통째(어형변환/영영풀이/다의어만 발췌 예외)
- 예상문제 서술형 = 조건영작/어형변환/어순배열만 (찾기·핵심단어 없음, 룰24 준수)
- 예상문제 빈칸추론 = 2단어+ 구절 (단어 1개 금지)
- 조건영작 [조건]에 wa 모든 단어(기능어 포함) 명시, case/마침표 조건 없음
- 영어선지(예상문제 제목 Q12) → det.analysis 한국어 해석 병기
- 어형변환 정답(distinguishing/developed/meeting/ensuring) passage 다른 곳 노출 없음(마스킹)

## 배포 가능 여부

✅ **배포 가능** — 3종 전부 증적 충족, HIGH 이슈 0건, N7 PASS

### jacob 본인 확인 필요
- [ ] 실기기 카카오톡에서 학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이
- [ ] 수업자료 PDF(합본) 업로드 여부
