# 워크북 증적 리포트 — Pathways4 Unit6 (Is Joy the Same in Every Language?)

- 대상: `data/부교재/Pathways4/Unit6/워크북.json`
- 출제/검수 모델: Opus 4.8 (cross-blind = Sonnet)
- exam_style: 양지원(민사고) — 전 영문 시험지 + 영영정의 + 문법 카운팅 + 5문장 에세이 지향 → 서술형·주제/요지·어법 학술 강화

## 결과 요약
- validate: **PASS** (S/A급 0)
- blind-solve(Opus): **20/20**
- cross-blind(Sonnet 독립 재풀이): **20/20 일치**
- adversarial: HIGH **0** / LOW 5
- ans 분포: {1:4, 2:4, 3:4, 4:4} (T/F 포함, 최대 4·연속 2 이하)
- 배점: 쉬움 5×4=20 / 보통 10×5=50 / 어려움 5×6=30 = **100**

## 구성 (20문항)
- 1~4 어법(단수 주어 일치·관계사절 수 일치·계속용법·부사구 도치)
- 5~6 어휘(문맥 부적절)
- 7~9 내용이해 T/F(패러프레이즈)
- 10~11 빈칸추론(구절 단위)
- 12 일치 / 13 불일치(패러프레이즈 선지)
- 14 오류찾기(현재완료 수동 수 일치)
- 15~16 서술형 찾기(categorization / psychological constructionism)
- 17 서술형 어형변환(offered, find+O+p.p.)
- 18 주제 / 19 요지(영어 선지 + det 한국어 해석)
- 20 서술형 조건영작(계속적 용법 who ... 4단어)

## 안전성 점검
- 부교재 passage = fullPassage 통째 + overlay만 (S-PASSAGE-NOT-FULL PASS)
- 마커 ①②③④ fullPassage 전체 분산, 순서 단조증가 (S-MARKER-ORDER PASS)
- 단어.json 정답/overlay와 cross-leak 0건 (다른 본문영역·다른 어법포인트)
- 파일 내 wa/blank/underline 중복 0건
- 서술형 wa/blank = fullPassage 정확 substring, 조건영작 [조건]에 전 토큰 명시(알파벳순)
- 고유명사(Tim Lomas·Shariatmadari·Baranczak·Lindquist·Pavlenko) passage 내 실재만 사용
