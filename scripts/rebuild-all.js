#!/usr/bin/env node
/**
 * rebuild-all.js — 모든 response.json으로부터 .json/.blind.json 재생성
 *
 * response.json = 유일한 진실 소스 (단일 소스 원칙, 2026-04-15)
 * 나머지 파생 파일 (.json, .blind.json, .prompt.json)은 언제든 재생성 가능
 *
 * Usage:
 *   node scripts/rebuild-all.js [--only <서브경로>]
 *   node scripts/rebuild-all.js --only 부교재/올림포스전국연합고2/2026/3강
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== '_passages' && e.name !== 'node_modules') {
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && /\.response\.json$/.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

const allResponses = walk(DATA);
const targets = ONLY ? allResponses.filter(f => f.includes(ONLY)) : allResponses;

console.log(`🔨 rebuild-all: ${targets.length}개 response.json 대상`);

let ok = 0, fail = 0;
for (const rf of targets) {
  try {
    execSync(`node "${path.join(ROOT, 'create-test.js')}" --assemble "${rf}"`, { stdio: 'pipe', cwd: ROOT, timeout: 60000 });
    // title/ei 보강
    const jf = rf.replace('.response.json', '.json');
    if (fs.existsSync(jf)) {
      const d = JSON.parse(fs.readFileSync(jf, 'utf8'));
      d.ei = d.ei || {};
      if (!d.ei.title) {
        const rel = path.relative(DATA, rf).replace('.response.json', '');
        d.ei.title = rel;
        d.ei.subject = d.ei.subject || '영어';
      }
      fs.writeFileSync(jf, JSON.stringify(d, null, 2));
    }
    ok++;
    if (ok % 20 === 0) console.log(`  progress: ${ok}/${targets.length}`);
  } catch (e) {
    fail++;
    console.error(`  ❌ ${path.relative(ROOT, rf)}: ${e.message.slice(0, 80)}`);
  }
}

console.log(`\n━━━ rebuild-all 완료 ━━━`);
console.log(`  성공: ${ok}`);
console.log(`  실패: ${fail}`);
