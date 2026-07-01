# Audit Report: 빠른독해유형독해 02-02

## P01 단어 테스트

- **문항 수**: 20문항 (mc 18 + written 2)
- **총점**: 100점
- **배점 분포**: 쉬움 5x4=20, 보통 10x5=50, 어려움 5x6=30
- **ans 분포**: {1:4, 2:5, 3:4, 4:5}
- **validate**: PASS (S-level 0, B-level 12 warnings)
- **blind-solve**: 20/20 일치 (100%)
- **cross-blind**: 20/20 일치 (100%)
- **adversarial**: PASS (HIGH 0건)

### B-level warnings (허용)
- EX-3 x3: ABC 정답단어 지문 내 노출 (단일 패시지 특성상 불가피)
- EX-1 x2: 빈칸 정답 지문 내 노출 (gravity, symptoms - 빈칸 위치와 거리 충분)
- P2 x4: passage 앞부분 fullPassage 미일치 (overlay 마커 삽입에 의한 차이)
- Q6-WEAK-DISTRACTOR x3: 오답 fullPassage 미존재 (어휘 변별력 확보 목적)

### 유형 구성
1-3: (A)(B)(C) 조합형 / 4-6: 부적절 어휘 / 7-9: 빈칸 어휘 / 10-12: 동의어 / 13-14: 반의어 / 15: 다의어 / 16: 영영풀이 / 17-18: 어형변환 / 19-20: 빈칸 문맥

### 검수 일시
- 2026-07-01 by claude-opus-4-6
