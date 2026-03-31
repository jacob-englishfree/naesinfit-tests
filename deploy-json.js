#!/usr/bin/env node
/**
 * NaesinFit 테스트 JSON 배포 게이트키퍼
 *
 * ⛔ 이것이 유일한 배포 경로. HTML 생성/engine.js 사용 금지.
 *
 * 사용법:
 *   node deploy-json.js data/교과서/공통영어1/비상홍/2과/본문/단어.json
 *   node deploy-json.js data/교과서/영어1/YBM박준언/1과/  (폴더 전체)
 *   node deploy-json.js --all                              (전체 검증)
 *
 * 검증 항목:
 *   1. 폴더 경로 규칙 (source/path/unit/section/type.json)
 *   2. JSON 스키마 (20문항, 100점, 필수 필드)
 *   3. validate.js 53체크
 *   4. test-deploy.ts 매핑 존재 여부
 *
 * 전부 PASS → git add + commit + push
 * 하나라도 FAIL → 배포 차단
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname);
const DATA_DIR = path.join(ROOT, 'data');

// ── 유효한 구조 정의 ──
const VALID_SOURCES = ['교과서', '부교재', '모의고사'];
const VALID_TYPES = ['단어.json', '워크북.json', '퀴즈.json'];

// test-deploy.ts 에서 등록된 폴더명 (path 값)
const VALID_TEXTBOOK_PATHS = [
  '공통영어1/YBM김은형', '공통영어1/YBM박준언', '공통영어1/능률민병천',
  '공통영어1/능률오선영', '공통영어1/동아이병민', '공통영어1/미래엔김성연',
  '공통영어1/비상홍', '공통영어1/지학사신상근', '공통영어1/천재강상구',
  '공통영어1/천재조수경',
  '영어1/YBM박준언', '영어1/능률오선영', '영어1/동아박용예',
  '영어1/미래엔김성연', '영어1/비상홍', '영어1/지학사신상근',
  '영어1/천재강상구', '영어1/천재조수경',
  '영어2/YBM한상호',
];

const VALID_SUPPLEMENT_PATHS = ['수능특강/영어'];
const VALID_UNIT_PATTERN = /^\d+과$|^\d+강$/;
const VALID_MOCK_PATTERN = /^(고1|고2|고3)\/.+$/;

// ── 결과 집계 ──
let totalFiles = 0;
let passCount = 0;
let failCount = 0;
const failures = [];

// ── 경로 검증 ──
function validatePath(jsonPath) {
  const rel = path.relative(DATA_DIR, jsonPath);
  const parts = rel.split(path.sep);
  const errors = [];

  // 최소 구조: source/path.../unit/section/type.json
  if (parts.length < 4) {
    errors.push(`경로 깊이 부족: ${rel} (최소 source/path/unit/section/type.json)`);
    return errors;
  }

  const source = parts[0];
  if (!VALID_SOURCES.includes(source)) {
    errors.push(`잘못된 source: "${source}" (허용: ${VALID_SOURCES.join(', ')})`);
    return errors;
  }

  const fileName = parts[parts.length - 1];
  if (!VALID_TYPES.includes(fileName)) {
    errors.push(`잘못된 파일명: "${fileName}" (허용: ${VALID_TYPES.join(', ')})`);
  }

  if (source === '교과서') {
    // 구조: 교과서/{학년}/{출판사}/{과}/{섹션}/type.json
    if (parts.length < 5) {
      errors.push(`교과서 경로 깊이 부족: ${rel}`);
      return errors;
    }
    const textbookPath = `${parts[1]}/${parts[2]}`;
    if (!VALID_TEXTBOOK_PATHS.includes(textbookPath)) {
      errors.push(`미등록 교과서: "${textbookPath}"\n  등록된 교과서: ${VALID_TEXTBOOK_PATHS.join(', ')}`);
    }
    const unit = parts[3];
    if (!VALID_UNIT_PATTERN.test(unit)) {
      errors.push(`잘못된 단원명: "${unit}" (예: 1과, 2과, 1강)`);
    }
    // section은 "본문" 또는 추가지문명 — 자유 형식이지만 비어있으면 안 됨
    const section = parts[4];
    if (section === fileName) {
      errors.push(`section 폴더 누락: JSON이 ${unit}/ 바로 아래에 있음. 반드시 "본문/" 등 섹션 폴더 안에 넣으세요.`);
    }
  }

  if (source === '부교재') {
    const supPath = `${parts[1]}/${parts[2]}`;
    if (!VALID_SUPPLEMENT_PATHS.includes(supPath)) {
      errors.push(`미등록 부교재: "${supPath}"`);
    }
  }

  return errors;
}

// ── JSON 스키마 검증 ──
function validateSchema(jsonPath) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    errors.push(`JSON 파싱 실패: ${e.message}`);
    return errors;
  }

  if (!data.questions || !Array.isArray(data.questions)) {
    errors.push('questions 배열 없음');
    return errors;
  }

  if (data.questions.length !== 20) {
    errors.push(`문항수 ${data.questions.length} ≠ 20`);
  }

  // 배점 합계 (필드명: pts 또는 points)
  const totalPoints = data.questions.reduce((sum, q) => sum + (q.pts || q.points || 0), 0);
  if (totalPoints !== 100) {
    errors.push(`배점 합계 ${totalPoints} ≠ 100`);
  }

  // 필수 필드 검증
  const numMap = {'①':1,'②':2,'③':3,'④':4,'⑤':5};
  data.questions.forEach((q, i) => {
    if (!q.stem) errors.push(`Q${i + 1}: stem 없음`);
    if (q.ans === undefined && q.answer === undefined && q.wa === undefined) {
      errors.push(`Q${i + 1}: 정답(ans/answer/wa) 없음`);
    }
    if (!q.type) errors.push(`Q${i + 1}: type 없음`);
    if (!q.pts && !q.points) errors.push(`Q${i + 1}: 배점(pts) 없음`);
    if (!q.diff) errors.push(`Q${i + 1}: diff(난이도) 없음`);

    // ⛔ 정답범위 검증: 객관식 ans는 1~ch.length 범위
    if (q.fmt === 'mc' && q.ch && typeof q.ans === 'number') {
      if (q.ans < 1 || q.ans > q.ch.length) {
        errors.push(`Q${i + 1}: 정답범위초과 (ans=${q.ans}, 선지=${q.ch.length}개)`);
      }
    }

    // ⚠️ det.analysis에 ✅ 정답마크 권장 (경고만, FAIL 아님)
    // 향후 신규 출제 시 필수로 전환 예정

    // ⛔ det↔ans 불일치 검증
    if (q.fmt === 'mc' && q.det) {
      const ana = (q.det.analysis || '');
      // ✅ 마크로 정답 확인
      const checkMatches = ana.match(/✅\s*[①②③④⑤]/g);
      if (checkMatches && checkMatches.length === 1) {
        const circle = checkMatches[0].match(/[①②③④⑤]/)[0];
        const detAns = numMap[circle];
        if (detAns && detAns !== q.ans) {
          errors.push(`Q${i + 1}: det↔ans 불일치 (해설=✅${circle}=${detAns}번, ans=${q.ans})`);
        }
      }
      // ❌ 3개로 정답 추론
      const wrongMatches = ana.match(/❌\s*[①②③④]/g);
      if (wrongMatches && wrongMatches.length === 3 && q.ch && q.ch.length === 4) {
        const wrongNums = new Set(wrongMatches.map(w => numMap[w.match(/[①②③④]/)[0]]));
        let correctAns = null;
        for (let n = 1; n <= 4; n++) { if (!wrongNums.has(n)) { correctAns = n; break; } }
        if (correctAns && correctAns !== q.ans) {
          errors.push(`Q${i + 1}: det↔ans 불일치 (오답제외=${correctAns}번, ans=${q.ans})`);
        }
      }
    }

    // ⛔ 정답노출 검증: 정답 선지가 passage에 그대로 포함
    if (q.fmt === 'mc' && q.ch && q.ans >= 1 && q.ans <= (q.ch.length || 4)) {
      const correct = (q.ch[q.ans - 1] || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
      const pass = (q.passage || '').replace(/<[^>]*>/g, '').toLowerCase();
      if (correct.length > 15 && pass.includes(correct)) {
        errors.push(`Q${i + 1}: 정답노출 — 정답선지가 passage에 그대로 포함`);
      }
    }

    // ⛔ 해석(det.korean) 필수 + 최소 길이
    if (q.det) {
      const korean = (q.det.korean || q.det.ko || '').replace(/<[^>]*>/g, '').trim();
      if (korean.length < 5) {
        errors.push(`Q${i + 1}: det.korean 너무 짧음 (${korean.length}자, 최소 5자)`);
      }
    }
  });

  // ⛔ fullPassage 필수 + 최소 길이
  if (!data.fullPassage || data.fullPassage.replace(/<[^>]*>/g, '').trim().length < 50) {
    errors.push(`fullPassage 없거나 너무 짧음 (최소 50자)`);
  }

  // ⛔ 선지 중복 검사
  data.questions.forEach((q, i) => {
    if (q.ch && q.ch.length >= 2) {
      const cleaned = q.ch.map(c => c.replace(/<[^>]*>/g, '').trim().toLowerCase());
      for (let a = 0; a < cleaned.length; a++) {
        for (let b = a + 1; b < cleaned.length; b++) {
          if (cleaned[a] === cleaned[b] && cleaned[a].length > 0) {
            errors.push(`Q${i + 1}: 선지 중복 ("${cleaned[a].slice(0, 30)}")`);
          }
        }
      }
    }
  });

  // ⛔ 서술형 정답 유효성
  data.questions.forEach((q, i) => {
    if (q.fmt === 'written') {
      if (!q.wa && (!q.accept || q.accept.length === 0)) {
        errors.push(`Q${i + 1}: 서술형 정답(wa/accept) 없음`);
      }
      if (q.wa && (q.wa === 'undefined' || q.wa === 'null' || q.wa.trim().length === 0)) {
        errors.push(`Q${i + 1}: 서술형 정답이 비어있음`);
      }
    }
  });

  return errors;
}

// ── validate.js 53체크 실행 ──
function runValidate(jsonPath) {
  try {
    execSync(`node "${path.join(ROOT, 'validate/validate.js')}" "${jsonPath}"`, {
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: ROOT,
    });
    return [];
  } catch (e) {
    const output = (e.stdout || '') + (e.stderr || '');
    // S급/A급 에러만 추출
    const errors = [];
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('[S]') || line.includes('[A]')) {
        errors.push(line.trim());
      }
    }
    if (errors.length === 0 && e.status !== 0) {
      errors.push(`validate.js 실행 실패 (exit ${e.status})`);
    }
    return errors;
  }
}

// ── 파일 하나 전체 검증 ──
function checkFile(jsonPath) {
  totalFiles++;
  const rel = path.relative(ROOT, jsonPath);
  const allErrors = [];

  // 1. 경로 검증
  const pathErrors = validatePath(jsonPath);
  allErrors.push(...pathErrors.map(e => `[경로] ${e}`));

  // 2. 스키마 검증
  const schemaErrors = validateSchema(jsonPath);
  allErrors.push(...schemaErrors.map(e => `[스키마] ${e}`));

  // 3. validate.js 53체크
  if (schemaErrors.length === 0) {
    const valErrors = runValidate(jsonPath);
    allErrors.push(...valErrors.map(e => `[검증] ${e}`));
  }

  if (allErrors.length === 0) {
    passCount++;
    console.log(`  ✅ ${rel}`);
  } else {
    failCount++;
    failures.push({ file: rel, errors: allErrors });
    console.log(`  ❌ ${rel}`);
    allErrors.forEach(e => console.log(`     ${e}`));
  }
}

// ── 파일/폴더 재귀 탐색 ──
function collectJsonFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile() && target.endsWith('.json')) {
    return [target];
  }
  if (stat.isDirectory()) {
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.json')) files.push(full);
      }
    };
    walk(target);
    return files;
  }
  return [];
}

// ── 메인 ──
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('사용법: node deploy-json.js <파일/폴더> 또는 --all');
    process.exit(1);
  }

  const checkOnly = args.includes('--check-only');
  const targetArg = args.find(a => a !== '--check-only');
  const target = targetArg === '--all' ? DATA_DIR : path.resolve(targetArg);

  console.log('\n🔍 NaesinFit 테스트 JSON 배포 검증\n');

  const files = collectJsonFiles(target);
  if (files.length === 0) {
    console.log('❌ JSON 파일을 찾을 수 없습니다:', target);
    process.exit(1);
  }

  console.log(`검증 대상: ${files.length}개 파일\n`);
  files.forEach(checkFile);

  // ── 결과 ──
  console.log('\n' + '─'.repeat(60));
  console.log(`결과: ${passCount} PASS / ${failCount} FAIL / ${totalFiles} 전체`);

  if (failCount > 0) {
    console.log('\n❌ 배포 차단 — 아래 오류를 수정하세요:\n');
    failures.forEach(f => {
      console.log(`  ${f.file}:`);
      f.errors.forEach(e => console.log(`    ${e}`));
    });
    process.exit(1);
  }

  console.log('\n✅ 전체 PASS');

  // --all 또는 --check-only 모드에서는 자동 push 안 함
  if (targetArg === '--all' || checkOnly) {
    if (!checkOnly) console.log('(--all 모드: 검증만 수행, push 안 함)');
    process.exit(0);
  }

  // 자동 git add + commit + push
  console.log('\n📦 배포 중...');
  try {
    execSync(`cd "${ROOT}" && git add ${files.map(f => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
    const fileList = files.map(f => path.relative(ROOT, f)).join(', ');
    execSync(`cd "${ROOT}" && git commit -m "deploy: ${fileList}"`, { stdio: 'inherit' });
    execSync(`cd "${ROOT}" && git push`, { stdio: 'inherit' });
    console.log('\n✅ 배포 완료');
  } catch (e) {
    console.log('\n⚠️  git push 실패 — 수동으로 push하세요');
    process.exit(1);
  }
}

main();
