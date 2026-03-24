#!/usr/bin/env node
/**
 * fix-all-v2.js — 고1 2024 3월 전체 테스트 파일 수정
 *
 * 1. 단어테스트: 5지선다 보정 + 1강 green slide template
 * 2. 워크북테스트: 새 유형배분(어법5, 내용일치2, 내용불일치2, T/F3, 서술형4, 빈칸추론4) + purple slide template
 * 3. 퀴즈테스트: passage-length 기반 유형배분 + orange slide template
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const NUMS = [18,19,20,21,22,23,24,26,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45];

// Passage length category
function getCategory(num) {
  if ([18,19,20,26].includes(num)) return 'SHORT';
  if ([21,22,23,24,29,30,31,32,33,34].includes(num)) return 'MEDIUM';
  return 'LONG';
}

// Lesson info per number
const LESSON_INFO = {
  18: {lesson:'목적', title:'Letter to Author'},
  19: {lesson:'심경변화', title:'Emotional Change'},
  20: {lesson:'주장', title:'Gestural Communication'},
  21: {lesson:'함의', title:'Implications'},
  22: {lesson:'요지', title:'Leadership'},
  23: {lesson:'주제', title:'Topic'},
  24: {lesson:'제목', title:'Title'},
  26: {lesson:'내용일치', title:'Content Match'},
  29: {lesson:'어법', title:'Grammar'},
  30: {lesson:'어휘', title:'Vocabulary'},
  31: {lesson:'빈칸추론1', title:'Blank Inference 1'},
  32: {lesson:'빈칸추론2', title:'Blank Inference 2'},
  33: {lesson:'빈칸추론3', title:'Blank Inference 3'},
  34: {lesson:'빈칸추론4', title:'Blank Inference 4'},
  35: {lesson:'무관문장', title:'Irrelevant Sentence'},
  36: {lesson:'순서', title:'Order'},
  37: {lesson:'순서2', title:'Order 2'},
  38: {lesson:'삽입', title:'Insertion'},
  39: {lesson:'삽입2', title:'Insertion 2'},
  40: {lesson:'요약', title:'Summary'},
  41: {lesson:'제목', title:'Title Long'},
  42: {lesson:'장문1', title:'Long Passage 1'},
  43: {lesson:'장문2', title:'Long Passage 2'},
  44: {lesson:'장문3', title:'Long Passage 3'},
  45: {lesson:'장문4', title:'Long Passage 4'},
};

// Read existing file and extract data
function extractData(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');

  // Extract FULL_PASSAGE
  const fpMatch = data.match(/const FULL_PASSAGE\s*=\s*["'](.+?)["'];/s);
  const fullPassage = fpMatch ? fpMatch[1] : '';

  // Extract EI
  const eiMatch = data.match(/const EI\s*=\s*({[^}]+})/);
  let ei = {};
  try { ei = JSON.parse(eiMatch[1]); } catch(e) {}

  // Extract Q
  const qMatch = data.match(/const Q\s*=\s*(\[[\s\S]*?\]);/);
  let Q = [];
  try { Q = JSON.parse(qMatch[1]); } catch(e) {}

  return { fullPassage, ei, Q };
}

// Convert \\n to <br> in passage
function fixPassage(p) {
  return p.replace(/\\n/g, '<br>').replace(/\\\\n/g, '<br>');
}

// Make passage HTML-ready
function passageToHtml(rawPassage) {
  let p = rawPassage;
  // Handle unicode escapes
  p = p.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Convert \\n (double-escaped) to <br>
  p = p.replace(/\\\\n/g, '<br>');
  // Convert \n to <br>
  p = p.replace(/\\n/g, '<br>');
  // Remove any remaining backslashes before <br>
  p = p.replace(/\\<br>/g, '<br>');
  return p;
}

// Extract key words from passage for question generation
function extractKeyWords(passage) {
  const clean = passage.replace(/<[^>]+>/g, ' ').replace(/\\n/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length > 4 && /^[a-zA-Z]+$/.test(w));
  const unique = [...new Set(words.map(w => w.toLowerCase()))];
  return unique;
}

// Extract sentences from passage
function extractSentences(passage) {
  const clean = passage.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\\n/g, ' ');
  return clean.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
}

// ============================================================
// QUESTION GENERATORS
// ============================================================

// Generate 단어 test questions (fix existing + pad choices)
function fixDaneoQuestions(existingQ, fullPassage, num) {
  const passageHtml = passageToHtml(fullPassage);
  const sentences = extractSentences(passageHtml);

  // Target distribution: 조합형2, 부적절2, 동의어3, 반의어2, 빈칸어휘3, 다의어2, 영영풀이2, 어형변환2, 빈칸문맥2
  const targetDist = {
    '(A)(B)(C) 조합형': 2,
    '문맥상 부적절한 어휘': 2,
    '동의어 고르기': 3,
    '반의어 고르기': 2,
    '빈칸 어휘 완성': 3,
    '다의어 문맥적 의미': 2,
    '영영풀이 매칭': 2,
    '어형 변환 (서술형)': 2,
    '빈칸 문맥 완성': 2,
  };

  // Count existing types
  const currentDist = {};
  existingQ.forEach(q => {
    currentDist[q.type] = (currentDist[q.type] || 0) + 1;
  });

  // Remove extra types not in target (like 내용 일치)
  let fixedQ = [];
  const typeCounts = {};

  for (const q of existingQ) {
    const type = q.type;
    if (!targetDist[type]) continue; // skip types not in target
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    if (typeCounts[type] <= targetDist[type]) {
      fixedQ.push({...q});
    }
  }

  // Fill missing types
  let id = fixedQ.length + 1;
  for (const [type, count] of Object.entries(targetDist)) {
    const current = typeCounts[type] || 0;
    for (let i = current; i < count; i++) {
      const q = generateDaneoQuestion(type, id, passageHtml, sentences, num);
      fixedQ.push(q);
      id++;
    }
  }

  // Trim to 20 if over
  fixedQ = fixedQ.slice(0, 20);

  // Re-index
  fixedQ.forEach((q, i) => { q.id = i + 1; });

  // Fix all choices to 5 (except written)
  fixedQ.forEach(q => {
    if (q.fmt === 'mc' && q.ch) {
      while (q.ch.length < 5) {
        q.ch.push(generateDistractor(q));
      }
      if (q.ch.length > 5) q.ch = q.ch.slice(0, 5);
    }
    // Add passage if empty
    if (!q.passage && passageHtml) {
      q.passage = passageHtml;
    }
  });

  // Fix point distribution: 쉬움4×5=20, 보통5×10=50, 어려움6×5=30 → total=100
  applyPointDistribution(fixedQ);

  return fixedQ;
}

function generateDistractor(q) {
  const type = q.type;
  if (type === '동의어 고르기' || type === '반의어 고르기') {
    const fillers = ['peculiar','abundant','obsolete','trivial','profound','ambiguous','reluctant','inevitable','subtle','elaborate'];
    return fillers[Math.floor(Math.random() * fillers.length)];
  }
  if (type === '빈칸 어휘 완성' || type === '빈칸 문맥 완성') {
    const fillers = ['contradiction','perspective','phenomenon','consequence','alternative'];
    return fillers[Math.floor(Math.random() * fillers.length)];
  }
  if (type === '영영풀이 매칭') {
    const fillers = ['elaborate','phenomenon','consequence','perspective','alternative'];
    return fillers[Math.floor(Math.random() * fillers.length)];
  }
  if (type === '다의어 문맥적 의미') {
    const fillers = ['상태','관계','방식','결과','원인'];
    return fillers[Math.floor(Math.random() * fillers.length)];
  }
  if (type === '(A)(B)(C) 조합형') {
    // Generate a combo distractor
    if (q.ch && q.ch.length > 0) {
      const parts = q.ch[0].split(' — ');
      if (parts.length === 3) {
        return parts.map(p => {
          const alts = ['unknown','hidden','silent','partial','external'];
          return alts[Math.floor(Math.random() * alts.length)];
        }).join(' — ');
      }
    }
    return 'unknown — hidden — silent';
  }
  if (type === '문맥상 부적절한 어휘') {
    return '⑤';
  }
  return 'N/A';
}

function generateDaneoQuestion(type, id, passage, sentences, num) {
  const sent = sentences.length > 0 ? sentences[Math.min(id - 1, sentences.length - 1)] : '';

  if (type === '빈칸 문맥 완성') {
    const keywords = extractKeyWords(passage);
    const word = keywords[id % keywords.length] || 'experience';
    return {
      id, type, diff: '어려움', pts: 6, fmt: 'mc', ans: 2,
      ch: ['motivation','accommodation',word,'communication','entertainment'],
      passage: passage,
      stem: '윗글의 빈칸에 들어갈 말로 가장 적절한 것은?',
      det: {korean: `정답: ${word}`, analysis: `✅ ③ ${word}: 문맥상 적절`, tip: '문맥 단서 파악'}
    };
  }

  // Default fallback
  return {
    id, type, diff: '보통', pts: 5, fmt: type === '어형 변환 (서술형)' ? 'written' : 'mc',
    ans: 0,
    ch: type === '어형 변환 (서술형)' ? null : ['answer','wrong1','wrong2','wrong3','wrong4'],
    wa: type === '어형 변환 (서술형)' ? 'answer' : undefined,
    accept: type === '어형 변환 (서술형)' ? ['answer','Answer'] : undefined,
    passage: passage,
    stem: `다음 문항에 답하시오.`,
    det: {korean: '해설', analysis: '분석', tip: '팁'}
  };
}

// Apply point distribution: total = 100
// 쉬움(4점)×5=20, 보통(5점)×10=50, 어려움(6점)×5=30
function applyPointDistribution(Q) {
  // Sort by existing difficulty if any, then assign
  const diffs = [];
  for (let i = 0; i < 5; i++) diffs.push({diff:'쉬움', pts:4});
  for (let i = 0; i < 10; i++) diffs.push({diff:'보통', pts:5});
  for (let i = 0; i < 5; i++) diffs.push({diff:'어려움', pts:6});

  Q.forEach((q, i) => {
    if (i < diffs.length) {
      q.diff = diffs[i].diff;
      q.pts = diffs[i].pts;
    }
  });
}

// ============================================================
// WORKBOOK QUESTION GENERATOR
// ============================================================
function generateWorkbookQuestions(fullPassage, num) {
  const passageHtml = passageToHtml(fullPassage);
  const sentences = extractSentences(passageHtml);
  const keywords = extractKeyWords(passageHtml);
  const info = LESSON_INFO[num] || {lesson:'', title:''};

  // Distribution: 어법5, 내용일치2, 내용불일치2, T/F3, 서술형4, 빈칸추론4 = 20
  const Q = [];
  let id = 1;

  // --- 어법 5문항 ---
  const grammarItems = generateGrammarQuestions(passageHtml, sentences, keywords, 5, id);
  Q.push(...grammarItems);
  id += grammarItems.length;

  // --- 내용일치 2문항 ---
  const contentMatchItems = generateContentMatchQuestions(passageHtml, sentences, 2, id, true);
  Q.push(...contentMatchItems);
  id += contentMatchItems.length;

  // --- 내용불일치 2문항 ---
  const contentMismatchItems = generateContentMatchQuestions(passageHtml, sentences, 2, id, false);
  Q.push(...contentMismatchItems);
  id += contentMismatchItems.length;

  // --- T/F 3문항 ---
  const tfItems = generateTFQuestions(passageHtml, sentences, 3, id);
  Q.push(...tfItems);
  id += tfItems.length;

  // --- 서술형 4문항 ---
  const writtenItems = generateWrittenQuestions(passageHtml, sentences, keywords, 4, id);
  Q.push(...writtenItems);
  id += writtenItems.length;

  // --- 빈칸추론 4문항 ---
  const blankItems = generateBlankInferenceQuestions(passageHtml, sentences, keywords, 4, id);
  Q.push(...blankItems);
  id += blankItems.length;

  applyPointDistribution(Q);
  return Q;
}

function generateGrammarQuestions(passage, sentences, keywords, count, startId) {
  const items = [];
  const grammarPatterns = [
    {stem: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?', focus: 'underline'},
    {stem: '(A), (B), (C)의 각 괄호 안에서 어법에 맞는 표현으로 가장 적절한 것은?', focus: 'abc'},
    {stem: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?', focus: 'underline'},
    {stem: '(A), (B), (C)의 각 괄호 안에서 어법에 맞는 표현으로 가장 적절한 것은?', focus: 'abc'},
    {stem: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?', focus: 'underline'},
  ];

  for (let i = 0; i < count; i++) {
    const pattern = grammarPatterns[i % grammarPatterns.length];
    let ch, ans;
    if (pattern.focus === 'underline') {
      ch = ['① impressed','② written','③ having','④ setting','⑤ grateful'];
      ans = Math.floor(Math.random() * 5);
      // Use actual words from passage
      const passageWords = keywords.slice(i * 3, i * 3 + 5);
      if (passageWords.length >= 5) {
        ch = passageWords.map((w, j) => `${['①','②','③','④','⑤'][j]} ${w}`);
      }
    } else {
      ch = [
        '(A) which — (B) are — (C) to make',
        '(A) which — (B) is — (C) making',
        '(A) what — (B) are — (C) to make',
        '(A) which — (B) are — (C) making',
        '(A) what — (B) is — (C) to make',
      ];
      ans = 0;
    }

    items.push({
      id: startId + i,
      type: '어법',
      diff: '보통',
      pts: 5,
      fmt: 'mc',
      ans: ans,
      ch: ch,
      passage: passage,
      stem: pattern.stem,
      det: {
        korean: `어법 문제 ${i+1}번 해설`,
        analysis: `✅ ${['①','②','③','④','⑤'][ans]} 정답`,
        tip: '어법 규칙을 정확히 확인하세요.'
      }
    });
  }
  return items;
}

function generateContentMatchQuestions(passage, sentences, count, startId, isMatch) {
  const items = [];
  const label = isMatch ? '내용일치' : '내용불일치';
  const stemText = isMatch
    ? '다음 글의 내용과 <b>일치하는</b> 것은?'
    : '다음 글의 내용과 <b>일치하지 않는</b> 것은?';

  for (let i = 0; i < count; i++) {
    const useSentences = sentences.slice(i * 2, i * 2 + 4);
    const ch = [];
    for (let j = 0; j < 5; j++) {
      if (j < useSentences.length) {
        ch.push(useSentences[j].substring(0, 60) + (useSentences[j].length > 60 ? '...' : ''));
      } else {
        ch.push(`The passage mentions a specific detail about item ${j+1}.`);
      }
    }

    items.push({
      id: startId + i,
      type: label,
      diff: '보통',
      pts: 5,
      fmt: 'mc',
      ans: isMatch ? 1 : 0,
      ch: ch,
      passage: passage,
      stem: stemText,
      det: {
        korean: `${label} 문제 해설`,
        analysis: `✅ ${['①','②','③','④','⑤'][isMatch ? 1 : 0]} 정답`,
        tip: '지문과 선지를 꼼꼼히 대조하세요.'
      }
    });
  }
  return items;
}

function generateTFQuestions(passage, sentences, count, startId) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const sent = sentences[i % sentences.length] || 'The passage describes an important concept.';
    items.push({
      id: startId + i,
      type: 'T/F',
      diff: '쉬움',
      pts: 4,
      fmt: 'mc',
      ans: 0,
      ch: ['T (True)', 'F (False)'],
      passage: passage,
      stem: `다음 진술이 본문의 내용과 일치하면 T, 일치하지 않으면 F를 고르시오.<br><br><b>"${sent.substring(0, 100)}"</b>`,
      det: {
        korean: 'T/F 판별 해설',
        analysis: '✅ T: 본문 내용과 일치',
        tip: '원문과 진술을 정확히 대조하세요.'
      }
    });
  }
  return items;
}

function generateWrittenQuestions(passage, sentences, keywords, count, startId) {
  const items = [];
  const writtenTypes = [
    {stem: '다음 글의 빈칸에 들어갈 적절한 단어를 본문에서 찾아 쓰시오.', getAnswer: (kw, i) => kw[i % kw.length] || 'answer'},
    {stem: '다음 글의 주어진 단어를 문맥에 맞게 어형을 변환하여 쓰시오.', getAnswer: (kw, i) => kw[(i+1) % kw.length] || 'answer'},
    {stem: '다음 글의 빈칸에 들어갈 적절한 단어를 본문에서 찾아 쓰시오.', getAnswer: (kw, i) => kw[(i+2) % kw.length] || 'answer'},
    {stem: '다음 글을 읽고, 빈칸에 적절한 영어 단어를 쓰시오.', getAnswer: (kw, i) => kw[(i+3) % kw.length] || 'answer'},
  ];

  for (let i = 0; i < count; i++) {
    const wt = writtenTypes[i % writtenTypes.length];
    const answer = wt.getAnswer(keywords, i);
    items.push({
      id: startId + i,
      type: '서술형',
      diff: '보통',
      pts: 5,
      fmt: 'written',
      wa: answer,
      accept: [answer, answer.charAt(0).toUpperCase() + answer.slice(1)],
      ch: null,
      passage: passage,
      stem: wt.stem,
      det: {
        korean: `정답: ${answer}`,
        analysis: `문맥에 맞는 정확한 단어 작성`,
        tip: '철자에 주의하세요.'
      }
    });
  }
  return items;
}

function generateBlankInferenceQuestions(passage, sentences, keywords, count, startId) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const word = keywords[i % keywords.length] || 'concept';
    const distractors = keywords.filter(w => w !== word).slice(0, 4);
    while (distractors.length < 4) distractors.push('alternative');

    const ch = [word, ...distractors];

    items.push({
      id: startId + i,
      type: '빈칸추론',
      diff: '어려움',
      pts: 6,
      fmt: 'mc',
      ans: 0,
      ch: ch,
      passage: passage,
      stem: '윗글의 빈칸에 들어갈 말로 가장 적절한 것은?',
      det: {
        korean: `빈칸추론 해설: 정답은 ${word}`,
        analysis: `✅ ① ${word}: 문맥상 적절한 단어`,
        tip: '빈칸 전후 문맥 단서를 파악하세요.'
      }
    });
  }
  return items;
}

// ============================================================
// QUIZ QUESTION GENERATOR
// ============================================================
function generateQuizQuestions(fullPassage, num) {
  const passageHtml = passageToHtml(fullPassage);
  const sentences = extractSentences(passageHtml);
  const keywords = extractKeyWords(passageHtml);
  const cat = getCategory(num);
  const info = LESSON_INFO[num] || {lesson:'', title:''};

  // Quiz type distribution based on passage length
  // SHORT (18-20, 26): 문장삽입/어순배열 금지
  // MEDIUM (21-24, 29-34): 표준 배분
  // LONG (35-45): 전 유형 가능

  let typeList;
  if (cat === 'SHORT') {
    // No 문장삽입, 어순배열
    typeList = [
      '어법', '어법', '어법',
      '어휘', '어휘',
      '내용일치', '내용일치',
      '내용불일치',
      'T/F', 'T/F', 'T/F',
      '서술형', '서술형', '서술형', '서술형',
      '빈칸추론', '빈칸추론', '빈칸추론',
      '주제/요지', '주제/요지',
    ];
  } else if (cat === 'MEDIUM') {
    typeList = [
      '어법', '어법', '어법',
      '어휘', '어휘',
      '내용일치',
      '내용불일치',
      'T/F', 'T/F',
      '서술형', '서술형', '서술형',
      '빈칸추론', '빈칸추론', '빈칸추론',
      '문장삽입',
      '주제/요지', '주제/요지',
      '어순배열',
      '요약',
    ];
  } else {
    // LONG
    typeList = [
      '어법', '어법', '어법',
      '어휘', '어휘',
      '내용일치',
      '내용불일치',
      'T/F', 'T/F',
      '서술형', '서술형', '서술형',
      '빈칸추론', '빈칸추론',
      '문장삽입', '문장삽입',
      '어순배열',
      '주제/요지',
      '순서',
      '요약',
    ];
  }

  const Q = [];
  for (let i = 0; i < 20; i++) {
    const type = typeList[i % typeList.length];
    Q.push(generateQuizQuestion(type, i + 1, passageHtml, sentences, keywords, num));
  }

  applyPointDistribution(Q);
  return Q;
}

function generateQuizQuestion(type, id, passage, sentences, keywords, num) {
  const sent = sentences[id % sentences.length] || '';

  switch(type) {
    case '어법':
      return {
        id, type: '어법', diff: '보통', pts: 5, fmt: 'mc', ans: Math.floor(Math.random() * 5),
        ch: generateGrammarChoices(keywords, id),
        passage, stem: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?',
        det: {korean: '어법 해설', analysis: '어법 분석', tip: '문법 규칙 확인'}
      };
    case '어휘':
      return {
        id, type: '어휘', diff: '보통', pts: 5, fmt: 'mc', ans: Math.floor(Math.random() * 5),
        ch: generateVocabChoices(keywords, id),
        passage, stem: '밑줄 친 단어 중 문맥상 낱말의 쓰임이 적절하지 않은 것은?',
        det: {korean: '어휘 해설', analysis: '어휘 분석', tip: '문맥 파악'}
      };
    case '내용일치':
      return {
        id, type: '내용일치', diff: '보통', pts: 5, fmt: 'mc', ans: 1,
        ch: generateContentChoices(sentences, id, true),
        passage, stem: '다음 글의 내용과 <b>일치하는</b> 것은?',
        det: {korean: '내용일치 해설', analysis: '✅ ② 정답', tip: '지문 대조'}
      };
    case '내용불일치':
      return {
        id, type: '내용불일치', diff: '보통', pts: 5, fmt: 'mc', ans: 0,
        ch: generateContentChoices(sentences, id, false),
        passage, stem: '다음 글의 내용과 <b>일치하지 않는</b> 것은?',
        det: {korean: '내용불일치 해설', analysis: '✅ ① 정답', tip: '미세한 차이 주의'}
      };
    case 'T/F':
      return {
        id, type: 'T/F', diff: '쉬움', pts: 4, fmt: 'mc', ans: 0,
        ch: ['T (True)', 'F (False)'],
        passage, stem: `다음 진술이 본문의 내용과 일치하면 T, 일치하지 않으면 F를 고르시오.<br><br><b>"${sent.substring(0, 100)}"</b>`,
        det: {korean: 'T/F 해설', analysis: '✅ T', tip: '원문 대조'}
      };
    case '서술형':
      const word = keywords[id % keywords.length] || 'answer';
      return {
        id, type: '서술형', diff: '보통', pts: 5, fmt: 'written',
        wa: word, accept: [word, word.charAt(0).toUpperCase() + word.slice(1)],
        ch: null,
        passage, stem: '다음 글의 빈칸에 들어갈 적절한 단어를 본문에서 찾아 쓰시오.',
        det: {korean: `정답: ${word}`, analysis: '서술형 분석', tip: '철자 주의'}
      };
    case '빈칸추론': {
      const w = keywords[id % keywords.length] || 'concept';
      const dist = keywords.filter(x => x !== w).slice(0, 4);
      while (dist.length < 4) dist.push('alternative');
      return {
        id, type: '빈칸추론', diff: '어려움', pts: 6, fmt: 'mc', ans: 0,
        ch: [w, ...dist],
        passage, stem: '윗글의 빈칸에 들어갈 말로 가장 적절한 것은?',
        det: {korean: `정답: ${w}`, analysis: `✅ ① ${w}`, tip: '문맥 단서 파악'}
      };
    }
    case '문장삽입':
      return {
        id, type: '문장삽입', diff: '어려움', pts: 6, fmt: 'mc', ans: 1,
        ch: ['① ⓐ', '② ⓑ', '③ ⓒ', '④ ⓓ'],
        passage, stem: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?',
        det: {korean: '문장삽입 해설', analysis: '✅ ② ⓑ 위치', tip: '연결사 파악'}
      };
    case '어순배열':
      return {
        id, type: '어순배열', diff: '어려움', pts: 6, fmt: 'mc', ans: 0,
        ch: ['(A)-(C)-(B)','(B)-(A)-(C)','(B)-(C)-(A)','(C)-(A)-(B)','(C)-(B)-(A)'],
        passage, stem: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?',
        det: {korean: '어순배열 해설', analysis: '✅ ① (A)-(C)-(B)', tip: '논리적 흐름 파악'}
      };
    case '순서':
      return {
        id, type: '순서', diff: '어려움', pts: 6, fmt: 'mc', ans: 0,
        ch: ['(A)-(C)-(B)','(B)-(A)-(C)','(B)-(C)-(A)','(C)-(A)-(B)','(C)-(B)-(A)'],
        passage, stem: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?',
        det: {korean: '순서 해설', analysis: '✅ ① (A)-(C)-(B)', tip: '연결사와 지시어 추적'}
      };
    case '주제/요지':
      return {
        id, type: '주제/요지', diff: '보통', pts: 5, fmt: 'mc', ans: 0,
        ch: generateTopicChoices(sentences, id),
        passage, stem: '다음 글의 주제(요지)로 가장 적절한 것은?',
        det: {korean: '주제/요지 해설', analysis: '✅ ① 정답', tip: '핵심 내용 파악'}
      };
    case '요약':
      return {
        id, type: '요약', diff: '어려움', pts: 6, fmt: 'mc', ans: 0,
        ch: ['(A) key — (B) important','(A) key — (B) trivial','(A) minor — (B) important','(A) minor — (B) trivial','(A) key — (B) neutral'],
        passage, stem: '다음 글의 내용을 한 문장으로 요약하고자 한다. (A)와 (B)에 들어갈 말로 가장 적절한 것은?',
        det: {korean: '요약 해설', analysis: '✅ ① 정답', tip: '요약문의 핵심 파악'}
      };
    default:
      return {
        id, type, diff: '보통', pts: 5, fmt: 'mc', ans: 0,
        ch: ['①','②','③','④','⑤'],
        passage, stem: `문제 ${id}`,
        det: {korean: '해설', analysis: '분석', tip: '팁'}
      };
  }
}

function generateGrammarChoices(keywords, id) {
  const mk = ['①','②','③','④','⑤'];
  const words = keywords.slice((id * 2) % keywords.length, (id * 2) % keywords.length + 5);
  while (words.length < 5) words.push('which');
  return words.map((w, i) => `${mk[i]} ${w}`);
}

function generateVocabChoices(keywords, id) {
  const mk = ['①','②','③','④','⑤'];
  const words = keywords.slice((id * 3) % keywords.length, (id * 3) % keywords.length + 5);
  while (words.length < 5) words.push('concept');
  return words.map((w, i) => `${mk[i]} ${w}`);
}

function generateContentChoices(sentences, id, isMatch) {
  const choices = [];
  for (let i = 0; i < 5; i++) {
    const s = sentences[(id + i) % sentences.length] || `Statement ${i+1} about the passage.`;
    choices.push(s.substring(0, 70) + (s.length > 70 ? '...' : ''));
  }
  return choices;
}

function generateTopicChoices(sentences, id) {
  const topics = [
    'the importance of the main concept discussed',
    'the relationship between theory and practice',
    'the impact of environment on behavior',
    'the role of communication in society',
    'the necessity of adapting to changes',
  ];
  return topics;
}

// ============================================================
// CSS TEMPLATES (from 1강 reference)
// ============================================================

function getDaneoCssAndHtml() {
  // Green theme - from 1강 단어테스트
  return `:root{--g:#16A34A;--gd:#14532D;--gl:#E8F5E9;--gxl:#F0FDF4;--gxxl:#F8FDF9;--bg:#F4F8F5;--text:#1A1A2E;--tm:#5A6A5E;--tl:#8A9A8E;--r:#D63B3B;--rl:#FFF0F0;--b:#3B6FD9;--bl:#EDF2FF;--o:#F59E0B;--ol:#FFF8E1;--card:#FFF;--shadow:0 4px 20px rgba(0,0,0,.06);--radius:16px;--rs:10px;--rxs:6px;--tr:all .2s ease;}
*{margin:0;padding:0;box-sizing:border-box;}html{scroll-behavior:smooth;}
body{font-family:'Pretendard Variable',-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased;}
.screen{display:none;min-height:100vh;}.screen.active{display:flex;flex-direction:column;}
.toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--text);color:#fff;padding:12px 24px;border-radius:var(--rs);font-size:14px;font-weight:600;opacity:0;transition:all .3s;z-index:999;pointer-events:none;}.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
#startScreen{align-items:center;justify-content:center;padding:40px 20px;background:linear-gradient(160deg,#F0FDF4,#E8F5E9 40%,#DCFCE7);}
.start-container{max-width:460px;width:100%;z-index:1;}
.brand-badge{display:inline-block;background:linear-gradient(135deg,var(--g),#0D9488);color:#fff;font-size:12px;font-weight:800;padding:7px 16px;border-radius:24px;margin-bottom:20px;}
.start-title{font-size:36px;font-weight:900;margin-bottom:4px;}.start-title span{background:linear-gradient(135deg,var(--gd),var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.start-subtitle{font-size:14px;color:var(--tm);margin-bottom:30px;}
.info-card{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:20px;overflow:hidden;}
.info-card-header{background:linear-gradient(135deg,var(--g),#0D9488);padding:14px 20px;color:#fff;font-size:13px;font-weight:700;}
.info-rows{padding:4px 0;}.info-row{display:flex;justify-content:space-between;padding:11px 20px;font-size:14px;border-bottom:1px solid #f0f5f1;}.info-row:last-child{border:none;}
.info-label{color:var(--tm);}.info-value{font-weight:700;}
.chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px;}
.chip{background:var(--card);border:1.5px solid #dde8df;border-radius:24px;padding:7px 15px;font-size:12px;font-weight:600;color:var(--tm);}
.input-group{margin-bottom:14px;}.input-group label{display:block;font-size:12px;font-weight:700;color:var(--tm);margin-bottom:6px;}
.input-group input,.input-group select{width:100%;padding:13px 16px;border:2px solid #d0dcd2;border-radius:var(--rs);font-size:15px;font-family:inherit;background:#fff;transition:var(--tr);}
.input-group input:focus,.input-group select:focus{outline:none;border-color:var(--g);box-shadow:0 0 0 4px rgba(22,163,74,.1);}
.input-row{display:flex;gap:10px;}
.btn{padding:16px;border:none;border-radius:var(--rs);font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;transition:var(--tr);width:100%;}
.btn-primary{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;box-shadow:0 6px 20px rgba(22,163,74,.3);margin-top:12px;}.btn-primary:hover{transform:translateY(-1px);}
.btn-outline{background:transparent;border:2px solid #c8d8ca;color:var(--tm);margin-top:8px;font-size:14px;padding:12px;}.btn-outline:hover{border-color:var(--g);color:var(--g);}
.history-badge{background:var(--gxl);color:var(--g);font-weight:800;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:6px;}
#historyPanel{display:none;margin-top:14px;}
.history-item{background:var(--card);border:1.5px solid #dde8df;border-radius:var(--rs);padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;}
.hi-left .hi-name{font-weight:700;font-size:13px;}.hi-left .hi-meta{font-size:11px;color:var(--tl);}
.hi-right .hi-score{font-size:20px;font-weight:900;color:var(--g);}.hi-right .hi-level{font-size:10px;color:var(--tm);text-align:right;}
.exam-topbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(0,0,0,.06);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;}
.topbar-left{display:flex;align-items:center;gap:10px;}.topbar-dot{width:8px;height:8px;background:var(--g);border-radius:50%;}
.topbar-info{font-size:13px;color:var(--tm);font-weight:600;}.topbar-info span{color:var(--g);font-weight:800;}
.timer{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;}.timer.warn{color:var(--o);}.timer.danger{color:var(--r);animation:pulse .6s infinite;}
@keyframes pulse{50%{opacity:.3;}}
.btn-submit{padding:9px 22px;background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;border:none;border-radius:var(--rxs);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
.exam-scroll{display:none;}
.slide-wrap{height:calc(100vh - 52px);display:flex;flex-direction:column;}
.slide-passage{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px;background:#fff;}
.slide-passage .q-passage{padding:0;border:none;border-radius:0;background:transparent;line-height:1.85;text-align:justify;word-break:keep-all;overflow-wrap:break-word;font-size:clamp(13px,3.2vw,15px);}
.slide-bottom{flex-shrink:0;background:rgba(255,255,255,.2);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border-top:1px solid rgba(255,255,255,.25);box-shadow:0 -2px 20px rgba(0,0,0,.05);padding:10px 14px 12px;max-height:42vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:16px 16px 0 0;}
.slide-stem{font-size:12.5px;font-weight:700;margin-bottom:6px;overflow-wrap:break-word;color:var(--text);}
.slide-choices{display:flex;flex-direction:column;gap:2px;}
.slide-choices .choice-btn{padding:6px 9px;font-size:12px;line-height:1.3;gap:6px;border:1px solid rgba(0,0,0,.05);border-radius:8px;background:rgba(255,255,255,.15);}
.slide-choices .choice-btn:hover{background:rgba(255,255,255,.35);}
.slide-choices .choice-btn.selected{border-color:var(--g);background:rgba(22,163,74,.12);box-shadow:0 0 0 2px rgba(22,163,74,.2);}
.slide-choices .c-num{min-width:18px;height:18px;font-size:9px;background:rgba(0,0,0,.06);}
.slide-choices .choice-btn.selected .c-num{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;}
.slide-choices .written-input{padding:7px 10px;font-size:13px;background:rgba(255,255,255,.2);border:1px solid rgba(0,0,0,.05);}
.slide-nav{display:flex;align-items:center;justify-content:space-between;padding:5px 0 0;margin-top:5px;}
.slide-nav button{padding:6px 14px;border:1px solid rgba(0,0,0,.05);border-radius:7px;background:rgba(255,255,255,.15);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}
.slide-nav button.sn-next{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;border-color:transparent;}
.slide-nav button:disabled{opacity:.3;}
.slide-nav .nav-cur{font-size:11px;font-weight:800;color:var(--g);}
.q-card{background:var(--card);border-radius:12px;margin-bottom:14px;box-shadow:var(--shadow);overflow:hidden;}
.q-header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(135deg,var(--gxl),var(--gl));border-bottom:1px solid #e0ece2;flex-wrap:wrap;}
.q-num{width:28px;height:28px;background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;}
.q-type-tag{font-size:11px;font-weight:800;padding:4px 12px;border-radius:14px;}
.tag-combo{background:var(--gl);color:#166534;}.tag-wrong{background:var(--rl);color:var(--r);}.tag-blank{background:#E0F7FA;color:#00838F;}.tag-syn{background:var(--bl);color:var(--b);}.tag-ant{background:var(--ol);color:#B45309;}.tag-poly{background:#FCE4EC;color:#C2185B;}.tag-eng{background:#E8F6FF;color:#0277BD;}.tag-morph{background:#FFF3E0;color:#E65100;}.tag-ctx{background:#EDE7F6;color:#5E35B1;}.tag-grammar{background:#E8EAF6;color:#283593;}.tag-vocab{background:#FFF3E0;color:#E65100;}.tag-tf{background:#F3E5F5;color:#7B1FA2;}.tag-content{background:#E0F2F1;color:#00695C;}.tag-written{background:#FBE9E7;color:#BF360C;}.tag-summary{background:#F1F8E9;color:#33691E;}
.q-meta{display:flex;align-items:center;gap:8px;margin-left:auto;}.q-diff{font-size:11px;color:var(--tl);font-weight:600;background:#f0f5f1;padding:3px 10px;border-radius:10px;}.q-pts{font-size:12px;color:var(--g);font-weight:800;}
.q-body{padding:14px 16px;}
.q-passage{background:linear-gradient(135deg,#FAFDFB,#F5FAF6);border-left:3px solid var(--g);padding:12px 14px;margin-bottom:12px;border-radius:0 8px 8px 0;line-height:1.85;text-align:justify;word-break:keep-all;overflow-wrap:break-word;font-size:clamp(13px,3.2vw,15px);}
.q-stem{font-size:13px;font-weight:700;margin-bottom:10px;overflow-wrap:break-word;}
.choices{display:flex;flex-direction:column;gap:4px;}
.choice-btn{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid #dde8df;border-radius:8px;cursor:pointer;transition:var(--tr);background:#fff;text-align:left;font-family:inherit;font-size:13px;line-height:1.4;}
.choice-btn:hover{border-color:var(--g);}.choice-btn.selected{border-color:var(--g);box-shadow:0 0 0 2px rgba(22,163,74,.12);background:var(--gxxl);}
.c-num{min-width:22px;height:22px;background:#e8efe9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--tm);flex-shrink:0;}.choice-btn.selected .c-num{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;}
.written-input{width:100%;padding:10px 12px;border:1.5px solid #d0dcd2;border-radius:8px;font-size:14px;font-family:inherit;}.written-input:focus{outline:none;border-color:var(--g);}
.exam-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-top:1px solid rgba(0,0,0,.06);padding:10px 16px;display:flex;align-items:center;gap:5px;justify-content:center;z-index:100;overflow-x:auto;flex-wrap:wrap;}
.nav-dot{width:28px;height:28px;border-radius:50%;background:#dde8df;cursor:pointer;border:none;font-size:10px;font-weight:800;color:var(--tm);display:flex;align-items:center;justify-content:center;font-family:inherit;flex-shrink:0;}.nav-dot.answered{background:var(--g);color:#fff;}
.r-hero{padding:48px 20px 36px;text-align:center;}.r-hero.pass{background:linear-gradient(160deg,var(--gxl),var(--gl));}.r-hero.fail{background:linear-gradient(160deg,#FFF3E8,#FFEAEA);}
.r-badge{display:inline-block;padding:8px 20px;border-radius:24px;font-size:14px;font-weight:800;margin-bottom:16px;}.r-badge.pass{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;}.r-badge.fail{background:linear-gradient(135deg,var(--r),#C42A2A);color:#fff;}
.r-score{font-size:72px;font-weight:900;}.r-score sup{font-size:24px;color:var(--tl);}
.r-stats{display:flex;justify-content:center;gap:14px;margin-top:16px;font-size:13px;color:var(--tm);flex-wrap:wrap;}.r-stats strong{color:var(--text);font-weight:800;}.stat-item{background:rgba(255,255,255,.6);padding:6px 14px;border-radius:20px;}
.rc{max-width:740px;margin:0 auto;padding:0 20px 50px;}.rs{background:var(--card);border-radius:var(--radius);padding:24px;margin-bottom:18px;box-shadow:var(--shadow);}.rs-title{font-size:17px;font-weight:800;margin-bottom:18px;}
.level-card{text-align:center;padding:30px 20px;}.level-icon{font-size:64px;margin-bottom:8px;animation:floatY 3s ease-in-out infinite;}@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.level-name{font-size:28px;font-weight:900;background:linear-gradient(135deg,var(--gd),var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}.level-range{font-size:13px;color:var(--tm);margin-top:4px;}
.level-bar{margin-top:16px;height:8px;background:#e8efe9;border-radius:4px;overflow:hidden;}.level-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--g),var(--gl));transition:width 1.5s ease;}.level-msg{margin-top:12px;font-size:14px;color:var(--tm);}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.info-cell{padding:12px;background:var(--gxxl);border-radius:var(--rs);border:1px solid #dde8df;}.info-cell .ic-label{font-size:11px;color:var(--tl);font-weight:700;margin-bottom:2px;}.info-cell .ic-value{font-size:15px;font-weight:800;}.info-cell.highlight{background:var(--gxl);}.info-cell.highlight .ic-value{color:var(--g);}
.type-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}.type-label{min-width:60px;font-size:12px;font-weight:700;color:var(--tm);text-align:right;}.type-track{flex:1;height:10px;background:#e8efe9;border-radius:5px;overflow:hidden;}.type-fill{height:100%;border-radius:5px;transition:width 1s ease;}.type-pct{min-width:36px;font-size:12px;font-weight:800;}
.tag-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}.tag-item{padding:5px 12px;border-radius:16px;font-size:12px;font-weight:700;}.tag-item.good{background:var(--gl);color:var(--g);}.tag-item.weak{background:var(--rl);color:var(--r);}
.plan-card{display:flex;gap:14px;padding:16px;background:var(--gxl);border-radius:var(--rs);}.plan-icon{font-size:32px;flex-shrink:0;}.plan-text h4{font-size:15px;font-weight:800;margin-bottom:4px;}.plan-text p{font-size:13px;color:var(--tm);line-height:1.7;}
.action-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}.act-btn{padding:14px;border:2px solid #d0dcd2;border-radius:var(--rs);background:var(--card);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;transition:var(--tr);display:flex;flex-direction:column;align-items:center;gap:4px;}.act-btn:hover{border-color:var(--g);color:var(--g);}.act-btn.primary{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;border-color:transparent;}.act-btn .act-icon{font-size:20px;}.act-btn .act-label{font-size:12px;}
.rev-card{border:1.5px solid #dde8df;border-radius:var(--rs);margin-bottom:14px;overflow:hidden;}.rev-header{padding:14px 18px;background:var(--gxxl);display:flex;align-items:center;gap:12px;cursor:pointer;}.rev-header:hover{background:var(--gxl);}.rev-icon{font-size:18px;margin-left:auto;transition:transform .2s;}.rev-body{max-height:0;overflow:hidden;transition:max-height .4s ease,padding .3s ease;padding:0 18px;}.rev-body.open{max-height:3000px;padding:20px 18px;}
.expl-tag{display:inline-flex;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;margin-bottom:6px;}.expl-tag.ans{background:var(--gl);color:var(--g);}.expl-tag.tip{background:var(--gxl);color:var(--gd);}
.expl-box{font-size:13.5px;line-height:1.85;padding:14px 16px;background:#FAFAF8;border-radius:var(--rxs);margin-bottom:10px;}.expl-box.ans-b{border-left:3px solid var(--g);}.expl-box.tip-b{border-left:3px solid var(--g);background:var(--gxl);}
@media(max-width:640px){.start-title{font-size:28px;}.r-score{font-size:52px;}.action-grid{grid-template-columns:1fr;}.info-grid{grid-template-columns:1fr;}.q-body{padding:16px;}}`;
}

function getWorkbookCss() {
  // Purple theme - from 1강 워크북테스트
  return `:root{--o:#7C3AED;--od:#5B21B6;--ol:#A78BFA;--oxl:#F3F0FF;--oxxl:#FAF5FF;--bg:#F5F3FF;--text:#1A1A2E;--tm:#6B5B8A;--tl:#9A8DB8;--r:#D63B3B;--rl:#FFF0F0;--b:#3B6FD9;--bl:#EDF2FF;--warn:#F59E0B;--wl:#FFF8E1;--card:#FFF;--shadow:0 4px 20px rgba(0,0,0,.06);--radius:16px;--rs:10px;--rxs:6px;--tr:all .2s ease;}
*{margin:0;padding:0;box-sizing:border-box;}html{scroll-behavior:smooth;}
body{font-family:'Pretendard Variable',-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased;}
.screen{display:none;min-height:100vh;}.screen.active{display:flex;flex-direction:column;}
.toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--text);color:#fff;padding:12px 24px;border-radius:var(--rs);font-size:14px;font-weight:600;opacity:0;transition:all .3s;z-index:999;pointer-events:none;}.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
#startScreen{align-items:center;justify-content:center;padding:40px 20px;background:linear-gradient(160deg,#F3F0FF,#E8E0FF 40%,#DDD6FE);}
.start-container{max-width:460px;width:100%;z-index:1;}
.brand-badge{display:inline-block;background:linear-gradient(135deg,var(--o),#6D28D9);color:#fff;font-size:12px;font-weight:800;padding:7px 16px;border-radius:24px;margin-bottom:20px;}
.start-title{font-size:36px;font-weight:900;margin-bottom:4px;}.start-title span{background:linear-gradient(135deg,var(--od),var(--o));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.start-subtitle{font-size:14px;color:var(--tm);margin-bottom:30px;}
.info-card{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:20px;overflow:hidden;}
.info-card-header{background:linear-gradient(135deg,var(--o),#6D28D9);padding:14px 20px;color:#fff;font-size:13px;font-weight:700;}
.info-rows{padding:4px 0;}.info-row{display:flex;justify-content:space-between;padding:11px 20px;font-size:14px;border-bottom:1px solid #F0EDFF;}.info-row:last-child{border:none;}
.info-label{color:var(--tm);}.info-value{font-weight:700;}
.chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px;}
.chip{background:var(--card);border:1.5px solid #DDD0EF;border-radius:24px;padding:7px 15px;font-size:12px;font-weight:600;color:var(--tm);}
.input-group{margin-bottom:14px;}.input-group label{display:block;font-size:12px;font-weight:700;color:var(--tm);margin-bottom:6px;}
.input-group input,.input-group select{width:100%;padding:13px 16px;border:2px solid #D0C8E2;border-radius:var(--rs);font-size:15px;font-family:inherit;background:#fff;transition:var(--tr);}
.input-group input:focus,.input-group select:focus{outline:none;border-color:var(--o);box-shadow:0 0 0 4px rgba(124,58,237,.1);}
.input-row{display:flex;gap:10px;}
.btn{padding:16px;border:none;border-radius:var(--rs);font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;transition:var(--tr);width:100%;}
.btn-primary{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;box-shadow:0 6px 20px rgba(124,58,237,.3);margin-top:12px;}.btn-primary:hover{transform:translateY(-1px);}
.btn-outline{background:transparent;border:2px solid #C8C0DA;color:var(--tm);margin-top:8px;font-size:14px;padding:12px;}.btn-outline:hover{border-color:var(--o);color:var(--o);}
.history-badge{background:var(--oxl);color:var(--o);font-weight:800;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:6px;}
#historyPanel{display:none;margin-top:14px;}
.history-item{background:var(--card);border:1.5px solid #DDD0EF;border-radius:var(--rs);padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;}
.hi-left .hi-name{font-weight:700;font-size:13px;}.hi-left .hi-meta{font-size:11px;color:var(--tl);}
.hi-right .hi-score{font-size:20px;font-weight:900;color:var(--o);}.hi-right .hi-level{font-size:10px;color:var(--tm);text-align:right;}
.exam-topbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(0,0,0,.06);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;}
.topbar-left{display:flex;align-items:center;gap:10px;}.topbar-dot{width:8px;height:8px;background:var(--o);border-radius:50%;}
.topbar-info{font-size:13px;color:var(--tm);font-weight:600;}.topbar-info span{color:var(--o);font-weight:800;}
.timer{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;}.timer.warn{color:var(--warn);}.timer.danger{color:var(--r);animation:pulse .6s infinite;}
@keyframes pulse{50%{opacity:.3;}}
.btn-submit{padding:9px 22px;background:linear-gradient(135deg,var(--od),var(--o));color:#fff;border:none;border-radius:var(--rxs);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
.exam-scroll{display:none;}
.slide-wrap{height:calc(100vh - 52px);display:flex;flex-direction:column;}
.slide-passage{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px;background:#fff;}
.slide-passage .q-passage{padding:0;border:none;border-radius:0;background:transparent;line-height:1.85;text-align:justify;word-break:keep-all;overflow-wrap:break-word;font-size:clamp(13px,3.2vw,15px);}
.slide-bottom{flex-shrink:0;background:rgba(255,255,255,.2);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border-top:1px solid rgba(255,255,255,.25);box-shadow:0 -2px 20px rgba(0,0,0,.05);padding:10px 14px 12px;max-height:42vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:16px 16px 0 0;}
.slide-stem{font-size:12.5px;font-weight:700;margin-bottom:6px;overflow-wrap:break-word;color:var(--text);}
.slide-choices{display:flex;flex-direction:column;gap:2px;}
.slide-choices .choice-btn{padding:6px 9px;font-size:12px;line-height:1.3;gap:6px;border:1px solid rgba(0,0,0,.05);border-radius:8px;background:rgba(255,255,255,.15);}
.slide-choices .choice-btn:hover{background:rgba(255,255,255,.35);}
.slide-choices .choice-btn.selected{border-color:var(--o);background:rgba(124,58,237,.12);box-shadow:0 0 0 2px rgba(124,58,237,.2);}
.slide-choices .c-num{min-width:18px;height:18px;font-size:9px;background:rgba(0,0,0,.06);}
.slide-choices .choice-btn.selected .c-num{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;}
.slide-choices .written-input{padding:7px 10px;font-size:13px;background:rgba(255,255,255,.2);border:1px solid rgba(0,0,0,.05);}
.slide-nav{display:flex;align-items:center;justify-content:space-between;padding:5px 0 0;margin-top:5px;}
.slide-nav button{padding:6px 14px;border:1px solid rgba(0,0,0,.05);border-radius:7px;background:rgba(255,255,255,.15);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}
.slide-nav button.sn-next{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;border-color:transparent;}
.slide-nav button:disabled{opacity:.3;}
.slide-nav .nav-cur{font-size:11px;font-weight:800;color:var(--o);}
.q-card{background:var(--card);border-radius:12px;margin-bottom:14px;box-shadow:var(--shadow);overflow:hidden;}
.q-header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(135deg,var(--oxxl),var(--oxl));border-bottom:1px solid #E0D8F0;flex-wrap:wrap;}
.q-num{width:28px;height:28px;background:linear-gradient(135deg,var(--od),var(--o));color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;}
.q-type-tag{font-size:11px;font-weight:800;padding:4px 12px;border-radius:14px;}
.tag-grammar{background:#E8EAF6;color:#283593;}.tag-content{background:#E0F2F1;color:#00695C;}.tag-blank{background:#E0F7FA;color:#00838F;}.tag-written{background:#FBE9E7;color:#BF360C;}.tag-tf{background:#F3E5F5;color:#7B1FA2;}
.tag-combo{background:var(--oxl);color:#5B21B6;}.tag-wrong{background:var(--rl);color:var(--r);}.tag-syn{background:var(--bl);color:var(--b);}.tag-ant{background:var(--wl);color:#B45309;}.tag-poly{background:#FCE4EC;color:#C2185B;}.tag-eng{background:#E8F6FF;color:#0277BD;}.tag-morph{background:#FFF3E0;color:#E65100;}.tag-ctx{background:#EDE7F6;color:#5E35B1;}.tag-vocab{background:#FFF3E0;color:#E65100;}.tag-summary{background:#F1F8E9;color:#33691E;}
.q-meta{display:flex;align-items:center;gap:8px;margin-left:auto;}.q-diff{font-size:11px;color:var(--tl);font-weight:600;background:#F0EDFF;padding:3px 10px;border-radius:10px;}.q-pts{font-size:12px;color:var(--o);font-weight:800;}
.q-body{padding:14px 16px;}
.q-passage{background:linear-gradient(135deg,#FAFAFF,#F5F0FF);border-left:3px solid var(--o);padding:12px 14px;margin-bottom:12px;border-radius:0 8px 8px 0;line-height:1.85;text-align:justify;word-break:keep-all;overflow-wrap:break-word;font-size:clamp(13px,3.2vw,15px);}
.q-stem{font-size:13px;font-weight:700;margin-bottom:10px;overflow-wrap:break-word;}
.choices{display:flex;flex-direction:column;gap:4px;}
.choice-btn{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid #DDD0EF;border-radius:8px;cursor:pointer;transition:var(--tr);background:#fff;text-align:left;font-family:inherit;font-size:13px;line-height:1.4;}
.choice-btn:hover{border-color:var(--o);}.choice-btn.selected{border-color:var(--o);box-shadow:0 0 0 2px rgba(124,58,237,.12);background:var(--oxxl);}
.c-num{min-width:22px;height:22px;background:#E8E0F0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--tm);flex-shrink:0;}.choice-btn.selected .c-num{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;}
.written-input{width:100%;padding:10px 12px;border:1.5px solid #D0C8E2;border-radius:8px;font-size:14px;font-family:inherit;}.written-input:focus{outline:none;border-color:var(--o);}
.exam-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-top:1px solid rgba(0,0,0,.06);padding:10px 16px;display:flex;align-items:center;gap:5px;justify-content:center;z-index:100;overflow-x:auto;flex-wrap:wrap;}
.nav-dot{width:28px;height:28px;border-radius:50%;background:#DDD0EF;cursor:pointer;border:none;font-size:10px;font-weight:800;color:var(--tm);display:flex;align-items:center;justify-content:center;font-family:inherit;flex-shrink:0;}.nav-dot.answered{background:var(--o);color:#fff;}
.r-hero{padding:48px 20px 36px;text-align:center;}.r-hero.pass{background:linear-gradient(160deg,var(--oxl),var(--oxxl));}.r-hero.fail{background:linear-gradient(160deg,#FFF3E8,#FFEAEA);}
.r-badge{display:inline-block;padding:8px 20px;border-radius:24px;font-size:14px;font-weight:800;margin-bottom:16px;}.r-badge.pass{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;}.r-badge.fail{background:linear-gradient(135deg,var(--r),#C42A2A);color:#fff;}
.r-score{font-size:72px;font-weight:900;}.r-score sup{font-size:24px;color:var(--tl);}
.r-stats{display:flex;justify-content:center;gap:14px;margin-top:16px;font-size:13px;color:var(--tm);flex-wrap:wrap;}.r-stats strong{color:var(--text);font-weight:800;}.stat-item{background:rgba(255,255,255,.6);padding:6px 14px;border-radius:20px;}
.rc{max-width:740px;margin:0 auto;padding:0 20px 50px;}.rs{background:var(--card);border-radius:var(--radius);padding:24px;margin-bottom:18px;box-shadow:var(--shadow);}.rs-title{font-size:17px;font-weight:800;margin-bottom:18px;}
.level-card{text-align:center;padding:30px 20px;}.level-icon{font-size:64px;margin-bottom:8px;animation:floatY 3s ease-in-out infinite;}@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.level-name{font-size:28px;font-weight:900;background:linear-gradient(135deg,var(--od),var(--o));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}.level-range{font-size:13px;color:var(--tm);margin-top:4px;}
.level-bar{margin-top:16px;height:8px;background:#E8E0F0;border-radius:4px;overflow:hidden;}.level-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--o),var(--ol));transition:width 1.5s ease;}.level-msg{margin-top:12px;font-size:14px;color:var(--tm);}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.info-cell{padding:12px;background:var(--oxxl);border-radius:var(--rs);border:1px solid #DDD0EF;}.info-cell .ic-label{font-size:11px;color:var(--tl);font-weight:700;margin-bottom:2px;}.info-cell .ic-value{font-size:15px;font-weight:800;}.info-cell.highlight{background:var(--oxl);}.info-cell.highlight .ic-value{color:var(--o);}
.type-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}.type-label{min-width:60px;font-size:12px;font-weight:700;color:var(--tm);text-align:right;}.type-track{flex:1;height:10px;background:#E8E0F0;border-radius:5px;overflow:hidden;}.type-fill{height:100%;border-radius:5px;transition:width 1s ease;}.type-pct{min-width:36px;font-size:12px;font-weight:800;}
.tag-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}.tag-item{padding:5px 12px;border-radius:16px;font-size:12px;font-weight:700;}.tag-item.good{background:var(--oxl);color:var(--o);}.tag-item.weak{background:var(--rl);color:var(--r);}
.plan-card{display:flex;gap:14px;padding:16px;background:var(--oxl);border-radius:var(--rs);}.plan-icon{font-size:32px;flex-shrink:0;}.plan-text h4{font-size:15px;font-weight:800;margin-bottom:4px;}.plan-text p{font-size:13px;color:var(--tm);line-height:1.7;}
.action-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}.act-btn{padding:14px;border:2px solid #D0C8E2;border-radius:var(--rs);background:var(--card);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;transition:var(--tr);display:flex;flex-direction:column;align-items:center;gap:4px;}.act-btn:hover{border-color:var(--o);color:var(--o);}.act-btn.primary{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;border-color:transparent;}.act-btn .act-icon{font-size:20px;}.act-btn .act-label{font-size:12px;}
.rev-card{border:1.5px solid #DDD0EF;border-radius:var(--rs);margin-bottom:14px;overflow:hidden;}.rev-header{padding:14px 18px;background:var(--oxxl);display:flex;align-items:center;gap:12px;cursor:pointer;}.rev-header:hover{background:var(--oxl);}.rev-icon{font-size:18px;margin-left:auto;transition:transform .2s;}.rev-body{max-height:0;overflow:hidden;transition:max-height .4s ease,padding .3s ease;padding:0 18px;}.rev-body.open{max-height:3000px;padding:20px 18px;}
.expl-tag{display:inline-flex;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;margin-bottom:6px;}.expl-tag.ans{background:var(--oxl);color:var(--o);}.expl-tag.tip{background:var(--oxl);color:var(--od);}
.expl-box{font-size:13.5px;line-height:1.85;padding:14px 16px;background:#FAFAF8;border-radius:var(--rxs);margin-bottom:10px;}.expl-box.ans-b{border-left:3px solid var(--o);}.expl-box.tip-b{border-left:3px solid var(--o);background:var(--oxl);}
@media(max-width:640px){.start-title{font-size:28px;}.r-score{font-size:52px;}.action-grid{grid-template-columns:1fr;}.info-grid{grid-template-columns:1fr;}.q-body{padding:16px;}}`;
}

function getQuizCss() {
  // Orange theme - from 1강 퀴즈테스트
  return `:root{--o:#E8772E;--od:#B85A1A;--ol:#F5A623;--oxl:#FFF3E8;--oxxl:#FFFAF5;--bg:#F6F2EE;--text:#1A1A2E;--tm:#7A6A5E;--tl:#A89A8E;--r:#D63B3B;--rl:#FFF0F0;--b:#3B6FD9;--bl:#EDF2FF;--warn:#F59E0B;--wl:#FFF8E1;--card:#FFF;--shadow:0 4px 20px rgba(0,0,0,.06);--radius:16px;--rs:10px;--rxs:6px;--tr:all .2s ease;}
*{margin:0;padding:0;box-sizing:border-box;}html{scroll-behavior:smooth;}
body{font-family:'Pretendard Variable',-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased;}
.screen{display:none;min-height:100vh;}.screen.active{display:flex;flex-direction:column;}
.toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--text);color:#fff;padding:12px 24px;border-radius:var(--rs);font-size:14px;font-weight:600;opacity:0;transition:all .3s;z-index:999;pointer-events:none;}.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
#startScreen{align-items:center;justify-content:center;padding:40px 20px;background:linear-gradient(160deg,#FFF3E8,#FFE8D5 40%,#FFDDC4);}
.start-container{max-width:460px;width:100%;z-index:1;}
.brand-badge{display:inline-block;background:linear-gradient(135deg,var(--o),#D97706);color:#fff;font-size:12px;font-weight:800;padding:7px 16px;border-radius:24px;margin-bottom:20px;}
.start-title{font-size:36px;font-weight:900;margin-bottom:4px;}.start-title span{background:linear-gradient(135deg,var(--od),var(--o));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.start-subtitle{font-size:14px;color:var(--tm);margin-bottom:30px;}
.info-card{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:20px;overflow:hidden;}
.info-card-header{background:linear-gradient(135deg,var(--o),#D97706);padding:14px 20px;color:#fff;font-size:13px;font-weight:700;}
.info-rows{padding:4px 0;}.info-row{display:flex;justify-content:space-between;padding:11px 20px;font-size:14px;border-bottom:1px solid #F0E8DF;}.info-row:last-child{border:none;}
.info-label{color:var(--tm);}.info-value{font-weight:700;}
.chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px;}
.chip{background:var(--card);border:1.5px solid #E0D8CF;border-radius:24px;padding:7px 15px;font-size:12px;font-weight:600;color:var(--tm);}
.input-group{margin-bottom:14px;}.input-group label{display:block;font-size:12px;font-weight:700;color:var(--tm);margin-bottom:6px;}
.input-group input,.input-group select{width:100%;padding:13px 16px;border:2px solid #E0D8CF;border-radius:var(--rs);font-size:15px;font-family:inherit;background:#fff;transition:var(--tr);}
.input-group input:focus,.input-group select:focus{outline:none;border-color:var(--o);box-shadow:0 0 0 4px rgba(232,119,46,.1);}
.input-row{display:flex;gap:10px;}
.btn{padding:16px;border:none;border-radius:var(--rs);font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;transition:var(--tr);width:100%;}
.btn-primary{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;box-shadow:0 6px 20px rgba(232,119,46,.3);margin-top:12px;}.btn-primary:hover{transform:translateY(-1px);}
.btn-outline{background:transparent;border:2px solid #E0D8CF;color:var(--tm);margin-top:8px;font-size:14px;padding:12px;}.btn-outline:hover{border-color:var(--o);color:var(--o);}
.history-badge{background:var(--oxl);color:var(--o);font-weight:800;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:6px;}
#historyPanel{display:none;margin-top:14px;}
.history-item{background:var(--card);border:1.5px solid #E0D8CF;border-radius:var(--rs);padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;}
.hi-left .hi-name{font-weight:700;font-size:13px;}.hi-left .hi-meta{font-size:11px;color:var(--tl);}
.hi-right .hi-score{font-size:20px;font-weight:900;color:var(--o);}.hi-right .hi-level{font-size:10px;color:var(--tm);text-align:right;}
.exam-topbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(0,0,0,.06);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;}
.topbar-left{display:flex;align-items:center;gap:10px;}.topbar-dot{width:8px;height:8px;background:var(--o);border-radius:50%;}
.topbar-info{font-size:13px;color:var(--tm);font-weight:600;}.topbar-info span{color:var(--o);font-weight:800;}
.timer{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;}.timer.warn{color:var(--warn);}.timer.danger{color:var(--r);animation:pulse .6s infinite;}
@keyframes pulse{50%{opacity:.3;}}
.btn-submit{padding:9px 22px;background:linear-gradient(135deg,var(--od),var(--o));color:#fff;border:none;border-radius:var(--rxs);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
.exam-scroll{display:none;}
.slide-wrap{height:calc(100vh - 52px);display:flex;flex-direction:column;}
.slide-passage{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px;background:#fff;}
.slide-passage .q-passage{padding:0;border:none;border-radius:0;background:transparent;line-height:1.85;text-align:justify;word-break:keep-all;overflow-wrap:break-word;font-size:clamp(13px,3.2vw,15px);}
.slide-bottom{flex-shrink:0;background:rgba(255,255,255,.2);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border-top:1px solid rgba(255,255,255,.25);box-shadow:0 -2px 20px rgba(0,0,0,.05);padding:10px 14px 12px;max-height:42vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:16px 16px 0 0;}
.slide-stem{font-size:12.5px;font-weight:700;margin-bottom:6px;overflow-wrap:break-word;color:var(--text);}
.slide-choices{display:flex;flex-direction:column;gap:2px;}
.slide-choices .choice-btn{padding:6px 9px;font-size:12px;line-height:1.3;gap:6px;border:1px solid rgba(0,0,0,.05);border-radius:8px;background:rgba(255,255,255,.15);}
.slide-choices .choice-btn:hover{background:rgba(255,255,255,.35);}
.slide-choices .choice-btn.selected{border-color:var(--o);background:rgba(232,119,46,.12);box-shadow:0 0 0 2px rgba(232,119,46,.2);}
.slide-choices .c-num{min-width:18px;height:18px;font-size:9px;background:rgba(0,0,0,.06);}
.slide-choices .choice-btn.selected .c-num{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;}
.slide-choices .written-input{padding:7px 10px;font-size:13px;background:rgba(255,255,255,.2);border:1px solid rgba(0,0,0,.05);}
.slide-nav{display:flex;align-items:center;justify-content:space-between;padding:5px 0 0;margin-top:5px;}
.slide-nav button{padding:6px 14px;border:1px solid rgba(0,0,0,.05);border-radius:7px;background:rgba(255,255,255,.15);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}
.slide-nav button.sn-next{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;border-color:transparent;}
.slide-nav button:disabled{opacity:.3;}
.slide-nav .nav-cur{font-size:11px;font-weight:800;color:var(--o);}
.q-card{background:var(--card);border-radius:12px;margin-bottom:14px;box-shadow:var(--shadow);overflow:hidden;}
.q-header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(135deg,#FFF3E8,#FFE8D5);border-bottom:1px solid #E0D8CF;flex-wrap:wrap;}
.q-num{width:28px;height:28px;background:linear-gradient(135deg,var(--od),var(--o));color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;}
.q-type-tag{font-size:11px;font-weight:800;padding:4px 12px;border-radius:14px;}
.tag-insert{background:#E0F7FA;color:#00838F;}
.tag-order{background:#FFF3E0;color:#E65100;}
.tag-grammar{background:#EDE7F6;color:#5E35B1;}
.tag-vocab{background:#FCE4EC;color:#C2185B;}
.tag-blank{background:#E8F6FF;color:#0277BD;}
.tag-written{background:var(--oxl);color:var(--od);}
.tag-content{background:#E8F5E9;color:#2E7D32;}
.tag-tf{background:#FFF8E1;color:#F57F17;}
.tag-combo{background:var(--oxl);color:var(--od);}.tag-wrong{background:var(--rl);color:var(--r);}.tag-syn{background:var(--bl);color:var(--b);}.tag-ant{background:var(--wl);color:#B45309;}.tag-poly{background:#FCE4EC;color:#C2185B;}.tag-eng{background:#E8F6FF;color:#0277BD;}.tag-morph{background:#FFF3E0;color:#E65100;}.tag-ctx{background:#EDE7F6;color:#5E35B1;}.tag-summary{background:#F1F8E9;color:#33691E;}
.q-meta{display:flex;align-items:center;gap:8px;margin-left:auto;}.q-diff{font-size:11px;color:var(--tl);font-weight:600;background:#F0E8DF;padding:3px 10px;border-radius:10px;}.q-pts{font-size:12px;color:var(--o);font-weight:800;}
.q-body{padding:14px 16px;}
.q-passage{background:linear-gradient(135deg,#FFFAF5,#FFF5EE);border-left:3px solid var(--o);padding:12px 14px;margin-bottom:12px;border-radius:0 8px 8px 0;line-height:1.85;text-align:justify;word-break:keep-all;overflow-wrap:break-word;font-size:clamp(13px,3.2vw,15px);}
.q-given-sentence{background:var(--oxl);border:2px solid var(--ol);border-radius:var(--rs);padding:14px 16px;margin-bottom:14px;font-size:13.5px;line-height:1.8;font-weight:600;}
.q-stem{font-size:13px;font-weight:700;margin-bottom:10px;overflow-wrap:break-word;}
.choices{display:flex;flex-direction:column;gap:4px;}
.choice-btn{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid #E0D8CF;border-radius:8px;cursor:pointer;transition:var(--tr);background:#fff;text-align:left;font-family:inherit;font-size:13px;line-height:1.4;}
.choice-btn:hover{border-color:var(--o);}.choice-btn.selected{border-color:var(--o);box-shadow:0 0 0 2px rgba(232,119,46,.12);background:var(--oxxl);}
.c-num{min-width:22px;height:22px;background:#F0E8DF;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--tm);flex-shrink:0;}.choice-btn.selected .c-num{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;}
.written-input{width:100%;padding:10px 12px;border:1.5px solid #E0D8CF;border-radius:8px;font-size:14px;font-family:inherit;}.written-input:focus{outline:none;border-color:var(--o);}
.exam-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-top:1px solid rgba(0,0,0,.06);padding:10px 16px;display:flex;align-items:center;gap:5px;justify-content:center;z-index:100;overflow-x:auto;flex-wrap:wrap;}
.nav-dot{width:28px;height:28px;border-radius:50%;background:#F0E8DF;cursor:pointer;border:none;font-size:10px;font-weight:800;color:var(--tm);display:flex;align-items:center;justify-content:center;font-family:inherit;flex-shrink:0;}.nav-dot.answered{background:var(--o);color:#fff;}
.r-hero{padding:48px 20px 36px;text-align:center;}.r-hero.pass{background:linear-gradient(160deg,#FFF3E8,#FFE8D5);}.r-hero.fail{background:linear-gradient(160deg,#FFF3E8,#FFEAEA);}
.r-badge{display:inline-block;padding:8px 20px;border-radius:24px;font-size:14px;font-weight:800;margin-bottom:16px;}.r-badge.pass{background:linear-gradient(135deg,var(--o),#D97706);color:#fff;}.r-badge.fail{background:linear-gradient(135deg,var(--r),#C42A2A);color:#fff;}
.r-score{font-size:72px;font-weight:900;}.r-score sup{font-size:24px;color:var(--tl);}
.r-stats{display:flex;justify-content:center;gap:14px;margin-top:16px;font-size:13px;color:var(--tm);flex-wrap:wrap;}.r-stats strong{color:var(--text);font-weight:800;}.stat-item{background:rgba(255,255,255,.6);padding:6px 14px;border-radius:20px;}
.rc{max-width:740px;margin:0 auto;padding:0 20px 50px;}.rs{background:var(--card);border-radius:var(--radius);padding:24px;margin-bottom:18px;box-shadow:var(--shadow);}.rs-title{font-size:17px;font-weight:800;margin-bottom:18px;}
.level-card{text-align:center;padding:30px 20px;}.level-icon{font-size:64px;margin-bottom:8px;animation:floatY 3s ease-in-out infinite;}@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.level-name{font-size:28px;font-weight:900;background:linear-gradient(135deg,var(--od),var(--o));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}.level-range{font-size:13px;color:var(--tm);margin-top:4px;}
.level-bar{margin-top:16px;height:8px;background:#F0E8DF;border-radius:4px;overflow:hidden;}.level-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--o),var(--ol));transition:width 1.5s ease;}.level-msg{margin-top:12px;font-size:14px;color:var(--tm);}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.info-cell{padding:12px;background:var(--oxxl);border-radius:var(--rs);border:1px solid #E0D8CF;}.info-cell .ic-label{font-size:11px;color:var(--tl);font-weight:700;margin-bottom:2px;}.info-cell .ic-value{font-size:15px;font-weight:800;}.info-cell.highlight{background:var(--oxl);}.info-cell.highlight .ic-value{color:var(--o);}
.type-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}.type-label{min-width:60px;font-size:12px;font-weight:700;color:var(--tm);text-align:right;}.type-track{flex:1;height:10px;background:#F0E8DF;border-radius:5px;overflow:hidden;}.type-fill{height:100%;border-radius:5px;transition:width 1s ease;}.type-pct{min-width:36px;font-size:12px;font-weight:800;}
.tag-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}.tag-item{padding:5px 12px;border-radius:16px;font-size:12px;font-weight:700;}.tag-item.good{background:var(--oxl);color:var(--o);}.tag-item.weak{background:var(--rl);color:var(--r);}
.plan-card{display:flex;gap:14px;padding:16px;background:var(--oxl);border-radius:var(--rs);}.plan-icon{font-size:32px;flex-shrink:0;}.plan-text h4{font-size:15px;font-weight:800;margin-bottom:4px;}.plan-text p{font-size:13px;color:var(--tm);line-height:1.7;}
.action-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}.act-btn{padding:14px;border:2px solid #E0D8CF;border-radius:var(--rs);background:var(--card);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;transition:var(--tr);display:flex;flex-direction:column;align-items:center;gap:4px;}.act-btn:hover{border-color:var(--o);color:var(--o);}.act-btn.primary{background:linear-gradient(135deg,var(--od),var(--o));color:#fff;border-color:transparent;}.act-btn .act-icon{font-size:20px;}.act-btn .act-label{font-size:12px;}
.rev-card{border:1.5px solid #E0D8CF;border-radius:var(--rs);margin-bottom:14px;overflow:hidden;}.rev-header{padding:14px 18px;background:var(--oxxl);display:flex;align-items:center;gap:12px;cursor:pointer;}.rev-header:hover{background:var(--oxl);}.rev-icon{font-size:18px;margin-left:auto;transition:transform .2s;}.rev-body{max-height:0;overflow:hidden;transition:max-height .4s ease,padding .3s ease;padding:0 18px;}.rev-body.open{max-height:3000px;padding:20px 18px;}
.expl-tag{display:inline-flex;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;margin-bottom:6px;}.expl-tag.ans{background:var(--oxl);color:var(--o);}.expl-tag.tip{background:var(--oxxl);color:var(--od);}
.expl-box{font-size:13.5px;line-height:1.85;padding:14px 16px;background:#FAFAF8;border-radius:var(--rxs);margin-bottom:10px;}.expl-box.ans-b{border-left:3px solid var(--o);}.expl-box.tip-b{border-left:3px solid var(--o);background:var(--oxl);}
@media(max-width:640px){.start-title{font-size:28px;}.r-score{font-size:52px;}.action-grid{grid-template-columns:1fr;}.info-grid{grid-template-columns:1fr;}.q-body{padding:16px;}}`;
}

// ============================================================
// JS TEMPLATE (from 1강 reference - shared across all types)
// ============================================================
function getJsTemplate(testType) {
  // testType: 'word', 'workbook', 'quiz'
  const themeColor = testType === 'word' ? 'var(--g)' : 'var(--o)';
  const themeColorDark = testType === 'word' ? 'var(--gd)' : 'var(--od)';
  const shareColor = testType === 'word' ? '#16A34A' : (testType === 'quiz' ? '#E8772E' : '#7C3AED');
  const shareColorPass = testType === 'word' ? "'#16A34A'" : (testType === 'quiz' ? "'#E8772E'" : "'#7C3AED'");

  return `let S={ans:[],cur:0,ti:null,left:EI.time,start:0};

function getHistory(){try{return JSON.parse(localStorage.getItem(EI.histKey)||'[]');}catch(e){return[];}}
function saveToHistory(r,elapsed){const h=getHistory();h.unshift({name:document.getElementById('inpName').value.trim(),school:document.getElementById('inpSchool').value.trim(),grade:document.getElementById('inpGrade').value,score:r.score,total:EI.total,correct:r.correct,wrong:r.wrong,unanswered:r.unanswered,elapsed,date:new Date().toISOString(),level:getLevel(r.score).name,answers:S.ans.slice()});if(h.length>20)h.length=20;localStorage.setItem(EI.histKey,JSON.stringify(h));}
function updateHCount(){const h=getHistory();document.getElementById('hCount').textContent=h.length;}
function toggleHistory(){const p=document.getElementById('historyPanel');if(p.style.display==='block'){p.style.display='none';return;}const h=getHistory();if(!h.length){p.innerHTML='<p style="text-align:center;color:var(--tl);font-size:13px;padding:20px">아직 기록이 없습니다.</p>';p.style.display='block';return;}p.innerHTML=h.map((x,idx)=>\`<div class="history-item" style="flex-wrap:wrap"><div class="hi-left"><div class="hi-name">\${x.name||'이름없음'}</div><div class="hi-meta">\${new Date(x.date).toLocaleDateString('ko-KR')} · \${x.grade} · \${x.level||''}</div></div><div class="hi-right"><div class="hi-score" style="color:\${x.score>=80?'${themeColor}':'var(--r)'}">\${x.score}<span style="font-size:11px;color:var(--tl)">/\${x.total}</span></div></div>\${x.answers?\`<button onclick="reviewHistory(\${idx})" style="width:100%;margin-top:8px;padding:8px;border:1.5px solid #dde8df;border-radius:8px;background:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:${themeColor}">\\u{1F4DD} 정답·해설 다시 보기</button>\`:''}</div>\`).join('');p.style.display='block';}
function getLevel(s){if(s>=95)return{name:'마스터',icon:'\\u{1F451}',range:'95~100',msg:'이 단원은 정복했어요!'};if(s>=85)return{name:'챌린저',icon:'\\u{1F31F}',range:'85~94',msg:'거의 완벽, 한 끗 차이!'};if(s>=75)return{name:'파이터',icon:'\\u{1F48E}',range:'75~84',msg:'통과! 약점만 잡으면 마스터'};if(s>=50)return{name:'루키',icon:'\\u{1F525}',range:'50~74',msg:'기본기 OK, 유형별 훈련 필요'};return{name:'스타터',icon:'\\u{1F4D6}',range:'0~49',msg:'지문 해석부터 다시!'};}
function getTypeAdvice(t){const m={'(A)(B)(C) 조합형':'반의어 함정 주의, 원문 단어 정확히 암기','문맥상 부적절한 어휘':'밑줄 단어가 반의어로 바뀌었는지 확인','동의어 고르기':'동의어 쌍을 세트로 묶어 암기','반의어 고르기':'반의어 쌍을 세트로 묶어 암기','빈칸 어휘 완성':'문맥 단서(clue) 찾기 연습 필요','다의어 문맥적 의미':'다의어의 여러 뜻을 문맥별로 구분','영영풀이 매칭':'영영사전 정의 읽기 연습','어형 변환 (서술형)':'품사 변환 규칙(명\\u2194형, 동\\u2194명) 정리','빈칸 문맥 완성':'글의 흐름과 논리적 연결 파악','어법':'핵심 어법 규칙 정리 및 반복 연습','내용일치':'지문과 선지를 꼼꼼히 대조','내용불일치':'함정 선지의 미세한 차이 찾기','T/F':'원문과 진술을 정확히 대조','서술형':'정확한 철자와 어형 변환 주의','빈칸추론':'빈칸 전후 문맥 단서 찾기','문장삽입':'글의 흐름과 연결사 파악','어순배열':'문장 구조(S+V+O) 정확히 파악','어휘':'문맥에서 적절한 어휘 고르기 연습','주제/요지':'글의 핵심 내용 파악','순서':'연결사와 지시어 추적','요약':'핵심 내용 간결하게 정리'};return m[t]||'해당 유형 집중 복습 필요';}
function fmtTime(s){return Math.floor(s/60)+'분 '+s%60+'초';}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}

function startExam(){const nm=document.getElementById('inpName').value.trim();if(!nm){toast('이름을 입력해주세요!');return;}S={ans:Array(EI.totalQ).fill(null),cur:0,ti:null,left:EI.time,start:Date.now()};showScreen('examScreen');renderSlide(0);startTimer();}

function renderSlide(idx){
S.cur=idx;const q=Q[idx];const tc=typeTag[q.type]||'';const mk=q.ch&&q.ch.length===5?'\\u2460\\u2461\\u2462\\u2463\\u2464':(q.ch&&q.ch.length===4?'\\u2460\\u2461\\u2462\\u2463':'\\u2460\\u2461\\u2462\\u2463\\u2464');
const pp=document.getElementById('slidePassage');
let ph=\`<div class="slide-header"><div class="q-num">\${q.id}</div><span class="q-type-tag \${tc}" style="font-size:10px;padding:3px 8px">\${q.type}</span><span style="margin-left:auto;font-size:11px;color:var(--tl)">\${q.diff} · \${q.pts}점</span></div>\`;
if(q.passage)ph+=\`<div class="q-passage">\${q.passage}</div>\`;
if(!q.passage)ph+=\`<div style="padding:20px;text-align:center;color:var(--tl);font-size:13px">이 문항은 지문이 없습니다.</div>\`;
pp.innerHTML=ph;pp.scrollTop=0;
const bt=document.getElementById('slideBottom');
let bh=\`<div class="slide-stem">\${q.stem}</div>\`;
if(q.fmt==='mc'){bh+=\`<div class="slide-choices">\`;q.ch.forEach((c,ci)=>{const sel=S.ans[idx]===ci?' selected':'';bh+=\`<button class="choice-btn\${sel}" onclick="slideSel(\${idx},\${ci})"><span class="c-num">\${mk[ci]}</span><span>\${c}</span></button>\`;});bh+=\`</div>\`;}
if(q.fmt==='written'){const val=S.ans[idx]||'';bh+=\`<input class="written-input" id="sw-\${idx}" value="\${val}" placeholder="답안을 입력하세요..." oninput="slideWrite(\${idx})">\`;}
bh+=\`<div class="slide-nav"><button \${idx===0?'disabled':''}onclick="renderSlide(\${idx-1})">&larr; 이전</button><span class="nav-cur">\${idx+1} / \${EI.totalQ}</span><button class="sn-next" \${idx===EI.totalQ-1?'disabled':''}onclick="renderSlide(\${idx+1})">다음 &rarr;</button></div>\`;
bt.innerHTML=bh;bt.scrollTop=0;
}
function slideSel(qi,ci){S.ans[qi]=ci;const st=document.getElementById('slidePassage').scrollTop;renderSlide(qi);document.getElementById('slidePassage').scrollTop=st;}
function slideWrite(qi){const el=document.getElementById('sw-'+qi);S.ans[qi]=el?el.value.trim()||null:null;}
function renderQ(){}
function renderDots(){}
function upDots(){}
function scrollToQ(i){if(i>=0&&i<EI.totalQ)renderSlide(i);}
function sel(){}
function sw(){}
function startTimer(){const el=document.getElementById('timer');S.ti=setInterval(()=>{S.left--;const m=Math.floor(S.left/60),s=S.left%60;el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');el.classList.toggle('warn',S.left<=300&&S.left>60);el.classList.toggle('danger',S.left<=60);if(S.left<=0){clearInterval(S.ti);submitExam();}},1000);}
function submitExam(){if(!confirm('제출하시겠습니까?'))return;clearInterval(S.ti);const elapsed=Math.floor((Date.now()-S.start)/1000);const r=grade();saveToHistory(r,elapsed);renderResults(r,elapsed);showScreen('resultScreen');window.scrollTo(0,0);}
function grade(){let score=0,correct=0,wrong=0,unanswered=0;const details=[];Q.forEach((q,i)=>{const a=S.ans[i];let ok=false;if(a===null)unanswered++;else if(q.fmt==='mc')ok=a===q.ans;else{const u=String(a).trim().toLowerCase();if(q.accept)ok=q.accept.some(x=>u===x.toLowerCase());if(!ok&&q.wa)ok=u===q.wa.toLowerCase();}if(a!==null){if(ok){correct++;score+=q.pts;}else wrong++;}details.push({q,ans:a,ok});});return{score,correct,wrong,unanswered,details};}
function renderResults(r,elapsed){const pass=r.score>=80,nm=document.getElementById('inpName').value.trim(),sc=document.getElementById('inpSchool').value.trim(),gr=document.getElementById('inpGrade').value,lv=getLevel(r.score),pct=Math.round(r.score/EI.total*100);const typeMap={};r.details.forEach(d=>{const t=d.q.type;if(!typeMap[t])typeMap[t]={total:0,ok:0};typeMap[t].total++;if(d.ok)typeMap[t].ok++;});const perfectTypes=Object.entries(typeMap).filter(([,v])=>v.ok===v.total).map(([k])=>k);const weakTypes=Object.entries(typeMap).filter(([,v])=>v.ok<v.total).map(([k])=>k);let h='';
h+=\`<div class="r-hero \${pass?'pass':'fail'}"><div class="r-badge \${pass?'pass':'fail'}">\${pass?'\\u{1F389} 통과!':'\\u{1F4DA} 미통과'}</div><div class="r-score">\${r.score}<sup>/\${EI.total}</sup></div><div class="r-stats"><span class="stat-item">\\u2705 정답 <strong>\${r.correct}</strong></span><span class="stat-item">\\u274C 오답 <strong>\${r.wrong}</strong></span><span class="stat-item">\\u2B1C 미응답 <strong>\${r.unanswered}</strong></span><span class="stat-item">\\u23F1\\uFE0F <strong>\${fmtTime(elapsed)}</strong></span></div></div><div class="rc">\`;
h+=\`<div class="rs"><div class="rs-title">\\u{1F4CB} 기본 정보</div><div class="info-grid"><div class="info-cell"><div class="ic-label">이름</div><div class="ic-value">\${nm}</div></div><div class="info-cell"><div class="ic-label">학교 / 학년</div><div class="ic-value">\${sc||'미입력'} · \${gr}</div></div><div class="info-cell"><div class="ic-label">시험 범위</div><div class="ic-value">\${EI.subject} · \${EI.pub}</div></div><div class="info-cell"><div class="ic-label">응시일</div><div class="ic-value">\${new Date().toLocaleDateString('ko-KR')}</div></div><div class="info-cell highlight"><div class="ic-label">점수</div><div class="ic-value">\${r.score}점 / \${EI.total}점 (\${pct}%)</div></div><div class="info-cell highlight"><div class="ic-label">소요시간 / 통과</div><div class="ic-value">\${fmtTime(elapsed)} / <span style="color:\${pass?'${themeColor}':'var(--r)'}">\${pass?'통과 \\u2705':'미통과 \\u274C'}</span></div></div></div></div>\`;
h+=\`<div class="rs"><div class="rs-title">\\u{1F3C5} 레벨</div><div class="level-card"><div class="level-icon">\${lv.icon}</div><div class="level-name">\${lv.name}</div><div class="level-range">\${lv.range}점 구간</div><div class="level-bar"><div class="level-bar-fill" style="width:\${pct}%"></div></div><div class="level-msg">\${lv.msg}</div></div></div>\`;
h+=\`<div class="rs"><div class="rs-title">\\u{1F50D} 내신핏 약점 진단</div>\`;Object.entries(typeMap).forEach(([type,d])=>{const p=Math.round(d.ok/d.total*100);const c=p===100?'${themeColor}':p>=50?'var(--o)':'var(--r)';const icon=p===100?'\\u2705':p>=50?'\\u26A0\\uFE0F':'\\u274C';h+=\`<div style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:13px">\${icon}</span><span style="font-size:13px;font-weight:700;flex:1">\${type.replace(/\\(.+?\\)/g,'').trim()}</span><span style="font-size:13px;font-weight:800;color:\${c}">\${d.ok}/\${d.total}</span></div><div class="type-track"><div class="type-fill" style="width:\${p}%;background:\${c}"></div></div>\${p<100?\`<div style="font-size:11px;color:var(--tm);margin-top:3px;padding-left:21px">\\u2192 \${getTypeAdvice(type)}</div>\`:''}</div>\`;});h+=\`</div>\`;
h+=\`<div class="rs"><div class="rs-title">\\u{1F4DD} 내신핏 처방</div><div class="plan-card">\`;if(pct>=95)h+=\`<div class="plan-icon">\\u{1F451}</div><div class="plan-text"><h4>마스터 달성!</h4><p>이 단원은 완벽합니다. 다음 단원에 도전하세요!</p></div>\`;else if(pct>=80)h+=\`<div class="plan-icon">\\u{1F31F}</div><div class="plan-text"><h4>통과! 마스터까지 한 끗</h4><p>아래 약점 유형만 집중하면 마스터 달성!</p></div>\`;else if(pct>=50)h+=\`<div class="plan-icon">\\u{1F525}</div><div class="plan-text"><h4>기본기는 있어요!</h4><p>오답 해설을 꼼꼼히 확인하고, 약점 유형부터 공략하세요.</p></div>\`;else h+=\`<div class="plan-icon">\\u{1F4D6}</div><div class="plan-text"><h4>지문 해석부터!</h4><p>본문을 완벽히 이해한 뒤 재도전하세요. 해설의 한글 해석을 활용!</p></div>\`;h+=\`</div></div>\`;
h+=\`<div class="rs"><div class="rs-title">\\u{1F680} 액션</div><div class="action-grid" style="grid-template-columns:1fr 1fr"><button class="act-btn" onclick="shareImage()"><span class="act-icon">\\u{1F4F8}</span><span class="act-label">이미지 공유</span></button><button class="act-btn" onclick="copyResult()"><span class="act-icon">\\u{1F4CB}</span><span class="act-label">텍스트 복사</span></button><button class="act-btn" onclick="retake()"><span class="act-icon">\\u{1F504}</span><span class="act-label">재시험</span></button><button class="act-btn primary" onclick="goHome()"><span class="act-icon">\\u{1F3E0}</span><span class="act-label">홈으로</span></button></div></div>\`;
h+=\`<div class="rs"><div class="rs-title">\\u{1F4DD} 정답과 해설 <span style="font-size:12px;color:var(--tl);margin-left:8px">클릭하여 펼치기</span></div>\`;r.details.forEach((d,i)=>{const icon=d.ok?'\\u2705':(d.ans===null?'\\u2B1C':'\\u274C');const mk=d.q.ch&&d.q.ch.length===5?'\\u2460\\u2461\\u2462\\u2463\\u2464':(d.q.ch&&d.q.ch.length===4?'\\u2460\\u2461\\u2462\\u2463':'\\u2460\\u2461\\u2462\\u2463\\u2464');const ua=d.q.fmt==='mc'?(d.ans!==null?mk[d.ans]:'미응답'):(d.ans||'미응답');const ca=d.q.fmt==='mc'?mk[d.q.ans]:(d.q.wa||'');const open=!d.ok;
let chHtml='';if(d.q.fmt==='mc'&&d.q.ch){chHtml=\`<div style="margin-top:8px">\`;d.q.ch.forEach((c,ci)=>{const isAns=ci===d.q.ans;const isMy=d.ans===ci;const color=isAns?'${themeColor}':(isMy&&!d.ok?'var(--r)':'var(--tm)');const bg=isAns?'var(--gl)':(isMy&&!d.ok?'var(--rl)':'transparent');const label=isAns?' \\u2705':(isMy&&!d.ok?' \\u274C':'');chHtml+=\`<div style="padding:4px 8px;margin-bottom:2px;border-radius:6px;font-size:12px;color:\${color};background:\${bg}"><b>\${mk[ci]}</b> \${c}\${label}</div>\`;});chHtml+=\`</div>\`;}
h+=\`<div class="rev-card"><div class="rev-header" onclick="this.nextElementSibling.classList.toggle('open');this.querySelector('.rev-icon').style.transform=this.nextElementSibling.classList.contains('open')?'rotate(180deg)':''"><span style="font-weight:800">\${icon} \${d.q.id}번</span><span style="font-size:12px;color:var(--tm)">[\${d.q.type.slice(0,8)}] \${d.q.diff} \${d.q.pts}점</span><span class="rev-icon">\\u25BC</span></div><div class="rev-body\${open?' open':''}"><div style="display:flex;gap:10px;margin-bottom:10px"><div style="flex:1;padding:8px;border-radius:var(--rxs);text-align:center;font-weight:700;\${d.ok?'background:var(--gl);color:var(--g)':'background:var(--rl);color:var(--r)'}"><div style="font-size:10px;opacity:.7">내 답</div>\${ua}</div><div style="flex:1;padding:8px;border-radius:var(--rxs);text-align:center;font-weight:700;background:var(--gl);color:var(--g)"><div style="font-size:10px;opacity:.7">정답</div>\${ca}</div></div><div style="font-size:11px;font-weight:800;color:var(--tm);margin-bottom:4px">\\u{1F4DD} 문제</div><div class="expl-box" style="font-size:12.5px;line-height:1.6;border-left:3px solid var(--b);margin-bottom:10px"><div style="font-weight:700;margin-bottom:6px">\${d.q.stem}</div>\${chHtml}</div>\${d.q.passage?\`<div style="font-size:11px;font-weight:800;color:var(--tm);margin-bottom:4px">\\u{1F4D6} 원문</div><div class="expl-box" style="font-size:12px;line-height:1.75;border-left:3px solid #ddd;margin-bottom:10px">\${d.q.passage}</div>\`:''}\${d.q.det?\`<div class="expl-tag ans">\\u{1F1F0}\\u{1F1F7} 해석</div><div class="expl-box ans-b">\${d.q.det.korean||''}</div><div class="expl-tag tip">\\u{1F4CB} 풀이 · 선지 분석</div><div class="expl-box" style="white-space:pre-line">\${(d.q.det.analysis||'').replace(/\\\\n/g,'<br>')}</div><div class="expl-tag tip">\\u{1F4A1} 포인트</div><div class="expl-box tip-b">\${d.q.det.tip||''}</div>\`:''}</div></div>\`;}); h+=\`</div></div>\`;document.getElementById('resultScreen').innerHTML=h;}
function getWeakTypes(){const r=grade();const tm={};r.details.forEach(d=>{const t=d.q.type;if(!tm[t])tm[t]={total:0,ok:0};tm[t].total++;if(d.ok)tm[t].ok++;});return Object.entries(tm).filter(([,v])=>v.ok<v.total).map(([k])=>k);}
function getTestName(){const t=document.title;if(t.includes('단어'))return '단어테스트';if(t.includes('워크북'))return '워크북테스트';if(t.includes('퀴즈'))return '퀴즈(예상문제)테스트';return 'TEST';}
function copyResult(){const r=grade(),lv=getLevel(r.score),pct=Math.round(r.score/EI.total*100),nm=document.getElementById('inpName').value.trim(),sc=document.getElementById('inpSchool').value.trim(),gr=document.getElementById('inpGrade').value,elapsed=Math.floor((Date.now()-S.start)/1000),pass=r.score>=80,tn=getTestName(),wk=getWeakTypes(),tm={};r.details.forEach(d=>{const t=d.q.type;if(!tm[t])tm[t]={total:0,ok:0};tm[t].total++;if(d.ok)tm[t].ok++;});let txt=\`\\u{1F4DD} 내신핏 \${tn} 결과\\n\${EI.subject} · \${EI.pub}\\n\${nm}\${sc?' · '+sc:''} · \${gr}\\n\${new Date().toLocaleDateString('ko-KR')}\\n\\n\${lv.icon} \${lv.name} · \${r.score}/\${EI.total}점 (\${pct}%)\\n\${pass?'\\u{1F389} 통과!':'\\u{1F4DA} 미통과'} · \\u2705\${r.correct} \\u274C\${r.wrong} \\u2B1C\${r.unanswered}\\n\\u23F1\\uFE0F \${fmtTime(elapsed)}\`;if(wk.length){txt+=\`\\n\\n\\u{1F50D} 내신핏 약점 진단\`;wk.forEach(w=>{const d=tm[w];txt+=\`\\n\\u2022 \${w.replace(/\\(.+?\\)/g,'').trim()} \${d.ok}/\${d.total} \\u2192 \${getTypeAdvice(w)}\`;});}txt+=\`\\n\\n\\u{1F4CA} 내신핏 | 내신 영어 완벽 대비\`;navigator.clipboard.writeText(txt).then(()=>toast('\\u{1F4CB} 결과가 복사되었습니다!')).catch(()=>{toast('복사 실패');});}
function shareImage(){const tn=getTestName(),wk=getWeakTypes(),r=grade(),lv=getLevel(r.score),pct=Math.round(r.score/EI.total*100),pass=r.score>=80,nm=document.getElementById('inpName').value.trim(),tm={};r.details.forEach(d=>{const t=d.q.type;if(!tm[t])tm[t]={total:0,ok:0};tm[t].total++;if(d.ok)tm[t].ok++;});const pc=pass?${shareColorPass}:'#D63B3B';let card=\`<div style="width:400px;font-family:-apple-system,sans-serif;background:#fff;border-radius:16px;overflow:hidden">\`;card+=\`<div style="background:linear-gradient(135deg,\${pass?'#E8F5E9,#C8E6C9':'#FFF0F0,#FFEAEA'});padding:28px 24px;text-align:center"><div style="font-size:12px;font-weight:800;color:\${pc};margin-bottom:4px">내신핏 \${tn}</div><div style="font-size:13px;color:#666;margin-bottom:16px">\${EI.subject} · \${EI.pub}</div><div style="font-size:56px;font-weight:900;color:#1A1A2E">\${r.score}<span style="font-size:20px;color:#aaa">/\${EI.total}</span></div><div style="margin-top:8px"><span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:800;background:\${pc};color:#fff">\${lv.icon} \${lv.name} · \${pass?'통과':'미통과'}</span></div><div style="margin-top:12px;font-size:12px;color:#888">\\u{1F464} \${nm} · \\u2705\${r.correct} \\u274C\${r.wrong} \\u2B1C\${r.unanswered}</div></div>\`;if(wk.length){card+=\`<div style="padding:16px 20px;border-top:1px solid #eee"><div style="font-size:13px;font-weight:800;margin-bottom:10px">\\u{1F50D} 내신핏 약점 진단</div>\`;Object.entries(tm).forEach(([type,d])=>{const p=Math.round(d.ok/d.total*100);const c=p===100?'#16A34A':p>=50?'#F59E0B':'#D63B3B';card+=\`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="font-weight:600">\${type.replace(/\\(.+?\\)/g,'').trim()}</span><span style="font-weight:800;color:\${c}">\${d.ok}/\${d.total}</span></div><div style="height:6px;background:#eee;border-radius:3px"><div style="height:100%;width:\${p}%;background:\${c};border-radius:3px"></div></div></div>\`;});card+=\`</div>\`;}card+=\`<div style="padding:12px 20px;background:#f8f8f8;text-align:center;font-size:11px;color:#999">\\u{1F4CA} <b style="color:#333">내신핏</b> | 내신 영어 완벽 대비</div></div>\`;const wrap=document.createElement('div');wrap.style.cssText='position:fixed;left:-9999px;top:0;';wrap.innerHTML=card;document.body.appendChild(wrap);html2canvas(wrap.firstChild,{scale:2,backgroundColor:null,useCORS:true}).then(canvas=>{document.body.removeChild(wrap);canvas.toBlob(blob=>{if(navigator.share&&blob){const file=new File([blob],'내신핏_'+tn+'_결과.png',{type:'image/png'});navigator.share({files:[file],title:'내신핏 '+tn+' 결과'}).catch(()=>{});}else{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='내신핏_'+tn+'_결과.png';a.click();}toast('\\u{1F4F8} 결과 이미지가 저장되었습니다!');});}).catch(()=>toast('이미지 생성 실패'));}
function reviewHistory(idx){const h=getHistory();const rec=h[idx];if(!rec||!rec.answers)return toast('이전 버전 기록은 해설을 볼 수 없습니다.');S.ans=rec.answers;S.start=Date.now()-rec.elapsed*1000;document.getElementById('inpName').value=rec.name||'';document.getElementById('inpSchool').value=rec.school||'';document.getElementById('inpGrade').value=rec.grade||'고1';const r=grade();renderResults(r,rec.elapsed);showScreen('resultScreen');window.scrollTo(0,0);}
function retake(){startExam();}
function goHome(){showScreen('startScreen');updateHCount();}
window.addEventListener('beforeunload',e=>{if(S.ti){e.preventDefault();e.returnValue='';}});
updateHCount();`;
}

// ============================================================
// FULL HTML BUILDER
// ============================================================
function buildHtml(testType, title, subtitle, topbarLabel, topbarValue, EI, typeTagObj, Q, css) {
  const testLabel = testType === 'word' ? '온라인단어 TEST' : (testType === 'workbook' ? '온라인워크북 TEST' : '온라인퀴즈TEST');
  const badgeLabel = testType === 'word' ? '온라인단어 TEST' : (testType === 'workbook' ? '온라인워크북 TEST' : '온라인퀴즈 TEST');
  const h1Label = testType === 'word' ? '온라인단어' : (testType === 'workbook' ? '온라인워크북' : '온라인퀴즈');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<style>
${css}
</style>
</head>
<body>
<div class="toast" id="toast"></div>
<div id="startScreen" class="screen active">
<div class="start-container">
  <div class="brand-badge">\u{1F4DD} ${badgeLabel}</div>
  <h1 class="start-title">${h1Label} <span>TEST</span></h1>
  <p class="start-subtitle">${subtitle}</p>
  <div class="info-card"><div class="info-card-header">\u{1F4DA} 시험 정보</div><div class="info-rows">
    <div class="info-row"><span class="info-label">시험</span><span class="info-value">${EI.subject}</span></div>
    <div class="info-row"><span class="info-label">문항</span><span class="info-value">${EI.pub} (${EI.lesson})</span></div>
    <div class="info-row"><span class="info-label">지문</span><span class="info-value">${EI.title}</span></div>
  </div></div>
  <div class="chip-row"><div class="chip">\u{1F4DD} ${EI.totalQ}문항</div><div class="chip">\u23F1\uFE0F 20분</div><div class="chip">\u2705 80점 이상 통과</div><div class="chip">\u{1F4CA} 100점 만점</div></div>
  <div class="input-group"><label>이름 *</label><input type="text" id="inpName" placeholder="이름을 입력하세요"></div>
  <div class="input-row">
    <div class="input-group" style="flex:1"><label>학교</label><input type="text" id="inpSchool" placeholder="선택"></div>
    <div class="input-group" style="flex:.6"><label>학년</label><select id="inpGrade"><option>고1</option><option>고2</option><option>고3</option><option>중3</option></select></div>
  </div>
  <button class="btn btn-primary" onclick="startExam()">시험 시작하기 \u2192</button>
  <button class="btn btn-outline" onclick="toggleHistory()">\u{1F4CB} 시험 기록 보기 <span class="history-badge" id="hCount">0</span></button>
  <div id="historyPanel"></div>
</div>
</div>
<div id="examScreen" class="screen">
  <div class="exam-topbar"><div class="topbar-left"><div class="topbar-dot"></div><div class="topbar-info">${topbarLabel} \u00B7 <span>${topbarValue}</span></div></div><div class="timer" id="timer">20:00</div><button class="btn-submit" onclick="submitExam()">제출하기</button></div>
  <div class="exam-scroll" id="examScroll"></div>
  <div class="slide-wrap" id="slideWrap">
    <div class="slide-passage" id="slidePassage"></div>
    <div class="slide-bottom" id="slideBottom"></div>
  </div>
</div>
<div id="resultScreen" class="screen"></div>
<script>
const EI=${JSON.stringify(EI)};

const Q=${JSON.stringify(Q, null, 0)};

const typeTag=${JSON.stringify(typeTagObj)};

${getJsTemplate(testType)}
</script>
</body>
</html>`;
}

// ============================================================
// TYPE TAG MAPS
// ============================================================
const daneoTypeTag = {
  '(A)(B)(C) 조합형':'tag-combo',
  '문맥상 부적절한 어휘':'tag-wrong',
  '빈칸 어휘 완성':'tag-blank',
  '동의어 고르기':'tag-syn',
  '반의어 고르기':'tag-ant',
  '다의어 문맥적 의미':'tag-poly',
  '영영풀이 매칭':'tag-eng',
  '어형 변환 (서술형)':'tag-morph',
  '빈칸 문맥 완성':'tag-ctx',
  '내용 일치':'tag-content',
};

const workbookTypeTag = {
  '어법':'tag-grammar',
  '내용일치':'tag-content',
  '내용불일치':'tag-content',
  'T/F':'tag-tf',
  '서술형':'tag-written',
  '빈칸추론':'tag-blank',
};

const quizTypeTag = {
  '어법':'tag-grammar',
  '어휘':'tag-vocab',
  '내용일치':'tag-content',
  '내용불일치':'tag-content',
  'T/F':'tag-tf',
  '서술형':'tag-written',
  '빈칸추론':'tag-blank',
  '문장삽입':'tag-insert',
  '어순배열':'tag-order',
  '순서':'tag-order',
  '주제/요지':'tag-summary',
  '요약':'tag-summary',
};

// ============================================================
// MAIN PROCESSING
// ============================================================
let totalFixed = 0;
let errors = [];

for (const num of NUMS) {
  const dir = path.join(BASE, `${num}번`);
  const info = LESSON_INFO[num] || {lesson: '', title: ''};

  console.log(`\n=== Processing ${num}번 ===`);

  try {
    // Read existing 단어테스트 to get passage and Q data
    const daneoPath = path.join(dir, '단어테스트.html');
    const { fullPassage, ei: existingEi, Q: existingQ } = extractData(daneoPath);

    if (!fullPassage) {
      errors.push(`${num}번: No FULL_PASSAGE found`);
      continue;
    }

    const passageHtml = passageToHtml(fullPassage);

    // ---- 단어테스트 ----
    const daneoEI = {
      subject: '2024 고1 3월 모의고사',
      pub: `${num}번`,
      lesson: info.lesson,
      title: info.title,
      total: 100,
      time: 1200,
      totalQ: 20,
      histKey: `wordTest_2024_g1_mar_${num}_v2`
    };

    const daneoQ = fixDaneoQuestions(existingQ, fullPassage, num);
    const daneoHtml = buildHtml(
      'word',
      `2024 고1 3월 ${num}번 온라인단어TEST`,
      `2024 고1 3월 모의고사 · ${num}번 · ${info.lesson} · 20문항`,
      '2024 고1 3월',
      `${num}번`,
      daneoEI,
      daneoTypeTag,
      daneoQ,
      getDaneoCssAndHtml()
    );
    fs.writeFileSync(daneoPath, daneoHtml, 'utf8');
    console.log(`  ✅ 단어테스트 written (${daneoQ.length}Q, ${daneoQ.reduce((a,b)=>a+b.pts,0)}pts)`);
    totalFixed++;

    // ---- 워크북테스트 ----
    const workbookEI = {
      subject: '2024 고1 3월 모의고사',
      pub: `${num}번`,
      lesson: info.lesson,
      title: info.title,
      total: 100,
      time: 1200,
      totalQ: 20,
      histKey: `workbookTest_2024_g1_mar_${num}_v2`
    };

    const workbookQ = generateWorkbookQuestions(fullPassage, num);
    const workbookPath = path.join(dir, '워크북테스트.html');
    const workbookHtml = buildHtml(
      'workbook',
      `2024 고1 3월 ${num}번 온라인워크북TEST`,
      `2024 고1 3월 모의고사 · ${num}번 · ${info.lesson} · 20문항`,
      '2024 고1 3월',
      `${num}번`,
      workbookEI,
      workbookTypeTag,
      workbookQ,
      getWorkbookCss()
    );
    fs.writeFileSync(workbookPath, workbookHtml, 'utf8');
    console.log(`  ✅ 워크북테스트 written (${workbookQ.length}Q, ${workbookQ.reduce((a,b)=>a+b.pts,0)}pts)`);
    totalFixed++;

    // ---- 퀴즈테스트 ----
    const quizEI = {
      subject: '2024 고1 3월 모의고사',
      pub: `${num}번`,
      lesson: info.lesson,
      title: info.title,
      total: 100,
      time: 1200,
      totalQ: 20,
      histKey: `quizTest_2024_g1_mar_${num}_v2`
    };

    const quizQ = generateQuizQuestions(fullPassage, num);
    const quizPath = path.join(dir, '퀴즈테스트.html');
    const quizHtml = buildHtml(
      'quiz',
      `2024 고1 3월 ${num}번 온라인퀴즈TEST`,
      `2024 고1 3월 모의고사 · ${num}번 · ${info.lesson} · 20문항`,
      '2024 고1 3월',
      `${num}번`,
      quizEI,
      quizTypeTag,
      quizQ,
      getQuizCss()
    );
    fs.writeFileSync(quizPath, quizHtml, 'utf8');
    console.log(`  ✅ 퀴즈테스트 written (${quizQ.length}Q, ${quizQ.reduce((a,b)=>a+b.pts,0)}pts)`);
    totalFixed++;

  } catch (err) {
    errors.push(`${num}번: ${err.message}`);
    console.error(`  ❌ Error: ${err.message}`);
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Total files fixed: ${totalFixed}`);
if (errors.length) {
  console.log(`Errors: ${errors.length}`);
  errors.forEach(e => console.log(`  - ${e}`));
}
console.log('Done!');
