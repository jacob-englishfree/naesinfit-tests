#!/usr/bin/env node
/**
 * regenerate-suneunglight.js
 * 수능특강Light TODO 파일 일괄 재출제
 * Usage: node scripts/regenerate-suneunglight.js [--강 1] [--type 단어]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// .env 로드
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  });
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('❌ ANTHROPIC_API_KEY 미설정'); process.exit(1); }

const args = process.argv.slice(2);
const filterGang = args.includes('--강') ? args[args.indexOf('--강') + 1] : null;
const filterType = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
const dryRun = args.includes('--dry');

// TODO 파일 목록 수집
const lightBase = path.join(ROOT, 'data', '부교재', '수능특강Light', '영어');
const out = execSync(`find "${lightBase}" -name "*.json" | grep -v "전체"`, { encoding: 'utf8' });
const files = out.trim().split('\n').filter(Boolean);

const todoFiles = [];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const hasTodo = d.questions.some(q => q.det && q.det.analysis && q.det.analysis.startsWith('TODO'));
  if (!hasTodo) continue;

  const rel = path.relative(lightBase, f);  // "1강/1번/단어.json"
  const parts = rel.split('/');
  const gang = parts[0];   // "1강"
  const testType = parts[parts.length - 1].replace('.json', '');  // "단어"

  if (filterGang && gang !== filterGang + '강') continue;
  if (filterType && testType !== filterType) continue;

  todoFiles.push({ f, rel, gang, testType, d });
}

console.log(`\n📋 재출제 대상: ${todoFiles.length}개 파일`);
if (dryRun) { todoFiles.forEach(t => console.log('  ', t.rel)); process.exit(0); }

// 출제 스펙 (generate-test.js와 동일)
const MARKERS_LOCAL = [['①',1],['②',2],['③',3],['④',4],['⑤',5]];

function deriveAns(analysis) {
  const checkMarks = [], crossMarks = [];
  const checkRe = /✅\s*([①②③④⑤]+)/g;
  const crossRe = /❌\s*([①②③④⑤]+)/g;
  let gm;
  while ((gm = checkRe.exec(analysis)) !== null) {
    for (const [marker, idx] of MARKERS_LOCAL) {
      if (gm[1].includes(marker) && !checkMarks.find(c => c.idx === idx)) checkMarks.push({ marker, idx });
    }
  }
  while ((gm = crossRe.exec(analysis)) !== null) {
    for (const [marker, idx] of MARKERS_LOCAL) {
      if (gm[1].includes(marker) && !crossMarks.find(c => c.idx === idx)) crossMarks.push({ marker, idx });
    }
  }
  if (checkMarks.length >= 2 && crossMarks.length === 1) return crossMarks[0].idx;
  if (checkMarks.length === 1 && crossMarks.length >= 1) return checkMarks[0].idx;
  return null;
}

function buildPrompt(testType, fullPassage, ei) {
  // generate-test.js의 buildPrompt와 동일한 로직
  const spec = {
    '단어': {
      totalQ: 20, types: [
        { type: '(A)(B)(C) 조합형', count: 3, fmt: 'mc' },
        { type: '문맥상 부적절한 어휘', count: 3, fmt: 'mc' },
        { type: '빈칸 어휘 완성', count: 3, fmt: 'mc' },
        { type: '동의어 고르기', count: 2, fmt: 'mc' },
        { type: '반의어 고르기', count: 2, fmt: 'mc' },
        { type: '다의어 문맥적 의미', count: 1, fmt: 'mc' },
        { type: '영영풀이 매칭', count: 1, fmt: 'mc' },
        { type: '어형 변환 (서술형)', count: 2, fmt: 'written' },
        { type: '빈칸 문맥 완성', count: 3, fmt: 'mc' },
      ]
    },
    '워크북': {
      totalQ: 20, types: [
        { type: '어법', count: 5, fmt: 'mc' },
        { type: '어휘', count: 2, fmt: 'mc' },
        { type: '내용이해 T/F', count: 3, fmt: 'mc' },
        { type: '빈칸 추론', count: 3, fmt: 'mc' },
        { type: '문장 삽입', count: 1, fmt: 'mc' },
        { type: '순서 배열', count: 1, fmt: 'mc' },
        { type: '서술형 (빈칸)', count: 3, fmt: 'written' },
        { type: '서술형 (찾기)', count: 2, fmt: 'written' },
      ]
    },
    '퀴즈': {
      totalQ: 20, types: [
        { type: '순서 배열', count: 2, fmt: 'mc' },
        { type: '문장 삽입', count: 2, fmt: 'mc' },
        { type: '어순 배열', count: 2, fmt: 'mc' },
        { type: '어법', count: 4, fmt: 'mc' },
        { type: '빈칸 추론', count: 4, fmt: 'mc' },
        { type: '서술형 (빈칸)', count: 3, fmt: 'written' },
        { type: '서술형 (찾기)', count: 3, fmt: 'written' },
      ]
    }
  };

  const s = spec[testType];
  const typeList = s.types.map(t => `- ${t.type} ${t.count}문항 (${t.fmt})`).join('\n');

  return `당신은 영어 내신 시험 출제 전문가입니다. 아래 원문으로 ${testType} 테스트 20문항을 출제하세요.

## 원문
${fullPassage}

## 출제 조건
- 총 20문항, 100점
- 유형별 구성:
${typeList}

## 배점 규칙 (반드시 준수)
- difficulty "쉬움": points 4 → 5문항
- difficulty "보통": points 5 → 10문항
- difficulty "어려움": points 6 → 5문항

## MC 문항 (4지선다) 규칙
- ch: 4개 선택지 배열
- ans: 정답 번호 (1~4, 1-indexed)
- det.analysis: 반드시 ✅/❌ 이모지로 각 선택지 설명
  - 정답: ✅ ① 설명
  - 오답: ❌ ② 설명 (이유)
  - 어법/부적절 유형: 오류선택지에 ❌, 나머지에 ✅

## written 문항 규칙
- wa: 정답 문자열
- fmt: "written"
- ch: null 또는 []

## 출력 형식 (순수 JSON만, 마크다운 없이)
{
  "version": 1,
  "testType": "${testType}",
  "ei": {
    "subject": "${ei.subject}",
    "pub": "${ei.pub}",
    "lesson": "${ei.lesson}",
    "title": "${ei.title || ''}",
    "total": 100,
    "time": 1200,
    "totalQ": 20,
    "histKey": "${testType === '단어' ? 'wordTest' : testType === '워크북' ? 'workbookTest' : 'quizTest'}_${(ei.pub||'').replace(/[^a-zA-Z0-9]/g,'')}_${(ei.lesson||'').replace(/[^a-zA-Z0-9가-힣]/g,'')}_v1"
  },
  "fullPassage": "원문 전체",
  "questions": [
    {
      "id": 1,
      "type": "유형명",
      "difficulty": "쉬움|보통|어려움",
      "points": 4|5|6,
      "fmt": "mc|written",
      "passage": "__FULL__",
      "stem": "문항 줄기",
      "ch": ["①선택지","②선택지","③선택지","④선택지"],
      "ans": 정답번호,
      "wa": null,
      "det": {
        "korean": "한국어 해석",
        "analysis": "✅ ③ 정답이유\\n❌ ① 오답이유\\n❌ ② 오답이유\\n❌ ④ 오답이유",
        "tip": "학습 팁"
      }
    }
  ]
}`;
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.content[0].text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function regenerateOne(item) {
  const { f, rel, testType, d } = item;
  const fullPassage = d.fullPassage;
  const ei = d.ei || {};

  console.log(`\n📝 재출제: ${rel}`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    let responseText;
    try {
      const prompt = buildPrompt(testType, fullPassage, ei);
      responseText = await callClaude(prompt);
    } catch (e) {
      console.error(`   ❌ API 실패: ${e.message}`);
      continue;
    }

    let newData;
    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
      newData = JSON.parse(cleaned);
    } catch (e) {
      console.error(`   ❌ JSON 파싱 실패 (${attempt}/3)`);
      continue;
    }

    // ans 자동도출
    let ansFixed = 0;
    for (const q of (newData.questions || [])) {
      if (q.fmt !== 'mc' || !q.det?.analysis) continue;
      const derived = deriveAns(q.det.analysis);
      if (derived !== null && q.ans !== derived) { q.ans = derived; ansFixed++; }
    }
    if (ansFixed > 0) console.log(`   🎯 ans 자동도출: ${ansFixed}건`);

    // 저장
    fs.writeFileSync(f, JSON.stringify(newData, null, 2) + '\n', 'utf8');
    console.log(`   ✅ 저장 완료 (시도 ${attempt})`);
    return true;
  }

  console.error(`   ❌ 3회 모두 실패: ${rel}`);
  return false;
}

async function main() {
  let done = 0, failed = 0;
  for (const item of todoFiles) {
    const ok = await regenerateOne(item);
    if (ok) done++; else failed++;
    console.log(`   진행: ${done + failed}/${todoFiles.length}`);
  }

  console.log(`\n═══ 완료 ═══`);
  console.log(`성공: ${done} | 실패: ${failed}`);

  if (failed === 0) {
    console.log('\n✅ 전체 완료. validate 실행:');
    console.log('   node validate/validate-ans.js --all');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
