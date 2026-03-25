#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — validate-all-v2.js
 * 4단 통합 검증 (배포 없이 검증만)
 *
 * ① 구조 검증 (53 checkpoints)
 * ② 원문 100% 대조
 * ③ AI 풀이 검증 (ANTHROPIC_API_KEY 있을 때)
 * ④ 렌더링 검증 (puppeteer 있을 때, dist 파일 있을 때)
 *
 * Usage: node validate/validate-all-v2.js data/.../단어.json
 *        node validate/validate-all-v2.js --all
 *        node validate/validate-all-v2.js --all --strict   (v1 파일도 S급 적용)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DIST_DIR = path.join(ROOT, 'dist');

// ── Layers ──
const { validate } = require('./validate.js');
const { validateFulltext } = require('./validate-fulltext.js');

let validateAI, validateRender;
try { validateAI = require('./validate-ai.js').validateAI; } catch (e) {}
try { validateRender = require('./validate-render.js').validateRender; } catch (e) {}

function findJsonFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !full.includes('/dist/')) {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

function getDistPath(jsonPath) {
  const relFromData = path.relative(DATA_DIR, jsonPath);
  const parsed = path.parse(relFromData);
  return path.join(DIST_DIR, parsed.dir, parsed.name + '테스트.html');
}

async function validateFile(jsonPath, opts = {}) {
  const rel = path.relative(ROOT, jsonPath);
  const issues = { S: 0, A: 0, B: 0, C: 0 };
  const allErrors = [];
  const strict = opts.strict || false;

  // ── ① 구조 검증 ──
  const r1 = validate(jsonPath);
  r1.errors.forEach(e => { issues[e.sev]++; allErrors.push(`①${e.id}: ${e.msg}`); });
  r1.warnings.forEach(w => { issues[w.sev]++; });

  // ── ② 원문 대조 ──
  const r2 = validateFulltext(jsonPath, { strict });
  r2.errors.forEach(e => { issues[e.sev]++; allErrors.push(`②${e.id}: ${e.msg}`); });
  r2.warnings.forEach(w => { issues[w.sev]++; });

  // ── ③ AI 풀이 (optional) ──
  if (validateAI && process.env.ANTHROPIC_API_KEY) {
    const r3 = await validateAI(jsonPath);
    r3.errors.forEach(e => { issues[e.sev]++; allErrors.push(`③${e.id}: ${e.msg}`); });
    r3.warnings.forEach(w => { issues[w.sev]++; });
  }

  // ── ④ 렌더링 (optional, if dist exists) ──
  if (validateRender) {
    const distPath = getDistPath(jsonPath);
    if (fs.existsSync(distPath)) {
      try {
        const r4 = await validateRender(distPath);
        r4.errors.forEach(e => { issues[e.sev]++; allErrors.push(`④${e.id}: ${e.msg}`); });
        r4.warnings.forEach(w => { issues[w.sev]++; });
      } catch (e) {
        // Puppeteer errors are non-blocking
      }
    }
  }

  const pass = issues.S === 0 && issues.A === 0;
  return { file: rel, pass, issues, allErrors };
}

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const filteredArgs = args.filter(a => a !== '--strict');

  if (filteredArgs.length === 0) {
    console.error('NaesinFit 4-Layer Validation v2.0');
    console.error('');
    console.error('Usage: node validate/validate-all-v2.js <json-file>');
    console.error('       node validate/validate-all-v2.js --all [--strict]');
    console.error('');
    console.error('Layers:');
    console.error('  ① 구조 검증 (53 checkpoints)     — always');
    console.error('  ② 원문 100% 대조                  — always');
    console.error(`  ③ AI 풀이 검증                     — ${process.env.ANTHROPIC_API_KEY ? 'enabled' : 'disabled (set ANTHROPIC_API_KEY)'}`);
    console.error(`  ④ 렌더링 검증                      — ${validateRender ? 'enabled' : 'disabled (install puppeteer)'}`);
    process.exit(1);
  }

  let files = [];
  if (filteredArgs[0] === '--all') {
    files = findJsonFiles(DATA_DIR);
    console.log(`Found ${files.length} JSON files\n`);
    if (files.length === 0) process.exit(0);
  } else {
    files = [path.resolve(filteredArgs[0])];
  }

  // Show active layers
  console.log('Active Layers:');
  console.log('  ① 구조 검증 ✅');
  console.log('  ② 원문 대조 ✅');
  console.log(`  ③ AI 풀이   ${process.env.ANTHROPIC_API_KEY ? '✅' : '⏭️ SKIP'}`);
  console.log(`  ④ 렌더링    ${validateRender ? '✅' : '⏭️ SKIP'}`);
  console.log('');

  let totalPass = 0, totalFail = 0;
  const failedFiles = [];

  for (const f of files) {
    const r = await validateFile(f, { strict });

    if (r.pass) {
      totalPass++;
      const warnCount = r.issues.B + r.issues.C;
      if (warnCount > 0) {
        console.log(`[PASS] ${r.file} (${warnCount} warnings)`);
      } else {
        console.log(`[PASS] ${r.file}`);
      }
    } else {
      totalFail++;
      failedFiles.push(r);
      console.log(`[FAIL] ${r.file} (S:${r.issues.S} A:${r.issues.A})`);
      r.allErrors.slice(0, 5).forEach(e => console.log(`  ${e}`));
      if (r.allErrors.length > 5) console.log(`  ... +${r.allErrors.length - 5} more`);
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  4-Layer Validation Summary');
  console.log('═'.repeat(60));
  console.log(`  Total: ${files.length} | PASS: ${totalPass} | FAIL: ${totalFail}`);

  if (totalFail > 0) {
    console.log(`\n  Failed files (${totalFail}):`);
    failedFiles.slice(0, 20).forEach(f => {
      console.log(`    ${f.file} — S:${f.issues.S} A:${f.issues.A}`);
    });
    if (failedFiles.length > 20) console.log(`    ... +${failedFiles.length - 20} more`);
  }

  console.log('═'.repeat(60));

  // Deploy gate
  if (totalFail === 0) {
    console.log('\n🟢 ALL PASS — 배포 가능');
  } else {
    console.log('\n🔴 FAIL — 배포 차단됨. 위 오류 수정 후 재검증 필요.');
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

if (require.main === module) main();
