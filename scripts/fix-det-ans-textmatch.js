#!/usr/bin/env node
/**
 * det↔ans 텍스트 매칭 자동수정 (B방식)
 *
 * 안전 원칙:
 *  - det.analysis ①②③④ 인덱스 번호 절대 신뢰 금지
 *  - "✅" 다음에 오는 실제 텍스트를 추출 → ch 배열에서 텍스트 매칭으로 진짜 인덱스 찾음
 *  - 매칭이 모호/없음 → 재출제 큐로 분리, 자동수정 안 함
 *  - 14,256건 사고(feedback_det_not_ch_index.md) 재발 방지
 *
 * 실행: node scripts/fix-det-ans-textmatch.js [--apply]
 *  --apply 없으면 dry-run (변경 없이 통계만)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const APPLY = process.argv.includes('--apply');

const stats = {
  filesScanned: 0,
  filesChanged: 0,
  questionsScanned: 0,
  fixedAuto: 0,
  requeueDetBroken: 0,
  requeueAmbiguous: 0,
  requeueNoMarker: 0,
  alreadyCorrect: 0,
  skippedNoDet: 0,
};

const requeueList = [];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    if (entry === '_passages' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (entry === '단어.json' || entry === '워크북.json' || entry === '퀴즈.json') {
      files.push(full);
    }
  }
  return files;
}

// 텍스트 정규화 (공백/마커/구두점 제거 후 비교)
function normalize(s) {
  if (!s) return '';
  return String(s)
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')
    .replace(/[✅✓❌✗☑☒]/g, '')
    .replace(/^[\s]*[1-9][\.\)]\s*/, '')
    .replace(/[\s\-—–·,.()<>"'`]/g, '')
    .toLowerCase()
    .trim();
}

// det.analysis 첫 ✅ 라인의 텍스트 추출 (마커 제외)
function extractCheckedText(analysis) {
  if (!analysis || typeof analysis !== 'string') return null;
  const lines = analysis.split('\n');
  const checkedLines = [];
  for (const line of lines) {
    // ✅ 다음의 텍스트 — ①②③④ 인덱스 마커 제거 후
    const m = line.match(/^[\s]*[✅✓☑]\s*(.*)$/);
    if (m) {
      let text = m[1].trim();
      // 선두 ①②③④ 또는 1)/2) 등 제거
      text = text.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '');
      text = text.replace(/^[1-9][\.\)]\s*/, '');
      if (text.length > 0) checkedLines.push(text);
    }
  }
  return checkedLines;
}

// ch 배열에서 텍스트가 들어있는 인덱스 찾기 (1-indexed 반환)
function findChIndexByText(ch, targetText) {
  if (!Array.isArray(ch)) return [];
  const target = normalize(targetText);
  if (target.length < 3) return []; // 너무 짧으면 거짓양성 위험
  const matches = [];
  for (let i = 0; i < ch.length; i++) {
    const chText = normalize(ch[i]);
    if (!chText) continue;
    // 양방향 substring 매칭
    if (chText.includes(target) || target.includes(chText)) {
      matches.push(i + 1); // 1-indexed
    }
  }
  return matches;
}

function processQuestion(q, qIdx, filePath) {
  stats.questionsScanned++;
  if (!q.det || !q.det.analysis) {
    stats.skippedNoDet++;
    return null;
  }
  if (typeof q.ans !== 'number') {
    stats.skippedNoDet++;
    return null;
  }
  if (!Array.isArray(q.ch) || q.ch.length === 0) {
    stats.skippedNoDet++;
    return null;
  }

  const checkedTexts = extractCheckedText(q.det.analysis);
  if (!checkedTexts || checkedTexts.length === 0) {
    stats.requeueNoMarker++;
    requeueList.push({ file: filePath, q: qIdx + 1, reason: 'no-checked-marker', ans: q.ans });
    return null;
  }

  // ⛔ ✅마커가 정확히 1개일 때만 처리
  // 여러 개면 "일치하지 않는 것 찾기" 등 정답=❌ 유형 → 위험, skip
  if (checkedTexts.length !== 1) {
    stats.requeueNoMarker++;
    requeueList.push({ file: filePath, q: qIdx + 1, reason: 'multi-checked-marker', ans: q.ans, count: checkedTexts.length });
    return null;
  }

  const targetText = checkedTexts[0];
  const matches = findChIndexByText(q.ch, targetText);

  if (matches.length === 0) {
    // det이 가리키는 텍스트가 ch에 없음 → det 손상
    stats.requeueDetBroken++;
    requeueList.push({
      file: filePath, q: qIdx + 1,
      reason: 'det-text-not-in-ch',
      ans: q.ans,
      checked: targetText.slice(0, 60),
    });
    return null;
  }

  if (matches.length > 1) {
    // 여러 ch에 매칭 → 모호
    stats.requeueAmbiguous++;
    requeueList.push({
      file: filePath, q: qIdx + 1,
      reason: 'multiple-ch-match',
      ans: q.ans,
      matches,
    });
    return null;
  }

  const trueAns = matches[0];

  if (trueAns === q.ans) {
    stats.alreadyCorrect++;
    return null;
  }

  // 자동수정 가능
  return { oldAns: q.ans, newAns: trueAns, checked: targetText.slice(0, 60) };
}

const files = walk(ROOT);
console.log(`스캔 대상: ${files.length}개 파일`);

const fixLog = [];

for (const file of files) {
  stats.filesScanned++;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`JSON 파싱 실패: ${file}`);
    continue;
  }
  if (!Array.isArray(data.questions)) continue;

  let changed = false;
  for (let i = 0; i < data.questions.length; i++) {
    const result = processQuestion(data.questions[i], i, file);
    if (result) {
      stats.fixedAuto++;
      fixLog.push({ file: path.relative(ROOT, file), q: i + 1, ...result });
      if (APPLY) {
        data.questions[i].ans = result.newAns;
        changed = true;
      }
    }
  }

  if (changed && APPLY) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    stats.filesChanged++;
  }
}

// 리포트 저장
const reportDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

fs.writeFileSync(
  path.join(reportDir, 'fix-det-ans-textmatch.json'),
  JSON.stringify({ stats, fixLog: fixLog.slice(0, 500), requeueList: requeueList.slice(0, 500) }, null, 2)
);
fs.writeFileSync(
  path.join(reportDir, 'fix-det-ans-textmatch-requeue-full.json'),
  JSON.stringify(requeueList, null, 2)
);

console.log('\n=== 결과 ===');
console.log(JSON.stringify(stats, null, 2));
console.log(`\n${APPLY ? '✅ 적용됨' : '🔍 DRY-RUN (--apply 없음)'}`);
console.log(`자동수정 가능: ${stats.fixedAuto}건`);
console.log(`재출제 큐(det손상): ${stats.requeueDetBroken}건`);
console.log(`재출제 큐(모호): ${stats.requeueAmbiguous}건`);
console.log(`재출제 큐(마커없음): ${stats.requeueNoMarker}건`);
console.log(`이미 정답: ${stats.alreadyCorrect}건`);
console.log(`\n리포트: reports/fix-det-ans-textmatch.json`);
