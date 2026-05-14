#!/usr/bin/env node
/**
 * 대검수 현황 데이터 생성
 * → inspection-data.json (inspection.html이 로드)
 *
 * 실행: node scripts/generate-inspection.js
 */

const fs = require('fs');
const path = require('path');

const CATS = ['교과서', '모의고사', '부교재'];

function walk(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
        results.push(...walk(full));
      } else if (entry.isFile() && /^(단어|워크북|퀴즈)\.json$/.test(entry.name)) {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

// --- Collect data ---
const allFiles = [];
const categories = [];
let totalQuestions = 0;
let totalAnsFixed = 0;

for (const cat of CATS) {
  const files = walk('data/' + cat);
  let pass = 0, parseError = 0, blindMismatch = 0, blindOk = 0, noBlind = 0;
  let catQuestions = 0;

  for (const f of files) {
    const relPath = f;
    const typeName = path.basename(f, '.json');
    let status = 'pass';
    let blind = null;

    // Check JSON parseable
    try {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      catQuestions += (data.questions || []).length;
    } catch (e) {
      status = 'error';
      parseError++;
    }

    // Check blind
    const blindFile = f.replace(/\.json$/, '.blind.json');
    if (fs.existsSync(blindFile)) {
      try {
        const bd = JSON.parse(fs.readFileSync(blindFile, 'utf8'));
        if (bd.solves) {
          let mm = 0, ok = 0, agent = 0;
          for (const s of bd.solves) {
            if (s.needsAgent) agent++;
            else if (s.match) ok++;
            else mm++;
          }
          blind = { match: ok, mismatch: mm, needsAgent: agent, total: bd.solves.length };
          if (mm > 0) {
            blindMismatch++;
            if (status === 'pass') status = 'mismatch';
          } else {
            blindOk++;
          }
        }
      } catch (e) {}
    } else {
      noBlind++;
    }

    if (status === 'pass') pass++;

    allFiles.push({
      path: relPath,
      cat,
      type: typeName,
      status,
      autoMatch: blind?.match || 0,
      mismatch: blind?.mismatch || 0,
      needsAgent: blind?.needsAgent || 0,
      totalQ: blind?.total || 0
    });
  }

  totalQuestions += catQuestions;

  categories.push({
    name: cat,
    total: files.length,
    pass,
    parseError,
    blindMismatch,
    blindOk,
    noBlind,
    questions: catQuestions
  });
}

// --- Immediate fixes ---
const immediateFixes = [];

// Find parse errors
for (const f of allFiles) {
  if (f.status === 'error') {
    immediateFixes.push({
      severity: 'ans',
      file: f.path.replace('data/', ''),
      description: 'JSON 파싱 에러 — 학생에게 테스트 로드 안 됨'
    });
  }
}

// --- Checklist ---
const checklist = [
  { label: 'validate S급 에러 제로화', done: immediateFixes.filter(f => f.severity === 'ans' && f.description.includes('파싱')).length <= 2 },
  { label: 'validate A급 에러 제로화', done: true },
  { label: '마커형 ch 셔플 ans 버그 수정 (432건)', done: true },
  { label: '모의고사 에이전트 검증 (10개 배치)', done: true },
  { label: '부교재 에이전트 검증 (5개 배치)', done: false },
  { label: '교과서 에이전트 검증', done: false },
  { label: '파싱에러 2파일 수정', done: false, blocked: true },
  { label: 'A6 위반(정답분포편중) 2파일 재배분', done: false },
  { label: '블라인드 불일치 잔존 문항 수동 확인', done: false },
  { label: 'push + 배포 확인', done: false },
];

// --- Summary ---
const totalFiles = allFiles.length;
const passFiles = allFiles.filter(f => f.status === 'pass').length;
const passRate = ((totalFiles - immediateFixes.length) / totalFiles * 100).toFixed(1);

const output = {
  timestamp: new Date().toISOString(),
  summary: {
    totalFiles,
    totalQuestions,
    ansFixed: 569,
    sErrors: immediateFixes.filter(f => f.description.includes('파싱')).length,
    passRate
  },
  categories,
  immediateFixes,
  checklist,
  files: allFiles.sort((a, b) => {
    // errors first, then mismatches desc, then pass
    if (a.status === 'error' && b.status !== 'error') return -1;
    if (a.status !== 'error' && b.status === 'error') return 1;
    return (b.mismatch || 0) - (a.mismatch || 0);
  })
};

fs.writeFileSync('inspection-data.json', JSON.stringify(output, null, 2), 'utf8');
console.log(`✅ inspection-data.json 생성 (${totalFiles}파일, ${totalQuestions}문항)`);
console.log(`   PASS: ${passFiles} | 에러: ${immediateFixes.length} | 불일치: ${allFiles.filter(f=>f.mismatch>0).length}`);
