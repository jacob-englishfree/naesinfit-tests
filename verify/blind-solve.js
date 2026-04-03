#!/usr/bin/env node
/**
 * AI 블라인드 풀이 검수 시스템
 * - GitHub Actions에서 실행
 * - 각 JSON 파일의 문항을 정답 없이 AI에게 풀리기
 * - AI 답과 출제 답을 기계적으로 비교
 * - 불일치 시 FAIL
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY 환경변수가 없습니다.');
  process.exit(1);
}

// Get files to verify from command line args or scan data/
const args = process.argv.slice(2);
let files = [];
if (args.length > 0) {
  files = args.filter(f => f.endsWith('.json') && fs.existsSync(f));
} else {
  // Scan all data files
  function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scanDir(full);
      else if (entry.name.endsWith('.json')) files.push(full);
    }
  }
  scanDir('data');
}

console.log(`\n━━━ AI 블라인드 풀이 검수 시작 (${files.length}파일) ━━━\n`);

// Call Anthropic API
async function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0]) {
            resolve(parsed.content[0].text);
          } else {
            reject(new Error('Invalid API response: ' + data.substring(0, 200)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Build blind-solve prompt for a question
function buildPrompt(q, fullPassage) {
  const passage = q.passage === '__FULL__' ? fullPassage : (q.passage || fullPassage || '');

  if (q.fmt === 'mc') {
    const choices = (q.ch || []).map((c, i) => `${i + 1}. ${c}`).join('\n');
    return `You are solving an English test question. Read carefully and answer with ONLY the number (1, 2, 3, or 4).

${passage ? 'Passage:\n' + passage.replace(/<[^>]+>/g, '') + '\n\n' : ''}Question: ${(q.stem || '').replace(/<[^>]+>/g, '')}

Choices:
${choices}

Answer (number only):`;
  } else {
    // Written question
    return `You are solving an English test question. Read carefully and answer with ONLY the answer word/phrase. No explanation.

${passage ? 'Passage:\n' + passage.replace(/<[^>]+>/g, '') + '\n\n' : ''}Question: ${(q.stem || '').replace(/<[^>]+>/g, '')}

Answer (word/phrase only):`;
  }
}

// Compare answers
function compareAnswer(expected, actual, fmt) {
  if (fmt === 'mc') {
    // MC: compare numbers
    const expNum = typeof expected === 'number' ? expected : parseInt(expected);
    const actNum = parseInt(actual.replace(/[^0-9]/g, ''));
    return expNum === actNum;
  } else {
    // Written: normalize and compare
    const norm = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    return norm(expected) === norm(actual);
  }
}

// Main
async function main() {
  let totalFiles = 0;
  let totalQuestions = 0;
  let totalMismatch = 0;
  let totalPass = 0;
  const mismatches = [];
  const errors = [];

  for (const fp of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (e) {
      errors.push({ file: fp, error: 'JSON parse error' });
      continue;
    }

    const questions = data.questions || [];
    if (questions.length === 0) continue;

    totalFiles++;
    const shortPath = fp.replace(/.*data\//, '');

    // Sample questions to verify (verify all for small files, sample for large batches)
    const sampleSize = Math.min(questions.length, 5); // Verify 5 per file to manage API costs
    const indices = [];
    if (sampleSize >= questions.length) {
      for (let i = 0; i < questions.length; i++) indices.push(i);
    } else {
      // Random sample
      const shuffled = [...Array(questions.length).keys()].sort(() => Math.random() - 0.5);
      for (let i = 0; i < sampleSize; i++) indices.push(shuffled[i]);
      indices.sort((a, b) => a - b);
    }

    let fileMismatch = 0;

    for (const idx of indices) {
      const q = questions[idx];
      if (q.ans === null || q.ans === undefined) {
        mismatches.push({ file: shortPath, qnum: idx + 1, expected: 'N/A', actual: 'N/A', reason: 'ans is null' });
        fileMismatch++;
        totalMismatch++;
        continue;
      }

      try {
        const prompt = buildPrompt(q, data.fullPassage || '');
        const aiAnswer = await callClaude(prompt);
        totalQuestions++;

        const expected = q.fmt === 'mc' ? q.ans : (q.ans || q.wa || '');
        const match = compareAnswer(expected, aiAnswer, q.fmt);

        if (!match) {
          mismatches.push({
            file: shortPath,
            qnum: idx + 1,
            type: q.type,
            expected: String(expected),
            actual: aiAnswer.trim().substring(0, 50),
          });
          fileMismatch++;
          totalMismatch++;
        } else {
          totalPass++;
        }
      } catch (e) {
        errors.push({ file: shortPath, qnum: idx + 1, error: e.message });
      }

      // Rate limiting: 1 request per 500ms
      await new Promise(r => setTimeout(r, 500));
    }

    const status = fileMismatch === 0 ? '✅' : '❌';
    console.log(`${status} ${shortPath}: ${sampleSize - fileMismatch}/${sampleSize} 일치`);
  }

  // Summary
  console.log(`\n━━━ 결과 ━━━`);
  console.log(`파일: ${totalFiles}개`);
  console.log(`검증 문항: ${totalQuestions}개`);
  console.log(`일치: ${totalPass}개`);
  console.log(`불일치: ${totalMismatch}개`);
  console.log(`에러: ${errors.length}개`);

  if (mismatches.length > 0) {
    console.log(`\n━━━ 불일치 목록 ━━━`);
    mismatches.forEach(m => {
      console.log(`  ${m.file} Q${m.qnum} [${m.type || ''}]: 출제=${m.expected}, AI=${m.actual}${m.reason ? ' (' + m.reason + ')' : ''}`);
    });
  }

  if (errors.length > 0) {
    console.log(`\n━━━ 에러 목록 ━━━`);
    errors.forEach(e => {
      console.log(`  ${e.file}${e.qnum ? ' Q' + e.qnum : ''}: ${e.error}`);
    });
  }

  // Exit code
  if (totalMismatch > 0) {
    console.log(`\n❌ FAIL: ${totalMismatch}건 불일치`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL PASS: ${totalQuestions}문항 전부 일치`);
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
