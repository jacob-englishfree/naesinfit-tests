#!/usr/bin/env node
/**
 * 블라인드 풀이 — API 미사용, 규칙 기반 정답 검증
 *
 * 검증 방법:
 * 1. det.analysis ↔ ans 교차검증 (✅/❌ 마커)
 * 2. det.korean 에서 정답 키워드 추출 ↔ ans 대조
 * 3. (A)(B)(C) 조합형: passage [A/B] 마커 ↔ 선지 대조
 * 4. 서술형: wa ↔ passage 빈칸/문맥 정합성
 * 5. 동의어/반의어: stem 단어 ↔ 정답 관계
 * 6. 어형변환: wa ↔ stem 괄호 안 단어 변환
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ── 결과 수집 ──
const issues = [];
let totalQ = 0;
let checkedQ = 0;
let suspiciousQ = 0;

// ── 검증 함수들 ──

/**
 * 1. det.analysis ✅/❌ 마커로 정답 검증 (MC)
 * analysis에 "✅ ①" 또는 "✅ 1번" 패턴이 있으면 ans와 대조
 */
function checkDetAnalysisMarker(q, fp) {
  if (q.fmt !== 'mc' || !q.det || !q.det.analysis) return null;

  const analysis = q.det.analysis;
  const circled = ['①', '②', '③', '④', '⑤'];

  // ✅ 마커 찾기
  let correctFromDet = null;

  for (let i = 0; i < circled.length; i++) {
    // ✅ ① 또는 ✅① 패턴
    if (analysis.includes(`✅ ${circled[i]}`) || analysis.includes(`✅${circled[i]}`)) {
      correctFromDet = i + 1;
      break;
    }
  }

  // "정답: N" 패턴
  if (!correctFromDet) {
    const m = analysis.match(/정답[:\s]*(\d)/);
    if (m) correctFromDet = parseInt(m[1]);
  }

  if (correctFromDet && correctFromDet !== q.ans) {
    return {
      type: 'DET_MARKER_MISMATCH',
      msg: `det.analysis ✅마커=${correctFromDet}, ans=${q.ans}`,
      severity: 'HIGH'
    };
  }

  // ❌ 마커로 역검증: 현재 ans에 ❌가 있으면 문제
  if (q.ans >= 1 && q.ans <= circled.length) {
    const ansCircle = circled[q.ans - 1];
    if (analysis.includes(`❌ ${ansCircle}`) || analysis.includes(`❌${ansCircle}`)) {
      // But make sure it's not just mentioning it
      const line = analysis.split('\n').find(l =>
        (l.includes(`❌ ${ansCircle}`) || l.includes(`❌${ansCircle}`)) &&
        l.trim().startsWith('❌')
      );
      if (line) {
        return {
          type: 'DET_WRONG_MARKER',
          msg: `ans=${q.ans}(${ansCircle})에 ❌마커 — det가 오답 처리`,
          severity: 'HIGH'
        };
      }
    }
  }

  return null;
}

/**
 * 2. (A)(B)(C) 조합형 검증
 * passage의 [word1 / word2] 패턴에서 정답 추출 → 선지 대조
 */
