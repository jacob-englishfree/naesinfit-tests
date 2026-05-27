#!/usr/bin/env node
/**
 * render-check.js — 렌더링 정합성 검증
 *
 * validate.js가 JSON 구조를 체크한다면, 이 스크립트는
 * "학생이 보는 화면에서 깨지지 않는가"를 체크한다.
 *
 * 사용법:
 *   node scripts/render-check.js data/교과서/.../워크북.json
 *   node scripts/render-check.js --all
 */

const fs = require('fs');
const path = require('path');
// glob not needed — using find command for --all mode

const SEV = { S: 'S', A: 'A', B: 'B' };
const NMS = '①②③④⑤⑥⑦⑧⑨⑩';

function renderCheck(jsonPath) {
  const errors = [];
  let d;
  try {
    d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    return [{ sev: 'S', msg: `JSON 파싱 실패: ${e.message}` }];
  }

  const qs = d.questions || [];

  for (const q of qs) {
    const qid = q.id;
    const qtype = q.type || '';
    const passage = q.passage || '';
    const ch = q.ch || [];
    const wa = q.wa || '';
    const stem = q.stem || '';
    const fmt = q.fmt || '';

    // ── R1: 마커형 선지(①②③④)인데 <u> 추출 시 깨지는 경우 ──
    const allCircled = ch.every(c => /^[①②③④⑤]$/.test((c || '').trim()));
    if (allCircled && passage) {
      const ulMatches = [...passage.matchAll(/<u>([^<]+)<\/u>/g)];
      const isOryuChatgi = /오류찾기/.test(qtype);

      if (isOryuChatgi && ulMatches.length > 0) {
        errors.push({ sev: 'S', msg: `Q${qid}: 오류찾기+<u> — 렌더러가 선지를 깨뜨림` });
      }

      if (!isOryuChatgi && ulMatches.length > 0 && ulMatches.length < ch.length) {
        errors.push({ sev: 'A', msg: `Q${qid}: <u> ${ulMatches.length}개인데 마커 ${ch.length}개 — 일부 선지만 텍스트 교체됨` });
      }
    }

    // ── R2: 서술형 wa 축약형 + (N단어) 동시 사용 ──
    if (fmt === 'written' && wa) {
      const hasWordCount = /\d+\s*단어/.test(stem);
      const hasContraction = /\w+[''][a-zA-Z]+/.test(wa);
      const hasCommaList = /\w+,\s*\w+,\s*\w+/.test(wa); // 3개 이상 콤마 나열

      if (hasWordCount && hasContraction) {
        errors.push({ sev: 'S', msg: `Q${qid}: wa "${wa.match(/\w+[''][a-zA-Z]+/)[0]}" 축약형 + (N단어) — 학생 혼란` });
      }
      if (hasWordCount && hasCommaList) {
        errors.push({ sev: 'A', msg: `Q${qid}: wa에 콤마 나열 + (N단어) — 학생이 단어 경계 혼란 가능` });
      }
    }

    // ── R3: 조건영작 "모두 사용" + 더미 단어 ──
    if (fmt === 'written' && /조건영작|어순/.test(qtype) && wa && /모두\s*사용/.test(stem)) {
      const condBlock = stem.slice(stem.indexOf('[조건]') || 0);
      const condWords = (condBlock.match(/[a-zA-Z][a-zA-Z''-]+/g) || []).filter(w => w.length > 1);
      const waLower = wa.toLowerCase();
      const missing = condWords.filter(w => !waLower.includes(w.toLowerCase()));
      if (missing.length > 0) {
        errors.push({ sev: 'S', msg: `Q${qid}: [조건] "${missing.join(', ')}" wa에 없음 — 더미 단어` });
      }
    }

    // ── R4: stem "밑줄 친 X" ↔ passage <u> 불일치 ──
    if (stem && passage && /밑줄\s*친/.test(stem)) {
      const stemUlMatch = stem.match(/밑줄\s*친\s*(?:[""\u201C]([^""\u201D]+)[""\u201D]|"([^"]+)"|(\w[\w\s,.']+\w))/);
      if (stemUlMatch) {
        const stemRef = (stemUlMatch[1] || stemUlMatch[2] || stemUlMatch[3] || '').trim().toLowerCase();
        const ulTexts = [...passage.matchAll(/<u>([^<]+)<\/u>/g)].map(m => m[1].toLowerCase());
        const fullUl = ulTexts.join(' ');
        if (stemRef.length > 1 && fullUl.length > 0 && !fullUl.includes(stemRef)) {
          errors.push({ sev: 'S', msg: `Q${qid}: stem "밑줄 친 ${stemRef.slice(0,30)}..." ≠ passage <u>` });
        }
      }
    }

    // ── R5: type별 금지 태그 ──
    const tagRules = {
      '오류찾기': { forbidden: ['<u>'], reason: '렌더러가 선지 추출' },
      '내용 일치': { forbidden: ['<b>(A)'], reason: 'ABC 조합 전용' },
      '내용이해': { forbidden: ['<b>(A)'], reason: 'ABC 조합 전용' },
      '주제': { forbidden: ['<b>(A)'], reason: 'ABC 조합 전용' },
      '요지': { forbidden: ['<b>(A)'], reason: 'ABC 조합 전용' },
    };

    for (const [typeKey, rule] of Object.entries(tagRules)) {
      if (qtype.includes(typeKey) && passage) {
        for (const tag of rule.forbidden) {
          if (passage.includes(tag)) {
            errors.push({ sev: 'S', msg: `Q${qid}: ${qtype}에 ${tag} 금지 — ${rule.reason}` });
          }
        }
      }
    }

    // ── R6: 서술형 찾기 stem에 빈칸(___) 개수 ↔ wa 단어수 일치 ──
    if (fmt === 'written' && stem) {
      const blanksInStem = (stem.match(/_{3,}/g) || []).length;
      if (blanksInStem > 0 && wa) {
        const waWordCount = wa.trim().split(/\s+/).length;
        if (blanksInStem !== waWordCount) {
          errors.push({ sev: 'S', msg: `Q${qid}: stem 빈칸 ${blanksInStem}개 ≠ wa ${waWordCount}단어 — 학생이 답 길이 오인` });
        }
      }
    }
  }

  return errors;
}

