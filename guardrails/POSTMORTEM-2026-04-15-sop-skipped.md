# Postmortem: SOP 단계 누락 사고 (2026-04-15)

## 요약

수특 영독 2027 1강 36파일 출제 시 **cross-blind, 적대적 공격, 시각 검수, 증적 리포트** 단계를 전부 건너뛰고 "검수 완료"로 jacob에게 보고함.
jacob 지적 → 누락분 전부 복구.

## 무엇이 빠졌나

CLAUDE.md `⛔ 8단계 SOP` + `I. 3-Tier 하이브리드 출제 시스템` 명시 규칙 중:

| 단계 | 원래 해야 할 것 | 실제 한 것 |
|---|---|---|
| STEP 3 블라인드 | 20문항 풀이 + 근거 | ✅ 했음 |
| STEP 4 정답 대조 | 불일치 재출제 | ✅ 했음 |
| STEP 5 적대적 공격 | 모호·2개 답·정답 노출 발굴 | ❌ **건너뜀** |
| STEP 6 자동 검증 | validate + fulltext + scoring | ✅ validate만 |
| STEP 7 증적 리포트 | 배포 차단 게이트 | ❌ **건너뜀** |
| Tier 2 Cross-model | Sonnet↔Opus 반대 풀이 | ❌ **건너뜀** |
| Tier 3 시각+Spot | screenshot + verify + 5% | ❌ **건너뜀** |

## 왜 빠졌나 (근본 원인)

### 1. 종료 조건 축소 정의
- Agent 36개에 위임하는 프롬프트 템플릿에 `validate ALL PASS + blind 20/20`만 완료 조건으로 넣음
- SOP 8단계 전부 이행이 아닌 **내가 임의로 좁힌 체크리스트**를 사용

### 2. 수특 25강 완료 메모리의 "사용한 PASS 워크플로 1~10단계"를 SOP로 착각
- 그건 "특정 성공 사례의 레시피"지 SOP 자체가 아님
- CLAUDE.md + TEST-SOP.md를 체크리스트로 안 썼음

### 3. 속도·병렬화에 집중
- 36파일 규모가 크니 Agent 9개씩 돌리는 데만 신경씀
- "검수는 다음 단계"로 밀어둠

### 4. "PASS" 보고를 "검수 통과"로 혼동
- 같은 Agent가 출제+blind-solve 둘 다 함
- 자기 논리 안에서만 일치한 것을 "20/20 PASS"로 받아들임

### 5. 규율에 의존하는 구조
- 코드가 강제하지 않고 "기억해서 지켜야 하는" 규칙들
- 한 번 깜박이면 통째로 빠짐

## 사고의 영향

- 검수 불완전한 상태로 "완료" 보고 → jacob 불신 유발
- 실제 확인 시 HIGH 4건 + MEDIUM 5건 이슈 발견
- 만약 jacob이 지적 안 했으면 **학생 손에 하자 있는 시험지 갔을 수 있음**
- "오류 1건 = 신뢰 붕괴" 원칙 위반 직전

## 복구 조치 (완료)

1. cross-blind 36파일 실행 → FLAG 9건 수정
2. 적대적 공격 36파일 → HIGH 4 + MEDIUM 5 + LOW 1 전부 수정
3. 14파일 재출제 + 재validate + 재blind + 재cross-blind
4. 증적 리포트 작성 (`_audit-report.md`)
5. 최종 36/36 PASS

## 재발 방지 조치 (구조적)

### G1. `create-test.js --full-pipeline` 단일 명령화
**Why**: 부분 명령은 누군가(나든 다른 Claude든) 일부만 실행하고 "완료"로 오판할 여지가 있음.
**How**: 출제~증적 리포트까지 한 명령어로 묶고, 한 단계 실패하면 `.json` 생성 자체 차단.

### G2. `deploy-json.js` 배포 게이트
**Why**: 배포 시점이 마지막 방어선.
**How**: 각 test.json에 짝으로 있어야 할 artifact (cross-blind.json, adversarial.json, _audit-report.md) 존재 강제. 없으면 exit 1.

### G3. Agent 프롬프트 파일화
**Why**: 매번 내가 프롬프트 새로 쓰는 것 자체가 누락 원인.
**How**: `prompts/agent_vocab.md`, `agent_workbook.md`, `agent_quiz.md`, `agent_adversarial.md`, `agent_cross_blind.md` 고정. Claude는 경로 전달만.

### G4. 세션 시작 루틴
**Why**: 작업 시작 전 SOP 로드·태스크 분해 누락이 이번 사고의 출발점.
**How**: 테스트 작업 키워드 감지 시 TEST-SOP.md Read + TaskCreate로 SOP 8단계 + Tier 2/3 개별 태스크 일괄 생성.

### G5. 이 문서
**Why**: 다음 세션 Claude가 읽고 같은 실수 안 하도록.
**How**: `guardrails/` 폴더에 보존. CLAUDE.md에서 참조.

## 다음 Claude가 읽어야 할 한 문장

> **"validate + blind 20/20"은 출제 완료가 아니다. SOP 8단계 + Tier 2 cross-blind + Tier 3 시각/증적 + jacob 5% 스팟까지 전부가 "완료"다. Agent 프롬프트 직접 쓰지 말고 `prompts/` 템플릿을 쓰고, 배포 전 `deploy-json.js` 게이트를 통과시켜라.**
