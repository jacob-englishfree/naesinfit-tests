# 21번 출제·검수 증적 리포트 (Luxury Real Estate for Weeds)

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/6월_2024/21번` (2024년 6월 고1 모의고사 21번, 함축의미 지문)
**출제 모델**: Opus 4.8

## 최종 요약

| 테스트 | 문항 | 총점 | validate | blind | cross-blind | adversarial HIGH |
|---|---|---|---|---|---|---|
| 단어 | 20 | 100 | PASS | 20/20 | 20/20 | 0 |
| 워크북 | 20 | 100 | PASS | 20/20 | 20/20 | 0 |
| 퀴즈(예상문제) | 20 | 100 | PASS | 20/20 | 20/20 | 0 |

- N7 크로스파일(워크북↔예상문제 정답중복): **PASS (0건)**
- validate 잔여 경고: B급(P2 마커 위치, Q6-WEAK-DISTRACTOR)만 — 차단 대상 아님

## 배점 분포 (모두 쉬움5×4=20 + 보통10×5=50 + 어려움5×6=30 = 100)

- **단어**: 쉬움 Q1·4·5·7·10 / 보통 Q2·6·8·9·11·12·13·16·17·19 / 어려움 Q3·14·15·18·20
- **워크북**: 쉬움 Q1·2·7·12·18 / 보통 Q3·5·6·8·9·10·13·15·17·19 / 어려움 Q4·11·14·16·20
- **퀴즈**: 쉬움 Q1·8·14·16·19 / 보통 Q2·4·6·7·9·10·11·15·17·20 / 어려움 Q3·5·12·13·18

## 정답 분포 (동일번호 ≤5, 연속 ≤2 준수)

- 단어: {1:5, 2:5, 3:4, 4:4} (객관식 18문항, Q17·18 서술형)
- 워크북: {1:4, 2:4, 3:4, 4:4} (객관식 16문항, Q15·16·17·20 서술형)
- 퀴즈: {1:4, 2:4, 3:4, 4:3} (객관식 15문항, Q16~20 서술형)

## 유형 구성

- **단어**: (A)(B)(C) 조합형×3, 문맥상 부적절한 어휘×3, 빈칸 어휘 완성×3, 동의어×3, 반의어×2, 다의어(field), 영영풀이(fertilizer), 어형변환×2(achieved/supplying), 빈칸 문맥 완성×2
- **워크북**: 어법×4(수동태/현재완료/by+동명사/관계사 수일치), 어휘×2, 내용이해 T/F×3, 빈칸추론×2, 내용일치/불일치×2, 오류찾기(주어-동사 수일치), 서술형 찾기×2(perfect environment / we are feeding and watering our fields), 어형변환(helped), 주제/요지×2, 조건영작(This is achieved by adding nutrients)
- **퀴즈**: 어법×3(현재완료형/전치사+동명사/연결동사+형용사), 문맥부적절×2, 빈칸추론×3, 내용일치/불일치×3, 주제(영어선지), 제목(영어선지), 함축의미(luxury real estate), 지칭추론(both), 조건영작×3, 어형변환(excited), 어순배열(relative to the natural land that surrounds them)

## 검수 이력 (주요 수정)

1. 퀴즈 Q11 주제: 영어선지 "...attract unwanted weeds"가 S-CH-TRUNCATED 오탐(att-ract) + 50자 초과 → "how fertile farm fields draw in weeds too"로 축약, 정답 슬롯 보존.
2. 퀴즈 Q17 어형변환: 단문(123자) V63(A급) 차단 → 2문장 발췌(s2+s5, s2에는 다른 문항 정답 없음)로 확장. 정답 excited 미노출 유지.
3. **퀴즈 Q19 어순배열(적대검수 HIGH 해결)**: 초기 대상 "engineers and crop scientists..."는 등위접속사 and로 "crop scientists and engineers..."도 성립(정답 2개) → and 없는 유일배열 "relative to the natural land that surrounds them"으로 재출제. HIGH 0건 확정.

## N7 분리 설계 (워크북↔퀴즈 정답 비중복)

- 워크북 서술형/빈칸 정답: perfect environment · we are feeding and watering our fields · helped · This is achieved by adding nutrients · certain agricultural undesirables · loaded with nutrients and water
- 퀴즈 서술형/빈칸 정답: the right amount of both · the perfect environment for monoculture growth · every random weed in the area · the global capacity for irrigation has almost doubled · excited · farm fields are loaded with nutrients and water · relative to the natural land that surrounds them · and our crops are loving it
- 문자열 완전일치 0건 → N7 PASS

## 배포 가능 여부

✅ 증적 4종(blind/cross-blind/adversarial/audit) 충족 · validate PASS · N7 PASS · HIGH 0건. 배포는 총괄 담당(본 세션은 파일만 생성).
