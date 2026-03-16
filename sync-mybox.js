#!/usr/bin/env node
/**
 * MYBOX → GitHub 자동 동기화 스크립트
 * 네이버 MYBOX에서 교재 HTML/PDF 파일을 GitHub 레포로 동기화
 *
 * 사용법: node sync-mybox.js [--dry-run] [--no-push]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── macOS NFD → NFC 정규화 (MYBOX 한글 폴더명 호환) ───
const N = s => s.normalize('NFC');

// ─── 경로 설정 ───
const MYBOX = '/Users/woobumpark/Library/CloudStorage/MYBOX-hicncivy8th/개인 폴더/교재제작(2026)';
const REPO = '/Users/woobumpark/Desktop/naesinfit-tests';
const TARGET = path.join(REPO, '교과서');

// ─── 옵션 ───
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_PUSH = args.includes('--no-push');

// ─── 출판사 이름 매핑 (MYBOX → GitHub) ───
const PUB_MAP = {
  '비상홍민표': '비상홍'
};

// ─── 학년 → 교과서 매핑 ───
const GRADE_MAP = {
  '고1': '공통영어1',
  '고2': '영어1'
};

// ─── Display name 매핑 ───
const DN_MAP = {
  'YBM김은형': 'YBM(김은형)', 'YBM박준언': 'YBM(박준언)',
  '능률민병천': '능률(민병천)', '능률오선영': '능률(오선영)',
  '동아이병민': '동아(이병민)', '동아박용예': '동아(박용예)',
  '지학사신상근': '지학사(신상근)', '천재강상구': '천재(강상구)',
  '천재조수경': '천재(조수경)', '비상홍': '비상(홍민표)'
};

// ─── 테스트 타입 ───
const TEST_TYPES = ['단어테스트', '워크북테스트', '퀴즈테스트'];

// ─── 카운터 ───
let copied = 0, skipped = 0, invalid = 0;

function log(msg) {
  const t = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  console.log(`[${t}] ${msg}`);
}

function mapPublisher(name) {
  return PUB_MAP[name] || name;
}

// HTML 유효성 검사: const Q= 포함 여부
function validateHtml(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return /const\s+Q\s*=/.test(content);
  } catch { return false; }
}

// 파일명 정규화: 단어테스트3.html → 단어테스트.html
function normalizeFilename(filename) {
  for (const tt of TEST_TYPES) {
    const re = new RegExp(`^${tt}\\d*\\.html$`);
    if (re.test(filename)) return `${tt}.html`;
  }
  return filename;
}

// 디렉토리 내 모든 HTML 파일 재귀 탐색
function findHtmlFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...findHtmlFiles(full));
    } else if (e.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

// 디렉토리 내 모든 PDF 파일 재귀 탐색
function findPdfFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...findPdfFiles(full));
    } else if (e.name.endsWith('.pdf')) {
      results.push(full);
    }
  }
  return results;
}

// 파일 비교 (같으면 true)
function filesEqual(a, b) {
  try {
    if (!fs.existsSync(b)) return false;
    const bufA = fs.readFileSync(a);
    const bufB = fs.readFileSync(b);
    return bufA.equals(bufB);
  } catch { return false; }
}

// ─── 메인 동기화 ───
log('🔄 MYBOX → GitHub 동기화 시작');
log(`소스: ${MYBOX}`);
log(`대상: ${TARGET}`);
if (DRY_RUN) log('⚠️  DRY RUN 모드 (실제 복사 안 함)');

if (!fs.existsSync(MYBOX)) {
  log('❌ MYBOX 폴더를 찾을 수 없습니다. 네이버 MYBOX가 동기화되어 있는지 확인하세요.');
  process.exit(1);
}

const gradeDirs = fs.readdirSync(MYBOX, { withFileTypes: true })
  .filter(d => d.isDirectory() && GRADE_MAP[N(d.name)]);

for (const gradeEntry of gradeDirs) {
  const grade = N(gradeEntry.name);
  const subject = GRADE_MAP[grade];
  const gradeDir = path.join(MYBOX, gradeEntry.name);

  // 교과서 폴더 찾기 — MYBOX는 NFD 경로이므로 실제 디렉토리에서 매칭
  const subjectActual = fs.readdirSync(gradeDir).find(d => N(d) === subject);
  if (!subjectActual) {
    log(`⚠️  ${grade}/${subject} 폴더 없음 (스킵)`);
    continue;
  }

  const subjectDir = path.join(gradeDir, subjectActual);
  const pubDirs = fs.readdirSync(subjectDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const pubEntry of pubDirs) {
    const pubMybox = N(pubEntry.name);
    const pubGithub = mapPublisher(pubMybox);
    const pubDir = path.join(subjectDir, pubEntry.name);

    const lessonDirs = fs.readdirSync(pubDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d+과$/.test(N(d.name)));

    for (const lessonEntry of lessonDirs) {
      const lesson = N(lessonEntry.name);
      const lessonDir = path.join(pubDir, lessonEntry.name);
      const destDir = path.join(TARGET, subject, pubGithub, lesson);

      // HTML 파일 처리 (재귀 탐색으로 nested 구조도 처리)
      const htmlFiles = findHtmlFiles(lessonDir);

      for (const htmlFile of htmlFiles) {
        const filename = N(path.basename(htmlFile));

        // 테스트 파일 또는 내신용교안인지 확인
        const isTest = TEST_TYPES.some(tt => filename.startsWith(tt));
        const isGyoan = filename === '내신용교안.html';

        if (!isTest && !isGyoan) continue;

        // 파일명 정규화
        const normalized = isTest ? normalizeFilename(filename) : filename;

        // HTML 유효성 검사 (내신용교안은 제외)
        if (isTest && !validateHtml(htmlFile)) {
          log(`❌ 유효하지 않은 HTML (const Q 없음): ${subject}/${pubMybox}/${lesson}/${filename}`);
          invalid++;
          continue;
        }

        const destFile = path.join(destDir, normalized);

        // 변경 확인
        if (filesEqual(htmlFile, destFile)) {
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          log(`📋 [DRY] ${subject}/${pubGithub}/${lesson}/${normalized}`);
        } else {
          fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(htmlFile, destFile);
          log(`✅ ${subject}/${pubGithub}/${lesson}/${normalized}`);
        }
        copied++;
      }

      // PDF 파일 처리
      const pdfFiles = findPdfFiles(lessonDir);
      for (const pdfFile of pdfFiles) {
        const filename = N(path.basename(pdfFile));
        const destFile = path.join(destDir, filename);

        if (filesEqual(pdfFile, destFile)) continue;

        if (!DRY_RUN) {
          fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(pdfFile, destFile);
        }
      }
    }
  }
}

// ─── 결과 출력 ───
log('');
log(`📊 동기화 결과: 복사=${copied}, 스킵(동일)=${skipped}, 유효하지않음=${invalid}`);

// ─── manifest.json 업데이트 ───
if (copied > 0 && !DRY_RUN) {
  log('📝 manifest.json 업데이트 중...');

  const manifest = { '교과서': {} };
  const subjects = fs.readdirSync(TARGET, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const subEntry of subjects) {
    const sub = N(subEntry.name);
    manifest['교과서'][sub] = {};
    const subDir = path.join(TARGET, subEntry.name);
    const pubs = fs.readdirSync(subDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const pubEntry of pubs) {
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

  fs.writeFileSync(
    path.join(REPO, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  log('✅ manifest.json 업데이트 완료');

  // ─── Git commit & push ───
  try {
    process.chdir(REPO);
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();

    if (status) {
      execSync('git add 교과서/ manifest.json');
      const date = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      execSync(`git commit -m "sync: MYBOX 교재 데이터 동기화 (${date})"`);

      if (!NO_PUSH) {
        try {
          execSync('git push', { stdio: 'pipe' });
          log('✅ Git push 완료');
        } catch (e) {
          log('⚠️  Git push 실패 (remote 확인 필요)');
        }
      } else {
        log('⚠️  --no-push 모드: push 스킵');
      }

      log('✅ Git 커밋 완료');
    } else {
      log('변경사항 없음 (git clean)');
    }
  } catch (e) {
    log(`⚠️  Git 오류: ${e.message}`);
  }
}

log('🏁 동기화 완료!');
