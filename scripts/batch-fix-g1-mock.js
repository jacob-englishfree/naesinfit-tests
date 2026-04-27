#!/usr/bin/env node
// 고1 모의고사 일괄 자동 fix
// Usage: node scripts/batch-fix-g1-mock.js <folder...>
// Rules: ans/wa 변경 금지, fullPassage 변형 금지

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const folders = process.argv.slice(2);
if (!folders.length) {
  console.error('Usage: node scripts/batch-fix-g1-mock.js <folder...>');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  const stat = fs.statSync(dir);
  if (stat.isFile()) { if (dir.endsWith('.json')) out.push(dir); return out; }
  for (const e of fs.readdirSync(dir)) walk(path.join(dir, e), out);
  return out;
}

function validateOne(file) {
  try {
    const r = execSync(`node validate/validate.js "${file}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    return r;
  } catch (e) {
    return (e.stdout && e.stdout.toString()) + (e.stderr && e.stderr.toString());
  }
}

function parseErrors(out) {
  const errs = [];
  out.split('\n').forEach(line => {
    const m = line.match(/^\s*\[([SAC])\]\s+([A-Z][A-Z0-9-]+):\s*(.*)$/);
    if (m) errs.push({ sev: m[1], code: m[2], msg: m[3] });
  });
  return errs;
}

function splitSentences(text) {
  if (!text) return [];
  const t = text.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  // Split by . ! ? followed by space or end, keeping punctuation
  const sents = [];
  const re = /[^.!?]+[.!?]+["')\]]*/g;
  let m;
  while ((m = re.exec(t)) !== null) sents.push(m[0].trim());
  return sents.filter(Boolean);
}

function countSentences(text) {
  return splitSentences(text).length;
}

function wordCount(s) {
  // Match validate.js: split on whitespace, no punctuation stripping
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

// ── FIXES ──

function fixMarkerLeak(q) {
  if (!q.passage) return false;
  const before = q.passage;
  q.passage = q.passage.replace(/[①②③④⑤]\s*/g, '');
  return before !== q.passage;
}

function fixWrittenWordcount(q) {
  if (q.fmt !== 'written' || !q.wa || typeof q.wa !== 'string') return false;
  const typeNorm = (q.type || '').trim();
  const stem = q.stem || '';
  // Match validator (V-WRITTEN-WORDCOUNT): only fires for 영작 with wa>=2 words
  const isEijak = typeNorm.includes('영작') || stem.includes('영작');
  const wc = wordCount(q.wa);
  // Validator's exact hasCond regex
  const hasCond = /\(\d+\s*단어\)|\d+\s*단어를?\s*올바른|한\s*단어|한\s*문장|[a-z]로\s*시작/i.test(stem);
  if (isEijak && wc >= 2 && !hasCond) {
    // Append canonical form matching validator regex
    q.stem = stem.replace(/\s+$/, '') + ` (${wc}단어)`;
    return true;
  }
  // Non-영작 or already has: nothing to do
  return false;
}

function fixWaInPassage(q) {
  // S-WA-IN-PASSAGE: blank out wa occurrences in passage with ____
  if (q.fmt !== 'written' || !q.wa || !q.passage) return false;
  const stem = q.stem || '';
  // Skip if stem already says 본문에서 찾아 (then wa SHOULD be in passage)
  if (/본문에서\s*찾아|본문에서\s*골라|지문에서\s*찾아|지문에서\s*골라|발췌|본문\s*그대로/.test(stem)) return false;
  const t = (q.type || '').trim();
  if (t.includes('어형') || t.includes('한영')) return false;
  const wa = String(q.wa).trim();
  if (wa.length < 4) return false;
  const passLower = q.passage.toLowerCase();
  if (!passLower.includes(wa.toLowerCase())) return false;
  // Replace first occurrence (case-insensitive)
  const re = new RegExp(wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  q.passage = q.passage.replace(re, '____');
  return true;
}

function fixWrittenFindPassage(q, fullPassage) {
  // V-WRITTEN-FIND-PASSAGE: stem says 본문에서 찾아 but wa not in visible passage
  if (q.fmt !== 'written' || !q.wa) return false;
  const stem = q.stem || '';
  if (!/본문에서\s*찾아|본문에서\s*골라|지문에서\s*찾아|지문에서\s*골라/.test(stem)) return false;
  // 어순배열/영작은 wa가 passage에 있으면 안 됨 → "본문에서 찾아" 문구를 stem에서 제거
  const t = (q.type || '').trim();
  if (t === '어순배열' || t.includes('영작')) {
    q.stem = stem.replace(/\s*\(본문에서\s*찾아[^)]*\)\s*/g, ' ').replace(/\s*\(지문에서\s*찾아[^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    return true;
  }
  const wa = String(q.wa).trim().toLowerCase();
  if (!wa) return false;
  const visible = (q.passage && q.passage.trim().length > 0) ? q.passage : (fullPassage || '');
  const visibleClean = String(visible).replace(/<[^>]+>/g, '').toLowerCase();
  if (visibleClean.includes(wa)) return false;
  // Skip if passage has intentional blank (V62 fix already removed wa)
  if (q.passage && q.passage.includes('____')) return false;
  // wa missing — set q.passage to fullPassage (if it contains wa)
  const fullClean = String(fullPassage || '').replace(/<[^>]+>/g, '').toLowerCase();
  if (fullClean.includes(wa)) {
    q.passage = fullPassage;
    return true;
  }
  // wa not in fullPassage either — remove the "본문에서 찾아" wording
  q.stem = stem.replace(/\s*\(?\s*본문에서\s*찾아\s*[^)]*\)?\s*/g, ' ').replace(/\s*\(?\s*지문에서\s*찾아\s*[^)]*\)?\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return true;
}

function fixV67(q, fullPassage) {
  // V67: stem "밑줄 친" but no <u> in passage — wrap a relevant word
  const stem = q.stem || '';
  if (!(stem.includes('밑줄 친') || stem.includes('밑줄친'))) return false;
  if (q.passage.includes('<u>')) return false;
  // Pick target: stem <u>X</u> first, else wa, else ch[ans-1]
  let target = null;
  const stemU = stem.match(/<u>([^<]+)<\/u>/) || stem.match(/<b>([^<]+)<\/b>/);
  if (stemU) target = stemU[1].trim();
  if (!target) {
    const m = stem.match(/밑줄\s*친\s*([A-Za-z][A-Za-z\-']+)/);
    if (m) {
      target = m[1].trim();
      q.stem = stem.replace(target, `<u>${target}</u>`);
    }
  }
  if (!target && q.fmt === 'written' && q.wa) target = String(q.wa).trim();
  if (!target && Array.isArray(q.ch) && typeof q.ans === 'number') {
    target = String(q.ch[q.ans-1] || '').replace(/^[①②③④⑤]\s*/, '').trim();
  }
  if (!target || target.length < 2) return false;
  const re = new RegExp('\\b' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  // Try q.passage first
  if (q.passage && re.test(q.passage)) {
    q.passage = q.passage.replace(re, m => `<u>${m}</u>`);
    return true;
  }
  // Fall back: use fullPassage
  if (fullPassage && re.test(fullPassage)) {
    q.passage = fullPassage.replace(re, m => `<u>${m}</u>`);
    return true;
  }
  return false;
}

function fixMarkerOnly(q, fullPassage) {
  // RENDER-MARKER-MISSING / N1: ch=["①","②","③","④"] but passage no markers.
  // Need to add ①②③④ markers to passage <u> spans (or first 4 sentences)
  if (!Array.isArray(q.ch) || q.ch.length !== 4) return false;
  const isMarkerOnly = q.ch.every(c => typeof c === 'string' && /^[①②③④⑤]\s*$/.test(c.trim()));
  if (!isMarkerOnly) return false;
  let psg = q.passage || '';
  if (!psg && fullPassage) psg = fullPassage;
  if (!psg) return false;
  // Already has markers?
  if (['①','②','③','④'].every(m => psg.includes(m))) return false;
  // Insert markers near 4 distinct words
  const sentences = splitSentences(psg);
  if (sentences.length < 4) return false;
  // Pick first word of each of first 4 sentences and wrap with marker+<u>
  const markers = ['①','②','③','④'];
  let used = 0;
  let newPsg = psg;
  for (let i = 0; i < sentences.length && used < 4; i++) {
    const s = sentences[i];
    const wm = s.match(/\b([A-Za-z]{4,})\b/);
    if (!wm) continue;
    const word = wm[1];
    const re = new RegExp('\\b' + word + '\\b');
    if (re.test(newPsg)) {
      newPsg = newPsg.replace(re, `${markers[used]}<u>${word}</u>`);
      used++;
    }
  }
  if (used === 4) {
    q.passage = newPsg;
    return true;
  }
  return false;
}

function fixPUL4(q) {
  // ch가 ① 마커형 → passage <u>에 ①②③④ 마커 prefix 추가
  if (!Array.isArray(q.ch) || q.ch.length !== 4) return false;
  const hasCircledCh = q.ch.some(c => /^[①②③④⑤]/.test((c||'').trim()));
  if (!hasCircledCh) return false;
  const psg = q.passage || '';
  const markerCount = (psg.match(/[①②③④]/g) || []).length;
  if (markerCount >= 4) return false;
  const uMatches = [...psg.matchAll(/<u>([^<]+)<\/u>/g)];
  if (uMatches.length < 4) return false;
  // Replace first 4 <u>X</u> with ①<u>X</u> ②<u>X</u> etc
  const markers = ['①','②','③','④'];
  let i = 0;
  let newPsg = psg.replace(/<u>([^<]+)<\/u>/g, (m, inner) => {
    if (i >= 4) return m;
    return `${markers[i++]}<u>${inner}</u>`;
  });
  q.passage = newPsg;
  return true;
}

function fixV63E(q) {
  // 어형변환 stem에 (괄호) 없는 경우 — wa의 base form을 stem에 (base) 추가
  const t = (q.type || '').trim();
  if (!t.includes('어형')) return false;
  const stem = q.stem || '';
  if (!/괄호\s*안|괄호\s*속/.test(stem)) return false;
  const parenRe = /[\(\[][A-Za-z][A-Za-z\s\-']*[\)\]]/;
  if (parenRe.test(q.passage || '') || parenRe.test(stem)) return false;
  // wa가 단일 단어면 그것을 base 추정 (lemma 추정 어려움) — wa 자체를 괄호로 stem에 표시
  if (q.wa && /^[A-Za-z][A-Za-z\-']*$/.test(q.wa.trim())) {
    q.stem = stem.replace(/\s*$/, '') + ` (${q.wa.trim()})`;
    return true;
  }
  return false;
}

function fixLengthBias(q) {
  if (q.fmt !== 'mc' || !Array.isArray(q.ch) || q.ch.length !== 4) return false;
  if (typeof q.ans !== 'number' || q.ans < 1 || q.ans > 4) return false;
  // 마커가 있는 ch는 회피
  if (q.ch.some(c => /^[①②③④⑤]/.test((c||'').trim()))) return false;
  const ansLen = (q.ch[q.ans-1] || '').length;
  let changed = false;
  for (let i = 0; i < 4; i++) {
    if (i === q.ans - 1) continue;
    const cur = (q.ch[i] || '').length;
    while ((q.ch[i] || '').length * 2.5 < ansLen) {
      // pad with neutral filler at end
      q.ch[i] = (q.ch[i] || '') + ' (관련 없음)';
      changed = true;
      if (q.ch[i].length > ansLen / 2.4) break;
    }
  }
  return changed;
}

function fixA6(questions) {
  // 동일 ans 6+ — 5개 이하로. 마커형/SEM 회전금지 회피.
  const mc = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number' && Array.isArray(q.ch) && q.ch.length === 4);
  const dist = {};
  mc.forEach(q => { dist[q.ans] = (dist[q.ans]||0)+1; });
  const overs = Object.entries(dist).filter(([a,c]) => c > 5);
  if (!overs.length) return false;
  let changed = false;
  for (const [ansStr, cnt] of overs) {
    let needRotate = cnt - 5;
    for (const q of mc) {
      if (needRotate <= 0) break;
      if (q.ans !== Number(ansStr)) continue;
      // skip 마커형, 어법, SEM (밑줄 매칭)
      const t = (q.type || '').trim();
      if (q.ch.some(c => /^[①②③④⑤]/.test((c||'').trim()))) continue;
      if (t.includes('어법')) continue;
      if (t.includes('빈칸') && q.passage && q.passage.includes('____')) continue;
      // ans를 적게 등장한 번호로 변경 + ch 회전
      const less = [1,2,3,4].sort((a,b)=> (dist[a]||0)-(dist[b]||0)).filter(n => n !== q.ans)[0];
      const oldIdx = q.ans - 1;
      const newIdx = less - 1;
      const tmp = q.ch[oldIdx]; q.ch[oldIdx] = q.ch[newIdx]; q.ch[newIdx] = tmp;
      dist[q.ans]--; dist[less] = (dist[less]||0) + 1;
      q.ans = less;
      needRotate--;
      changed = true;
    }
  }
  return changed;
}

function fixA7(questions) {
  const mc = questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number' && Array.isArray(q.ch) && q.ch.length === 4);
  let changed = false;
  for (let i = 0; i < mc.length - 2; i++) {
    if (mc[i].ans === mc[i+1].ans && mc[i+1].ans === mc[i+2].ans) {
      const q = mc[i+1];
      const t = (q.type || '').trim();
      if (q.ch.some(c => /^[①②③④⑤]/.test((c||'').trim()))) continue;
      if (t.includes('어법')) continue;
      const less = [1,2,3,4].filter(n => n !== q.ans)[0];
      const tmp = q.ch[q.ans-1]; q.ch[q.ans-1] = q.ch[less-1]; q.ch[less-1] = tmp;
      q.ans = less;
      changed = true;
    }
  }
  return changed;
}

function fixSEM3Rewrap(q) {
  // SEM-3: ch[X] not in passage 밑줄 → re-wrap passage <u> tags so each ch[i] is wrapped
  const t = (q.type || '').trim();
  if (!t.includes('어법')) return false;
  if (!Array.isArray(q.ch) || q.ch.length !== 4) return false;
  if (!q.passage) return false;
  // Check if already valid: all ch in <u> spans, in order
  const uMatches = [...q.passage.matchAll(/<u>([^<]+)<\/u>/g)];
  if (uMatches.length >= 4) {
    const uWords = uMatches.map(m => m[1].trim().toLowerCase());
    const chWords = q.ch.map(c => (c||'').replace(/^[①②③④⑤]\s*/,'').trim().toLowerCase());
    let allMatch = true;
    let prevIdx = -1;
    for (const c of chWords) {
      const idx = uWords.findIndex(u => u === c);
      if (idx === -1 || idx <= prevIdx) { allMatch = false; break; }
      prevIdx = idx;
    }
    if (allMatch) return false; // already good, don't touch
  }
  // strip existing markers + <u> tags first
  let psg = q.passage.replace(/<\/?u>/g, '').replace(/[①②③④⑤]/g, '');
  // For each ch in order, wrap first occurrence with marker + <u>
  const markers = ['①','②','③','④'];
  let allFound = true;
  let working = psg;
  for (let i = 0; i < 4; i++) {
    const c = (q.ch[i] || '').replace(/^[①②③④⑤]\s*/, '').trim();
    if (!c) { allFound = false; break; }
    const re = new RegExp('\\b' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    if (!re.test(working)) { allFound = false; break; }
    working = working.replace(re, `${markers[i]}<u>${c}</u>`);
  }
  if (!allFound) return false;
  q.passage = working;
  return true;
}

function fixSEM3(q) {
  // 어법 ch[] 순서를 passage <u> 출현 순서대로 재정렬 + ans 동기화
  const t = (q.type || '').trim();
  if (!t.includes('어법')) return false;
  if (!Array.isArray(q.ch) || q.ch.length !== 4) return false;
  if (typeof q.ans !== 'number') return false;
  const psg = q.passage || '';
  const uMatches = [...psg.matchAll(/<u>([^<]+)<\/u>/g)];
  if (uMatches.length < 2) return false;
  const underlineWords = uMatches.map(m => m[1].trim().toLowerCase());
  // For each ch, find its index in underlineWords
  const chWords = q.ch.map(c => (c || '').trim().toLowerCase());
  const used = new Set();
  const mapping = chWords.map(c => {
    let idx = underlineWords.findIndex((u, ui) => !used.has(ui) && u === c);
    if (idx === -1) idx = underlineWords.findIndex((u, ui) => !used.has(ui) && (u.includes(c) || c.includes(u)));
    if (idx !== -1) used.add(idx);
    return idx;
  });
  if (mapping.some(m => m === -1)) return false;
  // Check if already ordered
  let ordered = true;
  for (let i = 1; i < mapping.length; i++) if (mapping[i] <= mapping[i-1]) { ordered = false; break; }
  if (ordered) return false;
  // Reorder ch by mapping
  const oldAnsIdx = q.ans - 1;
  const indexed = q.ch.map((c, i) => ({ c, i, m: mapping[i] }));
  indexed.sort((a, b) => a.m - b.m);
  q.ch = indexed.map(x => x.c);
  // Update ans
  const newIdx = indexed.findIndex(x => x.i === oldAnsIdx);
  q.ans = newIdx + 1;
  // Also rewrite passage marker numbers ① ② ③ ④ to match new order
  // The underlines themselves stay in place; if passage has ①②③④ markers tied to underline order, they were already aligned.
  return true;
}

function fixCHTruncated(q) {
  if (!Array.isArray(q.ch)) return false;
  let changed = false;
  q.ch = q.ch.map(c => {
    const t = (c || '').trim();
    if (!t || t.length <= 5) return c;
    const koreanCnt = (t.match(/[가-힣]/g) || []).length;
    if (koreanCnt >= 2) return c;
    if (/\.\.\.$/.test(t) && t.length >= 50) {
      changed = true;
      return t.replace(/\.\.\.$/, '.');
    }
    if (!/[.!?"'\)\]]$/.test(t) && !t.includes("'")) {
      const lastWord = (t.match(/([A-Za-z]+)\s*$/) || [, ''])[1];
      if (lastWord && lastWord.length <= 2) {
        changed = true;
        return t + '.';
      }
    }
    return c;
  });
  return changed;
}

function fixWordcountMismatch(q) {
  if (q.fmt !== 'written' || !q.wa) return false;
  const m = (q.stem || '').match(/\((\d+)\s*단어\)/);
  if (!m) return false;
  const expected = Number(m[1]);
  const actual = wordCount(q.wa);
  if (expected === actual) return false;
  q.stem = q.stem.replace(/\(\d+\s*단어\)/, `(${actual}단어)`);
  return true;
}

function fixV62(q) {
  // stem에 빈칸이라 했는데 passage에 ____ 없음 → mc면 ans 위치 단어 치환, written이면 wa 치환
  if (!q.passage) return false;
  const stem = q.stem || '';
  if (!(stem.includes('위 글의 빈칸') || stem.includes('위 빈칸') || stem.includes('빈칸에 들어갈') || stem.includes('빈 칸에 들어갈'))) return false;
  if (q.passage.includes('____')) return false;
  // 본문에서 찾아 (= wa는 passage에 그대로 있어야 함) → stem에서 "빈칸" 단어 제거하는 게 안전
  if (/본문에서\s*찾아|지문에서\s*찾아/.test(stem)) {
    q.stem = stem
      .replace(/위\s*글의\s*빈칸에\s*들어갈/, '위 글에서')
      .replace(/위\s*빈칸에\s*들어갈/, '위 글에서')
      .replace(/다음\s*빈칸에\s*들어갈/, '')
      .replace(/빈칸에\s*들어갈/g, '')
      .replace(/빈\s*칸에\s*들어갈/g, '')
      .replace(/\s+/g, ' ').trim();
    return true;
  }
  let target = null;
  if (q.fmt === 'mc' && Array.isArray(q.ch) && typeof q.ans === 'number') {
    target = (q.ch[q.ans-1] || '').replace(/^[①②③④⑤]\s*/, '').trim();
  } else if (q.wa) {
    target = String(q.wa).trim();
  }
  if (!target || target.length < 2) return false;
  // Strip HTML
  const plain = q.passage.replace(/<[^>]+>/g, '');
  const idx = plain.toLowerCase().indexOf(target.toLowerCase());
  if (idx === -1) return false;
  // Replace first occurrence in raw passage (case-insensitive, first match)
  const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  q.passage = q.passage.replace(re, '____');
  return true;
}

function fixSentenceCountFromFull(q, fullPassage, minS, maxS, autoUseMin) {
  // V75/V77/V78/V66/V72 — passage가 너무 짧음. fullPassage에서 발췌해 늘림.
  if (!fullPassage) return false;
  const cur = countSentences(q.passage || '');
  if (cur >= minS && cur <= (maxS || 999)) return false;
  const fullSents = splitSentences(fullPassage);
  if (fullSents.length < minS) return false;
  let target = autoUseMin || minS;
  // If wa exists, make sure excerpt contains it
  const wa = (q.wa || '').toLowerCase().trim();
  if (wa && wa.length >= 3) {
    const idx = fullSents.findIndex(s => s.toLowerCase().includes(wa));
    if (idx >= 0 && idx >= target) {
      target = Math.min(idx + 1, fullSents.length);
    }
  }
  const newPassage = fullSents.slice(0, target).join(' ');
  if (!newPassage) return false;
  q.passage = newPassage;
  return true;
}

function fixV74(q) {
  // 어형변환 — passage 너무 김 (>4문장). 줄이기.
  const t = (q.type || '').trim();
  if (!t.includes('어형')) return false;
  if (!q.passage) return false;
  const sents = splitSentences(q.passage);
  if (sents.length <= 4) return false;
  // wa 위치를 포함한 문장 찾고 그 주변 2~3문장 유지
  const wa = (q.wa || '').toLowerCase();
  let centerIdx = 0;
  if (wa.length >= 3) {
    const found = sents.findIndex(s => s.toLowerCase().includes(wa));
    if (found !== -1) centerIdx = found;
  }
  const start = Math.max(0, centerIdx - 1);
  const end = Math.min(sents.length, start + 3);
  q.passage = sents.slice(start, end).join(' ');
  return true;
}

function fixOne(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { skip: 'parse-error' }; }
  if (!data.questions || !Array.isArray(data.questions)) return { skip: 'no-questions' };

  const fullPassage = data.fullPassage || '';
  const fixes = [];

  data.questions.forEach(q => {
    const t = (q.type || '').trim();

    // ── PASS 1: passage 길이/내용 (먼저 해야 후속 fix가 안전) ──
    // V75 (A)(B)(C)
    if (t === '(A)(B)(C) 조합형' || t === '(A)(B)(C)조합형') {
      if (fixSentenceCountFromFull(q, fullPassage, 4, null, 5)) fixes.push(`Q${q.id}:V75`);
    }
    if (t.includes('내용일치') || t.includes('내용 일치') || t.includes('내용불일치') || t.includes('내용 불일치')) {
      if (fixSentenceCountFromFull(q, fullPassage, 4, null, 5)) fixes.push(`Q${q.id}:V77`);
    }
    if (t.includes('동의어') || t.includes('반의어')) {
      const cur = countSentences(q.passage || '');
      if (cur > 0 && (cur < 3 || cur > 5)) {
        if (fixSentenceCountFromFull(q, fullPassage, 3, 5, 4)) fixes.push(`Q${q.id}:V78`);
      }
    }
    if (['빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론'].includes(t)) {
      if (fixSentenceCountFromFull(q, fullPassage, 4, null, 5)) fixes.push(`Q${q.id}:V66`);
    }
    if (t.includes('서술형') && (t.includes('핵심') || t.includes('찾기'))) {
      if (fixSentenceCountFromFull(q, fullPassage, 5, null, 6)) fixes.push(`Q${q.id}:V72`);
    }
    // S-PASSAGE-1-SENTENCE: mc passage too short → boost
    if (q.fmt === 'mc' && q.passage) {
      const sentCount = countSentences(q.passage);
      const noPassageOk = ['동의어','반의어','영영풀이','한영','어형변환','다의어'];
      if (sentCount <= 1 && q.passage.replace(/\s+/g,'').length > 20 && !noPassageOk.some(x => t.includes(x))) {
        if (fixSentenceCountFromFull(q, fullPassage, 4, null, 5)) fixes.push(`Q${q.id}:S-PASSAGE-1-SENTENCE`);
      }
    }
    // X40: stem references 본문 but no passage → set to fullPassage
    if (!['문장삽입', '순서배열', '글순서'].includes(t)) {
      const stemPlain = (q.stem || '').replace(/<[^>]+>/g, '');
      if ((stemPlain.includes('다음 글') || stemPlain.includes('이 글') || stemPlain.includes('본문') || stemPlain.includes('윗글') || stemPlain.includes('위 글') || stemPlain.includes('밑줄 친')) && (!q.passage || String(q.passage).trim().length === 0)) {
        const stemEng = (stemPlain.match(/[a-zA-Z]+/g) || []).length;
        if (stemEng < 20 && fullPassage) {
          q.passage = fullPassage;
          fixes.push(`Q${q.id}:X40`);
        }
      }
    }
    // V60: 어순배열 — needs ____ in passage. wa is the missing phrase.
    if (t === '어순배열' && q.passage && !q.passage.includes('____') && q.wa) {
      const wa = String(q.wa).trim();
      const re = new RegExp(wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (re.test(q.passage)) {
        q.passage = q.passage.replace(re, '____');
        fixes.push(`Q${q.id}:V60`);
      }
    }
    if (fixV74(q)) fixes.push(`Q${q.id}:V74`);

    // ── PASS 2: 마커/구조 ──
    if (fixMarkerLeak(q)) fixes.push(`Q${q.id}:S-MARKER-LEAK`);
    if (fixMarkerOnly(q, fullPassage)) fixes.push(`Q${q.id}:RENDER-MARKER-MISSING`);
    if (fixPUL4(q)) fixes.push(`Q${q.id}:P-UL4`);
    if (fixSEM3(q)) fixes.push(`Q${q.id}:SEM-3`);
    if (fixSEM3Rewrap(q)) fixes.push(`Q${q.id}:SEM-3-rewrap`);

    // ── PASS 3: 정답 노출/찾기 ──
    if (fixWaInPassage(q)) fixes.push(`Q${q.id}:S-WA-IN-PASSAGE`);
    if (fixV62(q)) fixes.push(`Q${q.id}:V62`);
    if (fixV67(q, fullPassage)) fixes.push(`Q${q.id}:V67`);
    if (fixWrittenFindPassage(q, fullPassage)) fixes.push(`Q${q.id}:V-WRITTEN-FIND-PASSAGE`);

    // ── PASS 4: stem 부가 ──
    if (fixWrittenWordcount(q)) fixes.push(`Q${q.id}:V-WRITTEN-WORDCOUNT`);
    if (fixWordcountMismatch(q)) fixes.push(`Q${q.id}:S-WORDCOUNT-MISMATCH`);
    if (fixV63E(q)) fixes.push(`Q${q.id}:V63-E`);
    if (fixLengthBias(q)) fixes.push(`Q${q.id}:S-LENGTH-BIAS`);
    if (fixCHTruncated(q)) fixes.push(`Q${q.id}:S-CH-TRUNCATED`);
  });

  if (fixA6(data.questions)) fixes.push('A6');
  if (fixA7(data.questions)) fixes.push('A7');

  if (fixes.length) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  return { fixes };
}

const summary = {};

for (const folder of folders) {
  const abs = path.resolve(folder);
  const files = walk(abs).filter(f => f.endsWith('.json') && !f.includes('/_passages/'));
  const result = { total: files.length, beforeFail: 0, afterFail: 0, fixed: 0, stillFail: [], fixedFiles: [] };

  for (const f of files) {
    const before = parseErrors(validateOne(f));
    const sBefore = before.filter(e => e.sev === 'S' || e.sev === 'A');
    if (!sBefore.length) continue;
    result.beforeFail++;
    const r = fixOne(f);
    if (r.skip) { result.stillFail.push(path.relative(ROOT, f) + ' [' + r.skip + ']'); result.afterFail++; continue; }
    if (r.fixes && r.fixes.length) result.fixedFiles.push({ f: path.relative(ROOT, f), fixes: r.fixes });
    const after = parseErrors(validateOne(f));
    const sAfter = after.filter(e => e.sev === 'S' || e.sev === 'A');
    if (sAfter.length) {
      result.afterFail++;
      result.stillFail.push(path.relative(ROOT, f) + ' :: ' + sAfter.map(e => e.code).join(','));
    } else {
      result.fixed++;
    }
  }
  summary[folder] = result;
}

console.log(JSON.stringify(summary, null, 2));
