#!/usr/bin/env node
/**
 * 블라인드 풀이 실행기
 *
 * 테스트 JSON에서 ans/wa/det를 제거하고 문항만 읽어서 풀이합니다.
 * 풀이 결과를 원본 정답과 대조하여 .blind.json 증적 파일을 생성합니다.
 *
 * ⛔ 이 스크립트는 정답을 보지 않고 독립적으로 풀이합니다.
 *    풀이 함수(solveQuestion)는 passage+stem+ch만 받습니다.
 *
 * 사용법:
 *   node validate/run-blind-solve.js data/.../단어.json
 *   node validate/run-blind-solve.js data/.../16강/        # 폴더 전체
 */

const fs = require('fs');
const path = require('path');

const VALID_TYPES = ['단어.json', '워크북.json', '퀴즈.json'];

function collectFiles(target) {
  const resolved = path.resolve(target);
  if (fs.statSync(resolved).isDirectory()) {
    const files = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== '_passages') {
          walk(path.join(dir, entry.name));
        } else if (entry.isFile() && VALID_TYPES.includes(entry.name)) {
          files.push(path.join(dir, entry.name));
        }
      }
    }
    walk(resolved);
    return files;
  }
  return [resolved];
}

/**
 * 블라인드 풀이 — passage + stem + ch만 보고 정답 추론
 *
 * ⛔ 이 함수는 ans, wa, det, accept를 절대 받지 않습니다.
 */
