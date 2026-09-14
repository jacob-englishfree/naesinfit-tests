# AUDIT REPORT — Reading Expert 5 Unit 11 "Biotechnology (Biomimetics)" 11강/전체

- 검수일: 2026-09-13 (Opus 4.8, main 세션 직접 검증)
- 학생: 김가윤(전남외고 고1) W3 / contentId: ReadingExpert-11강
- 원문: 김가윤 교재 실물 사진 판독 정본 17문장. fullPassage ↔ 정본 **323단어 정규화 100% 일치**.

## 종합
| 항목 | 단어 | 워크북 | 퀴즈 |
|---|---|---|---|
| validate | ✅ PASS (10 warn, 전부 B급) | ✅ PASS (5 warn) | ✅ PASS (3 warn) |
| 문항수/총점 | 20 / 100 | 20 / 100 | 20 / 100 |
| 정답분포(≤5) | 1:5 2:5 3:4 4:4 | 2:5 1:4 3:4 4:3 | 1:4 2:4 3:4 4:3 |
| 블라인드 재풀이 | 부적절어휘·어형변환 스팟 정답 | 어법·오류찾기·서술형 스팟 정답 | **20/20 전수 정답** |
| 서술형 정답 지문노출 | — | — | **0/4 (전부 blanked)** |
| N7(워크북↔퀴즈 중복) | — | **0건** | 0건 |
| adversarial HIGH | 0 | 0 | 0 |

## 유형 분포
- 단어: (A)(B)(C)조합 3·부적절어휘 3·빈칸어휘 3·동의어 3·반의어 2·다의어 1·영영 1·어형변환 2·빈칸문맥 2
- 워크북: 어법 4·어휘 2·T/F 3·빈칸추론 2·일치불일치 2·오류찾기 1·서술형 2·어형변환 1·주제요지 2·조건영작 1
- 퀴즈: 어법 3·부적절어휘 2·빈칸추론 3·일치불일치 3·주제 1·제목 1·함축 1·지칭 1·조건영작 3·어형변환 1·어순배열 1 (서술형 5 = 안전유형만, rule24 준수)

## 수정 이력
- **퀴즈 Q17 어형변환**: 발췌 2번째 문장이 원문 미포함(날조) → 원문 verbatim(s12 앞부분 + s13)으로 교체. wa="hoped" 보존, 타 문항 정답(brain temperatures/similar state) 미노출. validate PASS 유지.

## 정답 정확성 표본 근거
- 퀴즈 어법: ②put→putting(by+동명사)·③using→used(silk 수식 수동)·④treat→treating(of+동명사)
- 퀴즈 빈칸: harsh environments(s6)·brain temperatures(s11)·similar state(s12)
- 퀴즈 일치/불일치: s7(자연에서 해결책)·s15(홍합 무독성 접착제)·s13-14(의료만이 아님=불일치)
- 단어 부적절: poisonous→non-toxic(s15)·weak→strong(s10)·easy→challenging(s6)
- 워크북 어법: allows→allow(processes 복수)·copying→copied(수동)·them→themselves(재귀)·harvesting→harvested(병렬)

## 잔여 경고 (전부 B급 비차단 = 오탐)
- P2: (A)(B)(C) 브래킷·어형변환 발췌·다의어 미니문맥이 fullPassage 앞부분과 불일치 → 유형 특성상 정상
- Q6-WEAK: 어휘 오답이 본문 미등장 → 어휘 오답은 본문 밖이 정상

## 배포 가능 상태
- 증적 4종/파일(response·cross-blind·adversarial + 폴더 audit) 구비 → **STRICT_GATE 통과 조건 충족(GREEN)**.
- ⛔ 실제 배포(test-deploy/catalog/DB/wd)는 총괄 승인 대기.
