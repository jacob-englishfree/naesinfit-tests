#!/usr/bin/env node
/**
 * auto-ans.js — AI 3중 풀이 → ans 자동 생성
 *
 * 구조:
 * 1. JSON 읽기 (ans 필드 무시)
 * 2. 각 MC 문항을 3번 독립 풀이 (temperature 높여서 다양성 확보)
 * 3. 다수결로 ans 결정
 * 4. 3개 다 다르면 → 해당 문항 폐기 마킹 (autoAns: "AMBIGUOUS")
 * 5. det.analysis에 ✅/❌ 마커 자동 생성
 * 6. 결과 JSON 저장
 *
 * Usage: node validate/auto-ans.js data/path/to/file.json
 *        node validate/auto-ans.js --all [--dry-run]
 *
 * 환경변수: ANTHROPIC_API_KEY (필수)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

const MARKERS_4 = ['①', '②', '③', '④'];
const MARKERS_AB = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ'];

async function solveQuestion(q, attemptNum) {
  const passage = q.passage || '(없음)';
  const stem = q.stem || '';
  const ch = q.ch || [];
  const type = q.type || '';
  const fmt = q.fmt || 'mc';

  if (fmt !== 'mc') return null;

  const choicesText = ch.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const isGrammarType = ['어법', '문맥상 부적절한 어휘', '부적절어휘', '부적절',
    '문맥상 부적절 어휘', '부적절한 어휘'].some(t => type.includes(t));

  const prompt = `You are an expert English teacher solving a Korean high school English test question.

TYPE: ${type}
${isGrammarType ? 'NOTE: This is a grammar/vocabulary error question. You must find the ONE choice that is WRONG (grammatically incorrect or contextually inappropriate). The other choices are correct.' : 'NOTE: Choose the ONE correct answer.'}

PASSAGE:
${passage}

QUESTION:
${stem}

CHOICES:
${choicesText}

${ch.length === 2 ? 'This is a T/F question. Answer 1 for T or 2 for F.' : ''}

Think step by step, then respond with ONLY the answer number (1, 2, 3, or 4). Nothing else.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        temperature: attemptNum === 0 ? 0 : 0.5,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const json = await resp.json();
    const text = (json.content && json.content[0] && json.content[0].text) || '';
    const match = text.match(/\b([1-4])\b/);
    return match ? parseInt(match[1]) : null;
  } catch (e) {
    console.error(`  API error (attempt ${attemptNum}):`, e.message);
    return null;
  }
}

function generateDetMarkers(q, correctAns, isGrammarType) {
  const ch = q.ch || [];
  const markers = ch.length <= 4 ? MARKERS_4 : MARKERS_4;

  // Determine which marker set to use
  const useCircled = ch.some(c => /^[①②③④]$/.test(c)) || ch.some(c => /^[ⓐⓑⓒⓓ]$/.test(c));
  const mSet = ch.some(c => /^[ⓐⓑⓒⓓ]$/.test(c)) ? MARKERS_AB : MARKERS_4;

  const lines = [];
  for (let i = 0; i < ch.length && i < 4; i++) {
    const marker = mSet[i] || `${i + 1}`;
    const choiceText = ch[i];
    if (isGrammarType) {
      // 어법/부적절: 정답=틀린 것, 나머지=정상
      if (i + 1 === correctAns) {
        lines.push(`❌ ${marker} ${choiceText}: 오류`);
      } else {
        lines.push(`✅ ${marker} ${choiceText}: 정상`);
      }
    } else {
      // 일반: 정답=맞는 것, 나머지=오답
      if (i + 1 === correctAns) {
        lines.push(`✅ ${marker} ${choiceText}: 정답`);
      } else {
        lines.push(`❌ ${marker} ${choiceText}: 오답`);
      }
    }
  }
  return lines.join('\n');
}

async function processFile(jsonPath, dryRun) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.error(`  PARSE ERROR: ${e.message}`);
    return { fixed: 0, ambiguous: 0 };
  }

  const questions = data.questions || [];
  let fixed = 0;
  let ambiguous = 0;

  for (const q of questions) {
    if (q.fmt !== 'mc' || q.ans === undefined) continue;

    const qid = q.id || '?';
    const type = q.type || '';
    const isGrammarType = ['어법', '문맥상 부적절한 어휘', '부적절어휘', '부적절',
      '문맥상 부적절 어휘', '부적절한 어휘'].some(t => type.includes(t));

    // AI 3중 풀이
    const answers = [];
    for (let i = 0; i < 3; i++) {
      const ans = await solveQuestion(q, i);
      if (ans !== null) answers.push(ans);
    }

    if (answers.length < 2) {
      console.error(`  Q${qid}: API 응답 부족 (${answers.length}/3)`);
      continue;
    }

    // 다수결
    const counts = {};
    for (const a of answers) counts[a] = (counts[a] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [bestAns, bestCount] = sorted[0];
    const majority = parseInt(bestAns);

    if (bestCount >= 2) {
      // 2/3 이상 일치 → 확정
      if (q.ans !== majority) {
        console.log(`  Q${qid}: ans ${q.ans} → ${majority} (AI ${answers.join(',')})`);
        if (!dryRun) {
          q.ans = majority;
          // det 마커 보강
          if (q.det && q.det.analysis) {
            const hasMarkers = MARKERS_4.some(m => q.det.analysis.includes(`✅ ${m}`) || q.det.analysis.includes(`❌ ${m}`));
            if (!hasMarkers) {
              q.det.analysis = generateDetMarkers(q, majority, isGrammarType) + '\n\n' + q.det.analysis;
            }
          }
        }
        fixed++;
      } else {
        // ans 이미 맞음 — 마커만 보강
        if (!dryRun && q.det && q.det.analysis) {
          const hasMarkers = MARKERS_4.some(m => q.det.analysis.includes(`✅ ${m}`) || q.det.analysis.includes(`❌ ${m}`));
          if (!hasMarkers) {
            q.det.analysis = generateDetMarkers(q, majority, isGrammarType) + '\n\n' + q.det.analysis;
            fixed++; // 마커 추가도 수정으로 카운트
          }
        }
      }
    } else {
      // 3개 다 다름 → AMBIGUOUS
      console.log(`  Q${qid}: ⚠️ AMBIGUOUS (AI answers: ${answers.join(',')}) — 재출제 필요`);
      if (!dryRun) {
        q._autoAns = 'AMBIGUOUS';
        q._aiAnswers = answers;
      }
      ambiguous++;
    }
  }

  if (!dryRun && (fixed > 0 || ambiguous > 0)) {
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  }

  return { fixed, ambiguous };
}

// ── CLI ──
(async () => {
  const args = process.argv.slice(2);
  if (args.length === 0 || !API_KEY) {
    if (!API_KEY) console.error('ANTHROPIC_API_KEY 환경변수 필요');
    console.log('Usage: ANTHROPIC_API_KEY=sk-... node validate/auto-ans.js <file.json|--all> [--dry-run]');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const files = [];

  if (args[0] === '--all') {
    const { execSync } = require('child_process');
    const out = execSync(`find ${path.join(ROOT, 'data')} -name "*.json" -type f`, { encoding: 'utf8' });
    files.push(...out.trim().split('\n').filter(Boolean));
  } else {
    files.push(path.resolve(args[0]));
  }

  let totalFixed = 0;
  let totalAmbiguous = 0;

  for (const f of files) {
    const rel = path.relative(ROOT, f);
    console.log(`\n=== ${rel} ===`);
    const { fixed, ambiguous } = await processFile(f, dryRun);
    totalFixed += fixed;
    totalAmbiguous += ambiguous;
  }

  console.log(`\n=== 완료 ===`);
  console.log(`수정: ${totalFixed}, 모호(재출제 필요): ${totalAmbiguous}`);
  if (dryRun) console.log('(dry-run: 파일 미수정)');
})();