function checkABCCombo(q, fp) {
  if (!q.type || !q.type.includes('(A)(B)(C)')) return null;
  if (q.fmt !== 'mc' || !q.passage || !Array.isArray(q.ch)) return null;

  const passage = q.passage;

  // Extract [word1 / word2] patterns
  const bracketPattern = /\[([^\]]+?)\s*\/\s*([^\]]+?)\]/g;
  const pairs = [];
  let match;
  while ((match = bracketPattern.exec(passage)) !== null) {
    pairs.push([match[1].trim(), match[2].trim()]);
  }

  if (pairs.length < 2) return null;

  // The correct answer should match the first word in each bracket (usually)
  // But we verify against det.korean
  const det = q.det;
  if (!det || !det.korean) return null;

  const korean = det.korean;

  // Extract correct words from det.korean (usually in <b> tags)
  const boldPattern = /<b>([^<]+)<\/b>/g;
  const correctWords = [];
  while ((match = boldPattern.exec(korean)) !== null) {
    correctWords.push(match[1].trim().toLowerCase());
  }

  if (correctWords.length === 0) return null;

  // Check if ans choice contains these words
  const ansChoice = q.ch[q.ans - 1];
  if (!ansChoice) return null;

  const ansWords = ansChoice.toLowerCase().split(/\s*[—–-]\s*/);

  // Check overlap
  let matchCount = 0;
  for (const cw of correctWords) {
    const cwClean = cw.replace(/[()]/g, '').trim();
    if (ansWords.some(aw => aw.includes(cwClean) || cwClean.includes(aw))) {
      matchCount++;
    }
  }

  if (matchCount === 0 && correctWords.length >= 2) {
    return {
      type: 'ABC_DET_MISMATCH',
      msg: `det 키워드 [${correctWords.join(', ')}] ↔ ans선지 "${ansChoice}" 불일치`,
      severity: 'MEDIUM'
    };
  }

  return null;
}

/**
 * 3. 어형변환 서술형 검증
 * stem에 괄호 안 단어 → wa가 변환형인지
 */
function checkWordTransform(q, fp) {
  if (q.fmt !== 'written') return null;
  const typeNorm = (q.type || '').trim();
  if (!typeNorm.includes('어형') && !typeNorm.includes('변환') && !typeNorm.includes('변형')) return null;
  if (!q.wa || !q.stem) return null;

  // stem에서 괄호 안 원형 추출
  const stemMatch = q.stem.match(/\(([a-zA-Z]+)\)/);
  const passageMatch = q.passage ? q.passage.match(/\(([a-zA-Z]+)\)/) : null;
  const baseWord = stemMatch ? stemMatch[1] : (passageMatch ? passageMatch[1] : null);

  if (!baseWord) return null;

  const wa = q.wa.trim().toLowerCase();
  const base = baseWord.toLowerCase();

  // Check if wa is a transformation of base
  // Common transformations: -ing, -ed, -tion, -ment, -ly, -ness, -ful, -less, -er, -est, -al, -ous, -ive, -ty, -ity
  if (wa === base) {
    return {
      type: 'TRANSFORM_SAME',
      msg: `wa="${q.wa}" = 원형 "${baseWord}" — 변환이 안 됨`,
      severity: 'HIGH'
    };
  }

  // Check if they share a root (first 3 chars at least)
  const minLen = Math.min(wa.length, base.length);
  let commonPrefix = 0;
  for (let i = 0; i < minLen; i++) {
    if (wa[i] === base[i]) commonPrefix++;
    else break;
  }

  if (commonPrefix < 2 && base.length > 3) {
    // Very different — might be wrong
    // But some transforms are valid: go → went, good → better
    // Check det for confirmation
    if (q.det && q.det.korean) {
      const korean = q.det.korean.toLowerCase();
      if (!korean.includes(wa) && !korean.includes(q.wa.toLowerCase())) {
        return {
          type: 'TRANSFORM_SUSPICIOUS',
          msg: `wa="${q.wa}" ← "${baseWord}" — 공통접두사 ${commonPrefix}자, det에도 없음`,
          severity: 'MEDIUM'
        };
      }
    }
  }

  return null;
}

/**
 * 4. 빈칸추론/빈칸어휘 — 정답이 passage에 이미 노출되었는지
 */
