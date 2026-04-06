#!/usr/bin/env node
/**
 * build-passages.js — _passages/ 단일소스 생성
 *
 * 각 시험(모의고사/고X/월) 디렉토리에서 문항번호별 폴더의
 * JSON 파일들에서 fullPassage를 추출하여 _passages/번호.json으로 저장.
 *
 * Usage:
 *   node scripts/build-passages.js                    # 모의고사 전체
 *   node scripts/build-passages.js data/모의고사/고2/3월  # 특정 경로
 *   node scripts/build-passages.js --all              # 모의고사+교과서+부교재
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function findExamDirs(baseDir) {
  // 시험 디렉토리 = 문항번호 폴더(XX번)가 있는 디렉토리
  const results = [];

  function walk(dir, depth) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const hasNumberDirs = entries.some(e => e.isDirectory() && /^\d+번$/.test(e.name));

    if (hasNumberDirs) {
      results.push(dir);
      return; // 하위 탐색 불필요
    }

    if (depth < 5) {
      entries.forEach(e => {
        if (e.isDirectory() && !e.name.startsWith('_') && e.name !== 'node_modules') {
          walk(path.join(dir, e.name), depth + 1);
        }
      });
    }
  }

  walk(baseDir, 0);
  return results;
}

function countSentences(text) {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean.match(/[.!?]+(?=\s|$)/g) || []).length;
}

function countWords(text) {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.split(/\s+/).filter(w => w.length > 0).length;
}

function buildPassagesForExam(examDir) {
  const passagesDir = path.join(examDir, '_passages');
  const entries = fs.readdirSync(examDir, { withFileTypes: true });
  const numberDirs = entries.filter(e => e.isDirectory() && /^\d+번$/.test(e.name));

  if (numberDirs.length === 0) return { dir: examDir, created: 0, skipped: 0 };

  // 시험 정보 추출 (디렉토리 구조에서)
  const relPath = path.relative(path.join(ROOT, 'data'), examDir);
  const parts = relPath.split(path.sep);

  let created = 0, skipped = 0, updated = 0;

  numberDirs.forEach(numDir => {
    const numName = numDir.name; // e.g., "18번"
    const numPath = path.join(examDir, numName);

    // 이 번호의 JSON 파일들에서 fullPassage 찾기
    const jsonFiles = fs.readdirSync(numPath)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(numPath, f));

    if (jsonFiles.length === 0) { skipped++; return; }

    // 가장 긴 fullPassage 선택 (여러 파일에서)
    let bestPassage = '';
    let bestTitle = '';
    let bestSubject = '';

    jsonFiles.forEach(jf => {
      try {
        const data = JSON.parse(fs.readFileSync(jf, 'utf8'));
        const fp = data.fullPassage || '';
        if (fp.length > bestPassage.length) {
          bestPassage = fp;
        }
        if (!bestSubject && data.ei) {
          bestSubject = `${data.ei.subject || ''}`.trim();
          bestTitle = `${data.ei.title || ''}`.trim();
        }
      } catch (e) { /* skip */ }
    });

    if (!bestPassage || bestPassage.length < 10) { skipped++; return; }

    // _passages 디렉토리 생성
    if (!fs.existsSync(passagesDir)) {
      fs.mkdirSync(passagesDir, { recursive: true });
    }

    const passageFile = path.join(passagesDir, `${numName}.json`);
    const passageData = {
      id: numName,
      subject: bestSubject || parts.join(' '),
      title: bestTitle,
      fullPassage: bestPassage,
      sentenceCount: countSentences(bestPassage),
      wordCount: countWords(bestPassage)
    };

    // 기존 파일이 있으면 passage 비교
    if (fs.existsSync(passageFile)) {
      const existing = JSON.parse(fs.readFileSync(passageFile, 'utf8'));
      if (existing.fullPassage === bestPassage) {
        skipped++;
        return;
      }
      updated++;
    } else {
      created++;
    }

    fs.writeFileSync(passageFile, JSON.stringify(passageData, null, 2) + '\n', 'utf8');
  });

  return { dir: examDir, created, updated, skipped, total: numberDirs.length };
}

function main() {
  const args = process.argv.slice(2);
  let baseDir;

  if (args.length === 0) {
    baseDir = path.join(ROOT, 'data', '모의고사');
  } else if (args[0] === '--all') {
    baseDir = path.join(ROOT, 'data');
  } else {
    baseDir = path.resolve(args[0]);
    if (!fs.existsSync(baseDir)) {
      baseDir = path.join(ROOT, args[0]);
    }
  }

  if (!fs.existsSync(baseDir)) {
    console.error(`Path not found: ${baseDir}`);
    process.exit(1);
  }

  const examDirs = findExamDirs(baseDir);
  console.log(`Found ${examDirs.length} exam directories\n`);

  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;

  examDirs.forEach(dir => {
    const result = buildPassagesForExam(dir);
    const relDir = path.relative(ROOT, dir);
    if (result.created > 0 || result.updated > 0) {
      console.log(`📁 ${relDir}: +${result.created} new, ~${result.updated || 0} updated, ${result.skipped} unchanged (${result.total} total)`);
    }
    totalCreated += result.created;
    totalUpdated += (result.updated || 0);
    totalSkipped += result.skipped;
  });

  console.log(`\n━━━ build-passages 결과 ━━━`);
  console.log(`시험: ${examDirs.length}개`);
  console.log(`생성: ${totalCreated}개`);
  console.log(`업데이트: ${totalUpdated}개`);
  console.log(`변경없음: ${totalSkipped}개`);
}

main();
