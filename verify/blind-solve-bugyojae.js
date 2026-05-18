#!/usr/bin/env node
/**
 * Blind solve all MC questions in 부교재 (excluding 수능특강/영어).
 * Reads file list from /tmp/blind_files.txt
 * Output: /tmp/blind_bugyojae_report.json + console
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// load .env
try {
  const envText = fs.readFileSync('.env', 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('NO API KEY'); process.exit(1); }

const files = fs.readFileSync('/tmp/blind_files.txt', 'utf8').trim().split('\n').filter(Boolean);

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: prompt }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.content && p.content[0]) resolve(p.content[0].text);
          else reject(new Error('Bad: ' + data.substring(0,200)));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function strip(s) { return (s||'').replace(/<[^>]+>/g,''); }

function buildPrompt(q, fullPassage) {
  const passage = q.passage === '__FULL__' ? fullPassage : (q.passage || fullPassage || '');
  const choices = (q.ch||[]).map((c,i)=>`${i+1}. ${strip(c)}`).join('\n');
  return `You are an expert English teacher solving a Korean high school English test. Read carefully and answer with ONLY the choice number (1, 2, 3, or 4 — or 5 if 5 choices).

${passage ? 'Passage:\n'+strip(passage)+'\n\n' : ''}Question: ${strip(q.stem||'')}

Choices:
${choices}

Answer (number only):`;
}

const TARGET_TYPES = /어법|부적절|어울리지|ABC|\(A\)|빈칸|동의어|영영|T\/F|참거짓|일치|불일치/;

(async () => {
  const report = { files: [], mismatches: [], errors: [], stats: { files:0, mc:0, pass:0, mismatch:0 } };
  for (const fp of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(fp,'utf8')); }
    catch (e) { report.errors.push({file:fp, error:'parse'}); continue; }
    const qs = data.questions || [];
    if (!qs.length) continue;
    report.stats.files++;
    let fileMis = 0, fileMc = 0;
    for (let i=0; i<qs.length; i++) {
      const q = qs[i];
      if (q.fmt !== 'mc') continue;
      // Focus on target types but also include all MC for completeness
      fileMc++; report.stats.mc++;
      try {
        const ai = (await callClaude(buildPrompt(q, data.fullPassage||''))).trim();
        const aiNum = parseInt(ai.replace(/[^0-9]/g,''));
        const exp = typeof q.ans==='number' ? q.ans : parseInt(q.ans);
        if (aiNum !== exp) {
          fileMis++; report.stats.mismatch++;
          report.mismatches.push({ file: fp.replace(/.*data\//,''), qnum:i+1, type:q.type, expected:exp, ai:aiNum, stem: strip(q.stem||'').substring(0,60) });
        } else {
          report.stats.pass++;
        }
      } catch (e) {
        report.errors.push({file:fp, qnum:i+1, error:e.message});
      }
      await new Promise(r=>setTimeout(r,300));
    }
    const status = fileMis===0 ? 'PASS' : 'FAIL';
    console.log(`${status} ${fp.replace(/.*data\//,'')} ${fileMc-fileMis}/${fileMc}`);
    report.files.push({file:fp, mc:fileMc, mismatch:fileMis});
    fs.writeFileSync('/tmp/blind_bugyojae_report.json', JSON.stringify(report,null,2));
  }
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(report.stats, null, 2));
})();
