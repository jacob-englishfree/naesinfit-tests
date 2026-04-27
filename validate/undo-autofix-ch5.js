#!/usr/bin/env node
/**
 * undo-autofix-ch5.js — scripts/auto-fix.js가 만든 C16/X36 복구
 *
 * C16: ch.length >= 5 mc 문항을 4지선다로 복원 (마지막 요소 제거, ans 보존 우선)
 * X36: "None of the above" 중복 선지 제거
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      out.push(...walk(path.join(dir, e.name)));
    } else if (e.name.endsWith('.json') && !e.name.startsWith('_') && !e.name.includes('.response.')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function fixQuestion(q) {
  const changes = [];
  if (!Array.isArray(q.ch)) return changes;

  // 1) "None of the above" / "(추가 선지)" placeholder 제거
  const placeholderRe = /^(?:\s*[①②③④⑤])?\s*\(?(?:추가\s*선지|none\s*of\s*the\s*above|all\s*of\s*the\s*above)\)?\s*$/i;
  const cleanedCh = q.ch.filter(c => !placeholderRe.test(String(c).trim()));
  if (cleanedCh.length !== q.ch.length) {
    // ans가 바뀌지 않도록 오프셋 조정
    if (typeof q.ans === 'number') {
      const ansIdx = q.ans - 1;
      const keptIdxs = [];
      for (let i = 0; i < q.ch.length; i++) {
        if (!placeholderRe.test(String(q.ch[i]).trim())) keptIdxs.push(i);
      }
      const newAnsIdx = keptIdxs.indexOf(ansIdx);
      if (newAnsIdx >= 0) q.ans = newAnsIdx + 1;
      else q.ans = 1; // fallback
    }
    q.ch = cleanedCh;
    changes.push('placeholder_removed');
  }

  // 2) ch.length >= 5 → 앞에서 4개만 유지, ans가 5+면 4로 클램프
  if (q.ch.length >= 5 && q.fmt !== 'written') {
    const ansIdx = (typeof q.ans === 'number') ? q.ans - 1 : -1;
    if (ansIdx >= 4) {
      // 정답이 5번째 이상이면 정답을 4번째 자리로 이동
      const ansItem = q.ch[ansIdx];
      q.ch = q.ch.slice(0, 3);
      q.ch.push(ansItem);
      q.ans = 4;
    } else {
      q.ch = q.ch.slice(0, 4);
    }
    changes.push('trimmed_to_4');
  }

  return changes;
}

function processFile(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  let data;
  try { data = JSON.parse(raw); } catch { return null; }

  const questions = Array.isArray(data.questions) ? data.questions
                   : Array.isArray(data.q) ? data.q
                   : null;
  if (!questions) return null;

  let touched = 0;
  const summary = { placeholder_removed: 0, trimmed_to_4: 0 };
  for (const q of questions) {
    const changes = fixQuestion(q);
    if (changes.length) {
      touched++;
      for (const c of changes) summary[c] = (summary[c] || 0) + 1;
    }
  }

  if (touched > 0) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return { file, touched, summary };
  }
  return null;
}

function main() {
  const files = walk(DATA);
  let filesChanged = 0;
  const totals = { placeholder_removed: 0, trimmed_to_4: 0 };
  for (const f of files) {
    const r = processFile(f);
    if (r) {
      filesChanged++;
      for (const k of Object.keys(totals)) totals[k] += (r.summary[k] || 0);
      if (filesChanged <= 10) console.log(`📝 ${path.relative(ROOT, f)}  ${JSON.stringify(r.summary)}`);
    }
  }
  console.log('\n━━━ undo-autofix-ch5 ━━━');
  console.log(`파일: ${files.length}개 스캔, ${filesChanged}개 수정`);
  console.log(`placeholder 제거: ${totals.placeholder_removed}건`);
  console.log(`5→4지선다 복원: ${totals.trimmed_to_4}건`);
}

main();
