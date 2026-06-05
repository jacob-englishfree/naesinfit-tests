# 23강 출제·검수 증적 리포트

**생성일**: 2026-06-05
**대상**: `data/부교재/수능특강/영어/23강`
**생성 방식**: `node scripts/generate-audit-report.js data/부교재/수능특강/영어/23강`

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 12 |
| validate PASS | 12/12 |
| blind.json 존재 | 12/12 |
| cross-blind.json 존재 | 12/12 |
| adversarial HIGH | 24건 |
| adversarial MEDIUM | 8건 |
| adversarial LOW | 1건 |

## 지문 구성

| 섹션 | 제목 | 문장/단어 |
|---|---|---|
| 1번 | Relative Velocity and the Bullet Story | 10/159 |
| 2번 | Hipparchus: Father of Ancient Astronomy | 7/134 |
| 3번 | Microorganisms in Extreme Environments | 7/192 |

## 파일별 검수 상태

| 섹션 | 유형 | validate | blind | cross-blind | adversarial |
|---|---|---|---|---|---|
| 1번 | 단어 | ✅ | ✅ | ✅ | ⚠ (2) |
| 1번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 1번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (1) |
| 2번 | 단어 | ✅ | ✅ | ✅ | ⚠ (7) |
| 2번 | 워크북 | ✅ | ✅ | ✅ | ⚠ (2) |
| 2번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (2) |
| 3번 | 단어 | ✅ | ✅ | ✅ | ✅ (0) |
| 3번 | 워크북 | ✅ | ✅ | ✅ | ✅ (0) |
| 3번 | 퀴즈 | ✅ | ✅ | ✅ | ✅ (0) |
| Gateway | 단어 | ✅ | ✅ | ✅ | ⚠ (10) |
| Gateway | 워크북 | ✅ | ✅ | ✅ | ⚠ (4) |
| Gateway | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (5) |

## Adversarial HIGH 이슈 (수정 필요)

