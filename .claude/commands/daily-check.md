# /daily-check — 일일 품질 점검

매일 아침 실행하거나 크론으로 자동화하는 전체 시스템 점검.

## 실행 절차

### 1. 어제 변경된 파일 파악
```bash
git log --since="1 day ago" --name-only --pretty=format: -- data/ | sort -u | grep ".json$"
```

### 2. 변경 파일 validate
어제 push된 파일만 validate 실행 → FAIL 목록

### 3. 전체 SEM 스캔
```bash
node validate/validate.js --all 2>&1 | grep "SEM" | wc -l
```
어제 대비 SEM 경고 증감 체크

### 4. 교차오염 신규 검출
SEM-1 경고 중 어제 변경 파일에 해당하는 것만 추출

### 5. 보고
```
━━━ 일일 품질 보고 (YYYY-MM-DD) ━━━

어제 변경: N파일
  PASS: N개
  FAIL: N개 ← 즉시 조치 필요

SEM 경고 총: NNN건 (전일 대비 +N/-N)
  신규 SEM-1 교차오염: N건
  신규 SEM-3 어법불일치: N건

조치 필요:
  🔴 [파일명] S급 에러 — 즉시 수정
  🟡 [파일명] SEM-1 교차오염 — 내용 확인
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
