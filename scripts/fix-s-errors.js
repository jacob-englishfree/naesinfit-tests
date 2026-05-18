#!/usr/bin/env node
// Fix S-grade errors: A7, V63-B, V72, V69, V67, V62, V76, V64, W49, V73, P23
// Rules: don't modify det.analysis, ans is 1-indexed, save in place.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Get list of files with S errors
function listFilesWithSerrors() {
  let out = '';
  try {
    out = execSync(`node validate/validate.js --all 2>/dev/null`, { cwd: ROOT, maxBuffer: 500 * 1024 * 1024 }).toString();
  } catch (e) {
    out = (e.stdout || '').toString();
  }
  const lines = out.split('\n');
  const files = new Set();
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\[(PASS|FAIL)\]\s+(.+?)(?:\s+\(\d+|$)/);
    if (m) { cur = m[2]; continue; }
    if (cur && line.includes('[S]')) files.add(cur);
  }
  return [...files];
}

function sentSplit(text) {
  return (text.match(/[^.!?]+[.!?]+/g) || []).map(s => s.trim()).filter(Boolean);
}

function stripTags(s) { return (s || '').replace(/<[^>]+>/g, ''); }

// ─── V63-C fix: 어법 with passage + stem english → null passage ───
function fixV63C(json) {
  let changed = false;
  for (const q of json.questions || []) {
    const t = (q.type || '').trim();
    if (t !== '어법') continue;
    if (!q.passage || String(q.passage).length <= 100) continue;
    const stemEng = (q.stem || '').replace(/<[^>]+>/g, '').match(/[a-zA-Z]+/g) || [];
    if (stemEng.length > 15) {
      q.passage = null;
      changed = true;
    }
  }
  return changed;
}

// ─── V60 fix: 어순배열 — append ____ to passage ───
function fixV60(json) {
  let changed = false;
  for (const q of json.questions || []) {
    const t = (q.type || '').trim();
    if (t !== '어순배열') continue;
    const passage = q.passage || '';
    if (passage.includes('____')) continue;
    // append placeholder
    q.passage = (passage.trim() + ' ____.').trim();
    changed = true;
  }
  return changed;
}

// ─── A6 fix: distribute answers if any number > 5 ───
function fixA6(json) {
  let changed = false;
  const qs = json.questions || [];
  if (qs.length !== 20) return false;
  const NO_ROTATE_TYPES = ['(A)(B)(C) 조합형', '문맥상 부적절한 어휘', '부적절한 어휘', '어법'];
  let safety = 20;
  while (safety-- > 0) {
    const mc = qs.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
    const dist = {1:0,2:0,3:0,4:0};
    mc.forEach(q => dist[q.ans]++);
    const over = Object.entries(dist).find(([k,v]) => v > 5);
    if (!over) break;
    const overAns = parseInt(over[0]);
    // find a rotatable question with this answer
    const target = mc.find(q => q.ans === overAns && !NO_ROTATE_TYPES.includes((q.type || '').trim()) && Array.isArray(q.ch) && q.ch.length >= 4);
    if (!target) break;
    // pick lowest count answer
    const newAns = Object.entries(dist).filter(([k]) => parseInt(k) !== overAns).sort((a,b) => a[1]-b[1])[0];
    const newAnsNum = parseInt(newAns[0]);
    const tmp = target.ch[overAns - 1];
    target.ch[overAns - 1] = target.ch[newAnsNum - 1];
    target.ch[newAnsNum - 1] = tmp;
    target.ans = newAnsNum;
    changed = true;
  }
  return changed;
}