function checkBlankExposure(q, fp) {
  if (q.fmt !== 'mc') return null;
  const typeNorm = (q.type || '').trim();
  if (!typeNorm.includes('빈칸')) return null;
  if (!q.passage || !Array.isArray(q.ch)) return null;

  const passage = q.passage.replace(/<[^>]+>/g, ' ').replace(/_{2,}/, '____');
  const ansChoice = (q.ch[q.ans - 1] || '').replace(/^[①②③④⑤]\s*/, '').trim();

  if (!ansChoice) return null;

  // 빈칸(____) 밖에서 정답이 그대로 노출되면 문제
  const parts = passage.split(/_{2,}/);
  if (parts.length < 2) return null;

  const outsideBlank = parts.join(' ');
  if (outsideBlank.toLowerCase().includes(ansChoice.toLowerCase()) && ansChoice.length > 3) {
    return {
      type: 'BLANK_ANSWER_EXPOSED',
      msg: `빈칸 정답 "${ansChoice}" 이 passage에 노출`,
      severity: 'LOW'
    };
  }

  return null;
}

/**
 * 5. 내용일치/불일치 — det와 ans 방향성 대조
 */
function checkContentMatch(q, fp) {
  if (q.fmt !== 'mc') return null;
  const typeNorm = (q.type || '').trim();
  if (!typeNorm.includes('내용일치') && !typeNorm.includes('내용불일치')) return null;
  if (!q.det || !q.det.analysis) return null;

  const isNonMatch = typeNorm.includes('불일치');
  const analysis = q.det.analysis;
  const ansCircle = ['①', '②', '③', '④', '⑤'][q.ans - 1];

  // For 불일치: the answer should be marked as wrong/different
  // For 일치: the answer should be marked as correct
  if (isNonMatch) {
    // 불일치: 정답은 틀린 내용이어야 함
    if (analysis.includes(`✅ ${ansCircle}`) || analysis.includes(`✅${ansCircle}`)) {
      // ✅ on the answer in 불일치 could mean "this is correct that it's different"
      // Need to check context
    }
  }

  return null; // Too ambiguous without deeper parsing
}

/**
 * 6. 서술형 wa ↔ accept 정합성
 */
function checkWaAccept(q, fp) {
  if (q.fmt !== 'written') return null;
  if (!q.wa || !Array.isArray(q.accept)) return null;

  const wa = q.wa.trim();

  // wa가 accept에 포함되어야 함
  if (!q.accept.some(a => a.trim() === wa)) {
    return {
      type: 'WA_NOT_IN_ACCEPT',
      msg: `wa="${wa}" 이 accept 배열에 없음`,
      severity: 'HIGH'
    };
  }

  return null;
}

/**
 * 7. MC ans 범위 검증
 */
function checkAnsRange(q, fp) {
  if (q.fmt !== 'mc') return null;
  if (q.ans === undefined || q.ans === null) return null;

  const maxAns = Array.isArray(q.ch) ? q.ch.length : 4;
  if (q.ans < 1 || q.ans > maxAns) {
    return {
      type: 'ANS_OUT_OF_RANGE',
      msg: `ans=${q.ans}, 선지 ${maxAns}개 — 범위 초과`,
      severity: 'CRITICAL'
    };
  }

  return null;
}

/**
 * 8. det.korean <b> 태그 정답 ↔ ans choice 대조
 */
function checkDetKoreanBold(q, fp) {
  if (q.fmt !== 'mc' || !q.det || !q.det.korean) return null;
  if (!Array.isArray(q.ch)) return null;

  const korean = q.det.korean;
  const boldMatch = korean.match(/<b>([^<]+)<\/b>/g);
  if (!boldMatch || boldMatch.length === 0) return null;

  const boldWords = boldMatch.map(b => b.replace(/<\/?b>/g, '').trim().toLowerCase());
  const ansChoice = (q.ch[q.ans - 1] || '').toLowerCase();

  // At least one bold word should appear in the answer choice
  const hasOverlap = boldWords.some(bw => {
    const clean = bw.replace(/[()]/g, '').trim();
    if (clean.length < 2) return true; // too short to check
    return ansChoice.includes(clean) || clean.includes(ansChoice.split(/\s/)[0]);
  });

  if (!hasOverlap && boldWords.length >= 1 && boldWords[0].length > 2) {
    // Check if any OTHER choice contains the bold words
    for (let i = 0; i < q.ch.length; i++) {
      if (i === q.ans - 1) continue;
      const otherChoice = q.ch[i].toLowerCase();
      const otherHas = boldWords.some(bw => {
        const clean = bw.replace(/[()]/g, '').trim();
        return clean.length > 2 && otherChoice.includes(clean);
      });
      if (otherHas) {
        return {
          type: 'DET_BOLD_WRONG_ANS',
          msg: `det.korean 정답키워드 [${boldWords.join(',')}] → ${i+1}번 선지에 매칭, ans=${q.ans}번`,
          severity: 'HIGH'
        };
      }
    }
  }

  return null;
}

