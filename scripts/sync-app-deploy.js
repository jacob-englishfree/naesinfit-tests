#!/usr/bin/env node
/**
 * 앱 코드(test-deploy.ts + helpers.ts) 동기화
 * data/ 폴더를 스캔하여 실제 존재하는 테스트 목록으로 자동 업데이트
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const APP_ROOT = path.resolve(ROOT, '../내신핏v21/app/src');
const DEPLOY_TS = path.join(APP_ROOT, 'shared/constants/test-deploy.ts');
const HELPERS_TS = path.join(APP_ROOT, 'utils/helpers.ts');

// 수능특강 units 스캔
const supDir = path.join(DATA, '부교재/수능특강/영어');
let supUnits = [];
if (fs.existsSync(supDir)) {
  supUnits = fs.readdirSync(supDir)
    .filter(d => d.endsWith('강') && fs.statSync(path.join(supDir, d)).isDirectory())
    .sort((a, b) => parseInt(a) - parseInt(b));
}

// 교과서 교과목/출판사 스캔
const tbDir = path.join(DATA, '교과서');
let tbEntries = {};
if (fs.existsSync(tbDir)) {
  for (const subj of fs.readdirSync(tbDir)) {
    const subjDir = path.join(tbDir, subj);
    if (!fs.statSync(subjDir).isDirectory()) continue;
    for (const pub of fs.readdirSync(subjDir)) {
      const pubDir = path.join(subjDir, pub);
      if (!fs.statSync(pubDir).isDirectory()) continue;
      const units = fs.readdirSync(pubDir)
        .filter(d => d.endsWith('과') && fs.statSync(path.join(pubDir, d)).isDirectory())
        .sort((a, b) => parseInt(a) - parseInt(b));
      if (units.length) {
        tbEntries[`${subj}/${pub}`] = units;
      }
    }
  }
}

console.log('수능특강 units:', JSON.stringify(supUnits));
console.log('교과서:', Object.keys(tbEntries).length, '개 출판사');

// test-deploy.ts 업데이트
if (fs.existsSync(DEPLOY_TS)) {
  let txt = fs.readFileSync(DEPLOY_TS, 'utf8');
  
  // 수능특강 units 교체
  const supStr = supUnits.map(u => `"${u}"`).join(',');
  txt = txt.replace(
    /"수능특강영어2027":\s*\{[^}]*\}/,
    `"수능특강영어2027": { path: "수능특강/영어", units: [${supStr}] }`
  );
  
  fs.writeFileSync(DEPLOY_TS, txt);
  console.log('✅ test-deploy.ts 업데이트 완료');
}

// helpers.ts도 동일하게 업데이트
if (fs.existsSync(HELPERS_TS)) {
  let txt = fs.readFileSync(HELPERS_TS, 'utf8');
  
  const supStr = supUnits.map(u => `"${u}"`).join(',');
  txt = txt.replace(
    /"수능특강영어2027":\s*\{[^}]*\}/,
    `"수능특강영어2027": { path:"수능특강/영어", units:[${supStr}] }`
  );
  
  fs.writeFileSync(HELPERS_TS, txt);
  console.log('✅ helpers.ts 업데이트 완료');
}

console.log('\n앱 코드 동기화 완료');
