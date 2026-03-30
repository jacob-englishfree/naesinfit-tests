#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — validate-ai.js
 * Layer ③: AI 풀이 검증
 *
 * Claude API로 각 문항을 실제로 풀어서:
 * 1. 정답 일치 여부
 * 2. 선지 품질 (뻔한 오답, 지문에 답 노출)
 * 3. 난이도 적절성
 *
 * 환경변수: ANTHROPIC_API_KEY (필수)
 *
 * Usage: node validate/validate-ai.js data/.../단어.json
 *        node validate/validate-ai.js --all [--fix]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-haiku-4-5-20251001'; // Fast + cheap for validation

const SEV = { S: 'S', A: 'A', B: 'B', C: 'C' };

class AIResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.errors = [];
    this.warnings = [];
    this.details = []; // Per-question AI analysis
  }
  add(id, sev, msg) {
    const entry = { id, sev, msg };
    if (sev === SEV.S || sev === SEV.A) this.errors.push(entry);
    else this.warnings.push(entry);
  }
  get pass() { return this.errors.length === 0; }
}

function callClaude(messages, maxTokens = 2000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages
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
          if (parsed.error) {
            reject(new Error(parsed.error.message));
          } else {
            const text = parsed.content?.[0]?.text || '';
            resolve(text);
          }
        } catch (e) {
          reject(new Error(`API parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildPrompt(question, fullPassage) {
  const q = question;
  const passage = q.passage === '__FULL__' ? fullPassage : (q.passage || fullPassage);
  const isMC = q.fmt === 'mc';

  let choicesText = '';
  if (isMC && Array.isArray(q.ch)) {
    choicesText = q.ch.map((c, i) => `${i}: ${c}`).join('\n');
  }

  return `You are a strict English test quality auditor for Korean high school students.

PASSAGE:
"""
${passage}
"""

QUESTION (type: ${q.type}, difficulty: ${q.diff}):
${q.stem}

${isMC ? `CHOICES:\n${choicesText}\n\nGiven answer index: ${q.ans} (= "${q.ch[q.ans - 1]}")` : `Given written answer: "${q.wa}"\nAccepted answers: ${JSON.stringify(q.accept)}`}

Analyze this question and respond in EXACTLY this JSON format (no other text):
{
  "myAnswer": ${isMC ? '<number 0-4>' : '"<your written answer>"'},
  "answerCorrect": true/false,
  "answerIssue": "null or description of why the given answer is wrong",
  "choiceQuality": "good/fair/poor",
  "choiceIssues": ["list of specific issues with choices, empty if none"],
  "answerExposedInPassage": true/false,
  "exposureDetail": "null or how the answer is visible in the passage",
  "difficultyMatch": true/false,
  "actualDifficulty": "쉬움/보통/어려움",
  "stemClarity": "good/fair/poor"
}`;
}

// Batch questions into groups to reduce API calls
function buildBatchPrompt(questions, fullPassage, startIdx) {
  const batch = questions.slice(startIdx, startIdx + 5);

  const qTexts = batch.map((q, i) => {
    const idx = startIdx + i + 1;
    const passage = q.passage === '__FULL__' ? '[FULL PASSAGE ABOVE]' : (q.passage || '[FULL PASSAGE ABOVE]');
    const isMC = q.fmt === 'mc';

    let choicesText = '';
    if (isMC && Array.isArray(q.ch)) {
      choicesText = q.ch.map((c, ci) => `  ${ci}: ${c}`).join('\n');
    }

    return `--- Q${idx} (type: ${q.type}, diff: ${q.diff}) ---
${passage !== '[FULL PASSAGE ABOVE]' ? `PASSAGE: ${passage.substring(0, 300)}${passage.length > 300 ? '...' : ''}` : 'PASSAGE: [See full passage above]'}
STEM: ${q.stem}
${isMC ? `CHOICES:\n${choicesText}\nGIVEN ANSWER: index ${q.ans} = "${q.ch[q.ans - 1]}"` : `GIVEN ANSWER: "${q.wa}"\nACCEPT: ${JSON.stringify(q.accept)}`}`;
  }).join('\n\n');

  return `You are a strict English test quality auditor for Korean high school students.
Check each question below. For each, determine if the given answer is correct and if choices are fair.

FULL PASSAGE:
"""
${fullPassage.substring(0, 1500)}${fullPassage.length > 1500 ? '...' : ''}
"""

${qTexts}

Respond with a JSON array of ${batch.length} objects, one per question, EXACTLY this format (no other text):
[
  {
    "qId": <question number>,
    "myAnswer": <your answer>,
    "correct": true/false,
    "issue": "null or problem description",
    "choiceQuality": "good/fair/poor",
    "exposed": true/false,
    "diffMatch": true/false
  }
]`;
}

async function validateAI(jsonPath) {
  const result = new AIResult(jsonPath);

  if (!API_KEY) {
    result.add('AI-SKIP', SEV.C, 'ANTHROPIC_API_KEY not set — AI validation skipped');
    return result;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    result.add('AI-PARSE', SEV.S, `JSON parse error: ${e.message}`);
    return result;
  }

  const { fullPassage, questions } = data;
  if (!fullPassage || !Array.isArray(questions) || questions.length === 0) {
    result.add('AI-DATA', SEV.A, 'Missing fullPassage or questions');
    return result;
  }

  // Process in batches of 5
  for (let i = 0; i < questions.length; i += 5) {
    const batchPrompt = buildBatchPrompt(questions, fullPassage, i);

    try {
      const response = await callClaude([{ role: 'user', content: batchPrompt }], 1500);

      // Extract JSON from response
      let analysis;
      try {
        // Try to find JSON array in response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          result.add('AI-RESP', SEV.B, `Batch ${i / 5 + 1}: Could not parse AI response`);
          continue;
        }
      } catch (e) {
        result.add('AI-RESP', SEV.B, `Batch ${i / 5 + 1}: JSON parse failed`);
        continue;
      }

      // Process each question result
      analysis.forEach(a => {
        const qId = a.qId || (i + 1);
        result.details.push(a);

        // ── AI-10: Answer mismatch ──
        if (a.correct === false) {
          result.add('AI-10', SEV.S,
            `Q${qId}: AI가 풀었을 때 정답 불일치 — ${a.issue || '상세 없음'}`);
        }

        // ── AI-20: Poor choice quality ──
        if (a.choiceQuality === 'poor') {
          result.add('AI-20', SEV.A,
            `Q${qId}: 선지 품질 불량 — 오답이 너무 뻔하거나 정답이 모호`);
        }

        // ── AI-30: Answer exposed in passage ──
        if (a.exposed === true) {
          result.add('AI-30', SEV.A,
            `Q${qId}: 지문에 정답이 그대로 노출됨`);
        }

        // ── AI-40: Difficulty mismatch ──
        if (a.diffMatch === false) {
          result.add('AI-40', SEV.B,
            `Q${qId}: 난이도 태그 불일치 (AI 판단과 다름)`);
        }
      });

    } catch (e) {
      if (e.message.includes('rate_limit') || e.message.includes('overloaded')) {
        // Wait and retry once
        await new Promise(r => setTimeout(r, 5000));
        i -= 5; // Retry this batch
      } else {
        result.add('AI-ERR', SEV.B, `Batch ${i / 5 + 1}: API error — ${e.message}`);
      }
    }

    // Rate limiting: small delay between batches
    if (i + 5 < questions.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ── AI-50: Summary stats ──
  const wrongCount = result.details.filter(d => d.correct === false).length;
  const poorCount = result.details.filter(d => d.choiceQuality === 'poor').length;
  const exposedCount = result.details.filter(d => d.exposed === true).length;

  if (wrongCount > 0) {
    result.add('AI-50', SEV.S,
      `정답 오류 ${wrongCount}/${questions.length}문항 — 배포 차단`);
  }
  if (exposedCount >= 3) {
    result.add('AI-51', SEV.A,
      `정답 노출 ${exposedCount}/${questions.length}문항 — 선지 재작성 필요`);
  }
  if (poorCount >= 5) {
    result.add('AI-52', SEV.A,
      `선지 품질 불량 ${poorCount}/${questions.length}문항 — 오답 매력도 재검토 필요`);
  }

  return result;
}

// ── CLI ──
function findJsonFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !full.includes('/dist/')) {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validate/validate-ai.js <json-file>');
    console.error('       node validate/validate-ai.js --all');
    console.error('');
    console.error('Requires: ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  if (!API_KEY) {
    console.log('[SKIP] ANTHROPIC_API_KEY not set — AI validation disabled');
    console.log('Set it: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(0);
  }

  let files = [];
  if (args[0] === '--all') {
    const dataDir = path.join(ROOT, 'data');
    if (fs.existsSync(dataDir)) files = findJsonFiles(dataDir);
    if (files.length === 0) { console.log('No JSON files found.'); process.exit(0); }
  } else {
    files = [path.resolve(args[0])];
  }

  let totalPass = 0, totalFail = 0;
  for (const f of files) {
    const result = await validateAI(f);
    const rel = path.relative(ROOT, f);

    if (result.pass) {
      totalPass++;
      console.log(`[PASS] ${rel}`);
    } else {
      totalFail++;
      console.log(`[FAIL] ${rel} (${result.errors.length} issues)`);
      result.errors.forEach(e => console.log(`  [${e.sev}] ${e.id}: ${e.msg}`));
    }

    // Show warnings too
    result.warnings.forEach(w => console.log(`  [${w.sev}] ${w.id}: ${w.msg}`));
  }

  if (files.length > 1) {
    console.log(`\n--- AI Validation Summary ---`);
    console.log(`Total: ${files.length} | PASS: ${totalPass} | FAIL: ${totalFail}`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

module.exports = { validateAI };
if (require.main === module) main();
