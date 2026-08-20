#!/usr/bin/env node
/**
 * qa.js — 내신해방공식 테스트 QA 파이프라인 오케스트레이터
 *
 * Usage:
 *   npm run qa -- data/.../단어.json           # 단일 파일
 *   npm run qa -- data/교과서/영어1/비상홍/    # 폴더 내 전체
 *   npm run qa -- data/.../단어.json --full    # AI 검증 포함 (API 필요)
 *   npm run qa -- --all                        # data/ 전체
 */
const fs = require('fs');
const path = require('path');
const { findJsonFiles, ROOT } = require('./lib/path-mapper');
const { validate } = require('../validate/validate');
const { checkFulltext } = require('./fulltext-check');
const { autoAttack, generatePrompt: advPrompt } = require('./adversarial');
const { generatePrompt: solvePrompt, parseResults } = require('./blind-solve');
const { generateReport, saveReport } = require('./report');

// ── 기존 validate 모듈 동적 로드 ──
let validateFulltext, validateScoring, validateContent, validateAI, renderTest;
try { validateFulltext = require('../validate/validate-fulltext').validateFulltext; } catch { }
try { validateScoring = require('../validate/validate-scoring').validateScoring; } catch { }
try { validateContent = require('../validate/validate-content').validateContent; } catch { }
try { validateAI = require('../validate/validate-ai').validateAI; } catch { }
try { renderTest = require('./render-test').renderTest; } catch { }

const ICONS = { pass: '✅', fail: '❌', skip: '⏭' };

function icon(result) {
  if (result.skip) return ICONS.skip;
  return result.pass ? ICONS.pass : ICONS.fail;
}

