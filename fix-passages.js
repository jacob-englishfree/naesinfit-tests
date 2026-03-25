#!/usr/bin/env node
/**
 * fix-passages.js v3
 * 모의고사 + 수능특강 HTML 파일에서 passage 가공 오류를 자동 수정
 *
 * 핵심 전략:
 * - 리터럴 passage가 ...로 잘려서 정답 단어가 없는 경우
 *   → FULL_PASSAGE를 사용해서 정답 단어를 BLANK로 교체한 전체 passage로 대체
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname);
const SCAN_DIRS = [
  path.join(BASE, '모의고사'),
  path.join(BASE, '부교재', '수능특강', '영어'),
];
const BLANK = '__________';

const stats = {
  totalFiles: 0,
  fix1: { before: 0, fixed: 0, files: new Set() },
  fix2: { before: 0, fixed: 0, files: new Set() },
  fix3: { before: 0, fixed: 0, files: new Set() },
  fix4: { fixed: 0, files: new Set() },
};

/**
 * FULL_PASSAGE 추출 - backtick, double quote, single quote 모두 지원
 */
function extractFullPassage(content) {
  const m = content.match(/(?:const|var|let)\s+FULL_PASSAGE\s*=\s*([`"'])/);
  if (!m) return null;
  const quoteChar = m[1];
  const startIdx = m.index + m[0].length;

  // quote 문자와 매칭되는 닫는 quote 찾기
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === quoteChar && content[i - 1] !== '\\') {
      return content.substring(startIdx, i);
    }
  }
  return null;
}

function findAllHtml(dir) {
  const r = [];
  if (!fs.existsSync(dir)) return r;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...findAllHtml(full));
    else if (e.name.endsWith('.html')) r.push(full);
  }
  return r;
}

/**
 * 문항 블록 범위를 정확하게 찾기
 * 중괄호 depth 추적으로 정확한 경계 구분
 */
function getQuestionBlocks(content) {
  const blocks = [];
  const qStartRegex = /\{id:(\d+),/g;
  let m;

  while ((m = qStartRegex.exec(content)) !== null) {
    const start = m.index;
    const id = parseInt(m[1]);

    // 중괄호 매칭으로 정확한 끝 찾기
    let depth = 0;
    let inStr = false;
    let strChar = '';
    let end = start;

    for (let i = start; i < content.length; i++) {
      const c = content[i];
      const prev = i > 0 ? content[i - 1] : '';

      if (inStr) {
        if (c === strChar && prev !== '\\') inStr = false;
        continue;
      }
      if (c === '`' || c === "'" || c === '"') {
        inStr = true;
        strChar = c;
        continue;
      }
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    blocks.push({ id, start, end });
  }
  return blocks;
}

function getType(block) {
  const m = block.match(/type:\s*[`'"]([^`'"]*)[`'"]/);
  return m ? m[1] : '';
}

function getAns(block) {
  const m = block.match(/,\s*ans:\s*(\d+)/);
  return m ? parseInt(m[1]) : -1;
}

function getChoices(block) {
  // ch:[...] - 중괄호 앞의 배열 부분만
  const chStart = block.indexOf('ch:[');
  if (chStart === -1) return [];

  let depth = 0;
  let chEnd = chStart;
  for (let i = chStart; i < block.length; i++) {
    if (block[i] === '[') depth++;
    if (block[i] === ']') { depth--; if (depth === 0) { chEnd = i + 1; break; } }
  }

  const chStr = block.substring(chStart + 3, chEnd);
  const items = [];
  const ir = /[`'"]([^`'"]*)[`'"]/g;
  let cm;
  while ((cm = ir.exec(chStr)) !== null) items.push(cm[1]);
  return items;
}

/**
 * passage 값의 정확한 시작~끝 범위와 내용 추출
 */
function getPassageInfo(block) {
  // passage:FULL_PASSAGE.replace('x','y')
  const rr = block.match(/passage:\s*(FULL_PASSAGE\.replace\([^)]+\))\s*,/);
  if (rr) return { type: 'ref-replace', raw: rr[0], fullMatch: rr[0] };

  // passage:FULL_PASSAGE
  const r = block.match(/passage:\s*FULL_PASSAGE\s*,/);
  if (r) return { type: 'ref', raw: r[0], fullMatch: r[0] };

  // passage:`...` — 백틱 안에 이스케이프 처리
  const pIdx = block.indexOf('passage:');
  if (pIdx === -1) return { type: 'unknown' };

  const afterP = block.substring(pIdx + 8).trimStart();
  const quoteChar = afterP[0];

  if (quoteChar === '`' || quoteChar === "'" || quoteChar === '"') {
    // 문자열 끝 찾기
    let end = -1;
    for (let i = 1; i < afterP.length; i++) {
      if (afterP[i] === quoteChar && afterP[i - 1] !== '\\') {
        end = i;
        break;
      }
    }
    if (end > 0) {
      const content = afterP.substring(1, end);
      const fullStr = `passage:${afterP.substring(0, end + 1)},`;
      return { type: 'literal', content, quoteChar, fullMatch: fullStr };
    }
  }

  return { type: 'unknown' };
}

function getAnalysis(block) {
  const m = block.match(/analysis:\s*[`']([\s\S]*?)[`']\s*[,}]/);
  return m ? m[1] : '';
}

function getKorean(block) {
  const m = block.match(/korean:\s*[`']([\s\S]*?)[`']\s*[,}]/);
  return m ? m[1] : '';
}

// ─── FIX 1: 빈칸 유형 passage에 __________ 삽입 ───
function fixBlank(content, fullPassage) {
  const blanktypes = ['빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론'];
  let blocks = getQuestionBlocks(content);
  let modified = false;

  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const block = content.substring(b.start, b.end);
    const type = getType(block);
    if (!blanktypes.includes(type)) continue;

    const pInfo = getPassageInfo(block);
    if (pInfo.type === 'ref-replace') continue; // 이미 .replace 있음
    if (pInfo.type === 'unknown') continue;

    // passage 내용 확인
    let passageContent = null;
    if (pInfo.type === 'ref') passageContent = fullPassage;
    else if (pInfo.type === 'literal') passageContent = pInfo.content;
    if (!passageContent) continue;

    // 이미 빈칸 있으면 스킵
    if (passageContent.includes(BLANK)) continue;

    const ans = getAns(block);
    const choices = getChoices(block);
    if (ans < 0 || ans >= choices.length) continue;
    const ansWord = choices[ans];
    if (!ansWord || /^[①②③④⑤]$/.test(ansWord)) continue;

    let newPassageContent = null;

    // Case 1: 정답 단어가 현재 passage에 있음
    if (passageContent.includes(ansWord)) {
      newPassageContent = passageContent.replace(ansWord, BLANK);
    }
    // Case 2: 정답 단어가 잘린 passage에 없지만 FULL_PASSAGE에 있음
    else if (fullPassage && fullPassage.includes(ansWord)) {
      newPassageContent = fullPassage.replace(ansWord, BLANK);
    }

    if (!newPassageContent) continue;

    // 교체
    let newPassageDecl;
    if (pInfo.type === 'ref') {
      newPassageDecl = `passage:\`${newPassageContent.replace(/`/g, '\\`')}\`,`;
    } else {
      newPassageDecl = `passage:\`${newPassageContent.replace(/`/g, '\\`')}\`,`;
    }

    const newBlock = block.replace(pInfo.fullMatch, newPassageDecl);
    if (newBlock !== block) {
      content = content.substring(0, b.start) + newBlock + content.substring(b.end);
      modified = true;
      stats.fix1.fixed++;
    }
  }
  return { content, modified };
}

// ─── FIX 2: (A)(B)(C) 조합 마커 삽입 ───
function fixCombo(content, fullPassage) {
  let blocks = getQuestionBlocks(content);
  let modified = false;

  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const block = content.substring(b.start, b.end);
    const type = getType(block);
    if (!type.includes('조합')) continue;

    const pInfo = getPassageInfo(block);
    if (pInfo.type === 'unknown') continue;

    let passageContent = null;
    if (pInfo.type === 'ref' || pInfo.type === 'ref-replace') passageContent = fullPassage;
    else if (pInfo.type === 'literal') passageContent = pInfo.content;
    if (!passageContent) continue;
    if (passageContent.includes('<b>(A)</b>') || passageContent.includes('(A)')) continue;

    const ans = getAns(block);
    const choices = getChoices(block);
    if (ans < 0 || ans >= choices.length) continue;

    const parts = choices[ans].split(/\s*[—–]\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length !== 3) continue;

    // 현재 passage 또는 FULL_PASSAGE에서 3단어 찾기
    let workPassage = passageContent;
    let useFullPassage = false;

    let allFound = parts.every(p => workPassage.includes(p));
    if (!allFound && fullPassage && fullPassage !== passageContent) {
      workPassage = fullPassage;
      allFound = parts.every(p => workPassage.includes(p));
      useFullPassage = true;
    }
    if (!allFound) continue;

    const markers = ['(A)', '(B)', '(C)'];
    let newPassage = workPassage;
    for (let j = 0; j < 3; j++) {
      newPassage = newPassage.replace(parts[j], `<b>${markers[j]}</b> ${parts[j]}`);
    }

    const newPassageDecl = `passage:\`${newPassage.replace(/`/g, '\\`')}\`,`;
    const newBlock = block.replace(pInfo.fullMatch, newPassageDecl);
    if (newBlock !== block) {
      content = content.substring(0, b.start) + newBlock + content.substring(b.end);
      modified = true;
      stats.fix2.fixed++;
    }
  }
  return { content, modified };
}

