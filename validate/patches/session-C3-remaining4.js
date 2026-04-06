#!/usr/bin/env node
/**
 * 세션 C-3: 나머지 4파일(23번/워크북, 23번/단어, 26번/단어, 29번/단어) CAO-1 + TSM-1 + ESC-1 정정
 * 이 파일들은 콘텐츠 자체는 정상이지만 분석 마커 순서/stem 키워드/이스케이프만 정리
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = path.join(ROOT, 'data/모의고사/고1/3월_2024');

const FILES = [
  '23번/워크북.json','23번/단어.json','26번/단어.json','29번/단어.json'
];

const TYPE_STEM_KW = {
  '내용이해': '글의 <b>내용</b>에 비추어, ',
  '내용 이해': '글의 <b>내용</b>에 비추어, ',
  '내용일치': '다음 중 글의 <b>내용</b>과 <b>일치하는</b> 것은? ',
  '내용불일치': '다음 중 글의 <b>내용</b>과 <b>일치하지 않는</b> 것은? ',
  '함축의미 추론': '밑줄 친 부분이 <b>의미</b>하는 바로 가장 적절한 것을 고르시오.\n\n',
  '함축의미': '밑줄 친 부분이 <b>의미</b>하는 바로 가장 적절한 것을 고르시오.\n\n',
  '주제': '이 글의 <b>주제</b>로 가장 적절한 것은?\n\n',
  '요지': '이 글의 <b>요지</b>로 가장 적절한 것은?\n\n',
};

function reorderAnalysis(analysis, ch) {
  if (!analysis || !Array.isArray(ch)) return analysis;
  const markerMap = { '①': 0, '②': 1, '③': 2, '④': 3, '⑤': 4 };
  const parts = analysis.split(/(?=[①②③④⑤])/);
  const byIdx = {};
  parts.forEach(p => {
    const m = p.match(/^([①②③④⑤])/);
    if (m) byIdx[markerMap[m[1]]] = p.trim();
  });
  const markers = ['①','②','③','④','⑤'];
  const out = [];
  for (let i = 0; i < ch.length; i++) {
    const old = byIdx[i];
    if (old) {
      out.push(old.replace(/^[①②③④⑤]/, markers[i]));
    }
  }
  return out.length === ch.length ? out.join(' ') : analysis;
}

FILES.forEach(fname => {
  const fp = path.join(BASE, fname);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  // escape cleanup
  if (typeof data.fullPassage === 'string') {
    data.fullPassage = data.fullPassage.replace(/\\([①②③④⑤—])/g, '$1');
  }
  data.questions.forEach(q => {
    ['passage','stem','wa'].forEach(k => {
      if (typeof q[k] === 'string') q[k] = q[k].replace(/\\([①②③④⑤—])/g, '$1');
    });
    if (Array.isArray(q.ch)) {
      q.ch = q.ch.map(c => typeof c === 'string' ? c.replace(/\\([①②③④⑤—])/g, '$1') : c);
    }
    // CAO-1: analysis 마커 재정렬
    if (q.det && typeof q.det.analysis === 'string' && Array.isArray(q.ch) && q.ch.length >= 2) {
      q.det.analysis = reorderAnalysis(q.det.analysis, q.ch);
    }
    // TSM-1: stem에 키워드 없으면 prepend
    const typeNorm = (q.type || '').trim();
    const prefix = TYPE_STEM_KW[typeNorm];
    if (prefix && typeof q.stem === 'string') {
      const kwMap = {
        '내용이해': ['내용','일치'],
        '내용 이해': ['내용','일치'],
        '내용일치': ['일치','내용'],
        '내용불일치': ['일치','내용'],
        '함축의미 추론': ['밑줄','의미','함축'],
        '함축의미': ['밑줄','의미','함축'],
        '주제': ['주제'],
        '요지': ['요지'],
      };
      const kws = kwMap[typeNorm];
      if (kws && !kws.some(kw => q.stem.includes(kw))) {
        q.stem = prefix + q.stem;
      }
    }
  });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('[CLEAN4]', fname);
});
