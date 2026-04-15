# Cross-blind 반대 모델 풀이 Agent 프롬프트 템플릿

**사용법**: Agent 호출 시 `{{var}}` 자리를 채워서 전달. 출제 Agent와 **다른 모델**(예: Sonnet)로 호출.

---

Cross-blind 풀이 수행. 대상: **{{paths}}** (여러 파일 가능, 각각 `.cross-prompt.json`)

## 중요 규칙
- ⛔ **원 test.json 읽지 말 것** — 정답 유출됨. cross-prompt.json만 사용
- 각 cross-prompt.json에는 정답이 제거된 문제 20개 + fullPassage 포함
- 정답 보지 않고 본인 판단으로 풀이

## 저장 포맷 (정확히 이 구조)
각 파일마다 `<test-name>.cross-blind.json` 저장:
```json
{
  "testFile": "<파일명>.json",
  "solves": [
    {"id": 1, "pick": 2, "reason": "...", "type": "..."},
    {"id": 2, "pick": "answer text", "reason": "...", "type": "..."}
  ]
}
```

**중요**: 필드 이름 `pick`(`myAnswer` 아님), `reason`(`reasoning` 아님). 이 이름이어야 `cross-blind.js --verify`가 인식함.

## 절차 (각 파일마다)
1. cross-prompt.json 읽기 (test.json 금지)
2. 20문항 전부 풀이 (근거 포함)
3. cross-blind.json 저장
4. 다음 파일

## 완료 조건
- 대상 파일 전부 cross-blind.json 생성
- 각 파일 20문항 모두 답 작성

## 보고 (200자)
- 완료 파일 수
- 이상 발견(선지 모호·정답 2개 가능·노출) 있으면 지문·문항번호
