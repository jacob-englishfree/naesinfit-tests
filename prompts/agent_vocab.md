# 단어 테스트 출제 Agent 프롬프트 템플릿

**사용법**: Agent 호출 시 `{{var}}` 자리를 채워서 전달.

---

내신핏 테스트 출제 파이프라인 실행. **{{subject}}** 출제 대상: **{{path}}** / 유형: **단어**.

## 작업 파일
- 프롬프트: `{{promptPath}}` (prompt.json)
- 본문: `{{passagePath}}` (fullPassage)
- 참고 PASS 템플릿: `{{referencePath}}`

## 절차 (전부 이행 필수)

### STEP A: 출제
1. prompt.json + fullPassage + 참고 템플릿 읽기
2. `단어.response.json` 작성 (동일 폴더)
   - 배점: 쉬움 5×4 + 보통 10×5 + 어려움 5×6 = 100
   - ans 1-based, 동일 번호 5회↑ 금지, 3연속 금지
   - passage는 스크립트가 자동 조립. response.json엔 overlay만
3. `cd /Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests && node create-test.js --assemble {{responsePath}}`
4. FAIL 시 수정 후 재실행 (최대 5회)

### STEP B: 블라인드 (자체)
5. `node validate/blind-solve.js {{testPath}}` → blind-prompt.json
6. 정답 보지 않고 20문항 직접 풀이 → `단어.blind.json` 저장
7. 20/20 일치 확인

### STEP C: Cross-blind (반대 모델)
8. `node cross-blind.js --prep {{testPath}}` → cross-prompt.json
9. 다른 인스턴스/모델 풀이 → `단어.cross-blind.json` 저장
   - 포맷: `{"testFile":"...","solves":[{"id":N,"pick":...,"reason":"..."}]}`
10. `node cross-blind.js --verify {{testPath}}` → PASS 확인

### STEP D: 적대적 공격
11. 공격자 역할로 20문항 재검토. 발견 사항을 `단어.adversarial.json` 저장
    - 체크: 정답 2개 가능 / 정답 노출 / 뻔한 오답 / 모호 stem / 문법 오류 / passage 무관
    - 포맷: `{"testFile":"...","issues":[...],"totalIssues":N}`
12. HIGH 이슈 있으면 해당 문항 재출제 후 STEP A~C 재실행

## 유형 화이트리스트 (단어)
동의어/반의어/영영풀이/빈칸어휘/(A)(B)(C)/부적절 어휘/다의어/어형변환/한영

## S급 금지 11종 (0건 필수)
S-META-LEAK / S-PREFIX-DOMINANT / S-CIRCULAR-STEM / S-MISSING-KOREAN / S-WORDCOUNT-MISMATCH / S-CH-TRUNCATED / S-MARKER-LEAK / S-TYPE-CONTENT-MISMATCH / S-PASSAGE-1-SENTENCE / S-WA-IN-PASSAGE / S-LENGTH-BIAS

## 반의어 출제 규칙 (특히 주의)
- 오답 3개 중 최소 1개는 **의미축 다른 단어** (소거법 차단)
- ⛔ prefix 조작 금지 (un-/in-/dis-/mis-/non-) — S-ANTONYM-PREFIX
- 예: common 반의어 = rare → 오답에 famous/mutual/standard 같이 의미축 분산

## 원칙
- fullPassage 정확 substring (한 글자도 변형 금지)
- 오답도 본문 등장 단어 우선
- 어형변환 base form은 본문에 반드시 존재
- 마커(①~④)/빈칸은 fullPassage 전체에 분산

## 완료 조건 (전부 충족해야 "완료")
- [ ] validate ALL PASS (S/A급 0)
- [ ] blind 20/20 일치
- [ ] cross-blind 20/20 일치
- [ ] adversarial.json HIGH 0건

## 보고 (250자 이내)
- STEP A~D 각 단계 결과
- 발견된 이슈와 해결
- 최종 파일 경로 5개 (.json, .response.json, .blind.json, .cross-blind.json, .adversarial.json)
