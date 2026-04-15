# 레거시 모의고사 S-DUPLICATE-ITEM 핸드오프 (2026-04-15)

> 작성: 2026-04-15 세션, 올림포스 3강·5강 작업 마무리 중 잠재 위반 발견

## 요약

- **위반 파일 수:** 231개 모의고사 (`data/모의고사/**/워크북.json` + 일부 퀴즈)
- **위반 pair 수:** 390건 S-DUPLICATE-ITEM (파일당 평균 1.7건)
- **원인:** 2026-04-15에 추가된 S급 신규 규칙(`S-DUPLICATE-ITEM`, `S-DISTRACTOR-ALL-FIRST-SENT`)이 기존 레거시 자동 생성 테스트들을 소급 적용하여 플래그.
- **이 세션에서 처리 불가 사유:** semantic regen 필수. 파일당 2~6개 질문을 패시지에 맞게 다시 쓰는 작업. 390 pair × 평균 2분 = 13+ 시간 agent 작업 + 전수 검수 필요.

## 분포

```
고1  = 50 파일
고2  = 112 파일
고3  = 79 파일
```

Q pair 패턴 TOP 10:
```
56  Q14↔Q15   (어법 (A)(B)(C) 혹은 문장단위 어법 — 동일 ans 위치)
35  Q1↔Q2    (어법 ①②③④⑤ 문항 동일)
33  Q2↔Q3    (어법 변형)
28  Q11↔Q12  (주제/내용일치)
28  Q10↔Q11
27  Q8↔Q9
25  Q18↔Q19  (주제/요지)
24  Q6↔Q7    (내용일치)
19  Q9↔Q10
18  Q2↔Q4    ((A)(B)(C) 조합형)
```

## 대표 패턴 사례

### 패턴 A — 1-word 내용이해 Q17~Q20

```
Q17 [내용이해] ans=3 → "known"
Q18 [내용이해] ans=4 → "known"   ← 동일 단어
Q19 [내용이해] ans=3 → "parts"
Q20 [내용이해] ans=4 → "subconscious"
```

- 4개 문항이 같은 4-단어 pool 공유 + Q17/Q18 ans 동일 → 중복
- 원인: 과거 auto-generator가 안내문/간단 단어 찾기 템플릿으로 찍어낸 garbage
- **수정 방향:** 각 Q가 서로 다른 타겟 단어를 ans로 갖도록 재할당. 단 타겟 선택은 패시지 semantic에 의존 → 수동/agent 필요.

### 패턴 B — 내용일치/불일치 Q6↔Q7 or Q8↔Q9

```
Q6 [내용일치] ch: [문장A, 문장B, 문장C, 문장D]  ans=2
Q7 [내용일치] ch: [같은 4문장]                 ans=2   ← 같은 정답
```

- 두 문항이 동일 4문장 세트를 공유하고 같은 ans 선택
- **수정 방향:** Q7 ch를 다른 내용일치 후보 4문장으로 교체 (패시지의 다른 sentence 선택)

### 패턴 C — 어법 (A)(B)(C) 조합형 Q2↔Q4

- 4개의 (A)(B)(C) 조합이 동일 후보 세트 + ans 동일
- **수정 방향:** Q4를 패시지 다른 지점의 어법 포인트로 교체

## 수정 전략 옵션

### 옵션 1: Agent 기반 일괄 재작성
- 5~8 서브에이전트 병렬 배치 (batch당 30~50파일)
- 각 에이전트: 파일별 validate 실행 → 플래그된 pair의 두 번째 Q 재작성 → validate 재실행 → 다음 파일
- **예상 시간:** 5~8 wall-clock 시간 (병렬 기준)
- **품질:** semantic grounded, blind-solve 별도 필요
- **위험:** 한 세션의 context 한계 + 품질 편차

### 옵션 2: 규칙 범위 조정
- `S-DUPLICATE-ITEM` 레거시 exempt 플래그 추가 (`ei.legacy_allow_dup: true`)
- 신규 출제는 규칙 적용, 레거시는 grace
- **장점:** 배포 차단 해제, 점진적 fix 가능
- **단점:** 학생 화면에는 중복 문항이 그대로 노출됨 (품질 문제)

### 옵션 3: 단순 delete
- 위반된 두 번째 Q를 삭제 → 20문항 구조 붕괴 → 재구성 필요
- 배점 총 100 규칙 위반 → 다른 Q 배점 조정 필요
- **불가** (구조 규칙 위반)

### 추천: 옵션 1 멀티데이 프로젝트
- Day 1: 고1 50파일 (2 에이전트)
- Day 2: 고2 112파일 (3 에이전트)
- Day 3: 고3 79파일 (2 에이전트)
- Day 4: 전수 blind-solve (2 에이전트)
- Day 5: 시각 검수 + 커밋 + push

## 빠른 실행 명령

```bash
# 전체 위반 파일 목록 생성
cd naesinfit-tests
node validate/validate.js --all 2>&1 > /tmp/validate_all.log
awk '/^\[FAIL\]/ { sub(/^\[FAIL\] /,""); sub(/ \(.*$/,""); file=$0 } /S-DUPLICATE-ITEM/ { print file }' /tmp/validate_all.log | sort -u | grep 모의고사 > /tmp/mock_dup.txt

# 파일별 상세 위반 확인
while IFS= read -r f; do
  echo "=== $f ==="
  node validate/validate.js "$f" 2>&1 | grep "S-DUPLICATE-ITEM"
done < /tmp/mock_dup.txt
```

## 이 세션에서 완료한 것

- 올림포스 3강·5강 72파일 S급 재출제 완료 (push: commit 81390180b)
- 수능특강/교과서 6파일 (blind.json 존재하던) 재출제 완료 (push: commit e918fc570)
- 수능특강/Light/교과서 23파일 재출제 + 현재 blind-solve 에이전트 진행 중
- `S-DISTRACTOR-ALL-FIRST-SENT` 함축의미/지칭 exemption 추가
- `scripts/fix-distractor-first-sent.js` 자동 교체 스크립트 신설

## 미완료 항목

- 23 레거시 부교재/교과서 파일 blind.json 생성 (에이전트 진행 중)
- 231 모의고사 파일 S-DUPLICATE-ITEM 재작성 (본 문서의 멀티데이 계획 참조)
