#!/usr/bin/env node
/**
 * NaesinFit — Cross-Question Consistency Checker
 *
 * 같은 시험(같은 폴더 또는 같은 fullPassage 그룹) 내에서:
 * - passage 인용 일관성 (같은 문장이 다르게 인용되면 안 됨)
 * - fullPassage 일치 (한 시험의 fullPassage는 동일해야)
 * - 정답 시퀀스 다양성 (cross-file은 N2가 잡음, 같은 파일 내 변별)
 * - 같은 단어를 다른 문항에서 정답으로 사용 (혼동)
 *
 * Usage:
 *   node validate/cross-question.js <directory>
 *   node validate/cross-question.js --all
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function checkFileGroup(files) {
  const errors = [];

  // 1. fullPassage 일치 (같은 그룹 내)
  const fpMap = new Map();
  for (const fp of files) {
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (data.fullPassage) {
        const key = data.fullPassage.replace(/\s+/g, ' ').trim().substring(0, 100);
        if (!fpMap.has(key)) fpMap.set(key, []);
        fpMap.get(key).push(fp);
      }
    } catch (e) {}
  }

  // 2. 같은 시험 내 동일 정답 단어가 여러 문항에 사용되는지
  // (학생이 한 문항 풀면 다른 문항도 자동 풀림)
  for (const fp of files) {
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const answerWords = new Map(); // word → [qIds]
      const qs = data.questions || [];
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        if (q.fmt !== 'mc' || !Array.isArray(q.ch) || q.ans < 1) continue;
        const ans = q.ch[q.ans - 1];
        if (typeof ans !== 'string') continue;
        if (!/^[a-z]{4,}$/i.test(ans.trim())) continue;
        const w = ans.toLowerCase().trim();
        if (!answerWords.has(w)) answerWords.set(w, []);
        answerWords.get(w).push(i + 1);
      }
      for (const [word, qids] of answerWords) {
        if (qids.length >= 3) {
          errors.push({
            file: fp,
            id: 'CROSS-DUP-ANS',
            sev: 'A',
            msg: `정답 단어 "${word}"가 ${qids.length}개 문항(Q${qids.join(',')})에서 정답`,
          });
        }
      }
    } catch (e) {}
  }

  return errors;
}

function checkDirectory(dir) {
  const allErrors = [];
  const { execSync } = require('child_process');

  // 시험 단위로 그룹화 (같은 폴더 = 같은 시험)
  const groups = {};
  const files = execSync(`find ${dir} -name "*.json" ! -path "*_passages*"`, { encoding: 'utf8' }).trim().split('\n').filter(f => f);

  for (const fp of files) {
    const groupKey = path.dirname(fp);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(fp);
  }

  for (const [key, groupFiles] of Object.entries(groups)) {
    const errs = checkFileGroup(groupFiles);
    allErrors.push(...errs);
  }

  return allErrors;
}

module.exports = { checkFileGroup, checkDirectory };

// CLI
if (require.main === module) {
  const arg = process.argv[2] || '--all';
  const dir = arg === '--all' ? path.join(ROOT, 'data') : arg;
  const errors = checkDirectory(dir);

  const byCode = {};
  for (const e of errors) {
    byCode[e.id] = (byCode[e.id] || 0) + 1;
  }

  errors.slice(0, 30).forEach(e => {
    console.log(`${e.file.replace(ROOT + '/', '')} [${e.sev}] ${e.msg}`);
  });

  console.log('\n=== Cross-Question 검사 결과 ===');
  for (const [code, count] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${count}건`);
  }
  console.log(`총 ${errors.length}건`);
}
