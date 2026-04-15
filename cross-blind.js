#!/usr/bin/env node
/**
 * Cross-Model Blind-Solve 파이프라인 (Tier 2 품질 보장)
 *
 * 원리: 같은 모델이 출제+풀이 = 자기 정당화 한계.
 *       다른 모델이 풀어 답 일치 = 정답이 본문 단서로 진짜 도출 가능.
 *
 * 워크플로:
 *   1. node cross-blind.js --prep <test.json>
 *      → <test>.cross-prompt.json 생성 (정답/해설 제거된 문항만)
 *   2. 메인 Claude가 Agent(모델=반대쪽)로 풀이 → <test>.cross-blind.json 저장
 *   3. node cross-blind.js --verify <test.json>
 *      → 원본 답과 cross-blind 답 비교 → 불일치 flag
 *
 * 사용법:
 *   node cross-blind.js --prep data/.../단어.json
 *   node cross-blind.js --verify data/.../단어.json
 *   node cross-blind.js --verify data/.../ [폴더 전체]
 */

const fs = require('fs');
const path = require('path');

const VALID_TYPES = ['단어.json', '워크북.json', '퀴즈.json'];

function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const target = args[1];
  if (!cmd || !['--prep', '--verify'].includes(cmd) || !target) {
    console.log('사용법:\n  node cross-blind.js --prep <test.json>\n  node cross-blind.js --verify <test.json|폴더>');
    process.exit(1);
  }
  return { cmd, target };
}

function collectFiles(target) {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) {
    console.error(`경로 없음: ${resolved}`);
    process.exit(1);
  }
  if (fs.statSync(resolved).isDirectory()) {
    const files = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== '_passages') walk(path.join(dir, entry.name));
        else if (entry.isFile() && VALID_TYPES.includes(entry.name)) files.push(path.join(dir, entry.name));
      }
    }
    walk(resolved);
    return files;
  }
  return [resolved];
}

// ── --prep: 정답 제거한 prompt 생성 ──
function prep(testPath) {
  const data = JSON.parse(fs.readFileSync(testPath, 'utf8'));
  const prompt = {
    _: [
      '너는 독립 검증자다. 아래 20문항을 passage+stem+ch만 보고 풀이한다.',
      'ans/wa는 알 수 없다. 오직 본문 단서와 문법 지식만으로 판단.',
      '각 문항마다 {id, pick, reason} 출력. mc는 pick=1~4 (1-based). written은 pick=정답 문자열.',
      '정답 모호하면 가장 그럴듯한 것 선택 + reason에 "모호" 표기.',
      '출력은 JSON: {"solves":[{id,pick,reason},...]}'
    ],
    testType: data.testType,
    ei: data.ei,
    fullPassage: data.fullPassage,
    questions: data.questions.map(q => ({
      id: q.id,
      type: q.type,
      diff: q.diff,
      fmt: q.fmt,
      passage: q.passage,
      stem: q.stem,
      ch: q.ch,
    })),
  };
  const out = testPath.replace(/\.json$/, '.cross-prompt.json');
  fs.writeFileSync(out, JSON.stringify(prompt, null, 2));
  console.log(`✅ prep: ${out}`);
  console.log(`   다음: Agent(model=반대) 스폰하여 이 파일 읽고 <test>.cross-blind.json 작성`);
  console.log(`   출제 모델: ${data._createdBy || '미지정'} → 반대 모델로 풀이 권장`);
}

// ── --verify: 원본 답 vs cross-blind 답 비교 ──
function verify(testPath) {
  const crossPath = testPath.replace(/\.json$/, '.cross-blind.json');
  if (!fs.existsSync(crossPath)) {
    return { file: testPath, status: 'NO_CROSS', detail: `cross-blind 파일 없음: ${crossPath}` };
  }
  const test = JSON.parse(fs.readFileSync(testPath, 'utf8'));
  const cross = JSON.parse(fs.readFileSync(crossPath, 'utf8'));
  const solves = cross.solves || cross.questions || [];
  const NORM = s => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!?,;:'"`]+$/, '').replace(/-/g, ' ').toLowerCase();

  const mismatches = [];
  test.questions.forEach(q => {
    const solve = solves.find(s => s.id === q.id);
    if (!solve) { mismatches.push({ id: q.id, issue: 'cross-blind 누락' }); return; }
    let match = false;
    if (q.fmt === 'mc') match = solve.pick === q.ans;
    else {
      const pickN = NORM(solve.pick);
      const waN = NORM(q.wa);
      const acceptN = (q.accept || []).map(NORM);
      match = pickN === waN || acceptN.includes(pickN);
    }
    if (!match) mismatches.push({
      id: q.id,
      type: q.type,
      expected: q.fmt === 'mc' ? q.ans : q.wa,
      cross: solve.pick,
      reason: solve.reason || '',
    });
  });

  const status = mismatches.length === 0 ? 'PASS' : 'FLAG';
  return { file: testPath, status, total: test.questions.length, mismatches };
}

function printVerify(result) {
  const { file, status, total, mismatches, detail } = result;
  const rel = path.relative(process.cwd(), file);
  if (status === 'NO_CROSS') {
    console.log(`[SKIP] ${rel} — ${detail}`);
    return;
  }
  if (status === 'PASS') {
    console.log(`[PASS] ${rel} — ${total}/${total} cross-blind 일치`);
    return;
  }
  console.log(`[FLAG] ${rel} — ${mismatches.length}/${total} 불일치`);
  mismatches.forEach(m => {
    console.log(`   Q${m.id} [${m.type || '?'}]: expected=${JSON.stringify(m.expected)} cross=${JSON.stringify(m.cross)}`);
    if (m.reason) console.log(`      reason: ${m.reason}`);
  });
}

// ── main ──
const { cmd, target } = parseArgs();
if (cmd === '--prep') {
  const files = collectFiles(target);
  files.forEach(prep);
} else {
  const files = collectFiles(target);
  const results = files.map(verify);
  results.forEach(printVerify);
  const flagged = results.filter(r => r.status === 'FLAG');
  const passed = results.filter(r => r.status === 'PASS');
  const skipped = results.filter(r => r.status === 'NO_CROSS');
  console.log(`\n── 결과 ──`);
  console.log(`PASS: ${passed.length} / FLAG: ${flagged.length} / SKIP: ${skipped.length}`);
  if (flagged.length > 0) process.exit(1);
}
