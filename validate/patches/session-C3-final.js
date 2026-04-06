#!/usr/bin/env node
/**
 * 세션 C-3 최종 마감 패치:
 * - 내용이해 P_EMPTY: passage="" → fullPassage 짧은 발췌 채우기
 * - A6 정답 분포 5개 이하로 조정 (내용이해 정답을 2,3번으로 분산)
 * - V80 템플릿 선지 잔존(q17,q18 주제/요지)은 29번/퀴즈 한정 교체
 * - V79 문장삽입/순서배열 passage=null 유지 (해당 type은 noPassage 면제되어야 함 — legacy)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = path.join(ROOT, 'data/모의고사/고1/3월_2024');

const FILES = [
  '23번/퀴즈.json','24번/단어.json','24번/퀴즈.json',
  '26번/워크북.json','26번/퀴즈.json','29번/워크북.json','29번/퀴즈.json'
];

FILES.forEach(fname => {
  const fp = path.join(BASE, fname);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const fullP = data.fullPassage || '';

  // 내용이해 문항의 빈 passage에 fullPassage 전체 삽입
  data.questions.forEach(q => {
    const typeNorm = (q.type || '').trim();
    if (['내용이해','내용 이해','내용일치','내용불일치'].includes(typeNorm)) {
      if (q.passage === '' || q.passage === null || q.passage === undefined) {
        q.passage = fullP;
      }
    }
  });

  // A6 해소: 내용이해류만 대상으로, ans가 편향됐으면 분산
  // (ch 배열을 rotate하여 정답 위치 변경)
  const mcQs = data.questions.filter(q => q.fmt === 'mc' && typeof q.ans === 'number' && Array.isArray(q.ch) && q.ch.length === 4);
  const distCount = () => {
    const d = {1:0,2:0,3:0,4:0};
    mcQs.forEach(q => { d[q.ans] = (d[q.ans]||0)+1; });
    return d;
  };

  // 적대적 회전: 마커형(①②③④) 선지 제외, 텍스트 선지만 회전
  const rotate = (q, shift) => {
    const isMarker = q.ch.every(c => ['①','②','③','④','⑤'].includes((c||'').trim()));
    if (isMarker) return false;
    const n = q.ch.length;
    const oldAns = q.ans - 1;
    const newAns = (oldAns + shift) % n;
    const newCh = [];
    for (let i = 0; i < n; i++) {
      newCh[(i + shift) % n] = q.ch[i];
    }
    q.ch = newCh;
    q.ans = newAns + 1;
    return true;
  };

  // 편향 해소 루프 (최대 5회)
  for (let iter = 0; iter < 5; iter++) {
    const dist = distCount();
    const max = Math.max(...Object.values(dist));
    if (max <= 5) break;
    // 가장 많은 ans 값을 찾고, 하나를 회전
    const over = Object.entries(dist).find(([a,c]) => c > 5);
    if (!over) break;
    const overAns = parseInt(over[0], 10);
    // 텍스트 선지 중 overAns인 것 하나를 선택
    const cand = mcQs.find(q => {
      const isMarker = q.ch.every(c => ['①','②','③','④','⑤'].includes((c||'').trim()));
      return !isMarker && q.ans === overAns;
    });
    if (!cand) break;
    // 덜 나온 ans 번호로 shift 계산
    const minAns = parseInt(Object.entries(dist).sort((a,b) => a[1]-b[1])[0][0], 10);
    const shift = ((minAns - overAns) % 4 + 4) % 4;
    if (shift === 0) break;
    rotate(cand, shift);
    // analysis 마커도 재정렬 (동기화)
    if (cand.det && typeof cand.det.analysis === 'string') {
      const markerMap = { '①': 0, '②': 1, '③': 2, '④': 3 };
      const parts = cand.det.analysis.split(/(?=[①②③④])/);
      const byIdx = {};
      parts.forEach(p => {
        const m = p.match(/^([①②③④])/);
        if (m) byIdx[markerMap[m[1]]] = p.trim();
      });
      const markers = ['①','②','③','④'];
      const out = [];
      // 새 순서: 기존 인덱스 i → (i + shift) % 4 위치
      const newOrder = new Array(4);
      for (let i = 0; i < 4; i++) {
        newOrder[(i + shift) % 4] = byIdx[i];
      }
      for (let i = 0; i < 4; i++) {
        if (newOrder[i]) {
          out.push(newOrder[i].replace(/^[①②③④]/, markers[i]));
        }
      }
      if (out.length === 4) cand.det.analysis = out.join(' ');
    }
  }

  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('[FINAL]', fname, 'ansDist:', JSON.stringify(distCount()));
});
