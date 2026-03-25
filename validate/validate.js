#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — validate.js
 * Validates a JSON test data file against 53 checkpoints.
 *
 * Usage: node validate/validate.js data/모의고사/고1/3월/18번/단어.json
 *        node validate/validate.js --all   (validates all JSON in data/)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Severity levels ──
const SEV = { S: 'S', A: 'A', B: 'B', C: 'C' };

class ValidationResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.errors = [];   // { id, sev, msg }
    this.warnings = []; // { id, sev, msg }
  }
  add(id, sev, msg) {
    const entry = { id, sev, msg };
    if (sev === SEV.S || sev === SEV.A) this.errors.push(entry);
    else this.warnings.push(entry);
  }
  get pass() { return this.errors.length === 0; }
}

function validate(jsonPath) {
  const result = new ValidationResult(jsonPath);

  // ── Read & parse ──
  let raw, data;
  try {
    raw = fs.readFileSync(jsonPath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    result.add('PARSE', SEV.S, `JSON parse error: ${e.message}`);
    return result;
  }

  const { testType, ei, fullPassage, questions } = data;

  // ── S1: questions.length === 20 ──
  if (!Array.isArray(questions)) {
    result.add('S1', SEV.S, 'questions is not an array');
    return result;
  }
  if (questions.length !== 20) {
    result.add('S1', SEV.S, `questions.length = ${questions.length}, expected 20`);
  }

  // ── S2: sum(pts) === 100 ──
  const totalPts = questions.reduce((s, q) => s + (q.pts || 0), 0);
  if (totalPts !== 100) {
    result.add('S2', SEV.S, `sum(pts) = ${totalPts}, expected 100`);
  }

  // ── S3: 쉬움 x 4 = 5 ──
  const easy = questions.filter(q => q.diff === '쉬움' && q.pts === 4);
  if (easy.length !== 5) {
    result.add('S3', SEV.S, `쉬움(4점) count = ${easy.length}, expected 5`);
  }

  // ── S4: 보통 x 5 = 10 ──
  const mid = questions.filter(q => q.diff === '보통' && q.pts === 5);
  if (mid.length !== 10) {
    result.add('S4', SEV.S, `보통(5점) count = ${mid.length}, expected 10`);
  }

  // ── S5: 어려움 x 6 = 5 ──
  const hard = questions.filter(q => q.diff === '어려움' && q.pts === 6);
  if (hard.length !== 5) {
    result.add('S5', SEV.S, `어려움(6점) count = ${hard.length}, expected 5`);
  }

  // ── S6: ei constants ──
  if (!ei) {
    result.add('S6', SEV.S, 'ei object missing');
    return result;
  }
  if (ei.totalQ !== 20) result.add('S6', SEV.S, `ei.totalQ = ${ei.totalQ}, expected 20`);
  if (ei.total !== 100) result.add('S6', SEV.S, `ei.total = ${ei.total}, expected 100`);

  // ── F7: EI 8 required fields ──
  const eiFields = ['subject', 'pub', 'lesson', 'title', 'total', 'time', 'totalQ', 'histKey'];
  eiFields.forEach(f => {
    if (ei[f] === undefined || ei[f] === null || ei[f] === '') {
      result.add('F7', SEV.S, `ei.${f} is missing or empty`);
    }
  });

  // ── F8~F14: Question field checks ──
  const validDiffs = ['쉬움', '보통', '어려움'];
  const validFmts = ['mc', 'written'];

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    // F8
    if (q.id === undefined) result.add('F8', SEV.S, `Q${i}: id missing`);
    if (!q.type) result.add('F8', SEV.S, `Q${qid}: type missing`);
    if (!q.diff) result.add('F8', SEV.S, `Q${qid}: diff missing`);
    if (q.pts === undefined) result.add('F8', SEV.S, `Q${qid}: pts missing`);
    if (!q.fmt) result.add('F8', SEV.S, `Q${qid}: fmt missing`);

    // C21
    if (q.diff && !validDiffs.includes(q.diff)) {
      result.add('C21', SEV.S, `Q${qid}: diff="${q.diff}" invalid`);
    }

    // F9: mc requires ans + ch
    if (q.fmt === 'mc') {
      if (q.ans === undefined || q.ans === null) result.add('F9', SEV.S, `Q${qid}: mc missing ans`);
      if (!Array.isArray(q.ch)) result.add('F9', SEV.S, `Q${qid}: mc missing ch array`);
    }

    // F10: written requires wa + accept
    if (q.fmt === 'written') {
      if (!q.wa) result.add('F10', SEV.S, `Q${qid}: written missing wa`);
      if (!Array.isArray(q.accept)) result.add('F10', SEV.S, `Q${qid}: written missing accept array`);
    }

    // F11: passage key exists
    if (q.passage === undefined) result.add('F11', SEV.S, `Q${qid}: passage key missing`);

    // F12: stem exists and non-empty
    if (!q.stem) result.add('F12', SEV.S, `Q${qid}: stem missing or empty`);

    // F13: det exists with korean
    if (!q.det) {
      result.add('F13', SEV.A, `Q${qid}: det (detail/explanation) missing`);
    } else {
      if (!q.det.korean) result.add('F13', SEV.A, `Q${qid}: det.korean missing`);
      // F14: analysis + tip
      if (!q.det.analysis) result.add('F14', SEV.A, `Q${qid}: det.analysis missing`);
      if (!q.det.tip) result.add('F14', SEV.A, `Q${qid}: det.tip missing`);
    }

    // ── Derived values ──
    const passage = q.passage || '';
    const typeNorm = (q.type || '').trim();

    // ── C15~C18: mc consistency ──
    if (q.fmt === 'mc' && Array.isArray(q.ch)) {
      // C16: ch.length check — 5 for standard, 2 for T/F, 3~4 for 어법 빈칸
      const allowedLengths = ['T/F'].includes(typeNorm) ? [2] :
        ['어법 빈칸', '어법'].includes(typeNorm) ? [3, 4, 5] : [4, 5];
      if (!allowedLengths.includes(q.ch.length)) {
        result.add('C16', SEV.S, `Q${qid}: ch.length = ${q.ch.length}, expected ${allowedLengths.join(' or ')}`);
      }

      // C15: ans in bounds
      if (typeof q.ans === 'number' && (q.ans < 0 || q.ans >= q.ch.length)) {
        result.add('C15', SEV.S, `Q${qid}: ans=${q.ans} out of bounds [0,${q.ch.length - 1}]`);
      }

      // C17: no empty choices
      q.ch.forEach((c, ci) => {
        if (!c || c.trim() === '') result.add('C17', SEV.S, `Q${qid}: ch[${ci}] is empty`);
      });

      // C18: no duplicate choices
      const unique = new Set(q.ch.map(c => (c || '').trim().toLowerCase()));
      if (unique.size !== q.ch.length) result.add('C18', SEV.A, `Q${qid}: duplicate choices detected`);
    }

    // ── P22~P29: passage-type cross checks ──

    // P22: blank types need __________
    if (['빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론'].includes(typeNorm)) {
      if (!passage.includes('__________')) {
        result.add('P22', SEV.S, `Q${qid}: 빈칸 유형 but no __________ in passage`);
      }
    }

    // P23: 어휘/부적절 → 5 <u> tags
    if (['문맥상 부적절한 어휘', '어휘'].includes(typeNorm)) {
      const uCount = (passage.match(/<u>/g) || []).length;
      if (uCount !== 5) {
        result.add('P23', SEV.S, `Q${qid}: "${typeNorm}" needs 5 <u> tags, found ${uCount}`);
      }
    }

    // P24: (A)(B)(C) 조합형 → (A), (B), (C) markers
    if (typeNorm === '(A)(B)(C) 조합형') {
      ['(A)', '(B)', '(C)'].forEach(m => {
        if (!passage.includes(m)) result.add('P24', SEV.S, `Q${qid}: missing ${m} marker`);
      });
    }

    // P25: 어형 변환 → __________ + (원형) pattern
    if (typeNorm === '어형 변환 (서술형)') {
      if (!passage.includes('__________')) {
        result.add('P25', SEV.S, `Q${qid}: 어형 변환 missing __________`);
      }
      // Check for (word) pattern near blank
      if (!/\([\w]+\)/.test(passage)) {
        result.add('P25', SEV.S, `Q${qid}: 어형 변환 missing (원형) pattern`);
      }
    }

    // P26: 동의어/반의어 → passage should be short
    if (['동의어 고르기', '반의어 고르기'].includes(typeNorm)) {
      const plainText = passage.replace(/<[^>]+>/g, '');
      const sentences = plainText.split(/[.!?]+/).filter(s => s.trim());
      if (sentences.length > 5) {
        result.add('P26', SEV.A, `Q${qid}: "${typeNorm}" passage seems too long (${sentences.length} sentences)`);
      }
    }

    // P27: 영영풀이 → passage should be empty
    if (typeNorm === '영영풀이 매칭') {
      if (passage && passage.trim() !== '') {
        result.add('P27', SEV.A, `Q${qid}: 영영풀이 매칭 should have empty passage`);
      }
    }

    // P28: 어법 5지선다 (not 어법 빈칸) → <u> + ①②③④⑤ markers
    if (typeNorm === '어법' && q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length === 5) {
      const circled = ['①', '②', '③', '④', '⑤'];
      circled.forEach(c => {
        if (!passage.includes(c)) result.add('P28', SEV.S, `Q${qid}: 어법 missing ${c} marker`);
      });
    }

    // P29: 문장삽입 → ①②③④ markers
    if (typeNorm === '문장삽입') {
      ['①', '②', '③', '④'].forEach(c => {
        if (!passage.includes(c)) result.add('P29', SEV.S, `Q${qid}: 문장삽입 missing ${c} position marker`);
      });
    }

    // ── X30~X34: content pollution ──
    const allText = [passage, q.stem || '', JSON.stringify(q.det || {})].join(' ');

    // X30
    if (/\[ERROR\]|\[error\]|ERROR:/i.test(allText)) {
      result.add('X30', SEV.S, `Q${qid}: contains ERROR pattern`);
    }

    // X31
    if (/\bundefined\b|\bnull\b|\bNaN\b/.test(allText.replace(/"[^"]*"/g, ''))) {
      // Only flag if not inside a JSON string value context
      // Simple heuristic: check in stem and passage directly
      const directText = (q.stem || '') + ' ' + (passage || '');
      if (/\bundefined\b|\bNaN\b/.test(directText)) {
        result.add('X31', SEV.S, `Q${qid}: contains undefined/NaN literal`);
      }
    }

    // X32
    if (/\bTODO\b|\bFIXME\b|\bPLACEHOLDER\b|\bINSERT HERE\b/i.test(allText)) {
      result.add('X32', SEV.A, `Q${qid}: contains TODO/FIXME/PLACEHOLDER`);
    }

    // X33
    if (/\?\?\?|xxx|---/.test(allText)) {
      // Exclude legitimate uses (e.g., in Korean text or --- as separator)
      if (/\?\?\?/.test(passage) || /\bxxx\b/i.test(passage)) {
        result.add('X33', SEV.A, `Q${qid}: contains placeholder pattern (???, xxx)`);
      }
    }

    // X34: broken characters
    if (/\uFFFD/.test(allText)) {
      result.add('X34', SEV.A, `Q${qid}: contains broken character (U+FFFD)`);
    }

    // ── D43~D48: answer-explanation consistency ──
    if (q.det) {
      // D46: min 10 chars each
      if (q.det.korean && q.det.korean.replace(/<[^>]+>/g, '').length < 10) {
        result.add('D46', SEV.A, `Q${qid}: det.korean under 10 chars`);
      }
      if (q.det.analysis && q.det.analysis.replace(/<[^>]+>/g, '').length < 10) {
        result.add('D46', SEV.A, `Q${qid}: det.analysis under 10 chars`);
      }
      if (q.det.tip && q.det.tip.replace(/<[^>]+>/g, '').length < 5) {
        result.add('D46', SEV.A, `Q${qid}: det.tip under 5 chars`);
      }
    }

    // ── W49~W50: 어순배열 special ──
    if (typeNorm === '어순배열' && q.fmt === 'written' && q.wa) {
      if (passage.includes(q.wa)) {
        result.add('W49', SEV.S, `Q${qid}: 어순배열 answer "${q.wa}" visible in passage`);
      }
    }
    // W50: blank format
    if (passage.includes('(     )') || passage.includes('(      )')) {
      result.add('W50', SEV.A, `Q${qid}: blanks should be __________ not (    )`);
    }
  });

  // ── C19: id 1~20 continuous, no dups ──
  const ids = questions.map(q => q.id).sort((a, b) => a - b);
  const expectedIds = Array.from({ length: 20 }, (_, i) => i + 1);
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    result.add('C19', SEV.S, `ids not 1~20 continuous: [${ids.join(',')}]`);
  }

  // ── C20: histKey pattern ──
  if (ei.histKey && !/^(wordTest|workbookTest|quizTest)_.+_v[0-9]+$/.test(ei.histKey)) {
    result.add('C20', SEV.B, `histKey "${ei.histKey}" doesn't match pattern`);
  }

  // ── T39: Quiz ordering (순서/삽입 FIRST, 어법/어휘 SECOND, 서술형/내용/TF LAST) ──
  if (testType === '퀴즈') {
    const firstTypes = ['순서배열', '글순서', '문장삽입', '어순배열'];
    const secondTypes = ['어법', '어휘', '어법 빈칸', '문맥상 부적절한 어휘'];
    const lastTypes = ['서술형', '내용이해', '내용일치', '내용불일치', 'T/F', '빈칸추론', '빈칸 추론'];

    let phase = 'first';
    questions.forEach(q => {
      const t = (q.type || '').trim();
      if (firstTypes.includes(t)) {
        if (phase !== 'first') result.add('T39', SEV.A, `Q${q.id}: ${t} should be in FIRST group`);
      } else if (secondTypes.includes(t)) {
        if (phase === 'first') phase = 'second';
        if (phase === 'last') result.add('T39', SEV.A, `Q${q.id}: ${t} should be in SECOND group`);
      } else {
        if (phase !== 'last') phase = 'last';
      }
    });
  }

  // ── R51~R53: 모의고사 문항번호 적합성 (경고만) ──
  if (ei.subject && ei.subject.includes('모의고사')) {
    const pubNum = parseInt(ei.pub);
    if (!isNaN(pubNum)) {
      // R51: excluded numbers
      if ([25, 27, 28].includes(pubNum)) {
        result.add('R51', SEV.C, `문항번호 ${pubNum}번은 출제 제외 번호입니다`);
      }
      // R52: short passages shouldn't have 순서/삽입/어순배열
      if ([18, 19, 20, 26].includes(pubNum)) {
        const badTypes = ['순서배열', '글순서', '문장삽입', '어순배열'];
        questions.forEach(q => {
          if (badTypes.includes(q.type)) {
            result.add('R52', SEV.C, `Q${q.id}: 짧은 지문(${pubNum}번)에 ${q.type} 출제`);
          }
        });
      }
      // R53: mid passages + 문장삽입
      if ([21, 22, 23, 24, 29, 30, 31, 32, 33, 34].includes(pubNum)) {
        questions.forEach(q => {
          if (q.type === '문장삽입') {
            result.add('R53', SEV.C, `Q${q.id}: 중간 지문(${pubNum}번)에 문장삽입 — 길이 확인 필요`);
          }
        });
      }
    }
  }

  // ── Fullpassage check ──
  if (!fullPassage || fullPassage.trim().length === 0) {
    result.add('FP', SEV.S, 'fullPassage is empty');
  }

  // ── testType check ──
  if (!['단어', '워크북', '퀴즈'].includes(testType)) {
    result.add('TT', SEV.S, `testType="${testType}" invalid`);
  }

  // ── P1~P4: Passage excerpt validation (신규) ──
  const fullTextTypes = [
    '빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론', '빈칸 추론',
    '문맥상 부적절한 어휘', '(A)(B)(C) 조합형',
    '어형 변환 (서술형)', '내용일치', '내용불일치', '내용이해',
    'T/F', '어법', '어법 빈칸', '문장삽입'
  ];

  const fpPlainLen = fullPassage ? fullPassage.replace(/<[^>]+>/g, '').length : 0;

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    const typeNorm = (q.type || '').trim();
    const passage = q.passage || '';

    // P1: passage length >= fullPassage * 0.5 for full-text-required types
    if (fullTextTypes.includes(typeNorm) && passage !== '__FULL__') {
      const passagePlainLen = passage.replace(/<[^>]+>/g, '').length;
      if (fpPlainLen > 0 && passagePlainLen < fpPlainLen * 0.5) {
        result.add('P1', SEV.A, `Q${qid}: passage too short for "${typeNorm}" (${passagePlainLen}/${fpPlainLen} chars, < 50%)`);
      }
    }

    // P2: passage contains fullPassage text (not random text)
    // For non-__FULL__ passages, check that major phrases from passage exist in fullPassage
    if (passage && passage !== '__FULL__' && fullPassage && passage.length > 50) {
      const passagePlain = passage.replace(/<[^>]+>/g, '')
        .replace(/__________/g, '')
        .replace(/<b>\([ABC]\)<\/b>/g, '')
        .replace(/[①②③④⑤]/g, '');
      // Extract 3 random 20-char chunks and verify they exist in fullPassage
      const cleanFP = fullPassage.replace(/<[^>]+>/g, '');
      const chunks = [];
      for (let ci = 0; ci < 3 && ci * 40 + 20 < passagePlain.length; ci++) {
        const start = ci * 40 + 10;
        chunks.push(passagePlain.substring(start, start + 20).trim());
      }
      const matchCount = chunks.filter(c => c.length > 5 && cleanFP.includes(c)).length;
      if (chunks.length >= 2 && matchCount === 0) {
        result.add('P2', SEV.A, `Q${qid}: passage text doesn't match fullPassage — possible wrong excerpt`);
      }
    }

    // P3: No literal \\u unicode escapes in any string field
    const allFields = [passage, q.stem || '', JSON.stringify(q.det || {}), JSON.stringify(q.ch || [])].join(' ');
    if (/\\u[0-9a-fA-F]{4}/.test(allFields)) {
      result.add('P3', SEV.A, `Q${qid}: contains literal \\u escape sequence (should be decoded)`);
    }

    // P4: No placeholder text in choices
    if (Array.isArray(q.ch)) {
      q.ch.forEach((c, ci) => {
        if (/^보기[0-9]$/.test((c || '').trim()) || /^선택지[0-9]$/.test((c || '').trim())) {
          result.add('P4', SEV.S, `Q${qid}: ch[${ci}] = "${c}" is placeholder text`);
        }
        if (/^placeholder$/i.test((c || '').trim()) || /^option\s*[0-9]$/i.test((c || '').trim())) {
          result.add('P4', SEV.S, `Q${qid}: ch[${ci}] = "${c}" is placeholder text`);
        }
      });
    }
    // Also check stem for placeholder
    if (q.stem && /^발문$|^문제$|^stem$/i.test(q.stem.trim())) {
      result.add('P4', SEV.S, `Q${qid}: stem = "${q.stem}" is placeholder text`);
    }
  });

  return result;
}

