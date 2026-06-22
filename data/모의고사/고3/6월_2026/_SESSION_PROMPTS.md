# 2026 고3 6월 모의고사 출제 세션 분배

**총 22문항 × 3종(단어/워크북/퀴즈) = 66파일**
**긴급도: 🔴 오늘(6/22) 퀴즈 학생 있음 (조수민, 백하은)**

---

## 세션 1 — 18~24, 26번 (8문항)

```
테스트 출제 세션 멘트 — 2026 고3 6월 8문항
                                                                                        
  2026 고3 6월 모의고사(수능 모의평가) 테스트 출제. 8문항(18,19,20,21,22,23,24,26번) 단어+워크북+퀴즈.
                                                                                        
  작업 경로: ~/Desktop/영어해방공식&내신핏/naesinfit-tests/                             
  CLAUDE.md 먼저 읽고 SOP 따라 진행.                                                    
                                                                                        
  ■ 원본 문제지 PDF                                                                     
  ~/Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)/모의고사원본/고3/2026학년도 고3 6월 모의고사/2026학년도 6월 수능 모의 평가 영어_문제지.pdf

  ■ 해설지 PDF
  ~/Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)/모의고사원본/고3/2026학년도 고3 6월 모의고사/2026학년도 6월 모의고사 해설지.pdf
                  
  ■ 출제 대상                                                                           
  18번, 19번, 20번, 21번, 22번, 23번, 24번, 26번 (8문항)
  ※ 25번(도표), 27~28번(안내문)은 출제 제외.
                                                                                        
  ■ Step 0: passages 추출 + 폴더 생성                                                   
  1. data/모의고사/고3/ 아래에 6월_2026/ 폴더 생성                                     
  2. data/모의고사/고3/6월_2026/_passages/ 에 번호별 JSON 저장                         
  3. 기존 모의 passages 구조 참고: data/모의고사/고3/6월/_passages/               
  4. JSON 형식: {"id":"N번","subject":"2026 고3 6월 모의고사","title":"...","fullPassage":"...","sentenceCount":N,"wordCount":N,"originalAnswer":"...","originalType":"..."}          
                                                                                        
  ■ Step 1~: 테스트 출제                                                                
  8번호 각각 단어 → 워크북 → 퀴즈. create-test.js 파이프라인 사용.
  1파일씩 SOP 8단계. validate PASS + blind-solve + cross-blind + adversarial.

  ■ 완료 후
  - textbooks.ts에 { id:"모의-2026-고3-6월", label:"2026 고3 6월 모의고사", g:"고3", path:"고3/6월_2026" } 추가
  - test-deploy.ts에 "고3-2026-6월": { path: "고3/6월_2026", items: [...] } 추가
  - sync.sh + generate-catalog.js + 3곳 push
  ※ 세션2,3이 나머지 번호 출제 중이면 items 배열에 자기 번호만 먼저 등록하고 push. 나중에 합산.
```

---

## 세션 2 — 29~35번 (7문항)

