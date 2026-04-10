#!/usr/bin/env node
// 공통영어1 교과서 잔여 FAIL 처리 (batch-fix-g1-mock.js 이후 실행)
// ans/wa 변경 금지, fullPassage 변형 금지

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const folders = process.argv.slice(2);
if (!folders.length) { console.error('Usage: ... <folder...>'); process.exit(1); }
const ROOT = path.resolve(__dirname, '..');

function walk(d, o = []) {
  const s = fs.statSync(d);
  if (s.isFile()) { if (d.endsWith('.json')) o.push(d); return o; }
  for (const e of fs.readdirSync(d)) walk(path.join(d, e), o);
  return o;
}
function val(f) {
  try { execSync(`node validate/validate.js "${f}"`, { cwd: ROOT, stdio: ['ignore','pipe','pipe'] }); return []; }
  catch (e) { return ((e.stdout?.toString()||'') + (e.stderr?.toString()||'')).split('\n').map(l=>l.match(/^\s*\[([SA])\]\s+([A-Z][A-Z0-9-]+):\s*Q?(\d+)?/)).filter(Boolean).map(m=>({sev:m[1],code:m[2],qid:m[3]?Number(m[3]):null})); }
}

// --- FIX functions ---

// 1) V-WRITTEN-WORDCOUNT + V63-D: 둘 다 만족하도록 stem 보정
function fixWordcountCondFormat(q) {
  if (q.fmt !== 'written' || !q.stem) return false;
  const type = (q.type || '').trim();
  if (!(type.includes('영작') || q.stem.includes('영작'))) return false;
  const hasFmt = /\(\d+\s*단어\)/.test(q.stem);
  const hasCond = /조건|사용할 것|사용하여|단어 사용|단어로/.test(q.stem);
  if (hasFmt && hasCond) return false;
  // Determine N
  let n = null;
  const mFmt = q.stem.match(/\((\d+)\s*단어\)/);
  const mCond = q.stem.match(/(\d+)\s*단어/);
  if (mFmt) n = Number(mFmt[1]);
  else if (mCond) n = Number(mCond[1]);
  else if (q.wa && typeof q.wa === 'string') {
    const wc = q.wa.trim().split(/\s+/).filter(Boolean).length;
    if (wc >= 2) n = wc;
  }
  if (!n) return false;
  let s = q.stem;
  if (!hasCond) s = s.replace(/\s*$/, '') + ` (조건: ${n}단어 사용)`;
  if (!hasFmt) s = s.replace(/\s*$/, '') + ` (${n}단어)`;
  if (s === q.stem) return false;
  q.stem = s;
  return true;
}

// 2) V-WRITTEN-WORDCOUNT 보강: 영작이지만 조건 전혀 없음 → wa word count 추가
function fixAddWordcount(q) {
  if (q.fmt !== 'written' || !q.wa) return false;
  const type = (q.type || '').trim();
  const stem = q.stem || '';
  if (!(type.includes('영작') || stem.includes('영작'))) return false;
  if (/\(\d+\s*단어\)|\d+\s*단어를?\s*올바른|한\s*단어|한\s*문장|[a-z]로\s*시작/i.test(stem)) return false;
  const wc = String(q.wa).trim().split(/\s+/).filter(Boolean).length;
  if (wc < 2) return false;
  q.stem = stem.replace(/\s*$/, '') + ` (조건: ${wc}단어 사용) (${wc}단어)`;
  return true;
}

// 3) V62 & S-WA-IN-PASSAGE: "위 글에서 다음 빈칸에 들어갈" 스타일 — stem 정규화
//    빈칸이 stem 인용문 안에 있을 때: "빈칸에 들어갈" → "들어갈" 로 stem 변경 + "본문에서 찾아" 추가
function fixStemFindStyle(q) {
  if (q.fmt !== 'written' || !q.stem || !q.wa) return false;
  const stem = q.stem;
  const hasBlankWord = /빈칸에\s*들어갈|빈\s*칸에\s*들어갈/.test(stem);
  const hasFindAlready = /본문에서\s*찾아|본문에서\s*골라|지문에서\s*찾아|지문에서\s*골라|발췌|본문\s*그대로/.test(stem);
  const hasWiGeul = /위\s*글에서|윗글에서|위글에서/.test(stem);
  if (!hasBlankWord && !hasWiGeul) return false;
  // wa가 passage에 있어야 "본문에서 찾아" 문구 유효
  const waLower = String(q.wa).toLowerCase().trim();
  const passLower = String(q.passage || '').toLowerCase();
  const waInPassage = waLower.length >= 3 && passLower.includes(waLower);
  if (!waInPassage) return false;
  // stem 인용문 안에 __________ 있으면 passage의 blank 부재는 의미 없음 — stem 재작성
  const hasQuoteBlank = /_{3,}/.test(stem);
  let s = stem;
  let changed = false;
  if (hasBlankWord && (hasQuoteBlank || hasWiGeul)) {
    // "빈칸에 들어갈" 문구 제거
    s = s.replace(/다음\s*빈칸에\s*들어갈/g, '다음');
    s = s.replace(/빈칸에\s*들어갈\s*/g, '');
    s = s.replace(/빈\s*칸에\s*들어갈\s*/g, '');
    changed = true;
  }
  if (!hasFindAlready && (hasWiGeul || changed)) {
    // "위 글에서" → "본문에서 찾아" 로 대체
    if (hasWiGeul) {
      s = s.replace(/위\s*글에서/g, '본문에서 찾아');
      s = s.replace(/윗글에서/g, '본문에서 찾아');
      s = s.replace(/위글에서/g, '본문에서 찾아');
      changed = true;
    } else {
      s = s.replace(/(쓰시오|고르시오)/, '본문에서 찾아 $1');
      changed = true;
    }
  }
  if (changed) {
    q.stem = s.replace(/\s+/g, ' ').replace(/ \n/g, '\n').trim();
    // preserve original newlines before quote
    if (!q.stem.includes('\n') && stem.includes('\n')) {
      const parts = stem.split('\n');
      q.stem = q.stem;  // already collapsed; keep simple
    }
    return true;
  }
  return false;
}

