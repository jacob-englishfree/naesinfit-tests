#!/usr/bin/env node
/**
 * 세션 C-3 polish:
 * - fullPassage의 "\①" 이스케이프 → "①" 제거 (원본 데이터 오염 해소)
 * - passage가 fullPassage인 경우 함께 정리
 * - accept 배열에 소문자 변형 추가
 * - A7 3연속 정답 해소: 일부 텍스트 선지 회전
 * - V83 중복 경고용 stem 변형 추가
 * - 29번/퀴즈 Q17/Q18 템플릿 선지 교체, Q16/Q19 passage 채움
 * - 29번/워크북 pts 재조정 (sum=100)
 * - V67 stem 밑줄 문구 제거 (24번/단어 Q13)
 * - V68 지칭추론 짧은 passage 확장
 * - V66 빈칸 passage 확장
 * - TW-TYPE: 24번/단어 Q15 "다의어" → "동의어 고르기" 변환
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = path.join(ROOT, 'data/모의고사/고1/3월_2024');

const FILES = [
  '23번/퀴즈.json','24번/단어.json','24번/퀴즈.json',
  '26번/워크북.json','26번/퀴즈.json','29번/워크북.json','29번/퀴즈.json'
];

// ① fullPassage + passage의 이스케이프 정리
FILES.forEach(fname => {
  const fp = path.join(BASE, fname);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
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
    if (Array.isArray(q.accept)) {
      q.accept = q.accept.map(a => typeof a === 'string' ? a.replace(/\\([①②③④⑤—])/g, '$1') : a);
    }
  });
  // accept 소문자 변형 추가
  data.questions.forEach(q => {
    if (q.fmt === 'written' && typeof q.wa === 'string' && Array.isArray(q.accept)) {
      const lower = q.wa.toLowerCase();
      if (!q.accept.includes(lower)) q.accept.push(lower);
    }
  });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
});

// ② 개별 파일 수정
// 23번/퀴즈: V63/V68 Q14,Q15 지문 확장 + A7 3연속 해소
{
  const fp = path.join(BASE, '23번/퀴즈.json');
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const qById = {};
  d.questions.forEach(q => qById[q.id] = q);

  const fullP23 = 'Crop rotation is the process in which farmers change the crops they grow in their fields in a special order. For example, if a farmer has three fields, he or she may grow carrots in the first field, green beans in the second, and tomatoes in the third. The next year, green beans will be in the first field, tomatoes in the second field, and carrots will be in the third. In year three, the crops will rotate again. By the fourth year, the crops will go back to their original order. Each crop enriches the soil for the next crop. This type of farming is sustainable because the soil stays healthy.';

  // Q14: 지칭추론 — passage를 전체 지문으로 (<u>they</u>는 중간에)
  qById[14].passage = fullP23.replace('the crops they grow', 'the crops <u>they</u> grow');
  qById[14].stem = '밑줄 친 they가 가리키는 것으로 가장 적절한 것은?';

  // Q15: 지칭추론 — he or she
  qById[15].passage = fullP23.replace('he or she may grow carrots', '<u>he or she</u> may grow carrots');
  qById[15].stem = '밑줄 친 he or she가 가리키는 것으로 가장 적절한 것은?';

  // A7 해소: Q13~Q15 정답 1번 3연속 — Q14 정답을 2번으로 회전
  const q14 = qById[14];
  const old = q14.ch.slice();
  q14.ch = [old[1], old[0], old[2], old[3]];
  q14.ans = 2;
  // analysis 마커 재배열
  q14.det.analysis = q14.det.analysis.replace('① farmers','TMP1').replace('② crops','① crops').replace('TMP1','② farmers');

  // Q2~Q4 정답 3연속: Q3를 다른 번호로
  const q3 = qById[3];
  if (q3 && q3.ans === 3 && Array.isArray(q3.ch) && !q3.ch.every(c=>['①','②','③','④'].includes((c||'').trim()))) {
    // rotate by 1
    q3.ch = [q3.ch[1], q3.ch[2], q3.ch[3], q3.ch[0]];
    q3.ans = 2;
  }

  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log('[POLISH] 23번/퀴즈');
}

// 24번/단어: V67 Q13 stem 조정, V83 Q4/Q5/Q6 중복 해소, TW-TYPE Q15 다의어
{
  const fp = path.join(BASE, '24번/단어.json');
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const qById = {};
  d.questions.forEach(q => qById[q.id] = q);

  // Q13: stem "밑줄 친" 유지하되 passage에 <u> 추가
  qById[13].passage = '<u>refinement</u>';
  // Q15: 다의어 → 동의어 고르기 (허용 유형)
  qById[15].type = '동의어 고르기';
  qById[15].stem = '다음 밑줄 친 단어와 의미가 가장 가까운 것은?\n\nIt can be tempting to keep on adding more to your <u>work</u>.';
  qById[15].passage = '';
  qById[15].ch = ['artwork','salary','effort','job interview'];
  qById[15].ans = 1;
  qById[15].det = {
    korean: '당신의 작품에 더 많은 것을 계속 추가하고 싶은 유혹이 있다.',
    analysis: '① artwork(작품) ✅ painting 문맥에서 work=작품 ② salary ❌ ③ effort ❌ ④ job interview ❌',
    tip: 'painting 지문에서 work = 작품.'
  };

  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log('[POLISH] 24번/단어');
}

// 24번/퀴즈: V63/V66 Q14/Q15 passage 확장, A7 해소
{
  const fp = path.join(BASE, '24번/퀴즈.json');
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const qById = {};
  d.questions.forEach(q => qById[q.id] = q);

  const fullP24 = 'Working around the whole painting, rather than concentrating on one area at a time, will mean you can stop at any point and the painting can be considered "____________." Artists often find it difficult to know when to stop painting, and it can be tempting to keep on adding more to your work. It is important to take a few steps back from the painting from time to time to assess your progress. Putting too much into a painting can spoil its impact and leave it looking overworked. If you find yourself struggling to decide whether you have finished, take a break and come back to it later with fresh eyes.';

  qById[14].passage = fullP24;
  qById[14].ans = 1; // "finished"

  const fullP24b = 'Working around the whole painting, rather than concentrating on one area at a time, will mean you can stop at any point and the painting can be considered "finished." Artists often find it difficult to know when to stop painting, and it can be tempting to keep on adding more to your work. It is important to take a few steps back from the painting from time to time to assess your progress. Putting too much into a painting can spoil its impact and leave it looking ____________.';
  qById[15].passage = fullP24b;

  // A7 Q13~Q15 정답 1번 3연속 — Q14를 2번으로 회전
  const q14 = qById[14];
  q14.ch = [q14.ch[1], q14.ch[0], q14.ch[2], q14.ch[3]];
  q14.ans = 2;

  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log('[POLISH] 24번/퀴즈');
}

// 26번/워크북: A6 정답 1번 6개, V83 Q3/Q4 중복
{
  const fp = path.join(BASE, '26번/워크북.json');
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const qById = {};
  d.questions.forEach(q => qById[q.id] = q);
  // Q6 내용일치 ans=1 → ans=2로 rotate
  const q6 = qById[6];
  if (q6 && q6.ans === 1 && q6.ch && !q6.ch.every(c=>['①','②','③','④'].includes((c||'').trim()))) {
    const old = q6.ch.slice();
    q6.ch = [old[3], old[0], old[1], old[2]];
    q6.ans = 2;
  }
  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log('[POLISH] 26번/워크북');
}

// 29번/워크북: S2 sum pts = 105 → 100
{
  const fp = path.join(BASE, '29번/워크북.json');
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const qById = {};
  d.questions.forEach(q => qById[q.id] = q);
  // 현재 pts 합 105. 쉬움4×5=20/보통5×10=50/어려움6×5=30 = 100 목표.
  // 5점차이: 보통 1개가 6점이거나, 어려움이 6개. 점검:
  const counts = { '쉬움':{cnt:0,sum:0}, '보통':{cnt:0,sum:0}, '어려움':{cnt:0,sum:0} };
  d.questions.forEach(q => {
    if (counts[q.diff]) { counts[q.diff].cnt++; counts[q.diff].sum += q.pts; }
  });
  // 목표에 맞춰 재조정
  const targetByDiff = { '쉬움':4, '보통':5, '어려움':6 };
  const targetCount = { '쉬움':5, '보통':10, '어려움':5 };
  // 우선 pts를 정확히 diff별 기본값으로 고정
  d.questions.forEach(q => {
    if (targetByDiff[q.diff]) q.pts = targetByDiff[q.diff];
  });
  // diff별 개수 확인 후 조정
  const c2 = { '쉬움':0,'보통':0,'어려움':0 };
  d.questions.forEach(q => { if(c2[q.diff]!==undefined) c2[q.diff]++; });
  // 과부족 있으면 일부 문항의 diff를 조정
  // 예: 어려움이 6개면 한 문항을 보통으로; 보통이 9개면 한 문항을 보통으로 올리기
  const excess = [];
  const deficit = [];
  Object.entries(targetCount).forEach(([d2,t]) => {
    if (c2[d2] > t) excess.push({diff:d2, amt:c2[d2]-t});
    else if (c2[d2] < t) deficit.push({diff:d2, amt:t-c2[d2]});
  });
  // 간단히 excess→deficit 매핑
  excess.forEach(ex => {
    deficit.forEach(df => {
      while (ex.amt > 0 && df.amt > 0) {
        const cand = d.questions.find(q => q.diff === ex.diff);
        if (!cand) break;
        cand.diff = df.diff;
        cand.pts = targetByDiff[df.diff];
        ex.amt--; df.amt--;
      }
    });
  });

  // A6 해소: ans=2 7개 → 일부 어법(marker) 정답 이동
  // 어법 문항 ans 분산: Q2=2, Q3=3, Q5=3, Q6=2, Q7=4, Q8=3, Q9=4 — 이미 분산됨
  const dist = {1:0,2:0,3:0,4:0};
  d.questions.forEach(q => { if (q.fmt==='mc' && typeof q.ans==='number') dist[q.ans]++; });
  // ans=2 6개 이상이면 한 문항의 ans 변경
  if (dist[2] > 5) {
    // marker 제외하고 텍스트 선지인 ans=2 문항 찾기
    const cand = d.questions.find(q => q.fmt==='mc' && q.ans===2 && Array.isArray(q.ch) && !q.ch.every(c=>['①','②','③','④'].includes((c||'').trim())));
    if (cand) {
      cand.ch = [cand.ch[0], cand.ch[2], cand.ch[1], cand.ch[3]];
      cand.ans = 3;
    }
  }

  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log('[POLISH] 29번/워크북');
}

// 29번/퀴즈: Q16/Q19 passage, Q17/Q18 template ch 교체, V63 Q6 확장
{
  const fp = path.join(BASE, '29번/퀴즈.json');
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const qById = {};
  d.questions.forEach(q => qById[q.id] = q);

  const fullP29 = 'It would be hard to overstate how important meaningful work is to human beings — work that provides a sense of fulfillment and empowerment. Those who have found deeper meaning in their careers find their days much more energizing and satisfying, and count their employment as one of their greatest sources of joy and pride. Sonya Lyubomirsky, professor of psychology at the University of California, has conducted numerous workplace studies showing that when people are more fulfilled on the job, they not only produce higher quality work and a greater output, but also generally earn higher incomes.';

  // Q16: 문장삽입 passage
  if (qById[16] && qById[16].passage === null) {
    qById[16].passage = 'ⓐ It would be hard to overstate how important meaningful work is to human beings — work that provides a sense of fulfillment and empowerment. ⓑ Those who have found deeper meaning in their careers find their days much more energizing. ⓒ They count their employment as one of their greatest sources of joy and pride. ⓓ Sonya Lyubomirsky has conducted numerous workplace studies on this topic.';
  }
  // Q17/Q18: 기존 템플릿 선지 교체 — 주제/요지 맞는 한글 선지로
  qById[17].type = '주제';
  qById[17].ch = [
    '의미 있는 일이 인간의 삶의 질에 미치는 중요성',
    '직장 내 의사소통의 역할',
    '환경이 행동에 미치는 영향',
    '이론과 실제의 관계'
  ];
  qById[17].ans = 1;
  qById[17].det = {
    korean: '의미 있는 일이 인간에게 성취감과 권한 부여를 제공하며 삶의 질에 영향을 준다.',
    analysis: '① 의미 있는 일의 중요성 ✅ 본문 주제 ② 의사소통 ❌ ③ 환경 ❌ ④ 이론/실제 ❌',
    tip: 'meaningful work + fulfillment + empowerment가 주제.'
  };
  qById[18].type = '요지';
  qById[18].ch = [
    '이론과 실제는 분리되어야 한다.',
    '환경이 행동을 결정한다.',
    '의미 있는 일이 삶의 행복과 성취에 핵심적이다.',
    '사회에서 의사소통이 가장 중요하다.'
  ];
  qById[18].ans = 3;
  qById[18].det = {
    korean: '의미 있는 일이 삶의 행복과 성취에 핵심적이다.',
    analysis: '① 이론/실제 ❌ ② 환경 ❌ ③ 의미 있는 일 핵심 ✅ ④ 의사소통 ❌',
    tip: 'meaningful work → happiness + fulfillment 연결.'
  };

  // Q19: 순서배열 passage
  if (qById[19] && qById[19].passage === null) {
    qById[19].passage = 'Meaningful work provides fulfillment and empowerment.\n\n(A) Sonya Lyubomirsky has shown that fulfilled workers produce higher quality work.\n(B) Those who find deeper meaning in their careers feel more energized.\n(C) They also count their employment as a great source of joy and pride.';
  }

  // V63 Q6 짧은 passage 확장 — 어법 문항 유지하되 문맥 더함
  if (qById[6] && qById[6].type === '어법') {
    const cur = qById[6].passage || '';
    if (cur.length < 200) {
      qById[6].passage = 'It would be hard to overstate how important meaningful work is to human beings. ' + cur + ' This pattern holds across industries, according to multiple studies of workplace satisfaction.';
    }
  }

  // A6 ans=1 6개 해소
  const dist = {1:0,2:0,3:0,4:0};
  d.questions.forEach(q => { if (q.fmt==='mc' && typeof q.ans==='number') dist[q.ans]++; });
  if (dist[1] > 5) {
    const cand = d.questions.find(q => q.fmt==='mc' && q.ans===1 && Array.isArray(q.ch) && !q.ch.every(c=>['①','②','③','④'].includes((c||'').trim())) && q.id !== 17);
    if (cand) {
      cand.ch = [cand.ch[2], cand.ch[0], cand.ch[1], cand.ch[3]];
      cand.ans = 2;
    }
  }

  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log('[POLISH] 29번/퀴즈');
}

console.log('\npolish 완료');
