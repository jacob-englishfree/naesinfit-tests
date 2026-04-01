#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — validate-fulltext.js
 * Layer ②: 원문 100% 대조 검증
 *
 * passage와 fullPassage를 글자 단위로 비교.
 * 의도적 변형(빈칸, 밑줄, 마커, __FULL__)만 허용하고 나머지 변조는 전부 차단.
 *
 * Usage: node validate/validate-fulltext.js data/.../단어.json
 *        node validate/validate-fulltext.js --all
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Severity ──
const SEV = { S: 'S', A: 'A', B: 'B', C: 'C' };

class FulltextResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.errors = [];
    this.warnings = [];
  }
  add(id, sev, msg) {
    const entry = { id, sev, msg };
    if (sev === SEV.S || sev === SEV.A) this.errors.push(entry);
    else this.warnings.push(entry);
  }
  get pass() { return this.errors.length === 0; }
}

/**
 * Normalize passage by stripping intentional modifications:
 * - <b>(A)</b>, <b>(B)</b>, <b>(C)</b> markers → empty
 * - <u>...</u> → inner text only
 * - ①②③④⑤ circled numbers → empty
 * - __________ blanks → empty
 * - HTML tags → empty
 * - Whitespace normalization
 */
function normalizePassage(text) {
  if (!text) return '';
  let s = text;
  // Remove (A)(B)(C) bold markers
  s = s.replace(/<b>\([ABC]\)<\/b>\s*/g, '');
  // Remove <u> tags but keep inner text
  s = s.replace(/<\/?u>/g, '');
  // Remove [정답 / 오답] bracket pairs → keep first word (original)
  s = s.replace(/\[([^\]\/]+)\s*\/\s*[^\]]+\]/g, (_, first) => first.trim());
  // Remove circled numbers and their surrounding whitespace
  s = s.replace(/\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/g, ' ');
  // Remove blanks (5+ underscores)
  s = s.replace(/_{3,}/g, '');
  // Remove (A)(B)(C) text markers (non-bold)
  s = s.replace(/\([ABC]\)\s*/g, '');
  // Remove parenthesized word forms for 어형변환: (word)
  // Only remove if it's right after a blank area
  s = s.replace(/\([\w]+\)/g, '');
  // Remove all HTML tags
  s = s.replace(/<[^>]+>/g, '');
  // Normalize quotes and special chars
  s = s.replace(/['']/g, "'");
  s = s.replace(/[""]/g, '"');
  s = s.replace(/[—–]/g, '-');
  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function normalizeFullPassage(text) {
  if (!text) return '';
  let s = text;
  // Remove HTML tags
  s = s.replace(/<[^>]+>/g, '');
  // Decode common unicode escapes
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Normalize quotes and special chars
  s = s.replace(/['']/g, "'");
  s = s.replace(/[""]/g, '"');
  s = s.replace(/[—–]/g, '-');
  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Character-level diff: find segments in normalizedPassage that don't exist in normalizedFull
 */
function findMismatches(normPassage, normFull, windowSize = 15) {
  if (!normPassage || !normFull) return [];

  const mismatches = [];
  let i = 0;

  while (i < normPassage.length) {
    // Try to find a window-sized chunk starting at i
    const end = Math.min(i + windowSize, normPassage.length);
    const chunk = normPassage.substring(i, end);

    if (chunk.trim().length < 3) {
      i++;
      continue;
    }

    if (normFull.includes(chunk)) {
      // Found — advance past this chunk
      i = end;
    } else {
      // Try smaller chunks to find the exact mismatch point
      let found = false;
      for (let size = windowSize - 1; size >= 5; size--) {
        const smallChunk = normPassage.substring(i, i + size);
        if (normFull.includes(smallChunk)) {
          i += size;
          found = true;
          break;
        }
      }
      if (!found) {
        // This segment doesn't exist in fullPassage at all
        // Find how far the mismatch extends
        let mismatchEnd = i + 1;
        while (mismatchEnd < normPassage.length) {
          const ahead = normPassage.substring(mismatchEnd, mismatchEnd + 10);
          if (ahead.trim().length >= 5 && normFull.includes(ahead)) break;
          mismatchEnd++;
        }
        const mismatchText = normPassage.substring(i, mismatchEnd).trim();
        if (mismatchText.length >= 3) {
          mismatches.push({
            position: i,
            text: mismatchText.substring(0, 60),
            length: mismatchText.length
          });
        }
        i = mismatchEnd;
      }
    }
  }

  return mismatches;
}

/**
 * Calculate match ratio: what % of passage exists in fullPassage
 */
function calcMatchRatio(normPassage, normFull, chunkSize = 8) {
  if (!normPassage || normPassage.length < chunkSize) return 1;
  if (!normFull) return 0;

  let matched = 0;
  let total = 0;

  for (let i = 0; i <= normPassage.length - chunkSize; i += chunkSize) {
    const chunk = normPassage.substring(i, i + chunkSize);
    if (chunk.trim().length < 3) continue;
    total++;
    if (normFull.includes(chunk)) matched++;
  }

  return total === 0 ? 1 : matched / total;
}

// ── Types that MUST contain nearly the full original passage ──
// 어법/(A)(B)(C)/문장삽입은 의도적으로 마커 삽입 시 passage가 짧아질 수 있음 → 제외
const STRICT_FULL_TYPES = [
  '내용일치', '내용불일치', '내용이해'
];

// ── Types that use full passage but may trim slightly ──
const FULL_TEXT_TYPES = [
  ...STRICT_FULL_TYPES,
  '빈칸 문맥 완성', '빈칸추론', '빈칸 추론',
  '내용일치', '내용불일치', '내용이해'
];

// ── Types where passage is intentionally different/short (skip match ratio checks) ──
// 이 유형들은 원문 발췌/마커 삽입/선택지 변형이 의도적이므로 원문대조 면제
const EXCERPT_TYPES = [
  '동의어 고르기', '반의어 고르기', '영영풀이 매칭',
  '빈칸 어휘 완성', 'T/F', 'TF', '어형 변환 (서술형)', '어형 변환',
  '순서배열', '글순서', '어순배열', '서술형',
  '다의어 문맥적 의미', '오류찾기', '의미파악', '한영', '한→영',
  '어휘', '주제', '주제/요지', '제목', '요약', '요약문',
  '함축의미 추론', '무관문장', '무관', '지칭추론', '지칭', '연결사',
  // 아래: 마커 삽입으로 원문과 달라지는 유형
  '어법', '어법 빈칸', '문맥상 부적절한 어휘', '부적절한 어휘',
  '(A)(B)(C) 조합형', '문장삽입',
  '빈칸 문맥 완성', '빈칸추론', '빈칸 추론',
];

function validateFulltext(jsonPath, opts = {}) {
  const result = new FulltextResult(jsonPath);
  // strict mode: true for new files (blocks deploy), false for legacy (warnings only)
  const strict = opts.strict !== undefined ? opts.strict : false;
  // Auto-detect: if version >= 2, it's a pipeline-created file → strict
  let autoStrict = strict;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    result.add('FT-PARSE', SEV.S, `JSON parse error: ${e.message}`);
    return result;
  }

  if (data.version && data.version >= 2) autoStrict = true;
  const blockSev = autoStrict ? SEV.S : SEV.A; // S blocks deploy, A just warns

  const { fullPassage, questions } = data;

  if (!fullPassage || fullPassage.trim().length === 0) {
    result.add('FT-01', blockSev, 'fullPassage is empty');
    return result;
  }

  const normFull = normalizeFullPassage(fullPassage);

  if (!Array.isArray(questions)) {
    result.add('FT-02', SEV.S, 'questions is not an array');
    return result;
  }

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    const passage = q.passage || '';
    const typeNorm = (q.type || '').trim();

    // Skip __FULL__ references — they use fullPassage directly
    if (passage === '__FULL__') return;

    // Skip excerpt types (동의어/반의어/영영풀이 등 — passage is deliberately different)
    if (EXCERPT_TYPES.includes(typeNorm) && !FULL_TEXT_TYPES.includes(typeNorm)) return;

    // Skip empty passages for types that don't need them
    if (!passage || passage.trim().length < 20) return;

    const normPassage = normalizePassage(passage);

    // ── FT-10: Match ratio check ──
    // 교과서 발췌 passage는 일치율이 낮을 수 있으므로 B레벨로 완화
    const isTextbookFile = jsonPath.includes('교과서');
    const ratio = calcMatchRatio(normPassage, normFull);

    if (ratio < 0.5) {
      result.add('FT-10', isTextbookFile ? SEV.B : blockSev,
        `Q${qid}: passage 원문 일치율 ${(ratio * 100).toFixed(0)}% (< 50%) — 원문 변조 의심`);
    } else if (ratio < 0.7) {
      result.add('FT-11', SEV.B,
        `Q${qid}: passage 원문 일치율 ${(ratio * 100).toFixed(0)}% (< 70%) — 부분 변조 확인 필요`);
    } else if (ratio < 0.85) {
      result.add('FT-12', SEV.C,
        `Q${qid}: passage 원문 일치율 ${(ratio * 100).toFixed(0)}% (< 85%) — 미세 변조 가능성`);
    }

    // ── FT-20: Find specific mismatched segments ──
    if (ratio < 0.95) {
      const mismatches = findMismatches(normPassage, normFull);
      mismatches.forEach((m, mi) => {
        if (mi < 3) { // Report max 3 mismatches per question
          result.add('FT-20', (ratio < 0.8 && !isTextbookFile) ? SEV.A : SEV.B,
            `Q${qid}: 불일치 구간 [pos ${m.position}]: "${m.text}${m.length > 60 ? '...' : ''}"`);
        }
      });
    }

    // ── FT-30: Passage contains text NOT in fullPassage (additions) ──
    // Check if passage has extra sentences not in original
    const passageSentences = normPassage.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const addedSentences = passageSentences.filter(s => {
      const trimmed = s.trim();
      // Check if at least 80% of the sentence exists in fullPassage
      return calcMatchRatio(trimmed, normFull, 6) < 0.5;
    });

    if (addedSentences.length > 0) {
      result.add('FT-30', isTextbookFile ? SEV.B : SEV.A,
        `Q${qid}: 원문에 없는 문장 ${addedSentences.length}개 추가됨 — "${addedSentences[0].trim().substring(0, 50)}..."`);
    }

    // ── FT-40: For strict full-text types, passage should be ≥ 70% of fullPassage ──
    // 교과서: 15문장 이상이면 발췌 허용 (최소 8문장 = ~15% 이상이면 OK)
    // 모의고사/수능특강: 원문 전체 필수 (70% 이상)
    const isTextbook = jsonPath.includes('교과서');
    const minRatio = isTextbook ? 0.10 : 0.70; // 교과서는 10% 이상이면 발췌 허용
    if (STRICT_FULL_TYPES.includes(typeNorm)) {
      const passageLen = normPassage.length;
      const fullLen = normFull.length;
      if (fullLen > 0 && passageLen < fullLen * minRatio) {
        result.add('FT-40', isTextbook ? SEV.B : blockSev,
          `Q${qid}: "${typeNorm}" 유형인데 passage가 원문의 ${((passageLen / fullLen) * 100).toFixed(0)}%만 사용 — 원문 누락`);
      }
    }
  });

  // ── FT-50: fullPassage 내부 검증 ──
  // Check for common AI artifacts in fullPassage itself
  if (/\[.*?원문.*?\]|\[.*?출처.*?\]|\[.*?참고.*?\]/i.test(fullPassage)) {
    result.add('FT-50', SEV.A, 'fullPassage에 메타 태그([원문], [출처] 등) 포함');
  }

  if (/\\u[0-9a-fA-F]{4}/.test(fullPassage)) {
    result.add('FT-51', SEV.A, 'fullPassage에 이스케이프된 유니코드(\\uXXXX) 포함 — 디코딩 필요');
  }

  return result;
}