// ─── FIX 3: 부적절 어휘 밑줄 삽입 ───
function fixInappropriate(content, fullPassage) {
  let blocks = getQuestionBlocks(content);
  let modified = false;
  const circled = ['①', '②', '③', '④', '⑤'];

  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const block = content.substring(b.start, b.end);
    const type = getType(block);
    if (!type.includes('부적절')) continue;

    const choices = getChoices(block);
    if (!choices.every(c => circled.includes(c.trim()))) continue;

    const pInfo = getPassageInfo(block);
    if (pInfo.type === 'unknown') continue;

    let passageContent = null;
    if (pInfo.type === 'ref' || pInfo.type === 'ref-replace') passageContent = fullPassage;
    else if (pInfo.type === 'literal') passageContent = pInfo.content;
    if (!passageContent) continue;
    if (passageContent.includes('<u>')) continue;

    const ans = getAns(block);
    const analysis = getAnalysis(block);
    const korean = getKorean(block);

    // 5개 단어 추출: analysis에서 ① word 패턴
    let words = [];
    for (let j = 0; j < 5; j++) {
      const regex = new RegExp(`${circled[j]}\\s+(\\S+)`);
      const m = analysis.match(regex);
      if (m) {
        let w = m[1].replace(/[(:;,)]/g, '');
        words.push(w);
      }
    }

    // analysis에서 5개를 못 찾으면 korean에서 정답 부분 정보 추출 시도
    if (words.length !== 5) {
      // korean: "④ certainty(→ ambivalence)" 패턴
      // 정답 위치의 '틀린 단어'와 '원문 단어' 추출
      const pWrong = korean.match(/([①②③④⑤])\s*(\w+)\s*\(→\s*(\w+)\)/);
      const pWrong2 = korean.match(/([①②③④⑤])\s*(\w+):\s*원문은\s*(\w+)/);
      const pWrong3 = korean.match(/(\w+)\s*\(→\s*(\w+)\)/);

      let wrongWord = null, correctWord = null, wrongIdx = -1;

      if (pWrong) {
        wrongIdx = circled.indexOf(pWrong[1]);
        wrongWord = pWrong[2];
        correctWord = pWrong[3];
      } else if (pWrong2) {
        wrongIdx = circled.indexOf(pWrong2[1]);
        wrongWord = pWrong2[2];
        correctWord = pWrong2[3];
      } else if (pWrong3) {
        wrongWord = pWrong3[1];
        correctWord = pWrong3[2];
        wrongIdx = ans;
      }

      if (correctWord && wrongIdx >= 0) {
        // analysis에서 이미 추출한 단어가 있으면 그것을 사용
        // 없는 것만 보충
        if (words.length === 0) words = new Array(5).fill(null);

        // 정답 위치에 원문 단어 (passage에 표시되어야 할 단어)
        // 부적절 유형: passage에는 원문에서 하나가 부적절 단어로 바뀌어있거나,
        // 아직 원문 그대로이고 밑줄만 없는 상태
        // 여기서는 원문 passage에 밑줄을 추가하는 것이므로 원문 단어를 사용
        words[wrongIdx] = correctWord;
      }
    }

    // FULL_PASSAGE에서 단어 5개가 모두 존재하는지 확인
    let workPassage = passageContent;
    if (words.length === 5 && words.every(w => w !== null)) {
      let allFound = words.every(w => workPassage.includes(w));
      if (!allFound && fullPassage) {
        workPassage = fullPassage;
        allFound = words.every(w => workPassage.includes(w));
      }

      if (allFound) {
        let newPassage = workPassage;
        for (let j = 0; j < 5; j++) {
          newPassage = newPassage.replace(words[j], `${circled[j]}<u>${words[j]}</u>`);
        }

        const newPassageDecl = `passage:\`${newPassage.replace(/`/g, '\\`')}\`,`;
        const newBlock = block.replace(pInfo.fullMatch, newPassageDecl);
        if (newBlock !== block) {
          content = content.substring(0, b.start) + newBlock + content.substring(b.end);
          modified = true;
          stats.fix3.fixed++;
        }
      }
    }
  }
  return { content, modified };
}

