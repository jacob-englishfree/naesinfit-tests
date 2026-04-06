# 다음 세션 인수인계 — 2026-04-06 세션 C-4 결과

## 🎯 배경 (30초 요약)

고1 3월 2024 모의고사 30~33번 8파일 블라인드 풀이 검수 중 **generate 파이프라인의 치명적 버그 5종 발견**.
전체 data/ 폴더 1910 파일 전수 검사 결과 **528개 파일이 "절대 금지 4종" 위반**.

jacob 방침: **기존 테스트는 유지 (학생 계속 풀기)** + **근본 원인 전부 제거** + **파일 하나하나 수정**.

---

## ✅ Phase 1 완료 (이번 세션)

### 1) validate.js 방화벽 강화 — S급 체크 8종 추가
| 체크 | 감지 대상 | 절대금지 매핑 |
|---|---|---|
| V79 (S) | passage=null (문장삽입/순서배열/요약) | 못푸는문제 |
| V80 (S) | 템플릿 플레이스홀더 노출 ("(다른 뜻)", "main concept discussed" 등) | 못푸는문제 |
| V81 (S) | \u escape 미변환 (ch/stem/wa/passage) | 못푸는문제 |
| V82 (S) | 어법/어휘 ch 번호 마커 비연속 (①②③⑤) | 구조문제 |
| V83 (S) | 동일 stem+ch+passage 중복 | 구조문제 |
| V84 (S) | 내용일치/불일치 4선지 모두 원문 발췌 (복수정답) | 구조문제 |
| V85 (S) | det.analysis "정답:N번" ↔ ans 불일치 | **해설불일치** |
| V86 (S) | "본문에서 찾아 쓰시오" wa가 fullPassage에 없음 | 구조문제 |

**앞으로 만들어지는 파일은 절대 금지 3종(못푸는/해설불일치/구조) validate로 100% 차단.**

### 2) 현재 로컬 상태
- `validate/validate.js` — **로컬 수정만, 커밋 안 됨** (push 금지 지시)
- diff 파일: `validate/session-C4-output/validate.js.patch`

### 3) 전체 스캔 결과
| 지표 | 수치 |
|---|---|
| Total | 1910 파일 |
| PASS | 152 (8%) |
| FAIL | 1898 (99%) |
| 절대 금지 4종 위반 | 528 (중복 제거) |

### 4) 절대 금지 위반 528개 내역 (중복 제거)
- **P1 못 푸는 (129개, 배포중 110)** — 최우선
- **P2 해설 불일치 (27개, 배포중 27)**
- **P3 구조 문제 (372개, 배포중 336)**

배포 경로별 집계: `validate/session-C4-output/REGENERATION-TARGETS.md` 참조.

---

## 🎯 다음 세션에서 할 일

### Phase 2 — generate 파이프라인 버그 5종 진단 + 수정

파이프라인 코드 위치 (CLAUDE.md 메모리 기준):
- `naesinfit-tests/create.js` (있는지 확인 필요)
- `build/generate-*.js` 시리즈

**진단 대상 5종 버그:**
1. 어법/어휘 자동생성기가 원문 단어 **변형 없이** 그대로 밑줄 → V82 유발
2. ch 셔플 후 ans/det.analysis 미재계산 → V85 유발 (과거 `feedback_no_swap_without_det_update.md` 사고 재발)
3. 주제/다의어 선지 템플릿 미채움 → V80 유발
4. 문장삽입/순서배열 passage 미생성 → V79 유발
5. 원문자(①②③) 유니코드 미변환 → V81 유발

**작업 방법:**
- 각 버그마다 원인 코드 라인 찾기
- 수정안 제시 → jacob 확인 → 수정 (한 번에 한 버그)
- 수정 후 단위 테스트: 1파일 신규 생성 → validate PASS 확인

### Phase 3 — 자동 블라인드 풀이 통합

generate 스크립트에 자동 검증 파이프라인 추가:
```
npm run create
  ↓
validate PASS?        (Phase 1 방화벽)
  ↓
AI 블라인드 풀이 2회 교차검증  (정답 오류 차단)
  ↓
불일치 시 자동 재생성
  ↓
jacob 확인 → 배포
```

기존 `verify/blind-solve.js` 활용 가능 (CLAUDE.md `project_verification_system_0404.md` 참조).

### Phase 4 — 기존 528개 순차 재생성

Phase 2+3 완료 후 Phase 1 방화벽 통과하는 새 파일로 교체.
우선순위:
1. **P1 배포중 110개** (가장 시급)
2. **P2 배포중 27개**
3. **P3 배포중 336개**
4. 미배포 파일

---

## 🚨 주의 사항

1. **C-1/C-2/C-3 세션 결과와 통합 필요**
   - 4세션 통합 리포트: `validate/session-C-final-report.md` (미작성)
   - push는 4세션 전부 완료 후 jacob 확인받고 진행

2. **validate.js 커밋 시점**
   - C-1/C-2/C-3 세션 완료 후 통합 push 시 함께 커밋
   - 그 전까지 로컬 수정만 유지

3. **기존 배포 파일은 유지**
   - 차단하지 않음 (jacob 방침: 학생 계속 풀기)
   - 방화벽은 "앞으로 만들 파일" 대상

4. **Phase 2 진행 전 확인**
   - jacob의 명시적 승인 필요 (pipeline 코드 수정은 영향 범위 큼)
   - "수정 전 영향 범위 파악 → 수정 후 빌드 에러 확인" SOP 준수

---

## 📁 산출물 파일 목록

모두 `validate/session-C4-output/` 아래:
- `validate.js.patch` — V79~V86 신규 체크 diff
- `critical-176.txt` — 치명적 파일 176개 경로
- `absolute-ban-528.txt` — 절대금지 위반 528개 경로
- `fail-all-1898.txt` — 전체 FAIL 1898개 경로
- `validate-full-output.txt` — 전체 검증 원본 로그
- `REGENERATION-TARGETS.md` — 우선순위별 재생성 리스트
- `NEXT-SESSION.md` — 본 문서

## 🎬 세션 C-4 블라인드 풀이 증적 (별도)
- `validate/session-C4-report.md` — 8파일 160문항 블라인드 풀이 결과
