#!/usr/bin/env node
/**
 * Multi-Agent Cross-Check 헬퍼 — API 없이 Tier 2 하이브리드 구현
 *
 * 사용법 (메인 Claude Code 세션에서):
 *   1. 이 스크립트로 Agent 프롬프트 생성
 *      node scripts/cross-check.js verify <test.json>   → Agent V 지시문 stdout
 *      node scripts/cross-check.js adversarial <test.json> → Agent A 지시문 stdout
 *      node scripts/cross-check.js compare <test.json> <verify.json> <adversarial.json>
 *
 *   2. 메인 Claude가 Task 도구로 서브에이전트 spawn
 *      Task({ subagent_type: "general-purpose", model: "opus" or "sonnet", prompt: "..." })
 *
 *   3. 서브에이전트 결과 파일 저장 후 compare로 판정
 */

const fs = require('fs');
const path = require('path');

const SUBCMD = process.argv[2];
const FILE = process.argv[3];

function abort(msg) { console.error(`❌ ${msg}`); process.exit(1); }

if (!SUBCMD) {
  console.log(`사용법:
  node scripts/cross-check.js verify <test.json>       → Agent V (Opus) blind-solve 프롬프트 생성
  node scripts/cross-check.js adversarial <test.json>  → Agent A (Sonnet) 적대적 스캔 프롬프트 생성
  node scripts/cross-check.js compare <test.json> <verify-result.json> <adversarial-result.json>
                                                        → 3 에이전트 결과 통합 판정`);
  process.exit(0);
}

if (!FILE || !fs.existsSync(FILE)) abort(`파일 없음: ${FILE}`);

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const rel = path.relative(process.cwd(), FILE);

// ── Agent V: Blind-solve (Opus 서브에이전트) ──
if (SUBCMD === 'verify') {
  // 정답 가린 문항 추출
  const hidden = data.questions.map(q => {
    const { ans, wa, accept, det, analysis, korean, tip, ...clean } = q;
    return clean;
  });
  const pkg = {
    source: data.ei?.lesson || 'unknown',
    fullPassage: data.fullPassage,
    questions: hidden
  };
  const pkgPath = `/tmp/cross_verify_input_${Date.now()}.json`;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Agent V (Opus) 지시문 — Task로 실행
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task 호출:
  subagent_type: "general-purpose"
  model: "opus"
  prompt: |
    독립 검수자로서 다음 테스트를 풀이해주세요.
    정답/해설/분석을 보지 말고 passage + stem + ch 만으로 판단하세요.

    입력 파일: ${pkgPath}
    이 파일에는 정답(ans/wa/accept/det/analysis/korean/tip)이 이미 제거되어 있습니다.

    각 문항에 대해:
    - id
    - myAnswer (mc는 1-4 숫자, written은 문자열)
    - reasoning (1줄, 왜 그렇게 판단했는지)
    - confidence ("high"|"medium"|"low")
    - needsAgent false

    출력 파일: /tmp/cross_verify_output_${Date.now()}.json
    형식: { "solves": [...] }

    ⛔ 정답 field는 절대 참조하지 마세요. 파일에 아예 없습니다.
`);
  return;
}

// ── Agent A: Adversarial scan (Sonnet 서브에이전트) ──
if (SUBCMD === 'adversarial') {
  const pkg = {
    source: data.ei?.lesson || 'unknown',
    fullPassage: data.fullPassage,
    questions: data.questions
  };
  const pkgPath = `/tmp/cross_adversarial_input_${Date.now()}.json`;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Agent A (Sonnet) 지시문 — Task로 실행
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task 호출:
  subagent_type: "general-purpose"
  model: "sonnet"
  prompt: |
    적대적 검수자로서 다음 테스트의 각 문항을
    "passage 없이 소거법으로 풀 수 있는가?"
    "선지 패턴만 보고 정답 추정 가능한가?"
    관점에서 스캔해주세요.

    입력 파일: ${pkgPath}

    각 문항에 대해 다음을 체크:
    1. 오답 3개가 전부 추상/메타 서술인가?
    2. 정답이 유독 길거나/구체적이라 눈에 띄는가?
    3. 접두사/형태 조작으로 정답이 유추되는가?
    4. passage를 읽지 않고도 상식/문장 구조로 풀리는가?
    5. 선지 중 문법적/의미적으로 명백히 틀린 것이 3개 이상인가?

    출력 파일: /tmp/cross_adversarial_output_${Date.now()}.json
    형식:
      {
        "flags": [
          {"id": 1, "issue": "…", "severity": "high|med|low", "evidence": "…"},
          ...
        ]
      }

    ⛔ 문제 없으면 flags: [] 로 출력.
    ⛔ 억지로 플래그 찾지 마세요. 실제 의심되는 것만.
`);
  return;
}

// ── Compare: 3 에이전트 결과 통합 판정 ──
if (SUBCMD === 'compare') {
  const verifyPath = process.argv[4];
  const advPath = process.argv[5];
  if (!verifyPath || !advPath) abort('compare 사용법: cross-check.js compare <test.json> <verify.json> <adversarial.json>');

  const verify = JSON.parse(fs.readFileSync(verifyPath, 'utf8'));
  const adv = JSON.parse(fs.readFileSync(advPath, 'utf8'));

  const report = { file: rel, total: data.questions.length, mismatches: [], adversarial: [], verdict: 'unknown' };

  // Verify 결과와 정답 대조
  for (const s of verify.solves || []) {
    const q = data.questions.find(x => x.id === s.id);
    if (!q) continue;
    if (q.fmt === 'mc') {
      if (s.myAnswer !== q.ans) {
        report.mismatches.push({ id: s.id, v_answer: s.myAnswer, actual_ans: q.ans, v_reason: s.reasoning, confidence: s.confidence });
      }
    } else if (q.fmt === 'written') {
      const waNorm = String(q.wa || '').toLowerCase().trim();
      const myNorm = String(s.myAnswer || '').toLowerCase().trim();
      const accept = (q.accept || []).map(a => String(a).toLowerCase().trim());
      const ok = waNorm === myNorm || accept.includes(myNorm);
      if (!ok) {
        report.mismatches.push({ id: s.id, v_answer: s.myAnswer, actual_wa: q.wa, v_reason: s.reasoning, confidence: s.confidence });
      }
    }
  }

  // Adversarial flags 그대로 전달
  report.adversarial = adv.flags || [];

  // 판정 로직
  const hiSev = report.adversarial.filter(f => f.severity === 'high').length;
  const confMismatches = report.mismatches.filter(m => m.confidence === 'high').length;

  if (hiSev > 0 || confMismatches > 0) report.verdict = 'BLOCK (재출제 권장)';
  else if (report.mismatches.length > 0 || report.adversarial.length > 0) report.verdict = 'REVIEW (메인 최종 판단)';
  else report.verdict = 'PASS (3중 합의)';

  console.log(JSON.stringify(report, null, 2));
  return;
}

abort(`알 수 없는 명령: ${SUBCMD}`);