// ── CLI ──
function findJsonFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validate/validate-fulltext.js <json-file>');
    console.error('       node validate/validate-fulltext.js --all');
    process.exit(1);
  }

  let files = [];
  if (args[0] === '--all') {
    const dataDir = path.join(ROOT, 'data');
    if (fs.existsSync(dataDir)) {
      files = findJsonFiles(dataDir).filter(f => !f.includes('/dist/'));
    }
    if (files.length === 0) { console.log('No JSON files found.'); process.exit(0); }
  } else {
    files = [path.resolve(args[0])];
  }

  let totalPass = 0, totalFail = 0;
  files.forEach(f => {
    const result = validateFulltext(f);
    const rel = path.relative(ROOT, f);
    if (result.pass) {
      totalPass++;
      const wc = result.warnings.length;
      if (wc > 0) {
        console.log(`[PASS] ${rel} (${wc} warnings)`);
        result.warnings.forEach(w => console.log(`  [${w.sev}] ${w.id}: ${w.msg}`));
      } else {
        console.log(`[PASS] ${rel}`);
      }
    } else {
      totalFail++;
      console.log(`[FAIL] ${rel} (${result.errors.length} errors)`);
      result.errors.forEach(e => console.log(`  [${e.sev}] ${e.id}: ${e.msg}`));
      result.warnings.forEach(w => console.log(`  [${w.sev}] ${w.id}: ${w.msg}`));
    }
  });

  if (files.length > 1) {
    console.log(`\n--- Fulltext Summary ---`);
    console.log(`Total: ${files.length} | PASS: ${totalPass} | FAIL: ${totalFail}`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

module.exports = { validateFulltext };
if (require.main === module) main();