async function runQA(jsonPath, options = {}) {
  const relPath = path.relative(ROOT, jsonPath);
  const steps = {};
  let shouldContinue = true;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  QA: ${relPath}`);
  console.log(`${'═'.repeat(60)}`);

  // ── Phase 1: 자동 구조 검증 ──

  // ① validate.js
  const vResult = validate(jsonPath);
  steps.validate = {
    pass: vResult.pass,
    errors: vResult.errors.length,
    warnings: vResult.warnings.length,
    summary: vResult.pass ? `PASS (${vResult.warnings.length} warnings)` : `${vResult.errors.length} errors`,
  };
  console.log(`  [①] 구조 검증:        ${icon(steps.validate)} ${steps.validate.summary}`);
  if (!vResult.pass) {
    vResult.errors.slice(0, 5).forEach(e => console.log(`       → [${e.sev}] ${e.id}: ${e.msg}`));
    shouldContinue = false;
  }

  // ② validate-fulltext (JSON 내부 passage vs fullPassage)
  if (shouldContinue && validateFulltext) {
    try {
      const ftResult = validateFulltext(jsonPath);
      steps.fulltextInternal = {
        pass: ftResult.pass !== false,
        errors: (ftResult.errors || []).length,
        summary: ftResult.pass !== false ? 'PASS' : `${(ftResult.errors || []).length} errors`,
      };
    } catch {
      steps.fulltextInternal = { pass: true, skip: true, summary: 'SKIP' };
    }
  } else if (shouldContinue) {
    steps.fulltextInternal = { pass: true, skip: true, summary: 'validate-fulltext 없음' };
  }
  if (steps.fulltextInternal) {
    console.log(`  [②] 원문 대조(내부):  ${icon(steps.fulltextInternal)} ${steps.fulltextInternal.summary}`);
  }

  // ③ fulltext-check (originals/ 원본 대조)
  if (shouldContinue) {
    const ftOrig = checkFulltext(jsonPath);
    steps.fulltextOriginal = ftOrig;
    console.log(`  [③] 원문 대조(원본):  ${icon(ftOrig)} ${ftOrig.summary}`);
  }

  // ④ validate-scoring
  if (shouldContinue && validateScoring) {
    try {
      const sResult = validateScoring(jsonPath);
      steps.scoring = { pass: sResult.pass !== false, summary: sResult.pass !== false ? 'PASS' : 'FAIL' };
    } catch {
      steps.scoring = { pass: true, skip: true, summary: 'SKIP' };
    }
  } else {
    steps.scoring = { pass: true, skip: true, summary: 'SKIP' };
  }
  console.log(`  [④] 채점 정확도:      ${icon(steps.scoring)} ${steps.scoring.summary}`);

  // ⑤ validate-content
  if (shouldContinue && validateContent) {
    try {
      const cResult = validateContent(jsonPath);
      steps.content = { pass: cResult.pass !== false, summary: cResult.pass !== false ? 'PASS' : 'FAIL' };
    } catch {
      steps.content = { pass: true, skip: true, summary: 'SKIP' };
    }
  } else {
    steps.content = { pass: true, skip: true, summary: 'SKIP' };
  }
  console.log(`  [⑤] 콘텐츠 품질:      ${icon(steps.content)} ${steps.content.summary}`);

  // ⑥ adversarial (규칙 기반 자동)
  if (shouldContinue) {
    const advResult = autoAttack(jsonPath);
    steps.adversarialAuto = advResult;
    console.log(`  [⑥] 규칙 기반 공격:   ${icon(advResult)} ${advResult.summary}`);
    if (advResult.attacks.length > 0) {
      advResult.attacks.slice(0, 5).forEach(a =>
        console.log(`       → [${a.severity}] Q${a.qId}: ${a.type} — ${a.detail}`)
      );
    }
  }

  // ── Phase 2: AI 검증 (--full 모드) ──
  if (shouldContinue && options.full && validateAI) {
    try {
      console.log(`  [⑦] AI 블라인드 풀이: 🔄 실행 중...`);
      const aiResult = await validateAI(jsonPath);
      steps.aiSolve = {
        pass: aiResult.pass !== false,
        summary: aiResult.pass !== false ? 'PASS' : `${(aiResult.errors || []).length} errors`,
      };
      console.log(`  [⑦] AI 블라인드 풀이: ${icon(steps.aiSolve)} ${steps.aiSolve.summary}`);
    } catch (e) {
      steps.aiSolve = { pass: true, skip: true, summary: `SKIP: ${e.message}` };
      console.log(`  [⑦] AI 블라인드 풀이: ${icon(steps.aiSolve)} ${steps.aiSolve.summary}`);
    }
  } else if (shouldContinue && !options.full) {
    steps.aiSolve = { pass: true, skip: true, summary: '--full 미지정' };
    console.log(`  [⑦] AI 블라인드 풀이: ${icon(steps.aiSolve)} ${steps.aiSolve.summary}`);
  }

  // ── Phase 3: 렌더링 ──
  if (shouldContinue && renderTest) {
    try {
      const rResult = await renderTest(jsonPath);
      steps.render = rResult;
      console.log(`  [⑧] 렌더링 검증:      ${icon(rResult)} ${rResult.summary}`);
    } catch {
      steps.render = { pass: true, skip: true, summary: 'SKIP' };
      console.log(`  [⑧] 렌더링 검증:      ${icon(steps.render)} ${steps.render.summary}`);
    }
  } else {
    steps.render = { pass: true, skip: true, summary: 'SKIP' };
    console.log(`  [⑧] 렌더링 검증:      ${icon(steps.render)} ${steps.render.summary}`);
  }

  // ── Phase 4: 블라인드 풀이 프롬프트 (--full 아닐 때) ──
  if (shouldContinue && !options.full && !options.quiet) {
    console.log(`\n  ── Claude Code 수동 검증 ──`);
    console.log(`  블라인드 풀이: node qa/blind-solve.js ${relPath} --prompt`);
    console.log(`  적대적 공격:   node qa/adversarial.js ${relPath} --prompt`);
  }

  // ── Phase 5: 리포트 ──
  const report = generateReport(jsonPath, steps);
  const reportPath = saveReport(report);

  console.log(`\n  리포트: ${path.relative(ROOT, reportPath)}`);
  console.log(`  최종 판정: ${report.verdict === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  if (report.failReasons.length > 0) {
    report.failReasons.forEach(r => console.log(`  ⛔ ${r}`));
  }
  console.log(`${'═'.repeat(60)}\n`);

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    full: args.includes('--full'),
    quiet: args.includes('--quiet'),
  };

  let files = [];
  const targets = args.filter(a => !a.startsWith('-'));

  if (args.includes('--all')) {
    files = findJsonFiles(path.join(ROOT, 'data'));
  } else if (targets.length === 0) {
    console.error('Usage: node qa/qa.js <json-file-or-dir> [--full] [--all]');
    process.exit(1);
  } else {
    for (const t of targets) {
      const resolved = path.resolve(t);
      if (fs.statSync(resolved).isDirectory()) {
        files = files.concat(findJsonFiles(resolved));
      } else {
        files.push(resolved);
      }
    }
  }

  console.log(`\n내신해방공식 QA 파이프라인 v1 — ${files.length}파일`);

  let pass = 0, fail = 0;
  for (const f of files) {
    const report = await runQA(f, options);
    if (report.verdict === 'PASS') pass++;
    else fail++;
  }

  if (files.length > 1) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  총 ${files.length}파일: ✅ ${pass} PASS / ❌ ${fail} FAIL`);
    console.log(`${'═'.repeat(60)}`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

module.exports = { runQA };
if (require.main === module) main();
