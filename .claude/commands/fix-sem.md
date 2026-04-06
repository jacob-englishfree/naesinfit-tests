# /fix-sem — SEM 의미 경고 자동 수정

Usage: /fix-sem {경로}

예시:
- `/fix-sem 모의고사/고1/3월/31번` — 31번 3파일 SEM 수정
- `/fix-sem 모의고사/고1/3월` — 고1 3월 전체 SEM 수정

## 수정 대상

### SEM-3: 어법 ch[]↔passage 밑줄 불일치
**자동 수정**: ch[]를 passage `<u>` 밑줄 순서로 재정렬
- passage에서 `<u>...</u>` 추출 (순서대로)
- ch[]를 추출 순서로 교체
- ans를 정답 단어의 새 위치로 재매핑
- det.analysis 마커 ①②③④ 재정렬

### SEM-4: det "X→Y"↔ans 불일치
**자동 수정**: det.korean에서 "X→Y" 패턴 추출 → X가 있는 ch 인덱스 찾기 → ans 재설정

### SEM-1: 교차오염
**자동 수정 불가** — 사람이 stem/ch/wa 내용을 확인해야 함
→ 경고만 표시, 수동 개입 필요 목록 출력

## 실행 절차

1. 대상 파일의 SEM 경고 파악
2. SEM-3, SEM-4 자동 수정 적용
3. validate 재실행 → PASS 확인
4. 수정 내역 보고 (파일별 변경 Q 목록)
5. SEM-1 수동 필요 목록 별도 출력

## 주의
- 수정 전 원본 백업 (git stash 또는 별도 복사)
- 수정 후 반드시 validate PASS 확인
- SEM-1은 절대 자동 수정하지 않음 (교차오염은 내용 확인 필수)
