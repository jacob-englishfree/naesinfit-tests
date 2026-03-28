#!/usr/bin/env node
/**
 * D6 마커 누락 + D7 정답 노출 자동 수정
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

let d6Fixed = 0, d7Fixed = 0, filesModified = 0;

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

for (const filePath of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { continue; }
  if (!data.questions || !Array.isArray(data.questions)) continue;

  let modified = false;
  const fp = data.fullPassage || '';

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    const type = q.type || '';
    let p = q.passage || '';

    // === D6: 어법 마커 누락 ===
    if (/어법/.test(type) && p.length > 0) {
      const circleCount = (p.match(/[①②③④]/g) || []).length;
      if (circleCount < 4 && q.ch && q.ch.length === 4) {
        // Try to add ① ② ③ ④ before the choice words
        const circles = ['①', '②', '③', '④'];
        let newP = p;
        let added = 0;
        for (let ci = 0; ci < 4; ci++) {
          const w = q.ch[ci];
          if (!w || newP.includes(circles[ci])) continue;
          // Find the word in passage (without circle prefix)
          if (newP.includes(w) && !newP.includes(circles[ci] + w)) {
            // Add circle before first occurrence
            newP = newP.replace(w, circles[ci] + '<u>' + w + '</u>');
            added++;
          }
        }
        if (added > 0) {
          q.passage = newP;
          modified = true;
          d6Fixed++;
        }
      }
    }

    // === D6: 부적절 어휘 <u> 누락 ===
    if (/부적절/.test(type) && p.length > 0) {
      const uCount = (p.match(/<u>/g) || []).length;
      if (uCount < 4 && q.ch && q.ch.length === 4) {
        const circles = ['①', '②', '③', '④'];
        let newP = p;
        for (let ci = 0; ci < 4; ci++) {
          const w = q.ch[ci];
          if (!w) continue;
          if (!newP.includes('<u>' + w + '</u>') && newP.includes(w)) {
            const prefix = newP.includes(circles[ci]) ? '' : circles[ci];
            newP = newP.replace(w, prefix + '<u>' + w + '</u>');
          }
        }
        if ((newP.match(/<u>/g) || []).length > uCount) {
          q.passage = newP;
          modified = true;
          d6Fixed++;
        }
      }
    }

    // === D6: 빈칸형 ____ 누락 ===
    if (/빈칸/.test(type) && p.length > 0 && !p.includes('____') && !p.includes('___')) {
      if (!/내용이해|T\/F|내용일치|주제|제목|함축/.test(type)) {
        const ans = q.fmt === 'mc' ? q.ch?.[q.ans] : q.wa;
        if (ans && typeof ans === 'string' && /^[a-zA-Z]/.test(ans) && ans.length > 2) {
          if (p.includes(ans)) {
            q.passage = p.replace(ans, '____');
            modified = true;
            d6Fixed++;
          }
        }
      }
    }

    // === D6: 어순배열 ____ 누락 ===
    if (/어순배열/.test(type) && p.length > 0 && !p.includes('____')) {
      const wa = q.wa || '';
      if (wa && p.includes(wa)) {
        q.passage = p.replace(wa, '____');
        modified = true;
        d6Fixed++;
      } else if (wa && fp.includes(wa)) {
        q.passage = fp.replace(wa, '____');
        modified = true;
        d6Fixed++;
      }
    }

    // === D7: 정답 노출 수정 ===
    p = q.passage || '';
    const cleanP = p.replace(/<[^>]+>/g, '').replace(/____/g, '');

    if (q.fmt === 'mc' && typeof q.ans === 'number' && q.ch) {
      const ans = q.ch[q.ans];
      if (!/동의어|반의어|다의어|부적절|어법|\(A\)\(B\)\(C\)|내용|T\/F|지칭|주제|제목|함축|내용일치|내용불일치/.test(type)) {
        if (ans && ans.length > 3 && cleanP.includes(ans)) {
          // For 빈칸 types: the answer should be replaced with ____
          if (/빈칸/.test(type)) {
            q.passage = q.passage.replace(ans, '____');
            modified = true;
            d7Fixed++;
          }
        }
      }
    }

    if (q.fmt === 'written' && q.wa) {
      if (!/핵심단어|찾기/.test(type) && !/찾아/.test(q.stem || '')) {
        if (q.wa.length > 3 && cleanP.includes(q.wa)) {
          // 서술형 정답 노출 → ____ 로 교체
          q.passage = q.passage.replace(q.wa, '____');
          modified = true;
          d7Fixed++;
        }
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    filesModified++;
  }
}

console.log(`D6 마커 수정: ${d6Fixed}건`);
console.log(`D7 정답노출 수정: ${d7Fixed}건`);
console.log(`수정된 파일: ${filesModified}개`);
