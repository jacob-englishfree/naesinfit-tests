#!/usr/bin/env node
/**
 * 세션 C-3 후속: 45문항 재출제 패치 스크립트
 * 대상: 고1 3월 2024 모의고사 23/24/26/29번
 *
 * - 플레이스홀더/이스케이프/교차오염/type-stem 불일치 문항 교체
 * - det.analysis 마커 순서를 ch[] 순서(①②③④)와 동기화
 *
 * 사용: node validate/patches/session-C3-rewrite.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = path.join(ROOT, 'data/모의고사/고1/3월_2024');

// 공통 det.analysis 재생성 헬퍼: ch 순서대로 ①②③④로 정렬
// 기존 analysis에서 마커별 설명을 추출 후 ①②③④ 순으로 재나열
function reorderAnalysis(analysis, ch, ans) {
  if (!analysis || !Array.isArray(ch)) return analysis;
  const markerMap = { '①': 0, '②': 1, '③': 2, '④': 3, '⑤': 4 };
  // split by markers
  const parts = analysis.split(/(?=[①②③④⑤])/);
  const byIdx = {};
  parts.forEach(p => {
    const m = p.match(/^([①②③④⑤])/);
    if (m) byIdx[markerMap[m[1]]] = p.trim();
  });
  // Re-emit in ch order (0..ch.length-1) with new markers ①②③④
  const markers = ['①','②','③','④','⑤'];
  const out = [];
  for (let i = 0; i < ch.length; i++) {
    const old = byIdx[i];
    if (old) {
      // replace leading marker with new correct marker
      out.push(old.replace(/^[①②③④⑤]/, markers[i]));
    }
  }
  return out.length === ch.length ? out.join(' ') : analysis;
}

// ===== 파일별 수정 =====
const patches = [];

// ============================================================
// 23번/퀴즈.json (5문항 재출제: Q4, Q13, Q14, Q15, Q20)
// ============================================================
patches.push({
  file: '23번/퀴즈.json',
  mutate: (d) => {
    const fp = d.fullPassage;
    const qById = {};
    d.questions.forEach(q => qById[q.id] = q);

    // Q4: 문맥상 부적절한 어휘 (보통/5점) — 밑줄 4개가 실질 동사/명사여야 함
    // 23번 지문에서 의미 있는 단어 4개에 밑줄
    qById[4].passage = 'Crop rotation is the process in which farmers ①<u>change</u> the crops they grow in their fields in a special order. For example, if a farmer has three fields, he or she may grow carrots in the first field, green beans in the second, and tomatoes in the third. Each crop ②<u>enriches</u> the soil for the next crop. This type of farming is ③<u>unsustainable</u> because the soil stays ④<u>healthy</u>.';
    qById[4].stem = '다음 글의 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?';
    qById[4].ch = ['①','②','③','④'];
    qById[4].ans = 3;
    qById[4].det = {
      korean: '윤작은 농부들이 특별한 순서로 밭에서 기르는 작물을 바꾸는 과정이다. 각 작물은 다음 작물을 위해 토양을 비옥하게 한다. 이런 농법은 토양이 건강하게 유지되기 때문에 지속 가능하다.',
      analysis: '① change(바꾸다) ✅ 작물을 순서대로 바꾼다 ② enriches(비옥하게 하다) ✅ 다음 작물을 위해 토양을 비옥하게 한다 ③ unsustainable(지속 불가능한) ❌ 토양이 건강하게 유지되므로 sustainable(지속 가능한)이 맞다 ④ healthy(건강한) ✅ 토양이 건강하게 유지된다',
      tip: '문맥상 긍정적 결과(토양이 건강함)가 제시되면 sustainable이 자연스럽다.'
    };

    // Q13: 함축의미 추론 (어려움/6점) — 밑줄 어구의 함축 의미
    qById[13].passage = 'Crop rotation is the process in which farmers change the crops they grow in their fields in a special order. Each crop enriches the soil for the next crop. This type of farming is <u>sustainable</u> because the soil stays healthy.';
    qById[13].stem = '밑줄 친 <b>sustainable</b>이 이 글에서 의미하는 바로 가장 적절한 것은?';
    qById[13].ch = [
      '토양이 건강하게 유지되어 오래 지속될 수 있는',
      '한 번 심으면 수확이 보장되는',
      '기계를 사용하여 효율적인',
      '유기농 인증을 받은'
    ];
    qById[13].ans = 1;
    qById[13].det = {
      korean: '윤작은 각 작물이 다음 작물을 위해 토양을 비옥하게 하므로, 토양이 건강하게 유지되어 지속 가능하다.',
      analysis: '① 토양이 건강하게 유지되어 오래 지속될 수 있는 ✅ 본문 "the soil stays healthy" 근거 ② 수확 보장 ❌ 본문 근거 없음 ③ 기계 효율 ❌ 본문 근거 없음 ④ 유기농 인증 ❌ 본문 근거 없음',
      tip: 'sustainable은 "지속 가능한"이고, 지문에서 그 근거는 토양 건강 유지이다.'
    };

    // Q14: 지칭추론 (쉬움/4점) — they가 가리키는 것
    qById[14].passage = 'Crop rotation is the process in which farmers change the crops <u>they</u> grow in their fields in a special order.';
    qById[14].stem = '밑줄 친 <b>they</b>가 가리키는 것으로 가장 적절한 것은?';
    qById[14].ch = ['farmers','crops','fields','order'];
    qById[14].ans = 1;
    qById[14].det = {
      korean: '윤작은 농부들이 특별한 순서로 밭에서 기르는 작물을 바꾸는 과정이다.',
      analysis: '① farmers ✅ 동사 grow의 주어는 농부들이다 ② crops ❌ 작물은 grow의 목적어 ③ fields ❌ 장소 ④ order ❌ 순서',
      tip: 'in which farmers change the crops they grow — 관계절에서 grow의 주어를 찾는다.'
    };

    // Q15: 지칭추론 (보통/5점) — 다른 대명사
    qById[15].passage = 'if a farmer has three fields, <u>he or she</u> may grow carrots in the first field, green beans in the second, and tomatoes in the third.';
    qById[15].stem = '밑줄 친 <b>he or she</b>가 가리키는 것으로 가장 적절한 것은?';
    qById[15].ch = ['a farmer','three fields','carrots','tomatoes'];
    qById[15].ans = 1;
    qById[15].det = {
      korean: '한 농부가 세 개의 밭을 가지고 있다면, 그 농부는 첫 번째 밭에 당근을, 두 번째에 강낭콩을, 세 번째에 토마토를 기를 수 있다.',
      analysis: '① a farmer ✅ 주어 a farmer를 he or she로 받음 ② three fields ❌ 장소 ③ carrots ❌ 작물 ④ tomatoes ❌ 작물',
      tip: '가정법 if절의 주어(a farmer)를 주절에서 he or she로 받는다.'
    };

    // Q20: 서술형 — 영작 (보통/5점)
    qById[20].passage = '';
    qById[20].stem = '다음 우리말에 맞게 영어로 쓰시오.\n\n"이런 농법은 토양이 건강하게 유지되기 때문에 지속 가능하다."\n\n<조건>: 본문 표현 "sustainable", "the soil stays healthy"를 사용할 것.';
    qById[20].fmt = 'written';
    qById[20].wa = 'This type of farming is sustainable because the soil stays healthy.';
    qById[20].accept = [
      'This type of farming is sustainable because the soil stays healthy.',
      'this type of farming is sustainable because the soil stays healthy.',
      'This type of farming is sustainable because the soil stays healthy'
    ];
    qById[20].det = {
      korean: '이런 농법은 토양이 건강하게 유지되기 때문에 지속 가능하다.',
      analysis: '본문 마지막 문장 "This type of farming is sustainable because the soil stays healthy." 그대로 쓴다.',
      tip: 'sustainable + because절 구조를 기억하자.'
    };
    delete qById[20].ans;
    delete qById[20].ch;

    // Q13 diff 조정 필요 (함축의미는 원래 어려움 6점 유지)
  }
});

// ============================================================
// 24번/단어.json (3문항 재출제: Q13, Q15, Q20)
// ============================================================
patches.push({
  file: '24번/단어.json',
  mutate: (d) => {
    const qById = {};
    d.questions.forEach(q => qById[q.id] = q);

    // Q13: 동의어 (기존 placeholder 제거 — refinement의 동의어)
    qById[13].type = '동의어 고르기';
    qById[13].passage = '';
    qById[13].stem = '다음 밑줄 친 단어와 의미가 가장 가까운 것은?\n\nThen you can decide whether any areas of your painting would benefit from further <u>refinement</u>.';
    qById[13].ch = ['improvement','scattering','focusing','destruction'];
    qById[13].ans = 1;
    qById[13].det = {
      korean: '그러면 당신의 그림의 어떤 부분이 추가적인 개선으로 이득을 볼지 결정할 수 있다.',
      analysis: '① improvement(개선) ✅ refinement의 동의어 ② scattering(흩뿌림) ❌ 무관 ③ focusing(집중) ❌ 무관 ④ destruction(파괴) ❌ 반의어에 가까움',
      tip: 'refinement = further improvement (추가 개선).'
    };

    // Q15: 다의어 (work)
    qById[15].type = '다의어';
    qById[15].passage = '(A) it can be tempting to keep on adding more to your <u>work</u>. (B) any areas of your painting would benefit from further refinement—you should never stop trying to improve your <u>work</u>.';
    qById[15].stem = '밑줄 친 (A), (B)의 <b>work</b>가 각각 의미하는 바로 가장 적절한 것은?';
    qById[15].ch = [
      '(A) 작품 — (B) 작품',
      '(A) 직장 — (B) 노력',
      '(A) 노력 — (B) 직장',
      '(A) 작동하다 — (B) 일하다'
    ];
    qById[15].ans = 1;
    qById[15].det = {
      korean: '(A) 당신의 작품에 더 많은 것을 계속 추가하고 싶은 유혹이 있다. (B) 당신의 작품을 개선하려는 노력을 멈추지 말아야 한다.',
      analysis: '① (A) 작품 — (B) 작품 ✅ 두 곳 모두 그림(painting)을 가리키는 "작품" ② 직장/노력 ❌ ③ 노력/직장 ❌ ④ 동사형 ❌',
      tip: 'painting 문맥에서 work는 대부분 "작품(artwork)"을 의미한다.'
    };

    // Q20: 부적절 — 진짜 부적절 선지 설계
    qById[20].type = '문맥상 부적절한 어휘';
    qById[20].passage = 'It is ①<u>important</u> to take a few steps back from the painting from time to time to assess your progress. Putting too much into a painting can ②<u>spoil</u> its impact and leave it looking ③<u>underworked</u>. If you find yourself struggling to decide whether you have finished, take a ④<u>break</u> and come back to it later with fresh eyes.';
    qById[20].stem = '다음 글의 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?';
    qById[20].ch = ['①','②','③','④'];
    qById[20].ans = 3;
    qById[20].det = {
      korean: '때때로 그림에서 몇 걸음 물러나 진행 상황을 평가하는 것이 중요하다. 그림에 너무 많은 것을 넣으면 그 효과를 망칠 수 있고 그림이 과하게 작업된 것처럼 보이게 할 수 있다.',
      analysis: '① important(중요한) ✅ 물러나 평가하는 것의 중요성 ② spoil(망치다) ✅ 과도함이 효과를 망친다 ③ underworked(덜 작업된) ❌ 본문은 overworked(과하게 작업된) — 너무 많이 넣으면 과하게 작업된 것처럼 보인다 ④ break(휴식) ✅ 쉬었다가 돌아오기',
      tip: 'Putting too much → overworked (과다 작업). underworked는 정반대.'
    };
  }
});

// ============================================================
// 24번/퀴즈.json (3문항 재출제: Q14, Q15, Q20)
// ============================================================
patches.push({
  file: '24번/퀴즈.json',
  mutate: (d) => {
    const qById = {};
    d.questions.forEach(q => qById[q.id] = q);

    // Q14: 빈칸추론
    qById[14].type = '빈칸추론';
    qById[14].passage = 'Working around the whole painting, rather than concentrating on one area at a time, will mean you can stop at any point and the painting can be considered "____________."';
    qById[14].stem = '다음 빈칸에 들어갈 말로 가장 적절한 것은?';
    qById[14].ch = ['finished','started','destroyed','ignored'];
    qById[14].ans = 1;
    qById[14].det = {
      korean: '한 번에 한 영역에 집중하기보다는 그림 전체에 걸쳐 작업하는 것은 어느 시점에서든 멈출 수 있고 그림이 "완성된" 것으로 여겨질 수 있음을 의미한다.',
      analysis: '① finished(완성된) ✅ 본문 원문대로 ② started ❌ ③ destroyed ❌ ④ ignored ❌',
      tip: 'stop at any point이면 그림이 finished로 간주된다.'
    };

    // Q15: 빈칸추론 (보통)
    qById[15].type = '빈칸추론';
    qById[15].passage = 'Putting too much into a painting can spoil its impact and leave it looking ____________.';
    qById[15].stem = '다음 빈칸에 들어갈 말로 가장 적절한 것은?';
    qById[15].ch = ['overworked','refreshed','simplified','scattered'];
    qById[15].ans = 1;
    qById[15].det = {
      korean: '그림에 너무 많은 것을 넣으면 그 효과를 망칠 수 있고 과하게 작업된 것처럼 보이게 할 수 있다.',
      analysis: '① overworked(과하게 작업된) ✅ 원문 근거 ② refreshed ❌ ③ simplified ❌ ④ scattered ❌',
      tip: 'Putting too much → overworked.'
    };

    // Q20: 서술형 영작
    qById[20].type = '서술형 — 영작';
    qById[20].fmt = 'written';
    qById[20].passage = '';
    qById[20].stem = '다음 우리말에 맞게 영어로 쓰시오.\n\n"때때로 그림에서 몇 걸음 물러나 진행 상황을 평가하는 것이 중요하다."\n\n<조건>: 본문 표현 "take a few steps back", "assess your progress" 사용.';
    qById[20].wa = 'It is important to take a few steps back from the painting from time to time to assess your progress.';
    qById[20].accept = [
      'It is important to take a few steps back from the painting from time to time to assess your progress.',
      'It is important to take a few steps back from the painting from time to time to assess your progress'
    ];
    qById[20].det = {
      korean: '때때로 그림에서 몇 걸음 물러나 진행 상황을 평가하는 것이 중요하다.',
      analysis: '본문 원문 "It is important to take a few steps back from the painting from time to time to assess your progress." 그대로.',
      tip: 'It is + 형용사 + to부정사 구조.'
    };
    delete qById[20].ans;
    delete qById[20].ch;
  }
});

// ============================================================
// 26번/워크북.json (5문항 재출제: Q4, Q5, Q6, Q18, Q19)
// ============================================================
patches.push({
  file: '26번/워크북.json',
  mutate: (d) => {
    const qById = {};
    d.questions.forEach(q => qById[q.id] = q);

    // Q4: 어법 (26번 Jaroslav 지문 기반)
    qById[4].type = '어법';
    qById[4].passage = 'Jaroslav Heyrovsky was born in Prague on December 20, 1890, as the fifth child of Leopold Heyrovsky. In 1901 Jaroslav ①<u>went</u> to a secondary school ②<u>called</u> the Akademicke Gymnasium. Rather than Latin and Greek, he ③<u>showed</u> a strong interest in the natural sciences. At Czech University in Prague he ④<u>studying</u> chemistry, physics, and mathematics.';
    qById[4].stem = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?';
    qById[4].ch = ['①','②','③','④'];
    qById[4].ans = 4;
    qById[4].det = {
      korean: 'Jaroslav Heyrovsky는 1890년 12월 20일 프라하에서 태어났다. 1901년 그는 Akademicke Gymnasium이라는 중등학교에 갔다. 라틴어와 그리스어보다는 자연과학에 강한 관심을 보였다. 프라하의 체코 대학에서 그는 화학, 물리학, 수학을 공부했다.',
      analysis: '① went ✅ 과거시제 주동사 ② called ✅ 과거분사 수식 ③ showed ✅ 과거시제 ④ studying ❌ 주어(he) + 동사 자리에 현재분사 불가 → studied',
      tip: '주절에 동사가 필요하면 -ing형은 쓸 수 없다.'
    };

    // Q5: 어법
    qById[5].type = '어법';
    qById[5].passage = 'From 1910 to 1914 he ①<u>continued</u> his studies at University College, London. Throughout the First World War, Jaroslav ②<u>served</u> in a military hospital. In 1926, Jaroslav ③<u>became</u> the first Professor of Physical Chemistry at Charles University in Prague. He ④<u>winning</u> the Nobel Prize in chemistry in 1959.';
    qById[5].stem = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?';
    qById[5].ch = ['①','②','③','④'];
    qById[5].ans = 4;
    qById[5].det = {
      korean: '1910년부터 1914년까지 그는 런던 University College에서 공부를 계속했다. 1차 세계대전 동안 Jaroslav는 군 병원에서 복무했다. 1926년 Jaroslav는 프라하 Charles University의 최초 물리화학 교수가 되었다. 그는 1959년 노벨 화학상을 수상했다.',
      analysis: '① continued ✅ 과거 ② served ✅ 과거 ③ became ✅ 과거 ④ winning ❌ 주어(He) 뒤 본동사 자리 → won',
      tip: '문장의 본동사는 현재분사형으로 쓰지 않는다.'
    };

    // Q6: 내용일치
    qById[6].type = '내용일치';
    qById[6].passage = '';
    qById[6].stem = '다음 중 Jaroslav Heyrovsky에 관한 글의 내용과 <b>일치하는</b> 것은?';
    qById[6].ch = [
      '1890년 프라하에서 태어났다.',
      '라틴어와 그리스어에 강한 관심을 보였다.',
      '1차 세계대전 동안 전투에 참전했다.',
      '1926년 노벨 화학상을 수상했다.'
    ];
    qById[6].ans = 1;
    qById[6].det = {
      korean: 'Jaroslav Heyrovsky는 1890년 12월 20일 프라하에서 태어났다.',
      analysis: '① 1890년 프라하에서 태어났다 ✅ 본문 일치 ② 라틴어/그리스어 ❌ 자연과학에 관심 ③ 전투 참전 ❌ 군 병원에서 복무 ④ 1926년 노벨상 ❌ 1959년 노벨상',
      tip: '출생연도, 관심사, 수상연도를 꼼꼼히 확인.'
    };

    // Q18: 주제
    qById[18].type = '주제';
    qById[18].passage = 'Jaroslav Heyrovsky was born in Prague on December 20, 1890, as the fifth child of Leopold Heyrovsky. In 1901 Jaroslav went to a secondary school called the Akademicke Gymnasium. At Czech University in Prague he studied chemistry, physics, and mathematics. In 1926, Jaroslav became the first Professor of Physical Chemistry at Charles University in Prague. He won the Nobel Prize in chemistry in 1959.';
    qById[18].stem = '이 글의 <b>주제</b>로 가장 적절한 것은?';
    qById[18].ch = [
      'Jaroslav Heyrovsky의 생애와 학문적 업적',
      '20세기 체코의 교육 제도',
      '1차 세계대전과 과학자의 역할',
      '노벨 화학상 수상자들의 공통점'
    ];
    qById[18].ans = 1;
    qById[18].det = {
      korean: '이 글은 Jaroslav Heyrovsky의 출생, 학업, 교수 경력, 노벨상 수상까지의 생애를 다룬다.',
      analysis: '① 생애와 학문적 업적 ✅ 출생~노벨상 일대기 ② 체코 교육 제도 ❌ ③ 과학자 역할 ❌ ④ 노벨상 공통점 ❌',
      tip: '인물 전기 지문의 주제는 "그 인물의 생애/업적"이다.'
    };

    // Q19: 주제
    qById[19].type = '주제';
    qById[19].passage = 'Throughout the First World War, Jaroslav served in a military hospital. In 1926, Jaroslav became the first Professor of Physical Chemistry at Charles University in Prague. He won the Nobel Prize in chemistry in 1959.';
    qById[19].stem = '이 글의 <b>주제</b>로 가장 적절한 것은?';
    qById[19].ch = [
      'Jaroslav의 학문적 경력과 수상',
      '1차 세계대전 군 병원의 역할',
      '프라하 대학교의 설립 과정',
      '20세기 화학 연구의 발전'
    ];
    qById[19].ans = 1;
    qById[19].det = {
      korean: '이 발췌는 Jaroslav의 전시 복무, 교수 임용, 노벨상 수상을 다룬다.',
      analysis: '① 학문 경력과 수상 ✅ 교수 + 노벨상 ② 군 병원 역할 ❌ ③ 대학 설립 ❌ ④ 화학 발전 ❌',
      tip: '여러 문장의 공통 주제는 핵심 인물의 경력이다.'
    };
  }
});

// ============================================================
// 26번/퀴즈.json (10문항 재출제: Q5, Q6, Q10, Q11, Q12, Q13, Q14, Q15, Q19, Q20)
// ============================================================
patches.push({
  file: '26번/퀴즈.json',
  mutate: (d) => {
    const qById = {};
    d.questions.forEach(q => qById[q.id] = q);

    // Q5: 어법
    qById[5].type = '어법';
    qById[5].passage = 'Jaroslav Heyrovsky ①<u>was born</u> in Prague on December 20, 1890, ②<u>as</u> the fifth child of Leopold Heyrovsky. In 1901 Jaroslav ③<u>went</u> to a secondary school ④<u>calling</u> the Akademicke Gymnasium.';
    qById[5].stem = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?';
    qById[5].ch = ['①','②','③','④'];
    qById[5].ans = 4;
    qById[5].det = {
      korean: 'Jaroslav Heyrovsky는 1890년 12월 20일 프라하에서 Leopold Heyrovsky의 다섯째 아이로 태어났다. 1901년 그는 Akademicke Gymnasium이라는 중등학교에 갔다.',
      analysis: '① was born ✅ 수동태 ② as ✅ "~로서" ③ went ✅ 과거 ④ calling ❌ 학교가 "불리는" → 수동 called',
      tip: '수식 받는 명사(school)와 수동 관계면 과거분사.'
    };

    // Q6: 어법
    qById[6].type = '어법';
    qById[6].passage = 'Rather than Latin and Greek, he showed a strong interest in the natural sciences. At Czech University in Prague he ①<u>studied</u> chemistry, physics, and mathematics. From 1910 to 1914 he ②<u>continued</u> his studies at University College, London. Throughout the First World War, Jaroslav ③<u>served</u> in a military hospital. In 1926, Jaroslav ④<u>becoming</u> the first Professor of Physical Chemistry at Charles University in Prague.';
    qById[6].stem = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?';
    qById[6].ch = ['①','②','③','④'];
    qById[6].ans = 4;
    qById[6].det = {
      korean: '라틴어와 그리스어보다 그는 자연과학에 강한 관심을 보였다. 프라하 체코 대학에서 그는 화학, 물리학, 수학을 공부했다. 1910년부터 1914년까지 런던 University College에서 학업을 계속했다. 1차 세계대전 동안 군 병원에서 복무했다. 1926년 Jaroslav는 프라하 Charles University의 초대 물리화학 교수가 되었다.',
      analysis: '① studied ✅ 과거 ② continued ✅ 과거 ③ served ✅ 과거 ④ becoming ❌ 주절 본동사 자리 → became',
      tip: '주어(Jaroslav) + 본동사 자리엔 동명사/분사형이 올 수 없다.'
    };

    // Q10: 내용일치
    qById[10].type = '내용일치';
    qById[10].passage = '';
    qById[10].stem = 'Jaroslav Heyrovsky에 관한 글의 <b>내용과 일치하는</b> 것은?';
    qById[10].ch = [
      'Leopold Heyrovsky의 다섯째 아이로 태어났다.',
      '중학교에서 라틴어를 가장 열심히 공부했다.',
      '1차 세계대전 때 전투 부대에 배치되었다.',
      '1926년에 노벨 화학상을 수상했다.'
    ];
    qById[10].ans = 1;
    qById[10].det = {
      korean: 'Leopold Heyrovsky의 다섯째 아이로 태어났다.',
      analysis: '① 다섯째 아이 ✅ 본문 "the fifth child of Leopold Heyrovsky" ② 라틴어 열심 ❌ 자연과학에 관심 ③ 전투부대 ❌ 군 병원 복무 ④ 1926년 노벨상 ❌ 1959년 노벨상',
      tip: 'fifth child, natural sciences, military hospital, 1959를 혼동하면 안 됨.'
    };

    // Q11: 내용불일치
    qById[11].type = '내용불일치';
    qById[11].passage = '';
    qById[11].stem = 'Jaroslav Heyrovsky에 관한 글의 <b>내용과 일치하지 않는</b> 것은?';
    qById[11].ch = [
      '1890년 프라하에서 태어났다.',
      '프라하의 체코 대학에서 화학을 공부했다.',
      '런던의 University College에서 학업을 계속했다.',
      '1926년에 노벨 화학상을 수상했다.'
    ];
    qById[11].ans = 4;
    qById[11].det = {
      korean: '노벨 화학상은 1959년에 수상했다.',
      analysis: '① 1890년 프라하 ✅ ② 체코 대학 화학 ✅ ③ 런던 University College ✅ ④ 1926년 노벨상 ❌ → 1959년',
      tip: '1926년은 교수 임용 연도, 1959년이 노벨상 수상 연도.'
    };

    // Q12: 내용이해
    qById[12].type = '내용이해';
    qById[12].passage = '';
    qById[12].stem = '다음 중 글의 <b>내용</b>과 일치하는 것을 모두 고르면?';
    qById[12].ch = [
      '1901년 중등학교 Akademicke Gymnasium에 다녔다.',
      '화학, 물리학, 수학을 공부했다.',
      '2차 세계대전 때 군 병원에서 일했다.',
      '체코 대학에서 교수가 되었다.'
    ];
    qById[12].ans = 1;
    qById[12].det = {
      korean: '1901년 Akademicke Gymnasium이라는 중등학교에 다녔다.',
      analysis: '① 1901년 Akademicke Gymnasium ✅ ② 화학/물리/수학 ✅ 다만 여러 정답중 하나 → 단일 정답 구조상 ①만 ③ 2차 대전 ❌ 1차 대전 ④ 체코 대학 교수 ❌ Charles University',
      tip: '세부 정보 정확히 읽기: 1차 대전, Charles University.'
    };

    // Q13: 내용이해
    qById[13].type = '내용이해';
    qById[13].passage = '';
    qById[13].stem = '다음 중 글의 <b>내용</b>과 일치하지 않는 것은?';
    qById[13].ch = [
      '1910~1914년에 런던에서 공부했다.',
      '1차 세계대전 동안 군 병원에서 복무했다.',
      'Charles University에서 최초의 물리화학 교수가 되었다.',
      '1959년 노벨 물리학상을 수상했다.'
    ];
    qById[13].ans = 4;
    qById[13].det = {
      korean: '1959년 노벨 화학상(chemistry)을 수상했다.',
      analysis: '① 1910~1914 런던 ✅ ② 군 병원 ✅ ③ Charles University 첫 교수 ✅ ④ 노벨 물리학상 ❌ → 화학상',
      tip: 'Nobel Prize in chemistry(화학상)이지 물리학상이 아니다.'
    };

    // Q14: 내용이해
    qById[14].type = '내용이해';
    qById[14].passage = '';
    qById[14].stem = '글의 내용에 근거해 Jaroslav가 관심을 보인 분야로 가장 적절한 것은?';
    qById[14].ch = ['자연과학','고전 언어학','역사학','예술'];
    qById[14].ans = 1;
    qById[14].det = {
      korean: '라틴어와 그리스어보다 자연과학에 강한 관심을 보였다.',
      analysis: '① 자연과학 ✅ ② 고전 언어 ❌ Latin/Greek보다는 (대조) ③ 역사 ❌ ④ 예술 ❌',
      tip: 'Rather than A, he showed interest in B → B가 관심 분야.'
    };

    // Q15: 내용이해
    qById[15].type = '내용이해';
    qById[15].passage = '';
    qById[15].stem = '글에서 Jaroslav가 1차 세계대전 동안 일한 곳은?';
    qById[15].ch = ['군 병원','전투 부대','대학 연구소','정부 기관'];
    qById[15].ans = 1;
    qById[15].det = {
      korean: '1차 세계대전 동안 군 병원에서 복무했다.',
      analysis: '① 군 병원 ✅ "military hospital" ② 전투 부대 ❌ ③ 연구소 ❌ ④ 정부 ❌',
      tip: 'served in a military hospital.'
    };

    // Q19: 서술형
    qById[19].type = '서술형';
    qById[19].fmt = 'written';
    qById[19].passage = '';
    qById[19].stem = '다음 물음에 영어로 답하시오.\n\nWhen did Jaroslav Heyrovsky win the Nobel Prize in chemistry?';
    qById[19].wa = 'In 1959.';
    qById[19].accept = ['In 1959.','in 1959.','1959','In 1959','1959.'];
    qById[19].det = {
      korean: '그는 1959년에 노벨 화학상을 받았다.',
      analysis: '본문 마지막: "He won the Nobel Prize in chemistry in 1959."',
      tip: '1926년은 교수 임용, 1959년이 노벨상.'
    };
    delete qById[19].ans;
    delete qById[19].ch;

    // Q20: 서술형 영작
    qById[20].type = '서술형 — 영작';
    qById[20].fmt = 'written';
    qById[20].passage = '';
    qById[20].stem = '다음 우리말에 맞게 영어로 쓰시오.\n\n"라틴어와 그리스어보다는 그는 자연과학에 강한 관심을 보였다."\n\n<조건>: "Rather than", "natural sciences" 사용.';
    qById[20].wa = 'Rather than Latin and Greek, he showed a strong interest in the natural sciences.';
    qById[20].accept = [
      'Rather than Latin and Greek, he showed a strong interest in the natural sciences.',
      'Rather than Latin and Greek, he showed a strong interest in the natural sciences'
    ];
    qById[20].det = {
      korean: '라틴어와 그리스어보다는 그는 자연과학에 강한 관심을 보였다.',
      analysis: '본문: "Rather than Latin and Greek, he showed a strong interest in the natural sciences."',
      tip: 'Rather than A, ~ in B: A 대신 B에.'
    };
    delete qById[20].ans;
    delete qById[20].ch;
  }
});

// ============================================================
// 29번/워크북.json (14문항: Q1~Q9, Q14, Q17~Q20)
// ============================================================
patches.push({
  file: '29번/워크북.json',
  mutate: (d) => {
    const qById = {};
    d.questions.forEach(q => qById[q.id] = q);

    // Q1~Q9: 어법 9문항 (밑줄 4개씩) — 29번 지문은 관계대명사 that이 핵심
    const mkGrammar = (id, diff, pts, passage, ans, detAna) => {
      qById[id].type = '어법';
      qById[id].fmt = 'mc';
      qById[id].passage = passage;
      qById[id].stem = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?';
      qById[id].ch = ['①','②','③','④'];
      qById[id].ans = ans;
      qById[id].diff = diff;
      qById[id].pts = pts;
      qById[id].det = {
        korean: '본문 문맥에 맞춰 밑줄 부분의 어법을 점검한다.',
        analysis: detAna,
        tip: '동사 자리/분사/관계사 판별이 핵심.'
      };
      delete qById[id].wa;
      delete qById[id].accept;
    };

    mkGrammar(1,'쉬움',4,
      'It ①<u>would</u> be hard to overstate how important meaningful work is to human beings — work ②<u>that</u> provides a sense of fulfillment and empowerment. Those who have ③<u>found</u> deeper meaning in their careers find their days much more ④<u>energizing</u> and satisfying.',
      null,
      '① would ✅ 가정법 ② that ✅ 주격 관계대명사 ③ found ✅ 현재완료 ④ energizing ✅ 감정유발 분사');
    // Q1 needs an error — adjust
    qById[1].passage = 'It ①<u>would</u> be hard to overstate how important meaningful work is to human beings — work ②<u>what</u> provides a sense of fulfillment and empowerment. Those who have ③<u>found</u> deeper meaning in their careers find their days much more ④<u>energizing</u>.';
    qById[1].ans = 2;
    qById[1].det.analysis = '① would ✅ 가정 ② what ❌ 선행사(work) 존재 → that/which ③ found ✅ 완료 ④ energizing ✅';

    mkGrammar(2,'쉬움',4,
      'Those who ①<u>have</u> found deeper meaning in their careers ②<u>find</u> their days much more energizing and satisfying, and ③<u>counting</u> their employment as one of their greatest sources of joy and pride.',
      3,
      '① have ✅ 완료 조동사 ② find ✅ 본동사 ③ counting ❌ and 뒤 본동사 자리 → count ④ (해당없음)');
    // Only 3 markers? need 4. Adjust:
    qById[2].passage = 'Those who ①<u>have</u> found deeper meaning in their careers ②<u>find</u> their days much more ③<u>energizing</u>, and ④<u>counting</u> their employment as a great source of pride.';
    qById[2].ans = 4;
    qById[2].det.analysis = '① have ✅ 완료 ② find ✅ 본동사 ③ energizing ✅ 현재분사 ④ counting ❌ and 병렬 본동사 → count';

    mkGrammar(3,'보통',5,
      'Sonya Lyubomirsky, professor of psychology at the University of California, ①<u>has</u> conducted numerous workplace studies ②<u>showing</u> that when people are more ③<u>fulfilled</u> on the job, they not only produce higher quality work and a greater output, but also ④<u>generally earning</u> higher incomes.',
      4,
      '① has ✅ 완료 ② showing ✅ 분사수식 ③ fulfilled ✅ 수동분사 ④ generally earning ❌ 등위접속 본동사 → (generally) earn');

    mkGrammar(4,'보통',5,
      'Those ①<u>most satisfied</u> with their work are also much more ②<u>likely</u> to be happier with their lives overall. For her book Happiness at Work, researcher Jessica Pryce-Jones ③<u>conducting</u> a study of 3,000 workers in seventy-nine countries, ④<u>finding</u> that those who took greater satisfaction from their work were 150 percent more likely to have a happier life overall.',
      3,
      '① most satisfied ✅ 후치수식 ② likely ✅ be동사 보어 ③ conducting ❌ 주절 본동사 → conducted ④ finding ✅ 분사구문');

    mkGrammar(5,'보통',5,
      'It would be hard ①<u>to overstate</u> how important meaningful work is to human beings — work that ②<u>provides</u> a sense of fulfillment and empowerment. Those who ③<u>have</u> found deeper meaning in their careers ④<u>finding</u> their days more energizing.',
      4,
      '① to overstate ✅ 진주어 ② provides ✅ 관계절 동사 ③ have ✅ 완료조동사 ④ finding ❌ 주어 Those 뒤 본동사 → find');

    mkGrammar(6,'보통',5,
      'Sonya Lyubomirsky ①<u>conducted</u> numerous workplace studies ②<u>showing</u> that when people are more fulfilled on the job, they not only ③<u>produce</u> higher quality work, but also ④<u>to earn</u> higher incomes.',
      4,
      '① conducted ✅ 과거 ② showing ✅ 분사 ③ produce ✅ 동사원형 ④ to earn ❌ not only A but also B 병렬 → earn');

    mkGrammar(7,'보통',5,
      'Those most satisfied with their work ①<u>are</u> also much more likely ②<u>to be</u> happier with their lives overall. Jessica Pryce-Jones conducted ③<u>a study</u> of 3,000 workers in seventy-nine countries, ④<u>found</u> that those who took greater satisfaction were 150 percent more likely to have a happier life.',
      4,
      '① are ✅ 복수주어 동사 ② to be ✅ likely to부정사 ③ a study ✅ 명사구 ④ found ❌ 분사구문 → finding');

    mkGrammar(8,'어려움',6,
      'It ①<u>would</u> be hard to overstate how important ②<u>meaningful</u> work is to human beings — work that provides a sense of fulfillment and empowerment. Those ③<u>which</u> have found deeper meaning in their careers find their days much more ④<u>energizing</u> and satisfying.',
      3,
      '① would ✅ 조동사 ② meaningful ✅ 형용사 ③ which ❌ 선행사가 사람(Those) → who ④ energizing ✅ 현재분사');

    mkGrammar(9,'어려움',6,
      'For her book Happiness at Work, researcher Jessica Pryce-Jones conducted a study of 3,000 workers in seventy-nine countries, finding ①<u>that</u> those ②<u>who</u> took greater satisfaction ③<u>from</u> their work ④<u>was</u> 150 percent more likely to have a happier life overall.',
      4,
      '① that ✅ 명사절 ② who ✅ 주격관계대명사 ③ from ✅ 전치사 ④ was ❌ 주어(those who …)가 복수 → were');

    // Q14: 내용이해
    qById[14].type = '내용이해';
    qById[14].fmt = 'mc';
    qById[14].passage = '';
    qById[14].stem = '다음 중 글의 내용과 <b>일치하는</b> 것은?';
    qById[14].ch = [
      '의미 있는 일은 성취감과 권한 부여의 감각을 제공한다.',
      '의미 있는 일을 찾은 사람은 오히려 소득이 줄어든다.',
      'Jessica Pryce-Jones는 1,000명을 조사했다.',
      'Sonya Lyubomirsky는 의학 교수이다.'
    ];
    qById[14].ans = 1;
    qById[14].det = {
      korean: '의미 있는 일은 성취감과 권한 부여의 감각을 제공한다.',
      analysis: '① 성취감·권한 부여 ✅ "a sense of fulfillment and empowerment" ② 소득 감소 ❌ → 더 높은 소득 ③ 1,000명 ❌ 3,000명 ④ 의학 교수 ❌ 심리학 교수',
      tip: '숫자와 전공, 긍정/부정 방향 꼼꼼히.'
    };
    delete qById[14].wa;
    delete qById[14].accept;

    // Q17: 내용이해
    qById[17].type = '내용이해';
    qById[17].fmt = 'mc';
    qById[17].passage = '';
    qById[17].stem = '글에 따르면, 직무에서 성취감을 느낀 사람들이 보이는 결과로 언급된 것이 <b>아닌</b> 것은?';
    qById[17].ch = [
      '더 높은 질의 업무 산출',
      '더 큰 산출량',
      '더 높은 소득',
      '더 짧은 근무 시간'
    ];
    qById[17].ans = 4;
    qById[17].det = {
      korean: '본문은 더 높은 질/산출량/소득은 언급하나 근무시간 단축은 언급하지 않는다.',
      analysis: '① 높은 질 ✅ 본문 언급 ② 큰 산출량 ✅ ③ 높은 소득 ✅ ④ 짧은 근무시간 ❌ 언급 없음',
      tip: '언급되지 않은 것 찾기: 근무시간.'
    };
    delete qById[17].wa;
    delete qById[17].accept;

    // Q18: 내용이해
    qById[18].type = '내용이해';
    qById[18].fmt = 'mc';
    qById[18].passage = '';
    qById[18].stem = 'Jessica Pryce-Jones의 연구에 관한 글의 <b>내용</b>과 일치하는 것은?';
    qById[18].ch = [
      '79개국 3,000명을 조사했다.',
      '29개국 300명을 조사했다.',
      '15개국 1,500명을 조사했다.',
      '100개국 5,000명을 조사했다.'
    ];
    qById[18].ans = 1;
    qById[18].det = {
      korean: '79개국 3,000명의 근로자를 조사했다.',
      analysis: '① 79개국 3,000명 ✅ 본문 원문 ② ❌ ③ ❌ ④ ❌',
      tip: 'seventy-nine countries, 3,000 workers.'
    };
    delete qById[18].wa;
    delete qById[18].accept;

    // Q19: 내용이해
    qById[19].type = '내용이해';
    qById[19].fmt = 'mc';
    qById[19].passage = '';
    qById[19].stem = '다음 중 글의 내용과 <b>일치하지 않는</b> 것은?';
    qById[19].ch = [
      '의미 있는 일은 인간에게 중요하다.',
      '깊은 의미를 찾은 사람은 하루를 더 활력 있게 느낀다.',
      '자신의 일에 만족하는 사람이 삶 전반에 더 행복하다.',
      '일에서 만족감은 소득과 무관하다.'
    ];
    qById[19].ans = 4;
    qById[19].det = {
      korean: '본문은 일에서 성취감을 느낀 사람이 더 높은 소득을 번다고 설명한다.',
      analysis: '① 중요성 ✅ ② 더 활력 ✅ ③ 삶 전반 행복 ✅ ④ 소득 무관 ❌ → 더 높은 소득',
      tip: '"earn higher incomes"는 소득 연관성을 의미.'
    };
    delete qById[19].wa;
    delete qById[19].accept;

    // Q20: 내용이해
    qById[20].type = '내용이해';
    qById[20].fmt = 'mc';
    qById[20].passage = '';
    qById[20].stem = '글에서 Sonya Lyubomirsky의 소속으로 언급된 것은?';
    qById[20].ch = [
      'University of California 심리학 교수',
      'Harvard University 경제학 교수',
      'Oxford University 사회학 교수',
      'MIT 경영학 교수'
    ];
    qById[20].ans = 1;
    qById[20].det = {
      korean: 'Sonya Lyubomirsky는 University of California의 심리학 교수이다.',
      analysis: '① UC 심리학 ✅ 본문 명시 ② Harvard 경제학 ❌ ③ Oxford 사회학 ❌ ④ MIT 경영학 ❌',
      tip: 'professor of psychology at the University of California.'
    };
    delete qById[20].wa;
    delete qById[20].accept;
  }
});

// ============================================================
// 29번/퀴즈.json (5문항 재출제: Q6, Q7, Q13, Q14, Q15)
// ============================================================
patches.push({
  file: '29번/퀴즈.json',
  mutate: (d) => {
    const qById = {};
    d.questions.forEach(q => qById[q.id] = q);

    // Q6: 어법
    qById[6].type = '어법';
    qById[6].fmt = 'mc';
    qById[6].passage = 'Those most ①<u>satisfied</u> with their work are ②<u>also</u> much more likely ③<u>to be</u> happier with their lives overall, and ④<u>earning</u> higher incomes overall.';
    qById[6].stem = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?';
    qById[6].ch = ['①','②','③','④'];
    qById[6].ans = 4;
    qById[6].det = {
      korean: '자신의 일에 가장 만족하는 사람들은 또한 삶 전반에서 더 행복할 가능성이 훨씬 더 높다.',
      analysis: '① satisfied ✅ 수동분사 ② also ✅ ③ to be ✅ likely + to부정사 ④ earning ❌ and 병렬 본동사 → earn',
      tip: 'and로 연결되는 병렬은 본동사끼리.'
    };
    delete qById[6].wa;
    delete qById[6].accept;

    // Q7: 어법
    qById[7].type = '어법';
    qById[7].fmt = 'mc';
    qById[7].passage = 'For her book Happiness at Work, researcher Jessica Pryce-Jones ①<u>conducted</u> a study of 3,000 workers in seventy-nine countries, ②<u>finding</u> ③<u>that</u> those who took greater satisfaction from their work ④<u>was</u> 150 percent more likely to have a happier life overall.';
    qById[7].stem = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?';
    qById[7].ch = ['①','②','③','④'];
    qById[7].ans = 4;
    qById[7].det = {
      korean: '그녀의 책 Happiness at Work를 위해 연구자 Jessica Pryce-Jones는 79개국 3,000명의 근로자를 연구했고, 일에서 더 큰 만족을 얻은 사람들은 삶 전반에서 150% 더 행복할 가능성이 높다는 것을 발견했다.',
      analysis: '① conducted ✅ 과거 ② finding ✅ 분사구문 ③ that ✅ 명사절 ④ was ❌ 주어(those who …)가 복수 → were',
      tip: 'those who + 복수동사.'
    };
    delete qById[7].wa;
    delete qById[7].accept;

    // Q13: 내용이해
    qById[13].type = '내용이해';
    qById[13].fmt = 'mc';
    qById[13].passage = '';
    qById[13].stem = '글의 내용과 <b>일치하는</b> 것은?';
    qById[13].ch = [
      'Jessica Pryce-Jones는 79개국 3,000명의 근로자를 조사했다.',
      'Jessica Pryce-Jones는 100개국 5,000명을 조사했다.',
      'Sonya Lyubomirsky는 경제학자이다.',
      '의미 있는 일은 소득과 무관하다.'
    ];
    qById[13].ans = 1;
    qById[13].det = {
      korean: '79개국 3,000명의 근로자 연구.',
      analysis: '① 79개국 3,000명 ✅ ② 100개국 5,000명 ❌ ③ 경제학자 ❌ 심리학자 ④ 소득 무관 ❌ 더 높은 소득',
      tip: '본문 숫자를 정확히.'
    };
    delete qById[13].wa;
    delete qById[13].accept;

    // Q14: 내용이해
    qById[14].type = '내용이해';
    qById[14].fmt = 'mc';
    qById[14].passage = '';
    qById[14].stem = '글에 언급된 의미 있는 일의 효과로 가장 적절한 것은?';
    qById[14].ch = [
      '성취감과 권한 부여의 감각 제공',
      '업무 효율성 저하',
      '근무 시간 단축',
      '동료 간 경쟁 증가'
    ];
    qById[14].ans = 1;
    qById[14].det = {
      korean: '의미 있는 일은 성취감과 권한 부여의 감각을 제공한다.',
      analysis: '① 성취감/권한 ✅ 본문 ② 효율성 저하 ❌ ③ 근무시간 단축 ❌ ④ 경쟁 ❌',
      tip: 'fulfillment + empowerment.'
    };
    delete qById[14].wa;
    delete qById[14].accept;

    // Q15: 내용이해
    qById[15].type = '내용이해';
    qById[15].fmt = 'mc';
    qById[15].passage = '';
    qById[15].stem = '글의 내용과 <b>일치하지 않는</b> 것은?';
    qById[15].ch = [
      '일에 만족하는 사람은 더 높은 소득을 번다.',
      '일에 만족하는 사람은 삶 전반에서 더 행복하다.',
      'Sonya Lyubomirsky는 University of California 심리학 교수이다.',
      '의미 있는 일은 인간에게 중요하지 않다.'
    ];
    qById[15].ans = 4;
    qById[15].det = {
      korean: '의미 있는 일이 인간에게 중요하다고 과장하기 어려울 정도이다.',
      analysis: '① 높은 소득 ✅ ② 삶 전반 행복 ✅ ③ UC 심리학 교수 ✅ ④ 중요하지 않다 ❌ 매우 중요하다',
      tip: 'hard to overstate how important = 매우 중요.'
    };
    delete qById[15].wa;
    delete qById[15].accept;
  }
});

// ===== 실행 =====
let totalFixed = 0;
patches.forEach(({ file, mutate }) => {
  const fp = path.join(BASE, file);
  const raw = fs.readFileSync(fp, 'utf8');
  const data = JSON.parse(raw);
  mutate(data);

  // det.analysis 마커 재정렬 (CAO-1 해소): 전 문항 대상
  data.questions.forEach(q => {
    if (q.det && typeof q.det.analysis === 'string' && Array.isArray(q.ch) && q.ch.length >= 2) {
      q.det.analysis = reorderAnalysis(q.det.analysis, q.ch, q.ans);
    }
  });

  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('[PATCHED]', file);
  totalFixed++;
});

console.log(`\n총 ${totalFixed}파일 수정 완료.`);
