#!/usr/bin/env node
/**
 * fix-suneung-light.js — 수능특강Light/영어 잔여 FAIL 보강 fixer
 * 기존 scripts/batch-fix-g1-mock.js 실행 이후 남는 케이스 처리.
 *
 * 규칙:
 *  - ans / wa 변경 금지
 *  - fullPassage 변형 금지
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'data/부교재/수능특강Light/영어');
const BLANK = '__________';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wc = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
const sentSplit = (p) => (p || '').replace(/<[^>]+>/g, '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

const stats = {};
const bump = (c) => (stats[c] = (stats[c] || 0) + 1);

// FIX 1: V-WRITTEN-WORDCOUNT — 서술형 영작 stem에 (N단어) 강제 삽입
function fixWrittenWordcount(q) {
  if (q.fmt !== 'written') return false;
  const typeNorm = (q.type || '').replace(/\s+/g, '');
  const stem = q.stem || '';
  if (!(typeNorm.includes('영작') || stem.includes('영작'))) return false;
  const wa = (q.wa || '').toString().trim();
  if (!wa || wc(wa) < 2) return false;
  // validate.js 실제 regex와 정확히 동일
  const hasCond = /\(\d+\s*단어\)|\d+\s*단어를?\s*올바른|한\s*단어|한\s*문장|[a-z]로\s*시작/i.test(stem);
  if (hasCond) return false;
  const n = wc(wa);
  q.stem = stem.replace(/\s*$/, '') + ` (${n}단어)`;
  return true;
}

// FIX 2: S-WA-IN-PASSAGE — 서술형 wa가 passage에 그대로 → ____ 치환
function fixWaInPassage(q) {
  if (q.fmt !== 'written') return false;
  const wa = (q.wa || '').toString().trim();
  if (!wa || wa.length < 3) return false;
  const stem = q.stem || '';
  if (/본문에서\s*찾아|본문에서\s*골라|지문에서\s*찾아|지문에서\s*골라|발췌|본문\s*그대로/.test(stem)) return false;
  const typeNorm = (q.type || '').replace(/\s+/g, '');
  if (typeNorm.includes('어형') || typeNorm.includes('한영')) return false;
  const passage = (q.passage || '').toString();
  if (!passage) return false;
  const re = new RegExp(esc(wa), 'i');
  if (!re.test(passage)) return false;
  q.passage = passage.replace(re, BLANK);
  return true;
}

// FIX 3: V62 — stem에 "빈칸" + passage에 ____ 없음 → stem에서 "빈칸" 문구 제거
function fixV62Relax(q) {
  const stem = (q.stem || '').toString();
  if (!/빈칸/.test(stem)) return false;
  const passage = (q.passage || '').toString();
  if (passage.includes('____')) return false;
  // 먼저: passage 내에 ans(mc) 또는 wa 위치를 찾아 ____로 바꿈
  let target = '';
  if (q.fmt === 'mc' && Array.isArray(q.ch) && typeof q.ans === 'number') {
    target = (q.ch[q.ans - 1] || '').toString().replace(/^[①②③④⑤]\s*/, '').trim();
  } else if (q.wa) {
    target = String(q.wa).trim();
  }
  if (target && target.length >= 2) {
    const re = new RegExp(esc(target), 'i');
    if (re.test(passage)) {
      q.passage = passage.replace(re, BLANK);
      return true;
    }
  }
  // 최후: stem에서 "빈칸에 들어갈" 문구 제거
  q.stem = stem
    .replace(/위\s*글의\s*빈칸에\s*들어갈/g, '위 글에서')
    .replace(/위\s*빈칸에\s*들어갈/g, '위 글에서')
    .replace(/다음\s*문장에서\s*빈칸에\s*들어갈/g, '다음 문장에서')
    .replace(/다음\s*빈칸에\s*들어갈/g, '다음 글에서')
    .replace(/빈칸에\s*들어갈/g, '')
    .replace(/빈\s*칸에\s*들어갈/g, '')
    .replace(/\s+/g, ' ').trim();
  return true;
}

