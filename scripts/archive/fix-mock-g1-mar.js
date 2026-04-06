#!/usr/bin/env node
/**
 * fix-mock-g1-mar.js
 * 고1 3월 모의고사 (2024+2025) 일괄 자동수정
 *
 * 수정 대상:
 * 1. A6/A7: 정답 편중/3연속 → 선지 스왑
 * 2. V74: 어형변환 passage 너무 길음 → 2~4문장으로 축소
 * 3. P-UL4: 어법/부적절 마커 ①②③④ 부족 → 기존 마커가 2개면 4개로 확장
 * 4. V66: 빈칸형 passage 짧음 → fullPassage에서 확장
 * 5. accept 변형 추가 (소문자/마침표)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  path.join(ROOT, 'data/모의고사/고1/3월'),
  path.join(ROOT, 'data/모의고사/고1/3월_2024'),
];

let totalFixed = 0;
let fileCount = 0;
const stats = { a6a7: 0, v74: 0, pul4: 0, v66: 0, accept: 0 };

function collectFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectFiles(full).forEach(f => files.push(f));
    else if (e.name.endsWith('.json')) files.push(full);
  }
  return files;
}

// ── A6/A7 Fix: 선지 스왑 ──
function fixA6A7(data) {
  const mcQs = data.questions.filter(q => q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 4);
  if (mcQs.length < 3) return 0;

  let fixes = 0;
  const maxIter = 20;

  for (let iter = 0; iter < maxIter; iter++) {
    // Check A6
    const dist = {};
    mcQs.forEach(q => { dist[q.ans] = (dist[q.ans] || 0) + 1; });
    const a6Violations = Object.entries(dist).filter(([, c]) => c > 5);

    // Check A7
    let a7Found = false;
    for (let i = 0; i < mcQs.length - 2; i++) {
      if (mcQs[i].ans === mcQs[i+1].ans && mcQs[i+1].ans === mcQs[i+2].ans) {
        a7Found = true;
        break;
      }
    }

    if (a6Violations.length === 0 && !a7Found) break;

    // Fix: rotate one question's choices
    // Find the overrepresented answer and a question to rotate
    const overAns = a6Violations.length > 0 ? parseInt(a6Violations[0][0]) : null;

    // Find best candidate to rotate
    for (let i = mcQs.length - 1; i >= 0; i--) {
      const q = mcQs[i];
      if (overAns && q.ans !== overAns) continue;

      // Check if rotating this one helps A7
      if (!overAns) {
        // Find the 3-consecutive position
        let found = false;
        for (let j = 0; j < mcQs.length - 2; j++) {
          if (mcQs[j].ans === mcQs[j+1].ans && mcQs[j+1].ans === mcQs[j+2].ans) {
            // Rotate the middle one
            const midQ = mcQs[j+1];
            const currentAns = midQ.ans;
            // Find a new position
            for (let newPos = 1; newPos <= 4; newPos++) {
              if (newPos === currentAns) continue;
              // Check it doesn't create new A7
              const prev = j > 0 ? mcQs[j].ans : -1;
              const next = j + 2 < mcQs.length ? mcQs[j+2].ans : -1;
              if (newPos === prev && prev === (j > 1 ? mcQs[j-1].ans : -1)) continue;
              if (newPos === next && next === (j + 3 < mcQs.length ? mcQs[j+3].ans : -1)) continue;

              rotateQuestion(midQ, newPos);
              fixes++;
              found = true;
              break;
            }
            if (found) break;
          }
        }
        if (found) continue;
      }

      // Find least-used answer
      const minAns = [1,2,3,4].reduce((a, b) => (dist[a]||0) <= (dist[b]||0) ? a : b);
      if (minAns !== q.ans) {
        rotateQuestion(q, minAns);
        fixes++;
        break;
      }
    }
  }

  return fixes;
}

function rotateQuestion(q, targetAns) {
  if (q.ans === targetAns || !Array.isArray(q.ch) || q.ch.length !== 4) return;
  const correctIdx = q.ans - 1; // 1-indexed to 0-indexed
  const targetIdx = targetAns - 1;
  // Swap correct answer to target position
  const temp = q.ch[targetIdx];
  q.ch[targetIdx] = q.ch[correctIdx];
  q.ch[correctIdx] = temp;
  q.ans = targetAns;
}

// ── V74 Fix: 어형변환 passage 축소 ──
function fixV74(data) {
  let fixes = 0;
  data.questions.forEach(q => {
    const t = (q.type || '').trim();
    if (!['어형 변환 (서술형)', '어형 변환', '어형변화', '어형변형'].includes(t)) return;
    if (!q.passage) return;

    const sentences = q.passage.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    if (sentences.length <= 4) return;

    // Find the sentence with __________ (the blank)
    const blankIdx = sentences.findIndex(s => s.includes('____'));
    if (blankIdx === -1) return;

    // Keep blank sentence + 1 before + 1 after (2~3 sentences)
    const start = Math.max(0, blankIdx - 1);
    const end = Math.min(sentences.length, blankIdx + 2);
    q.passage = sentences.slice(start, end).join(' ');
    fixes++;
  });
  return fixes;
}

// ── P-UL4 Fix: 마커 추가 (2개→4개) ──
function fixPUL4(data) {
  let fixes = 0;
  data.questions.forEach(q => {
    const t = (q.type || '').trim();
    if (!['어법', '문맥상 부적절한 어휘', '부적절어휘', '부적절'].includes(t)) return;
    if (q.fmt !== 'mc' || !q.passage) return;

    const markerCount = (q.passage.match(/①|②|③|④/g) || []).length;
    if (markerCount >= 4 || markerCount === 0) return; // 0개는 전면 재작성 필요, 스킵

    // 2개 마커가 있는 경우: <u> 태그로 된 것을 마커로 변환
    if (markerCount === 2) {
      // Find existing markers
      const existingMarkers = new Set();
      for (const m of ['①','②','③','④']) {
        if (q.passage.includes(m)) existingMarkers.add(m);
      }

      // Find <u> tags without markers
      const uMatches = q.passage.match(/<u>[^<]+<\/u>/g) || [];
      const unmatchedUs = uMatches.filter(u => {
        const before20 = q.passage.substring(Math.max(0, q.passage.indexOf(u) - 3), q.passage.indexOf(u));
        return !before20.match(/[①②③④]/);
      });

      // Add missing markers
      const allMarkers = ['①','②','③','④'];
      const missingMarkers = allMarkers.filter(m => !existingMarkers.has(m));

      let added = 0;
      for (let i = 0; i < unmatchedUs.length && added < missingMarkers.length; i++) {
        const u = unmatchedUs[i];
        const idx = q.passage.indexOf(u);
        if (idx === -1) continue;
        q.passage = q.passage.substring(0, idx) + missingMarkers[added] + q.passage.substring(idx);
        added++;
        fixes++;
      }
    }
  });
  return fixes;
}

// ── V66 Fix: 빈칸형 passage 확장 ──
function fixV66(data) {
  let fixes = 0;
  const fp = data.fullPassage || '';
  if (!fp) return 0;

  data.questions.forEach(q => {
    const t = (q.type || '').trim();
    if (!['빈칸 어휘 완성','빈칸 문맥 완성','빈칸추론','빈칸 추론'].includes(t)) return;
    if (!q.passage) return;

    const sentences = q.passage.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    if (sentences.length >= 5) return;

    // Try to use fullPassage instead (preserving the blank)
    if (fp.length > q.passage.replace(/_+/g, '').length * 1.5) {
      // Find the blank word by looking at what's missing
      const blankSentence = sentences.find(s => s.includes('____'));
      if (blankSentence) {
        const fpSentences = fp.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        if (fpSentences.length >= 5) {
          // Find which sentence the blank belongs to
          const cleanBlank = blankSentence.replace(/_{2,}/g, '').trim().substring(0, 30);
          let matchIdx = fpSentences.findIndex(s => {
            const clean = s.trim().substring(0, 30);
            // Fuzzy match
            return clean.includes(cleanBlank.substring(0, 15)) || cleanBlank.includes(clean.substring(0, 15));
          });

          if (matchIdx >= 0) {
            // Take 5 sentences centered around the match, replace the matched one with blank version
            const start = Math.max(0, matchIdx - 2);
            const end = Math.min(fpSentences.length, start + 5);
            const newPassage = fpSentences.slice(start, end).map((s, i) => {
              if (start + i === matchIdx) return blankSentence;
              return s;
            }).join(' ');
            q.passage = newPassage;
            fixes++;
          }
        }
      }
    }
  });
  return fixes;
}

// ── Accept 변형 추가 ──
function fixAccept(data) {
  let fixes = 0;
  data.questions.forEach(q => {
    if (q.fmt !== 'written' || !q.wa || !Array.isArray(q.accept)) return;

    const wa = q.wa.trim();
    const existing = new Set(q.accept.map(a => a.trim()));

    // 소문자 변형
    const lower = wa.toLowerCase();
    if (!existing.has(lower) && lower !== wa) {
      q.accept.push(lower);
      fixes++;
    }

    // 마침표 변형
    if (!wa.endsWith('.') && wa.length > 5) {
      const withDot = wa + '.';
      if (!existing.has(withDot)) {
        q.accept.push(withDot);
        fixes++;
      }
    }
    if (wa.endsWith('.')) {
      const noDot = wa.slice(0, -1).trim();
      if (!existing.has(noDot)) {
        q.accept.push(noDot);
        fixes++;
      }
    }
  });
  return fixes;
}

// ── Main ──
for (const dir of TARGETS) {
  if (!fs.existsSync(dir)) { console.log(`⚠️ ${dir} 없음`); continue; }

  const files = collectFiles(dir);
  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.questions || !Array.isArray(data.questions)) continue;

      let fileFixes = 0;

      fileFixes += fixA6A7(data); stats.a6a7 += fileFixes;
      const v74 = fixV74(data); fileFixes += v74; stats.v74 += v74;
      const pul4 = fixPUL4(data); fileFixes += pul4; stats.pul4 += pul4;
      const v66 = fixV66(data); fileFixes += v66; stats.v66 += v66;
      const acc = fixAccept(data); fileFixes += acc; stats.accept += acc;

      if (fileFixes > 0) {
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        totalFixed += fileFixes;
        fileCount++;
      }
    } catch (e) {
      console.error(`❌ ${path.relative(ROOT, file)}: ${e.message}`);
    }
  }
}

console.log(`\n✅ 자동수정 완료`);
console.log(`  수정 파일: ${fileCount}개`);
console.log(`  총 수정: ${totalFixed}건`);
console.log(`  - A6/A7 (정답분포): ${stats.a6a7}건`);
console.log(`  - V74 (어형변환 passage 축소): ${stats.v74}건`);
console.log(`  - P-UL4 (마커 추가): ${stats.pul4}건`);
console.log(`  - V66 (빈칸 passage 확장): ${stats.v66}건`);
console.log(`  - Accept 변형: ${stats.accept}건`);
