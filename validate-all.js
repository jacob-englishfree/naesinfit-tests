#!/usr/bin/env node
/**
 * 내신핏 테스트 자동 검수 스크립트 v2
 * - JS 문법 오류 검출 (FULL_PASSAGE 등 변수 포함)
 * - 정답 인덱스 범위 검증
 * - 서술형(wa/accept) 필드 검증
 * - 필수 필드 누락 검사
 * - 빈 passage/stem 검사
 * - 중복 ID 검사
 * - 본문(내신용교안) 어휘/passage 대조
 */

const fs = require('fs');
const path = require('path');

const REPO = '/Users/woobumpark/Desktop/naesinfit-tests';
const TARGET = path.join(REPO, '교과서');
const N = s => s.normalize('NFC');

const issues = [];
const fixes = [];
let totalFiles = 0;
let totalQuestions = 0;

// Extract Q array from HTML file, handling FULL_PASSAGE etc.
function extractQ(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Find the script section containing Q
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
  if (!scriptMatch) return { error: 'script 태그를 찾을 수 없음', content };

  // Find the script block that contains const Q
  let targetScript = null;
  for (const s of scriptMatch) {
    if (/const\s+Q\s*=/.test(s)) {
      targetScript = s.replace(/<\/?script[^>]*>/g, '');
      break;
    }
  }
  if (!targetScript) return { error: 'const Q 배열을 찾을 수 없음', content };

  // Extract only top-level variable declarations BEFORE Q array
  const qPos = targetScript.search(/const\s+Q\s*=\s*\[/);
  const beforeQ = qPos >= 0 ? targetScript.substring(0, qPos) : '';
  const preDecls = [];
  const seen = new Set();
  const declRegex = /const\s+(\w+)\s*=\s*(`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")/g;
  let dm;
  while ((dm = declRegex.exec(beforeQ)) !== null) {
    if (dm[1] !== 'Q' && dm[1] !== 'QCOUNT' && !seen.has(dm[1])) {
      seen.add(dm[1]);
      preDecls.push(`const ${dm[1]}=${dm[2]};`);
    }
  }

  // Extract Q array
  const qMatch = targetScript.match(/const\s+Q\s*=\s*\[/);
  if (!qMatch) return { error: 'const Q 배열을 찾을 수 없음', content };

  const startIdx = qMatch.index;

  // Find closing bracket
  let depth = 0, inStr = false, strCh = '', esc = false, endIdx = -1;
  for (let i = startIdx; i < targetScript.length; i++) {
    const ch = targetScript[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (inStr) { if (ch === strCh) inStr = false; continue; }
    if (ch === '`' || ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
    if (ch === '[') depth++;
    if (ch === ']') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }

  if (endIdx === -1) return { error: 'Q 배열 닫힘 괄호를 찾을 수 없음', content };

  const qStr = targetScript.substring(startIdx, endIdx).replace(/^const\s+Q\s*=\s*/, '');

  try {
    const evalCode = preDecls.join('\n') + '\nreturn ' + qStr;
    const Q = new Function(evalCode)();
    return { Q, content };
  } catch (e) {
    return { error: `JS 파싱 오류: ${e.message}`, content, rawQ: qStr, preDecls };
  }
}

// Extract source text from 내신용교안.html
function extractSourceText(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract vocab words
  const vocab = [];
  const vRegex = /class="vc-w"[^>]*>([^<]+)/g;
  let m;
  while ((m = vRegex.exec(content)) !== null) {
    vocab.push(m[1].trim().toLowerCase());
  }

  // Extract Korean meanings
  const korMeanings = [];
  const kRegex = /class="vc-k"[^>]*>([^<]+)/g;
  while ((m = kRegex.exec(content)) !== null) {
    korMeanings.push(m[1].trim());
  }

  // Extract sentences
  const sentences = [];
  const sRegex = /class="sent-en"[^>]*>([^<]+)/g;
  while ((m = sRegex.exec(content)) !== null) {
    sentences.push(m[1].trim());
  }

  const fullText = sentences.join(' ');
  return { vocab, korMeanings, sentences, fullText };
}

// Validate a single question against source text
function validateQuestion(q, idx, filePath, sourceText) {
  const qId = q.id || idx + 1;
  const qIssues = [];

  // 1. Required fields
  if (q.id === undefined || q.id === null) {
    qIssues.push({ file: filePath, qId, issue: 'id 필드 누락', severity: 'error' });
  }

  // 2. Answer validation by format
  if (q.fmt === 'written' || q.fmt === 'write') {
    // Written questions use wa/accept instead of ans
    if ((!q.wa || (typeof q.wa === 'string' && q.wa.trim() === '')) &&
        (!q.accept || !Array.isArray(q.accept) || q.accept.length === 0)) {
      qIssues.push({ file: filePath, qId, issue: '서술형 문제 정답(wa/accept) 누락', severity: 'error' });
    }
  } else if (q.fmt === 'mc' || q.ch) {
    // Multiple choice
    if (q.ans === undefined || q.ans === null) {
      qIssues.push({ file: filePath, qId, issue: '객관식 정답(ans) 누락', severity: 'error' });
    }
    if (!q.ch || !Array.isArray(q.ch)) {
      qIssues.push({ file: filePath, qId, issue: 'ch(선택지) 배열 누락', severity: 'error' });
    } else {
      if (q.ans !== undefined && q.ans !== null && (q.ans < 0 || q.ans >= q.ch.length)) {
        qIssues.push({ file: filePath, qId, issue: `정답 인덱스(${q.ans}) 범위 초과 (선택지 ${q.ch.length}개)`, severity: 'error', autofix: true });
      }
      // Empty choices
      q.ch.forEach((c, ci) => {
        if (!c || (typeof c === 'string' && c.trim() === '')) {
          qIssues.push({ file: filePath, qId, issue: `선택지 ${ci + 1}번이 비어있음`, severity: 'warning' });
        }
      });
    }
  }

  // 3. Stem check
  if (!q.stem || (typeof q.stem === 'string' && q.stem.trim() === '')) {
    qIssues.push({ file: filePath, qId, issue: 'stem(문제 지시문) 비어있음', severity: 'warning' });
  }

  // 4. Points check
  if (!q.pts || q.pts <= 0) {
    qIssues.push({ file: filePath, qId, issue: `배점(pts) 누락 또는 0`, severity: 'warning' });
  }

  // 5. Source text cross-reference (for word tests)
  if (sourceText && q.passage && typeof q.passage === 'string') {
    // Check that passage contains real English words from the source
    const passageWords = q.passage.replace(/<[^>]+>/g, '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
    if (passageWords.length > 0) {
      const fullLower = sourceText.fullText.toLowerCase();
      // Check if key phrase exists in source (allow some flex due to blanks/modifications)
      const matchCount = passageWords.filter(w => fullLower.includes(w)).length;
      const matchRatio = matchCount / passageWords.length;
      if (matchRatio < 0.3 && passageWords.length > 5) {
        qIssues.push({ file: filePath, qId, issue: `passage 본문 일치율 낮음 (${Math.round(matchRatio*100)}%)`, severity: 'info' });
      }
    }
  }

  // 6. det (해설) check
  if (!q.det) {
    qIssues.push({ file: filePath, qId, issue: '해설(det) 누락', severity: 'info' });
  }

  return qIssues;
}

// Main
function validateAll() {
  const subjects = fs.readdirSync(TARGET).filter(f =>
    fs.statSync(path.join(TARGET, f)).isDirectory()
  );

  for (const subject of subjects.map(N)) {
    const subjectPath = path.join(TARGET, subject);
    const publishers = fs.readdirSync(subjectPath).filter(f =>
      fs.statSync(path.join(subjectPath, f)).isDirectory()
    );

    for (const pub of publishers.map(N)) {
      const pubPath = path.join(subjectPath, pub);
      const lessons = fs.readdirSync(pubPath).filter(f =>
        fs.statSync(path.join(pubPath, f)).isDirectory()
      );

      for (const lesson of lessons.map(N)) {
        const lessonPath = path.join(pubPath, lesson);
        const relPath = `${subject}/${pub}/${lesson}`;

        const sourcePath = path.join(lessonPath, '내신용교안.html');
        const sourceText = extractSourceText(sourcePath);

        const testFiles = ['단어테스트.html', '워크북테스트.html', '퀴즈테스트.html'];

        for (const tf of testFiles) {
          const testPath = path.join(lessonPath, tf);
          if (!fs.existsSync(testPath)) continue;

          totalFiles++;
          const shortPath = `${relPath}/${tf}`;

          const result = extractQ(testPath);

          if (result.error) {
            issues.push({ file: shortPath, qId: '-', issue: result.error, severity: 'error' });
            continue;
          }

          const Q = result.Q;

          // Duplicate IDs
          const ids = Q.map(q => q.id);
          const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
          if (dupes.length > 0) {
            issues.push({ file: shortPath, qId: '-', issue: `중복 ID: ${[...new Set(dupes)].join(', ')}`, severity: 'error' });
          }

          // Total points check
          const totalPts = Q.reduce((s, q) => s + (q.pts || 0), 0);
          if (totalPts !== 100 && totalPts > 0) {
            issues.push({ file: shortPath, qId: '-', issue: `총 배점 ${totalPts}점 (100점 아님)`, severity: 'warning' });
          }

          // Validate each question
          for (let i = 0; i < Q.length; i++) {
            totalQuestions++;
            const qIssues = validateQuestion(Q[i], i, shortPath, sourceText);
            issues.push(...qIssues);
          }
        }
      }
    }
  }
}

// Run
console.log('🔍 내신핏 테스트 자동 검수 v2 시작...\n');
validateAll();

const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');
const infos = issues.filter(i => i.severity === 'info');

console.log('='.repeat(80));
console.log('📊 검수 결과 요약');
console.log('='.repeat(80));
console.log(`검수 파일: ${totalFiles}개`);
console.log(`검수 문항: ${totalQuestions}개`);
console.log(`❌ 오류: ${errors.length}건`);
console.log(`⚠️  경고: ${warnings.length}건`);
console.log(`ℹ️  참고: ${infos.length}건`);

if (errors.length > 0) {
  console.log('\n─── ❌ 오류 목록 ───');
  // Group by category
  const cats = {};
  errors.forEach(e => {
    const key = e.issue.replace(/\(.*?\)/g, '(...)');
    if (!cats[key]) cats[key] = [];
    cats[key].push(e);
  });
  Object.entries(cats).forEach(([cat, items]) => {
    console.log(`\n  [${cat}] (${items.length}건)`);
    items.forEach(e => console.log(`    ${e.file} Q${e.qId}`));
  });
}

if (warnings.length > 0) {
  console.log('\n─── ⚠️ 경고 목록 ───');
  const cats = {};
  warnings.forEach(w => {
    const key = w.issue.replace(/\d+점?/g, 'N');
    if (!cats[key]) cats[key] = [];
    cats[key].push(w);
  });
  Object.entries(cats).forEach(([cat, items]) => {
    console.log(`\n  [${cat}] (${items.length}건)`);
    items.slice(0, 10).forEach(w => console.log(`    ${w.file} Q${w.qId}`));
    if (items.length > 10) console.log(`    ... 외 ${items.length - 10}건`);
  });
}

// Save report
const report = { totalFiles, totalQuestions, errors, warnings, infos };
fs.writeFileSync(path.join(REPO, 'validation-report.json'), JSON.stringify(report, null, 2), 'utf-8');
console.log('\n📄 validation-report.json 저장 완료');

process.exit(errors.length > 0 ? 1 : 0);
