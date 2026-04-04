#!/usr/bin/env node
/**
 * fix-v72-passage.js
 *
 * V72 위반 수정: 서술형(찾기) 문항의 passage가 6문장 미만인 경우,
 * fullPassage에서 주변 문장을 추가해 6문장 이상으로 확장
 *
 * 대상: data/교과서, data/모의고사 (수능특강Light 제외)
 */

const fs = require('fs');
const path = require('path');

// ─── 문장 분리 함수 ────────────────────────────────────────────────────────────
/**
 * HTML 태그, 따옴표 안 마침표 등을 고려한 영어 문장 분리
 * 마침표(.)/물음표(?)/느낌표(!) 뒤 공백+대문자 패턴으로 분리
 */
function splitSentences(text) {
  if (!text || !text.trim()) return [];

  // HTML 태그 제거 (문장 경계 판단용)
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // 문장 분리: . ? ! 뒤에 공백+대문자 OR 문자열 끝
  const sentences = [];
  // 약어/소수점 패턴을 피하기 위해 섬세하게 분리
  const parts = plain.split(/(?<=[.?!])\s+(?=[A-Z"'])/);
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed.length > 5) { // 너무 짧은 조각 제외
      sentences.push(trimmed);
    }
  }
  return sentences.length > 0 ? sentences : [plain];
}

function countSentences(text) {
  return splitSentences(text).length;
}

// ─── fullPassage에서 문장 목록 추출 ────────────────────────────────────────────
function extractSentencesFromFullPassage(fullPassage) {
  // HTML 태그 제거
  const plain = fullPassage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return splitSentences(plain);
}

// ─── passage가 fullPassage 내 어느 위치에 있는지 찾기 ─────────────────────────
function findPassageInFullPassage(passage, fpSentences) {
  // passage에서 HTML 태그 제거하고 핵심 텍스트 추출
  const passagePlain = passage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const passageSentences = splitSentences(passagePlain);

  if (passageSentences.length === 0) return { startIdx: -1, endIdx: -1 };

  let startIdx = -1;
  let endIdx = -1;

  // 첫 문장 위치 찾기 (다양한 길이로 시도)
  for (const len of [30, 20, 15, 10]) {
    const firstKey = passageSentences[0].substring(0, len);
    if (!firstKey.trim()) continue;
    for (let i = 0; i < fpSentences.length; i++) {
      if (fpSentences[i].includes(firstKey)) {
        startIdx = i;
        break;
      }
    }
    if (startIdx !== -1) break;
  }

  // fallback: passage의 첫 5단어로 검색
  if (startIdx === -1) {
    const words = passageSentences[0].split(' ').slice(0, 5).join(' ');
    for (let i = 0; i < fpSentences.length; i++) {
      if (fpSentences[i].includes(words)) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) return { startIdx: -1, endIdx: -1 };

  // 마지막 문장 위치 찾기 (startIdx 이후에서만 검색)
  const lastSent = passageSentences[passageSentences.length - 1];
  for (const len of [30, 20, 15, 10]) {
    const lastKey = lastSent.substring(0, len);
    if (!lastKey.trim()) continue;
    for (let i = startIdx; i < fpSentences.length; i++) {
      if (fpSentences[i].includes(lastKey)) {
        endIdx = i;
        // 더 뒤에도 있을 수 있으니 계속 탐색
      }
    }
    if (endIdx !== -1) break;
  }

  // endIdx를 못 찾으면 passage 문장 수 기반으로 추정
  if (endIdx === -1 || endIdx < startIdx) {
    endIdx = startIdx + passageSentences.length - 1;
    if (endIdx >= fpSentences.length) endIdx = fpSentences.length - 1;
  }

  return { startIdx, endIdx };
}

// ─── passage 확장 함수 ────────────────────────────────────────────────────────
function expandPassage(passage, fullPassage, targetSentences = 6) {
  const fpSentences = extractSentencesFromFullPassage(fullPassage);
  if (fpSentences.length < targetSentences) {
    // fullPassage 자체도 부족하면 fullPassage 전체 사용
    return { expanded: fullPassage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), method: 'full_passage' };
  }

  const { startIdx, endIdx } = findPassageInFullPassage(passage, fpSentences);

  if (startIdx === -1) {
    // 위치를 못 찾은 경우: fullPassage에서 앞부분 6문장 사용
    return {
      expanded: fpSentences.slice(0, targetSentences).join(' '),
      method: 'fallback_front'
    };
  }

  // 현재 passage 문장 수
  const currentCount = endIdx - startIdx + 1;
  const needed = targetSentences - currentCount;

  if (needed <= 0) {
    // 이미 충분함 (재확인용)
    return { expanded: passage, method: 'already_ok' };
  }

  // 앞뒤로 균등하게 확장
  let newStart = startIdx;
  let newEnd = endIdx;

  const addBefore = Math.floor(needed / 2);
  const addAfter = needed - addBefore;

  newStart = Math.max(0, startIdx - addBefore);
  newEnd = Math.min(fpSentences.length - 1, endIdx + addAfter);

  // 여전히 부족하면 반대방향으로 더 추가
  const got = newEnd - newStart + 1;
  if (got < targetSentences) {
    const stillNeeded = targetSentences - got;
    if (newStart > 0) {
      newStart = Math.max(0, newStart - stillNeeded);
    } else if (newEnd < fpSentences.length - 1) {
      newEnd = Math.min(fpSentences.length - 1, newEnd + stillNeeded);
    }
  }

  const expandedSentences = fpSentences.slice(newStart, newEnd + 1);
  return {
    expanded: expandedSentences.join(' '),
    method: `expanded(${startIdx}-${endIdx} -> ${newStart}-${newEnd})`
  };
}

// ─── V72 위반 여부 판단 ────────────────────────────────────────────────────────
function isV72Violation(q) {
  if (q.fmt !== 'written') return false;
  const type = q.type || '';
  const stem = q.stem || '';
  const isTarget = type.includes('핵심단어') ||
                   stem.includes('찾아') ||
                   stem.includes('찾으시오');
  if (!isTarget) return false;
  const sentCount = countSentences(q.passage || '');
  return sentCount < 6;
}

// ─── 파일 순회 ────────────────────────────────────────────────────────────────
function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
function main() {
  const baseDir = path.resolve(__dirname, '..');
  const targetDirs = [
    path.join(baseDir, 'data', '교과서'),
    path.join(baseDir, 'data', '모의고사'),
  ];

  const allFiles = [];
  for (const dir of targetDirs) {
    allFiles.push(...walkDir(dir));
  }

  // 수능특강Light 경로 제외
  const files = allFiles.filter(f => !f.includes('수능특강Light'));

  console.log(`\n총 ${files.length}개 파일 검사 중...\n`);

  let totalViolations = 0;
  let fixed = 0;
  let noFullPassage = 0;
  let alreadyOk = 0;

  const fixedFiles = [];
  const failedFiles = [];
  const detailLog = [];

  for (const filePath of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`JSON 파싱 실패: ${filePath}`);
      continue;
    }

    const questions = data.questions || [];
    const fullPassage = data.fullPassage || '';

    let fileModified = false;
    let fileViolations = 0;
    let fileFixed = 0;

    for (const q of questions) {
      if (!isV72Violation(q)) continue;

      fileViolations++;
      totalViolations++;

      const origSentCount = countSentences(q.passage || '');
      const relPath = filePath.replace(baseDir + '/', '');

      if (!fullPassage) {
        // fullPassage 없음 (실제로는 없는 케이스가 0개이지만 방어코드)
        noFullPassage++;
        failedFiles.push({ file: relPath, qId: q.id, reason: 'no_fullPassage', sentences: origSentCount });
        detailLog.push(`[NO_FP] ${relPath} Q${q.id} (${origSentCount}문장) type="${q.type}"`);
        continue;
      }

      const { expanded, method } = expandPassage(q.passage, fullPassage, 6);
      const newSentCount = countSentences(expanded);

      if (method === 'already_ok' || newSentCount < 6) {
        if (newSentCount < 6) {
          failedFiles.push({ file: relPath, qId: q.id, reason: `expand_failed(${newSentCount}문장)`, sentences: origSentCount });
          detailLog.push(`[FAIL] ${relPath} Q${q.id} ${origSentCount}->${newSentCount}문장 method=${method}`);
        }
        continue;
      }

      // 수정 적용
      q.passage = expanded;
      fileModified = true;
      fileFixed++;
      fixed++;

      detailLog.push(`[FIX] ${relPath} Q${q.id} ${origSentCount}->${newSentCount}문장 method=${method}`);
    }

    if (fileModified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      fixedFiles.push({ file: filePath.replace(baseDir + '/', ''), violations: fileViolations, fixed: fileFixed });
    }
  }

  // ─── 리포트 출력 ──────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log('           V72 위반 수정 리포트');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`검사 파일 수  : ${files.length}개`);
  console.log(`V72 위반 합계 : ${totalViolations}건`);
  console.log(`수정 완료     : ${fixed}건`);
  console.log(`수정 실패     : ${failedFiles.length}건`);
  console.log(`fullPassage 없음: ${noFullPassage}건`);
  console.log('');

  if (fixedFiles.length > 0) {
    console.log(`── 수정된 파일 (${fixedFiles.length}개) ──────────────────────`);
    for (const f of fixedFiles) {
      console.log(`  [수정] ${f.file}  (${f.fixed}건)`);
    }
    console.log('');
  }

  if (failedFiles.length > 0) {
    console.log(`── 수정 실패 (${failedFiles.length}건) ──────────────────────`);
    for (const f of failedFiles) {
      console.log(`  [FAIL] ${f.file} Q${f.qId} — ${f.reason} (원래 ${f.sentences}문장)`);
    }
    console.log('');
  }

  console.log('── 상세 로그 ─────────────────────────────────────────');
  for (const line of detailLog) {
    console.log(' ', line);
  }

  console.log('');
  console.log(`완료: ${fixed}건 수정, ${failedFiles.length}건 실패`);
}

main();
