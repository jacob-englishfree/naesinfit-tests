# /audit — 테스트 품질 대시보드

Usage: /audit {경로}

예시:
- `/audit 모의고사/고1/3월` — 고1 3월 전체 스캔
- `/audit 교과서/공통영어1/YBM박준언` — 출판사 전체
- `/audit 부교재/수능특강/영어` — 수능특강 전체
- `/audit --all` — 전체 1,910파일 스캔

## 실행 절차

### STEP 1: 파일 스캔
```bash
find data/{경로} -name "*.json" -type f
```
대상 파일 목록 + 총 개수 출력

### STEP 2: validate 전수 실행
```bash
node validate/validate.js --all (또는 개별)
```
- 파일별 PASS/FAIL 집계
- S/A/B급 에러 유형별 카운트

### STEP 3: 의미 검증 요약
SEM-1 (교차오염), SEM-3 (어법 ch↔밑줄), SEM-4 (det↔ans) 경고 집계:
- 파일별 SEM 경고 수
- 가장 많이 발생하는 SEM 유형

### STEP 4: 대시보드 출력

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {경로} 품질 대시보드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

총 파일: NN개 / 총 문항: NN×20 = NNN개

[validate 결과]
  ✅ PASS: NN개 (NN%)
  ❌ FAIL: NN개 (NN%)

[S급 에러 TOP 5]
  1. CAO-1 (마커 순서): NN건
  2. SEM-3 (어법 불일치): NN건
  ...

[SEM 의미 경고]
  SEM-1 교차오염: NN건
  SEM-3 어법 ch↔밑줄: NN건
  SEM-4 det↔ans: NN건

[파일 상태]
  출제 완료: NN개
  검증 완료: NN개
  배포 완료: NN개
  미출제: NN개

[조치 필요]
  1. 🔴 FAIL 파일 NN개 수정 필요
  2. 🟡 SEM 경고 NN건 점검 권장
  3. 🟢 PASS NN개 배포 가능

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### STEP 5: FAIL 파일 상세
FAIL 파일이 있으면 각 파일의 S/A급 에러 목록 표시

## 옵션
- `--fix`: FAIL 파일 자동 수정 시도 (auto-fix.js 사용)
- `--sem`: SEM 경고만 집중 표시
- `--deploy`: PASS 파일만 자동 배포