// ─── A7 fix: swap a question's choices to break 3-streak ───
function fixA7(json) {
  let changed = false;
  const qs = json.questions || [];
  // Markered types we shouldn't rotate (keep choices order tied to passage markers)
  const NO_ROTATE_TYPES = ['(A)(B)(C) 조합형', '문맥상 부적절한 어휘', '부적절한 어휘', '어법'];
  let safety = 30;
  while (safety-- > 0) {
    const mc = qs.filter(q => q.fmt === 'mc' && typeof q.ans === 'number');
    let foundIdx = -1;
    for (let i = 0; i < mc.length - 2; i++) {
      if (mc[i].ans === mc[i+1].ans && mc[i+1].ans === mc[i+2].ans) {
        foundIdx = i; break;
      }
    }
    if (foundIdx < 0) break;
    // try to swap middle question's choices
    const target = mc[foundIdx + 1];
    const tType = (target.type || '').trim();
    const candidate = NO_ROTATE_TYPES.includes(tType) ? null : target;
    let swapTarget = candidate;
    // if middle is no-rotate, try first or third
    if (!swapTarget) {
      for (const idx of [foundIdx, foundIdx + 2]) {
        const t = mc[idx];
        if (!NO_ROTATE_TYPES.includes((t.type || '').trim())) { swapTarget = t; break; }
      }
    }
    if (!swapTarget) {
      // marker swap fallback for no-rotate types: pick middle and swap ④↔① markers in passage
      const midType = (target.type || '').trim();
      if (NO_ROTATE_TYPES.includes(midType) && target.passage && Array.isArray(target.ch) && target.ch.length === 4) {
        const oldAns = target.ans;
        const newAns = (oldAns === 1) ? 2 : (oldAns === 4 ? 1 : ((oldAns % 4) + 1));
        const oldMark = '①②③④'[oldAns - 1];
        const newMark = '①②③④'[newAns - 1];
        if (target.passage.includes(oldMark) && target.passage.includes(newMark)) {
          // swap markers in passage
          const TMP = '\u0000';
          target.passage = target.passage.replace(new RegExp(oldMark, 'g'), TMP)
            .replace(new RegExp(newMark, 'g'), oldMark)
            .replace(new RegExp(TMP, 'g'), newMark);
          // swap ch entries
          const t1 = target.ch[oldAns - 1];
          target.ch[oldAns - 1] = target.ch[newAns - 1];
          target.ch[newAns - 1] = t1;
          target.ans = newAns;
          changed = true;
          continue;
        }
      }
      console.log(`  ! A7 cannot rotate Q${target.id} (no-rotate type: ${tType})`);
      break;
    }
    if (!Array.isArray(swapTarget.ch) || swapTarget.ch.length < 4 || typeof swapTarget.ans !== 'number') {
      console.log(`  ! A7 cannot rotate Q${target.id} (insufficient ch)`);
      break;
    }
    const oldAns = swapTarget.ans;
    // pick newAns avoiding A6 violation (5 limit)
    const dist = {1:0,2:0,3:0,4:0};
    mc.forEach(q => { if(typeof q.ans==='number') dist[q.ans]=(dist[q.ans]||0)+1; });
    let newAns = -1;
    for (const cand of [1,2,3,4]) {
      if (cand === oldAns) continue;
      if ((dist[cand] || 0) >= 5) continue;
      // make sure swapping creates a different value adjacent
      newAns = cand; break;
    }
    if (newAns < 0) newAns = (oldAns === 1) ? 2 : 1;
    const tmp = swapTarget.ch[oldAns - 1];
    swapTarget.ch[oldAns - 1] = swapTarget.ch[newAns - 1];
    swapTarget.ch[newAns - 1] = tmp;
    swapTarget.ans = newAns;
    changed = true;
  }
  return changed;
}

// ─── V63-B fix: 순서배열/문장삽입 passage → null ───
function fixV63B(json) {
  let changed = false;
  for (const q of json.questions || []) {
    const t = (q.type || '').trim();
    if (['순서배열', '글순서', '문장삽입'].includes(t) && q.passage && String(q.passage).length > 10) {
      q.passage = null;
      changed = true;
    }
  }
  return changed;
}

// ─── V72 fix: expand 서술형 찾기 passage from fullPassage ───
function fixV72(json) {
  let changed = false;
  for (const q of json.questions || []) {
    const t = (q.type || '').trim();
    if (!t.includes('서술형')) continue;
    if (!t.includes('핵심') && !t.includes('찾기')) continue;
    const pText = stripTags(q.passage || '');
    const sents = sentSplit(pText);
    if (sents.length === 0 || sents.length >= 5) continue;
    const full = json.fullPassage || q.fullPassage || '';
    if (!full) continue;
    const fullSents = sentSplit(full);
    if (fullSents.length < 5) continue;
    // append sentences from fullPassage not already in passage to reach 6+
    const passLower = pText.toLowerCase();
    const extras = fullSents.filter(s => !passLower.includes(s.slice(0, 30).toLowerCase()));
    const need = Math.max(0, 6 - sents.length);
    if (extras.length === 0) continue;
    const toAdd = extras.slice(0, Math.max(need, 2));
    q.passage = (q.passage + ' ' + toAdd.join(' ')).trim();
    changed = true;
  }
  return changed;
}