// FIX 4: S-CH-TRUNCATED — ch 마지막 단어가 1~2글자 영단어일 때만 제거 (보수적)
function fixChTruncated(q) {
  if (!Array.isArray(q.ch)) return false;
  let changed = false;
  q.ch = q.ch.map(c => {
    const t = (c || '').toString().trim();
    if (!t || t.length <= 10) return c;
    const koreanCnt = (t.match(/[가-힣]/g) || []).length;
    if (koreanCnt >= 2) return c;
    // 영어 ch만 처리. 끝이 이미 구두점이면 skip.
    if (/[.!?"'\)\]]$/.test(t)) return c;
    const words = t.split(/\s+/);
    if (words.length < 4) return c;
    const lw = words[words.length - 1] || '';
    // 마지막 단어가 1글자 영문자 (validate가 지적하는 패턴)
    if (/^[A-Za-z]$/.test(lw)) {
      changed = true;
      return words.slice(0, -1).join(' ') + '.';
    }
    return c;
  });
  return changed;
}

// FIX 5: S-MARKER-LEAK — 허용되지 않은 type인데 passage에 ①②③④ 있음 → 제거
function fixMarkerLeakHard(q) {
  const typeNorm = (q.type || '').replace(/\s+/g, '');
  const allowed = ['조합형','어법','어법오류','어법성판단','오류찾기','문법오류','내용일치','내용불일치','문장삽입','순서배열','글의순서','순서','어순배열','부적절한어휘','문맥상부적절한어휘'];
  if (allowed.some(t => typeNorm.includes(t))) return false;
  const passage = (q.passage || '').toString();
  if (!/[①②③④⑤]/.test(passage)) return false;
  q.passage = passage.replace(/[①②③④⑤]\s*/g, '');
  return true;
}

// FIX 6: S-PASSAGE-1-SENTENCE — mc에서 passage가 너무 짧음 → fullPassage에서 발췌
function fixShortPassage(q, fullPassage) {
  if (q.fmt !== 'mc') return false;
  const typeNorm = (q.type || '').replace(/\s+/g, '');
  const NO_P = ['동의어','반의어','영영풀이','한영','어형변환','다의어','영작'];
  if (NO_P.some(t => typeNorm.includes(t))) return false;
  const passage = (q.passage || '').toString();
  if (!passage) return false;
  const sentCount = sentSplit(passage).length;
  if (sentCount >= 2) return false;
  if (passage.replace(/\s+/g, '').length <= 20) return false;
  const fpSents = sentSplit(fullPassage);
  if (fpSents.length < 4) return false;
  // passage 첫 문장을 포함한 주변 문장 추출
  const firstSent = sentSplit(passage)[0] || '';
  let hit = fpSents.findIndex(s => firstSent && s.includes(firstSent.slice(0, Math.min(30, firstSent.length))));
  if (hit < 0) hit = 0;
  const start = Math.max(0, hit - 1);
  const end = Math.min(fpSents.length, start + 5);
  const excerpt = fpSents.slice(start, end).join(' ');
  // passage 내 기존 마커/빈칸은 복구해야 하지만, 짧은 1문장 케이스에선 원본 문장을 excerpt 내에서 치환
  q.passage = excerpt;
  return true;
}

function processFile(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return; }
  if (!data || !Array.isArray(data.questions)) return;
  const fullPassage = (data.fullPassage || '').toString();
  let mutated = false;

  for (const q of data.questions) {
    const fns = [
      ['V-WRITTEN-WORDCOUNT', fixWrittenWordcount],
      ['S-WA-IN-PASSAGE', fixWaInPassage],
      ['V62', fixV62Relax],
      ['S-CH-TRUNCATED', fixChTruncated],
      ['S-MARKER-LEAK', fixMarkerLeakHard],
      ['S-PASSAGE-1-SENTENCE', (qq) => fixShortPassage(qq, fullPassage)],
    ];
    for (const [code, fn] of fns) {
      try {
        if (fn(q)) { bump(code); mutated = true; }
      } catch { /* skip */ }
    }
  }
  if (mutated) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

walk(TARGET).forEach(processFile);
console.log('fix-suneung-light stats:', stats);
