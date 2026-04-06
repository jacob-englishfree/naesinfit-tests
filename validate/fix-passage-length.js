#!/usr/bin/env node
/**
 * fix-passage-length.js — passage 문장 수 부족한 문항 자동 확장
 * fullPassage에서 인접 문장을 찾아 passage 앞/뒤에 추가
 */
const fs = require('fs');

function countSentences(text) {
  if (!text) return 0;
  // HTML 태그 제거
  const clean = text.replace(/<[^>]+>/g, '');
  // 문장 분리 (. ! ? 뒤)
  const sentences = clean.split(/[.!?]+\s+/).filter(s => s.trim().length > 5);
  return sentences.length;
}

function expandPassage(passage, fullPassage, targetSentences) {
  if (!passage || !fullPassage) return passage;
  const current = countSentences(passage);
  if (current >= targetSentences) return passage;

  // passage의 핵심 텍스트(HTML 제거) 찾기
  const cleanPassage = passage.replace(/<[^>]+>/g, '').trim();
  if (cleanPassage.length < 10) return passage;

  // fullPassage에서 passage의 첫 몇 단어 위치 찾기
  const firstWords = cleanPassage.split(/\s+/).slice(0, 5).join(' ');
  const idx = fullPassage.indexOf(firstWords);
  if (idx === -1) return passage;

  // 마지막 몇 단어
  const lastWords = cleanPassage.split(/\s+/).slice(-5).join(' ');
  const lastIdx = fullPassage.indexOf(lastWords, idx);
  if (lastIdx === -1) return passage;

  const endIdx = lastIdx + lastWords.length;

  // 문장 경계를 찾아 앞/뒤로 확장
  const needed = targetSentences - current;
  const sentences = fullPassage.split(/([.!?]+\s+)/);
  // 문장별 누적 offset 계산
  let offset = 0;
  let startSentIdx = -1, endSentIdx = -1;
  const sentenceOffsets = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const sentStart = offset;
    offset += (sentences[i] || '').length + (sentences[i+1] || '').length;
    sentenceOffsets.push({ start: sentStart, end: offset, text: sentences[i] });
    if (sentStart <= idx && offset > idx && startSentIdx === -1) startSentIdx = i/2;
    if (sentStart < endIdx && offset >= endIdx && endSentIdx === -1) endSentIdx = i/2;
  }
  if (startSentIdx === -1 || endSentIdx === -1) return passage;

  // 앞/뒤로 needed만큼 확장
  const addBefore = Math.ceil(needed / 2);
  const addAfter = needed - addBefore;
  const newStart = Math.max(0, startSentIdx - addBefore);
  const newEnd = Math.min(sentenceOffsets.length - 1, endSentIdx + addAfter);

  const newStartOffset = sentenceOffsets[newStart].start;
  const newEndOffset = sentenceOffsets[newEnd].end;

  // passage의 HTML 마커는 유지, 앞뒤만 확장
  const prefix = fullPassage.substring(newStartOffset, idx).trim();
  const suffix = fullPassage.substring(endIdx, newEndOffset).trim();

  let result = passage;
  if (prefix) result = prefix + ' ' + result;
  if (suffix) result = result + ' ' + suffix;

  return result.trim();
}

const files = process.argv.slice(2);
files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = 0;
  data.questions.forEach(q => {
    if (!q.passage || !q.type) return;
    const type = q.type.trim();
    let target = 0;
    if (['(A)(B)(C) 조합형'].includes(type)) target = 5;
    else if (['내용일치', '내용불일치', '내용이해 T/F'].includes(type)) target = 5;
    else if (['동의어 고르기', '반의어 고르기'].includes(type)) target = 3;

    if (target > 0) {
      const current = countSentences(q.passage);
      if (current < target) {
        const expanded = expandPassage(q.passage, data.fullPassage, target);
        if (expanded !== q.passage) {
          q.passage = expanded;
          changed++;
        }
      }
    }
  });
  if (changed > 0) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[FIXED] ${file}: ${changed}문항 passage 확장`);
  } else {
    console.log(`[SKIP] ${file}: 변경 없음`);
  }
});