// 3b) V-WRITTEN-FIND-PASSAGE cleanup: stem "본문에서 찾아"인데 wa가 passage에 없음 → stem에서 제거
function fixStemFindCleanup(q) {
  if (q.fmt !== 'written' || !q.stem || !q.wa) return false;
  const stem = q.stem;
  if (!/본문에서\s*찾아|본문에서\s*골라|지문에서\s*찾아|지문에서\s*골라/.test(stem)) return false;
  const waLower = String(q.wa).toLowerCase().trim();
  const pass = String(q.passage || '').toLowerCase();
  if (waLower.length >= 3 && pass.includes(waLower)) return false;
  // remove "본문에서 찾아" / "본문에서 골라" / etc
  q.stem = stem
    .replace(/본문에서\s*찾아\s*/g, '')
    .replace(/본문에서\s*골라\s*/g, '')
    .replace(/지문에서\s*찾아\s*/g, '')
    .replace(/지문에서\s*골라\s*/g, '')
    .replace(/ +/g, ' ')
    .trim();
  return true;
}

// 3c) S-MARKER-LEAK: ch가 마커형 + passage에 마커 있음 + type이 허용 목록에 없음 → type 정규화
function fixMarkerLeakType(q) {
  if (!Array.isArray(q.ch) || q.ch.length !== 4) return false;
  const isMarkerCh = q.ch.every(c => /^[①②③④⑤]\s*$/.test(String(c||'').trim()));
  if (!isMarkerCh) return false;
  const psg = q.passage || '';
  if (!/[①②③④⑤]/.test(psg)) return false;
  const t = (q.type || '').trim();
  const allowed = ['어법','문장삽입','문장 삽입','순서배열','부적절한 어휘','어순배열'];
  if (allowed.some(a => t.includes(a))) return false;
  // 어휘 → "문맥상 부적절한 어휘"
  if (t === '어휘' || t.includes('어휘')) { q.type = '문맥상 부적절한 어휘'; return true; }
  if (t === '어법성' || t.includes('어법성')) { q.type = '어법'; return true; }
  // default: 어법
  q.type = '어법';
  return true;
}

// 4) F10-D: accept에 마침표 없는 변형 추가
function fixF10D(q) {
  if (q.fmt !== 'written' || !q.wa || typeof q.wa !== 'string') return false;
  const type = (q.type || '').trim();
  if (!(type.includes('영작') || (q.stem||'').includes('영작'))) return false;
  if (!Array.isArray(q.accept)) q.accept = [q.wa];
  const wa = q.wa.trim();
  const noPunct = wa.replace(/[.!?;:,]+$/,'').trim();
  let changed = false;
  if (noPunct !== wa && !q.accept.includes(noPunct)) {
    q.accept.push(noPunct);
    changed = true;
  }
  // 마침표 있는 변형도 (B급 F10-D 권장)
  if (!/[.!?]$/.test(wa) && !q.accept.includes(wa + '.')) {
    q.accept.push(wa + '.');
    changed = true;
  }
  return changed;
}

function fixOne(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { fixes: [], skip: 'parse' }; }
  if (!Array.isArray(data.questions)) return { fixes: [], skip: 'noq' };
  const fixes = [];
  for (const q of data.questions) {
    if (fixWordcountCondFormat(q)) fixes.push(`Q${q.id}:WC-FMT`);
    if (fixAddWordcount(q)) fixes.push(`Q${q.id}:WC-ADD`);
    if (fixStemFindStyle(q)) fixes.push(`Q${q.id}:STEM-FIND`);
    if (fixStemFindCleanup(q)) fixes.push(`Q${q.id}:STEM-FIND-CLEAN`);
    if (fixMarkerLeakType(q)) fixes.push(`Q${q.id}:MARKER-TYPE`);
    if (fixF10D(q)) fixes.push(`Q${q.id}:F10-D`);
  }
  if (fixes.length) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return { fixes };
}

let totalFixed = 0, totalFiles = 0;
for (const folder of folders) {
  const files = walk(path.resolve(folder)).filter(f => !f.includes('/_passages/'));
  for (const f of files) {
    totalFiles++;
    const r = fixOne(f);
    if (r.fixes && r.fixes.length) totalFixed++;
  }
}
console.log(`residual-fix: files=${totalFiles} modified=${totalFixed}`);
