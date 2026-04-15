# Multi-Agent Cross-Check 프로토콜 (Tier 1+2 API-less)

## 목적
API 비용 0 유지하면서 3-Tier 하이브리드 출제/검수 완전 가동.
- Tier 1 (Generation): Sonnet 90% / Opus 10%
- Tier 2 (Cross-Model Validation): Opus blind-solve + Sonnet adversarial
- Tier 3 (Spot Check): 메인 + jacob 수동

모든 에이전트는 Claude Code Task 도구(구독 범위)로 spawn. API 호출 없음.

## 파이프라인 한 싸이클 (1 파일)

### STEP 1 — 프롬프트 생성 (스크립트)
```bash
node create-test.js --source <부교재|교과서|모의고사> --path <경로> --type <단어|워크북|퀴즈>
# → .prompt.json 생성 (슬롯+overlay 규칙+fullPassage)
```

### STEP 2 — Agent G 출제 (메인이 Task 호출)
메인 Claude가 Task 도구로 출제 에이전트 spawn:
```
Task({
  subagent_type: "general-purpose",
  model: "sonnet",  // 평이한 단어/워크북/퀴즈
                    // "opus" — 함축의미/다의어/모의 41-45번/새 교재 첫출제
  description: "출제 에이전트 G",
  prompt: `<.prompt.json 내용>을 읽고 20문항 response.json 작성.
    AI는 판단만(stem/ch/ans/overlay/det). 스크립트가 조립.
    passage는 절대 복붙하지 마세요.
    출력: <path>/<type>.response.json`
})
```

### STEP 3 — 조립 + validate (스크립트)
```bash
node create-test.js --assemble <path>/<type>.response.json
# → <path>/<type>.json 생성 + validate + blind-solve auto
```

### STEP 4 — Agent V blind-solve (메인이 Task 호출, Opus)
```bash
node scripts/cross-check.js verify <path>/<type>.json
# 출력: Task 프롬프트
```
메인이 출력된 지시문대로 Task 호출:
```
Task({ subagent_type: "general-purpose", model: "opus",
       description: "독립 블라인드 풀이", prompt: <지시문> })
```
Agent V는 passage+stem+ch만 보고 풀이 → `/tmp/cross_verify_output_*.json` 저장

### STEP 5 — Agent A 적대적 스캔 (메인이 Task 호출, Sonnet)
```bash
node scripts/cross-check.js adversarial <path>/<type>.json
```
메인이 Task 호출:
```
Task({ subagent_type: "general-purpose", model: "sonnet",
       description: "적대적 검수", prompt: <지시문> })
```
Agent A는 "passage 없이 풀리는지"/"편법 가능성" 스캔 → `/tmp/cross_adversarial_output_*.json`

### STEP 6 — 통합 판정 (스크립트)
```bash
node scripts/cross-check.js compare <path>/<type>.json <verify-out> <adversarial-out>
# 출력: {"verdict": "PASS|REVIEW|BLOCK", "mismatches": [...], "adversarial": [...]}
```

### STEP 7 — verdict 별 조치
- **PASS**: 그대로 deploy-json 단계로
- **REVIEW**: 메인이 해당 문항 수동 판단 → 수정 or 승인
- **BLOCK**: 해당 문항 재출제 (Agent G 다시 호출, 더 구체적인 지시 포함)

## 모델 선택 가이드

| 유형 | 출제 모델 | 검수 모델 | 이유 |
|---|---|---|---|
| 단어 (동의어/반의어/빈칸어휘) | Sonnet | Opus | 패턴 명확, 빠른 생성 |
| 워크북 표준 | Sonnet | Opus | 평이 |
| 퀴즈 표준 | Sonnet | Opus | 평이 |
| 함축의미·다의어 | Opus | Opus | 맥락 미묘 |
| 모의고사 41-45번 (장문) | Opus | Opus | 긴 passage 해석 |
| 새 교재 첫출제 | Opus | Opus | 기준 확립 필요 |

## 자동 escalation 규칙
- validate FAIL 3회 연속 → Opus로 전환
- compare verdict=BLOCK → Opus로 재출제
- compare verdict=REVIEW이고 confidence=high mismatch → Opus로 재확인

## ⛔ 금지 사항
- API 호출 (ANTHROPIC_API_KEY) 사용 코드 추가 금지
- 서브에이전트가 정답/해설 파일 참조 금지 (cross-check.js가 자동으로 정답 field 제거)
- `--no-verify` 우회 금지
- Agent V/A가 서로 결과 공유 금지 (독립성 보장)

## 점검 체크리스트 (각 파일당)
- [ ] validate.js 23종 S급 PASS
- [ ] Agent V blind-solve mismatches ≤ 0 (high confidence)
- [ ] Agent A adversarial flags severity=high 0건
- [ ] compare verdict = PASS or REVIEW 승인 완료

## 비용
- Claude Code 구독 범위 내 작동
- API 크레딧 소모 0
- 서브에이전트 메시지 한도는 구독 플랜(Max 등)에서 처리
