#!/usr/bin/env node
/**
 * NaesinFit — Render Simulator (텍스트 기반 학생 화면 시뮬레이션)
 *
 * 학생이 실제 화면에서 보는 것을 텍스트로 재구성하고,
 * 정답/해설 정합성을 검사한다.
 *
 * X42 같은 "ans=1인데 학생화면 정답은 ③"을 잡는 것이 목적.
 *
 * Usage:
 *   node validate/render-sim.js <file.json>
 *   node validate/render-sim.js --all
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKERS = ['①', '②', '③', '④', '⑤'];

/**
 * 학생이 화면에서 볼 정답 텍스트를 재구성
 * - 마커형 ch (["①","②","③","④"]): passage의 ans-th <u>...</u>를 추출
 * - 일반 ch: ch[ans-1] 자체
 */
function renderStudentAnswer(q) {
  if (q.fmt !== 'mc' || !Array.isArray(q.ch) || q.ans < 1) return null;
  const ans = q.ch[q.ans - 1];
  if (typeof ans !== 'string') return null;

  const isMarker = q.ch.every(c => typeof c === 'string' && /^[①②③④⑤]\s*$/.test(c.trim()));
  if (isMarker) {
    // passage에서 ans 마커의 <u>word</u> 추출
    const passage = q.passage || '';
    const m = MARKERS[q.ans - 1];
    const re = new RegExp(m + '\\s*<u>([^<]+)</u>');
    const match = passage.match(re);
    return match ? { display: match[1].trim(), markerIdx: q.ans, isMarkerType: true } : null;
  } else {
    return { display: ans.trim(), markerIdx: q.ans, isMarkerType: false };
  }
}

/**
 * 해설(det)에서 "정답 단어"를 추출
 * - "X → Y" 패턴 → X가 정답 (잘못된 것을 고르는 문항)
 * - "X = Y" 패턴 → X가 정답 (동의어)
 * - 단순 단어 명시
 */
