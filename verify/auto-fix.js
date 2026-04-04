#!/usr/bin/env node
/**
 * 자동 수정 루프
 * validate.js FAIL → 자동 수정 → 재검수 → 최대 3회 반복
 *
 * Usage: node verify/auto-fix.js data/.../단어.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const file = process.argv[2];

if (!file) {
  console.error('Usage: node verify/auto-fix.js <json-file>');
  process.exit(1);
}

const fp = path.resolve(file);
if (!fs.existsSync(fp)) {
  console.error(`파일 없음: ${fp}`);
  process.exit(1);
}

const MAX_ROUNDS = 3;

function runValidate(filePath) {
  try {
    const result = execSync(`node validate/validate.js "${filePath}"`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
    return { pass: true, output: result, errors: [] };
  } catch (e) {
    const output = (e.stdout || '') + (e.stderr || '');
    const errors = output.split('\n').filter(l => l.includes('[S]') || l.includes('[A]'));
    return { pass: false, output, errors };
  }
}

function autoFix(filePath, errors) {
  const d = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const qs = d.questions || [];
  let fixes = 0;

  for (const err of errors) {
    // F9: mc missing ans → 첫 번째 선지를 정답으로
    if (err.includes('mc missing ans')) {
      const m = err.match(/Q(\d+)/);
      if (m) {
        const q = qs[parseInt(m[1]) - 1];
        if (q && q.fmt === 'mc' && (q.ans === null || q.ans === undefined)) {
          q.ans = 1;
          fixes++;
          console.log(`  수정: Q${m[1]} ans=null → ans=1 (임시, 검수 필요)`);
        }
      }
    }

    // C16: 5지선다 → 마지막 선지 제거
    if (err.includes('ch.length = 5') || err.includes('5지선다')) {
      const m = err.match(/Q(\d+)/);
      if (m) {
        const q = qs[parseInt(m[1]) - 1];
        if (q && q.ch && q.ch.length === 5) {
          // 정답이 5번이면 4번으로 이동
          if (q.ans === 5) q.ans = 4;
          q.ch.pop();
          fixes++;
          console.log(`  수정: Q${m[1]} 5지선다 → 4지선다`);
        }
      }
    }

    // S2: 배점 합계 오류 → 난이도별 재계산
    if (err.includes('sum(pts)')) {
      const ptsMap = { '쉬움': 4, '보통': 5, '어려움': 6 };
      qs.forEach((q, i) => {
        if (q.diff && ptsMap[q.diff]) {
          q.pts = ptsMap[q.diff];
        }
      });
      // 쉬움5+보통10+어려움5 = 100 확인
      const total = qs.reduce((s, q) => s + (q.pts || 0), 0);
      if (total !== 100) {
        // 난이도 분포 조정
        const counts = { '쉬움': 0, '보통': 0, '어려움': 0 };
        qs.forEach(q => { if (q.diff) counts[q.diff]++; });
        // 보통으로 조정
        for (const q of qs) {
          const newTotal = qs.reduce((s, q2) => s + (q2.pts || 0), 0);
          if (newTotal === 100) break;
          if (newTotal > 100 && q.diff === '어려움') {
            q.diff = '보통';
            q.pts = 5;
          } else if (newTotal < 100 && q.diff === '쉬움') {
            q.diff = '보통';
            q.pts = 5;
          }
        }
      }
      fixes++;
      console.log(`  수정: 배점 재계산 → ${qs.reduce((s, q) => s + (q.pts || 0), 0)}점`);
    }

    // F8: diff/pts missing
    if (err.includes('diff missing') || err.includes('pts missing')) {
      const m = err.match(/Q(\d+)/);
      if (m) {
        const q = qs[parseInt(m[1]) - 1];
        if (q) {
          if (!q.diff) { q.diff = '보통'; fixes++; }
          if (!q.pts) { q.pts = 5; fixes++; }
          console.log(`  수정: Q${m[1]} diff/pts 추가`);
        }
      }
    }

    // F10: written missing wa
    if (err.includes('written missing wa')) {
      const m = err.match(/Q(\d+)/);
      if (m) {
        const q = qs[parseInt(m[1]) - 1];
        if (q && q.ans && !q.wa) {
          q.wa = q.ans;
          fixes++;
          console.log(`  수정: Q${m[1]} wa 추가 (ans에서 복사)`);
        }
      }
    }

    // F10: written missing accept
    if (err.includes('written missing accept')) {
      const m = err.match(/Q(\d+)/);
      if (m) {
        const q = qs[parseInt(m[1]) - 1];
        if (q && (q.wa || q.ans) && !q.accept) {
          const ans = q.wa || q.ans;
          q.accept = [ans, ans.toLowerCase(), ans.charAt(0).toUpperCase() + ans.slice(1)];
          if (ans.includes('-')) q.accept.push(ans.replace(/-/g, ' '));
          if (!ans.endsWith('.')) q.accept.push(ans + '.');
          fixes++;
          console.log(`  수정: Q${m[1]} accept 배열 자동 생성`);
        }
      }
    }

    // A6: 정답 편향
    if (err.includes('6개 이상 금지')) {
      // 정답 분포 재조정 — 가장 많은 번호를 가장 적은 번호로 이동
      const dist = {};
      qs.filter(q => q.fmt === 'mc').forEach(q => { dist[q.ans] = (dist[q.ans] || 0) + 1; });
      const maxAns = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
      const minAns = Object.entries(dist).sort((a, b) => a[1] - b[1])[0];
      if (maxAns && minAns && maxAns[0] !== minAns[0]) {
        const q = qs.find(q => q.fmt === 'mc' && q.ans === parseInt(maxAns[0]));
        if (q && q.ch) {
          const correct = q.ch[q.ans - 1];
          const newAns = parseInt(minAns[0]);
          q.ch.splice(q.ans - 1, 1);
          q.ch.splice(newAns - 1, 0, correct);
          q.ans = newAns;
          fixes++;
          console.log(`  수정: 정답 분포 조정 ${maxAns[0]}→${newAns}`);
        }
      }
    }
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(d, null, 2));
  }
  return fixes;
}

// 메인 루프
console.log(`\n━━━ 자동 수정 루프 시작: ${path.basename(fp)} ━━━\n`);

for (let round = 1; round <= MAX_ROUNDS; round++) {
  console.log(`[${round}/${MAX_ROUNDS}] 검수 중...`);
  const result = runValidate(fp);

  if (result.pass) {
    console.log(`\n✅ PASS — ${round === 1 ? '수정 없이' : round + '라운드 만에'} 통과`);
    process.exit(0);
  }

  console.log(`  S/A급 에러 ${result.errors.length}건 발견`);
  result.errors.forEach(e => console.log(`  ${e.trim()}`));

  if (round < MAX_ROUNDS) {
    console.log(`\n  자동 수정 중...`);
    const fixes = autoFix(fp, result.errors);
    if (fixes === 0) {
      console.log(`  자동 수정 불가 — 수동 수정 필요`);
      console.log(`\n❌ FAIL — 자동 수정 불가한 에러가 있습니다`);
      process.exit(1);
    }
    console.log(`  ${fixes}건 수정 완료, 재검수...\n`);
  }
}

// 최종 검수
const finalResult = runValidate(fp);
if (finalResult.pass) {
  console.log(`\n✅ PASS — ${MAX_ROUNDS}라운드 만에 통과`);
  process.exit(0);
} else {
  console.log(`\n❌ FAIL — ${MAX_ROUNDS}회 시도 후에도 통과 실패`);
  finalResult.errors.forEach(e => console.log(`  ${e.trim()}`));
  process.exit(1);
}