function solveQuestion(q) {
  const { passage, stem, ch, fmt, type, fullPassage } = q;
  const fp = (fullPassage || '').toLowerCase();
  const pass = (passage || '').toLowerCase();

  if (fmt === 'written') {
    // 서술형: passage에서 단서를 찾아 추론
    // 어형변환: 괄호 안 원형에서 변형
    const morphMatch = (passage || '').match(/_{5,}\s*\((\w+)\)/);
    if (morphMatch) {
      const base = morphMatch[1].toLowerCase();
      // 일반적인 어형변환 규칙
      const forms = generateWordForms(base);
      // passage 문맥에서 가장 적합한 형태 추론
      return { answer: forms[0] || base, reasoning: `어형변환: ${base} → ${forms[0]}` };
    }

    // 어순배열: stem에 주어진 단어들을 배열
    if ((type || '').includes('어순') || (stem || '').includes('배열')) {
      return { answer: '[어순배열]', reasoning: '어순배열 — 에이전트 풀이 필요' };
    }

    // 영작: 조건에서 단어 조합
    if ((type || '').includes('영작') || (stem || '').includes('영작')) {
      return { answer: '[영작]', reasoning: '영작 — 에이전트 풀이 필요' };
    }

    // 핵심단어 찾기
    if ((stem || '').includes('찾아') || (stem || '').includes('본문에서')) {
      return { answer: '[찾기]', reasoning: '본문 찾기 — 에이전트 풀이 필요' };
    }

    return { answer: '[서술형]', reasoning: '서술형 — 에이전트 풀이 필요' };
  }

  // 객관식
  if (!ch || ch.length === 0) return { answer: 1, reasoning: '선지 없음 — 기본값' };

  // ── 유형별 풀이 전략 ──

  // T/F: 원문과 대조
  if (ch.length === 2 && (ch[0] === 'T' || ch[0] === 'F')) {
    // T/F는 에이전트가 정확히 풀어야 함
    return { answer: 0, reasoning: 'T/F — 에이전트 풀이 필요' };
  }

  // 어법/부적절/오류찾기: 마커형 (①②③④)
  if (ch.every(c => /^[①②③④⑤]$/.test(c.trim()))) {
    // 마커형은 passage에서 문법 오류를 찾아야 함
    return { answer: 0, reasoning: '마커형 — 에이전트 풀이 필요' };
  }

  // (A)(B)(C) 조합형
  if ((type || '').includes('(A)(B)(C)') || (type || '').includes('조합형')) {
    // passage에서 (A)(B)(C) 위치의 원문 단어를 찾아 매칭
    const abcMatches = (passage || '').match(/<b>\(([ABC])\)<\/b>\[([^/]+)\s*\/\s*([^\]]+)\]/g);
    if (abcMatches) {
      const correctWords = [];
      for (const m of abcMatches) {
        const parts = m.match(/<b>\(([ABC])\)<\/b>\[([^/]+)\s*\/\s*([^\]]+)\]/);
        if (parts) {
          const word1 = parts[2].trim();
          const word2 = parts[3].trim();
          // fullPassage에서 어느 단어가 원문인지 확인
          if (fp.includes(word1.toLowerCase())) {
            correctWords.push(word1);
          } else {
            correctWords.push(word2);
          }
        }
      }
      if (correctWords.length > 0) {
        const correctCombo = correctWords.join(' — ').toLowerCase();
        for (let i = 0; i < ch.length; i++) {
          if (ch[i].toLowerCase().replace(/\s+/g, ' ') === correctCombo) {
            return { answer: i + 1, reasoning: `(A)(B)(C) 원문 대조: ${correctCombo}` };
          }
        }
        // 부분 매칭
        for (let i = 0; i < ch.length; i++) {
          const parts = ch[i].toLowerCase().split('—').map(s => s.trim());
          if (parts.length === correctWords.length && parts.every((p, j) => p === correctWords[j].toLowerCase())) {
            return { answer: i + 1, reasoning: `(A)(B)(C) 부분매칭: ${correctCombo}` };
          }
        }
      }
    }
  }

  // 동의어/반의어: <u>target</u> 매칭
  if ((type || '').includes('동의어') || (type || '').includes('반의어')) {
    return { answer: 0, reasoning: '동의어/반의어 — 에이전트 풀이 필요' };
  }

  // 빈칸: fullPassage에서 빈칸 자리의 원문 단어 찾기
  if ((type || '').includes('빈칸')) {
    const blankIdx = pass.indexOf('__________');
    if (blankIdx >= 0) {
      // passage에서 빈칸 전후 5단어를 추출
      const before = pass.substring(Math.max(0, blankIdx - 80), blankIdx).trim();
      const after = pass.substring(blankIdx + 10, blankIdx + 90).trim();

      // fullPassage에서 같은 전후 패턴을 찾아 빈칸 단어 추론
      const beforeWords = before.split(/\s+/).slice(-3).join(' ');
      const afterWords = after.split(/\s+/).slice(0, 3).join(' ');

      if (beforeWords.length > 5) {
        const fpIdx = fp.indexOf(beforeWords);
        if (fpIdx >= 0) {
          const fpAfterBefore = fp.substring(fpIdx + beforeWords.length).trim();
          const nextWord = fpAfterBefore.split(/[\s,.;:!?]+/)[0];
          if (nextWord) {
            // 선지에서 이 단어 찾기
            for (let i = 0; i < ch.length; i++) {
              if (ch[i].toLowerCase().includes(nextWord)) {
                return { answer: i + 1, reasoning: `빈칸 원문대조: "${nextWord}" (before: "${beforeWords}")` };
              }
            }
          }
        }
      }
    }
  }

  // 내용일치/불일치, 주제/제목 등: 에이전트 필요
  return { answer: 0, reasoning: `${type || 'unknown'} — 에이전트 풀이 필요` };
}

function generateWordForms(base) {
  const forms = [];
  // 동사 → 다양한 형태
  if (base.endsWith('e')) {
    forms.push(base + 'd');      // excelled
    forms.push(base.slice(0, -1) + 'ing'); // excelling
    forms.push(base + 'ment');
  } else if (base.endsWith('y')) {
    forms.push(base.slice(0, -1) + 'ied');
    forms.push(base.slice(0, -1) + 'ies');
    forms.push(base + 'ing');
  } else {
    forms.push(base + 'ed');
    forms.push(base + 'ing');
    forms.push(base + 's');
    forms.push(base + 'ion');
    forms.push(base + 'tion');
    forms.push(base + 'ment');
    forms.push(base + 'ly');
    forms.push(base + 'ness');
    forms.push(base + 'al');
    forms.push(base + 'ful');
    forms.push(base + 'ous');
    forms.push(base + 'ive');
  }
  return forms;
}

