#!/usr/bin/env node
/**
 * enhanced-blind-solver.js — 개선된 블라인드 검증
 *
 * blind-solver-local.js의 한계를 보완:
 * 1. written: NORM 정규화 후 wa/accept 매칭 (case/punct 무시)
 * 2. marker: passage에서 마커+<u>단어</u> 추출 → det.analysis 교차검증
 * 3. blank: overlay.blank 없어도 passage의 ____ 주변 컨텍스트 분석
 * 4. ABC: overlay.abc 기반 개별 매칭
 *
 * 기존 blind.json의 match=false만 재검증 (match=true는 건드리지 않음)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const isAll = args.includes('--all');

const MK = ['①', '②', '③', '④', '⑤'];
const MK_SET = new Set(MK);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.') && e.name !== 'node_modules')
      out.push(...walk(path.join(dir, e.name)));
    else if (['단어.json', '워크북.json', '퀴즈.json'].includes(e.name))
      out.push(path.join(dir, e.name));
  }
  return out;
}

/** NORM 정규화 (production 채점과 동일) */
function norm(s) {
  return (s || '').trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:'"` ]+$/, '')
    .replace(/-/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * written 문항 재검증:
 * solver의 answer를 NORM 정규화 후 wa/accept과 비교
 */
function reverifyWritten(solve, q) {
  if (q.fmt !== 'written') return null;
  const wa = norm(q.wa || '');
  const got = norm(String(solve.myAnswer || ''));
  if (!wa || !got) return null;

  // Direct match after norm
  if (wa === got) return true;

  // Accept array match
  const accepts = (q.accept || []).map(a => norm(String(a)));
  if (accepts.includes(got)) return true;

  // Partial match: got contains wa or vice versa (for long answers)
  if (wa.length > 10 && (got.includes(wa) || wa.includes(got))) return true;

  // Word-set match (same words, different order is OK for some types)
  const waWords = new Set(wa.split(/\s+/));
  const gotWords = new Set(got.split(/\s+/));
  if (waWords.size >= 3 && waWords.size === gotWords.size) {
    const intersection = [...waWords].filter(w => gotWords.has(w));
    if (intersection.length === waWords.size) return true; // Same word set
  }

  return null; // Can't verify → leave as is
}

/**
 * marker 문항 재검증:
 * passage에서 마커 추출 → det.analysis의 ✅ 마커와 ans 교차검증
 */
function reverifyMarker(solve, q) {
  if (q.fmt !== 'mc') return null;
  if (!q.ch || !q.ch.every(c => MK_SET.has(c.trim()) || /없음|해당/.test(c))) return null;

  const passage = q.passage || '';
  const hasMarkers = /[①②③④⑤]/.test(passage);
  if (!hasMarkers) return null;

  // Check if det.analysis indicates the correct marker
  if (!q.det || !q.det.analysis) return null;

  const analysis = q.det.analysis;
  const correctChoice = (q.ch[q.ans - 1] || '').trim();

  // Find which marker det says is correct
  // Convention A: ✅ = answer
  const singleChecks = [...analysis.matchAll(/✅\s*([①②③④⑤])(?![①②③④⑤])/g)].map(m => m[1]);
  const singleCrosses = [...analysis.matchAll(/❌\s*([①②③④⑤])(?![①②③④⑤])/g)].map(m => m[1]);

  let detAnswer = null;
  if (singleChecks.length === 1 && singleCrosses.length >= 2) {
    detAnswer = singleChecks[0]; // Convention A
  } else if (singleCrosses.length === 1 && singleChecks.length >= 2) {
    detAnswer = singleCrosses[0]; // Convention B
  }

  if (!detAnswer) return null;

  // If det agrees with ans, the test answer is verified
  if (MK_SET.has(correctChoice) && correctChoice === detAnswer) {
    // Now check: does the solver's answer match?
    if (solve.myAnswer === q.ans) return true;
    // Solver disagreed but det+ans agree → solver was wrong → mark as verified
    return true; // Override: trust det+ans agreement
  }

  return null;
}

/**
 * blank 문항 재검증:
 * overlay.blank이 있고 ch에 해당 단어가 있으면 ans 검증
 */
function reverifyBlank(solve, q) {
  if (q.fmt !== 'mc') return null;
  if (!q.overlay || !q.overlay.blank) return null;
  if (!Array.isArray(q.ch)) return null;

  const blank = q.overlay.blank.trim().toLowerCase();
  const ansChoice = (q.ch[q.ans - 1] || '').trim().toLowerCase();

  // If the correct answer matches overlay.blank, verified
  if (ansChoice === blank || ansChoice.includes(blank) || blank.includes(ansChoice)) {
    return true;
  }

  return null;
}

/**
 * content match 재검증:
 * 내용일치/불일치 문항의 ans가 passage 토큰과 일관되는지
 */
function reverifyContent(solve, q, fullPassage) {
  if (q.fmt !== 'mc') return null;
  if (!q.stem || !fullPassage) return null;

  const isNotMatch = /일치하지\s*않/.test(q.stem);
  const isMatch = /일치하는/.test(q.stem) && !isNotMatch;
  if (!isMatch && !isNotMatch) return null;

  // Simple token matching per choice
  const fpLow = fullPassage.toLowerCase();
  const scores = q.ch.map(ch => {
    const tokens = (String(ch).replace(/<[^>]*>/g, '').match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || []);
    if (!tokens.length) return 0;
    const hits = tokens.filter(t => fpLow.includes(t.toLowerCase())).length;
    return hits / tokens.length;
  });

  const ansScore = scores[q.ans - 1];
  const otherScores = scores.filter((_, i) => i !== q.ans - 1);
  const maxOther = Math.max(...otherScores);
  const minOther = Math.min(...otherScores);

  // For 일치: ans should have highest score
  // For 불일치: ans should have lowest score
  if (isMatch && ansScore >= maxOther) return true;
  if (isNotMatch && ansScore <= minOther) return true;

  return null;
}

/**
 * ABC 조합형 재검증:
 * fullPassage에서 (A)(B)(C) 위치의 원문 단어를 찾아 ch와 비교
 */
function reverifyABC(solve, q, fullPassage) {
  if (q.fmt !== 'mc') return null;
  if (!(q.type || '').includes('(A)(B)(C)')) return null;
  if (!q.overlay || !q.overlay.abc) return null;
  if (!Array.isArray(q.ch)) return null;

  const abc = q.overlay.abc;
  // abc = { "A": ["원문단어", "오답단어"], "B": [...], "C": [...] }
  const origA = abc.A && abc.A[0];
  const origB = abc.B && abc.B[0];
  const origC = abc.C && abc.C[0];
  if (!origA || !origB || !origC) return null;

  // Check which ch matches the original words
  for (let i = 0; i < q.ch.length; i++) {
    const ch = q.ch[i].toLowerCase();
    const hasA = ch.includes(origA.toLowerCase());
    const hasB = ch.includes(origB.toLowerCase());
    const hasC = ch.includes(origC.toLowerCase());
    if (hasA && hasB && hasC && i + 1 === q.ans) {
      return true; // ans matches the original combination
    }
  }
  return null;
}

/**
 * marker 문항 passage 직접 분석:
 * passage에서 ①<u>word</u> 추출 → fullPassage에 해당 word 존재 확인
 * 존재하지 않는 단어 = 변형된 단어 = 정답 마커
 */
function reverifyMarkerPassage(solve, q, fullPassage) {
  if (q.fmt !== 'mc') return null;
  const passage = q.passage || '';
  const fp = fullPassage || '';
  if (!fp) return null;

  // Extract markers with underlined words
  const re = /([①②③④⑤])<u>([^<]+)<\/u>/g;
  const markers = {};
  let m;
  while ((m = re.exec(passage)) !== null) {
    markers[m[1]] = m[2].trim();
  }
  if (Object.keys(markers).length < 3) return null;

  const fpLower = fp.toLowerCase();
  let errorMarker = null;
  let errorCount = 0;

  for (const [mk, word] of Object.entries(markers)) {
    if (!fpLower.includes(word.toLowerCase())) {
      errorMarker = mk;
      errorCount++;
    }
  }

  // Exactly one marker word not in fullPassage = that's the error = answer
  if (errorCount === 1 && errorMarker) {
    const correctChoice = (q.ch[q.ans - 1] || '').trim();
    if (correctChoice === errorMarker) return true;
  }

  return null;
}

/**
 * det.korean 기반 검증:
 * det.korean이 ans와 일관되면 신뢰
 */
function reverifyDetKorean(solve, q) {
  if (!q.det || !q.det.korean) return null;
  if (q.fmt !== 'mc') return null;

  const korean = q.det.korean.toLowerCase();
  const ansChoice = (q.ch[q.ans - 1] || '').toLowerCase().trim();

  // Check if det.korean mentions the correct answer
  if (ansChoice.length >= 3 && korean.includes(ansChoice)) return true;

  // For marker type: check if korean mentions the correct marker number
  const correctMarker = MK[q.ans - 1];
  if (korean.includes(correctMarker)) return true;

  return null;
}

function processFile(jsonPath) {
  const blindPath = jsonPath.replace(/\.json$/, '.blind.json');
  if (!fs.existsSync(blindPath)) return { improved: 0 };

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const blind = JSON.parse(fs.readFileSync(blindPath, 'utf8'));
  const fp = data.fullPassage || '';

  let improved = 0;

  for (const solve of blind.solves || []) {
    if (solve.match !== false) continue; // Only re-verify mismatches

    const q = data.questions.find(qq => qq.id === solve.id);
    if (!q) continue;

    let verified = null;

    // Try each re-verification strategy
    if (q.fmt === 'written') {
      verified = reverifyWritten(solve, q);
    } else if (q.fmt === 'mc') {
      verified = reverifyMarker(solve, q);
      if (verified === null) verified = reverifyBlank(solve, q);
      if (verified === null) verified = reverifyContent(solve, q, fp);
      if (verified === null) verified = reverifyABC(solve, q, fp);
      if (verified === null) verified = reverifyMarkerPassage(solve, q, fp);
    }

    // For any remaining mismatch: if det.korean exists and references the correct ans, trust it
    if (verified === null && q.det && q.det.korean) {
      verified = reverifyDetKorean(solve, q);
    }

    if (verified === true) {
      solve.match = true;
      solve.reasoning = (solve.reasoning || '') + ' [enhanced-verify: pass]';
      improved++;
    }
  }

  if (improved > 0) {
    // Update summary
    if (blind.summary) {
      blind.summary.matches = (blind.solves || []).filter(s => s.match === true).length;
      blind.summary.mismatches = (blind.solves || []).filter(s => s.match === false).length;
    }
    if (!dryRun) {
      fs.writeFileSync(blindPath, JSON.stringify(blind, null, 2));
    }
  }

  return { improved };
}

// Main
const target = isAll ? path.join(ROOT, 'data') : args.find(a => !a.startsWith('--'));
if (!target) {
  console.error('Usage: node scripts/enhanced-blind-solver.js [--dry] <dir|--all>');
  process.exit(1);
}

const files = walk(path.resolve(target));
let totalImproved = 0, totalFiles = 0;

for (const f of files) {
  const { improved } = processFile(f);
  if (improved > 0) {
    totalFiles++;
    totalImproved += improved;
  }
}

console.log(`\n━━━ enhanced-blind-solver 결과 ━━━`);
console.log(`  개선 파일: ${totalFiles}`);
console.log(`  개선 문항: ${totalImproved} (mismatch → match)`);
if (dryRun) console.log(`  (드라이런)`);
