#!/usr/bin/env node
/**
 * report.js — QA 증적 리포트 생성
 */
const fs = require('fs');
const path = require('path');
const { dataToReport, dataToReportDir } = require('./lib/path-mapper');

function generateReport(filePath, stepResults) {
  return {
    file: filePath,
    date: new Date().toISOString().slice(0, 10),
    pipeline: 'qa.js v1',
    steps: stepResults,
    verdict: Object.values(stepResults).every(s => s.pass || s.skip) ? 'PASS' : 'FAIL',
    failReasons: Object.entries(stepResults)
      .filter(([, s]) => !s.pass && !s.skip)
      .map(([name, s]) => `${name}: ${s.summary || 'FAIL'}`),
  };
}

function saveReport(report) {
  const reportPath = dataToReport(report.file);
  const dir = path.dirname(reportPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return reportPath;
}

function hasReport(dataPath) {
  const dir = dataToReportDir(dataPath);
  const base = path.basename(dataPath, '.json');
  try {
    const files = fs.readdirSync(dir);
    return files.some(f => f.startsWith(base + '_') && f.endsWith('.json'));
  } catch { return false; }
}

module.exports = { generateReport, saveReport, hasReport };

if (require.main === module) {
  console.log('report.js — import해서 사용하세요');
}
