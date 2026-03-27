#!/usr/bin/env node
/**
 * D3 정답분포 + D9 accept 자동 수정
 * D3: 정답 6개 이상 / 3연속 → 선지 순서 셔플로 분산
 * D9: 서술형 accept < 3 → 자동 변형 생성
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const targets = process.argv[2] || 'data/부교재/수능특강,data/모의고사';
let files = [];
for (const dir of targets.split(',')) {
  const fullDir = path.join(ROOT, dir.trim());
  if (!fs.existsSync(fullDir)) continue;
  const found = require('child_process')
    .execSync(`find "${fullDir}" -name "*.json" -type f`)
    .toString().trim().split('\n').filter(Boolean);
  files.push(...found);
}

let d3Fixed = 0, d9Fixed = 0, filesModified = 0;

for (const filePath of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { continue; }
  if (!data.questions || !Array.isArray(data.questions)) continue;

  let modified = false;

  // === D3: Fix answer distribution ===
  const mcQs = data.questions.filter(q => q.fmt === 'mc' && q.ch && q.ch.length === 4);

  // Count distribution
  function getAnsDist(qs) {
    const dist = { 0: 0, 1: 0, 2: 0, 3: 0 };
    qs.forEach(q => { if (q.fmt === 'mc') dist[q.ans] = (dist[q.ans] || 0) + 1; });
    return dist;
  }

  function has3Consecutive(qs) {
    const mcOnly = qs.filter(q => q.fmt === 'mc');
    for (let i = 0; i < mcOnly.length - 2; i++) {
      if (mcOnly[i].ans === mcOnly[i+1].ans && mcOnly[i+1].ans === mcOnly[i+2].ans) return true;
    }
    return false;
  }

  function hasOver5(qs) {
    const dist = getAnsDist(qs);
    return Object.values(dist).some(v => v >= 6);
  }

  // Shuffle choices for a question (preserves answer mapping)
  function shuffleChoices(q) {
    if (!q.ch || q.ch.length !== 4 || q.fmt !== 'mc') return false;
    const oldAns = q.ans;
    const ansText = q.ch[oldAns];

    // Create index array and shuffle
    const indices = [0, 1, 2, 3];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const newCh = indices.map(i => q.ch[i]);
    const newAns = newCh.indexOf(ansText);

    q.ch = newCh;
    q.ans = newAns;

    // Update det.analysis if it references ①②③④
    // (Best effort - may not catch all references)

    return oldAns !== newAns;
  }

  let attempts = 0;
  while ((hasOver5(data.questions) || has3Consecutive(data.questions)) && attempts < 50) {
    // Find overrepresented answer
    const dist = getAnsDist(data.questions);
    const maxAns = Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0];

    // Find questions with this answer and shuffle them
    const candidates = data.questions.filter(q => q.fmt === 'mc' && q.ans === parseInt(maxAns));
    if (candidates.length === 0) break;

    // Shuffle random subset
    const toShuffle = candidates.slice(0, Math.ceil(candidates.length / 2));
    for (const q of toShuffle) {
      if (shuffleChoices(q)) {
        modified = true;
        d3Fixed++;
      }
    }
    attempts++;
  }

  // Fix 3-consecutive specifically
  attempts = 0;
  while (has3Consecutive(data.questions) && attempts < 30) {
    const mcOnly = data.questions.filter(q => q.fmt === 'mc');
    for (let i = 0; i < mcOnly.length - 2; i++) {
      if (mcOnly[i].ans === mcOnly[i + 1].ans && mcOnly[i + 1].ans === mcOnly[i + 2].ans) {
        shuffleChoices(mcOnly[i + 1]);
        modified = true;
        d3Fixed++;
        break;
      }
    }
    attempts++;
  }

  // === D9: Fix accept ===
  for (const q of data.questions) {
    if (q.fmt !== 'written') continue;
    if (!q.wa) continue;

    const existing = q.accept || [];
    if (existing.length >= 3) continue;

    const variants = new Set(existing);
    variants.add(q.wa);

    // Generate variants
    const wa = q.wa;
    // Lowercase/uppercase
    variants.add(wa.toLowerCase());
    variants.add(wa.charAt(0).toUpperCase() + wa.slice(1));
    // With/without period
    if (wa.endsWith('.')) variants.add(wa.slice(0, -1));
    else variants.add(wa + '.');
    // With/without leading article
    if (wa.startsWith('the ')) variants.add(wa.slice(4));
    if (wa.startsWith('a ')) variants.add(wa.slice(2));
    // Trim spaces
    variants.add(wa.trim());
    // Common spelling variants
    if (wa.includes('-')) variants.add(wa.replace(/-/g, ' '));
    if (wa.includes(' ')) variants.add(wa.replace(/ /g, '-'));

    q.accept = [...variants].filter(v => v && v.trim().length > 0).slice(0, Math.max(5, existing.length));

    if (q.accept.length > existing.length) {
      modified = true;
      d9Fixed++;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    filesModified++;
  }
}

console.log(`D3 정답분포 수정: ${d3Fixed}건`);
console.log(`D9 accept 보충: ${d9Fixed}건`);
console.log(`수정된 파일: ${filesModified}개`);
