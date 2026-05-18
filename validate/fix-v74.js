#!/usr/bin/env node
/**
 * fix-v74.js — 어형변환 V74 passage 자동 수정
 *
 * V74: 어형변환 passage > 6문장 → fullPassage에서 정답 단어 근처 2~4문장 추출
 * 정답 단어 위치를 ____(baseWord)로 교체
 *
 * Usage:
 *   node validate/fix-v74.js                    # v74.json 목록 기준
 *   node validate/fix-v74.js --all              # data/ 전체
 *   node validate/fix-v74.js --dry-run          # 변경 미적용 (미리보기)
 *   node validate/fix-v74.js data/path/file.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const V74_LIST = path.join('/tmp', 'v74.json');

const TARGET_SENTENCES = 3; // 목표 문장 수

function splitSentences(text) {
  const clean = (text || '').replace(/<br\s*\/?>/gi, '\n');
  const parts = clean.split(/(?<=[.!?])\s+/);
  return parts.filter(p => p.trim().length > 0);
}

function countSentences(text) {
  const clean = (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean.match(/[.!?]+(?=\s|$)/g) || []).length;
}

/**
 * 기본형(baseWord)으로부터 파생형들을 추정하는 함수
 * (완전한 형태론적 분석은 아니지만 대부분의 케이스 커버)
 */
function getWordForms(baseWord) {
  const b = baseWord.toLowerCase().trim();
  const forms = new Set([b]);

  // 기본 파생형
  forms.add(b + 's');
  forms.add(b + 'es');
  forms.add(b + 'd');
  forms.add(b + 'ed');
  forms.add(b + 'ing');
  forms.add(b + 'er');
  forms.add(b + 'est');
  forms.add(b + 'ly');
  forms.add(b + 'ion');
  forms.add(b + 'tion');
  forms.add(b + 'ness');
  forms.add(b + 'ment');
  forms.add(b + 'al');
  forms.add(b + 'ity');
  forms.add(b + 'ive');
  forms.add(b + 'ful');
  forms.add(b + 'less');
  forms.add(b + 'able');
  forms.add(b + 'ible');

  // e로 끝나는 경우
  if (b.endsWith('e')) {
    const stem = b.slice(0, -1);
    forms.add(stem + 'ing');
    forms.add(stem + 'ed');
    forms.add(stem + 'er');
    forms.add(stem + 'est');
    forms.add(stem + 'ion');
    forms.add(stem + 'tion');
    forms.add(stem + 'ation');
  }

  // y로 끝나는 경우
  if (b.endsWith('y')) {
    const stem = b.slice(0, -1);
    forms.add(stem + 'ies');
    forms.add(stem + 'ied');
    forms.add(stem + 'ier');
    forms.add(stem + 'iest');
    forms.add(stem + 'ily');
    forms.add(stem + 'iness');
    forms.add(stem + 'ication');
  }

  // 자음 + 모음 + 자음 이중 자음
  if (b.length >= 3) {
    const last = b[b.length - 1];
    const prev = b[b.length - 2];
    const pprev = b[b.length - 3];
    const vowels = 'aeiou';
    if (!vowels.includes(last) && vowels.includes(prev) && !vowels.includes(pprev)) {
      forms.add(b + last + 'ed');
      forms.add(b + last + 'ing');
      forms.add(b + last + 'er');
    }
  }

  // 정답(wa) 자체도 추가 (이미 변환된 형태일 수 있음)
  return forms;
}

/**
 * fullPassage에서 wa(정답) 단어 또는 baseWord 형태를 포함하는 문장을 찾아
 * 2~4문장 추출, 해당 단어를 ____(baseWord)로 교체
 */
