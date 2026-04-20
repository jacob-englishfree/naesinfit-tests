# Audit Report: 빠른독해바른독해 구문독해 1과 1번

## 테스트 현황
| 테스트 | 문항 | 총점 | validate | blind | cross-blind | adversarial |
|--------|------|------|----------|-------|-------------|-------------|
| 단어 | 20 | 100 | PASS | 20/20 | N/A | 0 HIGH |
| 워크북 | 20 | 100 | PASS | 20/20 | N/A | 0 HIGH |
| 퀴즈 | 20 | 100 | PASS | 20/20 | N/A | 0 HIGH (fixed) |

## Adversarial Issues

### 단어 (0 HIGH, 0 MEDIUM, 2 LOW)
- No HIGH/MEDIUM issues. LOW: Q7, Q20 정답이 passage에 노출되나 단어테스트 특성상 허용.

### 워크북 (0 HIGH, 0 MEDIUM, 3 LOW)
- No HIGH/MEDIUM issues. LOW: Q11 오답 career/professional 유사성, Q15/Q16 찾기 유형 정답 노출(정상).

### 퀴즈 (0 HIGH — 4 HIGH + 1 MEDIUM 수정 완료)
- **[FIXED] Q7**: ans=3(internet) -> ans=3(values). ch 순서 재배치: ["salary","internet","values","schedule"]. det 인덱스 수정.
- **[FIXED] Q8**: ans=4(모든 기업 변화) -> ans=1(유연성 중시). ch 순서 재배치: 일치하는 선지를 ①로 이동. det 수정.
- **[FIXED] Q9**: ans=1(인터넷 사용 성장=일치) -> ans=4(급여>일정=불일치). stem "일치하지 않는 것"에 맞게 수정.
- **[FIXED] Q12**: ans=4(소비 패턴) -> ans=3(직장 환경 혁신). det.analysis와 일치하게 수정.
- **[FIXED] Q15**: det 설명을 밑줄친 them 위치("important to them")에 맞게 수정. 정답(Z세대)은 동일.
- 정답 분포 재조정: {1:4, 2:4, 3:5, 4:2} — A6/A7 PASS.

## validate warnings (B-level only)
- EX-2: Q16, Q17 서술형 정답 노출 (찾기 유형 — 정상)
- C20: histKey 패턴 불일치
- P2: Q2 passage 앞부분 fullPassage 불일치 (어법 변형)
- T39: Q18 어순배열 위치

## Sign-off
- [ ] jacob 확인
