#!/usr/bin/env node
/**
 * fix-underline.js — P-UL4 어법 밑줄 자동 추가
 *
 * 어법 문항에서 ch[] 단어가 passage에 있지만 <u> 밑줄이 없는 경우
 * passage에서 ch 단어를 찾아 <u> 태그 추가
 *
 * Usage:
 *   node validate/fix-underline.js --all
 *   node validate/fix-underline.js --dry-run --all
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAMMAR_TYPES = ['어법', '어법 빈칸', '어법 밑줄형', '어법 빈칸형', '어법 5지선다'];

function findJsonFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '_passages' && entry.name !== 'node_modules') {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
      results.push(full);
    }
  }
  return results;
}

function stripMarker(s) {
  return (s || '').replace(/^[①②③④⑤]\s*/, '').trim();
}

function processFile(filePath, dryRun) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { path: filePath, fixes: [] };
  }

  const fixes = [];
  const fullPassage = data.fullPassage || '';

  (data.questions || []).forEach((q, i) => {
    const typeNorm = (q.type || '').trim();
    if (!GRAMMAR_TYPES.some(gt => typeNorm.includes(gt))) return;

    const ch = q.ch || [];
    if (ch.length < 2) return;

    // (A)(B)(C) 형태 또는 ⓐ~ⓔ 형태는 밑줄형이 아님
    if (ch.some(c => /^\(A\)|ⓐ/.test((c || '').trim()))) return;

    // 마커만 있는 ch (①만 있고 내용 없음)은 스킵
    const chWords = ch.map(c => stripMarker(c)).filter(w => w.length > 0);
    if (chWords.length < 2) return;

    let psg = q.passage || fullPassage;
    if (!psg || psg.length < 50) return;

    // 현재 밑줄 수
    const currentUl = (psg.match(/<u>/g) || []).length;
    if (currentUl >= 4) return; // 이미 충분

    // ch 단어를 passage에서 찾아 밑줄 추가
    let newPsg = psg;
    let added = 0;

    for (const word of chWords) {
      if (added + currentUl >= 4) break;

      // 이미 밑줄이 있는지 확인
      const ulPattern = new RegExp(`<u>[^<]*${escapeRegex(word)}[^<]*</u>`, 'i');
      if (ulPattern.test(newPsg)) continue;

      // passage에서 단어 찾기 (단어 경계)
      const wordPattern = new RegExp(`(?<![<\\/a-zA-Z])(${escapeRegex(word)})(?![<a-zA-Z])`, 'i');
      if (wordPattern.test(newPsg)) {
        newPsg = newPsg.replace(wordPattern, '<u>$1</u>');
        added++;
      }
    }

    if (added === 0) return;

    const finalUl = (newPsg.match(/<u>/g) || []).length;

    fixes.push({
      qId: q.id || (i + 1),
      type: typeNorm,
      oldUl: currentUl,
      newUl: finalUl,
      added
    });

    if (!dryRun) {
      if (q.passage) {
        q.passage = newPsg;
      }
      // fullPassage 기반이면 passage 필드에 새 값 설정
      if (!q.passage && psg === fullPassage) {
        q.passage = newPsg;
      }
    }
  });

  if (fixes.length > 0 && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  return { path: filePath, fixes };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(a => a !== '--dry-run');

  if (filteredArgs.length === 0) {
    console.error('Usage: node validate/fix-underline.js [--dry-run] <path|--all>');
    process.exit(1);
  }

  let targetDir;
  if (filteredArgs[0] === '--all') {
    targetDir = path.join(ROOT, 'data');
  } else {
    targetDir = path.resolve(filteredArgs[0]);
    if (!fs.existsSync(targetDir)) targetDir = path.join(ROOT, 'data', filteredArgs[0]);
  }

  const files = fs.statSync(targetDir).isDirectory()
    ? findJsonFiles(targetDir) : [targetDir];

  console.log(`${dryRun ? '[DRY-RUN] ' : ''}Scanning ${files.length} files...\n`);

  let totalFixes = 0, filesFixed = 0;

  files.forEach(f => {
    const result = processFile(f, dryRun);
    if (result.fixes.length === 0) return;

    filesFixed++;
    const relPath = path.relative(ROOT, f);
    console.log(`📝 ${relPath}`);
    result.fixes.forEach(fix => {
      totalFixes++;
      console.log(`  Q${fix.qId} ${fix.type}: 밑줄 ${fix.oldUl}→${fix.newUl}개 (+${fix.added})`);
    });
  });

  console.log(`\n━━━ fix-underline 결과 ━━━`);
  console.log(`파일: ${files.length}개 스캔, ${filesFixed}개 수정`);
  console.log(`밑줄 추가: ${totalFixes}건`);
  if (dryRun) console.log(`\n⚠️ DRY-RUN 모드 — 실제 파일 변경 없음`);
}

main();