// ─── FIX 4: 인코딩 깨짐 ───
function fixEncoding(content) {
  const original = content;
  const map = [
    ['\u00e2\u0080\u0094', '\u2014'], // em dash
    ['\u00e2\u0080\u0099', '\u2019'], // right single quote
    ['\u00e2\u0080\u0098', '\u2018'], // left single quote
    ['\u00e2\u0080\u009c', '\u201c'], // left double quote
    ['\u00e2\u0080\u009d', '\u201d'], // right double quote
    ['\u00e2\u0080\u00a6', '\u2026'], // ellipsis
  ];
  for (const [bad, good] of map) {
    if (content.includes(bad)) content = content.split(bad).join(good);
  }
  return { content, fixed: content !== original };
}

// ─── 진단 ───
function diagnose(content, fullPassage) {
  const issues = [];
  const blanktypes = ['빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론'];
  const blocks = getQuestionBlocks(content);
  const circled = ['①', '②', '③', '④', '⑤'];

  for (const b of blocks) {
    const block = content.substring(b.start, b.end);
    const type = getType(block);
    const pInfo = getPassageInfo(block);
    const ans = getAns(block);
    const choices = getChoices(block);

    if (blanktypes.includes(type)) {
      const hasBlank = pInfo.type === 'ref-replace' ||
        (pInfo.content && pInfo.content.includes(BLANK)) ||
        (pInfo.fullMatch && pInfo.fullMatch.includes(BLANK));
      if (!hasBlank) {
        issues.push({ qId: b.id, type, issue: 'BLANK', answer: choices[ans] || '?' });
      }
    }

    if (type.includes('조합')) {
      let pt = pInfo.content || (pInfo.type === 'ref' ? fullPassage : null);
      if (pt && !pt.includes('<b>(A)</b>') && !pt.includes('(A)')) {
        issues.push({ qId: b.id, type, issue: 'COMBO', answer: choices[ans] || '?' });
      }
    }

    if (type.includes('부적절')) {
      if (choices.every(c => circled.includes(c.trim()))) {
        let pt = pInfo.content || (pInfo.type === 'ref' ? fullPassage : null);
        if (pt && !pt.includes('<u>')) {
          issues.push({ qId: b.id, type, issue: 'UNDERLINE' });
        }
      }
    }
  }
  return issues;
}

