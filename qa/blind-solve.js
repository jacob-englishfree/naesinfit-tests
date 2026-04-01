#!/usr/bin/env node
/**
 * blind-solve.js — 블라인드 풀이 프롬프트 생성 + 결과 파서
 *
 * 모드:
 *   --prompt  : Claude Code에서 직접 풀 수 있도록 프롬프트 출력
 *   --parse "1,3,2,..."  : 풀이 결과를 실제 정답과 대조
 *   --auto    : validate/auto-ans.js 로직으로 자동 풀이 (API 필요)
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/path-mapper');

function loadQuestions(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  return { data, questions: data.questions || [] };
}

function generatePrompt(jsonPath) {
  const { data, questions } = loadQuestions(jsonPath);
  const relPath = path.relative(ROOT, jsonPath);

  let prompt = `=== 블라인드 풀이 ===\n파일: ${relPath}\n\n`;
  prompt += `아래 ${questions.length}문항을 풀어주세요. 정답(ans/wa)은 제거되어 있습니다.\n`;
  prompt += `각 문항의 풀이 근거와 답을 적어주세요.\n\n`;

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    prompt += `Q${qid} (${q.type}, ${q.diff}/${q.pts}점)\n`;
    if (q.passage) prompt += `  passage: ${q.passage.substring(0, 200)}${q.passage.length > 200 ? '...' : ''}\n`;
    prompt += `  stem: ${q.stem}\n`;

    if (q.fmt === 'mc' && Array.isArray(q.ch)) {
      q.ch.forEach((c, ci) => prompt += `  ${ci + 1}) ${c}\n`);
    } else if (q.fmt === 'written') {
      prompt += `  [서술형]\n`;
    }
    prompt += '\n';
  });

  prompt += `\n풀이 완료 후 아래 형식으로 답변:\n`;
  prompt += `ANSWERS: 답1,답2,답3,...  (객관식=번호, 서술형=영어텍스트)\n`;

  return prompt;
}

function parseResults(jsonPath, answerStr) {
  const { questions } = loadQuestions(jsonPath);
  const answers = answerStr.split(',').map(a => a.trim());

  const results = [];
  let match = 0, mismatch = 0;

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    const myAnswer = answers[i] || '?';
    let correctAnswer, isMatch;

    if (q.fmt === 'mc') {
      correctAnswer = String(q.ans);
      isMatch = myAnswer === correctAnswer;
    } else {
      correctAnswer = q.wa || '';
      isMatch = myAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    }

    if (isMatch) match++;
    else mismatch++;

    results.push({ qId: qid, myAnswer, correctAnswer, match: isMatch });
  });

  return {
    file: jsonPath,
    mode: 'parse',
    results,
    totalMatch: match,
    totalMismatch: mismatch,
    mismatches: results.filter(r => !r.match).map(r => r.qId),
    pass: mismatch === 0,
    summary: `${match}/${questions.length} 일치, ${mismatch}건 불일치`,
  };
}

module.exports = { generatePrompt, parseResults };

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('-'));
  const mode = args.includes('--prompt') ? 'prompt' : args.includes('--parse') ? 'parse' : 'prompt';

  if (!file) {
    console.error('Usage:');
    console.error('  node qa/blind-solve.js <json> --prompt');
    console.error('  node qa/blind-solve.js <json> --parse "1,3,2,4,..."');
    process.exit(1);
  }

  if (mode === 'prompt') {
    console.log(generatePrompt(path.resolve(file)));
  } else {
    const parseIdx = args.indexOf('--parse');
    const answerStr = args[parseIdx + 1] || '';
    const result = parseResults(path.resolve(file), answerStr);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.pass ? 0 : 1);
  }
}
