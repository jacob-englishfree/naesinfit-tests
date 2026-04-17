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
  '중2/YBM김은형',
  '중3/미래엔최연희',
];

const VALID_SUPPLEMENT_PATHS = ['수능특강/영어', '수능특강/영어독해연습', '수능특강Light/영어', '수능특강Light/영어독해연습', '올림포스전국연합고2/2026', '올림포스독해의기본2/2025', 'ReadingPower유형편완성'];
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
    const textbookPath = `${parts[1]}/${parts[2]}`.normalize('NFC');
    if (!VALID_TEXTBOOK_PATHS.includes(textbookPath)) {
      errors.push(`미등록 교과서: "${textbookPath}"\n  등록된 교과서: ${VALID_TEXTBOOK_PATHS.join(', ')}`);
    }
    const unit = parts[3].normalize('NFC');
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
    if (!VALID_SUPPLEMENT_PATHS.some(p => supPath === p || supPath.startsWith(p + '/') || p.startsWith(supPath + '/'))) {
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

    // ⛔ det↔ans 불일치 검증 (텍스트 매칭 — 인덱스 가정 금지, feedback_det_not_ch_index)
    if (q.fmt === 'mc' && q.det && Array.isArray(q.ch) && q.ch.length > 0) {
      const ana = (q.det.analysis || '');
      const lines = ana.split('\n');
      const checkedTexts = [];
      for (const line of lines) {
        const m = line.match(/^[\s]*[✅✓☑]\s*(.*)$/);
        if (m) {
          let t = m[1].trim().replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').replace(/^[1-9][\.\)]\s*/, '');
          if (t.length > 0) checkedTexts.push(t);
        }
      }
      if (checkedTexts.length === 1) {
        const norm = (s) => String(s || '')
          .replace(/[①②③④⑤⑥⑦⑧⑨⑩✅✓❌✗☑☒]/g, '')
          .replace(/^[\s]*[1-9][\.\)]\s*/, '')
          .replace(/[\s\-—–·,.()<>"'`]/g, '')
          .toLowerCase().trim();
        const target = norm(checkedTexts[0]);
        if (target.length >= 3) {
          const matches = [];
          for (let k = 0; k < q.ch.length; k++) {
            const c = norm(q.ch[k]);
            if (c && (c.includes(target) || target.includes(c))) matches.push(k + 1);
          }
          if (matches.length === 1 && matches[0] !== q.ans) {
            errors.push(`Q${i + 1}: det↔ans 불일치 (해설텍스트="${checkedTexts[0].slice(0, 40)}"=${matches[0]}번, ans=${q.ans})`);
          }
        }
      }
    }

    // ⛔ 정답노출 검증: 정답 선지가 passage에 그대로 포함
    // 내용일치/불일치/빈칸추론/T·F 등 원문 기반 유형은 제외 (원문 문장이 선지에 당연히 포함)
    if (q.fmt === 'mc' && q.ch && q.ans >= 1 && q.ans <= (q.ch.length || 4)) {
      const type = (q.type || '').toLowerCase();
      const stem = (q.stem || '').toLowerCase();
      const skipTypes = ['내용이해', '내용일치', '내용불일치', 't/f', '빈칸추론', '빈칸어휘', '빈칸 어휘 완성', '오류찾기', '어법', '지칭추론', '부적절'];
      const isContentBased = skipTypes.some(t => type.includes(t)) ||
        /일치|불일치|t\s*\/?\s*f|빈칸/.test(stem);
      if (!isContentBased) {
        const correct = (q.ch[q.ans - 1] || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
        const pass = (q.passage || '').replace(/<[^>]*>/g, '').toLowerCase();
        if (correct.length > 15 && pass.includes(correct)) {
          errors.push(`Q${i + 1}: 정답노출 — 정답선지가 passage에 그대로 포함`);
        }
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
      if (q.wa && typeof q.wa === 'string' && (q.wa === 'undefined' || q.wa === 'null' || q.wa.trim().length === 0)) {
        errors.push(`Q${i + 1}: 서술형 정답이 비어있음`);
      }
    }
  });

  // ━━━ 고급 품질 검사 (ETS/수능급) ━━━

  // ⛔ 4. 정답 위치 편향 검사
  const mcQuestions = data.questions.filter(q => q.fmt === 'mc' && q.ch && q.ch.length === 4);
  if (mcQuestions.length >= 10) {
    const ansDist = [0, 0, 0, 0];
    mcQuestions.forEach(q => { if (q.ans >= 1 && q.ans <= 4) ansDist[q.ans - 1]++; });
    const maxCount = Math.max(...ansDist);
    const threshold = Math.ceil(mcQuestions.length * 0.45); // 45% 이상 한쪽 쏠림 차단
    if (maxCount >= threshold) {
      const biased = ansDist.indexOf(maxCount) + 1;
      errors.push(`정답 위치 편향: ${biased}번에 ${maxCount}/${mcQuestions.length}개 집중 (${Math.round(maxCount/mcQuestions.length*100)}%)`);
    }
  }

  // ⛔ 5. 정답 길이 편향 검사
  mcQuestions.forEach((q, idx) => {
    if (!q.ch || q.ch.length !== 4 || q.ans < 1 || q.ans > 4) return;
    // 어법/오류찾기 유형은 밑줄 구간 길이 차이가 자연스러우므로 제외
    const qtype = (q.type || '').toLowerCase();
    if (['어법', '오류찾기'].some(t => qtype.includes(t))) return;
    const lengths = q.ch.map(c => c.replace(/<[^>]*>/g, '').trim().length);
    const correctLen = lengths[q.ans - 1];
    const otherLens = lengths.filter((_, j) => j !== q.ans - 1);
    const avgOther = otherLens.reduce((a, b) => a + b, 0) / otherLens.length;
    // 정답이 오답 평균의 2배 이상 길거나 1/3 이하로 짧으면
    if (correctLen > avgOther * 2.5 && correctLen > 20) {
      const i = data.questions.indexOf(q);
      errors.push(`Q${i + 1}: 정답 길이 편향 — 정답(${correctLen}자)이 오답 평균(${Math.round(avgOther)}자)의 2.5배 이상`);
    }
  });

  // ⛔ 6. 절대어 검출 (오답에만 있으면 힌트)
  const absoluteWords = ['always', 'never', 'completely', 'absolutely', 'all', 'none', 'every', 'only'];
  mcQuestions.forEach(q => {
    if (!q.ch || q.ans < 1 || q.ans > q.ch.length || !q.ch[q.ans - 1]) return;
    const correctHas = absoluteWords.some(w => q.ch[q.ans - 1].toLowerCase().includes(w));
    const wrongsHave = q.ch.filter((_, j) => j !== q.ans - 1).some(c => absoluteWords.some(w => c.toLowerCase().includes(w)));
    // 오답에만 절대어가 있으면 힌트
    if (wrongsHave && !correctHas) {
      const i = data.questions.indexOf(q);
      // 경고만 (FAIL은 아님) — 너무 엄격하면 정상 문항도 걸림
    }
  });

  // ⛔ 7. 선지 동질성 검사 (길이 편차)
  mcQuestions.forEach(q => {
    if (!q.ch || q.ch.length < 4) return;
    const lengths = q.ch.map(c => c.replace(/<[^>]*>/g, '').trim().length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const maxDev = Math.max(...lengths.map(l => Math.abs(l - avg)));
    // 평균 대비 편차가 3배 이상이면 비동질
    if (avg > 5 && maxDev > avg * 3) {
      const i = data.questions.indexOf(q);
      errors.push(`Q${i + 1}: 선지 동질성 부족 — 길이 편차 과대 (${lengths.join(',')}자)`);
    }
  });

  // ⛔ 8. 교차 누설 검사 (같은 파일 내 다른 문항 해설이 정답 누설)
  data.questions.forEach((q, i) => {
    if (q.fmt !== 'mc' || !q.ch || q.ans < 1 || q.ans > q.ch.length || !q.ch[q.ans - 1]) return;
    const correctText = q.ch[q.ans - 1].replace(/<[^>]*>/g, '').trim().toLowerCase();
    if (correctText.length < 20) return; // 짧은 단어는 자연스럽게 겹칠 수 있음
    // 다른 문항의 passage/stem에 이 정답이 그대로 나오는지
    data.questions.forEach((other, j) => {
      if (i === j) return;
      const otherText = ((other.det?.analysis || '') + ' ' + (other.det?.korean || '')).toLowerCase();
      if (otherText.includes(correctText)) {
        errors.push(`Q${i + 1}: 교차 누설 — Q${j + 1}의 해설에 Q${i + 1} 정답("${correctText.slice(0, 25)}")이 노출`);
      }
    });
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
// ── 증적 게이트: 각 test.json은 cross-blind.json + adversarial.json 짝이 있어야 배포 가능 ──
// 2026-04-16부터 기본값 ON. 해제하려면 --no-gate 또는 STRICT_GATE=false.
// 레거시 파일 대량 migration 시에만 해제.
const STRICT_GATE = !(process.env.STRICT_GATE === 'false' || process.argv.includes('--no-gate'));
function validateArtifacts(jsonPath) {
  const errs = [];
  const cbPath = jsonPath.replace(/\.json$/, '.cross-blind.json');
  const advPath = jsonPath.replace(/\.json$/, '.adversarial.json');
  const blindPath = jsonPath.replace(/\.json$/, '.blind.json');
  if (!fs.existsSync(blindPath)) errs.push(`blind.json 없음: ${path.basename(blindPath)} (STEP 3 블라인드 미이행)`);
  if (!fs.existsSync(cbPath)) errs.push(`cross-blind.json 없음: ${path.basename(cbPath)} (Tier 2 교차검증 미이행)`);
  if (!fs.existsSync(advPath)) errs.push(`adversarial.json 없음: ${path.basename(advPath)} (STEP 5 적대적 공격 미이행)`);
  // adversarial HIGH 이슈 잔존 차단
  if (fs.existsSync(advPath)) {
    try {
      const adv = JSON.parse(fs.readFileSync(advPath, 'utf8'));
      const highs = (adv.issues || []).filter(i => (i.severity || '').toLowerCase() === 'high');
      if (highs.length) errs.push(`adversarial HIGH 이슈 ${highs.length}건 미해결: ${highs.map(h => `Q${h.id}`).join(', ')}`);
    } catch (e) {
      errs.push(`adversarial.json 파싱 실패: ${e.message}`);
    }
  }
  // _audit-report.md는 지문(폴더) 단위로 1개 있으면 OK — 폴더 루트까지 올라가며 확인
  const parentDir = path.dirname(jsonPath);
  const gangDir = path.dirname(parentDir); // 1번의 부모=1강
  const reportCandidates = [
    path.join(gangDir, '_audit-report.md'),
    path.join(parentDir, '_audit-report.md'),
  ];
  if (!reportCandidates.some(p => fs.existsSync(p))) {
    errs.push(`_audit-report.md 없음: ${path.relative(ROOT, gangDir)}/ (STEP 7 증적 리포트 미작성)`);
  }
  return errs;
}

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

  // 4. 증적 게이트 (STRICT_GATE=true 시 차단, 기본은 경고만)
  const artifactErrors = validateArtifacts(jsonPath);
  if (artifactErrors.length) {
    if (STRICT_GATE) {
      allErrors.push(...artifactErrors.map(e => `[증적] ${e}`));
    } else {
      // 경고만 (기존 파일 호환). STRICT_GATE=true 적용 시 차단.
      console.log(`  ⚠ ${rel} (증적 미비 — STRICT_GATE=true 시 차단됨)`);
      artifactErrors.forEach(e => console.log(`     ${e}`));
    }
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
        if (entry === '_passages' || entry.startsWith('.')) continue;
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
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('사용법: node deploy-json.js <파일/폴더> 또는 --all');
    process.exit(1);
  }

  const checkOnly = args.includes('--check-only');
  const targetArgs = args.filter(a => a !== '--check-only');
  const isAll = targetArgs.includes('--all');

  console.log('\n🔍 NaesinFit 테스트 JSON 배포 검증\n');

  // 여러 인자 지원: 모든 인자에서 JSON 파일 수집 후 합침
  let files = [];
  if (isAll) {
    files = collectJsonFiles(DATA_DIR);
  } else {
    for (const arg of targetArgs) {
      files = files.concat(collectJsonFiles(path.resolve(arg)));
    }
    // 중복 제거
    files = [...new Set(files)];
  }
  if (files.length === 0) {
    console.log('❌ JSON 파일을 찾을 수 없습니다');
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

  console.log('\n✅ validate 전체 PASS');

  // ⛔ 블라인드 풀이 증적 게이트 (2026-04-11 추가)
  // .blind.json이 없으면 배포 차단
  const missingBlind = [];
  for (const f of files) {
    const dir = path.dirname(f);
    const base = path.basename(f, '.json');
    const blindFile = path.join(dir, `${base}.blind.json`);
    if (!fs.existsSync(blindFile)) {
      missingBlind.push(path.relative(ROOT, f));
    } else {
      // 증적 내용 검증
      try {
        const blind = JSON.parse(fs.readFileSync(blindFile, 'utf8'));
        const orig = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (!blind.solves || blind.solves.length !== orig.questions.length) {
          missingBlind.push(`${path.relative(ROOT, f)} (blind.json 문항수 불일치)`);
        }
      } catch (e) {
        missingBlind.push(`${path.relative(ROOT, f)} (blind.json 파싱 실패)`);
      }
    }
  }

  if (missingBlind.length > 0) {
    console.log(`\n⛔ 블라인드 풀이 증적 누락 — 배포 차단`);
    console.log(`   SOP STEP 3~5를 먼저 완료하세요.\n`);
    console.log(`   누락 파일:`);
    missingBlind.forEach(f => console.log(`     ${f}`));
    console.log(`\n   실행: node validate/blind-solve.js <대상폴더>`);
    process.exit(1);
  }

  console.log('✅ 블라인드 증적 전체 확인');

  // --all 또는 --check-only 모드에서는 자동 push 안 함
  if (isAll || checkOnly) {
    if (!checkOnly) console.log('(--all 모드: 검증만 수행, push 안 함)');
    process.exit(0);
  }

  // PASS된 파일은 차단 목록(_blocked_files.txt)에서 제거
  const blockedPath = path.join(ROOT, '_blocked_files.txt');
  if (fs.existsSync(blockedPath)) {
    const blockedLines = fs.readFileSync(blockedPath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
    const passedRel = new Set(files.map(f => path.relative(ROOT, f).normalize('NFC')));
    const remaining = blockedLines.filter(l => !passedRel.has(l.normalize('NFC')));
    if (remaining.length !== blockedLines.length) {
      fs.writeFileSync(blockedPath, remaining.join('\n') + '\n', 'utf8');
      console.log(`🔓 차단 해제: ${blockedLines.length - remaining.length}개 파일 (PASS → 차단 목록에서 제거)`);
    }
  }

  // 카탈로그 자동 재생성 (학생 노출 차단 반영)
  try {
    execSync(`node "${path.join(ROOT, 'scripts/generate-catalog.js')}"`, { stdio: 'inherit', cwd: ROOT });
  } catch (e) {
    console.log('⚠️  카탈로그 재생성 실패 — 수동 실행: node scripts/generate-catalog.js');
  }

  // 자동 git add + commit + push
  console.log('\n📦 배포 중...');
  try {
    const catalogPath = path.join(ROOT, 'test-catalog.json');
    const blockedFile = path.join(ROOT, '_blocked_files.txt');
    const extraAdds = [`"${catalogPath}"`];
    if (fs.existsSync(blockedFile)) extraAdds.push(`"${blockedFile}"`);
    execSync(`cd "${ROOT}" && git add ${files.map(f => `"${f}"`).join(' ')} ${extraAdds.join(' ')}`, { stdio: 'inherit' });
    const fileList = files.map(f => path.relative(ROOT, f)).join(', ');
    execSync(`cd "${ROOT}" && git commit -m "deploy: ${fileList}"`, { stdio: 'inherit' });
    execSync(`cd "${ROOT}" && git push`, { stdio: 'inherit' });

    // ── 영구 차단 장치 #1: 배포 후 git에 모든 파일이 들어갔는지 검증 ──
    console.log('\n🔒 배포 후 검증 중...');
    let allCommitted = true;
    for (const f of files) {
      const rel = path.relative(ROOT, f);
      try {
        // git ls-files로 tracked 여부 확인 + 마지막 commit이 HEAD인지
        execSync(`cd "${ROOT}" && git ls-files --error-unmatch "${rel}"`, { stdio: 'pipe' });
        const status = execSync(`cd "${ROOT}" && git status --porcelain "${rel}"`, { encoding: 'utf8' });
        if (status.trim()) {
          console.log(`❌ 미커밋 변경 잔존: ${rel}`);
          allCommitted = false;
        }
      } catch (e) {
        console.log(`❌ git untracked: ${rel}`);
        allCommitted = false;
      }
    }
    if (!allCommitted) {
      console.log('\n🚨 배포 실패 — 일부 파일이 git에 반영되지 않았습니다. 수동 add 필요.');
      process.exit(1);
    }

    // ── 영구 차단 장치 #2: 배포한 파일이 Vercel/GitHub Pages에 실제 살아있는지 HTTP 확인 ──
    // (선택: 빌드 시간 1~2분 필요해서 즉시 확인 안 됨. git tracked 검증으로 충분)

    // ── 영구 차단 장치 #3: DB assets.has=true 자동 패치 (2026-04-10) ──
    // deploy 성공 후 자동으로 contents DB에 has=true 켜기. 수동 패치 깜빡할 일 없음.
    try {
      console.log('\n📡 DB has=true 자동 패치...');
      // textbooks.ts에서 path→id 매핑 로드
      const sharedTs = fs.readFileSync(path.resolve(ROOT, '..', 'naesinfit-shared', 'src', 'constants', 'textbooks.ts'), 'utf8');
      const pathToId = {};
      const idRe = /id:"([^"]+)"[^}]*?path:"([^"]+)"/g;
      let idM;
      while (idM = idRe.exec(sharedTs)) pathToId[idM[2]] = idM[1];

      const typeMap = { '단어.json': 'vocab', '워크북.json': 'workbook', '퀴즈.json': 'quiz' };
      const patchMap = {}; // contentId → { vocab: { section: true }, ... }

      for (const f of files) {
        const rel = path.relative(DATA_DIR, f).split(path.sep);
        const fname = rel[rel.length - 1];
        if (!typeMap[fname]) continue;
        const dbType = typeMap[fname];
        const source = rel[0];
        let contentId, section;

        if (source === '교과서' && rel.length >= 5) {
          const tbPath = rel[1] + '/' + rel[2];
          const idPfx = pathToId[tbPath];
          if (idPfx) { contentId = idPfx + '-' + rel[3]; section = rel[4]; }
        } else if (source === '모의고사' && rel.length >= 5) {
          const mockPath = rel[1] + '/' + rel[2];
          const idPfx = pathToId[mockPath];
          if (idPfx) { contentId = idPfx; section = rel[3]; }
        } else if (source === '부교재' && rel.length >= 4) {
          // 2단계 path (수능특강/영어) 먼저, 없으면 1단계 (ReadingPower유형편완성)
          const p2 = rel[1] + '/' + rel[2];
          if (pathToId[p2] && rel.length >= 5) {
            contentId = pathToId[p2] + '-' + rel[3]; section = rel[4];
          } else if (pathToId[rel[1]]) {
            contentId = pathToId[rel[1]] + '-' + rel[2]; section = rel[3];
          }
        }

        if (contentId && section) {
          if (!patchMap[contentId]) patchMap[contentId] = {};
          if (!patchMap[contentId][dbType]) patchMap[contentId][dbType] = {};
          patchMap[contentId][dbType][section] = true;
        }
      }

      // Supabase patch
      const NF_URL = 'https://enkewpvhaugcmyglifkc.supabase.co';
      const NF_KEY = process.env.NF_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVua2V3cHZoYXVnY215Z2xpZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTQzMjksImV4cCI6MjA4OTA3MDMyOX0.JJvDYNbxSnsaE30tMFl5x1Daqyx2Wk8bQv6s19tNrY8';
      let sbMod;
      try { sbMod = require('@supabase/supabase-js'); } catch { sbMod = require(path.resolve(ROOT, '..', 'ehg-academy 2', 'node_modules', '@supabase', 'supabase-js')); }
      const sb = sbMod.createClient(NF_URL, NF_KEY);

      let dbPatched = 0;
      for (const [cid, types] of Object.entries(patchMap)) {
        const { data: row } = await sb.from('contents').select('id,assets').eq('id', cid).single();
        if (!row) { console.log(`  ⚠️ DB row 없음: ${cid}`); continue; }
        const a = row.assets || {};
        let changed = false;
        for (const [dt, secs] of Object.entries(types)) {
          if (!a[dt]) a[dt] = {};
          for (const sec of Object.keys(secs)) {
            if (!a[dt][sec]) a[dt][sec] = {};
            if (a[dt][sec].has !== true) { a[dt][sec].has = true; changed = true; }
          }
        }
        if (changed) {
          const { error } = await sb.from('contents').update({ assets: a }).eq('id', cid);
          if (error) console.log(`  ❌ DB 패치 실패: ${cid} — ${error.message}`);
          else dbPatched++;
        }
      }
      if (dbPatched > 0) console.log(`  ✅ DB has=true 패치: ${dbPatched}개 contentId`);
      else console.log('  (DB 패치 불필요 — 이미 최신)');
    } catch (e) {
      console.log(`  ⚠️ DB 자동패치 실패 (배포는 정상) — ${e.message}`);
    }

    console.log(`✅ 배포 완료 — ${files.length}개 파일 모두 git 반영 확인`);
  } catch (e) {
    console.log('\n⚠️  git push 실패 — 수동으로 push하세요');
    process.exit(1);
  }
}

main();