function buildExcerpt(fullPassage, wa, baseWord, targetSents) {
  const sentences = splitSentences(fullPassage);
  if (sentences.length === 0) return null;

  const waLower = (wa || '').toLowerCase().trim();
  const baseLower = (baseWord || '').toLowerCase().trim();
  const forms = getWordForms(baseLower);
  if (waLower) forms.add(waLower);

  // 정답 단어/기본형 포함 문장 찾기
  let targetIdx = -1;
  for (let i = 0; i < sentences.length; i++) {
    const sLower = sentences[i].toLowerCase();
    // 단어 경계로 매칭
    for (const form of forms) {
      if (new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(sLower)) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx >= 0) break;
  }

  if (targetIdx < 0) {
    // 매칭 못 찾으면 wa 포함 여부 substring으로 재시도
    for (let i = 0; i < sentences.length; i++) {
      if (waLower && sentences[i].toLowerCase().includes(waLower)) {
        targetIdx = i;
        break;
      }
    }
  }

  if (targetIdx < 0) {
    // 마지막 수단: baseLower substring
    for (let i = 0; i < sentences.length; i++) {
      if (baseLower && sentences[i].toLowerCase().includes(baseLower)) {
        targetIdx = i;
        break;
      }
    }
  }

  if (targetIdx < 0) {
    // 루트 접두어 매칭 (첫 5자 이상)
    const prefix = (waLower.length >= 5 ? waLower.substring(0, 5) : waLower);
    for (let i = 0; i < sentences.length; i++) {
      if (prefix && sentences[i].toLowerCase().includes(prefix)) {
        targetIdx = i;
        break;
      }
    }
  }

  if (targetIdx < 0 && baseLower.length >= 4) {
    // base 접두어 매칭 (첫 4자)
    const bPrefix = baseLower.substring(0, 4);
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].toLowerCase().includes(bPrefix)) {
        targetIdx = i;
        break;
      }
    }
  }

  if (targetIdx < 0) return null;

  // targetIdx 중심으로 targetSents 문장 추출
  let startIdx = Math.max(0, targetIdx - Math.floor(targetSents / 2));
  startIdx = Math.min(startIdx, sentences.length - targetSents);
  startIdx = Math.max(0, startIdx);

  const selected = sentences.slice(startIdx, startIdx + targetSents);
  let excerpt = selected.join(' ');

  // 정답 단어를 ____(baseWord)로 교체
  // 우선순위: wa(정확히) > 긴 파생형 > 짧은 파생형 > 접두어 매칭

  // 파생형을 길이 내림차순으로 정렬 (긴 것 먼저 매칭하여 오교체 방지)
  const sortedForms = Array.from(forms).sort((a, b) => b.length - a.length);

  // 1) wa 정확히 매칭 (최우선)
  if (waLower) {
    const waRegex = new RegExp(`\\b${waLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (waRegex.test(excerpt)) {
      excerpt = excerpt.replace(waRegex, `_____(${baseWord})`);
      return excerpt;
    }
  }

  // 2) forms 중 하나 매칭 (긴 것 먼저)
  for (const form of sortedForms) {
    if (form.length < 4 || form === baseLower) continue; // base 자체는 스킵 (오교체 방지)
    const fRegex = new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (fRegex.test(excerpt)) {
      excerpt = excerpt.replace(fRegex, `_____(${baseWord})`);
      return excerpt;
    }
  }

  // 3) base 자체 매칭 (마지막 수단 — 독립 단어로)
  if (baseLower.length >= 4) {
    const baseRegex = new RegExp(`\\b${baseLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (baseRegex.test(excerpt)) {
      excerpt = excerpt.replace(baseRegex, `_____(${baseWord})`);
      return excerpt;
    }
  }

  // 4) wa 접두어(5자) 포함 단어 교체
  if (waLower.length >= 5) {
    const prefix = waLower.substring(0, 5);
    const prefixRegex = new RegExp(`\\b${prefix}\\w*\\b`, 'i');
    if (prefixRegex.test(excerpt)) {
      excerpt = excerpt.replace(prefixRegex, `_____(${baseWord})`);
      return excerpt;
    }
  }

  // 5) base 접두어(4자) 포함 단어 교체
  if (baseLower.length >= 4) {
    const bPrefix = baseLower.substring(0, 4);
    const bRegex = new RegExp(`\\b${bPrefix}\\w*\\b`, 'i');
    if (bRegex.test(excerpt)) {
      excerpt = excerpt.replace(bRegex, `_____(${baseWord})`);
    }
  }

  return excerpt;
}

/**
 * stem에서 base word 추출
 * 예: "[incorporate]" → "incorporate"
 *     "(accountable)" → "accountable"
 *     "Dalip's (elect) ____" → "elect"
 *     "(quick) hid behind" → "quick"
 */
function extractBaseWordFromStem(stem) {
  if (!stem) return null;

  // 1) 마지막 [...] — 가장 명확한 패턴
  let m = stem.match(/\[([a-zA-Z][a-zA-Z\s]*)\]\s*(?:\(영어로\))?\s*$/);
  if (m) return m[1].trim().split(/\s+/)[0];

  // 2) 마지막 줄 끝 (N단어) 형식 제외하고 (word) 패턴
  m = stem.match(/\[([a-zA-Z]+)\]/);
  if (m) return m[1].trim();

  // 3) ____ 바로 앞에 오는 (word) 패턴 — "Dalip's (elect) ______"
  m = stem.match(/\(([a-zA-Z]+)\)\s*_+/);
  if (m) return m[1].trim();

  // 4) 줄 시작 부분 "She __________(quick)" 패턴
  m = stem.match(/_+\(([a-zA-Z]+)\)/);
  if (m) return m[1].trim();

  // 5) 마지막 위치 (word) — 끝에 있는 경우
  m = stem.match(/\(([a-zA-Z]+)\)\s*(?:\(영어로\))?\s*$/);
  if (m) return m[1].trim();

  return null;
}

/**
 * passage 자체에서 base word 추출 (기존 _____(word) 패턴)
 */
function extractBaseWordFromPassage(passage) {
  if (!passage) return null;
  const match = passage.match(/_+\s*\(?([a-zA-Z]+)\)?/);
  if (match) return match[1].trim();
  return null;
}

function isV74(q) {
  const typeNorm = (q.type || '').trim();
  if (!typeNorm.includes('어형')) return false;
  const pText = (q.passage || '').replace(/<[^>]+>/g, '');
  const sentCount = (pText.match(/[.!?]+/g) || []).length;
  return sentCount > 6;
}

function processFile(filePath, dryRun) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { path: filePath, fixes: [], errors: [e.message] };
  }

  if (!data.questions) return { path: filePath, fixes: [], errors: [] };

  const fullPassage = data.fullPassage || '';
  if (!fullPassage || fullPassage.length < 20) {
    return { path: filePath, fixes: [], errors: ['fullPassage 없음'] };
  }

  const fixes = [];
  const errors = [];

  data.questions.forEach((q) => {
    if (!isV74(q)) return;

    const qid = q.id;
    const oldSentCount = countSentences(q.passage || '');

    // base word 추출 (우선순위: stem > passage)
    let baseWord = extractBaseWordFromStem(q.stem)
      || extractBaseWordFromPassage(q.passage);

    if (!baseWord && q.wa) {
      // wa 자체를 baseWord로 사용 (형태 그대로)
      baseWord = q.wa;
    }

    if (!baseWord) {
      errors.push(`Q${qid}: baseWord 추출 실패 (stem=${q.stem?.substring(0,50)})`);
      return;
    }

    const newPassage = buildExcerpt(fullPassage, q.wa, baseWord, TARGET_SENTENCES);

    if (!newPassage) {
      errors.push(`Q${qid}: fullPassage에서 "${q.wa || baseWord}" 찾기 실패`);
      return;
    }

    const newSentCount = countSentences(newPassage);

    fixes.push({
      qId: qid,
      baseWord,
      wa: q.wa,
      oldSent: oldSentCount,
      newSent: newSentCount,
      newPassage: newPassage.substring(0, 100) + (newPassage.length > 100 ? '...' : '')
    });

    if (!dryRun) {
      q.passage = newPassage;
    }
  });

  if (fixes.length > 0 && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  return { path: filePath, fixes, errors };
}

function findAllJsonFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
      results = results.concat(findAllJsonFiles(full));
    } else if (entry.name.endsWith('.json') && /^(단어|워크북|퀴즈)\.json$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(a => a !== '--dry-run');

  let files = [];

  if (filteredArgs.length === 0 || filteredArgs[0] === '--v74-list') {
    // v74.json 목록 사용
    if (!fs.existsSync(V74_LIST)) {
      console.error('v74.json 없음. --all 또는 파일 직접 지정');
      process.exit(1);
    }
    const list = JSON.parse(fs.readFileSync(V74_LIST, 'utf8'));
    files = list.map(f => path.join(ROOT, f));
  } else if (filteredArgs[0] === '--all') {
    files = findAllJsonFiles(path.join(ROOT, 'data'));
  } else {
    files = filteredArgs.map(f => path.isAbsolute(f) ? f : path.join(process.cwd(), f));
  }

  console.log(`\n=== fix-v74.js ${dryRun ? '[DRY RUN]' : ''} ===`);
  console.log(`대상 파일: ${files.length}개\n`);

  let totalFixes = 0;
  let totalErrors = 0;
  const failFiles = [];

  for (const f of files) {
    const result = processFile(f, dryRun);
    const rel = path.relative(ROOT, result.path);

    if (result.fixes.length > 0) {
      console.log(`✅ ${rel}`);
      result.fixes.forEach(fix => {
        console.log(`   Q${fix.qId} [${fix.baseWord}]: ${fix.oldSent}문장 → ${fix.newSent}문장`);
        console.log(`   → "${fix.newPassage}"`);
      });
      totalFixes += result.fixes.length;
    }

    if (result.errors && result.errors.length > 0) {
      console.log(`⚠️  ${rel}`);
      result.errors.forEach(e => console.log(`   ${e}`));
      totalErrors += result.errors.length;
      failFiles.push({ rel, errors: result.errors });
    }
  }

  console.log(`\n=== 결과 ===`);
  console.log(`수정: ${totalFixes}문항`);
  console.log(`실패: ${totalErrors}건`);
  if (dryRun) console.log('\n[DRY RUN] 실제 파일은 변경되지 않았습니다.');

  if (failFiles.length > 0) {
    console.log('\n수동 확인 필요:');
    failFiles.forEach(f => {
      console.log(`  ${f.rel}`);
      f.errors.forEach(e => console.log(`    - ${e}`));
    });
  }
}

main();
