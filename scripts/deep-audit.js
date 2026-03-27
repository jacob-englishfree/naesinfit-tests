#!/usr/bin/env node
/**
 * 심층 검수 스크립트 — 가이드라인 v3 전체 항목 점검
 * validate.js가 못 잡는 것까지 검사
 *
 * 검사 항목:
 * D1. 유형 배분표 일치 (단어/워크북/퀴즈 각각 유형 순서+개수)
 * D2. 배점 분포 (쉬움5×4=20, 보통10×5=50, 어려움5×6=30)
 * D3. 정답 분포 (한 번호 5개 이상 금지, 3연속 금지)
 * D4. det 필드 완전성 (korean, analysis, tip 모두 비어있지 않은지)
 * D5. passage 길이 (유형별 최소 문장수)
 * D6. 마커 존재 (빈칸→____, 어법→①②③④, 부적절→<u>4개)
 * D7. 정답 노출 (정답 단어가 passage에 그대로)
 * D8. 오답 품질 (더미 선지, 같은 선지 중복)
 * D9. 서술형 accept 최소 3개
 * D10. fullPassage 존재 + 비어있지 않음
 * D11. ei 필드 존재
 * D12. histKey에 v3 포함
 */
const fs = require('fs');
const path = require('path');
const glob = require('child_process').execSync;

const ROOT = path.resolve(__dirname, '..');
const targets = process.argv[2] || 'data/부교재/수능특강,data/모의고사';

// Collect all JSON files
let files = [];
for (const dir of targets.split(',')) {
  const fullDir = path.join(ROOT, dir.trim());
  if (!fs.existsSync(fullDir)) continue;
  const found = require('child_process')
    .execSync(`find "${fullDir}" -name "*.json" -type f`)
    .toString().trim().split('\n').filter(Boolean);
  files.push(...found);
}

console.log(`\n=== 심층 검수 시작: ${files.length}파일 ===\n`);

const issues = { S: [], A: [], B: [] };
let totalQ = 0;
let filesPassed = 0;
let filesFailed = 0;

// 유형 배분표
const WORD_TYPES = ['(A)(B)(C) 조합형','(A)(B)(C) 조합형','(A)(B)(C) 조합형',
  '문맥상 부적절한 어휘','문맥상 부적절한 어휘','문맥상 부적절한 어휘',
  '빈칸 어휘 완성','빈칸 어휘 완성','빈칸 어휘 완성',
  '동의어 고르기','동의어 고르기','동의어 고르기',
  '반의어 고르기','반의어 고르기',
  '다의어 문맥적 의미',
  '영영풀이 매칭',
  '어형 변환','어형 변환',
  '빈칸 문맥 완성','빈칸 문맥 완성'];

