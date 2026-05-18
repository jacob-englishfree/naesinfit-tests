#!/usr/bin/env node
/**
 * fix-mock-g2-jun.js — 고2 6월(2025) 모의고사 일괄 자동 fix
 * 대상: data/모의고사/고2/6월/  (excludes _passages/)
 *
 * 절대 규칙:
 *  - ans, wa 변경 금지
 *  - fullPassage 자체 변형 금지
 *  - validate 트리거 조건과 정확히 일치하는 경우에만 수정
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'data/모의고사/고2/6월_2024');
const BLANK = '__________';

const NO_PASSAGE_TYPES = ['동의어','반의어','영영풀이','한영','어형변환','다의어','영작'];
const stats = { scanned: 0, fixed: 0, byCode: {} };
const bump = (c) => { stats.byCode[c] = (stats.byCode[c] || 0) + 1; };

function escReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function sentSplit(p) {
  return (p || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}
// validate.js 와 동일한 1-sentence 검출
function isOneSentence(passage) {
  const sentCount = (passage.replace(/\s+/g, ' ').match(/[.!?]['")\]]?(\s|$)/g) || []).length;
  return sentCount <= 1 && passage.replace(/\s+/g,'').length > 20;
}
function sentCountValidate(passage) {
  const pText = passage.replace(/<[^>]+>/g, '');
  return (pText.match(/[.!?]+/g) || []).length;
}
function stripMarker(s) {
  return (s || '').toString().replace(/^[①②③④⑤]\s*/, '').trim();
}
function countWords(s) {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}
function noPassageType(typeNorm) {
  return NO_PASSAGE_TYPES.some(t => typeNorm.includes(t));
}

// === Helper: extract 5-sentence excerpt around target word from fullPassage ===
function excerptAroundWord(fp, target, opts = {}) {
  if (!fp || !target) return null;
  const fpSents = sentSplit(fp);
  if (fpSents.length < 2) return null;
  const re = new RegExp(`\\b${escReg(target)}\\b`, 'i');
  let hit = -1;
  for (let i = 0; i < fpSents.length; i++) if (re.test(fpSents[i])) { hit = i; break; }
  if (hit < 0) return null;
  const want = opts.minSents || 5;
  let start = Math.max(0, hit - 2);
  let end = Math.min(fpSents.length, start + want);
  if (end - start < want) start = Math.max(0, end - want);
  let joined = fpSents.slice(start, end).join(' ');
  if (opts.blank) joined = joined.replace(re, BLANK);
  return joined;
}

// === FIX 1: S-PASSAGE-1-SENTENCE / V63 / V66 / V77 — 짧은 passage 확장 ===
function fixShortPassage(q, fileFP) {
  if (q.fmt !== 'mc') return false;
  const typeNorm = (q.type || '').replace(/\s+/g, '');
  if (noPassageType(typeNorm)) return false;
  const passage = (q.passage || '').toString();
  if (!passage || passage.replace(/\s+/g,'').length <= 20) return false;
  if (!isOneSentence(passage)) {
    const sc = sentCountValidate(passage);
    if (sc >= 5) return false; // long enough
  }

  let target = '';
  if (Array.isArray(q.ch) && q.ans) target = stripMarker(q.ch[Number(q.ans) - 1] || '');
  if (!target || !/^[A-Za-z]/.test(target)) return false;

  const fp = (q.fullPassage || fileFP || '').toString().trim();
  const isBlank = passage.includes('____') || /빈칸/.test(q.stem || '');
  const ex = excerptAroundWord(fp, target, { minSents: 5, blank: isBlank });
  if (!ex) return false;
  q.passage = ex;
  return true;
}

// === FIX 2: V62 — stem says 빈칸 but passage has no ____ ===
function fixV62(q, fileFP) {
  if (q.fmt !== 'mc') return false;
  const stem = (q.stem || '').toString();
  if (!/빈칸/.test(stem)) return false;
  const passage = (q.passage || '').toString();
  if (passage.includes('____')) return false;
  if (!Array.isArray(q.ch) || !q.ans) return false;
  const target = stripMarker(q.ch[Number(q.ans) - 1] || '');
  if (!target || !/^[A-Za-z]/.test(target)) return false;
  const re = new RegExp(`\\b${escReg(target)}\\b`, 'i');
  if (re.test(passage)) {
    q.passage = passage.replace(re, BLANK);
    return true;
  }
  const fp = (q.fullPassage || fileFP || '').toString();
  const ex = excerptAroundWord(fp, target, { minSents: 5, blank: true });
  if (ex) { q.passage = ex; return true; }
  return false;
}

