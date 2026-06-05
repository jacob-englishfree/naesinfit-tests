# 22강 출제·검수 증적 리포트

**생성일**: 2026-06-05
**대상**: `data/부교재/수능특강/영어/22강`
**생성 방식**: `node scripts/generate-audit-report.js data/부교재/수능특강/영어/22강`

## 최종 요약

| 항목 | 결과 |
|---|---|
| 파일 수 | 12 |
| validate PASS | 12/12 |
| blind.json 존재 | 12/12 |
| cross-blind.json 존재 | 12/12 |
| adversarial HIGH | 10건 |
| adversarial MEDIUM | 16건 |
| adversarial LOW | 6건 |

## 지문 구성

| 섹션 | 제목 | 문장/단어 |
|---|---|---|
| 1번 | Human-altered Landscapes Undermine Ecological Connectivity | 7/171 |
| 2번 | Biopower: Sustainable Energy from Waste | 7/150 |
| 3번 | Elephants as Keystone Species in Savannas | 8/161 |

## 파일별 검수 상태

| 섹션 | 유형 | validate | blind | cross-blind | adversarial |
|---|---|---|---|---|---|
| 1번 | 단어 | ✅ | ✅ | ✅ | ⚠ (3) |
| 1번 | 워크북 | ✅ | ✅ | ✅ | ⚠ (3) |
| 1번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (3) |
| 2번 | 단어 | ✅ | ✅ | ✅ | ⚠ (3) |
| 2번 | 워크북 | ✅ | ✅ | ✅ | ⚠ (3) |
| 2번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (2) |
| 3번 | 단어 | ✅ | ✅ | ✅ | ⚠ (3) |
| 3번 | 워크북 | ✅ | ✅ | ✅ | ⚠ (2) |
| 3번 | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (2) |
| Gateway | 단어 | ✅ | ✅ | ✅ | ⚠ (2) |
| Gateway | 워크북 | ✅ | ✅ | ✅ | ⚠ (2) |
| Gateway | 퀴즈 | ✅ | ✅ | ✅ | ⚠ (4) |

## Adversarial HIGH 이슈 (수정 필요)

