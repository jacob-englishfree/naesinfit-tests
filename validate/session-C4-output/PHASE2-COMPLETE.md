# Phase 2 완료 — generate 파이프라인 버그 5종 근본수정 (2026-04-06)

## ✅ qa/create.js 수정 내역 (로컬만, 커밋 안 함)

### 1) 버그 #2 — ch 셔플 후 det.analysis 미갱신 (V85 27건 근본원인)
- **위치**: 약 469-471행 (원본 주석만, 구현 없음)
- **수정**: ①②③④ 마커 2-way swap 추가
- **단위테스트**: ans 1→4 셔플 시 analysis "✅ ①" → "✅ ④" PASS
- **참고**: `feedback_no_swap_without_det_update.md` (2026-04-05 사고) 재발 방지

### 2) 추가 — 마커문항 셔플 금지 (V82 근본원인)
- **위치**: postProcess mcQuestions 분류 로직
- **수정**: `ch=["①","②","③","④"]` 패턴 감지 시 셔플 제외
- **이유**: 어법 문제는 passage의 `<u>밑줄</u>` 위치 참조. 셔플 시 비연속 마커 발생.
- **참고**: `feedback_marker_no_rotate.md` 규칙 코드화

### 3) 버그 #5 — 리터럴 \u 시퀀스 미변환 (V81 근본원인)
- **위치**: postProcess U+FFFD 제거 직후
- **수정**: `\\\\u([0-9a-fA-F]{4})` 정규식으로 이중 이스케이프 복원
- **시나리오**: API가 `"\\\\u2460"` 반환 → JSON.parse 후 6자 리터럴 → 변환 → `①`

### 4) preValidate 확장 — Phase 1 방화벽 조기 차단 (4종 체크 추가)
| 체크 | 감지 대상 | retry 피드백 |
|---|---|---|
| [V79] | 문장삽입/순서배열/요약/어순배열/빈칸에 passage=null | "passage 생성 필수" |
| [V80] | 플레이스홀더 패턴 9종 (`(다른 뜻)`, `main concept discussed` 등) | "실제 내용으로 교체" |
| [V83] | stem+ch+passage 중복 문항 | "다른 문항으로 교체" |
| [V85] | ✅ 마커 ↔ ans 불일치, "정답:N번" ↔ ans 불일치 | "analysis 마커 수정" |

**효과**: validate.js 실행 전에 API 재호출 유도 → retry 피드백 품질 향상 + 비용 절감

### 5) 프롬프트 규칙 5종 추가 (AI에 명시적 전달)
- 규칙 16: [V85] det.analysis ✅ 마커 ↔ ans 1:1 일치
- 규칙 17: [V80] 플레이스홀더 금지 (예시 5종 명시)
- 규칙 18: [V79] passage=null 금지 유형 명시
- 규칙 19: [V83] 중복 문항 금지
- 규칙 20: [어법] 4개 밑줄 중 정확히 1개만 변형 (버그 #1 예방)

자가검증 체크리스트 4개 항목도 추가.

---

## 🛡️ 3중 방어 구조 완성

```
Layer 1: 프롬프트 규칙 16~20 + 자가검증
  ↓ AI 생성
Layer 2: postProcess (자동 교정)
  - 리터럴 \u → 실제 문자
  - 마커문항 셔플 회피
  - ch 셔플 시 det.analysis 마커 동기화
  ↓
Layer 3: preValidate (V79/V80/V83/V85 조기 차단)
  ↓
Layer 4: validate.js (Phase 1 V79~V86 S급 방화벽)
  ↓ FAIL 시 prevErrors 피드백 → retry
```

## 미수정 버그

**버그 #1 어법/어휘 원문 그대로 복사 (V82)**
- 프롬프트 규칙 20으로 AI에 명시적 전달
- validate.js V82가 S급 차단
- 근본수정(코드레벨)은 어려움 — AI가 원문 전체를 알고 있어야 함
- retry 루프로 수렴 유도

**버그 #3 주제/다의어 템플릿 (V80)**
- preValidate [V80] 9종 패턴 감지
- 프롬프트 규칙 17로 차단

**버그 #4 문장삽입/순서배열 passage 누락 (V79)**
- preValidate [V79] 감지
- 프롬프트 규칙 18로 차단

---

## 테스트 현황
- 단위테스트: 마커 스왑 PASS, 마커문항 감지 PASS, \u 복원 PASS, preValidate 5종 PASS
- end-to-end 테스트: 미실행 (API 비용 절감, jacob 방침)

## 다음 단계
- Phase 3 (자동 블라인드 풀이 통합) — verify/blind-solve.js API 사용
- Phase 4 (528개 순차 재생성) — API 비용 대량 발생
- 전부 jacob 명시적 승인 필요