// === FIX 3: V67-H — 함축의미 추론 passage <u> 없음 ===
function fixV67H(q) {
  const type = (q.type || '').trim();
  const stem = (q.stem || '').toString();
  const isFn = /함축의미/.test(type) || /밑줄\s*친/.test(stem);
  if (!isFn) return false;
  const passage = (q.passage || '').toString();
  if (!passage || passage.includes('<u>')) return false;
  let target = '';
  const bMatch = stem.match(/<b>([^<]+)<\/b>/);
  if (bMatch) target = bMatch[1].trim();
  else {
    const qMatch = stem.match(/['"]([A-Za-z][A-Za-z\s,.\-'?!]+?)['"]/);
    if (qMatch) target = qMatch[1].trim();
  }
  if (!target || target.length < 3) return false;
  const re = new RegExp(escReg(target), 'i');
  if (!re.test(passage)) return false;
  q.passage = passage.replace(re, (m) => `<u>${m}</u>`);
  return true;
}

// === FIX 4: V63-E — 어형변환 괄호 없음 ===
function guessBase(wa) {
  wa = (wa || '').trim();
  const cands = [wa];
  const rules = [
    [/tion$/i, 'te'], [/sion$/i, 'de'], [/ment$/i, ''], [/ness$/i, ''],
    [/ity$/i, ''], [/ance$/i, ''], [/ence$/i, ''], [/ous$/i, ''],
    [/ive$/i, ''], [/ful$/i, ''], [/less$/i, ''], [/ly$/i, ''],
    [/ing$/i, ''], [/ied$/i, 'y'], [/ed$/i, ''], [/ies$/i, 'y'],
    [/es$/i, ''], [/s$/i, ''],
  ];
  for (const [re, repl] of rules) {
    if (re.test(wa)) {
      const b = wa.replace(re, repl);
      if (b.length >= 3) cands.push(b);
    }
  }
  return [...new Set(cands)];
}
function fixV63E(q) {
  const stem = (q.stem || '').toString();
  if (!/괄호/.test(stem)) return false;
  const passage = (q.passage || '').toString();
  if (/\([A-Za-z][^)]*\)/.test(passage)) return false;
  const wa = (q.wa || '').toString().trim();
  if (!wa) return false;
  for (const b of guessBase(wa)) {
    const re = new RegExp(`\\b${escReg(b)}\\b`, 'i');
    if (re.test(passage)) {
      q.passage = passage.replace(re, (m) => `(${m})`);
      return true;
    }
  }
  return false;
}

// === FIX 5: V72 — 서술형(찾기/핵심) passage 6문장 미만 ===
function fixV72(q, fileFP) {
  const typeNorm = (q.type || '').replace(/\s+/g, '');
  if (!typeNorm.includes('서술형')) return false;
  if (!(typeNorm.includes('핵심') || typeNorm.includes('찾기'))) return false;
  const passage = (q.passage || '').toString();
  const sc = sentCountValidate(passage);
  if (sc === 0 || sc >= 5) return false;
  const fp = (q.fullPassage || fileFP || '').toString();
  const fpSents = sentSplit(fp);
  if (fpSents.length < 6) return false;
  q.passage = fpSents.slice(0, Math.min(fpSents.length, 8)).join(' ');
  return true;
}

// === FIX 6: S-WORDCOUNT-MISMATCH ===
function fixWordcount(q) {
  const stem = (q.stem || '').toString();
  const m = stem.match(/(\d+)\s*단어/);
  if (!m) return false;
  const claimed = Number(m[1]);
  const wa = (q.wa || '').toString().trim();
  if (!wa) return false;
  const actual = countWords(wa);
  if (actual === claimed || actual === 0) return false;
  q.stem = stem.replace(/(\d+)(\s*단어)/, `${actual}$2`);
  return true;
}

// === FIX 7: S-CIRCULAR-STEM — wa가 stem에 따옴표 노출 ===
function fixCircularStem(q) {
  const wa = (q.wa || '').toString().trim();
  if (!wa) return false;
  const stem = (q.stem || '').toString();
  const re = new RegExp(`["']${escReg(wa)}["']`);
  if (!re.test(stem)) return false;
  q.stem = stem.replace(re, '"___"');
  return true;
}

// =========================================================
function processFile(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return; }
  if (!data || !Array.isArray(data.questions)) return;

  const fileFP = (data.fullPassage || '').toString();
  let mutated = false;

  for (const q of data.questions) {
    stats.scanned++;
    const fns = [
      ['V67-H', fixV67H],
      ['V63-E', fixV63E],
      ['V62',   (qq) => fixV62(qq, fileFP)],
      ['V72',   (qq) => fixV72(qq, fileFP)],
      ['SHORT', (qq) => fixShortPassage(qq, fileFP)],
      ['WORDCOUNT', fixWordcount],
      ['CIRC',  fixCircularStem],
    ];
    for (const [code, fn] of fns) {
      try {
        if (fn(q)) { stats.fixed++; bump(code); mutated = true; }
      } catch (e) { /* skip */ }
    }
  }

  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) processFile(p);
  }
}

walk(TARGET);
console.log('━━━ fix-mock-g2-jun 완료 ━━━');
console.log('scanned questions:', stats.scanned);
console.log('fixed questions:', stats.fixed);
console.log('by code:', JSON.stringify(stats.byCode, null, 2));
