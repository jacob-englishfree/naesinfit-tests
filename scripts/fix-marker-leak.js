#!/usr/bin/env node
/**
 * Post-process assembled test JSONs to strip passage markers from non-relevant question types.
 * - Strips (A)(B)(C) from non-ABC/non-순서 types
 * - Strips ①②③④⑤ from non-마커/non-삽입 types
 * Usage: node scripts/fix-marker-leak.js <test.json>
 */
const fs = require('fs');
const path = process.argv[2];
if (!path) { console.log('Usage: node scripts/fix-marker-leak.js <test.json>'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const MARKER_TYPES = ['어법', '문맥상 부적절한 어휘', '어휘', '오류찾기', '문장삽입'];
const ABC_TYPES = ['(A)(B)(C) 조합형', '순서배열', '순서', '다의어 문맥적 의미'];

let fixed = 0;
for (const q of data.questions) {
  if (!q.passage) continue;

  // Strip ①②③④⑤ markers from non-marker types
  const isMarkerType = MARKER_TYPES.some(t => q.type.includes(t)) || (q.ch && q.ch[0] === '①');
  if (!isMarkerType) {
    const before = q.passage;
    // Strip ( \① ) style insertion markers
    q.passage = q.passage.replace(/\s*\(\s*\\?[①②③④⑤]\s*\)\s*/g, ' ');
    // Strip standalone ①②③④⑤ (not inside <u> tags)
    q.passage = q.passage.replace(/(?<![<\w])[①②③④⑤](?!<\/u>)/g, '');
    if (q.passage !== before) fixed++;
  }

  // Strip (A)(B)(C) plain markers from non-ABC types
  const isABCType = ABC_TYPES.some(t => q.type.includes(t));
  if (!isABCType) {
    const before = q.passage;
    // Strip plain (A) (B) (C) but not <b>(A)</b>
    q.passage = q.passage.replace(/(?<![<\w])\(([ABC])\)\s*/g, '');
    if (q.passage !== before) fixed++;
  }

  // Clean up double spaces
  q.passage = q.passage.replace(/\s{2,}/g, ' ').trim();
}

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log(`Fixed ${fixed} passages in ${path}`);
