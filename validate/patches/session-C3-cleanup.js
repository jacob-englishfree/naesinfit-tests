#!/usr/bin/env node
/**
 * 세션 C-3 cleanup:
 * 1) TSM-1 해소: "내용이해" type의 stem에 "내용" 키워드 추가
 * 2) ESC-1 해소: passage/stem의 "\①..④" 이스케이프 → "①..④"
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = path.join(ROOT, 'data/모의고사/고1/3월_2024');

const FILES = [
  '23번/퀴즈.json','24번/단어.json','24번/퀴즈.json',
  '26번/워크북.json','26번/퀴즈.json','29번/워크북.json','29번/퀴즈.json'
];

const TYPE_STEM_KW = {
  '내용이해': ['내용','일치'],
  '내용 이해': ['내용','일치'],
  '내용일치': ['일치'],
  '내용불일치': ['일치'],
  '함축의미 추론': ['밑줄','의미','함축'],
  '함축의미': ['밑줄','의미','함축'],
  '주제': ['주제'],
  '요지': ['요지'],
};

let totalFiles = 0, tsmFixed = 0, escFixed = 0;

FILES.forEach(fname => {
  const fp = path.join(BASE, fname);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let modified = false;

  data.questions.forEach(q => {
    const typeNorm = (q.type || '').trim();

    // ESC-1: escape residual 제거
    const fields = ['passage','stem','wa'];
    fields.forEach(k => {
      if (typeof q[k] === 'string' && /\\[①②③④⑤]/.test(q[k])) {
        q[k] = q[k].replace(/\\([①②③④⑤])/g, '$1');
        escFixed++;
        modified = true;
      }
    });
    if (Array.isArray(q.ch)) {
      q.ch = q.ch.map(c => typeof c === 'string' ? c.replace(/\\([①②③④⑤])/g, '$1') : c);
    }

    // TSM-1: stem에 키워드 추가
    const rule = TYPE_STEM_KW[typeNorm];
    if (rule && typeof q.stem === 'string') {
      const hasAny = rule.some(kw => q.stem.includes(kw));
      if (!hasAny) {
        // 내용이해류: stem 앞에 "글의 내용에 비추어, " 추가
        if (['내용이해','내용 이해'].includes(typeNorm)) {
          q.stem = '글의 <b>내용</b>에 비추어, ' + q.stem;
        } else if (typeNorm === '함축의미 추론' || typeNorm === '함축의미') {
          q.stem = '밑줄 친 부분이 <b>의미</b>하는 바로 가장 적절한 것을 고르시오.\n\n' + q.stem;
        } else if (typeNorm === '주제') {
          q.stem = '이 글의 <b>주제</b>로 가장 적절한 것은?\n\n' + q.stem;
        } else if (typeNorm === '요지') {
          q.stem = '이 글의 <b>요지</b>로 가장 적절한 것은?\n\n' + q.stem;
        }
        tsmFixed++;
        modified = true;
      }
    }
  });

  if (modified) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    totalFiles++;
    console.log('[CLEANED]', fname);
  }
});

console.log(`\n파일 ${totalFiles}개 수정. TSM-1 수정: ${tsmFixed}, ESC-1 수정: ${escFixed}`);
