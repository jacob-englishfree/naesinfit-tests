# Audit Report: 올림포스독해의기본1 / 2025 / 11강 / 예상문제(퀴즈) Q16-18 S급 재출제

## 기본 정보
- 대상 파일: `11강/{Analysis,1번,2번,3번}/퀴즈.json` (4개)
- 일자: 2026-09-01
- 작업: S급 위반(라이브 노출중) 재출제 — Q16·Q17·Q18
- 출제/수정 모델: claude-opus-4-8
- 검수 모델: claude-opus-4-8 (blind) + 독립 Opus 에이전트 4개 (cross-blind) + adversarial

## 사고 경위 / 조치
- **문제**: 각 파일 Q16(서술형)·Q17(서술형)·Q18(서술형 — 핵심단어)이 "본문에서 찾아 쓰시오" 찾기·핵심단어형 → 규칙 #24(S-QUIZ-WRITTEN-SAFE-TYPE) + TW-TYPE 위반. 자동채점 복수정답 위험.
- **조치**: Q16/17/18 전부 **서술형 — 조건영작**으로 재출제.
  - 원문(fullPassage) 그대로 유지, 정답 자리만 `__________` 빈칸 처리 → 본문 정답 노출 제거(EX-2 해소)
  - [조건]에 wa 전 토큰 명시 + **알파벳 정렬**로 정답순 누설 차단(S-WRITTEN-TOKEN-LEAK)
  - Q19·Q20(조건영작·정상), 단어·워크북은 미변경
- **난이도 위계 유지**: Q16 쉬움(4) / Q17 보통(5) / Q18 어려움(6), 총점 100 불변

## 재출제 정답 (blind 80/80 일치)
| 파일 | Q16 (쉬움) | Q17 (보통) | Q18 (어려움) |
|------|-----------|-----------|-------------|
| Analysis | has a negative effect on their self-esteem (7) | monitor the post to gauge the volume of reactions (9) | suffer perceived judgement from others against their failed efforts (9) |
| 1번 | A pessimistic stance is a safe one (7) | The reason pessimists often sound smart (6) | When a doomer predicts that the world will end in five years (12) |
| 2번 | Our experiences simply are not yours (6) | which told him about what ordinarily happens at cocktail parties (10) | understanding required one to find the correct knowledge structure (9) |
| 3번 | Relatively few butterflies are red either (6) | shades of reddish-brown that conceal rather than advertise (8) | the one that makes the greatest impact on the eye is red (12) |

## 복수정답(자동채점) 위험 점검 및 처리
어순 중의성이 있는 3건은 유효 변형을 accept에 다중 등록:
- 1번 Q17: 이동가능 불변화사(push back) 회피 위해 문구 자체를 부사무이동형으로 교체
- 2번 Q16: `are simply not` 어순 accept 추가
- 2번 Q17: `happens ordinarily` 어순 accept 추가
- 그 외 9문항: 유일 어순 확인

## validate 결과 (4파일 전부)
- S급 에러: 0건 / A급 에러: 0건
- B급 경고: 기존 MCQ(P2/Q6-WEAK 등)에 한한 허용 범위, 재출제 문항엔 신규 S/A 0

## 검수 (2층)
1. **코드 게이트**: `node validate/validate.js` — 4파일 PASS (S/A 0)
2. **블라인드 재풀이**: 정답 가린 20문항 × 4파일 = 80문항, 독립 Opus 에이전트 4개가 재구성 → **80/80 stored 정답 일치**. Q16-18 조건영작 전부 유일 어순으로 복원됨.
3. **adversarial**: HIGH 0건 (4파일)

## 판정
- **PASS** — 4파일 배포 가능. Q16-18 규칙 #24/TW-TYPE 위반 해소, 복수정답 위험 제거, 블라인드 100% 일치.


---

## 2026-09-01 세션 A — "전체" 퀴즈 Q16·17·18 재출제 (S-QUIZ-WRITTEN-SAFE-TYPE 해소)

- **사유**: Q16·17(서술형 찾기)·Q18(핵심단어) = 예상문제 금지유형(자동채점 복수정답 위험). 개별섹션은 기수정, "전체" 통합본만 잔존(주혜원 subKeys=["전체"]).
- **조치**:
  - Q16(쉬움4): 서술형 — 어형변환. 1문단 2문장 발췌, have _____(discover) → discovered (현재완료)
  - Q17(보통5): 서술형 — 어순배열. 3문단 "an understander brought out his cocktail party script" 빈칸, 토큰 8개 알파벳순
  - Q18(어려움6): 서술형 — 조건영작. 2문단 "they can avoid being wrong by moving the goalposts" 빈칸, 9단어, 조건 토큰 알파벳순 + 주어 they 시작 조건으로 별해 차단
  - Q19·20: [조건] 토큰이 정답순 나열 → 알파벳순 재정렬 (콤마 나열형 validate 사각지대)
  - Q6(적대검수 파생): ③ the standards(의미상 성립 오답) → the audience 교체 + det 근거 보강
  - histKey v5 → v6 (재응시 초기화)
- **검증**: validate/fulltext/scoring 3종 PASS · 독립 블라인드 20/20 · 2차 회의검산 20/20(별해 0) · 적대검수 HIGH 0 · render-check PASS · PNG 시각검수
