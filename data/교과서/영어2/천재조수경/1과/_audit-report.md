# 증적 리포트 — 영어2 천재조수경 1과 Read More ("Dog Tails, Dolphin Waves")

- 작업: Read More 워크북 + 퀴즈(예상문제) 테스트 신규 출제 (단어 테스트는 기존 완성본)
- 검수 위계: validate(S/A급) → 자체 블라인드 20/20 → cross-blind(Opus 반대모델) 20/20 → adversarial HIGH 0

## 게이트 결과

| 파일 | validate | self-blind | cross-blind(Opus) | adversarial |
|---|---|---|---|---|
| Read More/단어 | PASS (S/A 0) | 20/20 | 20/20 | HIGH 0 |
| Read More/워크북 | PASS (S/A 0) | 20/20 | 20/20 | HIGH 0 |
| Read More/퀴즈 | PASS (S/A 0) | 20/20 | 20/20 | HIGH 0 |

## 워크북 유형 믹스 (20문항 / 100점)
- 어법(4): 쉬움×2(4점), 보통×1(5점), 어려움×1(6점) — 마커 4개 중 1개 문법 오류(수일치/분사구문/전치사·접속사 구분)
- 어휘(2): 보통×2(5점) — 문맥상 부적절한 낱말 판별
- 내용이해 T/F(3): 쉬움×1(4점), 보통×2(5점)
- 빈칸추론(2): 보통×1(5점), 어려움×1(6점)
- 내용일치/불일치(2): 쉬움×1(4점), 보통×1(5점) — 인물명은 거너/델타로 한글 표기(패러프레이즈)
- 오류찾기(1): 어려움(6점) — 마커 4개 중 분사구문 오류 1개
- 서술형 찾기(2): 보통(5점, 3단어) / 어려움(6점, 5단어)
- 서술형 어형변환(1): 보통(5점, 1단어) — observe+목적어+현재분사(swim→swimming)
- 주제/요지(2): 쉬움(4점) / 보통(5점)
- 서술형 조건영작(1): 어려움(6점, 6단어) — bounce around and chase Delta's splashes

## 주요 수정 이력 (이번 세션)
- Q1 마커④: "be"가 "between" 부분 문자열과 충돌 → "fascinated"로 교체 (S-MARKER-ORDER 수정)
- Q5 마커 순서: 텍스트 등장 순서(encounter→loyal→approached→alongside)에 맞춰 재배열, 오류 위치 ③로 이동
- Q12/Q13: 선지의 "Gunner"/"Delta" 영문 고유명사를 "거너"/"델타" 한글 표기로 교체 (A-PARAPHRASE 직역 의심 해소)
- Q17: stem에서 "본문에서 찾아" 표현 제거 (빈칸 처리형과 모순되는 V-ANSWER-FIND-PASSAGE 해소), accept에 "swim" 추가 (지각동사 목적격보어 원형 허용 — adversarial MEDIUM 반영)
- Q20: [조건] 목록의 "Delta's"(curly apostrophe) → "Delta" (아포스트로피 없이)로 정정해 S-COND-WORD-MATCH/S-COND-REVERSE 정규식 파싱 오류 해소
- Q10/Q11: 오답 선지 일부를 fullPassage 실존 단어(boundaries/grace)로 교체해 Q6-WEAK-DISTRACTOR 경고 완화
- 크로스리크: 단어.json이 이미 사용한 (A)(B)(C)/부적절어휘/빈칸/동의어·반의어/다의어/영영풀이/어형변환 타깃 단어(compatible, extraordinary, deep, elegantly, fascinated, intrigued, sensed, politely, trust, habitat, boundaries, enclosure, amusement, clever, companionship, harmonious 등)를 워크북 정답/빈칸/조건영작 타깃에서 배제. 어법·오류찾기는 문법 포인트(수일치·분사구문·전치사vs접속사) 중심으로 설계해 어휘 중복 최소화

## 잔여 B급 경고 (배포 비차단)
- P2 (Q5, Q17): 발췌 시작점이 fullPassage 처음 문장이 아니어서 나타나는 경미한 알림. 실제 passage 텍스트는 원문과 정확히 일치 확인함.

배포 승인: 전 게이트 통과 (S/A급 0, blind 20/20, cross-blind 20/20, adversarial HIGH 0).

---

