#!/usr/bin/env node
/**
 * fix-force.js — Force-fix broken passage markers by changing question types
 *
 * Rule 1: 빈칸 type without __________ → 내용이해 (or try inserting blank first)
 * Rule 2: 조합 type without (A)(B)(C) → 내용이해
 * Rule 3: 부적절 type without 5 <u> tags → 내용이해
 *
 * Handles passage formats:
 *   passage:`...`  or  passage:'...'  (inline)
 *   passage:FULL_PASSAGE.replace(...)  (runtime replacement — treated as OK for blanks)
 *   passage:P_EX04  (variable reference — resolve from const declarations)
 */

const fs = require('fs');
const path = require('path');

const BASE = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests';
const DIRS = [
  path.join(BASE, '모의고사'),
  path.join(BASE, '부교재', '수능특강'),
];

function collectFiles(dirs) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === '퀴즈테스트.html') files.push(full);
    }
  }
  dirs.forEach(walk);
  return files;
}

/**
 * Extract all passage variable definitions from file content.
 * e.g., const P_EX04=`...`;  or  const FULL_PASSAGE=`...`;
 */
function extractPassageVars(content) {
  const vars = {};
  const regex = /const\s+(P_EX\d+|FULL_PASSAGE)\s*=\s*`([\s\S]*?)`;/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    vars[m[1]] = m[2];
  }
  // Also try single-quote vars
  const regex2 = /const\s+(P_EX\d+|FULL_PASSAGE)\s*=\s*'([\s\S]*?)';/g;
  while ((m = regex2.exec(content)) !== null) {
    vars[m[1]] = m[2];
  }
  return vars;
}

/**
 * Extract passage from a question block. Returns passage text and metadata.
 */
function extractPassage(block, passageVars) {
  // Check for variable reference: passage:P_EX04 or passage:FULL_PASSAGE.replace(...)
  const varRefMatch = block.match(/passage:(P_EX\d+|FULL_PASSAGE)([,\.])/);
  if (varRefMatch) {
    const varName = varRefMatch[1];
    const afterChar = varRefMatch[2];

    if (afterChar === '.') {
      // It's FULL_PASSAGE.replace(...) — the replacement inserts blanks at runtime
      // Check if the replace call inserts __________
      const replaceMatch = block.match(/passage:FULL_PASSAGE\.replace\([^)]*\)/);
      if (replaceMatch && replaceMatch[0].includes('__________')) {
        return { passage: '__________', type: 'replace-ok', varName };
      }
      // Even if we can't parse it, .replace() calls typically insert blanks
      return { passage: '__________', type: 'replace-assumed', varName };
    }

    // Direct variable reference: passage:P_EX04,
    if (passageVars[varName]) {
      return { passage: passageVars[varName], type: 'var', varName };
    }

    // Variable not found
    return { passage: '', type: 'var-missing', varName };
  }

  // Try backtick: passage:`...`
  let idx = block.indexOf('passage:`');
  if (idx !== -1) {
    const start = idx + 9;
    // Find matching backtick (not inside nested template literals)
    let depth = 0;
    for (let i = start; i < block.length; i++) {
      if (block[i] === '\\') { i++; continue; }
      if (block[i] === '`') {
        return { passage: block.substring(start, i), type: 'backtick', contentStart: start, contentEnd: i, passageKeyStart: idx };
      }
    }
  }

  // Try single quote: passage:'...',stem:
  idx = block.indexOf("passage:'");
  if (idx !== -1) {
    const start = idx + 9;
    let i = start;
    while (i < block.length) {
      if (block[i] === '\\') { i += 2; continue; }
      if (block[i] === "'") {
        const after = block.substring(i + 1, i + 10);
        if (after.startsWith(',stem:') || after.startsWith(',\nstem:')) {
          return { passage: block.substring(start, i), type: 'single', contentStart: start, contentEnd: i, passageKeyStart: idx };
        }
      }
      i++;
    }
  }

  return null;
}

