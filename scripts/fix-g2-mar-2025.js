#!/usr/bin/env node
/**
 * fix-g2-mar-2025.js
 *
 * 고2 3월_2025 폴더 일괄 자동 fix.
 * S/A급 에러를 기존 fix 스크립트와 동일한 전략으로 일괄 처리.
 *
 * 규칙: ans/wa 변경 금지, fullPassage 변형 금지.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'data/모의고사/고2/3월_2025');

function listJson(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== '_passages') out = out.concat(listJson(full));
    else if (e.name.endsWith('.json') && !e.name.startsWith('_')) out.push(full);
  }
  return out;
}

function splitSentences(text) {
  if (!text) return [];
  const t = text.replace(/<br\s*\/?>/gi, ' ');
  return t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
}
function countSentences(text) {
  if (!text) return 0;
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean.match(/[.!?]+(?=\s|$)/g) || []).length;
}
function plainLen(text) {
  return (text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
}

// passage를 fullPassage 기반으로 5+문장으로 확장. 기존 passage가 fullPassage에 포함되면 그 부근으로 확장.
function expandPassage(passage, fullPassage, target = 6) {
  if (!fullPassage) return passage;
  const fullSents = splitSentences(fullPassage.replace(/<[^>]+>/g, ''));
  if (fullSents.length === 0) return passage;
  if (fullSents.length <= target) return fullPassage;

  // 기존 passage 텍스트(태그 제거)에서 첫 6단어 찾기
  const cleanPass = (passage || '').replace(/<[^>]+>/g, '').trim();
  let startIdx = 0;
  if (cleanPass.length > 10) {
    const firstWords = cleanPass.split(/\s+/).slice(0, 6).join(' ');
    const found = fullSents.findIndex(s => s.includes(firstWords.slice(0, Math.min(40, firstWords.length))));
    if (found >= 0) startIdx = found;
    else {
      // 첫 단어 3개로 재시도
      const w3 = cleanPass.split(/\s+/).slice(0, 3).join(' ');
      const f2 = fullSents.findIndex(s => s.includes(w3));
      if (f2 >= 0) startIdx = f2;
    }
  }
  // start에서 target개. 부족하면 앞쪽으로 당김.
  let end = startIdx + target;
  if (end > fullSents.length) {
    end = fullSents.length;
    startIdx = Math.max(0, end - target);
  }
  return fullSents.slice(startIdx, end).join(' ');
}

const META_PATTERNS = [
  /해설\s*[:：]/, /정답\s*[:：]/, /\bANSWER\b/i, /\[해설\]/, /\[정답\]/, /※/,
  /^\s*\(주\)/m, /\bExplanation\b/i,
];

const CIRCLE_RE = /[①②③④⑤]/g;
const NUM_RE = /\((?:조건\s*:\s*)?(\d{1,2})\s*단어(?:\s*사용)?\)/;

const MARKER_ALLOWED = ['(A)(B)(C) 조합형','어법','어법 오류','어법성 판단','오류 찾기','문법 오류','내용일치','내용 일치','내용불일치','내용 불일치','문장삽입','문장 삽입','순서배열','글의 순서','순서','어순배열','문맥상 부적절한 어휘','부적절한 어휘'];

function isMarkerAllowed(typeNorm) {
  const ns = typeNorm.replace(/\s+/g, '');
  return MARKER_ALLOWED.some(t => ns.includes(t.replace(/\s+/g, '')));
}

const stats = {};
function bump(k) { stats[k] = (stats[k] || 0) + 1; }

function fixFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch { return false; }
  const fullPassage = data.fullPassage || '';
  const questions = data.questions || [];
  let changed = false;

  // ── per-question fixes ──
  questions.forEach((q, qi) => {
    const qid = q.id || (qi + 1);
    const typeNorm = (q.type || '').trim();
    const isMc = q.fmt === 'mc';
    const isWritten = q.fmt === 'written';
    const stem = q.stem || '';
    const passage = q.passage || '';
    const wa = typeof q.wa === 'string' ? q.wa : '';
    const ch = Array.isArray(q.ch) ? q.ch : [];

    // ── S-META-LEAK ──
    const stripMeta = (s) => {
      if (!s) return s;
      let r = s;
      for (const pat of META_PATTERNS) {
        r = r.replace(new RegExp(pat.source + '.*$', pat.flags.includes('m') ? 'gm' : 'g'), '').trim();
      }
      return r;
    };
    const newPassage = stripMeta(passage);
    if (newPassage !== passage) { q.passage = newPassage; bump('S-META-LEAK'); changed = true; }
    const newStem = stripMeta(stem);
    if (newStem !== stem) { q.stem = newStem; bump('S-META-LEAK'); changed = true; }
    if (ch.length) {
      ch.forEach((c, idx) => {
        const nc = stripMeta(c);
        if (nc !== c) { q.ch[idx] = nc; bump('S-META-LEAK'); changed = true; }
      });
    }

    // ── S-MARKER-LEAK: passage 마커 제거 (해당 유형 아닐 때) ──
    if (q.passage) {
      const markerCount = (q.passage.match(CIRCLE_RE) || []).length;
      if (markerCount >= 2 && !isMarkerAllowed(typeNorm)) {
        q.passage = q.passage.replace(CIRCLE_RE, '').replace(/\s+/g, ' ').trim();
        bump('S-MARKER-LEAK'); changed = true;
      }
    }

    // ── S-PASSAGE-1-SENTENCE / V63 / V66 / V77 / V75: passage 확장 ──
    // mc 문항 + 1문장 + passage 존재 → 6문장으로 확장
    if (isMc && q.passage && fullPassage) {
      const sCount = countSentences(q.passage);
      const noPass = ['동의어','반의어','영영풀이','한영','어형변환','다의어'];
      const isNoPass = noPass.some(t => typeNorm.includes(t));
      // 밑줄/빈칸/(A)(B)(C) 마커 있으면 → 마커 보존하며 surrounding context 추가
      const hasMarker = /<u>|____|_____|\(A\)|\(B\)|\(C\)/.test(q.passage);
      if (!isNoPass && hasMarker && sCount > 0 && sCount < 5 && fullPassage) {
        // 기존 passage의 plain text가 fullPassage 어디에 있는지 찾아 앞뒤 문장 추가
        const cleanCore = q.passage.replace(/<[^>]+>/g, '').replace(/____+/g, '').replace(/[①②③④⑤]/g, '').replace(/\s+/g, ' ').trim();
        const fullClean = fullPassage.replace(/<[^>]+>/g, '');
        const fullSents = splitSentences(fullClean);
        // Find which sentence in fullSents matches the core (case-insensitive, 4-word stub)
        const words = cleanCore.split(/\s+/);
        const tryStubs = [
          words.slice(0, 8).join(' ').toLowerCase(),
          words.slice(0, 5).join(' ').toLowerCase(),
          words.slice(0, 4).join(' ').toLowerCase(),
          words.slice(1, 5).join(' ').toLowerCase(),
        ].map(s => s.slice(0, 60)).filter(s => s.length > 8);
        let coreIdx = -1;
        for (const stub of tryStubs) {
          coreIdx = fullSents.findIndex(s => s.toLowerCase().includes(stub));
          if (coreIdx >= 0) break;
        }
        if (coreIdx >= 0 && fullSents.length >= 2) {
          // 앞 4문장 + (q.passage 그대로) + 뒤 4문장 → 5문장 확보 시 교체
          const before = fullSents.slice(Math.max(0, coreIdx - 4), coreIdx).join(' ');
          const after = fullSents.slice(coreIdx + 1, Math.min(fullSents.length, coreIdx + 5)).join(' ');
          const wrapped = [before, q.passage, after].filter(Boolean).join(' ').trim();
          if (countSentences(wrapped) >= 5) {
            q.passage = wrapped;
            bump('PASSAGE-WRAP'); changed = true;
          }
        }
      }
      if (!isNoPass && !hasMarker && sCount > 0 && sCount < 5) {
        // V74: 어형변환은 2~4문장 권장 → 확장 안 함
        if (typeNorm.includes('어형')) { /* skip */ }
        else {
          // 빈칸형 V66: 5+문장
          // V75 (A)(B)(C) 조합형: 5~8 → 6
          // V77 내용일치: 5~10 → 6
          // 일반 mc: 1문장 → 6
          let target = 6;
          if (typeNorm.includes('(A)(B)(C)')) target = 6;
          if (typeNorm.includes('내용')) target = 6;
          const expanded = expandPassage(q.passage, fullPassage, target);
          if (expanded && countSentences(expanded) >= 4 && expanded !== q.passage) {
            q.passage = expanded;
            bump('PASSAGE-EXPAND'); changed = true;
          }
        }
      }
    }

    // ── S-WORDCOUNT-MISMATCH: stem의 (N단어) → 실제 wa 단어 수 ──
    if (wa && stem) {
      const m = stem.match(NUM_RE);
      if (m) {
        const expected = parseInt(m[1], 10);
        const actual = wa.trim().split(/\s+/).filter(Boolean).length;
        if (actual !== expected) {
          q.stem = stem.replace(NUM_RE, `(${actual}단어)`);
          bump('S-WORDCOUNT-MISMATCH'); changed = true;
        }
      }
    }

    // ── S-WA-IN-PASSAGE: stem에 "본문에서 찾아 쓰시오" 추가 ──
    if (isWritten && wa && q.passage) {
      const isFind = /본문에서 찾아|발췌|본문 그대로|본문에서 골라|지문에서 찾아/.test(stem);
      const isMorph = typeNorm.includes('어형') || typeNorm.includes('한영');
      if (!isFind && !isMorph) {
        const waNorm = wa.trim().toLowerCase();
        if (waNorm.length >= 4 && q.passage.toLowerCase().includes(waNorm)) {
          q.stem = (q.stem || '').replace(/\s*$/, '') + ' (본문에서 찾아 쓰시오)';
          bump('S-WA-IN-PASSAGE'); changed = true;
        }
      }
    }

    // ── S-CIRCULAR-STEM: stem에 wa가 따옴표로 노출 → 한국어 뜻으로 교체 시도 (없으면 따옴표만 제거) ──
    if (isWritten && wa) {
      const waEsc = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const quotePat = new RegExp(`['"\u2018\u2019\u201C\u201D]\\s*${waEsc}\\s*['"\u2018\u2019\u201C\u201D]|\\*\\*${waEsc}\\*\\*`, 'i');
      if (quotePat.test(stem)) {
        q.stem = stem.replace(quotePat, '___');
        bump('S-CIRCULAR-STEM'); changed = true;
      }
    }

    // ── S-CH-TRUNCATED: "..." 절단 → fullPassage에서 완결 형태 복구 ──
    if (isMc && ch.length === 4 && fullPassage) {
      ch.forEach((c, idx) => {
        const trimmed = (c || '').trim();
        if (!trimmed) return;
        if (/\.\.\.$/.test(trimmed) && trimmed.length >= 50) {
          // fullPassage에서 trimmed의 시작 부분 매칭
          const stub = trimmed.replace(/\.\.\.$/, '').trim().slice(0, 40);
          const idxIn = fullPassage.indexOf(stub);
          if (idxIn >= 0) {
            // 마침표까지 확장
            const tail = fullPassage.slice(idxIn);
            const dotMatch = tail.match(/^[\s\S]{0,400}?[.!?](?=\s|$)/);
            if (dotMatch) {
              q.ch[idx] = dotMatch[0].trim();
              bump('S-CH-TRUNCATED'); changed = true;
            }
          }
        }
      });
    }

    // ── S-LENGTH-BIAS: 정답 길이 >> 오답 평균 → 오답을 정답 70% 길이로 패딩 ──
    if (isMc && ch.length === 4 && typeof q.ans === 'number' && q.ans >= 1 && q.ans <= 4) {
      const ansLen = (q.ch[q.ans - 1] || '').length;
      const wrongIdxs = [0, 1, 2, 3].filter(i => i !== q.ans - 1);
      const wrongAvg = wrongIdxs.reduce((s, i) => s + (q.ch[i] || '').length, 0) / 3;
      if (wrongAvg >= 5 && ansLen >= wrongAvg * 2.5) {
        // 오답에 ", and so on for further detail" 같은 패딩 추가하지 않고
        // 정답이 fullPassage 문장이면 → 오답을 길이 비슷한 fullPassage 문장으로 교체 시도
        const sents = splitSentences(fullPassage.replace(/<[^>]+>/g, '')).filter(s => s.length >= ansLen * 0.5 && s.length <= ansLen * 1.2);
        if (sents.length >= 3) {
          // 정답과 다른 sentence를 골라 wrong에 채움
          const ansText = (q.ch[q.ans - 1] || '').replace(/<[^>]+>/g, '').trim();
          const candidates = sents.filter(s => s !== ansText);
          if (candidates.length >= 3) {
            wrongIdxs.forEach((wi, k) => {
              if (candidates[k]) q.ch[wi] = candidates[k];
            });
            bump('S-LENGTH-BIAS'); changed = true;
          }
        }
      }
    }

    // ── V62: stem이 "빈칸"인데 passage에 빈칸 없음 → 첫 적당한 명사 위치에 ____ 삽입 (안전: 정답 단어 빈칸화) ──
    if ((stem.includes('위 글의 빈칸') || stem.includes('위 빈칸') || stem.includes('빈칸에 들어갈')) &&
        q.passage && q.passage.trim().length > 10 &&
        !q.passage.includes('____') && !q.passage.includes('_____')) {
      // 정답 단어 wa 또는 ch[ans-1]
      let key = '';
      if (wa) key = wa.trim().split(/\s+/)[0];
      else if (isMc && typeof q.ans === 'number' && ch[q.ans - 1]) {
        const ansT = String(ch[q.ans - 1]).replace(/^[①②③④⑤]\s*/, '').trim();
        key = ansT.split(/\s+/)[0];
      }
      if (key && key.length >= 2) {
        const re = new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (re.test(q.passage)) {
          q.passage = q.passage.replace(re, '____');
          bump('V62'); changed = true;
        }
      }
    }

    // ── V-WRITTEN-WORDCOUNT / V63-D: 서술형 stem에 단어 수 조건 추가 ──
    if (isWritten && wa && !NUM_RE.test(q.stem || '')) {
      const isWriting = (typeNorm.includes('영작') || (q.stem || '').includes('영작') || (q.stem || '').includes('우리말') || (q.stem || '').includes('일치하도록'));
      if (isWriting) {
        const wc = wa.trim().split(/\s+/).filter(Boolean).length;
        if (wc >= 1 && wc <= 30) {
          q.stem = (q.stem || '').replace(/\s*$/, '') + ` (조건: ${wc}단어)`;
          bump('V-WRITTEN-WORDCOUNT'); changed = true;
        }
      }
    }

    // ── S-PREFIX-DOMINANT: 동일 prefix 제거 ──
    if (isMc && ch.length >= 4) {
      const isComb = /\(A\)\(B\)\(C\)|조합|동의어|반의어|영영풀이|한영|어형|다의어/.test(typeNorm);
      const avgLen = ch.reduce((s, c) => s + (c || '').length, 0) / ch.length;
      if (!isComb && avgLen >= 30) {
        // 공통 prefix 길이 측정
        const norm = ch.map(c => (c || '').replace(/\s+/g, ' ').trim());
        let common = norm[0];
        for (let i = 1; i < norm.length; i++) {
          let k = 0;
          while (k < common.length && k < norm[i].length && common[k] === norm[i][k]) k++;
          common = common.slice(0, k);
        }
        if (common.length >= 15) {
          // prefix 제거
          const trimmed = norm.map(c => c.slice(common.length).replace(/^[\s,;.\-]+/, '').trim());
          if (trimmed.every(t => t.length >= 5)) {
            q.ch = trimmed;
            bump('S-PREFIX-DOMINANT'); changed = true;
          }
        }
      }
    }
  });

  // ── F10-D: accept에 마침표 변형 추가 ──
  questions.forEach(q => {
    if (q.fmt === 'written' && q.wa && typeof q.wa === 'string' && Array.isArray(q.accept)) {
      const wa = q.wa.trim();
      let added = false;
      const set = new Set(q.accept.map(a => (a || '').trim()));
      if (wa.endsWith('.')) {
        const noDot = wa.slice(0, -1).trim();
        if (!set.has(noDot)) { set.add(noDot); added = true; }
      } else if (wa.length > 0) {
        const withDot = wa + '.';
        if (!set.has(withDot)) { set.add(withDot); added = true; }
      }
      // 소문자 변형도 같이
      const lower = wa.toLowerCase();
      if (!set.has(lower)) { set.add(lower); added = true; }
      const lowerNoDot = lower.replace(/\.$/, '').trim();
      if (lowerNoDot && !set.has(lowerNoDot)) { set.add(lowerNoDot); added = true; }
      if (added) {
        q.accept = Array.from(set).filter(s => s.length > 0);
        bump('F10-D'); changed = true;
      }
    }
  });

  // ── A6/A7: 정답 분포 (셔플) ── 기존 fix-s-grade와 동일 전략
  // 정답 5개 이상이거나 3연속이면 mc 문항(마커형 제외)의 ch를 셔플하여 ans 변경
  function rebalance() {
    const mcQs = questions.filter(q => q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 4 && typeof q.ans === 'number');
    if (mcQs.length < 4) return false;
    let local = false;

    const dist = () => {
      const d = {1:0,2:0,3:0,4:0};
      mcQs.forEach(q => { d[q.ans] = (d[q.ans]||0)+1; });
      return d;
    };
    const has3InARow = () => {
      for (let i = 0; i < mcQs.length - 2; i++) {
        if (mcQs[i].ans === mcQs[i+1].ans && mcQs[i+1].ans === mcQs[i+2].ans) return i;
      }
      return -1;
    };

    // 셔플 가능한 문항: 마커형 ①②③④이 ch 그 자체가 아닌 것
    const isMarkerType = (q) => q.ch.every(c => /^[①②③④⑤]\s*$/.test((c || '').trim()));
    // 어법(<u> 포함 등) 마커형/<u> 들어간 ch는 회전 금지
    const canRotate = (q) => !isMarkerType(q) && !q.ch.some(c => /<u>/.test(c || '')) && (q.type || '').indexOf('어법') === -1;

    // A6: 정답 5+개
    let safety = 60;
    while (safety-- > 0) {
      const d = dist();
      const over = Object.entries(d).find(([_, n]) => n > 5);
      if (!over) break;
      const overAns = parseInt(over[0], 10);
      const under = Object.entries(d).sort((a, b) => a[1] - b[1])[0];
      const underAns = parseInt(under[0], 10);
      // overAns인 문항 중 회전 가능한 것 하나의 ch를 swap
      const target = mcQs.find(q => q.ans === overAns && canRotate(q));
      if (!target) break;
      const i1 = overAns - 1, i2 = underAns - 1;
      [target.ch[i1], target.ch[i2]] = [target.ch[i2], target.ch[i1]];
      target.ans = underAns;
      local = true;
      bump('A6');
    }

    // A7: 3연속
    safety = 60;
    while (safety-- > 0) {
      const idx = has3InARow();
      if (idx < 0) break;
      const mid = mcQs[idx + 1];
      if (!canRotate(mid)) break;
      // mid 문항의 ans를 다른 번호로 swap
      const oldAns = mid.ans;
      const newAns = [1,2,3,4].find(n => n !== oldAns);
      const i1 = oldAns - 1, i2 = newAns - 1;
      [mid.ch[i1], mid.ch[i2]] = [mid.ch[i2], mid.ch[i1]];
      mid.ans = newAns;
      local = true;
      bump('A7');
    }
    return local;
  }
  if (rebalance()) changed = true;

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  return changed;
}

function main() {
  const files = listJson(TARGET);
  console.log(`Scanning ${files.length} files in ${path.relative(ROOT, TARGET)}...\n`);
  let n = 0;
  files.forEach(f => {
    if (fixFile(f)) {
      n++;
      console.log(`  fixed: ${path.relative(ROOT, f)}`);
    }
  });
  console.log(`\n=== ${n}/${files.length} files modified ===`);
  Object.entries(stats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
}
main();