```
테스트 출제 세션 멘트 — 2026 고3 6월 7문항
                                                                                        
  2026 고3 6월 모의고사(수능 모의평가) 테스트 출제. 7문항(29,30,31,32,33,34,35번) 단어+워크북+퀴즈.
                                                                                        
  작업 경로: ~/Desktop/영어해방공식&내신핏/naesinfit-tests/                             
  CLAUDE.md 먼저 읽고 SOP 따라 진행.                                                    
                                                                                        
  ■ 원본 문제지 PDF                                                                     
  ~/Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)/모의고사원본/고3/2026학년도 고3 6월 모의고사/2026학년도 6월 수능 모의 평가 영어_문제지.pdf

  ■ 해설지 PDF
  ~/Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)/모의고사원본/고3/2026학년도 고3 6월 모의고사/2026학년도 6월 모의고사 해설지.pdf
                  
  ■ 출제 대상                                                                           
  29번, 30번, 31번, 32번, 33번, 34번, 35번 (7문항)
                                                                                        
  ■ Step 0: passages 추출 + 폴더 생성                                                   
  1. data/모의고사/고3/6월_2026/ 폴더가 이미 있으면 사용, 없으면 생성
  2. data/모의고사/고3/6월_2026/_passages/ 에 번호별 JSON 저장                         
  3. 기존 모의 passages 구조 참고: data/모의고사/고3/6월/_passages/               
  4. JSON 형식: {"id":"N번","subject":"2026 고3 6월 모의고사","title":"...","fullPassage":"...","sentenceCount":N,"wordCount":N,"originalAnswer":"...","originalType":"..."}          
  ※ 세션1이 이미 _passages/ 만들어놨을 수 있음. 기존 파일 건드리지 말고 자기 번호만 추가.
                                                                                        
  ■ Step 1~: 테스트 출제                                                                
  7번호 각각 단어 → 워크북 → 퀴즈. create-test.js 파이프라인 사용.
  1파일씩 SOP 8단계. validate PASS + blind-solve + cross-blind + adversarial.

  ■ 완료 후
  - test-deploy.ts "고3-2026-6월" items 배열에 자기 번호 추가 (없으면 신규 등록)
  - textbooks.ts에 모의-2026-고3-6월 없으면 추가
  - sync.sh + generate-catalog.js + 3곳 push
```

---

## 세션 3 — 36~40, 41-42, 43-45번 (7문항)

```
테스트 출제 세션 멘트 — 2026 고3 6월 7문항
                                                                                        
  2026 고3 6월 모의고사(수능 모의평가) 테스트 출제. 7문항(36,37,38,39,40,41-42,43-45번) 단어+워크북+퀴즈.
                                                                                        
  작업 경로: ~/Desktop/영어해방공식&내신핏/naesinfit-tests/                             
  CLAUDE.md 먼저 읽고 SOP 따라 진행.                                                    
                                                                                        
  ■ 원본 문제지 PDF                                                                     
  ~/Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)/모의고사원본/고3/2026학년도 고3 6월 모의고사/2026학년도 6월 수능 모의 평가 영어_문제지.pdf

  ■ 해설지 PDF
  ~/Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)/모의고사원본/고3/2026학년도 고3 6월 모의고사/2026학년도 6월 모의고사 해설지.pdf
                  
  ■ 출제 대상                                                                           
  36번, 37번, 38번, 39번, 40번, 41-42번, 43-45번 (7문항)
  ※ 41-42번, 43-45번은 장문. 하나의 지문에서 2~3문제가 나오므로 passage를 공유.
                                                                                        
  ■ Step 0: passages 추출 + 폴더 생성                                                   
  1. data/모의고사/고3/6월_2026/ 폴더가 이미 있으면 사용, 없으면 생성
  2. data/모의고사/고3/6월_2026/_passages/ 에 번호별 JSON 저장                         
  3. 기존 모의 passages 구조 참고: data/모의고사/고3/6월/_passages/               
  4. JSON 형식: {"id":"N번","subject":"2026 고3 6월 모의고사","title":"...","fullPassage":"...","sentenceCount":N,"wordCount":N,"originalAnswer":"...","originalType":"..."}          
  ※ 41-42번, 43-45번은 하나의 fullPassage + 각각의 originalAnswer.
  ※ 세션1,2가 이미 작업중일 수 있음. 기존 파일 건드리지 말고 자기 번호만 추가.
                                                                                        
  ■ Step 1~: 테스트 출제                                                                
  7번호 각각 단어 → 워크북 → 퀴즈. create-test.js 파이프라인 사용.
  1파일씩 SOP 8단계. validate PASS + blind-solve + cross-blind + adversarial.

  ■ 완료 후
  - test-deploy.ts "고3-2026-6월" items 배열에 자기 번호 추가
  - textbooks.ts에 모의-2026-고3-6월 없으면 추가
  - sync.sh + generate-catalog.js + 3곳 push
  - _audit-report.md 작성 (전체 세션 합산 — 마지막 세션이 총괄)
```
