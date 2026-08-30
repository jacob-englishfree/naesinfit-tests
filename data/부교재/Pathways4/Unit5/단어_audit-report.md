# 테스트 검증 리포트
- 파일: data/부교재/Pathways4/Unit5/단어.json
- 대상: Pathways 4 / Unit5 "The Smart Swarm" (National Geographic Pathways RW3, 양지원 부교재)
- 유형: 단어 (20문항 / 100점)
- 생성일: 2026-08-30
- 모델: Claude Opus 4.8 (1M)

## [STEP A] 출제 + 구조 검증: PASS (S/A급 0건)
- validate: **PASS** (9 warnings 전부 B급, 비차단)
- 배점 분포: 쉬움 5×4=20 / 보통 10×5=50 / 어려움 5×6=30 = **100점**
- ans 분포: {1:5, 2:5, 3:4, 4:4} — 최대 5개, 3연속 없음 ✓
- 유형: (A)(B)(C)×3, 부적절어휘×3, 빈칸어휘×3, 동의어×3, 반의어×2, 다의어×1, 영영풀이×1, 어형변환×2, 빈칸문맥×2 (전부 단어 화이트리스트)

### 수정 이력 (STEP A 반복)
1. **F7 (ei.lesson 누락)** — buildEi 부교재 분기가 2-part sourcePath(Pathways4/Unit5)의 passage 메타데이터를 무시. `passageData.lesson` 존재 시 passage json에서 subject/pub/lesson/section을 사용하도록 수정(빠른독해·이투스·올림포스 등 parts 기반 교재는 fallback으로 기존 동작 유지). Ch3 기배포 ei와 동일 산출.
2. **S-ANTONYM-PREFIX (Q8 오답 "distant")** — dis- 접두 오탐 → 오답을 "outdated"로 교체.

### 잔여 B급 warning (비차단, 분석 완료)
- EX-3 (Q1~3): (A)(B)(C) 마커 렌더 형식 `[정답 / 오답]`을 검사 정규식이 `</b> word`로만 파싱해 생기는 **오탐**. 정답 단어는 지문 내 1회(마커 위치)만 등장 실측 확인.
- P2 (Q15/17/18): 다의어(직접작성 passage)·어형변환(발췌) 유형 특성상 정상.
- Q6-WEAK-DISTRACTOR (Q7~9): 빈칸 어휘 오답이 실단어(비지문어)라 뜨는 권고성 경고. 오답 전부 유의미한 대안이라 유지.

## [STEP B] 블라인드 풀이: 20/20 일치
- 정답 비공개 상태에서 passage+선지만으로 재풀이 → `단어.blind.json`
- 채점 대조 결과 **20/20 MATCH** (mc 18 + 서술형 2)

## [STEP C] Cross-blind prep: 완료
- `단어.cross-prompt.json` 생성 (반대 모델 풀이는 별도 세션). cross-blind.json 미생성.

## [STEP D] 적대적 공격: HIGH 0건
- 총 이슈 3건 (전부 **LOW**): Q9 오답 함정(연어로 배제), Q13 de- 접두 반의어(핵심개념·소거법 차단), Q20 추론 난이도(어려움 의도).
- 이중정답·정답노출·문법오류·passage무관: **0건**
- 정답 지문 노출 점검: 빈칸 5문항(instructions/relevant/options/life or death/rules of thumb) 전부 지문 내 1회, 인접 5단어 내 노출 없음. 반의어 정답(centralized/harmless)은 지문 부재.

## [STEP 검증 요약]
- validate: PASS / blind: 20/20 / adversarial HIGH: 0
- 마커·빈칸 분산: ①②③④ 및 (A)(B)(C) 전부 지문 앞/중/뒤 오름차순 배치 실측
- overlay 단어 전량 fullPassage 정확 substring (grep 실측)

## 최종 판정: 배포 가능 (jacob 확인 후)

### 주의사항
- 원문 대조: Unit5.json fullPassage 기준 출제(별도 원본 PDF 재대조는 배포 전 jacob 확인 권장).
- 배포 시 test-deploy.ts sections에 Unit5 등록 + catalog 재생성 + textbooks.ts path 확인 필요.
