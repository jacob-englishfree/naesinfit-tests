#!/usr/bin/env node
/**
 * Blind solve ALL MC questions in 수능특강 13강~24강
 * Focus types: 어법, 부적절, ABC조합, 빈칸, 동의어, T/F
 * Reports mismatches; does NOT auto-modify files (jacob review required).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath,'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
  }
}
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('No ANTHROPIC_API_KEY'); process.exit(1); }

const FOCUS = ['어법','부적절','ABC조합','빈칸','동의어','T/F','TF','내용일치','내용불일치'];
const ROOT = path.join(__dirname, '..', 'data', '부교재', '수능특강', '영어');
const LECS = ['13강','14강','15강','16강','17강','18강','19강','20강','21강','22강','23강','24강'];

function walk(dir, out=[]) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.includes('_passages')) walk(f, out); }
    else if (e.name.endsWith('.json') && !f.includes('_passages')) out.push(f);
  }
  return out;
}

let files = [];
for (const l of LECS) walk(path.join(ROOT, l), files);
console.log(`Files: ${files.length}`);

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16,
      messages: [{role:'user', content: prompt}]
    });
    const req = https.request({
      hostname:'api.anthropic.com', path:'/v1/messages', method:'POST',
      headers: {'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01'}
    }, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{
        try { const p=JSON.parse(d); if(p.content&&p.content[0]) resolve(p.content[0].text); else reject(new Error(d.substring(0,200))); }
        catch(e){reject(e);}
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

function buildPrompt(q, full) {
  const passage = (q.passage === '__FULL__' ? full : (q.passage || full || '')).replace(/<[^>]+>/g,'');
  const choices = (q.ch||[]).map((c,i)=>`${i+1}. ${c.replace(/<[^>]+>/g,'')}`).join('\n');
  return `Solve this Korean English exam question. Reply ONLY with the answer number (1-5).

Passage:
${passage}

Question: ${(q.stem||'').replace(/<[^>]+>/g,'')}

${choices}

Answer number only:`;
}

async function retryCall(prompt, tries=3) {
  for (let i=0;i<tries;i++) {
    try { return await callClaude(prompt); }
    catch(e) { if(i===tries-1) throw e; await new Promise(r=>setTimeout(r,1500*(i+1))); }
  }
}

(async () => {
  const mismatches = [];
  let qTotal=0, qPass=0, qFail=0, qSkip=0;
  const startedAt = Date.now();

  for (let fi=0; fi<files.length; fi++) {
    const fp = files[fi];
    let data;
    try { data = JSON.parse(fs.readFileSync(fp,'utf8')); } catch { continue; }
    const qs = data.questions || [];
    const short = fp.replace(ROOT+'/','');
    let fileMis = 0, fileChecked=0;

    const targets = [];
    for (const q of qs) {
      if (q.fmt !== 'mc') { qSkip++; continue; }
      if (!FOCUS.some(t => (q.type||'').includes(t))) { qSkip++; continue; }
      if (q.ans==null) { qSkip++; continue; }
      targets.push(q);
    }
    // Process in parallel batches of 8
    const BATCH = 8;
    for (let bi=0; bi<targets.length; bi+=BATCH) {
      const batch = targets.slice(bi, bi+BATCH);
      const results = await Promise.all(batch.map(async q => {
        try {
          const ans = await retryCall(buildPrompt(q, data.fullPassage||''));
          const aiNum = parseInt((ans||'').replace(/[^0-9]/g,''));
          return {q, aiNum};
        } catch(e) { return {q, error:e.message.substring(0,80)}; }
      }));
      for (const r of results) {
        qTotal++; fileChecked++;
        if (r.error) { mismatches.push({file:short,qid:r.q.id,type:r.q.type,error:r.error}); }
        else if (r.aiNum && r.aiNum !== r.q.ans) {
          qFail++; fileMis++;
          mismatches.push({file:short,qid:r.q.id,type:r.q.type,expected:r.q.ans,ai:r.aiNum});
        } else qPass++;
      }
    }
    const elapsed = ((Date.now()-startedAt)/1000).toFixed(0);
    console.log(`[${fi+1}/${files.length}] ${fileMis?'X':'O'} ${short} (${fileChecked-fileMis}/${fileChecked}) t=${elapsed}s`);

    // Periodic save
    if ((fi+1) % 10 === 0) {
      fs.writeFileSync(path.join(__dirname,'..','blind-solve-reports','13to24-progress.json'),
        JSON.stringify({done:fi+1,total:files.length,qTotal,qPass,qFail,mismatches},null,2));
    }
  }

  const out = path.join(__dirname,'..','blind-solve-reports','13to24-final.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out, JSON.stringify({
    files:files.length, qTotal, qPass, qFail, qSkip, mismatches
  },null,2));
  console.log(`\nDONE  files=${files.length} checked=${qTotal} pass=${qPass} fail=${qFail} skip=${qSkip}`);
  console.log(`Report: ${out}`);
})();
