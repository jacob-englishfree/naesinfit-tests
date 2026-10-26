#!/usr/bin/env node
// 올림포스 고급영미비문학 5·8·9·10강 테스트 배치 출제
// 사용: node scripts/batch-gen-bimunhak.mjs 5          (5강만)
//       node scripts/batch-gen-bimunhak.mjs 5:1        (5강 1번만)
//       node scripts/batch-gen-bimunhak.mjs all        (전부)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = path.join(ROOT, 'data/부교재/올림포스고급영미비문학/2025');
const TYPES = ['단어', '워크북', '퀴즈'];
const HK = { '단어': 'wordtest', '워크북': 'workbooktest', '퀴즈': 'quiztest' };

const arg = process.argv[2] || 'all';
let targets = [];
const GANGS = [5, 8, 9, 10];
if (arg === 'all') {
  for (const g of GANGS) for (let n = 1; n <= 5; n++) targets.push([g, n]);
} else if (arg.includes(':')) {
  const [g, n] = arg.split(':').map(Number); targets.push([g, n]);
} else {
  const g = Number(arg); for (let n = 1; n <= 5; n++) targets.push([g, n]);
}

const results = [];
for (const [g, n] of targets) {
  const pf = path.join(BASE, `${g}강/_passages/${n}번.json`);
  if (!fs.existsSync(pf)) { console.log(`⚠️ 지문없음 ${g}강 ${n}번`); continue; }
  const pj = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const themeRaw = pj.theme || '';
  const themeNum = (themeRaw.match(/Theme\s*\d+/) || [themeRaw])[0];
  const title = `올림포스 영미비문학 Field ${g} ${n}번 (${themeNum})`;
  const tmpTxt = path.join(ROOT, `.tmp_passage_${g}_${n}.txt`);
  fs.writeFileSync(tmpTxt, pj.fullPassage, 'utf8');

  for (const type of TYPES) {
    const outPath = path.join(BASE, `${g}강/${n}번/${type}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    if (fs.existsSync(outPath)) { console.log(`⏭️  이미존재 ${g}강 ${n}번 ${type}`); results.push([g, n, type, 'SKIP']); continue; }
    console.log(`\n▶ ${g}강 ${n}번 ${type} 출제...`);
    try {
      execFileSync('node', ['scripts/generate-test.js', '--type', type,
        '--passage', tmpTxt, '--ei', `올림포스고급영미비문학,2025,${g}강,${title}`,
        '--out', outPath], { cwd: ROOT, stdio: 'inherit' });
      // ei/histKey 교정
      const d = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      d.ei = { total: 100, time: 1200, totalQ: 20, title,
        subject: '올림포스고급영미비문학', pub: '2025', lesson: `${g}강`,
        section: `${n}번`, histKey: `${HK[type]}__${g}_${n}_v6` };
      fs.writeFileSync(outPath, JSON.stringify(d, null, 2), 'utf8');
      results.push([g, n, type, 'OK']);
    } catch (e) {
      console.log(`❌ 실패 ${g}강 ${n}번 ${type}: ${e.message}`);
      results.push([g, n, type, 'FAIL']);
    }
  }
  fs.unlinkSync(tmpTxt);
}

console.log('\n\n===== 결과 요약 =====');
const ok = results.filter(r => r[3] === 'OK').length;
const fail = results.filter(r => r[3] === 'FAIL');
const skip = results.filter(r => r[3] === 'SKIP').length;
console.log(`OK ${ok} / SKIP ${skip} / FAIL ${fail.length}`);
fail.forEach(r => console.log(`  FAIL: ${r[0]}강 ${r[1]}번 ${r[2]}`));