// ── CLI ──
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('사용법: node scripts/render-check.js <file.json> [--all]');
  process.exit(0);
}

let files = [];
if (args.includes('--all')) {
  const dataDir = path.join(__dirname, '..', 'data');
  const findCmd = require('child_process').execSync(
    `find "${dataDir}" -name "단어.json" -o -name "워크북.json" -o -name "퀴즈.json"`,
    { encoding: 'utf8' }
  );
  files = findCmd.trim().split('\n').filter(Boolean);
} else {
  files = args.filter(a => a.endsWith('.json'));
}

let totalErrors = 0;
let totalFiles = 0;

for (const f of files) {
  const errors = renderCheck(f);
  const sErrors = errors.filter(e => e.sev === 'S');
  const aErrors = errors.filter(e => e.sev === 'A');

  if (errors.length > 0) {
    const short = f.replace(/.*\/data\//, 'data/');
    const status = sErrors.length > 0 ? '❌ FAIL' : '⚠️ WARN';
    console.log(`${status} ${short}`);
    for (const e of errors) {
      console.log(`  [${e.sev}] ${e.msg}`);
    }
    totalErrors += sErrors.length;
  }
  totalFiles++;
}

if (totalErrors === 0) {
  console.log(`✅ 렌더링 검증 PASS (${totalFiles}개 파일, 0 S급 오류)`);
} else {
  console.log(`\n❌ 렌더링 검증 FAIL: ${totalErrors}건 S급 오류`);
  process.exit(1);
}
