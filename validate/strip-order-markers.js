#!/usr/bin/env node
/**
 * strip-order-markers.js — S-ORDER-MARKER-LEAK 자동 복구
 *
 * 비순서 유형 문항 passage에 (A)/(B)/(C) plain 마커가 잔존한 경우 제거.
 * 순서배열/(A)(B)(C) 조합형/다의어 유형은 건드리지 않음.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '_passages') continue;
      out.push(...walk(path.join(dir, e.name)));
    } else if (e.name.endsWith('.json') && !e.name.startsWith('_')
               && !/\.(blind|blind-prompt|prompt|response)\.json$/.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function stripPlainABC(passage) {
  if (!passage || passage.length < 50) return { out: passage, changed: false };
  // <b>(A)</b> 는 유지 (ABC 조합형 표시)
  // plain (A) / (B) / (C) 공백 포함만 제거
  let out = passage;
  // "(A) " 또는 " (A)" 패턴 (HTML 태그 없음)
  out = out.replace(/(?<![<\w])\s*\((A|B|C)\)\s+/g, ' ');
  // 더블 스페이스 정리
  out = out.replace(/  +/g, ' ');
  return { out, changed: out !== passage };
}

function processFile(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  const questions = Array.isArray(data.questions) ? data.questions : null;
  if (!questions) return null;

  let touched = 0;
  for (const q of questions) {
    const qtype = q.type || '';
    if (/순서|글순서|조합|다의어|\(A\)\(B\)\(C\)/.test(qtype)) continue;
    if (!q.passage) continue;
    const { out, changed } = stripPlainABC(q.passage);
    if (changed) {
      q.passage = out;
      touched++;
    }
  }
  if (touched > 0) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return touched;
  }
  return null;
}

function main() {
  const files = walk(DATA);
  let fc = 0, qc = 0;
  for (const f of files) {
    const r = processFile(f);
    if (r) { fc++; qc += r; }
  }
  console.log(`\n━━━ strip-order-markers ━━━`);
  console.log(`파일: ${files.length}개 스캔, ${fc}개 수정, ${qc}문항 strip`);
}
main();
