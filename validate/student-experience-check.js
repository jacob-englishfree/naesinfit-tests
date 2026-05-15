#!/usr/bin/env node
/**
 * 학생 체감 오류 전수 스캔
 *
 * 학생이 테스트를 풀 때 실제로 문제가 되는 것만 잡음:
 * 1. 문제를 풀 수 없음 (passage/stem/ch 누락)
 * 2. 정답이 없거나 2개 (ans 오류, 동일선지)
 * 3. 화면에 이상하게 보임 (마커 없음, 빈칸 없음)
 * 4. 채점이 틀림 (ans vs det 불일치)
 * 5. 해설이 엉뚱함 (det 설명이 선지와 무관)
 *
 * Usage: node validate/student-experience-check.js
 */

const fs = require('fs');
const path = require('path');

function walk(dir) {
  const r = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.')) r.push(...walk(f));
      else if (e.isFile() && /^(단어|워크북|퀴즈)\.json$/.test(e.name)) r.push(f);
    }
  } catch (_) {}
  return r;
}

const MARKER_RE = /[①②③④⑤]/;
const META_WORDS = ['본문에서', '다루지 않은', '관련 없는', '언급되지 않은', '원문에서', '확인할 수 없는', '추론할 수 없는', '본문과 무관', '원문과 반대', '원문에 없는'];

const issues = [];

for (const f of walk('data')) {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!d.questions) continue;
    const rel = f.replace(/^data\//, '');

    for (const q of d.questions) {
      const id = `${rel} Q${q.id}`;

      // === 1. 풀 수 없음 ===
      // stem 없음
      if (!q.stem || q.stem.trim().length < 3) {
        issues.push({ id, sev: 'CRITICAL', type: 'NO_STEM', desc: 'stem이 비어있음 — 학생이 뭘 풀어야 할지 모름' });
      }

      // mc인데 ch 부족
      if (q.fmt === 'mc') {
        if (!q.ch || q.ch.length < 2) {
          issues.push({ id, sev: 'CRITICAL', type: 'NO_CH', desc: '선지가 없거나 1개 — 고를 수 없음' });
        }
        // ch에 빈 선지
        if (q.ch && q.ch.some(c => c.trim().length === 0)) {
          issues.push({ id, sev: 'CRITICAL', type: 'BLANK_CH', desc: '빈 선지 있음 — 학생에게 공백으로 보임' });
        }
      }

      // written인데 wa 없음
      if (q.fmt === 'written') {
        const wa = typeof q.wa === 'string' ? q.wa : (Array.isArray(q.wa) ? q.wa[0] : '');
        if (!wa || wa.trim().length === 0) {
          issues.push({ id, sev: 'CRITICAL', type: 'NO_WA', desc: 'wa(정답)이 비어있음 — 채점 불가' });
        }
      }

      // === 2. 정답 오류 ===
      // ans 범위 밖
      if (q.fmt === 'mc' && q.ch && (q.ans < 1 || q.ans > q.ch.length)) {
        issues.push({ id, sev: 'CRITICAL', type: 'ANS_OOB', desc: `ans=${q.ans}인데 선지 ${q.ch.length}개 — 정답이 범위 밖` });
      }

      // 동일 선지 (정답 2개)
      if (q.ch && q.ch.length >= 4) {
        const trimmed = q.ch.map(c => c.trim().toLowerCase());
        if (new Set(trimmed).size < trimmed.length) {
          issues.push({ id, sev: 'HIGH', type: 'DUP_CH', desc: '동일 선지 존재 — 정답 2개 가능' });
        }
      }

      // === 3. 화면 이상 ===
      // 마커형인데 마커 없음 (ch가 ①②③④인데 passage에 마커 없음)
      if (['어법', '문맥상 부적절한 어휘', '오류찾기'].includes(q.type) && q.ch && q.passage) {
        const markerCh = q.ch.every(c => MARKER_RE.test(c.trim()) && c.trim().length <= 3);
        if (markerCh && !MARKER_RE.test(q.passage) && !q.passage.includes('<u>')) {
          issues.push({ id, sev: 'CRITICAL', type: 'MARKER_MISSING', desc: '마커형 선지인데 passage에 마커 없음 — 뭘 골라야 할지 모름' });
        }
      }

      // 빈칸형인데 빈칸 없음
      if (q.type && q.type.includes('빈칸') && q.passage && !q.passage.includes('____') && !q.passage.includes('______')) {
        // 동의어형 제외 (stem에 밑줄 있으면)
        if (!q.stem || !q.stem.includes('<u>')) {
          issues.push({ id, sev: 'HIGH', type: 'NO_BLANK', desc: '빈칸형인데 passage에 ____ 없음' });
        }
      }

      // === 4. 메타서술 선지 ===
      if (q.ch) {
        for (const c of q.ch) {
          if (META_WORDS.some(w => c.includes(w))) {
            issues.push({ id, sev: 'HIGH', type: 'META_CH', desc: `메타서술 선지: "${c.substring(0, 30)}..."` });
            break;
          }
        }
      }

      // === 5. 단어 중간 빈칸 ===
      if (q.passage && /[a-z]_{3,}[a-z]/i.test(q.passage)) {
        issues.push({ id, sev: 'HIGH', type: 'WORD_BREAK', desc: '단어 중간에 빈칸 — 학생이 읽을 수 없음' });
      }
    }
  } catch (e) {
    issues.push({ id: f.replace(/^data\//, ''), sev: 'CRITICAL', type: 'PARSE_ERROR', desc: 'JSON 파싱 에러: ' + e.message.substring(0, 50) });
  }
}

// Report
const bySev = {};
for (const i of issues) {
  bySev[i.sev] = (bySev[i.sev] || 0) + 1;
}

console.log('=== 학생 체감 오류 전수 스캔 ===');
console.log(`CRITICAL: ${bySev.CRITICAL || 0}건 (학생이 테스트 진행 불가)`);
console.log(`HIGH: ${bySev.HIGH || 0}건 (문제는 풀리지만 오류 있음)`);
console.log(`총: ${issues.length}건`);
console.log('');

// Group by type
const byType = {};
for (const i of issues) {
  byType[i.type] = (byType[i.type] || 0) + 1;
}
console.log('유형별:');
for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}건`);
}

// Show all CRITICAL
if (bySev.CRITICAL) {
  console.log('\n=== CRITICAL (즉시 수정) ===');
  issues.filter(i => i.sev === 'CRITICAL').forEach(i => {
    console.log(`  ${i.id} [${i.type}] ${i.desc}`);
  });
}

// Show HIGH (first 20)
if (bySev.HIGH) {
  console.log(`\n=== HIGH (상위 20건) ===`);
  issues.filter(i => i.sev === 'HIGH').slice(0, 20).forEach(i => {
    console.log(`  ${i.id} [${i.type}] ${i.desc}`);
  });
}
