#!/usr/bin/env node
/**
 * rebuild-catalog.js — data/ 디렉토리를 직접 스캔하여
 * index.html의 MANIFEST + SCOPE_CATALOG 하드코드 블록을 재생성.
 *
 * textbooks.ts에 의존하지 않고 실제 파일 시스템만 기준으로 생성.
 *
 * Usage: node scripts/rebuild-catalog.js
 *   → stdout에 MANIFEST, SCOPE_CATALOG JS 코드 출력
 *   → --apply 플래그: index.html에 직접 적용
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const INDEX_HTML = path.join(ROOT, 'index.html');
const TEST_FILES = ['단어.json', '워크북.json', '퀴즈.json'];

// ─── 유틸 ───
function nfc(s) { return s.normalize('NFC'); }

function hasTestFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  try {
    const files = fs.readdirSync(dir);
    return TEST_FILES.some(tf => files.includes(tf));
  } catch { return false; }
}

function subdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => !f.startsWith('_') && !f.startsWith('.'))
    .filter(f => {
      try { return fs.statSync(path.join(dir, f)).isDirectory(); }
      catch { return false; }
    })
    .map(f => nfc(f));
}

function sortNumeric(arr) {
  return arr.sort((a, b) => {
    const na = parseInt(a) || 999;
    const nb = parseInt(b) || 999;
    if (na !== nb) return na - nb;
    return a.localeCompare(b, 'ko');
  });
}

// ─── Display name 생성 ───
const DN_MAP = {
  'YBM김은형': 'YBM(김은형)', 'YBM박준언': 'YBM(박준언)', 'YBM한상호': 'YBM(한상호)',
  '능률민병천': '능률(민병천)', '능률오선영': '능률(오선영)', '능률김성곤2015': '능률(김성곤) 2015',
  '동아이병민': '동아(이병민)', '동아박용예': '동아(박용예)',
  '비상홍': '비상(홍민표)', '미래엔김성연': '미래엔(김성연)', '미래엔최연희': '미래엔(최연희)',
  '지학사신상근': '지학사(신상근)',
  '천재강상구': '천재(강상구)', '천재조수경': '천재(조수경)',
};

function pubDn(name) { return DN_MAP[name] || name; }

function isNew(name) {
  return /202[56]/.test(name);
}

function mockDn(exam) {
  // exam = "3월_2024" → "2024년 3월", "6월" → "6월 모의고사", "9월" → "9월 모의고사"
  const m = exam.match(/^(\d+월)_(\d{4})$/);
  if (m) return `${m[2]}년 ${m[1]}`;
  if (/^\d+월$/.test(exam)) return `${exam} 모의고사`;
  if (exam === '수능') return '수능';
  if (exam === '10월') return '10월 모의고사';
  return exam;
}

// ─── 1. 교과서 스캔 ───
function scanTextbooks() {
  const result = {};
  const tbDir = path.join(DATA, '교과서');
  if (!fs.existsSync(tbDir)) return result;

  for (const subject of sortNumeric(subdirs(tbDir))) {
    const subjDir = path.join(tbDir, subject);
    const pubs = {};

    for (const pub of sortNumeric(subdirs(subjDir))) {
      const pubDir = path.join(subjDir, pub);
      const lessons = sortNumeric(subdirs(pubDir));
      const activeLessons = [];
      const subs = {};

      for (const lesson of lessons) {
        const lessonDir = path.join(pubDir, lesson);
        const sections = sortNumeric(subdirs(lessonDir));
        const activeSections = sections.filter(sec =>
          hasTestFiles(path.join(lessonDir, sec))
        );

        // Also check if lesson dir itself has test files (no section level)
        const lessonHasDirectFiles = hasTestFiles(lessonDir);

        if (activeSections.length > 0) {
          activeLessons.push(lesson);
          subs[lesson] = activeSections;
        } else if (lessonHasDirectFiles) {
          activeLessons.push(lesson);
        }
      }

      if (activeLessons.length > 0) {
        const entry = { lessons: activeLessons, dn: pubDn(pub) };
        if (Object.keys(subs).length > 0) entry.subs = subs;
        pubs[pub] = entry;
      }
    }

    if (Object.keys(pubs).length > 0) {
      result[subject] = pubs;
    }
  }
  return result;
}

// ─── 2. 모의고사 스캔 ───
function scanMock() {
  const result = {};
  const mockDir = path.join(DATA, '모의고사');
  if (!fs.existsSync(mockDir)) return result;

  for (const grade of sortNumeric(subdirs(mockDir))) {
    const gradeDir = path.join(mockDir, grade);
    const exams = {};

    for (const exam of sortNumeric(subdirs(gradeDir))) {
      const examDir = path.join(gradeDir, exam);
      const numbers = sortNumeric(subdirs(examDir))
        .filter(n => hasTestFiles(path.join(examDir, n)));

      if (numbers.length > 0) {
        exams[exam] = {
          dn: mockDn(exam),
          lessons: numbers,
          isNew: isNew(exam),
        };
      }
    }

    if (Object.keys(exams).length > 0) {
      result[grade] = exams;
    }
  }
  return result;
}

// ─── 3. 부교재 스캔 ───
function scanSupplement() {
  const result = {};
  const supDir = path.join(DATA, '부교재');
  if (!fs.existsSync(supDir)) return result;

  for (const series of sortNumeric(subdirs(supDir))) {
    const seriesDir = path.join(supDir, series);
    const books = {};

    // Determine structure: series has book-level? or direct lessons?
    const children = subdirs(seriesDir);

    // Check if children are "강" or "과" (lessons) or book names
    const looksLikeLessons = children.some(c => /^\d+강$/.test(c) || /^\d+과$/.test(c) || c === 'TEST');
    const looksLikeBooks = children.some(c => /^(영어|영어독해연습|\d{4})$/.test(c));

    if (looksLikeBooks) {
      // Has book level (e.g., 수능특강/영어, 수능특강Light/영어독해연습, 올림포스/2025)
      for (const book of sortNumeric(children)) {
        const bookDir = path.join(seriesDir, book);
        const lessons = sortNumeric(subdirs(bookDir));
        const activeLessons = [];
        const subs = {};

        for (const lesson of lessons) {
          const lessonDir = path.join(bookDir, lesson);
          const sections = sortNumeric(subdirs(lessonDir));
          const activeSections = sections.filter(sec =>
            hasTestFiles(path.join(lessonDir, sec))
          );
          const lessonHasDirectFiles = hasTestFiles(lessonDir);

          if (activeSections.length > 0) {
            activeLessons.push(lesson);
            subs[lesson] = activeSections;
          } else if (lessonHasDirectFiles) {
            activeLessons.push(lesson);
          }
        }

        if (activeLessons.length > 0) {
          const entry = {
            dn: `${series} ${book}`,
            lessons: activeLessons,
            isNew: isNew(book) || isNew(series),
          };
          if (Object.keys(subs).length > 0) entry.subs = subs;
          books[book] = entry;
        }
      }
    } else if (looksLikeLessons) {
      // No book level — lessons directly under series (e.g., ReadingPower유형편완성, 빠른독해바른독해_구문독해_2024)
      const activeLessons = [];
      const subs = {};

      for (const lesson of sortNumeric(children)) {
        const lessonDir = path.join(seriesDir, lesson);
        const sections = sortNumeric(subdirs(lessonDir));
        const activeSections = sections.filter(sec =>
          hasTestFiles(path.join(lessonDir, sec))
        );
        const lessonHasDirectFiles = hasTestFiles(lessonDir);

        if (activeSections.length > 0) {
          activeLessons.push(lesson);
          subs[lesson] = activeSections;
        } else if (lessonHasDirectFiles) {
          activeLessons.push(lesson);
        }
      }

      if (activeLessons.length > 0) {
        const entry = {
          dn: seriesDn(series),
          lessons: activeLessons,
          isNew: isNew(series),
          _noBook: true,
        };
        if (Object.keys(subs).length > 0) entry.subs = subs;
        books['_'] = entry;
      }
    } else {
      // Could be book-level or lesson-level — try both
      // Check each child: if it has test files in its subdirs, it's a lesson with sections
      // If it has subdirs that look like lessons, it's a book
      for (const child of sortNumeric(children)) {
        const childDir = path.join(seriesDir, child);
        const grandchildren = subdirs(childDir);
        const gcLooksLikeLessons = grandchildren.some(gc => /^\d+강$/.test(gc) || /^\d+과$/.test(gc));

        if (gcLooksLikeLessons) {
          // book level
          const activeLessons = [];
          const subs = {};
          for (const lesson of sortNumeric(grandchildren)) {
            const lessonDir = path.join(childDir, lesson);
            const sections = sortNumeric(subdirs(lessonDir));
            const activeSections = sections.filter(sec =>
              hasTestFiles(path.join(lessonDir, sec))
            );
            const lessonHasDirectFiles = hasTestFiles(lessonDir);

            if (activeSections.length > 0) {
              activeLessons.push(lesson);
              subs[lesson] = activeSections;
            } else if (lessonHasDirectFiles) {
              activeLessons.push(lesson);
            }
          }
          if (activeLessons.length > 0) {
            const entry = {
              dn: `${seriesDn(series)} ${child}`,
              lessons: activeLessons,
              isNew: isNew(child) || isNew(series),
            };
            if (Object.keys(subs).length > 0) entry.subs = subs;
            books[child] = entry;
          }
        } else {
          // Check if child itself has sections with test files (lesson level under no-book series)
          const activeSections = grandchildren.filter(gc =>
            hasTestFiles(path.join(childDir, gc))
          );
          if (activeSections.length > 0 || hasTestFiles(childDir)) {
            // This is a lesson directly under series — accumulate into '_' book
            if (!books['_']) {
              books['_'] = { dn: seriesDn(series), lessons: [], isNew: isNew(series), _noBook: true, subs: {} };
            }
            books['_'].lessons.push(child);
            if (activeSections.length > 0) {
              books['_'].subs[child] = sortNumeric(activeSections);
            }
          }
        }
      }
      // Clean up _ book
      if (books['_']) {
        books['_'].lessons = sortNumeric(books['_'].lessons);
        if (Object.keys(books['_'].subs).length === 0) delete books['_'].subs;
      }
    }

    if (Object.keys(books).length > 0) {
      result[series] = books;
    }
  }
  return result;
}

function seriesDn(series) {
  const map = {
    'ReadingPower유형편완성': '리딩파워 유형편완성',
    '빠른독해바른독해_구문독해_2024': '빠른독해 바른독해 구문독해',
    '수능특강': '수능특강',
    '수능특강Light': '수능특강Light',
    '올림포스독해의기본1': '올림포스 독해의 기본1',
    '올림포스독해의기본2': '올림포스 독해의 기본2',
    '올림포스전국연합고2': '올림포스 전국연합고2',
  };
  return map[series] || series;
}

// ─── 출력 포맷 ───
function toJS(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return obj.toString();
  if (typeof obj === 'number') return obj.toString();
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(v => toJS(v, 0));
    const oneLine = `[${items.join(',')}]`;
    if (oneLine.length < 120) return oneLine;
    return `[\n${items.map(i => pad + '  ' + i).join(',\n')}\n${pad}]`;
  }
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';
  const parts = entries.map(([k, v]) => {
    const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
    return `${key}:${toJS(v, indent + 1)}`;
  });
  const oneLine = `{${parts.join(',')}}`;
  if (oneLine.length < 200) return oneLine;
  return `{\n${parts.map(p => pad + '  ' + p).join(',\n')}\n${pad}}`;
}

// ─── 메인 ───
function main() {
  console.error('=== rebuild-catalog.js ===');
  console.error(`Scanning: ${DATA}\n`);

  const textbooks = scanTextbooks();
  const mock = scanMock();
  const supplement = scanSupplement();

  // Count stats
  let tbCount = 0, mockCount = 0, supCount = 0;
  for (const subj of Object.values(textbooks)) {
    tbCount += Object.keys(subj).length;
  }
  for (const grade of Object.values(mock)) {
    mockCount += Object.keys(grade).length;
  }
  for (const series of Object.values(supplement)) {
    supCount += Object.keys(series).length;
  }
  console.error(`교과서: ${Object.keys(textbooks).length} subjects, ${tbCount} publishers`);
  console.error(`모의고사: ${Object.keys(mock).length} grades, ${mockCount} exams`);
  console.error(`부교재: ${Object.keys(supplement).length} series, ${supCount} books`);

  // Generate MANIFEST line
  const manifest = { '교과서': textbooks };
  const manifestLine = `let MANIFEST = ${JSON.stringify(manifest)};`;

  // Generate SCOPE_CATALOG
  const scopeCatalog = {
    '교과서': { icon: '📚', items: null },
    '모의고사': { icon: '📝', items: mock },
    '부교재': { icon: '📖', items: supplement },
  };

  // Build SCOPE_CATALOG as a single line for consistency with existing format
  const scLine = buildScopeCatalogLine(mock, supplement);

  if (process.argv.includes('--apply')) {
    applyToIndex(manifestLine, scLine);
  } else {
    console.log('\n// ─── MANIFEST ───');
    console.log(manifestLine);
    console.log('\n// ─── SCOPE_CATALOG ───');
    console.log(scLine);
    console.error('\nUse --apply to write directly to index.html');
  }

  // Also regenerate test-catalog.json
  regenerateTestCatalog(textbooks, mock, supplement);
}

function buildScopeCatalogLine(mock, supplement) {
  // Build the full SCOPE_CATALOG as a compact JSON-like JS object
  const parts = [];

  // 교과서
  parts.push(`"교과서":{ icon:"📚", items:null }`);

  // 모의고사
  const mockParts = [];
  for (const [grade, exams] of Object.entries(mock)) {
    const examParts = [];
    for (const [exam, info] of Object.entries(exams)) {
      const lessonsStr = JSON.stringify(info.lessons);
      let entry = `{dn:${JSON.stringify(info.dn)},lessons:${lessonsStr}`;
      if (info.isNew) entry += `,isNew:true`;
      entry += `}`;
      examParts.push(`${JSON.stringify(exam)}:${entry}`);
    }
    mockParts.push(`${JSON.stringify(grade)}:{${examParts.join(',')}}`);
  }
  parts.push(`"모의고사":{ icon:"📝", items:{${mockParts.join(',')}} }`);

  // 부교재
  const supParts = [];
  for (const [series, books] of Object.entries(supplement)) {
    const bookParts = [];
    for (const [book, info] of Object.entries(books)) {
      let entry = `{dn:${JSON.stringify(info.dn)},lessons:${JSON.stringify(info.lessons)}`;
      if (info.isNew) entry += `,isNew:true`;
      if (info._noBook) entry += `,_noBook:true`;
      if (info.subs) entry += `,subs:${JSON.stringify(info.subs)}`;
      entry += `}`;
      bookParts.push(`${JSON.stringify(book)}:${entry}`);
    }
    supParts.push(`${JSON.stringify(series)}:{${bookParts.join(',')}}`);
  }
  parts.push(`"부교재":{ icon:"📖", items:{${supParts.join(',')}} }`);

  return `const SCOPE_CATALOG = {\n  ${parts.join(',\n  ')}\n};`;
}

function applyToIndex(manifestLine, scopeCatalogBlock) {
  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  // Replace MANIFEST line
  const manifestRe = /^let MANIFEST = \{.*?\};$/m;
  if (!manifestRe.test(html)) {
    console.error('ERROR: Could not find MANIFEST line in index.html');
    process.exit(1);
  }
  html = html.replace(manifestRe, manifestLine);

  // Replace SCOPE_CATALOG block (from "const SCOPE_CATALOG = {" to the matching "};")
  const scStart = html.indexOf('const SCOPE_CATALOG = {');
  if (scStart === -1) {
    console.error('ERROR: Could not find SCOPE_CATALOG in index.html');
    process.exit(1);
  }
  // Find the end: look for "};" after matching braces
  let depth = 0;
  let scEnd = -1;
  for (let i = scStart + 'const SCOPE_CATALOG = '.length; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        // Check for trailing semicolon
        scEnd = i + 1;
        if (html[scEnd] === ';') scEnd++;
        break;
      }
    }
  }
  if (scEnd === -1) {
    console.error('ERROR: Could not find end of SCOPE_CATALOG in index.html');
    process.exit(1);
  }

  html = html.substring(0, scStart) + scopeCatalogBlock + html.substring(scEnd);

  fs.writeFileSync(INDEX_HTML, html, 'utf8');
  console.error('Applied to index.html successfully.');
}

function regenerateTestCatalog(textbooks, mock, supplement) {
  const catalog = { '교과서': {}, '모의고사': {}, '부교재': {} };

  // 교과서
  for (const [subject, pubs] of Object.entries(textbooks)) {
    for (const [pub, info] of Object.entries(pubs)) {
      const id = `${subject}-${pub}`;
      catalog['교과서'][id] = {
        path: `${subject}/${pub}`,
        cat: subject,
        dn: info.dn,
        units: info.lessons,
        sections: info.subs || {},
      };
    }
  }

  // 모의고사
  for (const [grade, exams] of Object.entries(mock)) {
    for (const [exam, info] of Object.entries(exams)) {
      const id = `${grade}-${exam}`;
      catalog['모의고사'][id] = {
        path: `${grade}/${exam}`,
        dn: info.dn,
        items: info.lessons,
      };
    }
  }

  // 부교재
  for (const [series, books] of Object.entries(supplement)) {
    for (const [book, info] of Object.entries(books)) {
      const id = book === '_' ? series : `${series}-${book}`;
      const p = book === '_' ? series : `${series}/${book}`;
      catalog['부교재'][id] = {
        path: p,
        dn: info.dn,
        units: info.lessons,
      };
      if (info.subs) catalog['부교재'][id].sections = info.subs;
    }
  }

  const outPath = path.join(ROOT, 'test-catalog.json');
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.error(`\nRegenerated test-catalog.json (${Object.keys(catalog['교과서']).length} textbooks, ${Object.keys(catalog['모의고사']).length} mocks, ${Object.keys(catalog['부교재']).length} supplements)`);
}

main();
