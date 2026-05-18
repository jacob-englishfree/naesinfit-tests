#!/usr/bin/env node
/**
 * gen-fixtures.js — 기존 PASS 파일을 base로 각 S급 규칙에 대한 pass.json / fail.json 자동 생성
 *
 * 전략:
 *   - pass.json: 현재 PASS 중인 파일 그대로 복사 (해당 규칙에 걸리지 않음)
 *   - fail.json: 의도적으로 해당 규칙을 위반하도록 특정 field 조작
 *
 * 각 규칙별로 조작 방법을 정의한 dispatcher.
 *
 * Usage: node scripts/gen-fixtures.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const BASE_PASS = path.join(ROOT, 'data', '부교재', '올림포스전국연합고2', '2026', '3강', 'Ex01', '워크북.json');

const base = JSON.parse(fs.readFileSync(BASE_PASS, 'utf8'));

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ── 각 규칙 조작기 ──
const mutators = {
  'S-META-CHOICE': (d) => {
    const q = d.questions.find(q => q.id === 18);
    if (q && q.ch) {
      q.ch[0] = '본문에서 언급된 주요 대상';
      q.ch[1] = '글에서 다루지 않은 부차적인 내용';
    }
    return d;
  },
  'S-ANTONYM-PREFIX': (d) => {
    // mc 어휘 부적절 Q5/Q6 선지에 비실존 un-단어 주입
    const q = d.questions.find(q => q.id === 5);
    if (q && q.type && q.type.includes('어휘') && q.passage) {
      q.passage = q.passage.replace(/①<u>[^<]+<\/u>/, '①<u>unbehavior</u>');
    }
    return d;
  },
  'S-ANTI-CHEESE-GATE': (d) => {
    const q = d.questions.find(q => q.id === 18);
    if (q && q.ch) {
      const ans = q.ans;
      // Keep correct, make 3 wrongs abstract
      const abstracts = ['본문에서 언급된 주요 대상', '글에서 다루지 않은 부차적 요소', '본문과 관련 없는 주장'];
      let j = 0;
      for (let i = 0; i < 4; i++) {
        if (i !== ans - 1) q.ch[i] = abstracts[j++] || q.ch[i];
      }
    }
    return d;
  },
  'S-MULTI-ITEM-WRITTEN': (d) => {
    const q = d.questions.find(q => q.id === 15);
    if (q && q.fmt === 'written') {
      q.stem = "다음 글에서 중요한 세 가지 요소를 본문에서 찾아 쓰시오. (영어로)";
      q.wa = "focus, dedication, and persistence";
    }
    return d;
  },
  'S-DUPLICATE-ITEM': (d) => {
    const q18 = d.questions.find(q => q.id === 18);
    const q19 = d.questions.find(q => q.id === 19);
    if (q18 && q19 && q18.ch && q19.ch) {
      // Make Q19 ch identical to Q18's
      q19.ch = [...q18.ch];
      q19.ans = q18.ans;
    }
    return d;
  },
  'S-DISTRACTOR-ALL-FIRST-SENT': (d) => {
    const q = d.questions.find(q => q.id === 10);
    if (q && q.ch && q.passage) {
      // Get first sentence words and force all distractors to use them
      const firstSent = (q.passage.match(/^[^.!?]+[.!?]/) || [''])[0];
      const words = (firstSent.match(/[a-zA-Z]{5,}/g) || []).slice(0, 3);
      if (words.length >= 3 && q.ans) {
        for (let i = 0; i < 4; i++) {
          if (i !== q.ans - 1) q.ch[i] = words[i % words.length];
        }
      }
    }
    return d;
  },
  'S-WA-IN-PASSAGE': (d) => {
    const q = d.questions.find(q => q.id === 15);
    if (q && q.fmt === 'written' && q.passage) {
      const match = q.passage.match(/\b\w{5,}\b/);
      if (match) q.wa = match[0];
    }
    return d;
  },
  'S-CIRCULAR-STEM': (d) => {
    const q = d.questions.find(q => q.id === 17);
    if (q && q.fmt === 'written' && q.wa) {
      q.stem = `다음 글에서 "${q.wa}"에 해당하는 단어를 찾아 쓰시오. (영어로)`;
    }
    return d;
  },
  'S-WORDCOUNT-MISMATCH': (d) => {
    const q = d.questions.find(q => q.id === 17);
    if (q && q.fmt === 'written') {
      q.stem = q.stem.replace(/\(\d+단어\)/, '') + ' (99단어)';
    }
    return d;
  },
  'S-MISSING-KOREAN': (d) => {
    const q = d.questions.find(q => q.id === 20);
    if (q && q.fmt === 'written') {
      q.stem = "다음 우리말에 맞도록 영작하시오. (영어로)";
    }
    return d;
  },
  'S-LENGTH-BIAS': (d) => {
    const q = d.questions.find(q => q.id === 12);
    if (q && q.ch && q.ans) {
      q.ch[q.ans - 1] = '정답이 매우 길게 설명되어 소거법으로 눈에 띄는 형식의 매우 구체적이고 상세한 선지 설명 내용이 한 줄 가득 채워진 경우';
      const shorts = ['가짜A', '가짜B', '가짜C'];
      let j = 0;
      for (let i = 0; i < 4; i++) {
        if (i !== q.ans - 1) q.ch[i] = shorts[j++];
      }
    }
    return d;
  },
  'S-CH-TRUNCATED': (d) => {
    const q = d.questions.find(q => q.id === 12);
    if (q && q.ch) q.ch[1] = 'unfinished wor';
    return d;
  },
  'S-MISSING-KOREAN': (d) => {
    // 한영 번역 유형에서 한국어 힌트 없이 제시
    const q = d.questions.find(q => q.id === 18);
    if (q && q.fmt === 'written') {
      q.stem = '다음 우리말에 맞도록 영어로 쓰시오.';
      q.wa = 'test answer';
    }
    return d;
  },
  'S-WA-IN-PASSAGE-2': (d) => {
    // 서술형 wa가 passage에 그대로 노출 (찾기 유형 아님)
    const q = d.questions.find(q => q.id === 20);
    if (q && q.fmt === 'written' && q.passage) {
      q.stem = "다음 글을 요약하여 영어로 쓰시오. (영어로) (5단어)";
      q.wa = 'Tactics is a military term';
    }
    return d;
  }
};

let ok = 0, skip = 0;
for (const [rule, mutate] of Object.entries(mutators)) {
  const dir = path.join(FIXTURES, rule);
  fs.mkdirSync(dir, { recursive: true });
  // pass.json — base 그대로
  fs.writeFileSync(path.join(dir, 'pass.json'), JSON.stringify(base, null, 2));
  // fail.json — mutated
  const failed = mutate(clone(base));
  fs.writeFileSync(path.join(dir, 'fail.json'), JSON.stringify(failed, null, 2));
  ok++;
  console.log(`✅ ${rule}`);
}

console.log(`\n━━━ fixtures 생성: ${ok}종 ━━━`);
console.log(`다음: node tests/rules/run.js`);
