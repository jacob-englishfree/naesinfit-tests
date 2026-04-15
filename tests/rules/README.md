# Meta-Test: validate.js 규칙별 회귀 방지

## 목적
validate.js에 새 규칙을 추가하거나 기존 규칙을 수정할 때, 다른 규칙이 영향받지 않도록 **각 규칙마다 golden sample (PASS/FAIL fixture)** 을 유지하고 자동 회귀 검증.

## 디렉토리 구조
```
tests/
├── fixtures/
│   ├── S-META-CHOICE/
│   │   ├── pass.json     # 이 규칙에 걸리지 않아야 함
│   │   └── fail.json     # 이 규칙에 반드시 걸려야 함
│   ├── S-ANTONYM-PREFIX/
│   ├── S-ANTI-CHEESE-GATE/
│   ├── S-MULTI-ITEM-WRITTEN/
│   ├── S-DUPLICATE-ITEM/
│   ├── S-DISTRACTOR-ALL-FIRST-SENT/
│   └── S-MULTI-CORRECT/
└── rules/
    └── run.js            # test runner
```

## 실행
```bash
node tests/rules/run.js
# 또는 npm run test:rules
```

## fixture 작성 규칙
- 각 fixture는 실제 test JSON 구조 (20문항, 100점, 필수 필드)
- 최소한의 조작으로 해당 규칙만 위반/비위반되도록 작성
- 다른 규칙을 부수적으로 트리거하지 않도록 주의
- fail.json의 경우 **해당 규칙만 위반** (다른 규칙은 PASS여야 함)

## 새 규칙 추가 시 필수 절차
1. validate.js에 규칙 코드 추가
2. `tests/fixtures/<RULE-ID>/` 폴더 생성
3. `pass.json` + `fail.json` 작성
4. `node tests/rules/run.js` 실행하여 모든 fixture 통과 확인
5. PR/commit 전 필수

## 규칙별 fixture 상태
| 규칙 | pass | fail | 상태 |
|---|---|---|---|
| S-META-CHOICE | ✅ | ✅ | 완료 |
| S-ANTONYM-PREFIX | - | - | TODO |
| S-ANTI-CHEESE-GATE | - | - | TODO |
| S-MULTI-ITEM-WRITTEN | - | - | TODO |
| S-DUPLICATE-ITEM | - | - | TODO |
| S-DISTRACTOR-ALL-FIRST-SENT | - | - | TODO |
| S-MULTI-CORRECT | - | - | TODO |

(나머지 16종 S급 규칙 점진적 확장)
