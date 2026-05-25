#!/usr/bin/env node
/**
 * fix-dc3-manual.js — DC-3 수동 교체 일괄 적용
 * 정답 위치의 원문 단어를 문맥상 부적절한 반의어/부적합어로 교체
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// DC-3 교체 맵: [파일, Q번호, 원래단어, 교체단어, 교체단어뜻, 원문단어뜻]
const FIXES = [
  // 3월_2024
  ['data/모의고사/고1/3월_2024/21번/단어.json', 4, 'doubt', 'certainty', '확실함', '의심'],
  ['data/모의고사/고1/3월_2024/30번/단어.json', 4, 'limited', 'boundless', '무한한', '제한된'],
  ['data/모의고사/고1/3월_2024/30번/단어.json', 6, 'process', 'obstacle', '장애물', '과정'],
  ['data/모의고사/고1/3월_2024/31번/단어.json', 3, 'climatic', 'trivial', '사소한', '기후의'],
  ['data/모의고사/고1/3월_2024/32번/단어.json', 3, 'discourage', 'motivate', '동기를 부여하다', '낙담시키다'],
  ['data/모의고사/고1/3월_2024/32번/단어.json', 4, 'boss', 'subordinate', '부하', '상사'],
  ['data/모의고사/고1/3월_2024/33번/단어.json', 3, 'animal', 'mineral', '광물', '동물'],
  ['data/모의고사/고1/3월_2024/33번/단어.json', 4, 'characteristics', 'similarities', '유사점', '특성'],
  ['data/모의고사/고1/3월_2024/41번/퀴즈.json', 6, 'similar', 'opposing', '대립하는', '유사한'],
  // 3월_2025
  ['data/모의고사/고1/3월_2025/31번/단어.json', 4, 'abstract', 'concrete', '구체적인', '추상적인'],
  ['data/모의고사/고1/3월_2025/31번/단어.json', 5, 'drawings', 'erasures', '지움', '그림'],
  ['data/모의고사/고1/3월_2025/31번/단어.json', 6, 'somehow', 'predictably', '예측 가능하게', '어떻게든'],
  ['data/모의고사/고1/3월_2025/32번/단어.json', 4, 'emotional', 'rational', '이성적인', '감정적인'],
  ['data/모의고사/고1/3월_2025/32번/단어.json', 5, 'reflect', 'distort', '왜곡하다', '반영하다'],
  ['data/모의고사/고1/3월_2025/32번/단어.json', 6, 'justify', 'condemn', '비난하다', '정당화하다'],
  ['data/모의고사/고1/3월_2025/33번/퀴즈.json', 5, 'objective', 'biased', '편향된', '객관적인'],
  ['data/모의고사/고1/3월_2025/40번/퀴즈.json', 4, 'linear', 'chaotic', '혼란스러운', '선형의'],
  ['data/모의고사/고1/3월_2025/40번/퀴즈.json', 5, 'creative', 'imitative', '모방적인', '창의적인'],
  ['data/모의고사/고1/3월_2025/41-42번/단어.json', 5, 'future', 'past', '과거', '미래'],
  // 3월_2026
  ['data/모의고사/고1/3월_2026/21번/단어.json', 6, 'also', 'never', '절대 ~않다', '또한'],
  ['data/모의고사/고1/3월_2026/31번/단어.json', 6, 'their', 'our', '우리의', '그들의'],
  ['data/모의고사/고1/3월_2026/35번/단어.json', 4, 'fat', 'lean', '살코기의', '지방'],
  ['data/모의고사/고1/3월_2026/37번/단어.json', 4, 'World', 'Local', '지역의', '세계의'],
  ['data/모의고사/고1/3월_2026/38번/단어.json', 4, 'sensible', 'reckless', '무모한', '합리적인'],
  ['data/모의고사/고1/3월_2026/39번/단어.json', 4, 'second', 'primary', '주요한', '두 번째의'],
  ['data/모의고사/고1/3월_2026/40번/단어.json', 4, 'change', 'preserve', '보존하다', '변화시키다'],
  ['data/모의고사/고1/3월_2026/40번/단어.json', 6, 'malls', 'forests', '숲', '쇼핑몰'],
  ['data/모의고사/고1/3월_2026/41-42번/단어.json', 4, 'civil', 'military', '군사적인', '시민의'],
  ['data/모의고사/고1/3월_2026/43-45번/단어.json', 4, 'that', 'which', '그것은', '그것은'],
  ['data/모의고사/고1/3월_2026/43-45번/단어.json', 5, 'replied', 'ignored', '무시했다', '대답했다'],
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let totalFixed = 0;
let filesModified = new Set();

for (const [relPath, qId, oldWord, newWord, newMeaning, oldMeaning] of FIXES) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    console.log(`[SKIP] ${relPath} — file not found`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  const q = data.questions.find(q => q.id === qId);
  if (!q) {
    console.log(`[SKIP] ${relPath} Q${qId} — question not found`);
    continue;
  }

  // Find which marker has the answer word
  const ansIdx = q.ans - 1; // 0-based
  let changed = false;

  // 1. Replace in passage
  if (q.passage) {
    // Find the marker that has the old word
    const markerRegex = new RegExp(`([①②③④⑤])\\s*<u>${escapeRegex(oldWord)}</u>`, 'g');
    const match = markerRegex.exec(q.passage);
    if (match) {
      q.passage = q.passage.replace(
        `${match[1]}<u>${oldWord}</u>`,
        `${match[1]}<u>${newWord}</u>`
      );
      changed = true;
    } else {
      // Try without marker (word might be in passage without marker for some types)
      console.log(`[WARN] ${relPath} Q${qId}: marker+<u>${oldWord}</u> not found in passage`);
    }
  }

  // 2. Replace in ch array
  if (q.ch && Array.isArray(q.ch)) {
    const idx = q.ch.indexOf(oldWord);
    if (idx >= 0) {
      q.ch[idx] = newWord;
      changed = true;
    } else {
      // Check if ch uses marker format
      for (let i = 0; i < q.ch.length; i++) {
        if (q.ch[i].includes(oldWord)) {
          q.ch[i] = q.ch[i].replace(oldWord, newWord);
          changed = true;
          break;
        }
      }
    }
  }

  // 3. Update det.analysis
  if (q.det && q.det.analysis) {
    // Replace the answer marker explanation
    q.det.analysis = q.det.analysis.replace(
      new RegExp(escapeRegex(oldWord), 'g'),
      newWord
    );
    // Add proper explanation if not already there
    if (!q.det.analysis.includes(oldMeaning)) {
      // Find the ← marker line and update
      q.det.analysis = q.det.analysis.replace(
        /←정답/,
        `(${newMeaning}) → ${oldWord}(${oldMeaning}) ←정답`
      );
    }
  }

  // 4. Update det.korean
  if (q.det && q.det.korean) {
    q.det.korean = q.det.korean.replace(
      new RegExp(escapeRegex(oldWord), 'g'),
      newWord
    );
  }

  if (changed) {
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    totalFixed++;
    filesModified.add(relPath);
    console.log(`[FIX] ${relPath} Q${qId}: "${oldWord}" → "${newWord}"`);
  } else {
    console.log(`[SKIP] ${relPath} Q${qId}: no changes made`);
  }
}

console.log(`\n=== Total: ${totalFixed} fixes in ${filesModified.size} files ===`);
