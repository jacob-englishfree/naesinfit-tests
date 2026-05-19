#!/usr/bin/env node
/**
 * 대검수 현황 데이터 생성
 * → inspection-data.json (inspection.html이 로드)
 *
 * solvability-report.json + blind.json 데이터를 합쳐서
 * 파일별 grade 산정 + 이슈 상세 제공
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

function parseLevels(relPath, cat) {
  const parts = relPath.replace('data/' + cat + '/', '').replace(/\/(단어|워크북|퀴즈)\.json$/, '').split('/');
  if (cat === '교과서') {
    return { level1: parts.slice(0, 2).join('/'), level2: parts[2] || '', group: parts.slice(3).join('/') };
  } else if (cat === '모의고사') {
    return { level1: parts[0] || '', level2: parts[1] || '', group: parts.slice(2).join('/') };
  } else {
    return { level1: parts.slice(0, 2).join('/'), level2: parts[2] || '', group: parts.slice(3).join('/') };
  }
}

// --- Load solvability report ---
let solvReport = { issues: [] };
try {
  solvReport = JSON.parse(fs.readFileSync('solvability-report.json', 'utf8'));
} catch (e) {
  console.log('⚠️  solvability-report.json 없음 — python3 scripts/full-solvability-check.py 먼저 실행');
}

// Index issues by file
const issuesByFile = {};
for (const issue of solvReport.issues || []) {
  const key = 'data/' + issue.file;
  if (!issuesByFile[key]) issuesByFile[key] = { critical: 0, high: 0, medium: 0, low: 0, details: [] };
  issuesByFile[key][issue.severity.toLowerCase()] = (issuesByFile[key][issue.severity.toLowerCase()] || 0) + 1;
  issuesByFile[key].details.push({ qid: issue.qid, cat: issue.category, desc: issue.desc, sev: issue.severity });
}

// --- Collect data ---
const allFiles = [];
let totalQuestions = 0;

for (const cat of CATS) {
  const files = walk('data/' + cat);

  for (const f of files) {
    const typeName = path.basename(f, '.json');
    let qCount = 0;
    let parseable = true;

    try {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      qCount = (data.questions || []).length;
    } catch (e) {
      parseable = false;
    }

    totalQuestions += qCount;

    // Blind check
    let blindMismatch = 0, blindMatch = 0;
    const blindFile = f.replace(/\.json$/, '.blind.json');
    if (fs.existsSync(blindFile)) {
      try {
        const bd = JSON.parse(fs.readFileSync(blindFile, 'utf8'));
        if (bd.solves) {
          for (const s of bd.solves) {
            if (s.match) blindMatch++;
            else if (!s.needsAgent) blindMismatch++;
          }
        }
      } catch (e) {}
    }

    // Solvability issues
    const si = issuesByFile[f] || { critical: 0, high: 0, medium: 0, low: 0, details: [] };

    // Grade
    let grade;
    if (!parseable) {
      grade = 'broken';
    } else if (si.critical > 0) {
      grade = 'danger';
    } else if (si.high >= 3 || blindMismatch >= 6) {
      grade = 'danger';
    } else if (si.high > 0 || blindMismatch >= 3) {
      grade = 'caution';
    } else if (si.medium > 0 || blindMismatch >= 1) {
      grade = 'minor';
    } else {
      grade = 'perfect';
    }

    const levels = parseLevels(f, cat);

    allFiles.push({
      path: f,
      cat,
      type: typeName,
      grade,
      level1: levels.level1,
      level2: levels.level2,
      group: levels.group,
      autoMatch: blindMatch,
      mismatch: si.critical + si.high + blindMismatch,
      critical: si.critical,
      high: si.high,
      medium: si.medium,
      totalQ: qCount,
      issues: si.details.filter(d => d.sev === 'CRITICAL' || d.sev === 'HIGH').slice(0, 10)
    });
  }
}

// --- Build categories with tree ---
const catData = {};
for (const cat of CATS) {
  const cf = allFiles.filter(f => f.cat === cat);
  const tree = {};
  for (const f of cf) {
    if (!tree[f.level1]) tree[f.level1] = {};
    const k2 = f.level2 || '';
    const gk = f.group ? (f.level2 + '/' + f.group) : f.level2;
    if (!tree[f.level1][k2]) tree[f.level1][k2] = {};
    if (!tree[f.level1][k2][gk]) tree[f.level1][k2][gk] = [];
    tree[f.level1][k2][gk].push(f);
  }
  catData[cat] = {
    total: cf.length,
    questions: cf.reduce((s, f) => s + f.totalQ, 0),
    tree
  };
}

// --- Issue summary ---
const issueSummary = {};
for (const issue of solvReport.issues || []) {
  if (issue.severity === 'CRITICAL' || issue.severity === 'HIGH') {
    issueSummary[issue.category] = (issueSummary[issue.category] || 0) + 1;
  }
}

// --- Checklist ---
const gc = {};
for (const f of allFiles) gc[f.grade] = (gc[f.grade] || 0) + 1;

const checklist = [
  { label: 'S급 에러 제로화 (42→0건)', done: true },
  { label: '해설 번호 중복 수정 (1,326건)', done: true },
  { label: '어형변환 주어진 단어 추가 (18건)', done: true },
  { label: '서술형 (N단어) 조건 추가 (4,232건)', done: true },
  { label: '정답 오류 안전 수정 (144건)', done: true },
  { label: `CRITICAL ${gc.danger || 0}파일 재출제`, done: false, blocked: (gc.danger || 0) > 0 },
  { label: `HIGH 이슈 파일 (${gc.caution || 0}건) 수정`, done: false },
  { label: 'AI 블라인드 전수 풀이 (Phase 2)', done: false },
  { label: 'push + 배포 확인', done: false },
];

// --- Output ---
const output = {
  timestamp: new Date().toISOString(),
  summary: {
    totalFiles: allFiles.length,
    totalQuestions,
    ansFixed: 144 + 18 + 1326 + 4232,
    sErrors: 0,
    passRate: ((gc.perfect || 0) / allFiles.length * 100).toFixed(1),
    criticalIssues: solvReport.summary?.CRITICAL || 0,
    highIssues: solvReport.summary?.HIGH || 0,
  },
  issueSummary,
  categories: catData,
  checklist,
  files: allFiles.sort((a, b) => {
    const order = { broken: 0, danger: 1, caution: 2, unverified: 3, minor: 4, perfect: 5 };
    return (order[a.grade] ?? 9) - (order[b.grade] ?? 9) || (b.mismatch - a.mismatch);
  })
};

fs.writeFileSync('inspection-data.json', JSON.stringify(output, null, 2), 'utf8');

console.log(`✅ inspection-data.json 생성 (${allFiles.length}파일, ${totalQuestions}문항)`);
console.log(`   perfect: ${gc.perfect || 0} | minor: ${gc.minor || 0} | caution: ${gc.caution || 0} | danger: ${gc.danger || 0} | broken: ${gc.broken || 0}`);
console.log(`   CRITICAL: ${solvReport.summary?.CRITICAL || 0}문항 | HIGH: ${solvReport.summary?.HIGH || 0}문항`);
