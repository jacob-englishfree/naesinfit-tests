# 32번 출제·검수 증적 리포트

**생성일**: 2026-09-13
**대상**: `data/모의고사/고1/6월_2024/32번` — 2024년 6월 고1 모의 32번 (빈칸, "Attention Reshapes the Brain")
**출제자**: Opus (내신해방공식 테스트 파이프라인)

## 최종 요약

| 섹션 | 유형 | 문항/총점 | 배점분포(쉬움/보통/어려움) | validate | blind(불일치) | cross-blind | adversarial HIGH |
|---|---|---|---|---|---|---|---|
| 단어 | 단어 | 20 / 100 | 5×4 / 10×5 / 5×6 | PASS ([S] 0) | 20/20 (0) | PASS 20/20 | 0 |
| 워크북 | 워크북 | 20 / 100 | 5×4 / 10×5 / 5×6 | PASS ([S] 0) | 20/20 (0) | PASS 20/20 | 0 |
| 퀴즈(예상문제) | 퀴즈 | 20 / 100 | 5×4 / 10×5 / 5×6 | PASS ([S] 0) | 20/20 (0) | PASS 20/20 | 0 |

- **N7 크로스파일(워크북↔예상문제 정답 중복)**: PASS (0건)
- ans 분포: 단어 {1:5,2:4,3:4,4:5} / 워크북 {1:4,2:4,3:4,4:4} / 퀴즈 {1:4,2:4,3:4,4:3} — 모두 동일번호 ≤5, 3연속 없음

## 유형 구성

- **단어**: (A)(B)(C) 조합형×3, 문맥상 부적절 어휘×3, 빈칸 어휘×3, 동의어×3, 반의어×2, 다의어×1, 영영풀이×1, 어형변환×2, 빈칸 문맥×2
- **워크북**: 어법×4, 어휘×2, 내용이해 T/F×3, 빈칸추론×2, 내용 일치/불일치×2, 오류찾기×1, 서술형 찾기×2, 어형변환×1, 주제/요지×2, 조건영작×1
- **퀴즈**: 어법×3, 부적절 어휘×2, 빈칸추론×3, 내용 일치/불일치×3, 주제×1, 제목×1, 함축의미×1, 지칭추론×1, 조건영작×3, 어형변환×1, 어순배열×1

## 원문 정답 보호 (빈칸 지문 규칙)

- 원문 32번 정답 `the reshaping of the brain`(빈칸②)은 이미 채워져 있으며, 세 테스트 모두 **다른 핵심표현**에 새 빈칸/서술형을 출제해 정답 노출 없음.
- 워크북 빈칸/서술형: vital for spatial memory, noticing sound, focused attention, cortex, rewarded, Brain scans of violinists provide more evidence
- 퀴즈 빈칸/서술형: much larger auditory centers, what we practice doing, dramatic growth and expansion, physical architecture of the brain changes, showing, regions of the cortex that represent the left hand, In animals rewarded for sharp eyesight the visual areas are larger, we find much larger auditory centers in the brain
- 위 두 집합은 **상호 배타**(N7 PASS).

## 비차단 경고([B]) 처리

- **단어 EX-3(Q1~3)**: (A)(B)(C) 마커가 `[X / Y]` 렌더 형식이라 validate 정규식이 마커 위치 단어를 못 읽어 생긴 **오탐**. 정답 단어는 선택지 괄호 안에만 존재하고 지문 산문에는 노출 없음.
- **P2 경고(각 섹션 일부)**: 마커/발췌 삽입으로 passage 앞부분 비교가 어긋난 오탐. 어형변환은 규정상 발췌.
- **워크북 EX-2(Q15/Q16)**: 서술형 '찾기' 유형이라 정답 노출이 유형 본질(의도됨).

## 배포 가능 여부

✅ **게이트 통과** — validate [S] 0 / blind 20·20·20 완결(불일치 0) / cross-blind 3종 PASS / adversarial HIGH 0 / N7 PASS.

### jacob 본인 확인 권장
- [ ] 실기기 카카오톡에서 학생 링크 접속 테스트
- [ ] 무작위 스팟 풀이 (특히 퀴즈 서술형 자동채점 NORM 확인)
- [ ] 배포(DB/shared/catalog)는 총괄 담당 — 본 세션은 파일만 생성