// ─── 메인 ───
console.log('=== fix-passages.js v3 ===\n');

let allFiles = [];
for (const dir of SCAN_DIRS) allFiles.push(...findAllHtml(dir));
stats.totalFiles = allFiles.length;
console.log(`총 HTML 파일: ${allFiles.length}개\n`);

// 1. 진단
console.log('--- 1단계: 수정 전 진단 ---');
let preDiag = [];
for (const f of allFiles) {
  const c = fs.readFileSync(f, 'utf-8');
  if (!c.includes('const Q=[')) continue;
  const fp = extractFullPassage(c);
  for (const iss of diagnose(c, fp)) preDiag.push({ ...iss, file: path.relative(BASE, f) });
}

const pre = {
  blank: preDiag.filter(i => i.issue === 'BLANK'),
  combo: preDiag.filter(i => i.issue === 'COMBO'),
  under: preDiag.filter(i => i.issue === 'UNDERLINE'),
};
console.log(`  빈칸 누락: ${pre.blank.length}건 (${new Set(pre.blank.map(i => i.file)).size}파일)`);
console.log(`  조합 마커 누락: ${pre.combo.length}건 (${new Set(pre.combo.map(i => i.file)).size}파일)`);
console.log(`  밑줄 누락: ${pre.under.length}건 (${new Set(pre.under.map(i => i.file)).size}파일)\n`);

