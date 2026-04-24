# Audit Report: 빠른독해바른독해 구문독해 1과 2번

## 테스트 현황
| 테스트 | 문항 | 총점 | validate | blind | cross-blind | adversarial |
|--------|------|------|----------|-------|-------------|-------------|
| 단어 | 20 | 100 | PASS | 20/20 | N/A | 0 HIGH |
| 워크북 | 20 | 100 | PASS | 20/20 | N/A | 0 HIGH |
| 퀴즈 | 20 | 100 | PASS | 20/20 | N/A | 0 HIGH (fixed) |

## Adversarial Issues

### 단어 (0 HIGH, 0 MEDIUM, 2 LOW)
- No HIGH/MEDIUM issues. LOW: Q7, Q19 정답이 passage에 노출되나 단어테스트 특성상 허용.

### 워크북 (0 HIGH, 0 MEDIUM, 3 LOW)
- No HIGH/MEDIUM issues. LOW: Q10 오답 유사성, Q15/Q16 찾기 유형 정답 노출(정상).

### 퀴즈 (0 HIGH — 1 HIGH 수정 완료)
- **[FIXED] Q14**: 지칭추론 밑줄 위치 수정. `<u>This</u>`를 2번째 문장 "This internal clock"에서 7번째 문장 "This tends to make it more difficult..."로 이동. 정답(①동쪽 이동이 주기를 단축시키는 현상)과 밑줄 위치 일치.

## validate warnings (B-level only)
- EX-1: Q6 빈칸 정답 노출 (circadian rhythm — 참고)
- EX-2: Q16, Q17 서술형 정답 노출 (찾기 유형 — 정상)
- C20: histKey 패턴 불일치
- P2: Q1, Q3, Q4 passage 앞부분 fullPassage 불일치 (어법 변형)
- T39: Q18 어순배열 위치

## Sign-off
- [ ] jacob 확인
