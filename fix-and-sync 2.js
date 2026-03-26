#!/usr/bin/env node
/**
 * MYBOX + GitHub 전체 교정 & 동기화 스크립트
 * 1. title 오류 수정 (원본 MYBOX + GitHub)
 * 2. 파일명 정규화 (숫자 제거)
 * 3. PDF 파일명 오타 수정
 * 4. 능률오선영 nested → flat 변환 (GitHub만)
 * 5. manifest.json 업데이트
 *
 * 사용법: node fix-and-sync.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const N = s => s.normalize('NFC');

// ─── 경로 ───
const MYBOX = '/Users/woobumpark/Library/CloudStorage/MYBOX-hicncivy8th/개인 폴더/교재제작(2026)';
const REPO = '/Users/woobumpark/Desktop/naesinfit-tests';
const TARGET = path.join(REPO, '교과서');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── 매핑 ───
const GRADE_MAP = { '고1': '공통영어1', '고2': '영어1' };
const PUB_MAP = { '비상홍민표': '비상홍' };
const DN_MAP = {
  'YBM김은형': 'YBM(김은형)', 'YBM박준언': 'YBM(박준언)',
  '능률민병천': '능률(민병천)', '능률오선영': '능률(오선영)',
  '동아이병민': '동아(이병민)', '동아박용예': '동아(박용예)',
  '지학사신상근': '지학사(신상근)', '천재강상구': '천재(강상구)',
  '천재조수경': '천재(조수경)', '비상홍': '비상(홍민표)', '비상홍민표': '비상(홍민표)'
};
const SUBJECT_DN = { '공통영어1': '공통영어1', '영어1': '영어I' };
const TEST_DN = { '단어테스트': '단어', '워크북테스트': '워크북', '퀴즈테스트': '퀴즈' };

// ─── 카운터 ───
let titleFixed = 0, fileRenamed = 0, fileCopied = 0, fileSkipped = 0;

function log(msg) {
  const t = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  console.log(`[${t}] ${msg}`);
}

// ─── title 생성 ───
function correctTitle(subject, pubName, lesson, testType) {
  const subDn = SUBJECT_DN[subject] || subject;
  const pubDn = DN_MAP[pubName] || pubName;
  const lessonNum = lesson.replace(/과$/, '');
  const testDn = TEST_DN[testType] || testType;
  return `${subDn} ${pubDn} ${lessonNum}과 온라인${testDn}TEST`;
}

// ─── title 교정 ───
function fixTitle(filePath, correctTitleStr) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const titleMatch = content.match(/<title>(.*?)<\/title>/);
  if (!titleMatch) return false;

  const currentTitle = titleMatch[1].trim();
  if (currentTitle === correctTitleStr) return false;

  content = content.replace(/<title>.*?<\/title>/, `<title>${correctTitleStr}</title>`);
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  log(`🔧 title 수정: "${currentTitle}" → "${correctTitleStr}"`);
  log(`   📁 ${filePath.split('교재제작(2026)/')[1] || filePath.split('교과서/')[1] || filePath}`);
  titleFixed++;
  return true;
}

// ─── 파일명에서 테스트 타입 추출 ───
function getTestType(filename) {
  const fn = N(filename);
  if (fn.match(/^단어테스트/)) return '단어테스트';
  if (fn.match(/^워크북테스트/)) return '워크북테스트';
  if (fn.match(/^퀴즈테스트/)) return '퀴즈테스트';
  if (fn === '내신용교안.html') return '내신용교안';
  return null;
}

// ─── 표준 파일명 ───
function standardFilename(filename, ext) {
  const fn = N(filename);
  // 워크북테스트1.html, 워크북테스트2.html → 유지 (A/B형)
  if (fn.match(/^워크북테스트[12]\./)) return fn;
  // 단어테스트3.html → 단어테스트.html
  for (const tt of ['단어테스트', '워크북테스트', '퀴즈테스트']) {
    if (fn.match(new RegExp(`^${tt}\\d+\\.${ext}$`))) return `${tt}.${ext}`;
  }
  // 퀴즈북테스트.pdf → 퀴즈테스트.pdf
  if (fn === `퀴즈북테스트.${ext}`) return `퀴즈테스트.${ext}`;
  // 워크북테스북.pdf → 워크북테스트.pdf
  if (fn === `워크북테스북.${ext}`) return `워크북테스트.${ext}`;
  return fn;
}

// ─── 재귀 파일 탐색 ───
function findFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...findFiles(full, ext));
    else if (N(e.name).endsWith(`.${ext}`)) results.push(full);
  }
  return results;
}

function filesEqual(a, b) {
  try {
    if (!fs.existsSync(b)) return false;
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch { return false; }
}

// ═══════════════════════════════════════
// PHASE 1: MYBOX 원본 교정
// ═══════════════════════════════════════
log('');
log('═══ PHASE 1: MYBOX 원본 교정 ═══');
if (DRY_RUN) log('⚠️  DRY RUN 모드');

const renameQueue = []; // {from, to} for MYBOX renames

for (const [grade, subject] of Object.entries(GRADE_MAP)) {
  const gradeDir = path.join(MYBOX, grade);
  if (!fs.existsSync(gradeDir)) continue;

  const subjectActual = fs.readdirSync(gradeDir).find(d => N(d) === subject);
  if (!subjectActual) continue;
  const subjectDir = path.join(gradeDir, subjectActual);

  for (const pubEntry of fs.readdirSync(subjectDir, { withFileTypes: true })) {
    if (!pubEntry.isDirectory()) continue;
    const pubMybox = N(pubEntry.name);
    const pubDir = path.join(subjectDir, pubEntry.name);

    for (const lessonEntry of fs.readdirSync(pubDir, { withFileTypes: true })) {
      if (!lessonEntry.isDirectory()) continue;
      const lesson = N(lessonEntry.name);
      if (!/^\d+과$/.test(lesson)) continue;
      const lessonDir = path.join(pubDir, lessonEntry.name);

      // HTML 파일 찾기 (재귀 - nested 구조 포함)
      const htmlFiles = findFiles(lessonDir, 'html');
      for (const htmlFile of htmlFiles) {
        const filename = N(path.basename(htmlFile));
        const testType = getTestType(filename);
        if (!testType || testType === '내신용교안') continue;

        // A/B형 워크북 처리
        let titleTestType = testType;
        // 워크북테스트1/2는 title은 동일하게 "워크북"

        // title 교정
        const correct = correctTitle(subject, pubMybox, lesson, titleTestType);
        fixTitle(htmlFile, correct);

        // 파일명 정규화
        const stdName = standardFilename(filename, 'html');
        if (stdName !== filename) {
          const newPath = path.join(path.dirname(htmlFile), stdName);
          if (!DRY_RUN) {
            fs.renameSync(htmlFile, newPath);
          }
          log(`📝 파일명 변경: ${filename} → ${stdName}`);
          fileRenamed++;
        }
      }

      // PDF 파일명 교정
      const pdfFiles = findFiles(lessonDir, 'pdf');
      for (const pdfFile of pdfFiles) {
        const filename = N(path.basename(pdfFile));
        const stdName = standardFilename(filename, 'pdf');
        if (stdName !== filename) {
          const newPath = path.join(path.dirname(pdfFile), stdName);
          if (!DRY_RUN) {
            fs.renameSync(pdfFile, newPath);
          }
          log(`📝 PDF 이름 변경: ${filename} → ${stdName}`);
          fileRenamed++;
        }
      }
    }
  }
}

log('');
log(`📊 PHASE 1 결과: title 수정=${titleFixed}, 파일명 변경=${fileRenamed}`);

// ═══════════════════════════════════════
// PHASE 2: GitHub 레포로 동기화 (flat 구조)
// ═══════════════════════════════════════
log('');
log('═══ PHASE 2: GitHub 동기화 ═══');

titleFixed = 0; // 리셋 (phase 2 카운트)

for (const [grade, subject] of Object.entries(GRADE_MAP)) {
  const gradeDir = path.join(MYBOX, grade);
  if (!fs.existsSync(gradeDir)) continue;

  const subjectActual = fs.readdirSync(gradeDir).find(d => N(d) === subject);
  if (!subjectActual) continue;
  const subjectDir = path.join(gradeDir, subjectActual);

  for (const pubEntry of fs.readdirSync(subjectDir, { withFileTypes: true })) {
    if (!pubEntry.isDirectory()) continue;
    const pubMybox = N(pubEntry.name);
    const pubGithub = PUB_MAP[pubMybox] || pubMybox;
    const pubDir = path.join(subjectDir, pubEntry.name);

    for (const lessonEntry of fs.readdirSync(pubDir, { withFileTypes: true })) {
      if (!lessonEntry.isDirectory()) continue;
      const lesson = N(lessonEntry.name);
      if (!/^\d+과$/.test(lesson)) continue;
      const lessonDir = path.join(pubDir, lessonEntry.name);
      const destDir = path.join(TARGET, subject, pubGithub, lesson);

      // HTML 동기화
      const htmlFiles = findFiles(lessonDir, 'html');
      for (const htmlFile of htmlFiles) {
        const filename = N(path.basename(htmlFile));
        const testType = getTestType(filename);
        if (!testType) continue;

        // 테스트 HTML만 (내신용교안은 별도)
        const isTest = testType !== '내신용교안';
        if (isTest && !/const\s+Q\s*=/.test(fs.readFileSync(htmlFile, 'utf-8'))) {
          log(`❌ const Q 없음 (스킵): ${subject}/${pubGithub}/${lesson}/${filename}`);
          continue;
        }

        // GitHub용 파일명 (flat, 정규화됨)
        let destName = filename;
        // 워크북테스트1/2 → 유지
        if (filename.match(/^워크북테스트[12]\.html$/)) {
          destName = filename;
        } else {
          destName = standardFilename(filename, 'html');
        }

        const destFile = path.join(destDir, destName);

        if (filesEqual(htmlFile, destFile)) {
          fileSkipped++;
          continue;
        }

        if (!DRY_RUN) {
          fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(htmlFile, destFile);
        }
        log(`✅ ${subject}/${pubGithub}/${lesson}/${destName}`);
        fileCopied++;
      }

      // PDF 동기화
      const pdfFiles = findFiles(lessonDir, 'pdf');
      for (const pdfFile of pdfFiles) {
        const filename = N(path.basename(pdfFile));
        const destName = standardFilename(filename, 'pdf');
        const destFile = path.join(destDir, destName);

        if (filesEqual(pdfFile, destFile)) continue;

        if (!DRY_RUN) {
          fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(pdfFile, destFile);
        }
      }
    }
  }
}

log('');
log(`📊 PHASE 2 결과: 복사=${fileCopied}, 스킵(동일)=${fileSkipped}`);

// ═══════════════════════════════════════
// PHASE 3: manifest.json 업데이트
// ═══════════════════════════════════════
if ((fileCopied > 0 || titleFixed > 0) && !DRY_RUN) {
  log('');
  log('═══ PHASE 3: manifest.json 업데이트 ═══');

  const manifest = { '교과서': {} };
  for (const subEntry of fs.readdirSync(TARGET, { withFileTypes: true })) {
    if (!subEntry.isDirectory()) continue;
    const sub = N(subEntry.name);
    manifest['교과서'][sub] = {};
    const subDir = path.join(TARGET, subEntry.name);

    for (const pubEntry of fs.readdirSync(subDir, { withFileTypes: true })) {
      if (!pubEntry.isDirectory()) continue;
      const pub = N(pubEntry.name);
      const pubDir = path.join(subDir, pubEntry.name);

      const lessons = fs.readdirSync(pubDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d+과$/.test(N(d.name)))
        .map(d => parseInt(N(d.name)))
        .sort((a, b) => a - b);

      if (lessons.length > 0) {
        manifest['교과서'][sub][pub] = {
          lessons,
          dn: DN_MAP[pub] || pub
        };
      }
    }
  }

  fs.writeFileSync(path.join(REPO, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log('✅ manifest.json 업데이트 완료');
}

// ═══════════════════════════════════════
// 최종 요약
// ═══════════════════════════════════════
log('');
log('═══ 최종 요약 ═══');
log(`MYBOX 원본: title 수정 + 파일명 변경 완료`);
log(`GitHub 동기화: ${fileCopied}개 파일 복사, ${fileSkipped}개 스킵`);
log('🏁 완료!');