// 2. 수정
console.log('--- 2단계: 수정 ---');
let modCount = 0;
for (const f of allFiles) {
  let c = fs.readFileSync(f, 'utf-8');
  if (!c.includes('const Q=[')) continue;
  const fp = extractFullPassage(c);
  const rel = path.relative(BASE, f);
  let mod = false;

  try {
    const r4 = fixEncoding(c);
    if (r4.fixed) { c = r4.content; mod = true; stats.fix4.fixed++; stats.fix4.files.add(rel); }

    const r1 = fixBlank(c, fp);
    if (r1.modified) { c = r1.content; mod = true; stats.fix1.files.add(rel); }

    const r2 = fixCombo(c, fp);
    if (r2.modified) { c = r2.content; mod = true; stats.fix2.files.add(rel); }

    const r3 = fixInappropriate(c, fp);
    if (r3.modified) { c = r3.content; mod = true; stats.fix3.files.add(rel); }

    if (mod) { fs.writeFileSync(f, c, 'utf-8'); modCount++; }
  } catch (err) {
    console.error(`  ERROR: ${rel}: ${err.message}`);
  }
}
console.log(`  수정된 파일: ${modCount}개\n`);

// 3. 재진단
console.log('--- 3단계: 수정 후 재진단 ---');
let postDiag = [];
for (const f of allFiles) {
  const c = fs.readFileSync(f, 'utf-8');
  if (!c.includes('const Q=[')) continue;
  const fp = extractFullPassage(c);
  for (const iss of diagnose(c, fp)) postDiag.push({ ...iss, file: path.relative(BASE, f) });
}

const post = {
  blank: postDiag.filter(i => i.issue === 'BLANK'),
  combo: postDiag.filter(i => i.issue === 'COMBO'),
  under: postDiag.filter(i => i.issue === 'UNDERLINE'),
};

// ─── 보고 ───
console.log('\n' + '='.repeat(50));
console.log('           수정 결과 보고');
console.log('='.repeat(50));
console.log(`총 스캔: ${stats.totalFiles}개 | 수정: ${modCount}개\n`);

console.log('[ FIX 1: 빈칸 마커 ]');
console.log(`  ${pre.blank.length}건 → ${post.blank.length}건 (${stats.fix1.fixed}건 수정, ${stats.fix1.files.size}파일)`);

console.log('\n[ FIX 2: (A)(B)(C) 조합 마커 ]');
console.log(`  ${pre.combo.length}건 → ${post.combo.length}건 (${stats.fix2.fixed}건 수정, ${stats.fix2.files.size}파일)`);

console.log('\n[ FIX 3: 부적절 어휘 밑줄 ]');
console.log(`  ${pre.under.length}건 → ${post.under.length}건 (${stats.fix3.fixed}건 수정, ${stats.fix3.files.size}파일)`);

console.log('\n[ FIX 4: 인코딩 깨짐 ]');
console.log(`  ${stats.fix4.fixed}건 (${stats.fix4.files.size}파일)`);

if (postDiag.length > 0) {
  console.log('\n' + '='.repeat(50));
  console.log(`         잔여 이슈: ${postDiag.length}건`);
  console.log('='.repeat(50));
  if (post.blank.length > 0) {
    console.log(`\n[빈칸 미수정: ${post.blank.length}건]`);
    post.blank.slice(0, 30).forEach(i => console.log(`  ${i.file} Q${i.qId} (${i.type}) ans=${i.answer}`));
    if (post.blank.length > 30) console.log(`  ... 외 ${post.blank.length - 30}건`);
  }
  if (post.combo.length > 0) {
    console.log(`\n[조합 미수정: ${post.combo.length}건]`);
    post.combo.slice(0, 20).forEach(i => console.log(`  ${i.file} Q${i.qId} (${i.type}) ans=${i.answer}`));
    if (post.combo.length > 20) console.log(`  ... 외 ${post.combo.length - 20}건`);
  }
  if (post.under.length > 0) {
    console.log(`\n[밑줄 미수정: ${post.under.length}건]`);
    post.under.slice(0, 20).forEach(i => console.log(`  ${i.file} Q${i.qId} (${i.type})`));
    if (post.under.length > 20) console.log(`  ... 외 ${post.under.length - 20}건`);
  }
} else {
  console.log('\n모든 이슈 해결 완료!');
}
console.log('\n완료.');