// ── CLI ──
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node validate/validate.js <json-file>');
    console.error('       node validate/validate.js --all');
    process.exit(1);
  }

  let files = [];
  if (args[0] === '--all') {
    const dataDir = path.join(ROOT, 'data');
    if (fs.existsSync(dataDir)) {
      files = findJsonFiles(dataDir);
    }
    if (files.length === 0) {
      console.log('No JSON files found in data/');
      process.exit(0);
    }
  } else {
    files = [path.resolve(args[0])];
  }

  let totalPass = 0, totalFail = 0, totalWarn = 0;

  files.forEach(f => {
    const result = validate(f);
    const relPath = path.relative(ROOT, f);

    if (result.pass) {
      totalPass++;
      const warnCount = result.warnings.length;
      if (warnCount > 0) {
        totalWarn += warnCount;
        console.log(`[PASS] ${relPath} (${warnCount} warnings)`);
        result.warnings.forEach(w => console.log(`  [${w.sev}] ${w.id}: ${w.msg}`));
      } else {
        console.log(`[PASS] ${relPath}`);
      }
    } else {
      totalFail++;
      console.log(`[FAIL] ${relPath} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
      result.errors.forEach(e => console.log(`  [${e.sev}] ${e.id}: ${e.msg}`));
      result.warnings.forEach(w => console.log(`  [${w.sev}] ${w.id}: ${w.msg}`));
    }
  });

  if (files.length > 1) {
    console.log(`\n--- Summary ---`);
    console.log(`Total: ${files.length} | PASS: ${totalPass} | FAIL: ${totalFail} | Warnings: ${totalWarn}`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

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

// Export for use by build.js
module.exports = { validate };

if (require.main === module) main();