function extractDetAnswer(q) {
  const det = q.det || {};
  const detKor = (det.korean || '').replace(/<[^>]+>/g, '');
  const detTip = (det.tip || '').replace(/<[^>]+>/g, '');
  const detAna = (det.analysis || '').replace(/<[^>]+>/g, '');

  // 1. (X → Y) 또는 X → Y 패턴 — 괄호/공백/구두점 모두 허용
  // 가장 마지막 → 패턴을 우선 (보통 결론부)
  const arrows = [...detKor.matchAll(/([a-zA-Z][a-zA-Z\s'\-]{1,40}?)\s*→\s*([a-zA-Z][a-zA-Z\s'\-]{1,40})/g)];
  if (arrows.length > 0) {
    // 가장 마지막 매치 (보통 결론)
    const last = arrows[arrows.length - 1];
    return { word: last[1].trim(), correct: last[2].trim(), source: 'korean→' };
  }

  // 2. "①X → Y" 같은 마커+단어
  let m = detKor.match(/[①②③④⑤]\s*([a-zA-Z][a-zA-Z\s'\-]{1,40}?)(?:\s*[:→↔]|\s*$)/m);
  if (m) return { word: m[1].trim(), source: 'korean ①X' };

  // 3. det.tip의 "X → Y" 패턴
  const tipArrows = [...detTip.matchAll(/([a-zA-Z][a-zA-Z\s'\-]{1,40}?)\s*→\s*([a-zA-Z][a-zA-Z\s'\-]{1,40})/g)];
  if (tipArrows.length > 0) {
    const last = tipArrows[tipArrows.length - 1];
    return { word: last[1].trim(), correct: last[2].trim(), source: 'tip→' };
  }

  return null;
}

/**
 * MC 문항을 학생 화면처럼 렌더링하고 ans↔det 정합성 검사
 */
function simulateAndCheck(q, qid) {
  const errors = [];
  if (q.fmt !== 'mc') return errors;

  const studentAns = renderStudentAnswer(q);
  if (!studentAns) return errors;

  const detAns = extractDetAnswer(q);
  if (!detAns) return errors;

  // 학생이 보는 정답 단어와 해설의 정답 단어 비교
  const sw = studentAns.display.toLowerCase().trim();
  const dwLeft = detAns.word.toLowerCase().trim();
  const dwRight = (detAns.correct || '').toLowerCase().trim();

  function matches(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const af = a.split(/\s+/)[0];
    const bf = b.split(/\s+/)[0];
    if (af === bf) return true;
    if (a.includes(b) || b.includes(a)) return true;
    return false;
  }

  // 양방향 매칭: 학생화면 단어가 → 의 양쪽 중 하나라도 매칭되면 OK
  if (matches(sw, dwLeft)) return errors;
  if (matches(sw, dwRight)) return errors;

  // 마커형이면 X42와 동일 → 진짜 모순
  if (studentAns.isMarkerType) {
    // 추가 검증: passage의 다른 마커 위치에 dwLeft나 dwRight가 있는지
    // 있으면 false positive (해설은 다른 것에 대해 말하는 중)
    const passage = q.passage || '';
    for (let m = 0; m < 4; m++) {
      if (m === q.ans - 1) continue;
      const re = new RegExp(MARKERS[m] + '\\s*<u>([^<]+)</u>');
      const otherMatch = passage.match(re);
      if (otherMatch) {
        const ow = otherMatch[1].toLowerCase().trim();
        if (matches(ow, dwLeft) || matches(ow, dwRight)) {
          // 해설이 다른 마커 위치를 가리킴 — 진짜 X42
          errors.push({
            id: 'RENDER-ANS-DET',
            sev: 'S',
            msg: `Q${qid}: ans=${q.ans}(${sw})인데 해설은 ${MARKERS[m]}(${ow})를 가리킴 — ans 또는 passage 손상`,
          });
          return errors;
        }
      }
    }
    // 어디에도 매칭 안 되면 해설/passage 데이터 mismatch (덜 확실)
    // S급 보고는 안 함 (false positive 줄이기)
  }

  return errors;
}

/**
 * 추가 렌더 검사:
 * - passage에 마커가 있는데 모든 마커가 화면에 표시되는가
 * - ch가 마커형인데 passage에 매칭 마커가 없는가
 * - 빈칸이 있는데 정답 후보가 빈칸 자리와 매칭되는가
 */
function additionalRenderChecks(q, qid) {
  const errors = [];
  if (q.fmt !== 'mc') return errors;

  const passage = q.passage || '';
  const ch = Array.isArray(q.ch) ? q.ch : [];

  // ch는 마커인데 passage에 마커 없음
  const isMarker = ch.length === 4 && ch.every(c => typeof c === 'string' && /^[①②③④⑤]\s*$/.test(c.trim()));
  if (isMarker) {
    const missingMarkers = MARKERS.slice(0, 4).filter(m => !passage.includes(m));
    if (missingMarkers.length > 0) {
      errors.push({
        id: 'RENDER-MARKER-MISSING',
        sev: 'S',
        msg: `Q${qid}: ch는 마커형(①②③④)인데 passage에 ${missingMarkers.join(',')} 없음 — 학생이 무엇을 고를지 모름`,
      });
    }

    // 마커 ans 위치에 <u> 없음 → 학생 화면에 단어가 안 뜸
    if (q.ans >= 1 && q.ans <= 4) {
      const m = MARKERS[q.ans - 1];
      const re = new RegExp(m + '\\s*<u>([^<]+)</u>');
      if (!re.test(passage)) {
        errors.push({
          id: 'RENDER-ANS-NOT-UNDERLINED',
          sev: 'B',
          msg: `Q${qid}: ans=${q.ans}(${m})인데 passage의 ${m}에 <u>...</u> 없음`,
        });
      }
    }
  }

  // 빈칸형: 빈칸 개수 검사 (단순 카운트는 false positive 많음 — 제거)
  return errors;
}

function validateRender(q, qid) {
  return [...simulateAndCheck(q, qid), ...additionalRenderChecks(q, qid)];
}

module.exports = { validateRender, renderStudentAnswer, extractDetAnswer };

// CLI
if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node validate/render-sim.js <file.json>');
    console.log('       node validate/render-sim.js --all');
    process.exit(1);
  }

  let files = [];
  if (arg === '--all') {
    const { execSync } = require('child_process');
    files = execSync(`find ${ROOT}/data -name "*.json" ! -path "*_passages*"`, { encoding: 'utf8' }).trim().split('\n');
  } else {
    files = [arg];
  }

  let totalErrors = 0;
  const byCode = {};
  const examples = [];
  for (const fp of files) {
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const qs = data.questions || [];
      for (let i = 0; i < qs.length; i++) {
        const errs = validateRender(qs[i], i + 1);
        for (const e of errs) {
          totalErrors++;
          byCode[e.id] = (byCode[e.id] || 0) + 1;
          if (examples.length < 20) examples.push(`${fp.replace(ROOT + '/', '')} [${e.sev}] ${e.msg}`);
        }
      }
    } catch (e) {}
  }
  examples.forEach(e => console.log(e));
  console.log('\n=== Render 시뮬레이션 결과 ===');
  for (const [code, count] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${count}건`);
  }
  console.log(`총 ${totalErrors}건`);
}
