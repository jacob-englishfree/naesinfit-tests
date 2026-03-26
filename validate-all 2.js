#!/usr/bin/env node
/**
 * 내신핏 테스트 자동 검수 스크립트 v3
 *
 * [구조 검증]
 *  - JS 문법/실행 오류
 *  - 정답 인덱스 범위, 서술형(wa/accept) 유효성
 *  - 필수 필드, 배점 합산, 중복 ID, 빈 선택지
 *
 * [본문 대조 검증] — 내신용교안.html 있을 때 자동 실행
 *  - passage 핵심 구절이 원문에 존재하는지
 *  - 단어테스트 어휘가 교과서 어휘 목록에 있는지
 *  - 객관식 정답 선택지의 핵심 단어가 원문과 일치하는지
 *  - 해설(det)의 원문 인용이 실제 원문과 부합하는지
 *
 * 사용법: node validate-all.js [--fix] [--verbose]
 */

const fs = require('fs');
const path = require('path');

const REPO = '/Users/woobumpark/Desktop/naesinfit-tests';
const TARGET = path.join(REPO, '교과서');
const N = s => s.normalize('NFC');

const VERBOSE = process.argv.includes('--verbose');
const issues = [];
let totalFiles = 0;
let totalQuestions = 0;
let contentChecked = 0;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTML → 텍스트 유틸
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function stripHtml(s) {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

// 영어 단어만 추출 (4글자 이상, 소문자)
function extractEngWords(text) {
  return (stripHtml(text).match(/[a-zA-Z]{4,}/g) || []).map(w => w.toLowerCase());
}

// n-gram 추출 (연속 n단어)
function extractNgrams(text, n) {
  const words = stripHtml(text).toLowerCase().split(/\s+/).filter(w => /^[a-z]/.test(w));
  const grams = [];
  for (let i = 0; i <= words.length - n; i++) {
    grams.push(words.slice(i, i + n).join(' '));
  }
  return grams;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 내신용교안에서 원문 추출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function extractSourceText(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');

  // 어휘 카드: 영단어 + 한국어 뜻 + 유의어/반의어
  const vocab = [];
  const vcBlocks = content.match(/class="vc"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];
  for (const block of vcBlocks) {
    const word = (block.match(/class="vc-w"[^>]*>([^<]+)/) || [])[1];
    const meaning = (block.match(/class="vc-k"[^>]*>([^<]+)/) || [])[1];
    const synMatch = block.match(/유의어<\/span>\s*([^·<]+)/);
    const antMatch = block.match(/반의어<\/span>\s*([^<]+)/);
    if (word) {
      vocab.push({
        word: word.trim().toLowerCase(),
        meaning: (meaning || '').trim(),
        synonyms: synMatch ? synMatch[1].trim().toLowerCase().split(/[,\s]+/) : [],
        antonyms: antMatch ? antMatch[1].trim().toLowerCase().split(/[,\s]+/) : [],
      });
    }
  }

  // 본문 문장 추출
  const sentences = [];
  const sRegex = /class="sent-en"[^>]*>([^<]+)/g;
  let m;
  while ((m = sRegex.exec(content)) !== null) {
    sentences.push(m[1].trim());
  }

  // 한국어 해석도 추출
  const korSentences = [];
  const kRegex = /class="kr-text"[^>]*>([^<]+)/g;
  while ((m = kRegex.exec(content)) !== null) {
    korSentences.push(m[1].trim());
  }

  const fullText = sentences.join(' ').toLowerCase();
  const vocabWords = new Set(vocab.map(v => v.word));
  // 유의어/반의어까지 포함한 확장 어휘셋
  const extendedVocab = new Set();
  vocab.forEach(v => {
    extendedVocab.add(v.word);
    v.synonyms.forEach(s => extendedVocab.add(s));
    v.antonyms.forEach(a => extendedVocab.add(a));
  });

  return { vocab, vocabWords, extendedVocab, sentences, korSentences, fullText };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Q 배열 추출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function extractQ(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
  if (!scriptMatch) return { error: 'script 태그를 찾을 수 없음', content };

  let targetScript = null;
  for (const s of scriptMatch) {
    if (/const\s+Q\s*=/.test(s)) {
      targetScript = s.replace(/<\/?script[^>]*>/g, '');
      break;
    }
  }
  if (!targetScript) return { error: 'const Q 배열을 찾을 수 없음', content };

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

  const qMatch = targetScript.match(/const\s+Q\s*=\s*\[/);
  if (!qMatch) return { error: 'const Q 배열을 찾을 수 없음', content };

  const startIdx = qMatch.index;
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
    return { error: `JS 파싱 오류: ${e.message}`, content };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 본문 대조 검증 (내신용교안 있을 때)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function contentCheck(q, idx, filePath, src) {
  const qId = q.id || idx + 1;
  const qIssues = [];

  // ── 1. Passage 본문 대조 (3-gram 기반) ──
  if (q.passage && typeof q.passage === 'string' && q.passage.length > 30) {
    const passageClean = stripHtml(q.passage)
      .replace(/\(A\)|\(B\)|\(C\)/g, '')          // ABC 빈칸 마커 제거
      .replace(/[①②③④⑤ⓐⓑⓒⓓⓔ]/g, '')            // 번호 마커 제거
      .replace(/_+/g, '')                           // 밑줄 빈칸 제거
      .replace(/\[.*?\]/g, '');                     // [보기] 등 제거

    const trigrams = extractNgrams(passageClean, 3);
    if (trigrams.length >= 3) {
      const matched = trigrams.filter(g => src.fullText.includes(g)).length;
      const ratio = matched / trigrams.length;

      if (ratio < 0.15 && trigrams.length > 5) {
        qIssues.push({
          file: filePath, qId,
          issue: `⚠️ 본문 대조 실패: passage의 3-gram 중 ${Math.round(ratio*100)}%만 원문에 존재`,
          severity: 'content-warning',
          detail: `샘플 trigram: "${trigrams.slice(0,3).join('", "')}"`,
        });
      }
    }
  }

  // ── 2. 단어테스트: 출제 어휘가 교과서 어휘 목록에 있는지 ──
  if (filePath.includes('단어테스트')) {
    // 밑줄 친 단어 추출 (<u>, <b> 태그 내 단어)
    const underlined = [];
    const uRegex = /<u>([^<]+)<\/u>|<b>([^<]+)<\/b>/g;
    let um;
    const passageStr = q.passage || q.stem || '';
    while ((um = uRegex.exec(passageStr)) !== null) {
      const word = (um[1] || um[2]).toLowerCase().trim();
      if (/^[a-z]+$/.test(word) && word.length >= 3) underlined.push(word);
    }

    for (const word of underlined) {
      if (!src.extendedVocab.has(word)) {
        qIssues.push({
          file: filePath, qId,
          issue: `⚠️ 어휘 "${word}" — 교과서 어휘목록(본문+유의어+반의어)에 없음`,
          severity: 'content-warning',
        });
      }
    }
  }

  // ── 3. 객관식 정답 내용 검증 ──
  if (q.fmt === 'mc' && q.ch && q.ans !== undefined && q.ans !== null) {
    const correctChoice = stripHtml(q.ch[q.ans]).toLowerCase();

    // (A)(B)(C) 조합형: 정답 선택지의 핵심 단어들이 원문에 있는지
    // 주의: 내신용교안은 요약본이라 원문 전체 단어를 포함하지 않을 수 있음
    if (q.type && q.type.includes('조합형')) {
      const keywords = correctChoice.match(/[a-z]{5,}/g) || [];  // 5글자 이상만
      const missing = keywords.filter(kw =>
        !src.fullText.includes(kw) && !src.extendedVocab.has(kw)
      );
      // 교안이 요약본이므로 100% 누락일 때만 경고 (부분 누락은 정상)
      if (missing.length > 0 && keywords.length > 0 && missing.length === keywords.length) {
        qIssues.push({
          file: filePath, qId,
          issue: `⚠️ 정답 키워드 전부 불일치: "${missing.join(', ')}" — 원문 확인 필요`,
          severity: 'content-info',  // warning → info로 하향 (교안 한계)
        });
      }
    }

    // 문맥상 부적절한 어휘: 정답이 "원문에 없는 단어"여야 정상
    if (q.type && q.type.includes('부적절')) {
      // 정답 선택지에서 밑줄 단어 추출
      const ansText = stripHtml(q.ch[q.ans]);
      const ansWord = (ansText.match(/[a-zA-Z]{3,}/) || [''])[0].toLowerCase();

      if (ansWord && src.fullText.includes(ansWord)) {
        // 정답 단어가 원문에 존재 → 부적절 유형인데 원문에 있으면 의심
        // 단, passage에서 일부러 바꾼 단어일 수 있으므로 det 확인
        if (q.det && q.det.correct) {
          const detText = stripHtml(q.det.correct).toLowerCase();
          if (!detText.includes('부적절') && !detText.includes('원문')) {
            qIssues.push({
              file: filePath, qId,
              issue: `⚠️ "부적절 어휘" 정답 "${ansWord}"이 원문에 존재 — 정답 재확인 필요`,
              severity: 'content-warning',
            });
          }
        }
      }
    }
  }

  // ── 4. 서술형 정답: 원문에서 추출 가능한 답인지 ──
  if ((q.fmt === 'written' || q.fmt === 'write') && q.wa) {
    const wa = typeof q.wa === 'string' ? q.wa.toLowerCase().trim() : '';
    if (wa.length >= 3 && /^[a-z\s]+$/.test(wa)) {
      // 단순 영단어 답이면 원문에 있어야 함
      if (!src.fullText.includes(wa) && !src.extendedVocab.has(wa)) {
        // 어형 변환 답일 수 있으므로 어근 체크
        const stem = wa.replace(/(ing|ed|s|es|ly|tion|ness|ment|ful|less|er|est)$/, '');
        if (stem.length >= 3 && !src.fullText.includes(stem)) {
          qIssues.push({
            file: filePath, qId,
            issue: `ℹ️ 서술형 정답 "${wa}" — 원문에서 직접 확인 안 됨 (어형변환 가능)`,
            severity: 'content-info',
          });
        }
      }
    }
  }

  // ── 5. 해설(det)의 [원문] 인용 검증 ──
  if (q.det && q.det.ref && typeof q.det.ref === 'string') {
    const refText = q.det.ref;
    // [원문] 뒤의 영어 문장 추출
    const origMatch = refText.match(/\[원문\]\s*([A-Z][^[\n]{10,})/);
    if (origMatch) {
      const quoted = origMatch[1].trim().toLowerCase();
      const quoteWords = quoted.match(/[a-z]{4,}/g) || [];
      if (quoteWords.length >= 3) {
        const matched = quoteWords.filter(w => src.fullText.includes(w)).length;
        const ratio = matched / quoteWords.length;
        if (ratio < 0.4) {
          qIssues.push({
            file: filePath, qId,
            issue: `⚠️ 해설 [원문] 인용이 실제 본문과 불일치 (${Math.round(ratio*100)}%)`,
            severity: 'content-warning',
            detail: `인용: "${origMatch[1].substring(0, 60)}..."`,
          });
        }
      }
    }
  }

  return qIssues;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 구조 검증
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function validateQuestion(q, idx, filePath) {
  const qId = q.id || idx + 1;
  const qIssues = [];

  if (q.id === undefined || q.id === null)
    qIssues.push({ file: filePath, qId, issue: 'id 필드 누락', severity: 'error' });

  if (q.fmt === 'written' || q.fmt === 'write') {
    if ((!q.wa || (typeof q.wa === 'string' && q.wa.trim() === '')) &&
        (!q.accept || !Array.isArray(q.accept) || q.accept.length === 0))
      qIssues.push({ file: filePath, qId, issue: '서술형 정답(wa/accept) 누락', severity: 'error' });
  } else if (q.fmt === 'mc' || q.ch) {
    if (q.ans === undefined || q.ans === null)
      qIssues.push({ file: filePath, qId, issue: '객관식 정답(ans) 누락', severity: 'error' });
    if (!q.ch || !Array.isArray(q.ch))
      qIssues.push({ file: filePath, qId, issue: 'ch(선택지) 배열 누락', severity: 'error' });
    else {
      if (q.ans !== undefined && q.ans !== null && (q.ans < 0 || q.ans >= q.ch.length))
        qIssues.push({ file: filePath, qId, issue: `정답 인덱스(${q.ans}) 범위 초과 (선택지 ${q.ch.length}개)`, severity: 'error' });
      q.ch.forEach((c, ci) => {
        if (!c || (typeof c === 'string' && c.trim() === ''))
          qIssues.push({ file: filePath, qId, issue: `선택지 ${ci+1}번 비어있음`, severity: 'warning' });
      });
    }
  }

  if (!q.stem || (typeof q.stem === 'string' && q.stem.trim() === ''))
    qIssues.push({ file: filePath, qId, issue: 'stem 비어있음', severity: 'warning' });

  if (!q.pts || q.pts <= 0)
    qIssues.push({ file: filePath, qId, issue: '배점 누락/0', severity: 'warning' });

  return qIssues;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

        // 내신용교안 로드 (있으면 본문 대조 활성화)
        const sourcePath = path.join(lessonPath, '내신용교안.html');
        const src = extractSourceText(sourcePath);

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

          // 중복 ID
          const ids = Q.map(q => q.id);
          const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
          if (dupes.length > 0)
            issues.push({ file: shortPath, qId: '-', issue: `중복 ID: ${[...new Set(dupes)].join(', ')}`, severity: 'error' });

          // 배점 합계
          const totalPts = Q.reduce((s, q) => s + (q.pts || 0), 0);
          if (totalPts !== 100 && totalPts > 0)
            issues.push({ file: shortPath, qId: '-', issue: `총 배점 ${totalPts}점 (≠100)`, severity: 'warning' });

          // 문항별 검증
          for (let i = 0; i < Q.length; i++) {
            totalQuestions++;

            // 구조 검증
            issues.push(...validateQuestion(Q[i], i, shortPath));

            // 본문 대조 (내신용교안 있을 때만)
            if (src) {
              contentChecked++;
              issues.push(...contentCheck(Q[i], i, shortPath, src));
            }
          }
        }
      }
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 실행 & 리포트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('🔍 내신핏 자동 검수 v3 (구조 + 본문 대조)\n');
validateAll();

const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');
const contentWarnings = issues.filter(i => i.severity === 'content-warning');
const contentInfos = issues.filter(i => i.severity === 'content-info');

console.log('='.repeat(80));
console.log('📊 검수 결과');
console.log('='.repeat(80));
console.log(`파일: ${totalFiles}개  |  문항: ${totalQuestions}개  |  본문대조: ${contentChecked}개`);
console.log(`❌ 구조 오류: ${errors.length}건`);
console.log(`⚠️  구조 경고: ${warnings.length}건`);
console.log(`📖 본문 불일치: ${contentWarnings.length}건`);
console.log(`ℹ️  본문 참고: ${contentInfos.length}건`);

function printGroup(label, items, maxPerGroup) {
  if (items.length === 0) return;
  console.log(`\n─── ${label} ───`);
  const cats = {};
  items.forEach(e => {
    const key = e.issue.replace(/\d+%/g, 'N%').replace(/"[^"]+"/g, '"..."');
    if (!cats[key]) cats[key] = [];
    cats[key].push(e);
  });
  Object.entries(cats).sort((a,b) => b[1].length - a[1].length).forEach(([cat, list]) => {
    console.log(`\n  [${cat}] (${list.length}건)`);
    list.slice(0, maxPerGroup || 10).forEach(e => {
      let line = `    ${e.file} Q${e.qId}`;
      if (e.detail && VERBOSE) line += `  ${e.detail}`;
      console.log(line);
    });
    if (list.length > (maxPerGroup || 10)) console.log(`    ... 외 ${list.length - (maxPerGroup || 10)}건`);
  });
}

printGroup('❌ 구조 오류', errors, 20);
printGroup('⚠️ 구조 경고', warnings, 10);
printGroup('📖 본문 불일치 (검토 필요)', contentWarnings, 15);
printGroup('ℹ️ 본문 참고', contentInfos, 5);

// JSON 리포트 저장
const report = { totalFiles, totalQuestions, contentChecked, errors, warnings, contentWarnings, contentInfos };
fs.writeFileSync(path.join(REPO, 'validation-report.json'), JSON.stringify(report, null, 2), 'utf-8');
console.log('\n📄 validation-report.json 저장 완료');

process.exit(errors.length > 0 ? 1 : 0);
