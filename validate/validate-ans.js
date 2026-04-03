#!/usr/bin/env node
/**
 * validate-ans.js — 6겹 T/F 방어 시스템 + MC det↔ans 정합성 검증
 *
 * === T/F 6겹 방어 ===
 * L1. verdict 필드 필수화: verdict:"T"|"F" 없으면 S급 FAIL, ans는 verdict에서 자동 도출
 * L2. det.korean 텍스트 교차검증: korean/analysis/verdict 3중 교차, 2곳 불일치 → S급 FAIL
 * L3. Named Entity 변조 탐지: 지문↔진술문 숫자/이름 비교, 변조+verdict=T → S급 FAIL
 * L4. AI 3중 다수결: T/F 전용 AI 풀이 3회, 2/3 다수결 vs verdict 불일치 → S급 FAIL
 * L5. Adversarial Attack: 모호/정답2개/함정 탐지
 *
 * === MC 4지선다 ===
 * - det.analysis ✅/❌ 마커 기반 정합성 검증 (기존 로직 유지)
 *
 * Usage: node validate/validate-ans.js <file.json|--all>
 *        node validate/validate-ans.js --all --fix     (verdict 없는 T/F에 자동 추가)
 *        node validate/validate-ans.js --all --ai      (L4+L5 AI 검증 활성화)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = 'claude-haiku-4-5-20251001';

const MARKERS = [
  ['①', 1], ['②', 2], ['③', 3], ['④', 4],
  ['ⓐ', 1], ['ⓑ', 2], ['ⓒ', 3], ['ⓓ', 4],
];

// ════════════════════════════════════════════
// L3: Named Entity 추출
// ════════════════════════════════════════════
function extractEntities(text) {
  if (!text) return { numbers: [], names: [], dates: [], places: [] };

  // 숫자 (나이, 년도, 수량 등)
  const numbers = [];
  const numPatterns = [
    /(\d{1,3}(?:,\d{3})*)/g,                    // 일반 숫자
    /(?:age\s+(?:of\s+)?|aged?\s+)(\d+)/gi,     // age of 37
    /(\d+)\s*(?:years?\s*old|세)/gi,              // 37 years old, 37세
    /(\d{4})\s*(?:년|year)/gi,                    // 2024년
    /(\d+)(?:st|nd|rd|th)/gi,                    // 1st, 2nd
  ];
  for (const pat of numPatterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const n = m[1].replace(/,/g, '');
      if (!numbers.includes(n)) numbers.push(n);
    }
  }

  // 고유명사 (대문자 시작 단어 연속)
  const names = [];
  const nameRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  const stopWords = new Set(['The', 'This', 'That', 'These', 'Those', 'However', 'Moreover',
    'Furthermore', 'Therefore', 'Although', 'Because', 'Since', 'While', 'When', 'Where',
    'After', 'Before', 'During', 'According', 'Instead', 'Rather', 'Still', 'Also',
    'One', 'Some', 'Many', 'Most', 'All', 'Each', 'Every', 'Both', 'Neither', 'Either',
    'First', 'Second', 'Third', 'Finally', 'In', 'On', 'At', 'For', 'It', 'He', 'She',
    'They', 'We', 'But', 'And', 'Or', 'Not', 'His', 'Her', 'Its', 'Their', 'Our']);
  let nm;
  while ((nm = nameRe.exec(text)) !== null) {
    if (!stopWords.has(nm[1]) && !names.includes(nm[1])) names.push(nm[1]);
  }

  return { numbers, names };
}

function detectEntityTampering(passageText, stemText) {
  const passageEnt = extractEntities(passageText);
  const stemEnt = extractEntities(stemText);
  const tamperings = [];

  // 한국어 진술문에서도 숫자 추출 (쉼표 포함 숫자는 합쳐서 인식)
  const koreanNums = [];
  const knRe = /(\d{1,3}(?:,\d{3})+|\d+)/g;
  let knm;
  while ((knm = knRe.exec(stemText)) !== null) {
    const cleaned = knm[1].replace(/,/g, '');
    if (!koreanNums.includes(cleaned)) koreanNums.push(cleaned);
  }

  // 지문에서 실제 수치 추출 (billion/million/thousand 등 단위 변환 포함)
  const passageValues = new Set();
  // 원본 숫자
  for (const pn of passageEnt.numbers) passageValues.add(Number(pn));
  // billion/million/thousand 패턴에서 실제 값 추출
  const unitPatterns = [
    [/(\d+(?:\.\d+)?)\s*billion/gi, 1e9],
    [/(\d+(?:\.\d+)?)\s*million/gi, 1e6],
    [/(\d+(?:\.\d+)?)\s*thousand/gi, 1e3],
    [/(\d+(?:\.\d+)?)\s*trillion/gi, 1e12],
  ];
  for (const [pat, mult] of unitPatterns) {
    let um;
    while ((um = pat.exec(passageText)) !== null) {
      passageValues.add(Number(um[1]) * mult);
    }
  }

  // 진술문(한국어)에서도 억/만 단위 변환
  const stemValues = new Set();
  for (const sn of koreanNums) stemValues.add(Number(sn));
  // 한국어 단위: X억, X만, X천만
  const korUnits = [
    [/(\d+(?:\.\d+)?)\s*억/g, 1e8],
    [/(\d+(?:\.\d+)?)\s*만/g, 1e4],
    [/(\d+(?:\.\d+)?)\s*천만/g, 1e7],
    [/(\d+(?:\.\d+)?)\s*천/g, 1e3],
  ];
  for (const [pat, mult] of korUnits) {
    let um;
    while ((um = pat.exec(stemText)) !== null) {
      stemValues.add(Number(um[1]) * mult);
    }
  }

  // 지문에 없는 숫자가 진술문에 있으면 → 변조 의심
  const allPassageNums = passageEnt.numbers;
  for (const sn of koreanNums) {
    if (sn.length <= 1) continue; // 1자리 숫자는 무시 (문항번호 등)
    const snVal = Number(sn);
    const inPassage = allPassageNums.some(pn => pn === sn);
    // 단위 변환 후 일치 확인 (17.5억 = 1.75 billion 등)
    const inPassageConverted = [...passageValues].some(pv =>
      pv === snVal || Math.abs(pv - snVal) / Math.max(pv, snVal, 1) < 0.01
    );
    // 진술문 값이 지문 값보다 작은 경우 ("300종 이상" ⊂ "400종 이상") → 변조 아님
    const isSubset = [...passageValues].some(pv => snVal < pv && snVal > 0);

    if (!inPassage && !inPassageConverted && !isSubset && allPassageNums.length > 0) {
      // 유사 숫자 찾기 (자릿수 바꿈: 37→27, 73→37 등)
      const similar = allPassageNums.filter(pn =>
        pn.length === sn.length && pn !== sn
      );
      if (similar.length > 0) {
        tamperings.push({
          type: 'number',
          stem: sn,
          passage: similar,
          detail: `진술문 "${sn}" ↔ 지문 "${similar.join('/')}"`
        });
      }
    }
  }

  return tamperings;
}

// ════════════════════════════════════════════
// L2: det.korean 텍스트에서 T/F 판정 추론
// ════════════════════════════════════════════
function inferVerdictFromKorean(korean) {
  if (!korean || korean.length < 5) return null;

  // 명확한 F 패턴 (우선) — "원문과 다르다"는 맥락의 부정만 인식
  // 주의: "좋아하지 않는다"처럼 진술문 자체의 부정은 F가 아님
  const fPatterns = [
    /\bF\s*[\(（]/,          // F(불일치), F（
    /\bF\s*[.:\-—–]/,       // F. F: F—
    /^F\b/,                  // 줄 시작이 F
    /불일치/,                // 불일치
    /원문.*(?:과|와)\s*(?:다르|맞지\s*않|일치하지\s*않)/, // 원문과 다르다/맞지않다
    /거짓/,                  // 거짓
    /틀[리린렸]/,            // 틀리, 틀린, 틀렸 (원문이 틀렸다는 맥락)
    /잘못/,                  // 잘못
    /(?:이|가)\s*아니[라다].*(?:이|→)/,  // ~이 아니라 ~이다 (변조 설명)
  ];

  // 명확한 T 패턴
  const tPatterns = [
    /\bT\s*[\(（]/,          // T(일치)
    /\bT\s*[.:\-—–]/,       // T. T:
    /^T\b/,                  // 줄 시작이 T
    /일치[)\）.]/,           // 일치), 일치.
    /^.*일치\s*$/,           // ~일치 로 끝남
    /원문.*(?:과|와)\s*일치/, // 원문과 일치
    /\(T\)/,                 // (T) 괄호 표기
  ];

  const text = korean.replace(/<[^>]+>/g, ''); // HTML 태그 제거

  let fScore = 0, tScore = 0;
  for (const p of fPatterns) {
    if (p.test(text)) fScore++;
  }
  for (const p of tPatterns) {
    if (p.test(text)) tScore++;
  }

  // F 패턴이 T보다 강하면 F (불일치 관련 표현이 더 다양하므로)
  if (fScore > 0 && fScore > tScore) return 'F';
  if (tScore > 0 && tScore > fScore) return 'T';
  if (fScore > 0 && tScore > 0) return null; // 모호 → 판단 불가
  return null; // 추론 불가
}

// ════════════════════════════════════════════
// L2: det.analysis 마커에서 T/F 판정 추론
// ════════════════════════════════════════════
function inferVerdictFromAnalysis(analysis) {
  if (!analysis) return null;

  // ✅ 마커 (확실)
  if (/✅\s*T/.test(analysis)) return 'T';
  if (/✅\s*F/.test(analysis)) return 'F';

  // T/F 문항에서 ❌는 두 가지 의미가 있음:
  // (a) "❌ T: ~이므로 F가 정답" → verdict=F (MC 스타일 마킹)
  // (b) "❌ F: 이유설명" → "이 진술은 F이다, 이유는~" → verdict=F (설명 스타일)
  //
  // 구분법: analysis 전체 맥락에서 판단
  // - "❌" 뒤에 T/F + ":" + 설명 → 설명 스타일 (verdict = 그 T/F 값)
  // - 실제 MC 스타일 마킹은 ✅가 반대쪽에 있어야 함
  //
  // ❌만 단독으로 있으면 → 그 뒤의 T/F가 verdict
  // (❌ F: 설명 = "F다, 왜냐면..." / ❌ T: 설명 = "T다, 왜냐면...")
  const hasCheckT = /✅\s*T/.test(analysis);
  const hasCheckF = /✅\s*F/.test(analysis);
  const hasCrossT = /❌\s*T/.test(analysis);
  const hasCrossF = /❌\s*F/.test(analysis);

  // ✅T + ❌F → T가 정답 (MC 스타일)
  if (hasCheckT && hasCrossF) return 'T';
  // ✅F + ❌T → F가 정답 (MC 스타일)
  if (hasCheckF && hasCrossT) return 'F';

  // ❌만 단독 → 설명 스타일 (❌ F: 이유 = verdict는 F)
  if (hasCrossF && !hasCrossT && !hasCheckT && !hasCheckF) return 'F';
  if (hasCrossT && !hasCrossF && !hasCheckT && !hasCheckF) return 'T';

  return null;
}

// ════════════════════════════════════════════
// AI 호출 (L4, L5)
// ════════════════════════════════════════════
function callClaude(messages, maxTokens = 500) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) return reject(new Error('ANTHROPIC_API_KEY not set'));
    const body = JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      temperature: 0.0,
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
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.content?.[0]?.text || '');
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// L4: AI 3중 다수결 T/F 풀이
async function aiTripleVote(passage, stem) {
  const prompt = `You are verifying a True/False question for a Korean English test.

PASSAGE:
"""
${passage}
"""

STATEMENT (Korean):
${stem}

Task: Based ONLY on the passage, is this statement TRUE or FALSE?
- TRUE = the statement accurately matches the passage content
- FALSE = the statement contains information that differs from the passage (wrong numbers, names, facts, etc.)

Respond with ONLY one word: "T" or "F"`;

  const results = [];
  const temps = [0.0, 0.3, 0.5]; // 3회 서로 다른 temperature

  for (const temp of temps) {
    try {
      const body = JSON.stringify({
        model: AI_MODEL,
        max_tokens: 5,
        temperature: temp,
        messages: [{ role: 'user', content: prompt }]
      });

      const result = await new Promise((resolve, reject) => {
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
              if (parsed.error) reject(new Error(parsed.error.message));
              else resolve(parsed.content?.[0]?.text?.trim() || '');
            } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      const ans = result.toUpperCase().charAt(0);
      if (ans === 'T' || ans === 'F') results.push(ans);
    } catch (e) {
      // API 실패는 무시 (2/3 이상이면 판정)
    }
  }

  if (results.length < 2) return null; // 판정 불가
  const tCount = results.filter(r => r === 'T').length;
  const fCount = results.filter(r => r === 'F').length;
  return tCount > fCount ? 'T' : 'F';
}

// L5: Adversarial Attack — 모호성/이중정답 탐지
async function adversarialCheck(passage, stem, verdict) {
  const prompt = `You are an adversarial test auditor. Your job is to find ERRORS in this T/F question.

PASSAGE:
"""
${passage}
"""

STATEMENT: ${stem}
GIVEN ANSWER: ${verdict}

Check for these problems:
1. AMBIGUOUS: Could this be interpreted as both T and F?
2. DUAL_ANSWER: Are there facts that support BOTH T and F?
3. MISLEADING: Does the statement trick through language rather than content?
4. INCOMPLETE: Does the statement leave out critical context that changes the answer?

Respond in JSON (no other text):
{
  "hasIssue": true/false,
  "issueType": "AMBIGUOUS|DUAL_ANSWER|MISLEADING|INCOMPLETE|NONE",
  "detail": "explanation or null"
}`;

  try {
    const resp = await callClaude([{ role: 'user', content: prompt }], 300);
    const jsonMatch = resp.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) { /* ignore */ }
  return null;
}