/**
 * 9. 동의어/반의어 검증 — 같은 파일 내 동의어↔반의어 정답 중복
 */
function checkSynAntDuplicate(questions, fp) {
  const results = [];
  const synQs = questions.filter(q => (q.type || '').includes('동의어') && q.fmt === 'mc');
  const antQs = questions.filter(q => (q.type || '').includes('반의어') && q.fmt === 'mc');

  // 같은 단어에 대해 동의어 정답 = 반의어 정답이면 문제
  for (const sq of synQs) {
    for (const aq of antQs) {
      if (sq.stem === aq.stem && sq.ans === aq.ans) {
        results.push({
          qid: `Q${sq.id}&Q${aq.id}`,
          type: 'SYN_ANT_SAME_ANS',
          msg: `동의어 Q${sq.id} ans=${sq.ans} = 반의어 Q${aq.id} ans=${aq.ans} — 같은 stem에 같은 정답`,
          severity: 'HIGH'
        });
      }
    }
  }
  return results;
}

/**
 * 10. 서술형 영작 — wa가 한국어면 잘못됨
 */
function checkWrittenLanguage(q, fp) {
  if (q.fmt !== 'written' || !q.wa) return null;
  const typeNorm = (q.type || '').trim();

  // 영작인데 wa가 한국어
  if (typeNorm.includes('영작') || typeNorm.includes('한영')) {
    const hasKorean = /[가-힣]/.test(q.wa);
    if (hasKorean) {
      return {
        type: 'WRITTEN_WRONG_LANG',
        msg: `영작 문항인데 wa="${q.wa.substring(0,30)}" 에 한국어 포함`,
        severity: 'HIGH'
      };
    }
  }

  return null;
}

/**
 * 11. MC 선지 중복 검증
 */
function checkDuplicateChoices(q, fp) {
  if (q.fmt !== 'mc' || !Array.isArray(q.ch)) return null;

  const normalized = q.ch.map(c => c.replace(/^[①②③④⑤]\s*/, '').trim().toLowerCase());
  const seen = new Set();
  for (let i = 0; i < normalized.length; i++) {
    if (seen.has(normalized[i]) && normalized[i].length > 0) {
      return {
        type: 'DUPLICATE_CHOICE',
        msg: `선지 중복: "${q.ch[i]}"`,
        severity: 'HIGH'
      };
    }
    seen.add(normalized[i]);
  }
  return null;
}

/**
 * 12. T/F — det에서 정답 방향 확인
 */
function checkTF(q, fp) {
  if (q.fmt !== 'mc') return null;
  const typeNorm = (q.type || '').trim();
  if (!typeNorm.includes('T/F') && !typeNorm.includes('내용이해 T/F')) return null;
  if (!q.det || !q.det.analysis) return null;

  const analysis = q.det.analysis;
  const ansChoice = (q.ch && q.ch[q.ans - 1]) || '';

  // T/F: ans가 T인데 det에 "틀렸다/거짓" 있으면 문제
  const isTrue = ansChoice.toUpperCase().includes('T') || ansChoice.includes('맞') || ansChoice.includes('참');
  const isFalse = ansChoice.toUpperCase().includes('F') || ansChoice.includes('틀') || ansChoice.includes('거짓');

  if (isTrue && (analysis.includes('틀린') || analysis.includes('거짓') || analysis.includes('일치하지 않'))) {
    // Could be referring to other choices
  }

  return null; // T/F is complex, skip for now
}

