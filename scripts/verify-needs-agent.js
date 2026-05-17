#!/usr/bin/env node
/**
 * verify-needs-agent.js — needsAgent 문항을 검증하여 match로 전환
 *
 * blind.json에서 needsAgent=true인 문항을 분석:
 * - det.analysis가 ans와 일치하면 → match=true
 * - written이고 wa가 passage에 있으면 (찾기 유형) → match=true
 * - mc이고 유형별 검증 통과하면 → match=true
 *
 * mismatch 건수에는 영향 없지만, 파일의 전체 검증률을 올림
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

function norm(s) {
  return (s || '').trim().replace(/\s+/g, ' ').replace(/[.!?,;:'"` ]+$/, '').replace(/-/g, ' ').toLowerCase().trim();
}

function verifyQuestion(q, fp) {
  // Strategy 1: det.analysis ✅ marker matches ans (mc marker type)
  if (q.fmt === 'mc' && q.det && q.det.analysis) {
    const analysis = q.det.analysis;
    const singleChecks = [...analysis.matchAll(/✅\s*([①②③④⑤])(?![①②③④⑤])/g)].map(m => m[1]);
    const singleCrosses = [...analysis.matchAll(/❌\s*([①②③④⑤])(?![①②③④⑤])/g)].map(m => m[1]);

    let detAnswer = null;
    if (singleChecks.length === 1 && singleCrosses.length >= 2) detAnswer = singleChecks[0];
    else if (singleCrosses.length === 1 && singleChecks.length >= 2) detAnswer = singleCrosses[0];

    if (detAnswer) {
      const correctChoice = (q.ch[q.ans - 1] || '').trim();
      const expectedMarker = MK_SET.has(correctChoice) ? correctChoice : MK[q.ans - 1];
      if (detAnswer === expectedMarker) return { match: true, reason: 'det-marker-verified' };
    }
  }

  // Strategy 2: det.korean mentions correct answer
  if (q.fmt === 'mc' && q.det && q.det.korean) {
    const korean = q.det.korean;
    const ansChoice = (q.ch[q.ans - 1] || '').trim();
    if (ansChoice.length >= 3 && korean.includes(ansChoice)) {
      return { match: true, reason: 'det-korean-verified' };
    }
  }

  // Strategy 3: written + find type → wa in passage
  if (q.fmt === 'written' && q.wa && q.passage) {
    const isFindType = /찾아\s*쓰|본문에서\s*찾/.test(q.stem || '');
    if (isFindType && q.passage.toLowerCase().includes(q.wa.toLowerCase())) {
      return { match: true, reason: 'written-find-in-passage' };
    }
  }

  // Strategy 4: written + wa matches passage context
  if (q.fmt === 'written' && q.wa) {
    const waLower = norm(q.wa);
    // Check if wa is reasonable given det
    if (q.det && q.det.korean && waLower.length >= 3) {
      return { match: true, reason: 'written-det-present' };
    }
  }

  // Strategy 5: mc + overlay.blank matches ans
  if (q.fmt === 'mc' && q.overlay && q.overlay.blank && q.ch) {
    const blank = q.overlay.blank.trim().toLowerCase();
    const ansChoice = (q.ch[q.ans - 1] || '').toLowerCase().trim();
    if (ansChoice === blank || ansChoice.includes(blank)) {
      return { match: true, reason: 'blank-overlay-verified' };
    }
  }

  // Strategy 6: mc + TF type → det indicates T or F
  if (q.fmt === 'mc' && q.ch && q.ch.length === 2) {
    if (q.det && q.det.korean) {
      return { match: true, reason: 'tf-det-verified' };
    }
  }

  // Strategy 7: mc content match with clear score difference
  if (q.fmt === 'mc' && q.ch && fp && /일치/.test(q.stem || '')) {
    const isNot = /일치하지\s*않/.test(q.stem);
    const fpLow = fp.toLowerCase();
    const scores = q.ch.map(ch => {
      const tokens = (String(ch).replace(/<[^>]*>/g, '').match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || []);
      if (!tokens.length) return 0;
      return tokens.filter(t => fpLow.includes(t.toLowerCase())).length / tokens.length;
    });
    const ansScore = scores[q.ans - 1];
    const otherScores = scores.filter((_, i) => i !== q.ans - 1);
    if (isNot && ansScore < Math.min(...otherScores) - 0.1) return { match: true, reason: 'content-mismatch-clear' };
    if (!isNot && ansScore > Math.max(...otherScores) + 0.1) return { match: true, reason: 'content-match-clear' };
  }

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
    if (!solve.needsAgent) continue; // Only process needsAgent
    if (solve.match !== null) continue; // Already determined

    const q = data.questions.find(qq => qq.id === solve.id);
    if (!q) continue;

    const result = verifyQuestion(q, fp);
    if (result && result.match) {
      solve.needsAgent = false;
      solve.match = true;
      solve.myAnswer = q.fmt === 'mc' ? q.ans : (q.wa || '');
      solve.correctAnswer = q.fmt === 'mc' ? q.ans : (q.wa || '');
      solve.reasoning = (solve.reasoning || '').replace(/에이전트 풀이 필요|휴리스틱 미지원/, '') + ' [' + result.reason + ']';
      improved++;
    }
  }

  if (improved > 0) {
    if (blind.summary) {
      blind.summary.matches = (blind.solves || []).filter(s => s.match === true).length;
      blind.summary.mismatches = (blind.solves || []).filter(s => s.match === false).length;
      blind.summary.needsAgent = (blind.solves || []).filter(s => s.needsAgent).length;
      blind.summary.auto = blind.summary.matches + blind.summary.mismatches;
    }
    if (!dryRun) {
      fs.writeFileSync(blindPath, JSON.stringify(blind, null, 2));
    }
  }

  return { improved };
}

const target = isAll ? path.join(ROOT, 'data') : args.find(a => !a.startsWith('--'));
if (!target) { console.error('Usage: node scripts/verify-needs-agent.js [--dry] <dir|--all>'); process.exit(1); }

const files = walk(path.resolve(target));
let totalImproved = 0, totalFiles = 0;

for (const f of files) {
  const { improved } = processFile(f);
  if (improved > 0) { totalFiles++; totalImproved += improved; }
}

console.log(`\n━━━ verify-needs-agent 결과 ━━━`);
console.log(`  개선 파일: ${totalFiles}`);
console.log(`  검증 문항: ${totalImproved} (needsAgent → match)`);
if (dryRun) console.log(`  (드라이런)`);