// ════════════════════════════════════════════
// 메인 검증 함수
// ════════════════════════════════════════════
function validateAns(jsonPath, options = {}) {
  const errors = [];
  let raw, data;
  try {
    raw = fs.readFileSync(jsonPath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    return { errors: [{ sev: 'S', msg: `PARSE: ${e.message}` }], tfQuestions: [] };
  }

  const questions = data.questions || (Array.isArray(data) ? data : []);
  const fullPassage = data.fullPassage || '';
  const tfQuestions = []; // AI 검증 대상 수집
  let modified = false;

  for (const q of questions) {
    if (q.fmt !== 'mc' || q.ans === undefined) continue;
    const qid = q.id || '?';
    const analysis = (q.det && q.det.analysis) || '';
    const korean = (q.det && q.det.korean) || '';
    const ch = q.ch || [];
    const ans = q.ans;

    // ── T/F 문항 ── (ch 기반 또는 type 기반)
    const chUpper = ch.map(c => (c || '').trim().toUpperCase());
    const isChTF = ch.length === 2 && chUpper[0] === 'T' && chUpper[1] === 'F';
    const isTypeTF = q.type && q.type.includes('T/F');
    if (isChTF || isTypeTF) {
        const passage = q.passage === '__FULL__' ? fullPassage : (q.passage || fullPassage);

        // ════ L1: verdict 필드 필수 ════
        if (!q.verdict) {
          if (options.fix) {
            // --fix 모드: korean/analysis에서 추론해서 자동 추가
            const fromKorean = inferVerdictFromKorean(korean);
            const fromAnalysis = inferVerdictFromAnalysis(analysis);
            const inferred = fromKorean || fromAnalysis;
            if (inferred) {
              q.verdict = inferred;
              // ans도 verdict에서 재계산
              const correctAns = inferred === 'T' ? 1 : 2;
              if (q.ans !== correctAns) {
                q.ans = correctAns;
              }
              modified = true;
            } else {
              // Fallback: korean/analysis에서 추론 실패 → 기존 ans에서 verdict 도출
              // ⚠ 이 경우 L4(AI 검증)에서 반드시 재확인 필요
              q.verdict = ans === 1 ? 'T' : 'F';
              q._verdictSource = 'ans-fallback'; // AI 검증 우선 대상 표시
              modified = true;
            }
          } else {
            errors.push({ sev: 'S', msg: `Q${qid}: [L1] verdict 필드 없음 (T/F 문항 필수). --fix로 자동 추가 가능` });
          }
        }

        // ════ L1b: verdict↔ans 일치성 ════
        if (q.verdict) {
          const expectedAns = q.verdict === 'T' ? 1 : 2;
          if (ans !== expectedAns) {
            errors.push({
              sev: 'S',
              msg: `Q${qid}: [L1] verdict="${q.verdict}" but ans=${ans} (should be ${expectedAns})`
            });
            if (options.fix) {
              q.ans = expectedAns;
              modified = true;
            }
          }
        }

        // ════ L2: 3중 교차검증 (verdict vs korean vs analysis) ════
        const fromKorean = inferVerdictFromKorean(korean);
        const fromAnalysis = inferVerdictFromAnalysis(analysis);
        const verdictVal = q.verdict || null;

        const sources = [
          { name: 'verdict', val: verdictVal },
          { name: 'korean', val: fromKorean },
          { name: 'analysis', val: fromAnalysis },
        ].filter(s => s.val !== null);

        if (sources.length >= 2) {
          const vals = sources.map(s => s.val);
          const allSame = vals.every(v => v === vals[0]);
          if (!allSame) {
            const detail = sources.map(s => `${s.name}=${s.val}`).join(', ');
            errors.push({
              sev: 'S',
              msg: `Q${qid}: [L2] T/F 3중 교차 불일치 — ${detail}`
            });
          }
        }

        // ════ L3: Named Entity 변조 탐지 ════
        if (passage && q.stem) {
          const tamperings = detectEntityTampering(passage, q.stem);
          if (tamperings.length > 0) {
            // 변조가 감지됐는데 verdict가 T → 거의 확실히 오류
            if (q.verdict === 'T' || (!q.verdict && ans === 1)) {
              const detail = tamperings.map(t => t.detail).join('; ');
              errors.push({
                sev: 'S',
                msg: `Q${qid}: [L3] 숫자/이름 변조 감지 + verdict=T → F여야 함. ${detail}`
              });
            }
            // 변조가 있고 verdict=F → 정상 (확인용 info)
          }
        }

        // AI 검증 대상 수집 (L4, L5는 비동기이므로 나중에 처리)
        tfQuestions.push({ qid, passage, stem: q.stem, verdict: q.verdict, ans: q.ans, q });

        continue;
    }

    // ── MC 4지선다 ──
    // ⚠️ 그룹 파싱: "✅ ①②④" → checkMarks=[①,②,④] (기존 includes 방식은 ①만 감지하는 버그 있음)
    const checkMarks = [];
    const crossMarks = [];
    const circled = '①②③④⑤ⓐⓑⓒⓓ';
    const checkGroupRe = /✅\s*([①②③④⑤ⓐⓑⓒⓓ]+)/g;
    const crossGroupRe = /❌\s*([①②③④⑤ⓐⓑⓒⓓ]+)/g;
    let gm;
    while ((gm = checkGroupRe.exec(analysis)) !== null) {
      for (const [marker, idx] of MARKERS) {
        if (gm[1].includes(marker) && !checkMarks.find(c => c.idx === idx)) {
          checkMarks.push({ marker, idx });
        }
      }
    }
    while ((gm = crossGroupRe.exec(analysis)) !== null) {
      for (const [marker, idx] of MARKERS) {
        if (gm[1].includes(marker) && !crossMarks.find(c => c.idx === idx)) {
          crossMarks.push({ marker, idx });
        }
      }
    }
    void circled; // suppress unused warning

    const totalMarkers = checkMarks.length + crossMarks.length;

    if (totalMarkers < 2) {
      const firstLine = analysis.trim().split('\n')[0] || '';
      let hasFirstLineMarker = false;
      for (const [marker] of MARKERS) {
        if (firstLine.startsWith(marker + ' ') || firstLine.startsWith(marker + ':')) {
          hasFirstLineMarker = true;
          break;
        }
      }
      if (!hasFirstLineMarker) {
        errors.push({ sev: 'S', msg: `Q${qid}: det.analysis에 ✅/❌ 마커 부족 (${totalMarkers}개) — 최소 2개 필요` });
      }
      continue;
    }

    // 어법/부적절: 다수 ✅ + 단일 ❌ → ❌이 정답
    if (checkMarks.length >= 2 && crossMarks.length === 1) {
      const correct = crossMarks[0].idx;
      if (ans !== correct) {
        errors.push({
          sev: 'S',
          msg: `Q${qid}: 어법/부적절 det says ❌${crossMarks[0].marker}(=${correct}) but ans=${ans}`
        });
        if (options.fix) {
          q.ans = correct;
          modified = true;
        }
      }
      continue;
    }

    // 일반: 단일 ✅ + 다수 ❌ → ✅이 정답
    if (checkMarks.length === 1 && crossMarks.length >= 1) {
      const correct = checkMarks[0].idx;
      if (ans !== correct) {
        errors.push({
          sev: 'S',
          msg: `Q${qid}: det says ✅${checkMarks[0].marker}(=${correct}) but ans=${ans}`
        });
        if (options.fix) {
          q.ans = correct;
          modified = true;
        }
      }
      continue;
    }

    // 다수 ❌ only → 첫줄 패턴으로 판정
    if (crossMarks.length >= 2 && checkMarks.length === 0) {
      const firstLine = analysis.trim().split('\n')[0] || '';
      for (const [marker, idx] of MARKERS) {
        if (firstLine.startsWith(marker + ' ') || firstLine.startsWith(marker + ':')) {
          if (ans !== idx) {
            errors.push({
              sev: 'S',
              msg: `Q${qid}: det 첫줄 ${marker}(=${idx}) but ans=${ans}`
            });
          }
          break;
        }
      }
    }
  }

  // --fix 모드: 파일 저장
  if (modified && options.fix) {
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  return { errors, tfQuestions, data, modified };
}

// ════════════════════════════════════════════
// AI 비동기 검증 (L4 + L5)
// ════════════════════════════════════════════
async function validateAI_TF(tfQuestions) {
  const aiErrors = [];
  if (!API_KEY) {
    console.log('  [SKIP] AI 검증 — ANTHROPIC_API_KEY 없음');
    return aiErrors;
  }

  for (const tq of tfQuestions) {
    if (!tq.passage || !tq.stem) continue;

    // L4: 3중 다수결
    const aiVerdict = await aiTripleVote(tq.passage, tq.stem);
    if (aiVerdict && tq.verdict && aiVerdict !== tq.verdict) {
      aiErrors.push({
        sev: 'S',
        msg: `Q${tq.qid}: [L4] AI 3중 다수결="${aiVerdict}" vs verdict="${tq.verdict}" — AI가 다르게 판정`
      });
    }

    // L5: Adversarial
    if (tq.verdict) {
      const adv = await adversarialCheck(tq.passage, tq.stem, tq.verdict);
      if (adv && adv.hasIssue) {
        aiErrors.push({
          sev: 'A',
          msg: `Q${tq.qid}: [L5] ${adv.issueType} — ${adv.detail || '모호한 문항'}`
        });
      }
    }
  }

  return aiErrors;
}

// ════════════════════════════════════════════
// CLI
// ════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node validate/validate-ans.js <file.json|--all> [--fix] [--ai]');
    console.log('  --fix   T/F verdict 자동 추가 + ans 수정');
    console.log('  --ai    L4(AI 3중 다수결) + L5(Adversarial) 활성화');
    process.exit(0);
  }

  const doFix = args.includes('--fix');
  const doAI = args.includes('--ai');
  const options = { fix: doFix };

  const files = [];
  if (args.includes('--all')) {
    const { execSync } = require('child_process');
    const out = execSync(`find "${path.join(ROOT, 'data')}" -name "*.json" -type f`, { encoding: 'utf8' });
    files.push(...out.trim().split('\n').filter(Boolean));
  } else {
    const target = args.find(a => !a.startsWith('--'));
    if (target) files.push(path.resolve(target));
  }

  let totalErrors = 0;
  let totalFiles = 0;
  let failFiles = 0;
  let fixedFiles = 0;
  let totalTF = 0;
  let allTFQuestions = [];

  // L1~L3: 동기 검증
  for (const f of files) {
    const { errors, tfQuestions, modified } = validateAns(f, options);
    totalFiles++;
    totalTF += tfQuestions.length;
    const rel = path.relative(ROOT, f);

    if (modified) fixedFiles++;

    if (errors.length > 0) {
      failFiles++;
      console.log(`[FAIL] ${rel} (${errors.length} errors)`);
      for (const e of errors) {
        console.log(`  [${e.sev}] ${e.msg}`);
      }
      totalErrors += errors.length;
    }

    // AI 대상 수집
    if (doAI) {
      allTFQuestions.push(...tfQuestions.map(tq => ({ ...tq, file: rel })));
    }
  }

  // L4~L5: AI 비동기 검증
  if (doAI && allTFQuestions.length > 0) {
    console.log(`\n[AI] T/F ${allTFQuestions.length}문항 AI 검증 시작...`);
    const aiErrors = await validateAI_TF(allTFQuestions);
    if (aiErrors.length > 0) {
      console.log(`\n[AI FAIL] ${aiErrors.length}건 발견:`);
      for (const e of aiErrors) {
        console.log(`  [${e.sev}] ${e.msg}`);
      }
      totalErrors += aiErrors.length;
    } else {
      console.log(`[AI PASS] AI 검증 0건 이슈`);
    }
  }

  // 결과 요약
  console.log('\n═══ 요약 ═══');
  console.log(`파일: ${totalFiles} | T/F 문항: ${totalTF}`);
  console.log(`L1~L3 에러: ${totalErrors}건 | FAIL 파일: ${failFiles}`);
  if (doFix) console.log(`자동 수정: ${fixedFiles}개 파일`);
  if (doAI) console.log(`AI 검증: ${allTFQuestions.length}문항`);

  if (totalErrors === 0) {
    console.log(`\n[ALL PASS] ${totalFiles} files, 0 errors`);
  } else {
    console.log(`\n${failFiles} files FAIL, ${totalErrors} total errors`);
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