// ── Main ──
const files = execSync(`find "${ROOT}/data/모의고사" -name "*.json" -type f`)
  .toString().trim().split('\n').filter(Boolean).sort();

console.log(`모의고사 JSON 파일: ${files.length}개\n`);
console.log('블라인드 풀이 시작...\n');

const issuesByType = {};
const issuesBySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
const issueFiles = new Set();

for (const fp of files) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) { continue; }

  if (!data.questions || !Array.isArray(data.questions)) continue;

  const relPath = path.relative(ROOT, fp);

  for (const q of data.questions) {
    totalQ++;
    const qid = q.id || '?';

    const checks = [
      checkDetAnalysisMarker(q, fp),
      checkABCCombo(q, fp),
      checkWordTransform(q, fp),
      checkBlankExposure(q, fp),
      checkWaAccept(q, fp),
      checkAnsRange(q, fp),
      checkDetKoreanBold(q, fp),
      checkWrittenLanguage(q, fp),
      checkDuplicateChoices(q, fp),
    ];

    checkedQ++;

    for (const result of checks) {
      if (!result) continue;
      suspiciousQ++;
      issueFiles.add(relPath);

      const issue = { file: relPath, qid, ...result };
      issues.push(issue);
      issuesByType[result.type] = (issuesByType[result.type] || 0) + 1;
      issuesBySeverity[result.severity] = (issuesBySeverity[result.severity] || 0) + 1;
    }
  }

  // Cross-question checks
  const crossResults = checkSynAntDuplicate(data.questions, fp);
  for (const result of crossResults) {
    const relP = path.relative(ROOT, fp);
    issues.push({ file: relP, ...result });
    issuesByType[result.type] = (issuesByType[result.type] || 0) + 1;
    issuesBySeverity[result.severity] = (issuesBySeverity[result.severity] || 0) + 1;
    issueFiles.add(relP);
  }
}

// ── Report ──
console.log('='.repeat(60));
console.log('블라인드 풀이 결과');
console.log('='.repeat(60));
console.log(`총 문항: ${totalQ}`);
console.log(`검증 문항: ${checkedQ}`);
console.log(`의심 문항: ${suspiciousQ}`);
console.log(`문제 파일: ${issueFiles.size}개 / ${files.length}개`);
console.log();

console.log('── 심각도별 ──');
for (const [sev, count] of Object.entries(issuesBySeverity).sort((a,b) => b[1] - a[1])) {
  if (count > 0) console.log(`  ${sev}: ${count}건`);
}
console.log();

console.log('── 유형별 ──');
for (const [type, count] of Object.entries(issuesByType).sort((a,b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}건`);
}
console.log();

// CRITICAL + HIGH 상세
const critHigh = issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH');
if (critHigh.length > 0) {
  console.log(`── CRITICAL + HIGH 상세 (${critHigh.length}건) ──`);
  for (const i of critHigh.slice(0, 100)) {
    console.log(`  ${i.file} Q${i.qid}: [${i.severity}] ${i.type} — ${i.msg}`);
  }
  if (critHigh.length > 100) {
    console.log(`  ... +${critHigh.length - 100}건 더`);
  }
}

// Save full report
const reportPath = path.join(ROOT, 'qa/blind-solve-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  summary: { totalQ, checkedQ, suspiciousQ, issueFiles: issueFiles.size, totalFiles: files.length },
  issuesByType,
  issuesBySeverity,
  issues: critHigh,
}, null, 2));
console.log(`\n리포트 저장: ${reportPath}`);
