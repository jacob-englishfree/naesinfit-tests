#!/usr/bin/env node
// L2 anomaly-sweep: validate가 못 잡는 의미적 이상 패턴을 기계적으로 검출.
// 인자: 퀴즈.json 경로들. 각 파일 PASS/QUARANTINE 판정 + 사유.
const fs=require('fs'), path=require('path');

function norm(s){return String(s||'').toLowerCase().replace(/[.!?,;:'"`]/g,'').replace(/-/g,' ').replace(/\s+/g,' ').trim();}
function tokens(s){return norm(s).split(' ').filter(Boolean).sort();}
function tokeq(a,b){const x=tokens(a),y=tokens(b);return x.length===y.length&&x.every((t,i)=>t===y[i]);}
// mc 답을 1-based 인덱스로 정규화: 숫자면 그대로, "T"/"F"/선지텍스트면 ch에서 매핑(워크북 T/F 자동솔버는 글자로 저장). 해석불가=null(비교 스킵)
function mcIdx(pick, ch){
  if(pick==null) return null;
  const n=Number(pick);
  if(Number.isFinite(n)) return n;
  if(Array.isArray(ch)){ const i=ch.findIndex(c=>norm(c)===norm(pick)); if(i>=0) return i+1; }
  return null;
}

function sweep(file){
  const issues=[];
  let d; try{d=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){return{file,issues:['PARSE: '+e.message]};}
  const qs=d.questions||[];
  const testType=d.testType||'';
  const dir=path.dirname(file);

  // 1) self-blind 불일치 + 미검증(pending) 집계
  const bf=file.replace(/\.json$/,'.blind.json');
  if(fs.existsSync(bf)){
    try{
      const b=JSON.parse(fs.readFileSync(bf,'utf8'));
      const solves=b.solves||[];
      let pending=0;
      for(const s of solves){
        // 실제 자동풀이된 것만 대조 (needsAgent=자동솔버 못 품 → 미검증)
        if(s.needsAgent){ pending++; continue; }
        if(s.myAnswer==null||s.correctAnswer==null) continue;
        const q=qs.find(x=>String(x.id)===String(s.id));
        // self-blind 자동솔버는 mc(마커대조)만 신뢰. 서술형 조건영작은 못 풀어 지문덤프 → cross-blind(L3)가 담당.
        if(q&&q.fmt==='written') continue;
        const myI=mcIdx(s.myAnswer,q&&q.ch), coI=mcIdx(s.correctAnswer,q&&q.ch);
        if(myI!=null&&coI!=null&&myI!==coI)
          issues.push(`BLIND-MISMATCH Q${s.id}: 자동솔버 "${s.myAnswer}" ≠ 정답 "${s.correctAnswer}"`);
      }
      // cross-blind 필수: self-blind는 생성모델 자기검증(순환) → 반대모델 증적 없으면 승인 불가
      const cbf=file.replace(/\.json$/,'.cross-blind.json');
      if(!fs.existsSync(cbf)){
        issues.push(`NEEDS-CROSSBLIND: 반대모델 크로스검증(.cross-blind.json) 없음 — self-blind는 순환검증이라 정답정확성 미보장`);
      } else {
        // 크로스검증 결과 대조 (+커버리지 강제: 전 mc/written 문항이 실제 풀이돼야 인정)
        try{
          const cb=JSON.parse(fs.readFileSync(cbf,'utf8'));
          const cs=cb.solves||cb.results||[];
          // 정식 크로스블라인드 키=pick (cross-blind.js 기준). myAnswer/answer는 하위호환.
          const pickOf=s=>s.pick??s.myAnswer??s.answer;
          const solvedIds=new Set(cs.filter(s=>pickOf(s)!=null).map(s=>String(s.id)));
          const need=qs.filter(q=>q.fmt==='mc'||q.fmt==='written').map(q=>String(q.id));
          const uncov=need.filter(id=>!solvedIds.has(id));
          if(uncov.length) issues.push(`CROSSBLIND-INCOMPLETE: ${need.length}문항 중 ${uncov.length}개 미풀이(빈껍데기/누락 Q${uncov.slice(0,6).join(',')}) — 크로스검증 무효`);
          for(const s of cs){
            const q=qs.find(x=>String(x.id)===String(s.id));
            if(!q) continue;
            const my=pickOf(s);
            if(my==null) continue;
            let mism;
            if(q.fmt==='written'){
              const accept=(q.accept||[]).map(norm);
              mism = norm(my)!==norm(q.wa) && !accept.includes(norm(my));
            } else { const mi=mcIdx(my,q.ch); mism = mi!=null && mi!==Number(q.ans); }
            if(mism) issues.push(`CROSSBLIND-MISMATCH Q${s.id}: 반대모델 "${my}" ≠ 정답 "${q.fmt==='written'?q.wa:q.ans}" (정답오류/모호 의심)`);
          }
        }catch(e){issues.push('CROSSBLIND-PARSE: '+e.message);}
      }
    }catch(e){issues.push('BLIND-PARSE: '+e.message);}
  } else issues.push('NO-BLIND: .blind.json 없음(재출제 미검증)');

  for(const q of qs){
    const id=q.id, ch=q.ch||[], ans=q.ans, det=(q.det||{}).analysis||'';
    // 2) 선지 완전중복
    if(q.fmt==='mc'&&ch.length){
      const nn=ch.map(norm);
      for(let i=0;i<nn.length;i++)for(let j=i+1;j<nn.length;j++)
        if(nn[i]&&nn[i]===nn[j]) issues.push(`DUP-CHOICE Q${id}: 선지 ${i+1}==${j+1}`);
      // ans 범위
      if(!(ans>=1&&ans<=ch.length)) issues.push(`ANS-RANGE Q${id}: ans ${ans} 범위밖(${ch.length})`);
    }
    // 3) 조건영작: [조건] 토큰셋 == wa 토큰셋 (기능어 포함 전부 제시 확인)
    if(q.fmt==='written'&&q.wa){
      const stem=q.stem||'';
      const condm=stem.match(/\[조건\][\s\S]*/);
      if(condm){
        // 영어 단어만 추출해 비교(한국어 조사 "water를"·하이픈 "Earth-sun" 둘 다 정확 처리)
        const engWords=s=>(String(s).match(/[a-zA-Z]+/g)||[]).map(w=>w.toLowerCase());
        const condSet=new Set(engWords(condm[0]));
        const missing=engWords(q.wa).filter(t=>!condSet.has(t));
        if(missing.length) issues.push(`COND-MISS Q${id}: wa 단어 [조건]에 누락 ${[...new Set(missing)].slice(0,4)}`);
      }
      // wa가 passage에 그대로 노출 — 단, 찾기형(본문에서 찾아쓰기)은 정답이 본문에 있는 게 정상(validate V69도 찾기 예외)
      // 정규식은 validate.js:516 V69와 동일(단일소스): "위 글에서 찾아 영어로 쓰시오"도 잡음
      const isFind=/본문에서\s*찾아|본문\s*속|글에서\s*찾아|본문에서\s*고르|찾아\s*쓰시오|찾아쓰시오/.test(q.stem||'');
      if(!isFind&&q.passage&&norm(q.passage).includes(norm(q.wa))&&q.wa.split(/\s+/).length>=3)
        issues.push(`WA-EXPOSED Q${id}: 서술형 정답 passage 노출`);
      // 찾기형 잔존 — 예상문제(퀴즈)만 금지(자동채점 복수정답). 워크북 서술형은 찾기형 허용.
      if(testType==='퀴즈'&&isFind) issues.push(`FIND-TYPE Q${id}: 찾기형 잔존(조건형 위반)`);
    }
    // 4) 해설 빈약
    if(det.length<20) issues.push(`DET-THIN Q${id}: 해설 ${det.length}자`);
    // 5) 영어선지인데 해설 한국어 없음
    if(q.fmt==='mc'&&ch.some(c=>/^[A-Za-z][A-Za-z .,'\-]{6,}$/.test(String(c).trim()))){
      const kr=(det.match(/[가-힣]/g)||[]).length;
      if(kr<20) issues.push(`EN-CHOICE-NO-KR Q${id}: 영어선지 해설 한글 ${kr}자`);
    }
  }

  // 5b) 단일유형 중복: 주제/제목/요지/함축/지칭은 한 지문에 1회만 (2회+=중복문항, cross-blind가 잡은 슬롯결함 코드화)
  // 예상문제(퀴즈)만 적용. 워크북은 스키마상 slot18·19에 "주제/요지" 2슬롯을 설계상 배치(주제·요지 각1)→오탐 방지.
  if(testType==='퀴즈'){
    const UNIQ=['주제','제목','요지','대의','함축','지칭'];
    const tcount={};
    for(const q of qs){ const t=String(q.type||''); for(const u of UNIQ) if(t.includes(u)) tcount[u]=(tcount[u]||0)+1; }
    for(const u of UNIQ) if((tcount[u]||0)>1) issues.push(`DUP-UNIQ-TYPE: "${u}" 유형 ${tcount[u]}회 — 한 지문에 1회만(중복문항)`);
  }

  // 6) cross-type 중복: 같은 지문 단어/워크북과 정답/wa 겹침 (v6 형제끼리만 — v3는 곧 재생성되므로 비교 무의미)
  for(const other of ['단어.json','워크북.json','퀴즈.json']){
    const op=path.join(dir,other);
    if(!fs.existsSync(op))continue;
    if(path.resolve(op)===path.resolve(file))continue; // 자기 자신 제외(단어/워크북 sweep 시 오탐 방지)
    try{
      const od=JSON.parse(fs.readFileSync(op,'utf8'));
      const ohk=(od.ei||{}).histKey||'';
      if(!ohk.includes('_v6')) continue; // 형제가 아직 v6 아니면 skip (재생성 시 회피 처리)
      const owa=new Set((od.questions||[]).filter(x=>x.fmt==='written'&&x.wa).map(x=>norm(x.wa)));
      for(const q of qs) if(q.fmt==='written'&&q.wa&&owa.has(norm(q.wa)))
        issues.push(`XTYPE-DUP Q${q.id}: wa가 ${other}(v6)와 동일`);
    }catch(e){}
  }
  return {file,issues};
}

const files=process.argv.slice(2);
let quarantine=0;
for(const f of files){
  const r=sweep(f);
  const rel=r.file.replace(/.*\/data\//,'data/');
  if(r.issues.length){quarantine++;console.log(`\n❌ QUARANTINE ${rel}`);r.issues.forEach(i=>console.log('   - '+i));}
  else console.log(`✅ PASS ${rel}`);
}
console.log(`\n=== ${files.length}개 중 격리 ${quarantine}개 / 통과 ${files.length-quarantine}개 ===`);
process.exit(quarantine?1:0);