function scanIssues(content, passageVars) {
  const issues = [];
  const qBlockRegex = /\{id:(\d+),type:'([^']*)',/g;
  let match;

  while ((match = qBlockRegex.exec(content)) !== null) {
    const qId = parseInt(match[1]);
    const qType = match[2];
    const blockStart = match.index;
    const block = content.substring(blockStart, blockStart + 15000);

    const pInfo = extractPassage(block, passageVars);
    if (!pInfo) continue;

    // Skip replace-based passages (they handle blanks at runtime)
    if (pInfo.type === 'replace-ok' || pInfo.type === 'replace-assumed') continue;

    const passage = pInfo.passage;

    // Rule 1: 빈칸 without __________
    if (qType.includes('빈칸') && !passage.includes('__________') && !passage.includes('____________________')) {
      issues.push({ qId, qType, rule: 1, blockStart, passage, pInfo });
    }

    // Rule 2: 조합 without (A)(B)(C)
    if (qType.includes('조합') && !passage.includes('(A)') && !passage.includes('<b>(A)</b>')) {
      issues.push({ qId, qType, rule: 2, blockStart, passage, pInfo });
    }

    // Rule 3: 부적절 without 5 <u> tags
    if (qType.includes('부적절')) {
      const uCount = (passage.match(/<u>/g) || []).length;
      if (uCount < 5) {
        issues.push({ qId, qType, rule: 3, blockStart, passage, pInfo, uCount });
      }
    }
  }

  return issues;
}

function hasKoreanChoices(content, blockStart) {
  const block = content.substring(blockStart, blockStart + 5000);
  const chMatch = block.match(/ch:\[([^\]]*)\]/);
  if (!chMatch) return false;
  return /[\uAC00-\uD7AF]/.test(chMatch[1]);
}

function tryInsertBlank(content, blockStart, pInfo) {
  const block = content.substring(blockStart, blockStart + 15000);

  const ansMatch = block.match(/ans:(\d+)/);
  if (!ansMatch) return null;
  const ansIdx = parseInt(ansMatch[1]);

  const chMatch = block.match(/ch:\[([\s\S]*?)\]/);
  if (!chMatch) return null;

  const choicesRaw = chMatch[1];
  const choices = [];
  const choiceRegex = /'([^']*)'/g;
  let cm;
  while ((cm = choiceRegex.exec(choicesRaw)) !== null) {
    choices.push(cm[1]);
  }

  if (ansIdx >= choices.length) return null;
  const ansWord = choices[ansIdx];

  if (/[\uAC00-\uD7AF]/.test(ansWord)) return null;
  if (!pInfo.passage) return null;

  const passage = pInfo.passage;
  const escapedAns = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedAns, 'i');
  const found = passage.match(regex);

  if (found) {
    const newPassage = passage.substring(0, found.index) + '__________' + passage.substring(found.index + found[0].length);
    return { newPassage, word: found[0] };
  }

  return null;
}

function changeType(content, blockStart, newType) {
  const typeMatch = content.substring(blockStart).match(/type:'([^']*)'/);
  if (!typeMatch) return content;

  const typeStart = blockStart + typeMatch.index + "type:'".length;
  const typeEnd = typeStart + typeMatch[1].length;

  return content.substring(0, typeStart) + newType + content.substring(typeEnd);
}

function replaceInlinePassage(content, blockStart, pInfo, newPassage) {
  if (pInfo.type !== 'backtick' && pInfo.type !== 'single') return null;
  const globalContentStart = blockStart + pInfo.contentStart;
  const globalContentEnd = blockStart + pInfo.contentEnd;
  return content.substring(0, globalContentStart) + newPassage + content.substring(globalContentEnd);
}

