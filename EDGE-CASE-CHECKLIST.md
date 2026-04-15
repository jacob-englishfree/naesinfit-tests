# Edge Case Imagination Checklist

> **새 validate 규칙을 추가할 때마다 이 체크리스트를 거친다.**
> 목적: reactive(사후) → proactive(사전) 전환. 신고받기 전에 유사 편법을 미리 상상해서 같이 막는다.

## 절차
1. 새 편법/문제 패턴을 발견 또는 jacob/학생 신고 접수
2. 그 편법을 차단하는 validate 규칙 작성
3. **이 체크리스트로 5가지 파생 편법 브레인스토밍**
4. 각 파생 편법도 같은 규칙으로 막히는지 확인 → 안 막히면 규칙 확장
5. `tests/fixtures/<RULE-ID>/` PASS/FAIL 샘플 작성
6. `npm run test:rules` 로 기존 규칙 회귀 없음 확인
7. `feedback_<name>.md` 메모리 영구 저장
8. MEMORY.md 인덱스 업데이트
9. `npm run seal:update` 해시 갱신
10. commit + push

## 5가지 상상 프레임

### 1. 반대 방향
- 원본 편법이 "A → B 방향"이라면, "B → A" 방향도 있는가?
- 예) `unmatch → match` (접두사 제거)는 잡혔는데, `match → unmatch` (접두사 추가)는?
- 예) "N가지 찾아 쓰시오" 금지했는데, "한 가지만 찾으라"는 허용인가? 그 한 가지가 본문에 3개 있으면?

### 2. 인접 변이
- 편법의 유사/변형 형태는?
- 예) 메타 선지 "본문에서 언급된"이 잡혔는데, "본문이 제시하는", "글에서 보이는" 은?
- 예) 접두사 `un-`만 막혔는데, `in-`, `dis-`, `non-` 도 같은 패턴?

### 3. 위치 이동
- 원본은 stem에서 감지되는데, ch(선지)/wa(정답)/passage 에도 같은 패턴 가능한가?
- 예) 반의어 stem에서 접두사 조작 → ch(선지)에도 접두사 조작 가능 (오늘 Q5/Q6 발견)

### 4. 스케일/조합
- 편법 1건이 2건 이상 겹치면 더 강해지는가?
- 예) 메타 선지 1개는 약함, 3개 누적이면 확실한 소거법 → Anti-Cheese Gate
- 예) 복수 정답이 1개 의심이면 약함, 2개 이상이면 채점 불가 → S-MULTI-CORRECT

### 5. 유형 이동
- 동일 편법이 다른 문제 유형에서도 가능한가?
- 예) 서술형 "N가지"가 잡혔는데, mc 내용일치 "일치하는 것"에서 N개 일치 선지도?
- 예) 주제 문항의 메타 선지 → 함축의미/지칭추론 문항에도?

## 예시 적용 (오늘 실제)

**신고**: 5강 Ex11 워크북 Q10 "세 가지를 쓰시오 (4단어)" → `A, B, and C` 형태 채점 지옥

**1차 규칙**: `S-MULTI-ITEM-WRITTEN` — wa에 쉼표 2+ 또는 " and " 차단

**체크리스트 적용**:
1. 반대 방향: "한 가지만 쓰시오"도 본문에 후보 3개면 모호? → **→ accept 배열에 후보 여러 개 필수**
2. 인접 변이: "모두 쓰시오" / "함께 적으시오" / "나열하시오" → **규칙에 키워드 확장**
3. 위치 이동: mc 선지에도 "A, B, C" 형태? → **S-ANTI-CHEESE-GATE + Q6-WEAK로 이미 잡힘**
4. 스케일: "두 가지"도 모호? → **같은 규칙으로 차단**
5. 유형 이동: 어형변환 "N가지 변형" → **서술형 전반에 적용**

결과: 1차 규칙 범위 **확장** → S-MULTI-ITEM-WRITTEN 최종 버전

## 규칙 추가 시 제출물 체크리스트

- [ ] validate.js 규칙 코드 추가 (주석 포함)
- [ ] question-schema.json 23종 S급에 등록
- [ ] `npm run sync` 으로 CLAUDE.md 자동 반영
- [ ] tests/fixtures/<RULE-ID>/pass.json + fail.json 작성
- [ ] `npm run test:rules` 전체 PASS 확인
- [ ] feedback memory 파일 작성 (Why/How to apply/⛔ 삭제 금지)
- [ ] MEMORY.md 인덱스 추가
- [ ] `npm run seal:update` 해시 갱신
- [ ] 기존 데이터 전수 스캔하여 위반 파일 목록 추출
- [ ] jacob 리뷰 후 위반 파일 일괄/개별 수정 계획
- [ ] commit + push

## 참고: 현재 등록된 S급 규칙 (2026-04-15)
- 23종 S급 (ANTONYM-PREFIX, META-CHOICE, ANTI-CHEESE-GATE, MULTI-ITEM-WRITTEN 신규 포함)
- 목록은 `validate/question-schema.json` → `validateRules.S급` 참조
- CLAUDE.md `<!-- SYNC-RULES-START -->` 섹션에 자동 반영됨
