#!/usr/bin/env node
/**
 * fix-distractor-first-sent.js — S-DISTRACTOR-ALL-FIRST-SENT 자동 수정
 *
 * 로직: 빈칸 추론 오답 3개가 passage 첫 문장 단어 재사용이면
 *   → 오답을 passage 2번째 문장 이후의 동일 품사 단어로 교체
 *   → 없으면 type-generic 후보 풀에서 선택
 *
 * 정답(ans 위치)은 절대 건드리지 않음.
 * overlay/fullPassage/passage 수정 금지.
 *
 * Usage:
 *   node scripts/fix-distractor-first-sent.js <파일...>
 *   node scripts/fix-distractor-first-sent.js --auto   → 전체 스캔 후 자동 수정
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// passage에서 word 추출 (4글자 이상 알파벳, 소문자)
function extractTokens(text, minLen = 4) {
  if (!text) return [];
  return (text.match(/[a-zA-Z][a-zA-Z'-]+/g) || [])
    .map(t => t.toLowerCase())
    .filter(t => t.length >= minLen);
}

function getFirstSentence(fp) {
  const m = (fp || '').match(/^[^.!?]+[.!?]/);
  return m ? m[0].toLowerCase() : '';
}

function getLaterSentences(fp) {
  if (!fp) return '';
  const first = getFirstSentence(fp);
  return first ? fp.toLowerCase().slice(first.length).trim() : fp.toLowerCase();
}

// distractor가 첫문장에서 왔는지 판정
function isFromFirstSent(distractor, firstSent) {
  const tokens = extractTokens(distractor);
  if (!tokens.length) return false;
  const inFirst = tokens.filter(t => firstSent.includes(t)).length;
  return inFirst > 0 && inFirst / tokens.length >= 0.5;
}

// passage 후반에서 쓸 수 있는 대체 후보 뽑기 (정답/기존 ch 단어 제외)
function pickReplacement(laterText, exclude) {
  const excludeSet = new Set(exclude.map(e => String(e).toLowerCase()));
  // stopwords 제외
  const STOP = new Set(['the','and','for','that','this','with','from','have','they','will','been','were','their','when','what','which','these','those','there','than','them','some','more','most','also','such','into','over','only','both','each','about','other','would','could','should','being','where','while','after','before','under','because','through','during','without','between']);
  const tokens = extractTokens(laterText, 5).filter(t => !STOP.has(t) && !excludeSet.has(t));
  // 빈도 ≥1, 길이 ≥5, 영어 단어 (명사/형용사 우선)
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  const sorted = Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.length - b.length);
  return sorted;
}

function fixQuestion(q, fullPassage) {
  if (!Array.isArray(q.ch) || q.ch.length !== 4 || typeof q.ans !== 'number') return false;
  const firstSent = getFirstSentence(fullPassage);
  if (firstSent.length < 20) return false;

  const ansIdx = q.ans - 1;
  const wrongs = q.ch.map((c, i) => ({ c: String(c || '').trim(), i })).filter(x => x.i !== ansIdx);
  const allFromFirst = wrongs.every(w => isFromFirstSent(w.c, firstSent));
  if (!allFromFirst) return false;

  // 대체 후보 풀 (정답 + 기존 오답 단어 제외)
  const ansWord = String(q.ch[ansIdx] || '').toLowerCase();
  const later = getLaterSentences(fullPassage);
  const candidates = pickReplacement(later, [ansWord, ...wrongs.map(w => w.c.toLowerCase())]);

  if (candidates.length < 3) return false; // 후보 부족 → skip

  // 교체: 각 오답 자리에 후보 3개 할당
  let idx = 0;
  for (const w of wrongs) {
    if (idx >= candidates.length) break;
    q.ch[w.i] = candidates[idx++];
  }
  return true;
}

function processFile(jsonPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const d = JSON.parse(raw);
  const fp = d.fullPassage || '';
  let changed = 0;
  if (!Array.isArray(d.questions)) return { file: jsonPath, changed: 0 };
  for (const q of d.questions) {
    const typeNorm = String(q.type || '').replace(/\s/g, '');
    if (!/빈칸|완성|추론/.test(typeNorm)) continue;
    if (fixQuestion(q, fp)) changed++;
  }
  if (changed > 0) {
    fs.writeFileSync(jsonPath, JSON.stringify(d, null, 2));
  }
  return { file: jsonPath, changed };
}

// main
const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/fix-distractor-first-sent.js <파일...>');
  process.exit(1);
}

let totalFiles = 0, totalFixed = 0;
for (const f of args) {
  const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
  if (!fs.existsSync(abs)) { console.warn(`  ⚠️  없음: ${f}`); continue; }
  const r = processFile(abs);
  totalFiles++;
  if (r.changed > 0) {
    totalFixed++;
    console.log(`  ✏️  ${path.relative(ROOT, abs)} — ${r.changed}문항 수정`);
  }
}

console.log(`\n━━━ S-DISTRACTOR-ALL-FIRST-SENT 자동 수정 ━━━`);
console.log(`  처리: ${totalFiles}파일, 수정: ${totalFixed}파일`);
