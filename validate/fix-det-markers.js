#!/usr/bin/env node
/**
 * fix-det-markers.js — det.analysis의 ①②③④ 마커를 ch 실제 위치에 맞춰 재정렬
 *
 * 방식: 각 블록(✅/❌ + 마커 + 텍스트)의 "콜론 앞 텍스트"를 추출하여
 *       ch의 각 선지와 정확 매칭. 매칭된 ch index로 마커 재생성.
 *
 * Usage: node validate/fix-det-markers.js <file1.json> [file2.json ...]
 */
const fs = require('fs');

const MK = ['①', '②', '③', '④', '⑤'];
const files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: node validate/fix-det-markers.js <file1.json>');
  process.exit(1);
}

function stripHtml(s) { return (s || '').replace(/<[^>]+>/g, ''); }
function normalize(s) { return stripHtml(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

function parseBlocks(analysis) {
  // 각 줄 또는 구분 포인트에서 "[✅|❌] [①②③④⑤] text" 블록 추출
  const blocks = [];
  // 전체 텍스트를 ✅/❌ 기준으로 split
  const regex = /([✅❌])\s*([①②③④⑤])([^✅❌]*)/g;
  let m;
  while ((m = regex.exec(analysis)) !== null) {
    blocks.push({
      checkmark: m[1],
      circle: m[2],
      rest: m[3],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return blocks;
}

function matchChoice(blockRest, ch) {
  // blockRest에서 식별자 추출 (콜론 앞 또는 첫 구두점 앞)
  const text = blockRest.trim();
  // ": " 또는 ":" 앞까지 또는 "(" 앞까지 (가장 짧은 것)
  let identifier = text;
  const colonIdx = text.indexOf(':');
  const parenIdx = text.indexOf('(');
  let cutoff = text.length;
  if (colonIdx >= 0 && colonIdx < cutoff) cutoff = colonIdx;
  if (parenIdx >= 0 && parenIdx < cutoff) cutoff = parenIdx;
  identifier = text.substring(0, cutoff).trim();

  if (!identifier) return -1;

  const idNorm = normalize(identifier);

  // 각 ch와 정확 매칭 시도
  // 1순위: ch 전체와 idNorm 일치
  for (let i = 0; i < ch.length; i++) {
    const chNorm = normalize(ch[i]);
    if (chNorm === idNorm) return i;
  }
  // 2순위: ch가 idNorm으로 시작
  for (let i = 0; i < ch.length; i++) {
    const chNorm = normalize(ch[i]);
    if (chNorm.startsWith(idNorm) && idNorm.length >= 3) return i;
  }
  // 3순위: idNorm이 ch로 시작
  for (let i = 0; i < ch.length; i++) {
    const chNorm = normalize(ch[i]);
    if (idNorm.startsWith(chNorm) && chNorm.length >= 3) return i;
  }
  // 4순위: 단어 단위 첫 단어 매칭
  const firstWord = idNorm.split(/[\s\-—·]/)[0];
  if (firstWord && firstWord.length >= 3) {
    for (let i = 0; i < ch.length; i++) {
      const chFirst = normalize(ch[i]).split(/[\s\-—·]/)[0];
      if (chFirst === firstWord) return i;
    }
  }
  return -1;
}

function fixAnalysis(analysis, ch, ans) {
  if (!analysis || !Array.isArray(ch) || typeof ans !== 'number') {
    return { analysis, changed: false };
  }
  const blocks = parseBlocks(analysis);
  if (blocks.length < 2) return { analysis, changed: false };
  if (blocks.length > 5) return { analysis, changed: false, reason: 'too_many_blocks' };

  const correctIdx = ans - 1;

  // 각 block의 chIdx 판정
  const mapping = blocks.map(b => ({ block: b, chIdx: matchChoice(b.rest, ch) }));

  // ✅ 블록 식별
  const checkBlock = mapping.find(m => m.block.checkmark === '✅');

  // Full-match 모드: 모든 block이 매칭되고 중복 없으면 전체 재정렬
  const allMatched = !mapping.some(x => x.chIdx === -1);
  const seen = new Set();
  let noDuplicate = true;
  for (const { chIdx } of mapping) {
    if (seen.has(chIdx)) { noDuplicate = false; break; }
    seen.add(chIdx);
  }

  if (!allMatched || !noDuplicate) {
    // Partial 모드: ✅ 블록만 수정 (correct position으로 이동)
    if (!checkBlock || checkBlock.chIdx === -1) {
      return { analysis, changed: false, reason: 'unmatched_check_block' };
    }
    const correctMarker = MK[correctIdx];
    if (checkBlock.block.circle === correctMarker) {
      return { analysis, changed: false, reason: 'already_correct' };
    }
    // ✅의 circle만 교체
    // 동시에 현재 correctMarker 위치에 있는 ❌ 블록이 있으면 그 블록의 circle과 swap
    const oldCircle = checkBlock.block.circle;
    const targetBlock = mapping.find(m => m.block !== checkBlock.block && m.block.circle === correctMarker);
    // 역순으로 처리
    let newAnalysis = analysis;
    const updates = [];
    updates.push({ block: checkBlock.block, newCheck: '✅', newCircle: correctMarker });
    if (targetBlock) {
      updates.push({ block: targetBlock.block, newCheck: '❌', newCircle: oldCircle });
    }
    updates.sort((a, b) => b.block.start - a.block.start);
    for (const u of updates) {
      const before = newAnalysis.substring(0, u.block.start);
      const after = newAnalysis.substring(u.block.start);
      const oldRe = new RegExp(`^${u.block.checkmark}\\s*${u.block.circle}`);
      const replaced = after.replace(oldRe, `${u.newCheck} ${u.newCircle}`);
      newAnalysis = before + replaced;
    }
    return { analysis: newAnalysis, changed: true, partial: true };
  }

  // 각 block에 대해 기대되는 prefix: [✅|❌] [circle]
  let newAnalysis = analysis;
  let changed = false;
  // 역순 처리 (start 위치 안 깨지게)
  for (let i = mapping.length - 1; i >= 0; i--) {
    const { block, chIdx } = mapping[i];
    const expectedCheck = (chIdx === correctIdx) ? '✅' : '❌';
    const expectedCircle = MK[chIdx];
    const currentCheck = block.checkmark;
    const currentCircle = block.circle;
    if (currentCheck === expectedCheck && currentCircle === expectedCircle) continue;

    // 해당 block의 [start, start+3] 위치를 교체
    // 원본: [✅|❌][공백*][①②③④⑤]
    const beforeStr = newAnalysis.substring(0, block.start);
    const afterStr = newAnalysis.substring(block.start);
    // 원래 매칭된 string 형태를 다시 찾음
    const oldRe = new RegExp(`^${currentCheck}\\s*${currentCircle}`);
    const replaced = afterStr.replace(oldRe, `${expectedCheck} ${expectedCircle}`);
    newAnalysis = beforeStr + replaced;
    changed = true;
  }
  return { analysis: newAnalysis, changed };
}

let totalChanged = 0, totalFixed = 0;
const skipped = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  let fileFixed = 0;
  for (const q of data.questions || []) {
    if (q.fmt !== 'mc' || !Array.isArray(q.ch) || typeof q.ans !== 'number') continue;
    if (!q.det || !q.det.analysis) continue;
    const res = fixAnalysis(q.det.analysis, q.ch, q.ans);
    if (res.changed) {
      q.det.analysis = res.analysis;
      fileFixed++;
      totalFixed++;
    } else if (res.reason) {
      skipped.push(`${f.split('/').slice(-3).join('/')} Q${q.id}: ${res.reason}`);
    }
  }
  if (fileFixed > 0) {
    fs.writeFileSync(f, JSON.stringify(data, null, 2));
    console.log(`FIXED ${fileFixed}Q: ${f.split('/').slice(-4).join('/')}`);
    totalChanged++;
  }
}
if (skipped.length) {
  console.log(`\nSKIPPED ${skipped.length}:`);
  skipped.forEach(s => console.log('  ' + s));
}
console.log(`\n총 ${totalChanged}파일 ${totalFixed}문항 수정`);