| 파일 | 문항 | 카테고리 | 설명 |
|---|---|---|---|
| 1번/단어 | Q3 | 문법 오류 (오탈자) | passage에 'dams can permanently halt (C)[spawning / migration] of fish of fish by blocking' — 'of fish'가 중복 입력된 오탈자. 학생이 이상한 문장을 읽게 되며 실제 원문은 'spawning of fish by blocking travel to their breeding grounds'. fullPassage에는 오류 없으나 passage 오버레이 생성 시 중복 삽입된 것으로 보임. |
| 1번/워크북 | Q19 | 문법 오류 — wa 불완전 문장 | 어순배열 문항. [단어] 목록: 'of / value / conservation / the / habitat / remaining / what / below / might / suggest' (10단어). wa = 'the conservation value of remaining habitat below what might suggest'. 그런데 원문은 'below what its mapped area might suggest'로 'its mapped area'가 'might suggest'의 주어임. 주어(its mapped area)가 제공된 10단어에 없으므로 학생이 문법적으로 완전한 문장을 만들 수 없음. 'what might suggest'는 'what'이 주어와 동사만 있고 목적어가 없어 불완전. 정답 wa 자체가 원문 문법을 따르지 않는 오류 문항. 즉시 수정 필요. |
| 2번/단어 | Q1 | 정답 2개 가능 (C 항목) | (C) appreciable vs significant 대립. 원문: 'contains no appreciable sulfur content'. 그런데 'contains no significant sulfur content'도 문맥상 자연스러운 영어 표현. appreciable과 significant는 '상당한'으로 거의 동의어. 수험생이 ②(sustainable-alleviate-significant)도 옳다고 항의 가능. det에서 'significant: 원문과 불일치'로 처리하나 실질적 의미 차이 약함. |
| 2번/워크북 | Q16 | S-MULTI-ITEM-WRITTEN 유사 / 채점 기준 모호 | 서술형 — 핵심단어 id:16. stem: '식물 물질을 태우면 토양이 박탈되는 것 2가지 중 하나를 영어로 쓰시오. (1단어)'. accept에 'nutrients'와 'matter'가 있는데, 원문은 'nutrients and organic matter'(2단어 구). 'matter' 단독 허용은 'organic matter'에서 형용사를 제거한 불완전 표현으로 실제 원문 단어가 아님. 또한 '2가지 중 하나' 표현이 S-MULTI-ITEM-WRITTEN 규칙(단일 답 원칙)과 충돌할 여지. 'matter' 단독 accept 제거 또는 stem을 nutrients 단일로 특정 필요. |
| 2번/퀴즈 | Q1 | det 내부 메모 미삭제 / S-META-LEAK | 문장삽입 id:1. det.analysis 마지막 줄: '...사실 ③이 더 적절. ←정답을 ③으로 수정' — 이 문장은 출제자의 내부 검토 메모가 그대로 det에 남아 있음. 학생이 해설을 열면 '←정답을 ③으로 수정'이라는 출제자 메모를 그대로 읽게 됨. S-META-LEAK 규칙 위반. 또한 det에서 ④에 '...맥락상 적절'이라고 기술하다가 마지막에 '사실 ③이 더 적절'로 자기모순. ans=3으로 설정되어 있으나 해설 자체가 ④가 맞다고 쓴 후 마지막에 뒤집음. 즉시 det 정리 및 메모 삭제 필요. |
| 2번/퀴즈 | Q1 | 정답 논란 (③④ 동시 성립) | 삽입 문장 'However, there is a trade-off when biomass is used for energy production.' 위치 논란. ③ = 건강 이점(황산화물 감소) 설명 이후, 토양 박탈 설명 바로 앞. 장점(건강)→단점(토양박탈) 전환이므로 However가 가장 자연스러운 전환점. 실제로 ans=3이 맞음. 그러나 det이 ④를 먼저 설명하다 마지막에 번복하는 구조여서 학생이 ④를 골랐을 때 해설을 보고 혼란. 해설 재작성 필수. |
| Gateway/단어 | Q14 | S-ANTONYM-PREFIX 위반 | 반의어 고르기 id:14. undesirable의 반의어로 ① desirable 출제 — un- 접두사를 제거한 접두사 조작형 반의어. CLAUDE.md S-ANTONYM-PREFIX 규칙 명시 위반. det.tip에 '접두사 반의어이나 기본어 대비이므로 허용'으로 예외 처리했으나 시스템 규칙상 허용 불가. desirable을 다른 단어(예: welcome/preferred)로 교체 필요. |
| Gateway/퀴즈 | Q18 | det 한국어 설명 비대응 (S-META-LEAK 유사) | 서술형 핵심단어 id:18. det.korean: '경성경로에서 습지/늪의 인식'. 그러나 wa = 'the unique advantage of intellectual modesty with respect'. stem은 '연성경로 공학의 고유한 장점'을 묻는데 det이 '경성경로에서 습지/늪의 인식'이라고 설명함 — 완전히 다른 내용. det.korean이 다른 문항의 해설로 잘못 복사된 것으로 보임. 학생이 해설을 보면 혼란스러움. |
| Gateway/퀴즈 | Q19 | 워크북 중복 (N7 유사) | 서술형 조건영작 id:19. wa = 'redirect the trail around the fallen tree' (7단어). Gateway 워크북 id:18의 wa도 동일 'redirect the trail around the fallen tree'. 같은 교재 같은 지문에서 워크북과 퀴즈가 동일한 wa를 사용하는 크로스파일 중복. 퀴즈는 워크북과 다른 답, 다른 부분으로 출제해야 함(규칙 N7). |
| Gateway/퀴즈 | Q20 | 워크북 중복 (N7 유사) | 어순배열 id:20. wa = 'to remove the tree and restore the original route' (9단어). Gateway 워크북 id:19의 wa도 동일 'to remove the tree and restore the original route'. 퀴즈와 워크북이 동일 wa 중복 사용. 퀴즈 id:20 재출제 필요. |

## 배포 가능 여부

⛔ **배포 불가** — 위 미비점 해결 필요

### jacob 본인 확인 필요
- [ ] 실기기 카카오톡에서 박선민/학생 링크 접속 테스트
- [ ] 무작위 5% 스팟 풀이 (1파일)
- [ ] 수업자료 PDF(합본) Dropbox 업로드 여부
