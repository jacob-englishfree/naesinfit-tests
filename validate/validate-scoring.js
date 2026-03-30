#!/usr/bin/env node
/**
 * NaesinFit — validate-scoring.js
 * Phase 3: 채점 정확도 + 난이도 밸런스 검증
 *
 * 검증 항목:
 * SC-1: 서술형 accept 배열에 충분한 유사답안이 포함되어 있는지
 * SC-2: 서술형 wa/accept에 대소문자/띄어쓰기 변형이 포함되어 있는지
 * SC-3: MC 정답(ans)이 ch 범위 안인지 (C15와 중복이지만 별도 확인)
 * SC-4: 어순배열 정답이 문장부호/대소문자 변형을 accept에 포함하는지
 * DF-1: 난이도 분포 (쉬움/보통/어려움)가 5/10/5인지
 * DF-2: 유형 다양성 (3가지 이상 유형)
 * DF-3: 같은 정답 번호 연속 3개 이상 금지
 */

const fs = require('fs');
const path = require('path');

const SEV = { S: 'S', A: 'A', B: 'B', C: 'C' };

class ScoringResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.errors = [];
    this.warnings = [];
  }
  add(id, sev, msg) {
    if (sev === SEV.S || sev === SEV.A) this.errors.push({ id, sev, msg });
    else this.warnings.push({ id, sev, msg });
  }
  get pass() { return this.errors.length === 0; }
}

/**
 * 서술형 정답의 합리적 변형 생성
 * 학생이 입력할 수 있는 변형들
 */
function generateVariants(answer) {
  if (!answer || typeof answer !== 'string') return [];
  const base = answer.trim();
  const variants = new Set();
  variants.add(base.toLowerCase());
  variants.add(base.toUpperCase());
  // 첫 글자 대문자
  variants.add(base.charAt(0).toUpperCase() + base.slice(1).toLowerCase());
  // 마침표 유무
  variants.add(base.replace(/\.$/, ''));
  variants.add(base.replace(/\.$/, '') + '.');
  // 앞뒤 공백
  variants.add(base.replace(/\s+/g, ' '));
  // 관사 유무 (a/an/the)
  variants.add(base.replace(/^(a|an|the)\s+/i, ''));
  return Array.from(variants).map(v => v.toLowerCase().trim()).filter(v => v.length > 0);
}

function validateScoring(jsonPath) {
  const result = new ScoringResult(jsonPath);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const { questions, testType } = data;
  if (!Array.isArray(questions)) return result;

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);

    // ── SC-1: 서술형 accept 배열 충분성 ──
    if (q.fmt === 'written') {
      const acceptArr = q.accept || [];
      const wa = (q.wa || '').trim();

      if (acceptArr.length === 0 && wa) {
        result.add('SC-1', SEV.A, `Q${qid}: 서술형인데 accept 배열이 비어있음 — wa="${wa}"만으로는 변형 답안 불인정`);
      } else if (acceptArr.length === 1) {
        result.add('SC-1', SEV.B, `Q${qid}: accept 배열에 1개만 — 대소문자/마침표 변형 추가 권장`);
      }

      // ── SC-2: 합리적 변형 누락 ──
      if (wa && acceptArr.length > 0) {
        const variants = generateVariants(wa);
        const acceptLower = acceptArr.map(a => a.toLowerCase().trim());
        const missing = variants.filter(v => !acceptLower.includes(v) && v !== wa.toLowerCase());
        // 대소문자 변형 중 하나라도 없으면 경고
        const lowerCase = wa.toLowerCase();
        if (!acceptLower.includes(lowerCase)) {
          result.add('SC-2', SEV.B, `Q${qid}: accept에 소문자 변형 "${lowerCase}" 없음`);
        }
      }

      // ── SC-4: 어순배열 특별 체크 ──
      if (['어순배열', '어순'].includes((q.type || '').trim()) && wa) {
        // 마침표 유무 변형
        const withDot = wa.endsWith('.') ? wa : wa + '.';
        const noDot = wa.replace(/\.$/, '');
        const acceptLower = (q.accept || []).map(a => a.toLowerCase().trim());
        if (!acceptLower.includes(withDot.toLowerCase())) {
          result.add('SC-4', SEV.B, `Q${qid}: 어순배열 accept에 마침표 포함 변형 없음`);
        }
        if (!acceptLower.includes(noDot.toLowerCase())) {
          result.add('SC-4', SEV.B, `Q${qid}: 어순배열 accept에 마침표 미포함 변형 없음`);
        }
      }
    }

    // ── SC-3: MC 정답 범위 ──
    if (q.fmt === 'mc' && Array.isArray(q.ch)) {
      if (typeof q.ans !== 'number' || q.ans < 1 || q.ans > q.ch.length) {
        result.add('SC-3', SEV.S, `Q${qid}: ans=${q.ans} 가 ch[1~${q.ch.length}] 범위 밖`);
      }
    }
  });

  // ── DF-1: 난이도 분포 ──
  if (questions.length === 20) {
    const diffs = { '쉬움': 0, '보통': 0, '어려움': 0 };
    questions.forEach(q => { if (diffs[q.diff] !== undefined) diffs[q.diff]++; });
    if (diffs['쉬움'] !== 5 || diffs['보통'] !== 10 || diffs['어려움'] !== 5) {
      result.add('DF-1', SEV.B, `난이도 분포: 쉬움${diffs['쉬움']} 보통${diffs['보통']} 어려움${diffs['어려움']} (기준: 5/10/5)`);
    }
  }

  // ── DF-2: 유형 다양성 ──
  const types = new Set(questions.map(q => (q.type || '').trim()).filter(t => t));
  if (types.size < 3) {
    result.add('DF-2', SEV.B, `유형 ${types.size}가지만 사용 — 최소 3가지 권장`);
  }

  // ── DF-3: 같은 정답 번호 연속 3개 ──
  if (questions.length >= 5) {
    const mcQuestions = questions.filter(q => q.fmt === 'mc');
    for (let i = 0; i < mcQuestions.length - 2; i++) {
      if (mcQuestions[i].ans === mcQuestions[i + 1].ans && mcQuestions[i + 1].ans === mcQuestions[i + 2].ans) {
        result.add('DF-3', SEV.B, `Q${mcQuestions[i].id}~${mcQuestions[i + 2].id}: 같은 정답 번호 3연속 (${mcQuestions[i].ans}번)`);
      }
    }
  }

  return result;
}

// CLI
if (require.main === module) {
  const ROOT = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);

  function findJson(dir) {
    let r = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) r = r.concat(findJson(f));
      else if (e.name.endsWith('.json')) r.push(f);
    }
    return r;
  }

  const files = args[0] === '--all'
    ? findJson(path.join(ROOT, 'data'))
    : args.map(a => path.resolve(a));

  let pass = 0, fail = 0;
  files.forEach(f => {
    try {
      const r = validateScoring(f);
      const rel = path.relative(ROOT, f);
      if (r.pass) {
        if (r.warnings.length > 0) {
          console.log(`[PASS] ${rel} (${r.warnings.length} warnings)`);
        }
        pass++;
      } else {
        console.log(`[FAIL] ${rel} (${r.errors.length} errors, ${r.warnings.length} warnings)`);
        r.errors.forEach(e => console.log(`  [${e.sev}] ${e.id}: ${e.msg}`));
        fail++;
      }
    } catch (e) {
      console.error(`[ERROR] ${f}: ${e.message}`);
      fail++;
    }
  });

  console.log(`\n채점 검증 완료: ${pass} PASS, ${fail} FAIL (총 ${files.length})`);
}

module.exports = { validateScoring };