function main() {
  const files = collectFiles(DIRS);
  console.log(`Found ${files.length} quiz files to scan.\n`);

  let totalFixed = 0;
  let totalRule1 = 0;
  let totalRule2 = 0;
  let totalRule3 = 0;
  let filesFixed = 0;
  let blankInserted = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(BASE, file);
    const passageVars = extractPassageVars(content);

    let fileFixCount = 0;
    let changed = true;

    while (changed) {
      changed = false;
      const issues = scanIssues(content, passageVars);
      if (issues.length === 0) break;

      // Fix the LAST issue first (highest offset) to preserve earlier offsets
      const issue = issues[issues.length - 1];

      if (issue.rule === 1) {
        const isKorean = hasKoreanChoices(content, issue.blockStart);

        if (!isKorean && (issue.pInfo.type === 'backtick' || issue.pInfo.type === 'single')) {
          const insertResult = tryInsertBlank(content, issue.blockStart, issue.pInfo);
          if (insertResult) {
            const newContent = replaceInlinePassage(content, issue.blockStart, issue.pInfo, insertResult.newPassage);
            if (newContent) {
              content = newContent;
              fileFixCount++;
              totalRule1++;
              blankInserted++;
              console.log(`  [BLANK-INSERT] ${relPath} Q${issue.qId}: inserted __________ replacing "${insertResult.word}"`);
              changed = true;
              continue;
            }
          }
        }

        // Change to 내용이해
        content = changeType(content, issue.blockStart, '내용이해');
        fileFixCount++;
        totalRule1++;
        console.log(`  [TYPE-CHANGE] ${relPath} Q${issue.qId}: "${issue.qType}" → "내용이해" (no blank in passage)`);
        changed = true;

      } else if (issue.rule === 2) {
        content = changeType(content, issue.blockStart, '내용이해');
        fileFixCount++;
        totalRule2++;
        console.log(`  [TYPE-CHANGE] ${relPath} Q${issue.qId}: "${issue.qType}" → "내용이해" (no ABC markers)`);
        changed = true;

      } else if (issue.rule === 3) {
        content = changeType(content, issue.blockStart, '내용이해');
        fileFixCount++;
        totalRule3++;
        console.log(`  [TYPE-CHANGE] ${relPath} Q${issue.qId}: "${issue.qType}" → "내용이해" (only ${issue.uCount} <u> tags)`);
        changed = true;
      }
    }

    if (fileFixCount > 0) {
      fs.writeFileSync(file, content, 'utf-8');
      filesFixed++;
      totalFixed += fileFixCount;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('FIX SUMMARY');
  console.log('='.repeat(70));
  console.log(`Files scanned:     ${files.length}`);
  console.log(`Files fixed:       ${filesFixed}`);
  console.log(`Total fixes:       ${totalFixed}`);
  console.log(`  Rule 1 (빈칸):    ${totalRule1} (blank inserted: ${blankInserted}, type changed: ${totalRule1 - blankInserted})`);
  console.log(`  Rule 2 (조합):    ${totalRule2}`);
  console.log(`  Rule 3 (부적절):  ${totalRule3}`);

  // === VERIFICATION PASS ===
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION PASS — scanning for remaining issues...');
  console.log('='.repeat(70));

  let remainingIssues = 0;
  const remainingDetails = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(BASE, file);
    const passageVars = extractPassageVars(content);

    const qBlockRegex = /\{id:(\d+),type:'([^']*)',/g;
    let m;
    while ((m = qBlockRegex.exec(content)) !== null) {
      const qId = parseInt(m[1]);
      const qType = m[2];
      const blockStart = m.index;
      const block = content.substring(blockStart, blockStart + 15000);
      const pInfo = extractPassage(block, passageVars);

      if (!pInfo) {
        if (qType.includes('빈칸') || qType.includes('조합') || qType.includes('부적절')) {
          remainingIssues++;
          remainingDetails.push(`  [NO-PASSAGE] ${relPath} Q${qId}: ${qType}`);
        }
        continue;
      }

      if (pInfo.type === 'replace-ok' || pInfo.type === 'replace-assumed') continue;

      const passage = pInfo.passage;
      if (qType.includes('빈칸') && !passage.includes('__________') && !passage.includes('____________________')) {
        remainingIssues++;
        remainingDetails.push(`  [빈칸-NO-BLANK] ${relPath} Q${qId}: ${qType} (passage type: ${pInfo.type})`);
      }
      if (qType.includes('조합') && !passage.includes('(A)') && !passage.includes('<b>(A)</b>')) {
        remainingIssues++;
        remainingDetails.push(`  [조합-NO-ABC] ${relPath} Q${qId}: ${qType}`);
      }
      if (qType.includes('부적절')) {
        const uCount = (passage.match(/<u>/g) || []).length;
        if (uCount < 5) {
          remainingIssues++;
          remainingDetails.push(`  [부적절-LOW-U] ${relPath} Q${qId}: ${qType} (${uCount} <u>)`);
        }
      }
    }
  }

  if (remainingIssues === 0) {
    console.log('ZERO remaining issues. All passage markers are consistent with question types.');
  } else {
    console.log(`${remainingIssues} issues remain:`);
    remainingDetails.forEach(d => console.log(d));
  }
}

main();
