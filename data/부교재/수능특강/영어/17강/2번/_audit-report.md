# 17강 2번 V5 감사 리포트

## 파일별 결과
| 파일 | validate | blind | adversarial HIGH | 총점 |
|------|----------|-------|-----------------|------|
| 단어 | PASS | 20/20 | 0 | 100 |
| 워크북 | PASS | 20/20 | 0 | 100 |
| 퀴즈 | PASS (수정 후) | 20/20 | 5 -> 0 (수정 완료) | 100 |

## 수정 이력
### 퀴즈.json -- overlay.markers 키 불일치 5건 수정
- **Q4**: overlay ①②③④ 키가 passage 마커와 불일치. ①'what'->①'acquired', ②'shared'->삭제, ③{find:'who',display:'which'}->②로 이동, ④'encounter'->③'interpret'+④'encounter' 재배치
- **Q5**: overlay ④{find:'was',display:'is'}를 ③으로 이동. ②'consider'->②'produces', ③'response'->삭제
- **Q6**: overlay ①'viewpoint'->①'confusion', ②'escape'->②'interpret', ③'confusion'->③'encounter'
- **Q7**: overlay ①'shared'->①{find:'crowded',display:'deserted'}, ②'assumption'->②'understand', ③{find:'crowded',display:'deserted'}->삭제, ④'encounter'->④'receive'
- **Q9**: overlay ①'derive'->①{find:'acquired',display:'concealed'}, ②'interpretation'->②'hear', ③{find:'shared',display:'concealed'}->삭제, ③'confusion' 추가

**원인**: overlay.markers의 ①②③④ 키가 passage 내 실제 ①②③④ 마커 위치와 일치하지 않았음. find/display 변환이 잘못된 마커 번호에 배치되어 렌더링 시 학생이 보는 화면이 의도와 달랐을 것.

**영향**: 수정 전 상태로 렌더링 시, 학생이 틀린 위치에서 변형된 단어를 보게 됨. 정답 자체(ans 값)는 올바르지만 화면 표시가 잘못되어 혼란 유발.

## 적대적 공격 요약
- HIGH: 5건 (모두 overlay 불일치, 전부 수정 완료)
- MEDIUM: 0건
- LOW: 7건 (부교재 허용 범위)

## Cross-blind 요약
- solver: claude-opus-4-6
- 6파일 합계: 60/60 (100%)
- 불일치 문항: 0건
