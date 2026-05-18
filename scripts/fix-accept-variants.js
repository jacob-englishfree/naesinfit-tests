#!/usr/bin/env node
/**
 * fix-accept-variants.js
 * 서술형/영작 문항의 accept 배열에 정답 변형을 자동 추가
 * - F10-B: 소문자 변형
 * - F10-D: 마침표 있는 변형 / 없는 변형
 */

const fs = require('fs');

function addVariants(question) {
  const ans = question.wa || question.ans;
  if (typeof ans !== 'string' || !ans.trim()) return false;
  if (!Array.isArray(question.accept)) question.accept = [];

  const acceptSet = new Set(question.accept);
  const before = acceptSet.size;

  const variants = new Set();
  variants.add(ans);

  // 소문자 변형
  variants.add(ans.toLowerCase());

  // 마침표 토글
  const noPeriod = ans.replace(/[.!?]+\s*$/, '').trim();
  const withPeriod = noPeriod + '.';
  variants.add(noPeriod);
  variants.add(withPeriod);
  variants.add(noPeriod.toLowerCase());
  variants.add(withPeriod.toLowerCase());

  // 쉼표 제거 변형 (선택적)
  const noComma = noPeriod.replace(/,/g, '');
  if (noComma !== noPeriod) {
    variants.add(noComma);
    variants.add(noComma + '.');
    variants.add(noComma.toLowerCase());
  }

  for (const v of variants) {
    if (v && !acceptSet.has(v)) acceptSet.add(v);
  }

  question.accept = [...acceptSet];
  return acceptSet.size > before;
}

function fixFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const fixed = [];
  for (const q of data.questions || []) {
    if (q.fmt === 'short' || q.fmt === 'essay' || q.type?.includes('서술형') || q.type?.includes('어순배열') || q.type?.includes('어형변환')) {
      if (addVariants(q)) fixed.push(q.id);
    }
  }
  if (fixed.length > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  return fixed;
}

const args = process.argv.slice(2);
if (args.length === 0) { console.error('Usage: node fix-accept-variants.js <files...>'); process.exit(1); }

let total = 0;
for (const f of args) {
  const fixed = fixFile(f);
  console.log(`${fixed.length > 0 ? '[FIXED]' : '[OK]'} ${f} — ${fixed.length} questions${fixed.length > 0 ? ' (Q' + fixed.join(', Q') + ')' : ''}`);
  total += fixed.length;
}
console.log(`\nTotal: ${total} questions updated`);
