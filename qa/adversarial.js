#!/usr/bin/env node
/**
 * adversarial.js — 적대적 공격
 *
 * --auto    : 규칙 기반 자동 공격 (API 불필요)
 * --prompt  : Claude Code에서 직접 공격할 프롬프트 출력
 * --parse   : 공격 결과 파싱
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/path-mapper');

function autoAttack(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const questions = data.questions || [];
  const attacks = [];

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    const passage = (q.passage || '').replace(/<[^>]+>/g, '');
    const ch = q.ch || [];

    // 공격1: 정답 선지가 가장 길다 (길이 편향)
    if (q.fmt === 'mc' && ch.length === 4) {
      const lens = ch.map(c => (c || '').length);
      const ansIdx = (q.ans || 1) - 1;
      const ansLen = lens[ansIdx];
      const othersAvg = lens.filter((_, i) => i !== ansIdx).reduce((a, b) => a + b, 0) / 3;
      if (ansLen > othersAvg * 2.5 && ansLen > 10) {
        attacks.push({ qId: qid, type: 'ATTACK2', detail: `정답(${ansLen}자)이 오답 평균(${Math.round(othersAvg)}자)의 2.5배 — 길이로 유추 가능`, severity: 'A' });
      }
    }

    // 공격2: 정답이 passage에 그대로 노출
    if (q.fmt === 'mc' && ch.length >= 2 && q.ans) {
      const answer = (ch[(q.ans || 1) - 1] || '').trim();
      if (answer.length >= 5 && passage.toLowerCase().includes(answer.toLowerCase())) {
        const passNoBlanks = passage.replace(/_{5,}/g, '');
        if (passNoBlanks.toLowerCase().includes(answer.toLowerCase())) {
          attacks.push({ qId: qid, type: 'ATTACK3', detail: `정답 "${answer}" 지문에 노출`, severity: 'A' });
        }
      }
    }

    // 공격3: 선지 동질성 부족 (하나만 다른 카테고리)
    if (q.fmt === 'mc' && ch.length === 4) {
      const hasKorean = ch.map(c => /[가-힣]/.test(c));
      const korCount = hasKorean.filter(Boolean).length;
      if (korCount === 1 || korCount === 3) {
        const oddOne = korCount === 1 ? ch.findIndex((_, i) => hasKorean[i]) : ch.findIndex((_, i) => !hasKorean[i]);
        if (oddOne === (q.ans || 1) - 1) {
          attacks.push({ qId: qid, type: 'ATTACK2', detail: '정답만 한글/영어가 달라서 뻔함', severity: 'A' });
        }
      }
    }

    // 공격4: 선지 중 3개가 거의 같고 1개만 다름
    if (q.fmt === 'mc' && ch.length === 4) {
      const normalized = ch.map(c => (c || '').toLowerCase().trim());
      const pairs = [];
      for (let a = 0; a < 4; a++) {
        for (let b = a + 1; b < 4; b++) {
          if (normalized[a] === normalized[b]) pairs.push([a, b]);
        }
      }
      if (pairs.length >= 2) {
        attacks.push({ qId: qid, type: 'ATTACK2', detail: `선지 중복 ${pairs.length}쌍 — 소거법으로 유추 가능`, severity: 'A' });
      }
    }

    // 공격5: 서술형 정답이 너무 짧음 (1글자)
    if (q.fmt === 'written' && q.wa) {
      if (q.wa.trim().length <= 1) {
        attacks.push({ qId: qid, type: 'ATTACK5', detail: `서술형 정답 "${q.wa}"가 1글자 — 풀이 의미 없음`, severity: 'S' });
      }
    }

    // 공격6: stem이 비어있거나 너무 짧음
    if (!q.stem || q.stem.trim().length < 5) {
      attacks.push({ qId: qid, type: 'ATTACK4', detail: 'stem이 너무 짧거나 비어있음', severity: 'S' });
    }
  });

  // 공격7: 정답 위치 편향 (파일 단위)
  const ansDist = {};
  questions.forEach(q => {
    if (q.fmt === 'mc' && q.ans) {
      ansDist[q.ans] = (ansDist[q.ans] || 0) + 1;
    }
  });
  const mcTotal = Object.values(ansDist).reduce((a, b) => a + b, 0);
  if (mcTotal >= 10) {
    Object.entries(ansDist).forEach(([ans, count]) => {
      const pct = count / mcTotal * 100;
      if (pct >= 45) {
        attacks.push({ qId: 0, type: 'ATTACK6', detail: `ans=${ans}가 ${pct.toFixed(0)}% — 위치 편향`, severity: 'A' });
      }
    });
  }

  return {
    file: jsonPath,
    mode: 'auto',
    attacks,
    safeCount: questions.length - new Set(attacks.map(a => a.qId)).size,
    attackCount: attacks.length,
    pass: attacks.filter(a => a.severity === 'S').length === 0,
    summary: attacks.length === 0 ? '공격 0건' : `공격 ${attacks.length}건 (S급 ${attacks.filter(a => a.severity === 'S').length}건)`,
  };
}

function generatePrompt(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const questions = data.questions || [];
  const relPath = path.relative(ROOT, jsonPath);

  let prompt = `=== 적대적 공격 ===\n파일: ${relPath}\n\n`;
  prompt += `아래 ${questions.length}문항을 공격자 시점에서 분석해주세요.\n\n`;
  prompt += `5가지 공격:\n`;
  prompt += `[ATTACK1] 정답이 2개 이상 가능\n`;
  prompt += `[ATTACK2] 선지가 너무 뻔함 (정답 빼고 다 말도 안 됨)\n`;
  prompt += `[ATTACK3] 정답이 지문에 노출\n`;
  prompt += `[ATTACK4] stem이 모호해서 뭘 묻는지 불명확\n`;
  prompt += `[ATTACK5] 풀이 자체가 불가능 (정보 부족)\n\n`;

  questions.forEach((q, i) => {
    const qid = q.id || (i + 1);
    prompt += `Q${qid} (${q.type})\n`;
    prompt += `  stem: ${q.stem}\n`;
    if (q.fmt === 'mc' && q.ch) {
      q.ch.forEach((c, ci) => prompt += `  ${ci + 1}) ${c}\n`);
      prompt += `  정답: ${q.ans}\n`;
    } else if (q.fmt === 'written') {
      prompt += `  정답: ${q.wa}\n`;
    }
    prompt += '\n';
  });

  prompt += `\n분석 결과:\nATTACKS:\nQ번호: SAFE 또는 ATTACK유형 — 사유\n`;
  return prompt;
}

module.exports = { autoAttack, generatePrompt };

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('-'));
  if (!file) { console.error('Usage: node qa/adversarial.js <json> [--auto|--prompt]'); process.exit(1); }

  if (args.includes('--prompt')) {
    console.log(generatePrompt(path.resolve(file)));
  } else {
    const result = autoAttack(path.resolve(file));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.pass ? 0 : 1);
  }
}