| 파일 | 문항 | 카테고리 | 설명 |
|---|---|---|---|
| 2번/단어 | QQ1-Q3 | overlay누락-ABC | Q1~Q3 (A)(B)(C) 조합형 전체에 overlay.abc 필드 없음. 렌더러가 abc 분기 처리 시 overlay.abc를 참조하므로 렌더링 결과 불확실. 최소한 overlay:{} 존재 필요. |
| 2번/단어 | QQ4-Q6 | overlay누락-markers | Q4~Q6 문맥상 부적절한 어휘 유형에 overlay.markers 필드 없음. passage에 ①<u>...</u> 마커는 있으나 overlay.markers로 원문단어 정보가 없음. RENDER-MARKER-MISSING 해당. |
| 2번/단어 | QQ7-Q9 | overlay누락-blank | Q7~Q9 빈칸 어휘 완성 유형에 overlay.blank 필드 없음. passage에 '__________ '로 빈칸은 있으나 overlay.blank 미설정. |
| 2번/단어 | QQ10-Q14 | overlay누락-underline | Q10~Q14 동의어/반의어 고르기 유형에 overlay.underline 필드 없음. passage에 <u>...</u>는 있으나 overlay.underline에 밑줄칠 단어 미설정. |
| 2번/단어 | QQ17-Q18 | overlay누락-excerptSentences | Q17~Q18 어형 변환 유형에 overlay.excerptSentences 필드 없음. |
| 2번/단어 | QQ19-Q20 | overlay누락-blank | Q19~Q20 빈칸 문맥 완성 유형에 overlay.blank 필드 없음. |
| 2번/워크북 | Q14 | overlay누락-markers | Q14 type='오류찾기'인데 overlay.markers 필드 없음. passage에 ①~④ <u>...</u> 마커는 있으나 overlay.markers={} 구조 미설정. RENDER-MARKER-MISSING 해당. |
| 2번/워크북 | Q20 | S-COND-WORD-MATCH | Q20 서술형 조건영작. wa='he developed the idea of the eccentric to account for the orbit' (12단어). wa 단어 목록: he/developed/the(×3)/idea/of/eccentric/to/account/for/orbit. [조건]에는 'the'가 1개만 명시됨 — 'the eccentric', 'the orbit'에 쓰이는 'the' 2개가 조건 단어 목록에서 누락. 학생이 'the'를 1개만 써야 한다고 오해할 수 있음. S-COND-WORD-MATCH 위반. |
| Gateway/단어 | Q1 | overlay파손-ABC | Q1 overlay.abc.A=['ordinary'] 1개만 있음. 원문 정답 단어 'executive'가 overlay.abc.A에 없음. passage에서 (A)[ordinary / ____] 빈칸이 렌더링되어 ch[0]='____ — away — identical'처럼 선지에 빈칸이 그대로 노출됨. 렌더링 파손. |
| Gateway/단어 | Q2 | X42+overlay파손 | Q2 ans=3=ch[2]='linear — orderly — destroyed'. 그러나 실제 정답(원문 일치)은 'nonlinear — orderly — generated'. det.analysis에서 ③='nonlinear — orderly — generated'로 서술하지만 ch[2]는 'linear — orderly — destroyed'임. X42 치명적 오류. 또한 overlay.abc.A=['linear']만 있어 원문단어 'nonlinear' 누락. |
| Gateway/단어 | Q3 | X42+overlay파손 | Q3 ans=2=ch[1]='within — chaotic — slightly'. det.analysis에서 ②='beyond — chaotic — entirely'가 정답이라 서술. ch[1]='within — chaotic — slightly'는 정답이 아님. X42 오류. overlay.abc.A=['within']만 있어 원문단어 'beyond' 누락. |
| Gateway/단어 | Q4 | X42+det혼란 | Q4 ans=4. det.analysis에서 '✅ ③ / ❌③'이 혼재하여 실제 정답이 ③인지 ④인지 불명확. det.korean='③ similar → different'는 Q4 내용과 무관(passage에 'similar' 없음). det 전체 재검토 필요. |
| Gateway/단어 | Q7 | S-CH-TRUNCATED | Q7 ch[0]='<br><br>' — HTML 줄바꿈 태그가 선지 텍스트로 등록됨. 렌더링 시 선지가 완전히 비어 보임. S-CH-TRUNCATED 해당. |
| Gateway/단어 | Q15 | X42 | Q15 다의어 문맥적 의미. ans=4=ch[3]='(A) 유행 – (B) 유행'. 그러나 det.analysis에서 '✅ ④ (A) 방식 – (B) 유행'로 서술. 실제 ch[2]='(A) 방식 – (B) 유행'이므로 정답은 ch[2]=③이어야 함. ans=4와 det 설명이 불일치. X42 치명적 오류. |
| Gateway/단어 | Q14 | det혼란 | Q14 det.korean='dynamic'. ans=3=ch[2]='dynamic'. det.analysis에서 ③=predictable을 정답으로 서술하지만 ch[2]='dynamic'는 정답이 아님. det.korean과 det.analysis 불일치 — 실제 정답이 predictable이라면 ans=3이 아닌 ans=2(ch[1]='predictable')여야 함. X42 의심. |
| Gateway/단어 | Q19 | 비문선지+X42 | Q19 ans=2=ch[1]='become completely various'. 'various'는 비문(자연스럽지 않은 영어). 원문은 'become completely different'. 또한 det.analysis에서 '✅ ② remain perfectly stable', '✅① become completely different'처럼 정답 표시가 혼재하여 ans=2와 det.analysis 불일치 의심. |
| Gateway/워크북 | Q13 | X42-CRITICAL | Q13 stem='위 글의 내용과 일치하는 것은?'. ans=4=ch[3]='아무리 주의를 기울여도 진자는 두 번의 실험에서 완전히 다른 점들을 방문한다.' — 이 내용은 원문과 일치하므로 정답이 맞음. 그러나 det.analysis에서 ✅ 표시가 ④에 붙어 있으면서 '처음에만 같고 곧 달라짐'이라는 설명이 ④에 대한 설명이 아니라 ①에 대한 반박으로 쓰여 있어 det 서술이 혼란스러움. 검수자가 재확인: ch[3]='아무리 주의해도 완전히 다른 점' = 원문 일치 = 정답 OK. 단, det.analysis에서 ②를 ❌로 표시하면서 동시에 '② ... 일치'라고 써서 학생이 혼동 가능. det 재작성 필요. |
| Gateway/워크북 | Q12 | det번호혼재 | Q12 stem='일치하지 않는 것은?'. ans=3=ch[2]='모든 비선형 시스템은 자동적으로 혼돈 상태가 된다.' — 정답 자체는 올바름. det.analysis에서 '✅ ③ 비선형 시스템이 혼돈적이 되려면 특정 지점을 넘어야 한다.'로 서술하나 이 내용은 ch[3]='비선형 시스템이 혼돈적이 되려면 특정 지점을 넘어야 한다.'의 내용. det.analysis가 ch[2] 대신 ch[3] 내용을 ③으로 표기. 해설 재작성 필요. |
| Gateway/워크북 | Q19 | X42 | Q19 요약문 빈칸. ans=4=ch[3]='(A) stability — (B) predictable'. 그러나 det.analysis에서 '✅ ④ (A) iteration — (B) consistent'로 서술 — ch[3] 내용과 det 설명 불일치. 또한 det.korean에서 '예측 불가능한'이라는 설명은 ch[0]='(A) iteration — (B) unpredictable'이 정답임을 시사하지만 ans=4. X42 의심. |
| Gateway/퀴즈 | Q2 | passage=null | Q2 type='순서배열'. passage=null. 순서배열 문항은 도입문+각 단락이 passage에 있어야 학생이 읽고 풀 수 있음. 렌더링 불가. |
| Gateway/퀴즈 | Q3 | 유형오류+passage=null | Q3 type='순서배열'이지만 stem은 '주어진 문장이 들어가기에 가장 적절한 곳은?' 형식의 문장삽입. 또한 stem의 삽입 문장이 fullPassage의 2번째 문장 그대로('It has four magnets...' + (A) 단락 도입부)를 사용 — 원문을 다시 삽입 대상으로 쓰는 구조 오류. passage=null로 렌더링 불가. type과 stem 모두 수정 필요. |
| Gateway/퀴즈 | Q18 | accept채점파산 | Q18 어순배열 서술형. wa='the iteration has to be within a nonlinear system' (9단어). 그러나 accept=['nonlinear','Nonlinear','nonlinear.'] — 단 1단어 'nonlinear'만 입력해도 정답 처리됨. 채점 완전 파산. accept를 wa 전체로 수정 필요. |
| Gateway/퀴즈 | Q19 | accept채점파산 | Q19 서술형 조건영작. wa='it will visit an entirely different set of points' (9단어). accept=['generated','Generated','generated.'] — 전혀 무관한 단어 'generated'로만 채점됨. 학생이 'generated'라고 쓰면 정답, wa 전체를 써도 채점 안 됨. 채점 완전 파산. |
| Gateway/퀴즈 | Q20 | accept부분채점 | Q20 서술형 영작. wa='though not all iteration leads to chaos' (7단어). accept=['not all iteration','Not all iteration','not all iteration.'] — 3단어만 써도 정답 처리. [조건]에 7단어를 요구하는데 3단어로 채점 통과. S-WORDCOUNT-MISMATCH 실질적 위반. |

## 배포 가능 여부

⛔ **배포 불가** — 위 미비점 해결 필요

### jacob 본인 확인 필요
- [ ] 실기기 카카오톡에서 박선민/학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이 (1파일)
- [ ] 수업자료 PDF(합본) Dropbox 업로드 여부
