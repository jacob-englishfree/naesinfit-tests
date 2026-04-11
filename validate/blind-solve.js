#!/usr/bin/env node
/**
 * 블라인드 풀이 자동화 스크립트
 *
 * 테스트 JSON에서 ans/wa를 제거한 사본을 만들고,
 * AI 에이전트가 정답 없이 풀이한 결과를 저장합니다.
 *
 * 사용법:
 *   node validate/blind-solve.js data/.../단어.json          # 단일 파일
 *   node validate/blind-solve.js data/.../16강/              # 폴더 전체
 *   node validate/blind-solve.js --check data/.../단어.json  # 증적 존재 여부만 확인
 *
 * 출력:
 *   data/.../단어.blind.json  (블라인드 풀이 증적 파일)
 *
 * ⛔ 이 스크립트의 출력(blind.json)이 없으면 deploy-json.js가 배포 차단
 */

const fs = require('fs');
const path = require('path');

const VALID_TYPES = ['단어.json', '워크북.json', '퀴즈.json'];

// ── 파일 수집 ──
function collectFiles(target) {
  const resolved = path.resolve(target);
  if (fs.statSync(resolved).isDirectory()) {
    const files = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== '_passages') {
          walk(path.join(dir, entry.name));
        } else if (entry.isFile() && VALID_TYPES.includes(entry.name)) {
          files.push(path.join(dir, entry.name));
        }
      }
    }
    walk(resolved);
    return files;
  }
  return [resolved];
}

// ── 정답 제거된 사본 생성 ──
function stripAnswers(data) {
  const stripped = JSON.parse(JSON.stringify(data));
  for (const q of stripped.questions) {
    delete q.ans;
    delete q.wa;
    delete q.accept;
    // det도 제거 (풀이 힌트 방지)
    delete q.det;
  }
  return stripped;
}

// ── blind.json 경로 ──
function blindPath(jsonPath) {
  const dir = path.dirname(jsonPath);
  const base = path.basename(jsonPath, '.json');
  return path.join(dir, `${base}.blind.json`);
}

// ── 증적 존재 확인 모드 ──
function checkMode(target) {
  const files = collectFiles(target);
  let pass = 0, fail = 0;

  for (const f of files) {
    const bp = blindPath(f);
    if (fs.existsSync(bp)) {
      const blind = JSON.parse(fs.readFileSync(bp, 'utf8'));
      const orig = JSON.parse(fs.readFileSync(f, 'utf8'));

      // 검증: 20문항 전부 풀이됐는지
      if (!blind.solves || blind.solves.length !== orig.questions.length) {
        console.log(`[FAIL] ${path.relative(process.cwd(), f)} — blind.json 문항수 불일치`);
        fail++;
        continue;
      }

      // 검증: 일치율
      const matches = blind.solves.filter(s => s.match).length;
      const total = blind.solves.length;

      if (matches < total) {
        console.log(`[WARN] ${path.relative(process.cwd(), f)} — ${matches}/${total} 일치 (불일치 ${total - matches}건)`);
      } else {
        console.log(`[PASS] ${path.relative(process.cwd(), f)} — ${matches}/${total} 일치`);
      }
      pass++;
    } else {
      console.log(`[FAIL] ${path.relative(process.cwd(), f)} — blind.json 없음 ⛔`);
      fail++;
    }
  }

  console.log(`\n결과: ${pass} PASS, ${fail} FAIL (총 ${files.length})`);
  process.exit(fail > 0 ? 1 : 0);
}

// ── 풀이용 문제 출력 (에이전트가 읽을 형태) ──
function generateBlindPrompt(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const stripped = stripAnswers(data);
  const promptPath = jsonPath.replace('.json', '.blind-prompt.json');

  fs.writeFileSync(promptPath, JSON.stringify(stripped, null, 2), 'utf8');
  console.log(`[생성] ${path.relative(process.cwd(), promptPath)}`);
  return promptPath;
}

// ── 메인 ──
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('사용법:');
  console.log('  node validate/blind-solve.js <파일|폴더>         # 블라인드 프롬프트 생성');
  console.log('  node validate/blind-solve.js --check <파일|폴더> # 증적 확인');
  process.exit(0);
}

if (args[0] === '--check') {
  if (!args[1]) { console.error('대상 경로 필요'); process.exit(1); }
  checkMode(args[1]);
} else {
  const files = collectFiles(args[0]);
  console.log(`${files.length}개 파일 블라인드 프롬프트 생성...\n`);

  for (const f of files) {
    const bp = blindPath(f);
    if (fs.existsSync(bp)) {
      console.log(`[SKIP] ${path.relative(process.cwd(), f)} — blind.json 이미 존재`);
      continue;
    }
    generateBlindPrompt(f);
  }

  console.log('\n다음 단계: 각 .blind-prompt.json을 에이전트에게 전달하여 풀이 → .blind.json 생성');
}