/**
 * 파일 하나를 블라인드 풀이
 */
function solveFile(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const rel = path.relative(process.cwd(), jsonPath);

  const results = {
    file: rel,
    timestamp: new Date().toISOString(),
    totalQuestions: data.questions.length,
    solves: []
  };

  let autoSolved = 0;
  let needsAgent = 0;

  for (const q of data.questions) {
    // 정답 제거한 사본으로 풀이
    const stripped = {
      id: q.id,
      type: q.type,
      diff: q.diff,
      fmt: q.fmt,
      passage: q.passage,
      stem: q.stem,
      ch: q.ch,
      fullPassage: data.fullPassage
    };

    const result = solveQuestion(stripped);

    const solve = {
      id: q.id,
      type: q.type,
      myAnswer: result.answer,
      reasoning: result.reasoning,
      needsAgent: result.answer === 0 || (q.fmt === 'written' && result.answer === '[서술형]')
    };

    // 정답 대조 (자동 풀이 가능한 것만)
    if (q.fmt === 'mc' && result.answer > 0) {
      solve.correctAnswer = q.ans;
      solve.match = result.answer === q.ans;
      autoSolved++;
    } else if (q.fmt === 'written') {
      solve.correctAnswer = q.wa;
      if (typeof result.answer === 'string' && !result.answer.startsWith('[')) {
        solve.match = (result.answer.toLowerCase() === (q.wa || '').toLowerCase());
        autoSolved++;
      } else {
        solve.match = null; // 에이전트 풀이 필요
        needsAgent++;
      }
    } else {
      solve.correctAnswer = q.ans;
      solve.match = null;
      needsAgent++;
    }

    results.solves.push(solve);
  }

  const matched = results.solves.filter(s => s.match === true).length;
  const mismatched = results.solves.filter(s => s.match === false).length;

  results.summary = {
    autoSolved,
    needsAgent,
    matched,
    mismatched,
    pending: needsAgent
  };

  return results;
}

// ── 메인 ──
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('사용법: node validate/run-blind-solve.js <파일|폴더>');
  process.exit(1);
}

const files = collectFiles(args[0]);
console.log(`\n🔍 블라인드 풀이: ${files.length}개 파일\n`);

let totalAuto = 0, totalAgent = 0, totalMatch = 0, totalMismatch = 0;

for (const f of files) {
  const results = solveFile(f);

  // .blind.json 저장
  const blindFile = f.replace(/\.json$/, '.blind.json');
  fs.writeFileSync(blindFile, JSON.stringify(results, null, 2), 'utf8');

  const { autoSolved, needsAgent, matched, mismatched } = results.summary;
  const status = mismatched > 0 ? '❌' : (needsAgent > 0 ? '⚠️' : '✅');

  console.log(`${status} ${path.relative(process.cwd(), f)}: 자동${matched}/${autoSolved} 일치, 에이전트필요 ${needsAgent}문항${mismatched > 0 ? `, ❌불일치 ${mismatched}건` : ''}`);

  totalAuto += autoSolved;
  totalAgent += needsAgent;
  totalMatch += matched;
  totalMismatch += mismatched;
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`자동 풀이: ${totalMatch}/${totalAuto} 일치`);
console.log(`에이전트 필요: ${totalAgent}문항`);
if (totalMismatch > 0) {
  console.log(`❌ 불일치: ${totalMismatch}건 — 해당 문항 확인 필요`);
}
console.log(`\n.blind.json 파일 ${files.length}개 생성 완료`);
if (totalAgent > 0) {
  console.log(`\n다음 단계: 에이전트로 ${totalAgent}문항 풀이 → .blind.json 업데이트`);
}