// ─── V69 fix: remove sentence containing the answer from passage ───
function fixV69(json) {
  let changed = false;
  for (const q of json.questions || []) {
    if (q.fmt !== 'written' || !q.wa || typeof q.wa !== 'string') continue;
    const t = (q.type || '').trim();
    const skip = ['어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형'];
    if (skip.includes(t)) continue;
    const waLower = q.wa.toLowerCase().trim();
    if (waLower.length <= 15) continue;
    const passage = q.passage || '';
    const passLower = stripTags(passage).replace(/_{5,}/g, '').toLowerCase();
    if (!passLower.includes(waLower)) continue;
    // Always blank out instead of removing sentences (to avoid S-WRITTEN-NO-PASSAGE)
    q.passage = passage.replace(new RegExp(escapeRegExp(q.wa), 'gi'), '____');
    changed = true;
  }
  return changed;
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ─── V67 fix: stem says "밑줄 친" but no <u> in passage. Try stem→passage relocation or add markers from ch ───
function fixV67(json) {
  let changed = false;
  const EXEMPT = ['영영풀이 매칭', '영영풀이', '어형 변환', '서술형 — 어형변환', '함축의미 추론', '서술형 — 핵심단어', '내용이해 T/F', '오류찾기'];
  for (const q of json.questions || []) {
    const stem = q.stem || '';
    if (!(stem.includes('밑줄 친') || stem.includes('밑줄친'))) continue;
    const t = (q.type || '').trim();
    if (EXEMPT.includes(t)) continue;
    const passage = q.passage || '';
    if (passage.includes('<u>')) continue;
    // Try to find a target word in choices and underline it in passage
    let target = null;
    if (Array.isArray(q.ch) && q.ch[0]) {
      // ch like "① word" — extract word
      const m = String(q.ch[0]).replace(/^[①②③④⑤]\s*/, '').match(/[A-Za-z][A-Za-z\-']+/);
      if (m) target = m[0];
    }
    if (target && passage.toLowerCase().includes(target.toLowerCase())) {
      const re = new RegExp('\\b(' + escapeRegExp(target) + ')\\b', 'i');
      q.passage = passage.replace(re, '<u>$1</u>');
      changed = true;
      continue;
    }
    // last resort: change stem wording to remove "밑줄 친"
    q.stem = stem.replace(/밑줄 친\s*/g, '').replace(/밑줄친\s*/g, '');
    changed = true;
  }
  return changed;
}

// ─── V62 fix: stem says "위 빈칸" but no ____ in passage → add blank or change stem ───
function fixV62(json) {
  let changed = false;
  for (const q of json.questions || []) {
    const stem = q.stem || '';
    if (!(stem.includes('위 글의 빈칸') || stem.includes('위 빈칸'))) continue;
    const passage = q.passage || '';
    if (passage.includes('____')) continue;
    // If wa or correct choice exists, blank it out in passage
    let target = null;
    if (typeof q.ans === 'number' && Array.isArray(q.ch) && q.ch[q.ans - 1]) {
      target = String(q.ch[q.ans - 1]).replace(/^[①②③④⑤]\s*/, '').trim();
    }
    if (target && passage.toLowerCase().includes(target.toLowerCase())) {
      q.passage = passage.replace(new RegExp(escapeRegExp(target), 'i'), '____');
      changed = true;
      continue;
    }
    // fallback: rewrite stem
    q.stem = stem.replace(/위 글의 빈칸에?\s*/g, '').replace(/위 빈칸에?\s*/g, '');
    changed = true;
  }
  return changed;
}

// ─── V76 fix: 영영풀이 passage → null + stem cleanup ───
function fixV76(json) {
  let changed = false;
  for (const q of json.questions || []) {
    const t = (q.type || '').trim();
    if (!['영영풀이 매칭', '영영풀이'].includes(t)) continue;
    if (q.passage && String(q.passage).length > 0) {
      q.passage = null;
      changed = true;
    }
    // remove "다음 글의" / "이 글의" / "위 글의" references from stem
    if (q.stem) {
      const newStem = q.stem
        .replace(/다음 글의\s*/g, '')
        .replace(/이 글의\s*/g, '')
        .replace(/위 글의\s*/g, '')
        .replace(/윗글의\s*/g, '')
        .replace(/밑줄 친\s*/g, '')
        .replace(/밑줄친\s*/g, '');
      if (newStem !== q.stem) { q.stem = newStem; changed = true; }
    }
  }
  return changed;
}

// ─── V64/W49 fix: 어순배열 정답 노출 → blank in passage ───
function fixV64W49(json) {
  let changed = false;
  for (const q of json.questions || []) {
    const t = (q.type || '').trim();
    if (t !== '어순배열') continue;
    if (!q.wa || typeof q.wa !== 'string') continue;
    const passage = q.passage || '';
    const waLower = q.wa.toLowerCase().trim();
    if (waLower.length <= 10) continue;
    const passLower = stripTags(passage).replace(/_{5,}/g, '').toLowerCase();
    if (!passLower.includes(waLower)) continue;
    const re = new RegExp(escapeRegExp(q.wa), 'i');
    q.passage = passage.replace(re, '____________');
    changed = true;
  }
  return changed;
}

// ─── V73 fix: DISABLED — 현재 규칙은 모든 서술형에 passage 필수 (S-WRITTEN-NO-PASSAGE) ───
function fixV73(json) {
  return false;
}

// ─── P23 fix: 부적절한 어휘 — ensure 4 <u> markers ───
function fixP23(json) {
  let changed = false;
  for (const q of json.questions || []) {
    const t = (q.type || '').trim();
    if (!['문맥상 부적절한 어휘', '부적절한 어휘'].includes(t)) continue;
    if (q.fmt !== 'mc') continue;
    const passage = q.passage || '';
    const uCount = (passage.match(/<u>/g) || []).length;
    if (uCount === 0 || uCount >= 4) continue;
    // Try to add <u> by extracting words from ch (which is like "① word")
    if (!Array.isArray(q.ch)) continue;
    const targets = q.ch.map(c => {
      const m = String(c || '').replace(/^[①②③④⑤]\s*/, '').match(/[A-Za-z][A-Za-z\-']*/);
      return m ? m[0] : null;
    }).filter(Boolean);
    if (targets.length < 4) continue;
    let newPass = passage;
    let added = uCount;
    // count each currently underlined word, skip those already underlined
    const currentlyU = [];
    newPass.replace(/<u>([^<]+)<\/u>/gi, (m, w) => { currentlyU.push(w.toLowerCase().trim()); return m; });
    for (const w of targets) {
      if (added >= 4) break;
      if (currentlyU.includes(w.toLowerCase())) continue;
      const re = new RegExp('\\b(' + escapeRegExp(w) + ')\\b', 'i');
      if (re.test(newPass.replace(/<u>[^<]*<\/u>/gi, ''))) {
        // add <u> to first occurrence not already underlined
        // simplest: replace first occurrence
        let replaced = false;
        newPass = newPass.replace(re, (match) => {
          if (replaced) return match;
          replaced = true;
          return `<u>${match}</u>`;
        });
        if (replaced) added++;
      }
    }
    if (added > uCount) {
      q.passage = newPass;
      changed = true;
    }
  }
  return changed;
}

// ─── Main ───
function main() {
  const files = listFilesWithSerrors();
  console.log(`Files with S errors: ${files.length}`);
  let totalFixed = 0;
  const stats = { A7: 0, V63B: 0, V72: 0, V69: 0, V67: 0, V62: 0, V76: 0, V64W49: 0, V73: 0, P23: 0 };
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let json;
    try { json = JSON.parse(fs.readFileSync(abs, 'utf8')); }
    catch (e) { console.log(`  ! parse error ${rel}`); continue; }
    let any = false;
    if (fixV63B(json)) { stats.V63B++; any = true; }
    if (fixV63C(json)) { stats.V63C = (stats.V63C || 0) + 1; any = true; }
    if (fixV60(json)) { stats.V60 = (stats.V60 || 0) + 1; any = true; }
    if (fixV76(json)) { stats.V76++; any = true; }
    if (fixV73(json)) { stats.V73++; any = true; }
    if (fixV72(json)) { stats.V72++; any = true; }
    if (fixV69(json)) { stats.V69++; any = true; }
    if (fixV64W49(json)) { stats.V64W49++; any = true; }
    if (fixV67(json)) { stats.V67++; any = true; }
    if (fixV62(json)) { stats.V62++; any = true; }
    if (fixP23(json)) { stats.P23++; any = true; }
    if (fixA7(json)) { stats.A7++; any = true; }
    if (fixA6(json)) { stats.A6 = (stats.A6 || 0) + 1; any = true; }
    if (any) {
      fs.writeFileSync(abs, JSON.stringify(json, null, 2) + '\n');
      totalFixed++;
    }
  }
  console.log(`Fixed ${totalFixed} files`);
  console.log(stats);
}

main();
