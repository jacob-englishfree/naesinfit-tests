#!/usr/bin/env node
/**
 * fix-f10b.js — accept 배열에 소문자 변형 및 마침표 없는 변형 자동 추가
 */
const fs = require('fs');

function addVariants(accept) {
  if (!Array.isArray(accept)) return accept;
  const result = new Set(accept);
  accept.forEach(a => {
    if (typeof a !== 'string') return;
    // 소문자 변형
    result.add(a.toLowerCase());
    // 마침표 없는 변형
    result.add(a.replace(/\.$/, '').trim());
    result.add(a.toLowerCase().replace(/\.$/, '').trim());
    // 대문자 변형
    const cap = a.charAt(0).toUpperCase() + a.slice(1);
    result.add(cap);
    result.add(cap.replace(/\.$/, '').trim());
  });
  return Array.from(result).filter(s => s.length > 0);
}

const files = process.argv.slice(2);
files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = 0;
  data.questions.forEach(q => {
    if (q.fmt === 'written' && Array.isArray(q.accept)) {
      const before = q.accept.length;
      const newAccept = addVariants(q.accept);
      if (newAccept.length !== before) {
        q.accept = newAccept;
        changed++;
      }
    }
  });
  if (changed > 0) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[FIXED] ${file}: ${changed}문항 accept 확장`);
  } else {
    console.log(`[SKIP] ${file}: 변경 없음`);
  }
});
