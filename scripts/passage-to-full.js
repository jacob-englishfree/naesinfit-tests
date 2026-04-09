#!/usr/bin/env node
/**
 * passage-to-full.js
 * 모의고사/부교재 테스트 JSON의 question.passage를
 * fullPassage 통째로 + 해당 문항 마커만 splice한 버전으로 변환.
 *
 * Usage:
 *   node scripts/passage-to-full.js <folder> [--dry-run|--apply]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MANUAL_QUEUE_PATH = path.join(__dirname, 'passage-manual-queue.txt');

// ---------- utils ----------
function walkJson(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkJson(p, out);
    else if (/\.(json)$/i.test(name) && /^(단어|워크북|퀴즈)\.json$/.test(name)) out.push(p);
  }
  return out;
}

// Strip all markers/HTML/blanks to get "normal" comparable text.
// For (A)(B)(C) [X / Y] patterns, pick the FIRST option (typically the "correct" one).
function normalize(s) {
  if (!s) return '';
  return s
    .replace(/<b>\([A-C]\)<\/b>\s*\[\s*([^\]/]+?)\s*\/[^\]]*\]/g, ' $1 ') // pick first option
    .replace(/<\/?[bu]>/g, '')                        // <b>, <u>
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')                  // markers
    .replace(/\(\s*[①②③④⑤]\s*\)/g, ' ')             // (①)~(⑤)
    .replace(/_{2,}/g, ' ')                            // ____
    .replace(/\([^()]{1,30}\)/g, ' ')                  // (괄호) 빈칸
    .replace(/[^\w\s'-]/g, ' ')                        // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokens(s) {
  return normalize(s).split(/\s+/).filter(Boolean);
}

function splitSentences(text) {
  // split but keep delimiters
  const parts = [];
  const re = /[^.!?]+[.!?]+(?:["')\]]*)/g;
  let m;
  while ((m = re.exec(text)) !== null) parts.push(m[0].trim());
  if (parts.length === 0 && text.trim()) parts.push(text.trim());
  return parts;
}

function hasMarkers(s) {
  return /[①②③④⑤]|<u>|<b>\([A-C]\)<\/b>|_{2,}|\(\s*[①②③④⑤]\s*\)/.test(s);
}

// Detect (괄호) blanks like (look). Only counted if also no other markers.
function hasParenBlank(s) {
  return /\([a-zA-Z][^()]{0,25}\)/.test(s);
}

function classify(pass) {
  if (!pass) return 'empty';
  if (/<b>\([A-C]\)<\/b>\s*\[/.test(pass)) return 'ABC';
  if (/[①②③④⑤]\s*<u>|<u>[^<]*<\/u>/.test(pass) && /[①②③④⑤]/.test(pass)) return 'grammar';
  // Sentence-level 어법: ①, ②, ③, ④ at sentence starts with NO <u> tags.
  // 4 paraphrased sentences each numbered. Cannot splice into fullPassage.
  if (/[①②③④⑤]\s*[A-Z]/.test(pass) && !/<u>/i.test(pass) && (pass.match(/[①②③④⑤]/g) || []).length >= 3) return 'sentence-grammar';
  if (/\(\s*[①②③④⑤]\s*\)/.test(pass)) return 'insert';
  if (/_{2,}/.test(pass)) return 'blank';
  if (hasParenBlank(pass) && !hasMarkers(pass)) return 'paren';
  return 'plain';
}

// Find best matching full-passage sentence for a given extracted sentence.
// Returns index or -1.
function bestMatch(normExtract, fullSentsNorm, usedSet) {
  if (!normExtract) return -1;
  const avail = (i) => !usedSet || !usedSet.has(i);

  // Strategy A: prefix 30
  {
    const key = normExtract.slice(0, 30);
    let best = -1, bestScore = 0;
    for (let i = 0; i < fullSentsNorm.length; i++) {
      if (!avail(i)) continue;
      const f = fullSentsNorm[i];
      if (!f) continue;
      if (f.startsWith(key) || normExtract.startsWith(f.slice(0, 30))) {
        let n = 0;
        while (n < f.length && n < normExtract.length && f[n] === normExtract[n]) n++;
        if (n > bestScore) { bestScore = n; best = i; }
      }
    }
    if (best >= 0) return best;
  }

  // Strategy B: suffix 30 (tail unchanged)
  {
    const tail = normExtract.slice(-30);
    if (tail.length >= 15) {
      for (let i = 0; i < fullSentsNorm.length; i++) {
        if (!avail(i)) continue;
        const f = fullSentsNorm[i];
        if (f && f.endsWith(tail)) return i;
      }
    }
  }

  // Strategy C: longest unchanged substring ≥ 20 chars
  {
    let best = -1, bestLen = 19;
    for (let i = 0; i < fullSentsNorm.length; i++) {
      if (!avail(i)) continue;
      const f = fullSentsNorm[i];
      if (!f) continue;
      // try windows of length 25 over normExtract
      const L = 25;
      for (let s = 0; s + L <= normExtract.length; s += 5) {
        const win = normExtract.slice(s, s + L);
        if (f.includes(win)) {
          if (L > bestLen) { bestLen = L; best = i; }
          break;
        }
      }
    }
    if (best >= 0) return best;
  }

  // Strategy D: bag-of-words overlap ≥ 70%
  {
    const exToks = new Set(normExtract.split(/\s+/).filter(w => w.length >= 3));
    if (exToks.size >= 4) {
      let best = -1, bestRatio = 0.69;
      for (let i = 0; i < fullSentsNorm.length; i++) {
        if (!avail(i)) continue;
        const f = fullSentsNorm[i];
        if (!f) continue;
        const fToks = new Set(f.split(/\s+/).filter(w => w.length >= 3));
        if (fToks.size === 0) continue;
        let common = 0;
        for (const t of exToks) if (fToks.has(t)) common++;
        const ratio = common / Math.max(exToks.size, fToks.size);
        if (ratio > bestRatio) { bestRatio = ratio; best = i; }
      }
      if (best >= 0) return best;
    }
  }

  return -1;
}

// Types that should NOT be converted (keep original passage)
// 어형변환: 2~4 sentence limit (V74)
// 서술형 — 영작: wa leaks into fullPassage (V69/S-WA-IN-PASSAGE)
// 영영풀이 매칭: definition-based, no passage needed
function isSkipType(type) {
  if (!type) return false;
  const t = String(type).replace(/\s+/g, '');
  if (/어형변환/.test(t)) return true;
  if (/영작/.test(t)) return true; // 서술형 — 영작
  if (/영영풀이/.test(t)) return true;
  return false;
}

// Extract underlined text (first <u>...</u>) to preserve after conversion
function extractUnderline(passage) {
  if (!passage) return null;
  const m = passage.match(/<u>([\s\S]*?)<\/u>/i);
  if (!m) return null;
  // Inner may contain markers like ①; strip for matching but keep original for re-wrap
  const inner = m[1];
  // The content we want to find in fullPassage = strip nested tags and markers
  const plain = inner
    .replace(/<\/?[a-z]+>/gi, '')
    .replace(/[①②③④⑤]/g, '')
    .trim();
  return { raw: inner, plain };
}

// Re-wrap first occurrence of underlined text in newPassage
function reapplyUnderline(newPassage, uInfo) {
  if (!uInfo || !uInfo.plain) return { passage: newPassage, ok: false };
  const needle = uInfo.plain;
  if (!needle) return { passage: newPassage, ok: false };
  // Already has <u>? Skip (shouldn't, since convert came from fullPassage)
  if (/<u>/i.test(newPassage)) return { passage: newPassage, ok: true };
  const idx = newPassage.indexOf(needle);
  if (idx < 0) return { passage: newPassage, ok: false };
  const wrapped = newPassage.slice(0, idx) + '<u>' + needle + '</u>' + newPassage.slice(idx + needle.length);
  return { passage: wrapped, ok: true };
}

// Core: convert one question's passage
function convertPassage(origPassage, fullPassage, qType, qStem, qWa) {
  // Type-aware skip
  if (isSkipType(qType)) {
    return { ok: true, kind: 'skip-type', newPassage: origPassage, skipped: true };
  }

  // Skip 찾기 서술형: stem says "본문에서 찾아" or "본문 속" — find-in-passage by design.
  // wa exposure in fullPassage triggers V69/S-WA-IN-PASSAGE.
  if (qStem && /본문에서\s*찾아|본문\s*속|본문에서\s*고르|글에서\s*찾아/.test(qStem)) {
    return { ok: true, kind: 'skip-find-stem', newPassage: origPassage, skipped: true };
  }
  // Also skip if wa is short (≤2 words) — likely 찾기형 even without explicit stem hint
  if (qWa && typeof qWa === 'string' && qWa.trim().split(/\s+/).length <= 2 && qType && /서술형/.test(qType)) {
    return { ok: true, kind: 'skip-short-wa', newPassage: origPassage, skipped: true };
  }

  // Skip sentence-level 어법 (4 paraphrased sentences with ①②③④ at starts, no <u>)
  if (classify(origPassage) === 'sentence-grammar') {
    return { ok: true, kind: 'skip-sentence-grammar', newPassage: origPassage, skipped: true };
  }

  // Idempotent: if already ≥90% of fullPassage length and contains required markers, skip
  if (origPassage && fullPassage && origPassage.length >= fullPassage.length * 0.9) {
    const origKind = classify(origPassage);
    // For plain/underline types, length alone is enough signal
    // For marker types, ensure markers still present
    if (origKind !== 'empty') {
      return { ok: true, kind: 'already-full', newPassage: origPassage, skipped: true };
    }
  }

  // Preserve underline from original
  const uInfo = extractUnderline(origPassage);

  const kind = classify(origPassage);
  if (kind === 'empty' || kind === 'plain') {
    let np = fullPassage;
    if (uInfo) {
      const r = reapplyUnderline(np, uInfo);
      np = r.passage;
      if (!r.ok) {
        return { ok: false, kind, reason: `밑줄 재적용 실패 (${uInfo.plain.slice(0, 30)}...)` };
      }
    }
    return { ok: true, kind, newPassage: np };
  }

  const extractSents = splitSentences(origPassage);
  const fullSents = splitSentences(fullPassage);
  const fullNorm = fullSents.map(normalize);

  // Build replacement array = copy of fullSents, overwrite matched indices
  const result = fullSents.slice();
  const used = new Set();
  let failed = 0;
  let replaced = 0;

  // First pass: match NON-marker extract sentences to full positions
  // (anchors for positional fallback)
  const extractToFull = new Array(extractSents.length).fill(-1);
  for (let i = 0; i < extractSents.length; i++) {
    const ex = extractSents[i];
    const hasMark = hasMarkers(ex) || (kind === 'paren' && hasParenBlank(ex));
    if (hasMark) continue;
    const idx = bestMatch(normalize(ex), fullNorm, used);
    if (idx >= 0) {
      extractToFull[i] = idx;
      used.add(idx);
    }
  }

  // Second pass: splice marker-bearing sentences (monotonic for grammar/insert/blank)
  const markerFails = [];
  let lastPlaced = -1; // monotonic constraint: marker N+1 must be placed at index > marker N
  for (let i = 0; i < extractSents.length; i++) {
    const ex = extractSents[i];
    const hasMark = hasMarkers(ex) || (kind === 'paren' && hasParenBlank(ex));
    if (!hasMark) continue;
    const nEx = normalize(ex);
    let idx = nEx.length >= 3 ? bestMatch(nEx, fullNorm, used) : -1;
    // Monotonic: marker order in extract must equal marker order in result
    if (idx >= 0 && idx <= lastPlaced) {
      idx = -1; // reject and use positional fallback
    }
    if (idx < 0) {
      // Positional fallback: use previous anchor + 1, or next anchor - 1
      let prevAnchor = -1, nextAnchor = -1;
      for (let j = i - 1; j >= 0; j--) if (extractToFull[j] >= 0) { prevAnchor = extractToFull[j]; break; }
      for (let j = i + 1; j < extractSents.length; j++) if (extractToFull[j] >= 0) { nextAnchor = extractToFull[j]; break; }
      // Marker sentence may span multiple full sentences; try prev+1 (must be > lastPlaced)
      let cand = prevAnchor >= 0 ? prevAnchor + 1 : (nextAnchor >= 0 ? nextAnchor - 1 : -1);
      if (cand <= lastPlaced) cand = lastPlaced + 1;
      if (cand >= 0 && cand < fullSents.length && !used.has(cand)) {
        idx = cand;
      }
    }
    if (idx < 0 || used.has(idx) || idx <= lastPlaced) {
      failed++;
      markerFails.push(i);
      continue;
    }
    used.add(idx);
    lastPlaced = idx;
    extractToFull[i] = idx;
    result[idx] = ex.trim();
    replaced++;
  }

  // Fallback: if the original passage is very short (<= 2 sentences) compared to fullPassage,
  // it's likely a standalone mini-excerpt for 영작/어형변환/단어문맥 — the marker is in the STEM,
  // not meant to splice into the full text. Just return fullPassage as-is.
  const shortExcerpt = extractSents.length <= 2 && origPassage.length < fullPassage.length * 0.35;
  if (replaced === 0 && shortExcerpt) {
    return { ok: true, kind, newPassage: fullPassage, fallback: 'short-excerpt' };
  }

  if (replaced === 0 || failed > 0) {
    return { ok: false, kind, reason: `매칭 실패 (replaced=${replaced}, failed=${failed})` };
  }
  return { ok: true, kind, newPassage: result.join(' ') };
}

// ---------- main ----------
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node passage-to-full.js <folder> [--dry-run|--apply]');
    process.exit(1);
  }
  const folder = path.resolve(args[0]);
  const apply = args.includes('--apply');
  const dry = !apply;

  const files = walkJson(folder);
  let totalQ = 0, autoOk = 0, manualQ = 0;
  const manualLines = [];

  console.log(`\n[변환 결과] (${dry ? 'DRY-RUN' : 'APPLY'})`);
  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { console.log(`  ⚠️ JSON parse error: ${rel}`); continue; }
    const full = data.fullPassage;
    if (!full) { console.log(`  ⚠️ no fullPassage: ${rel}`); continue; }
    const qs = data.questions || [];
    console.log(`파일: ${rel}`);
    let fileChanged = false;
    for (const q of qs) {
      totalQ++;
      if (!q.passage) continue;
      const origLen = q.passage.length;
      const r = convertPassage(q.passage, full, q.type, q.stem, q.wa);
      const tag = `Q${q.id} ${q.type || ''}`;
      if (r.ok) {
        autoOk++;
        const note = r.kind === 'plain' ? 'plain copy' : `splice OK (${r.kind})`;
        console.log(`  ${tag}: ${origLen}자 → ${r.newPassage.length}자 ✅ ${note}`);
        if (apply && r.newPassage !== q.passage) {
          q.passage = r.newPassage;
          fileChanged = true;
        }
      } else {
        manualQ++;
        console.log(`  ${tag}: ${origLen}자 ⚠️ ${r.reason} → 수동`);
        manualLines.push(`${rel}\tQ${q.id}\t${q.type || ''}\t${r.reason}`);
      }
    }
    if (apply && fileChanged) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
  }

  console.log(`\n[요약]`);
  console.log(`총 문항: ${totalQ}`);
  console.log(`자동 변환: ${autoOk}`);
  console.log(`수동 큐: ${manualQ}`);

  if (manualLines.length > 0) {
    fs.writeFileSync(MANUAL_QUEUE_PATH, manualLines.join('\n') + '\n', 'utf8');
    console.log(`수동 큐 파일: ${path.relative(process.cwd(), MANUAL_QUEUE_PATH)}`);
  }
}

main();
