#!/usr/bin/env node
/**
 * 고1/3월_2026 자동수정 v2 — fullPassage 기반 passage 재구성
 *
 * 핵심 전략: 기존 passage의 오버레이(마커/빈칸/밑줄)를 추출하고
 * fullPassage에 동일 위치를 찾아 삽입
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'data', '모의고사', '고1', '3월_2026');

function getAllFiles() {
  const results = [];
  const dirs = fs.readdirSync(BASE).filter(d => {
    const p = path.join(BASE, d);
    return fs.statSync(p).isDirectory() && !d.startsWith('_');
  });
  for (const dir of dirs) {
    const dirPath = path.join(BASE, dir);
    const jsons = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    for (const j of jsons) {
      results.push(path.join(dirPath, j));
    }
  }
  return results;
}

// passage에서 일반 텍스트만 추출 (마커/태그 제거)
function stripAll(text) {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/[①②③④⑤]/g, '')
    .replace(/______+/g, '')
    .replace(/\(A\)|\(B\)|\(C\)/g, '')
    .replace(/\[([^\]]+)\s*\/\s*[^\]]+\]/g, '$1') // [word1 / word2] → word1
    .replace(/\s+/g, ' ')
    .trim();
}

// fullPassage에서 단어를 찾아 교체 (첫 번째 매칭만)
function replaceFirst(text, target, replacement) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped), replacement);
}

// (A)(B)(C) 조합형: fullPassage에 (A)(B)(C) 마커 삽입
function fixABC(q, fp) {
  if (!q.passage) return false;

  // 기존 passage에서 (A)(B)(C) 마커와 대체어 추출
  // 패턴: <b>(A)</b>[upcoming / previous] 또는 <b>(A)</b> [upcoming / previous]
  const abcPattern = /<b>\((A|B|C)\)<\/b>\s*\[([^\]]+)\]/g;
  const markers = [];
  let m;
  while ((m = abcPattern.exec(q.passage)) !== null) {
    const label = m[1]; // A, B, C
    const options = m[2]; // "upcoming / previous"
    const parts = options.split('/').map(s => s.trim());
    markers.push({ label, options: m[2], correctWord: parts[0], allOptions: parts, full: m[0] });
  }

  if (markers.length < 2) return false; // 마커 부족하면 skip

  // fullPassage에서 정답 단어 위치 찾아 마커 삽입
  let newPassage = fp;
  let replaced = 0;
  for (const mk of markers) {
    // 정답 단어가 ch에서 어디 위치인지 확인하여 원문에서의 단어 찾기
    const correctWord = mk.correctWord;
    const escaped = correctWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`);

    if (regex.test(newPassage)) {
      newPassage = newPassage.replace(regex, `<b>(${mk.label})</b>[${mk.options}]`);
      replaced++;
    }
  }

  if (replaced >= 2) {
    q.passage = newPassage;
    return true;
  }
  return false;
}

// 부적절 어휘: fullPassage에 ①②③④<u>word</u> 마커 삽입
function fixInadequate(q, fp) {
  if (!q.passage) return false;

  // 기존 passage에서 마커+밑줄 단어 추출
  const markerPattern = /([①②③④⑤])\s*<u>([^<]+)<\/u>/g;
  const markers = [];
  let m;
  while ((m = markerPattern.exec(q.passage)) !== null) {
    markers.push({ marker: m[1], word: m[2] });
  }

  if (markers.length < 3) return false;

  // fullPassage에서 각 단어 찾아 마커 삽입
  let newPassage = fp;
  let replaced = 0;

  for (const { marker, word } of markers) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 이미 마커가 있는지 확인
    if (newPassage.includes(`${marker}<u>${word}</u>`)) {
      replaced++;
      continue;
    }
    // 단어 경계 매칭
    const regex = new RegExp(`(?<![①②③④⑤]<u>)\\b${escaped}\\b(?!</u>)`);
    if (regex.test(newPassage)) {
      newPassage = newPassage.replace(regex, `${marker}<u>${word}</u>`);
      replaced++;
    }
  }

  if (replaced >= markers.length) {
    q.passage = newPassage;
    return true;
  }
  return false;
}

// 빈칸: fullPassage에서 정답 단어를 ______로 교체
function fixBlank(q, fp) {
  if (!q.passage || !q.passage.includes('______')) return false;

  const ansIdx = q.ans;
  const ch = q.ch || [];
  if (!ansIdx || ansIdx < 1 || ansIdx > ch.length) return false;

  const ansWord = ch[ansIdx - 1];
  if (!ansWord) return false;

  const escaped = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');

  if (regex.test(fp)) {
    q.passage = fp.replace(regex, '______');
    return true;
  }
  return false;
}

// 동의어/반의어/함축/지칭: fullPassage에 <u>word</u> 삽입
function fixUnderline(q, fp) {
  if (!q.passage) return false;

  const ulMatch = q.passage.match(/<u>([^<]+)<\/u>/);
  if (!ulMatch) return false;

  const targetWord = ulMatch[1];
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let newPassage = fp;

  // 다의어: (A)(B) 예문 부분 보존
  const type = q.type || '';
  if (type.includes('다의어')) {
    const abMatch = q.passage.match(/(<br><br>\(A\).*$)/s);
    const abPart = abMatch ? abMatch[1] : '';
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(newPassage)) {
      newPassage = newPassage.replace(regex, `<u>${targetWord}</u>`) + abPart;
      q.passage = newPassage;
      return true;
    }
    return false;
  }

  // 일반 밑줄: fullPassage에 밑줄 삽입
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  if (regex.test(newPassage)) {
    newPassage = newPassage.replace(regex, `<u>${targetWord}</u>`);
    q.passage = newPassage;
    return true;
  }
  return false;
}

// 어형변환 서술형: passage에서 마커 제거
function fixWrittenMarkers(q) {
  if (!q.passage) return false;
  if (/[①②③④⑤]/.test(q.passage)) {
    q.passage = q.passage
      .replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1')
      .replace(/[①②③④⑤]/g, '');
    return true;
  }
  return false;
}

// 내용유형: passage를 fullPassage로 단순 교체
function fixContentType(q, fp) {
  if (!q.passage) return false;
  if (q.passage.length / fp.length < 0.85) {
    q.passage = fp;
    return true;
  }
  return false;
}

function fixFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fp = data.fullPassage;
  if (!fp) return 0;

  let fixes = 0;
  const qs = data.questions || [];

  for (const q of qs) {
    const type = q.type || '';
    const fmt = q.fmt || '';
    const hasPassage = q.passage && q.passage.length > 0;
    const ratio = hasPassage ? q.passage.length / fp.length : 0;

    // 영영풀이: passage null
    if (type.includes('영영풀이')) {
      if (q.passage !== null) { q.passage = null; fixes++; }
      continue;
    }

    // 서술형: 마커 제거만
    if (fmt === 'written') {
      if (fixWrittenMarkers(q)) fixes++;
      continue;
    }

    // passage가 없거나 이미 85% 이상이면 skip (마커 누출 제외)
    if (!hasPassage) continue;

    // 마커 누출 제거 (비마커 유형)
    const isMarkerType = type.includes('부적절') || type.includes('어법') || type.includes('오류');
    if (!isMarkerType && /[①②③④⑤]/.test(q.passage)) {
      q.passage = q.passage
        .replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1')
        .replace(/[①②③④⑤]/g, '');
      fixes++;
    }

    // S-PASSAGE-NOT-FULL: 85% 미만만 처리
    if (ratio >= 0.85) continue;

    let fixed = false;

    if (type.includes('(A)(B)(C)')) {
      fixed = fixABC(q, fp);
    } else if (type.includes('부적절') || type.includes('어법') || type.includes('오류')) {
      fixed = fixInadequate(q, fp);
    } else if (type.includes('빈칸')) {
      fixed = fixBlank(q, fp);
    } else if (type.includes('동의어') || type.includes('반의어') || type.includes('함축') || type.includes('지칭')) {
      fixed = fixUnderline(q, fp);
    } else if (type.includes('내용') || type.includes('주제') || type.includes('제목') || type.includes('요지') || type.includes('T/F')) {
      fixed = fixContentType(q, fp);
    } else {
      // 기타: fullPassage로 교체
      q.passage = fp;
      fixed = true;
    }

    if (fixed) fixes++;
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  return fixes;
}

// Main
const files = getAllFiles();
console.log(`\n=== 고1/3월_2026 자동수정 v2 ===`);
console.log(`대상: ${files.length}파일\n`);

let totalFixes = 0;
let fixedFiles = 0;
for (const f of files) {
  const n = fixFile(f);
  if (n > 0) {
    const rel = path.relative(BASE, f);
    console.log(`  FIXED ${n}건: ${rel}`);
    fixedFiles++;
  }
  totalFixes += n;
}

console.log(`\n${fixedFiles}파일에서 총 ${totalFixes}건 수정 완료.`);
