#!/usr/bin/env node
/**
 * fix-passage-safe.js — S-PASSAGE-NOT-FULL 안전 수정
 *
 * 원칙: passage = fullPassage + overlay 재적용. overlay 없는 유형만 직접 교체.
 * 빈칸/마커 등 overlay가 필요한데 overlay 데이터가 없으면 SKIP (학생에게 빈칸이 안 보이는 게 더 심각)
 *
 * 수정 후 반드시 student-experience-check.js HIGH=0 확인
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const isAll = args.includes('--all');

// passage = fullPassage 그대로 사용 가능한 유형 (overlay 불필요)
const DIRECT_REPLACE_TYPES = new Set([
  '내용이해 T/F', '내용 일치/불일치', '내용일치', '내용불일치',
  '주제', '요지', '제목', '주제/요지',
  '내용이해', '대의',
  '서술형 — 핵심단어'  // passage에서 찾기 유형
]);

// overlay.blank 이 있어야만 교체 가능한 유형
const BLANK_OVERLAY_TYPES = new Set([
  '빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론',
  '어순배열', '서술형 — 조건영작', '서술형 — 영작',
  '서술형 — 문장완성'
]);

// overlay.underline 이 있어야만 교체 가능한 유형
const UNDERLINE_OVERLAY_TYPES = new Set([
  '동의어 고르기', '반의어 고르기', '함축의미 추론', '지칭추론'
]);

// overlay.markers 가 있어야만 교체 가능한 유형
const MARKER_OVERLAY_TYPES = new Set([
  '어법', '문맥상 부적절한 어휘', '부적절'
]);

// 발췌가 정상인 유형 (fullPassage 교체 안 함)
const EXEMPT_TYPES = new Set([
  '어형 변환', '어형 변환 (서술형)', '영영풀이 매칭',
  '다의어 문맥적 의미', '오류찾기', '순서배열',
  '문장삽입' // 문장삽입은 마커 위치가 중요
]);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.') && e.name !== 'node_modules')
      out.push(...walk(path.join(dir, e.name)));
    else if (['단어.json', '워크북.json', '퀴즈.json'].includes(e.name))
      out.push(path.join(dir, e.name));
  }
  return out;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * fullPassage에 overlay.blank 적용 → 빈칸 삽입
 */
function applyBlank(fullPassage, blank) {
  if (!blank) return null;
  const blankEsc = esc(blank);
  // fullPassage에서 blank 단어를 찾아 ____ 로 교체
  const re = new RegExp(blankEsc, 'i');
  if (!re.test(fullPassage)) return null;
  return fullPassage.replace(re, '____');
}

/**
 * fullPassage에 overlay.underline 적용
 */
function applyUnderline(fullPassage, underline) {
  if (!underline) return null;
  const ulEsc = esc(underline);
  const re = new RegExp('(?<!<u>)' + ulEsc + '(?!</u>)');
  if (!re.test(fullPassage)) return null;
  return fullPassage.replace(re, `<u>${underline}</u>`);
}

/**
 * fullPassage에 overlay.markers 적용 (어법/부적절)
 */
function applyMarkers(fullPassage, markers) {
  if (!markers || typeof markers !== 'object') return null;
  let result = fullPassage;
  const MK = ['①', '②', '③', '④', '⑤'];

  for (const mk of MK) {
    const val = markers[mk];
    if (!val) continue;

    let targetWord;
    if (typeof val === 'object' && val.display) {
      targetWord = val.display;
    } else if (typeof val === 'string') {
      targetWord = val;
    } else {
      continue;
    }

    const wordEsc = esc(targetWord);
    const re = new RegExp('(?<![①②③④⑤])' + wordEsc);
    if (re.test(result)) {
      result = result.replace(re, mk + targetWord);
    } else {
      // 마커 단어를 fullPassage에서 못 찾음 → 실패
      return null;
    }
  }
  return result;
}

function processFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fp = data.fullPassage;
  if (!fp) return { fixed: 0, skipped: 0 };

  // 모의고사/부교재만 처리
  const rel = path.relative(ROOT, filePath);
  if (!rel.startsWith('data/모의고사') && !rel.startsWith('data/부교재')) {
    return { fixed: 0, skipped: 0 };
  }

  let fixed = 0, skipped = 0;

  for (const q of data.questions) {
    if (!q.passage) continue;

    // 이미 85% 이상이면 skip
    if (q.passage.length >= fp.length * 0.85) continue;

    const type = q.type || '';

    // 발췌 정상 유형
    if (EXEMPT_TYPES.has(type) || [...EXEMPT_TYPES].some(t => type.startsWith(t))) {
      skipped++;
      continue;
    }

    // 직접 교체 가능 유형 (overlay 불필요)
    if (DIRECT_REPLACE_TYPES.has(type)) {
      q.passage = fp;
      fixed++;
      continue;
    }

    // 빈칸형 — overlay.blank 필수
    if (BLANK_OVERLAY_TYPES.has(type) || [...BLANK_OVERLAY_TYPES].some(t => type.startsWith(t))) {
      if (q.overlay && q.overlay.blank) {
        const result = applyBlank(fp, q.overlay.blank);
        if (result && result.length >= fp.length * 0.80) {
          q.passage = result;
          fixed++;
          continue;
        }
      }
      skipped++;
      continue;
    }

    // 밑줄형 — overlay.underline 필수
    if (UNDERLINE_OVERLAY_TYPES.has(type)) {
      if (q.overlay && q.overlay.underline) {
        const result = applyUnderline(fp, q.overlay.underline);
        if (result && result.length >= fp.length * 0.85) {
          q.passage = result;
          fixed++;
          continue;
        }
      }
      // underline 없어도 fullPassage에 이미 <u> 있으면 OK
      if (fp.includes('<u>')) {
        q.passage = fp;
        fixed++;
        continue;
      }
      skipped++;
      continue;
    }

    // 마커형 — overlay.markers 필수
    if (MARKER_OVERLAY_TYPES.has(type)) {
      if (q.overlay && q.overlay.markers) {
        const result = applyMarkers(fp, q.overlay.markers);
        if (result && result.length >= fp.length * 0.85) {
          q.passage = result;
          fixed++;
          continue;
        }
      }
      skipped++;
      continue;
    }

    // (A)(B)(C) 조합형 — overlay.abc 필수
    if (type.includes('(A)(B)(C)') || type === '(A)(B)(C) 조합형') {
      if (q.overlay && q.overlay.abc) {
        // ABC 오버레이는 복잡 → skip
      }
      skipped++;
      continue;
    }

    // 기타: passage에 특수 마커 없으면 직접 교체
    const hasSpecial = /[①②③④⑤]|<u>|_{4,}|\(A\)\s*\[/.test(q.passage);
    if (!hasSpecial) {
      q.passage = fp;
      fixed++;
    } else {
      skipped++;
    }
  }

  if (fixed > 0 && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return { fixed, skipped };
}

// Main
const targetDirs = isAll ? ['data/모의고사', 'data/부교재'] : [args.find(a => !a.startsWith('--'))].filter(Boolean);
if (!targetDirs.length) {
  console.error('Usage: node scripts/fix-passage-safe.js [--dry] <dir|--all>');
  process.exit(1);
}

let totalFiles = 0, totalFixed = 0, totalSkipped = 0;

for (const dir of targetDirs) {
  const files = walk(path.join(ROOT, dir));
  for (const f of files) {
    const { fixed, skipped } = processFile(f);
    if (fixed > 0) {
      totalFiles++;
      totalFixed += fixed;
      if (dryRun && totalFiles <= 15) {
        console.log(`  WOULD FIX ${fixed}Q: ${path.relative(ROOT, f)}`);
      }
    }
    totalSkipped += skipped;
  }
}

console.log(`\n━━━ 결과 ━━━`);
console.log(`  수정 파일: ${totalFiles}`);
console.log(`  수정 문항: ${totalFixed}`);
console.log(`  skip (overlay 필요): ${totalSkipped}`);
if (dryRun) console.log(`  (드라이런)`);