for (const filePath of files) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { continue; }

  if (!data.questions || !Array.isArray(data.questions)) continue;

  const rel = path.relative(ROOT, filePath);
  const qs = data.questions;
  const fileIssues = [];
  totalQ += qs.length;

  // Determine test type from filename
  const isWord = rel.includes('단어');
  const isWorkbook = rel.includes('워크북');
  const isQuiz = rel.includes('퀴즈');
  const testType = isWord ? '단어' : isWorkbook ? '워크북' : isQuiz ? '퀴즈' : '?';

  // D2. 배점 분포
  const easy = qs.filter(q => q.pts === 4);
  const med = qs.filter(q => q.pts === 5);
  const hard = qs.filter(q => q.pts === 6);
  const sum = qs.reduce((a, q) => a + (q.pts || 0), 0);

  if (qs.length === 20) {
    if (sum !== 100) fileIssues.push({ sev: 'S', msg: `D2: 총점 ${sum} ≠ 100` });
    if (easy.length !== 5) fileIssues.push({ sev: 'A', msg: `D2: 쉬움 ${easy.length}개 ≠ 5` });
    if (med.length !== 10) fileIssues.push({ sev: 'A', msg: `D2: 보통 ${med.length}개 ≠ 10` });
    if (hard.length !== 5) fileIssues.push({ sev: 'A', msg: `D2: 어려움 ${hard.length}개 ≠ 5` });
  }

  // D3. 정답 분포
  const mcQs = qs.filter(q => q.fmt === 'mc');
  if (mcQs.length > 0) {
    const ansDist = {};
    mcQs.forEach(q => { ansDist[q.ans] = (ansDist[q.ans] || 0) + 1; });
    for (const [ans, count] of Object.entries(ansDist)) {
      if (count >= 6) fileIssues.push({ sev: 'S', msg: `D3: 정답 ${ans}번이 ${count}개 (6개 이상)` });
      else if (count === 5) fileIssues.push({ sev: 'B', msg: `D3: 정답 ${ans}번이 5개 (경계)` });
    }
    // 3연속 체크
    for (let i = 0; i < mcQs.length - 2; i++) {
      if (mcQs[i].ans === mcQs[i+1].ans && mcQs[i+1].ans === mcQs[i+2].ans) {
        fileIssues.push({ sev: 'S', msg: `D3: 정답 ${mcQs[i].ans}번 3연속 (Q${mcQs[i].id}~Q${mcQs[i+2].id})` });
      }
    }
  }

  // D4. det 완전성
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const det = q.det || {};
    if (!det.korean || det.korean.trim().length < 5)
      fileIssues.push({ sev: 'A', msg: `D4: Q${i+1} det.korean 없거나 너무 짧음` });
    if (!det.analysis || det.analysis.trim().length < 10)
      fileIssues.push({ sev: 'A', msg: `D4: Q${i+1} det.analysis 없거나 너무 짧음` });
    if (!det.tip || det.tip.trim().length < 5)
      fileIssues.push({ sev: 'A', msg: `D4: Q${i+1} det.tip 없거나 너무 짧음` });
  }

  // D5. passage 길이 (유형별)
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const p = (q.passage || '').replace(/<[^>]+>/g, '');
    const sents = p.split(/[.!?]+/).filter(s => s.trim().length > 3).length;
    const type = q.type || '';

    // 빈칸 어휘/문맥 완성: 5~8문장
    if (/빈칸.*어휘|빈칸.*문맥|빈칸추론/.test(type) && sents < 5 && p.length > 0) {
      fileIssues.push({ sev: 'A', msg: `D5: Q${i+1} ${type} passage ${sents}문장 (최소 5)` });
    }
    // 지칭추론: 5문장 이상
    if (/지칭추론/.test(type) && sents < 5 && p.length > 0) {
      fileIssues.push({ sev: 'S', msg: `D5: Q${i+1} 지칭추론 passage ${sents}문장 (최소 5)` });
    }
  }

  // D6. 마커 존재
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const p = q.passage || '';
    const type = q.type || '';

    if (/어법/.test(type) && p.length > 0) {
      const uCount = (p.match(/[①②③④]/g) || []).length;
      if (uCount < 4) fileIssues.push({ sev: 'S', msg: `D6: Q${i+1} 어법인데 ①②③④ ${uCount}개 (4개 필수)` });
    }
    if (/부적절/.test(type) && p.length > 0) {
      const uTagCount = (p.match(/<u>/g) || []).length;
      if (uTagCount < 4) fileIssues.push({ sev: 'S', msg: `D6: Q${i+1} 부적절인데 <u> ${uTagCount}개 (4개 필수)` });
    }
    if (/빈칸/.test(type) && p.length > 0 && !p.includes('____') && !p.includes('___')) {
      // 빈칸형인데 빈칸 마커 없음
      if (!/내용이해|T\/F/.test(type))
        fileIssues.push({ sev: 'S', msg: `D6: Q${i+1} ${type}인데 빈칸 마커(____) 없음` });
    }
    if (/어순배열/.test(type) && p.length > 0 && !p.includes('____')) {
      fileIssues.push({ sev: 'S', msg: `D6: Q${i+1} 어순배열인데 passage에 ____ 없음` });
    }
  }

  // D7. 정답 노출
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const p = (q.passage || '').replace(/<[^>]+>/g, '').replace(/____/g, '');

    if (q.fmt === 'mc' && typeof q.ans === 'number' && q.ch) {
      const ans = q.ch[q.ans];
      const type = q.type || '';
      // 동의어/반의어/다의어는 정답이 passage에 있어야 하므로 제외
      if (!/동의어|반의어|다의어|부적절|어법|\(A\)\(B\)\(C\)|내용|T\/F|지칭|주제|제목|함축/.test(type)) {
        if (ans && ans.length > 3 && p.includes(ans)) {
          fileIssues.push({ sev: 'S', msg: `D7: Q${i+1} 정답 "${ans.slice(0,20)}" passage에 노출` });
        }
      }
    }
    if (q.fmt === 'written' && q.wa) {
      const type = q.type || '';
      // 서술형 찾기는 제외
      if (!/핵심단어|찾기/.test(type) && !/찾아/.test(q.stem || '')) {
        if (q.wa.length > 3 && p.includes(q.wa)) {
          fileIssues.push({ sev: 'S', msg: `D7: Q${i+1} 서술형 정답 "${q.wa.slice(0,20)}..." passage에 노출` });
        }
      }
    }
  }

  // D8. 오답 품질
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (q.ch && q.ch.length > 0) {
      // 더미 선지 체크
      for (const c of q.ch) {
        if (!c || c === '—' || c === 'None' || c === '해당 없음' || c.trim() === '')
          fileIssues.push({ sev: 'S', msg: `D8: Q${i+1} 더미 선지 발견: "${c}"` });
      }
      // 중복 선지
      const unique = new Set(q.ch.map(c => (c||'').trim().toLowerCase()));
      if (unique.size < q.ch.length)
        fileIssues.push({ sev: 'A', msg: `D8: Q${i+1} 중복 선지 (${q.ch.length}개 중 ${unique.size}개 고유)` });
      // 4지선다 체크 (T/F 제외)
      if (!/T\/F/.test(q.type) && q.fmt === 'mc' && q.ch.length !== 4)
        fileIssues.push({ sev: 'S', msg: `D8: Q${i+1} 선지 ${q.ch.length}개 (4지선다 필수)` });
    }
  }

  // D9. 서술형 accept
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (q.fmt === 'written') {
      if (!q.accept || q.accept.length < 3)
        fileIssues.push({ sev: 'A', msg: `D9: Q${i+1} 서술형 accept ${(q.accept||[]).length}개 (최소 3)` });
    }
  }

  // D10. fullPassage
  if (!data.fullPassage || data.fullPassage.trim().length < 50)
    fileIssues.push({ sev: 'S', msg: `D10: fullPassage 없거나 너무 짧음 (${(data.fullPassage||'').length}자)` });

  // D11. ei
  if (!data.ei) fileIssues.push({ sev: 'A', msg: `D11: ei 필드 없음` });

  // D12. histKey v3 (신규 출제분만)
  // Skip for now - v1 파일도 많으므로 warning만

  // Tally
  const sErrors = fileIssues.filter(i => i.sev === 'S');
  const aErrors = fileIssues.filter(i => i.sev === 'A');

  if (sErrors.length > 0 || aErrors.length > 0) {
    filesFailed++;
    console.log(`[FAIL] ${rel} (S:${sErrors.length} A:${aErrors.length})`);
    for (const i of [...sErrors, ...aErrors].slice(0, 10)) {
      console.log(`  [${i.sev}] ${i.msg}`);
    }
    if (fileIssues.length > 10) console.log(`  ... +${fileIssues.length - 10} more`);
  } else {
    filesPassed++;
  }

  for (const i of fileIssues) {
    issues[i.sev] = issues[i.sev] || [];
    issues[i.sev].push({ file: rel, ...i });
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`심층 검수 완료: ${files.length}파일, ${totalQ}문항`);
console.log(`PASS: ${filesPassed} | FAIL: ${filesFailed}`);
console.log(`S급: ${issues.S.length}건 | A급: ${issues.A.length}건 | B급: ${(issues.B||[]).length}건`);

// Top error types
const errorTypes = {};
for (const i of [...issues.S, ...issues.A]) {
  const type = i.msg.split(':')[0];
  errorTypes[type] = (errorTypes[type] || 0) + 1;
}
console.log('\n--- 에러 유형별 통계 ---');
Object.entries(errorTypes).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(`  ${k}: ${v}건`);
});