## 퀴즈(예상문제) 유형 믹스 (20문항 / 100점, 순서 규칙: 어법/어휘 → 빈칸/내용 → 서술형)
- 어법(3): 쉬움(4점, connection이 주어인 관계대명사절 수일치 shows/show) / 보통(5점, swim의 불규칙 과거형 swam/swimmed) / 어려움(6점, 복수주어 interactions에 대한 were/was)
- 문맥상 부적절한 어휘(2): 보통(5점, playful→aggressive) / 어려움(6점, clever→foolish)
- 빈칸추론(3): 보통×3(5점) — graceful movements / grace and friendliness / deep and genuine
- 내용일치/불일치(3): 쉬움(4점) / 보통×2(5점) — 인물명은 필요한 곳만 "Gunner"/"Delta" 유지하되, A-PARAPHRASE 대상인 정답 선지(Q8-②)는 "이 둘은"으로 고유명사 제거
- 주제(1, 보통 5점) / 제목(1, 어려움 6점) — 영어 선지 + det 한국어 번역
- 함축의미 추론(1, 어려움 6점) — "a harmonious dance of joy and companionship"
- 지칭추론(1, 쉬움 4점) — him = Gunner(간접 지칭, 2문장 전 등장)
- 서술형 조건영작(3): 쉬움(4점,7단어) / 어려움(6점,8단어,관계대명사 that) / 보통(5점,9단어)
- 서술형 어법고쳐쓰기(1, 보통 5점, 1단어): seems→seemed
- 서술형 어순배열(1, 쉬움 4점, 10단어)

## 크로스리크 회피
같은 지문의 단어.json/워크북.json이 이미 사용한 마커·빈칸·wa(예: boundaries, enclosure, amusement, playfulness, intentions, Dolphin Research Center, cautious sniffs and gentle touches, bounce around and chase Delta's splashes 등)를 전부 배제하고, 퀴즈만의 독립된 마커/빈칸/wa 조합으로 재설계.

## 검수 중 발견·수정한 이슈
1. **S-CH-TRUNCATED(Q11)**: 주제 선지 1개가 69자로 길어 오탐 → 50자 이하로 축약
2. **A-PARAPHRASE(Q8)**: 정답 선지에 "Gunner"·"Delta" 고유명사 2개 노출 → "이 둘은"으로 교체
3. **S-WA-IN-PASSAGE(Q17 최초안)**: 어법고쳐쓰기 정답 "perform"이 오류표시 "performing"의 부분문자열로 노출 → 완전히 다른 어휘(occurred/observed/seemed/approached, 시제일관성)로 재설계
4. **S-COND-WORD-MATCH(Q18 최초안)**: "grace and friendliness"를 Q7 빈칸 정답과 동일 문구로 재사용해 내부 리크 발생 → "that goes beyond the boundaries of their species"(관계대명사 구문)로 교체
5. **cross-blind 불일치 1건(Q17)**: 오류표시를 원형 "seem"으로 뒀더니 반대모델(Opus)이 "seems"(수일치)로 풀어 정답과 불일치 → 오류표시를 이미 수일치가 맞는 "seems"로 바꿔 시제(seemed)만이 유일한 정답이 되도록 수정 → 재검증 20/20 일치
6. **adversarial MEDIUM 3건(Q7/Q13/Q15)**: 오답 3개가 전부 같은 의미축(전부 부정적 어감 등)이라 본문 없이 소거 가능 → 오답을 서로 다른 축(신체/감정/성격 등)으로 재설계, 재검증 HIGH 0·MEDIUM 0
7. **adversarial LOW(Q16/Q20)**: 조건영작 accept가 정답 어순 1개뿐이라 병렬 성분 순서를 바꿔도 문법적으로 유효한 경우 오채점 위험 → accept에 대안 어순 추가 ("Delta and Gunner would have fun together", "...through mutual respect and shared playfulness")

## 잔여 B급 경고 (배포 비차단, 기존 단어/워크북과 동일한 검증기 한계)
- P2 (Q3): 마커가 발췌 첫 50자 내에 위치해 fullPassage 부분일치 검사가 오탐. 실제 passage는 원문과 정확히 일치 확인함.
- Q6-WEAK-DISTRACTOR (Q7): 오답 3개가 fullPassage 어휘를 그대로 쓰지 않음(권장 사항, 차단 아님).

배포 승인: 전 게이트 통과 (S/A급 0, self-blind 20/20, cross-blind(Opus) 20/20, adversarial HIGH 0 / MEDIUM 0 / LOW 3 — 전부 비차단).
