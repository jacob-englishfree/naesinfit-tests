#!/usr/bin/env node
/**
 * fix-d3-d6-d7.js — D6(어법 마커), D3(정답 분포), D7(정답 노출) 일괄 수정
 *
 * Usage:
 *   node scripts/fix-d3-d6-d7.js --batch4 /tmp/recreate_batch_4.txt
 *   node scripts/fix-d3-d6-d7.js --partial /tmp/partial_fix.txt
 *   node scripts/fix-d3-d6-d7.js --all /tmp/recreate_batch_4.txt /tmp/partial_fix.txt
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ───────────────────── Helpers ─────────────────────

function readFileList(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split('\n')
    .map(line => line.replace(/^\s*\d+[→→]\s*/, '').trim())
    .filter(l => l && l.endsWith('.json'));
}

function loadJson(relPath) {
  const full = path.join(ROOT, relPath);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function saveJson(relPath, data) {
  const full = path.join(ROOT, relPath);
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ───────────────────── D6: 어법 마커 추가 ─────────────────────

/**
 * 어법 문항의 passage 마커 수정.
 *
 * Case A: 부분 마커 (①②③ 있는데 ④ 누락 등)
 *   → 잘못 삽입된 마커를 전부 제거하고, fullPassage 기반으로
 *     정답 위치에 빈칸(__________) 삽입하는 깨끗한 빈칸형으로 전환.
 *
 * Case B: 빈칸형인데 마커 없음 → 정상 (수정 불필요)
 *
 * Case C: ch=["①","②","③","④"] 밑줄 찾기인데 passage 마커 누락
 *   → fullPassage에서 단어를 찾아 마커 추가 시도
 */
function fixD6(data) {
  const fp = data.fullPassage || '';
  let fixes = 0;

  data.questions.forEach(q => {
    if (q.type !== '어법' || q.fmt !== 'mc' || !Array.isArray(q.ch) || q.ch.length !== 4) return;

    const passage = q.passage || '';
    const markers = ['①', '②', '③', '④'];
    const presentMarkers = markers.filter(m => passage.includes(m));
    const isCircledChoice = q.ch.every(c => /^[①②③④⑤]$/.test(c));

    // Case C: ch=["①","②","③","④"] 밑줄 찾기 유형
    if (isCircledChoice) {
      if (presentMarkers.length === 4) return; // 정상
      // TODO: fullPassage에서 단어 찾아서 마커 추가 — 원문 분석 필요하므로 스킵
      return;
    }

    // Case B: 마커 0개 + 빈칸 있음 → 정상 빈칸형
    if (presentMarkers.length === 0 && (passage.includes('____') || passage.includes('__________'))) {
      return; // 정상
    }

    // Case B-2: 마커 0개 + 빈칸 없음 → fullPassage에서 정답 위치 찾아 빈칸 삽입
    if (presentMarkers.length === 0 && !passage.includes('____')) {
      const ansWord = q.ch[q.ans];
      if (!ansWord || ansWord.length < 2) return;

      // passage에서 정답 단어 찾기
      const escaped = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`);
      let newPassage = passage;
      if (regex.test(newPassage)) {
        newPassage = newPassage.replace(regex, '__________');
        q.passage = newPassage;
        fixes++;
      } else if (fp) {
        // fullPassage에서 정답 위치 찾아서 passage 교체
        let fpCopy = fp;
        if (regex.test(fpCopy)) {
          fpCopy = fpCopy.replace(regex, '__________');
          q.passage = fpCopy;
          fixes++;
        }
      }
      return;
    }

    // Case A: 부분 마커 (1~3개) — 깨끗한 빈칸형으로 전환
    if (presentMarkers.length > 0 && presentMarkers.length < 4) {
      const ansWord = q.ch[q.ans];
      if (!ansWord || ansWord.length < 2) return;

      // 기존 마커를 전부 제거 — ①<u>word</u> 패턴 → word 복원
      let cleaned = passage;
      for (const m of markers) {
        // ①<u>word</u> 패턴 제거 → word만 남기기
        const markerRegex = new RegExp(`${m}<u>([^<]*)<\\/u>`, 'g');
        cleaned = cleaned.replace(markerRegex, '$1');
        // 단독 마커도 제거
        cleaned = cleaned.replace(new RegExp(m, 'g'), '');
      }

      // 정답 단어를 빈칸으로 교체
      const escaped = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ansRegex = new RegExp(`\\b${escaped}\\b`);

      if (ansRegex.test(cleaned)) {
        cleaned = cleaned.replace(ansRegex, '__________');
        q.passage = cleaned;
        // stem을 빈칸형으로 변경
        if (q.stem && !q.stem.includes('빈칸')) {
          q.stem = '다음 빈칸에 들어갈 말로 가장 적절한 것은?';
        }
        fixes++;
      } else if (fp) {
        // fullPassage 기반으로 빈칸 삽입
        let fpCopy = fp;
        if (ansRegex.test(fpCopy)) {
          fpCopy = fpCopy.replace(ansRegex, '__________');
          q.passage = fpCopy;
          if (q.stem && !q.stem.includes('빈칸')) {
            q.stem = '다음 빈칸에 들어갈 말로 가장 적절한 것은?';
          }
          fixes++;
        } else {
          console.log(`  [SKIP-D6] Q${q.id}: 정답 "${ansWord}"를 passage/fullPassage에서 찾을 수 없음`);
        }
      }
      return;
    }

    // 마커 4개 모두 있음 → 정상
  });

  return fixes;
}

// ───────────────────── D3: 정답 분포 셔플 ─────────────────────

/**
 * MC 문항의 선지를 셔플하여:
 * 1. 같은 ans가 6개 이상 안 되도록
 * 2. 3연속 같은 ans 없도록
 * 정답 텍스트는 유지, 위치(ans 인덱스)만 변경
 */
function fixD3(data) {
  const questions = data.questions;
  const mcQuestions = questions.filter(q => q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length >= 2);

  if (mcQuestions.length < 5) return 0;

  // 셔플 가능한 문항만 (①②③④ 선지, 번호 포함 선지 제외)
  const shuffleable = mcQuestions.filter(q => {
    if (q.ch.every(c => /^[①②③④⑤]$/.test(c))) return false;
    if (q.ch.some(c => /^[①②③④⑤]\s/.test(c))) return false;
    if (q.ch.length < 3) return false; // T/F는 셔플 무의미
    return true;
  });

  if (shuffleable.length === 0) return 0;

  function getDistribution() {
    const dist = {};
    mcQuestions.forEach(q => { dist[q.ans] = (dist[q.ans] || 0) + 1; });
    return dist;
  }

  function has3Consecutive() {
    for (let i = 0; i < mcQuestions.length - 2; i++) {
      if (mcQuestions[i].ans === mcQuestions[i + 1].ans && mcQuestions[i + 1].ans === mcQuestions[i + 2].ans) {
        return true;
      }
    }
    return false;
  }

  function hasOver6() {
    const dist = getDistribution();
    return Object.values(dist).some(v => v >= 6);
  }

  if (!has3Consecutive() && !hasOver6()) return 0;

  function shuffleOne(q) {
    const correctText = q.ch[q.ans];
    const shuffled = [...q.ch];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    q.ch = shuffled;
    q.ans = shuffled.indexOf(correctText);
  }

  // Check if 3-consecutive is solvable (at least 1 of the 3 must be shuffleable)
  let unsolvable3 = false;
  for (let i = 0; i < mcQuestions.length - 2; i++) {
    if (mcQuestions[i].ans === mcQuestions[i + 1].ans && mcQuestions[i + 1].ans === mcQuestions[i + 2].ans) {
      const anyShuffleable = [mcQuestions[i], mcQuestions[i + 1], mcQuestions[i + 2]].some(q => shuffleable.includes(q));
      if (!anyShuffleable) {
        unsolvable3 = true;
      }
    }
  }

  if (unsolvable3) {
    // 3연속이 비셔플 문항이라 해결 불가 — 셔플 가능한 것만 over6 해소
    if (hasOver6() && shuffleable.length > 0) {
      for (let attempt = 0; attempt < 200; attempt++) {
        for (const q of shuffleable) shuffleOne(q);
        if (!hasOver6()) break;
      }
    }
    console.log(`  [WARN-D3] 3연속 해결 불가 (비셔플 문항) — 수동 수정 필요`);
  } else {
    // Constraint-based: assign desired ans to each shuffleable question
    // to avoid 3-consecutive and over6
    const numChoices = 4;

    // Build sequence of mc question indices and which are shuffleable
    const seqLen = mcQuestions.length;
    const isShuffleable = mcQuestions.map(q => shuffleable.includes(q));
    const fixedAns = mcQuestions.map(q => q.ans); // current answers

    // Try random assignments for shuffleable positions
    let bestScore = Infinity;
    let bestAssignment = null;
    const maxAttempts = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Assign random answers to shuffleable positions
      const assignment = fixedAns.slice();
      for (let i = 0; i < seqLen; i++) {
        if (isShuffleable[i]) {
          assignment[i] = Math.floor(Math.random() * numChoices);
        }
      }

      // Score: count violations
      let score = 0;
      // 3-consecutive
      for (let i = 0; i < seqLen - 2; i++) {
        if (assignment[i] === assignment[i + 1] && assignment[i + 1] === assignment[i + 2]) score += 10;
      }
      // over6
      const dist = {};
      assignment.forEach(a => { dist[a] = (dist[a] || 0) + 1; });
      for (const v of Object.values(dist)) {
        if (v >= 6) score += (v - 5) * 5;
      }

      if (score < bestScore) {
        bestScore = score;
        bestAssignment = assignment;
        if (score === 0) break;
      }
    }

    if (bestAssignment && bestScore < Infinity) {
      // Apply best assignment: for each shuffleable, rearrange choices so ans = desired
      for (let i = 0; i < seqLen; i++) {
        if (!isShuffleable[i]) continue;
        const q = mcQuestions[i];
        const desiredAns = bestAssignment[i];
        if (q.ans === desiredAns) continue;

        const correctText = q.ch[q.ans];
        // Swap the correct answer to the desired position
        const temp = q.ch[desiredAns];
        q.ch[desiredAns] = correctText;
        q.ch[q.ans] = temp;
        q.ans = desiredAns;
      }
    }

    if (has3Consecutive() || hasOver6()) {
      console.log(`  [WARN-D3] 분포 문제 남아있음 (bestScore=${bestScore})`);
    }
  }

  return 1;
}

// ───────────────────── D7: 정답 노출 수정 ─────────────────────

/**
 * 빈칸형 문항에서 정답이 passage에 보이면 ____로 교체
 * 서술형에서 wa가 passage에 보이면 ____로 교체
 */
function fixD7(data) {
  let fixes = 0;

  data.questions.forEach(q => {
    if (!q.passage) return;
    const type = (q.type || '').trim();

    // 빈칸형 MC: 정답 단어가 passage의 빈칸 외 다른 곳에 노출
    if (q.fmt === 'mc' && Array.isArray(q.ch) && q.passage.includes('____')) {
      const answer = q.ch[q.ans];
      if (!answer || answer.length < 2) return;

      // 빈칸 위치 외에 정답이 있는지 확인
      const passageWithoutBlanks = q.passage.replace(/_{4,}/g, '');
      if (passageWithoutBlanks.includes(answer)) {
        // 정답을 ____로 교체 (빈칸 외 위치)
        // 먼저 기존 빈칸을 임시 플레이스홀더로
        let temp = q.passage.replace(/_{4,}/g, '__BLANK__');
        // 정답 단어를 ____로 교체 (모든 등장)
        const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        temp = temp.replace(new RegExp(`\\b${escaped}\\b`, 'g'), '____');
        // 플레이스홀더 복원
        q.passage = temp.replace(/__BLANK__/g, '____');
        fixes++;
      }
    }

    // 서술형: wa가 passage에 노출
    if (q.fmt === 'written' && q.wa) {
      // 어형변환, 한영, 내용이해는 정답 노출이 정상인 경우 있음 — 스킵
      if (['어형 변환', '어형 변환 (서술형)', '한영', '내용이해', '내용이해 (서술형)'].includes(type)) return;
      // 어순배열은 별도 처리
      if (type === '어순배열' || type === '어순배열 (서술형)') return;

      const wa = q.wa.trim();
      if (wa.length < 2) return;

      if (q.passage.includes(wa)) {
        const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        q.passage = q.passage.replace(new RegExp(escaped, 'g'), '____');
        fixes++;
      }
    }
  });

  return fixes;
}

// ───────────────────── D5: passage 짧음 → fullPassage 교체 ─────────────────────

function fixD5(data) {
  const fp = data.fullPassage || '';
  if (!fp || fp.length < 50) return 0;
  let fixes = 0;

  data.questions.forEach(q => {
    if (!q.passage) return;
    const type = (q.type || '').trim();
    // 영작 서술형은 passage 비워야 하므로 제외
    if (q.fmt === 'written' && (q.stem || '').includes('영작')) return;

    const plainLen = q.passage.replace(/<[^>]+>/g, '').trim().length;
    // 50자 미만이면 짧음
    if (plainLen < 50 && fp.length > plainLen * 2) {
      // 마커가 있는 경우 보존해야 함 — 스킵
      if (q.passage.includes('①') || q.passage.includes('②')) return;
      // 빈칸이 있으면 fullPassage에 빈칸 없으므로 교체 불가 — 스킵
      if (q.passage.includes('____')) return;

      q.passage = fp;
      fixes++;
    }
  });

  return fixes;
}

// ───────────────────── Main ─────────────────────

function processFile(relPath, fixTypes) {
  const data = loadJson(relPath);
  if (!data.questions || !Array.isArray(data.questions)) {
    console.log(`  [SKIP] ${relPath}: questions 배열 없음`);
    return false;
  }

  let totalFixes = 0;
  const fixLog = [];

  if (fixTypes.includes('D6')) {
    const n = fixD6(data);
    if (n > 0) fixLog.push(`D6:${n}`);
    totalFixes += n;
  }

  if (fixTypes.includes('D3')) {
    const n = fixD3(data);
    if (n > 0) fixLog.push(`D3:${n}`);
    totalFixes += n;
  }

  if (fixTypes.includes('D7')) {
    const n = fixD7(data);
    if (n > 0) fixLog.push(`D7:${n}`);
    totalFixes += n;
  }

  if (fixTypes.includes('D5')) {
    const n = fixD5(data);
    if (n > 0) fixLog.push(`D5:${n}`);
    totalFixes += n;
  }

  if (totalFixes > 0) {
    saveJson(relPath, data);
    console.log(`  [FIXED] ${relPath} — ${fixLog.join(', ')}`);
    return true;
  } else {
    console.log(`  [OK] ${relPath} — 수정 불필요`);
    return false;
  }
}

// ───────────────────── CLI ─────────────────────

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  node scripts/fix-d3-d6-d7.js --batch4 /tmp/recreate_batch_4.txt');
  console.log('  node scripts/fix-d3-d6-d7.js --partial /tmp/partial_fix.txt');
  console.log('  node scripts/fix-d3-d6-d7.js --all /tmp/recreate_batch_4.txt /tmp/partial_fix.txt');
  process.exit(0);
}

const mode = args[0];

if (mode === '--batch4') {
  // D6 어법 마커 + D3 + D7
  const files = readFileList(args[1]);
  console.log(`\n=== Batch 4: ${files.length}개 파일 (D6 어법 마커 + D3 + D7) ===\n`);
  let fixed = 0;
  files.forEach(f => {
    if (processFile(f, ['D6', 'D3', 'D7'])) fixed++;
  });
  console.log(`\n완료: ${fixed}/${files.length} 파일 수정됨`);
} else if (mode === '--partial') {
  // D3 + D7 only
  const files = readFileList(args[1]);
  console.log(`\n=== Partial Fix: ${files.length}개 파일 (D3 + D7) ===\n`);
  let fixed = 0;
  files.forEach(f => {
    if (processFile(f, ['D3', 'D7'])) fixed++;
  });
  console.log(`\n완료: ${fixed}/${files.length} 파일 수정됨`);
} else if (mode === '--all') {
  // batch4 = D6+D3+D7, partial = D3+D7
  const batch4Files = readFileList(args[1]);
  const partialFiles = readFileList(args[2]);

  console.log(`\n=== Batch 4: ${batch4Files.length}개 파일 (D6 + D3 + D7) ===\n`);
  let fixed1 = 0;
  batch4Files.forEach(f => {
    if (processFile(f, ['D6', 'D3', 'D7'])) fixed1++;
  });

  console.log(`\n=== Partial Fix: ${partialFiles.length}개 파일 (D3 + D7) ===\n`);
  let fixed2 = 0;
  partialFiles.forEach(f => {
    if (processFile(f, ['D3', 'D7'])) fixed2++;
  });

  console.log(`\n총 완료: batch4 ${fixed1}/${batch4Files.length}, partial ${fixed2}/${partialFiles.length}`);
} else {
  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}
