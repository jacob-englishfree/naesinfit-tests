#!/usr/bin/env node
/**
 * add-overlay.js — passage 내용에서 overlay 자동 추출하여 추가
 * Usage: node scripts/add-overlay.js <test.json>
 */
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node scripts/add-overlay.js <test.json>'); process.exit(1); }

const absPath = path.resolve(filePath);
const data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
const fp = data.fullPassage || '';

let changed = 0;

data.questions.forEach(q => {
  if (q.overlay && Object.keys(q.overlay).length > 0) return; // already has overlay

  const t = q.type;
  const p = q.passage || '';

  // (A)(B)(C) 조합형
  if (t === '(A)(B)(C) 조합형') {
    const abc = {};
    const re = /<b>\(([ABC])\)<\/b>\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(p)) !== null) {
      const parts = m[2].split('/').map(s => s.trim());
      abc[m[1]] = parts;
    }
    if (Object.keys(abc).length > 0) {
      q.overlay = { abc };
      changed++;
    }
    return;
  }

  // 문맥상 부적절한 어휘
  if (t === '문맥상 부적절한 어휘' || t === '어휘') {
    const markers = {};
    const re = /([①②③④⑤])<u>([^<]+)<\/u>/g;
    let m;
    while ((m = re.exec(p)) !== null) {
      const marker = m[1];
      const displayWord = m[2];
      // Check if this word exists in fullPassage
      if (fp.includes(displayWord)) {
        markers[marker] = displayWord;
      } else {
        // This is the replaced word — find the original
        // For 부적절, the wrong answer position has find/display
        // We need to find what original word was at this position
        // Use the det to figure out the original
        const det = q.det || {};
        const analysis = det.analysis || '';
        // Try to extract original from analysis (→원문: XXX)
        const origMatch = analysis.match(new RegExp(marker + '[^→]*→[^:]*:\\s*([^)\\s,]+)', 'i'));
        if (origMatch) {
          markers[marker] = { find: origMatch[1], display: displayWord };
        } else {
          markers[marker] = { find: displayWord, display: displayWord };
        }
      }
    }
    if (Object.keys(markers).length > 0) {
      q.overlay = { markers };
      changed++;
    }
    return;
  }

  // 어법
  if (t === '어법') {
    const markers = {};
    const re = /([①②③④⑤])<u>([^<]+)<\/u>/g;
    let m;
    while ((m = re.exec(p)) !== null) {
      const marker = m[1];
      const displayWord = m[2];
      if (fp.includes(displayWord)) {
        markers[marker] = displayWord;
      } else {
        // Grammar error — find/display
        const det = q.det || {};
        const analysis = det.analysis || '';
        const korean = det.korean || '';
        // Try to find the correct form from analysis
        const corrMatch = analysis.match(new RegExp(marker + '[^→]*→\\s*([^.\\s,)]+)'));
        if (corrMatch) {
          markers[marker] = { find: corrMatch[1], display: displayWord };
        } else {
          markers[marker] = { find: displayWord, display: displayWord };
        }
      }
    }
    if (Object.keys(markers).length > 0) {
      q.overlay = { markers };
      changed++;
    }
    return;
  }

  // 빈칸 어휘 완성 / 빈칸 문맥 완성 / 빈칸추론
  if (t.includes('빈칸')) {
    // Find the blank and determine what word was replaced
    const blankRe = /_{3,}/;
    if (blankRe.test(p)) {
      // Compare passage with fullPassage to find the blanked word
      // Simple approach: find the word from det or ch
      const det = q.det || {};
      const analysis = det.analysis || '';
      // Try to get from correct answer in ch
      if (q.ch && q.ans) {
        const answer = q.ch[q.ans - 1];
        if (answer && fp.includes(answer)) {
          q.overlay = { blank: answer };
          changed++;
        } else if (answer) {
          q.overlay = { blank: answer };
          changed++;
        }
      }
    }
    return;
  }

  // 동의어/반의어 고르기
  if (t.includes('동의어') || t.includes('반의어')) {
    const re = /<u>([^<]+)<\/u>/;
    const m = p.match(re);
    if (m) {
      q.overlay = { underline: m[1] };
      changed++;
    }
    return;
  }

  // 함축의미 추론
  if (t === '함축의미 추론') {
    const re = /<u>([^<]+)<\/u>/;
    const m = p.match(re);
    if (m) {
      q.overlay = { underline: m[1] };
      changed++;
    }
    return;
  }

  // 지칭추론
  if (t === '지칭추론') {
    const re = /<u>([^<]+)<\/u>/;
    const m = p.match(re);
    if (m) {
      q.overlay = { underline: m[1] };
      changed++;
    }
    return;
  }

  // 어형 변환
  if (t === '어형 변환') {
    // Extract base form from passage _____(word)
    const re = /_____\(([^)]+)\)/;
    const m = p.match(re);
    if (m) {
      q.overlay = { excerptSentences: `발췌 (원형: ${m[1]})` };
      changed++;
    }
    return;
  }

  // 오류찾기
  if (t === '오류찾기') {
    const markers = {};
    const re = /([①②③④⑤])([^①②③④⑤<]*)/g;
    let m;
    // Parse markers from passage
    const markerRe = /([①②③④])(\s*)(\S+)/g;
    while ((m = markerRe.exec(p)) !== null) {
      const marker = m[1];
      const word = m[3].replace(/[.,;:!?]/g, '');
      markers[marker] = { find: word, display: word };
    }
    // Override with det info for the wrong answer
    if (q.ans && q.det) {
      const analysis = q.det.analysis || '';
      // The answer marker has the error
      const ansMarker = ['①','②','③','④'][q.ans - 1];
      if (ansMarker && markers[ansMarker]) {
        // Try to extract the correct form
        const corrMatch = analysis.match(new RegExp(ansMarker + '[^→]*→\\s*([^\\s.),]+)'));
        if (corrMatch) {
          markers[ansMarker] = { find: corrMatch[1], display: markers[ansMarker].display || markers[ansMarker].find };
        }
      }
    }
    if (Object.keys(markers).length > 0) {
      q.overlay = { markers };
      changed++;
    }
    return;
  }

  // 서술형 — 조건영작
  if (t === '서술형 — 조건영작') {
    const blankRe = /_{3,}/;
    if (blankRe.test(p)) {
      if (q.wa && fp.includes(q.wa)) {
        q.overlay = { blank: q.wa };
        changed++;
      } else if (q.wa) {
        q.overlay = { blank: q.wa };
        changed++;
      }
    }
    return;
  }
});

fs.writeFileSync(absPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`${path.basename(filePath)}: ${changed} overlays added`);
