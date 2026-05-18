#!/usr/bin/env node
// Fix TW-TYPE errors by mapping disallowed q.type to whitelisted ones.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Mapping table: disallowed -> allowed (chosen from whitelist in validate.js)
const MAP = {
  '글의 요지': '주제/요지',
  '글의 주제': '주제',
  '글의 제목': '제목',
  '글의 주장': '주제/요지',
  '글의 목적': '주제/요지',
  '함축 의미': '함축',
  '함축의미': '함축',
  '문맥상 부적절 어휘': '문맥상 부적절한 어휘',
  '내용일치/불일치': '내용 일치/불일치',
  '주제/대의/제목': '주제/요지',
  '서술형 (핵심단어)': '서술형 — 핵심단어',
  '서술형 (어형변환)': '서술형 — 어형변환',
  '영작 서술형': '서술형 — 영작',
  // English-keyed types
  'grammar': '어법',
  'vocabulary': '어휘',
  'inference': '추론',
  'content_match': '내용일치',
  'content_mismatch': '내용불일치',
  'error_correction': '오류찾기',
  'written': '서술형',
  'word_order': '어순배열',
  'theme': '주제',
  'summary': '요약',
};

// For 단어 testType, the whitelist is narrower. Map differently when needed.
const MAP_WORD = {
  '글의 요지': '주제',
  '글의 주제': '주제',
  '글의 제목': '주제',
  '글의 주장': '주제',
  '글의 목적': '주제',
  '함축 의미': '내용이해',
  '함축의미': '내용이해',
  '문맥상 부적절 어휘': '문맥상 부적절한 어휘',
};

function listJson(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJson(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

let totalChanged = 0;
let filesChanged = 0;

for (const file of listJson(path.join(ROOT, 'data'))) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { continue; }
  let json;
  try { json = JSON.parse(raw); } catch { continue; }
  const tt = json.testType;
  if (!['단어', '워크북', '퀴즈'].includes(tt)) continue;
  const qs = json.questions;
  if (!Array.isArray(qs)) continue;
  let changed = 0;
  for (const q of qs) {
    const t = (q.type || '').trim();
    if (!t) continue;
    const map = tt === '단어' ? { ...MAP, ...MAP_WORD } : MAP;
    if (map[t]) {
      q.type = map[t];
      changed++;
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
    totalChanged += changed;
    filesChanged++;
  }
}

console.log(`Files changed: ${filesChanged}, questions changed: ${totalChanged}`);
