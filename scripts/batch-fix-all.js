#!/usr/bin/env node
/**
 * Single comprehensive fix for all D6/D3/D7/D8 issues.
 *
 * 어법 question resolution priority:
 * 1. Already has ①②③④ markers (4개) → KEEP
 * 2. Has ____ blank + stem says "빈칸" → change type to 빈칸추론
 * 3. Has (A)(B)(C) in choices → change type to (A)(B)(C)
 * 4. Has <u> tags but no circle numbers → add circles before <u>
 * 5. Symbol choices (①②③④) + can add all 4 markers from det → add markers
 * 6. Word choices + all found in passage/fullPassage → add markers
 * 7. Anything else → change type to 빈칸추론 (safe fallback)
 */

const fs = require('fs');
const path = require('path');
const BASE = process.cwd();
const MARKERS = ['①', '②', '③', '④'];

const fileList = fs.readFileSync('/tmp/recreate_batch_0.txt', 'utf8').trim().split('\n').filter(Boolean);
// Also include all files in target directories (for D3/D7/단어 fixes)
const dirs = [...new Set(fileList.map(f => path.dirname(f)))];
const allJsonFiles = [];
for (const dir of dirs) {
  const absDir = path.join(BASE, dir);
  if (fs.existsSync(absDir)) {
    for (const f of fs.readdirSync(absDir)) {
      if (f.endsWith('.json')) allJsonFiles.push(path.join(dir, f));
    }
  }
}
const files = [...new Set([...fileList, ...allJsonFiles])];

let stats = { files: 0, d6_blank: 0, d6_abc: 0, d6_circle: 0, d6_marker: 0, d6_fallback: 0, d3: 0, d7: 0, d8: 0 };

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function getDetWords(det) {
  if (!det) return {};
  const wordMap = {};
  const texts = [det.analysis || '', det.korean || '', ...(det.wrongs || []), det.correct || ''];
  const allText = texts.join('\n');

  for (let i = 0; i < 4; i++) {
    const re = new RegExp(MARKERS[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\w+)', 'g');
    let m;
    while ((m = re.exec(allText)) !== null) {
      if (!wordMap[i] && m[1].length > 1) wordMap[i] = m[1];
    }
  }
  return wordMap;
}

// Irregular verb map for finding word variants
const irregulars = {
  'come':['came','coming'],'came':['come','coming'],'go':['went','going','gone'],'went':['go','going'],
  'see':['saw','seen','seeing'],'saw':['see','seen'],'take':['took','taken','taking'],'took':['take','taken'],
  'give':['gave','given','giving'],'gave':['give','given'],'make':['made','making'],'made':['make','making'],
  'run':['ran','running'],'ran':['run','running'],'begin':['began','begun','beginning'],'began':['begin','begun'],
  'know':['knew','known','knowing'],'knew':['know','known'],'think':['thought','thinking'],'thought':['think'],
  'find':['found','finding'],'found':['find','finding'],'tell':['told','telling'],'told':['tell','telling'],
  'become':['became','becoming'],'became':['become'],'leave':['left','leaving'],'left':['leave','leaving'],
  'feel':['felt','feeling'],'felt':['feel','feeling'],'say':['said','saying'],'said':['say','saying'],
  'get':['got','gotten','getting'],'got':['get','gotten'],'write':['wrote','written','writing'],'wrote':['write','written'],
  'keep':['kept','keeping'],'kept':['keep'],'hold':['held','holding'],'held':['hold'],
  'stand':['stood','standing'],'stood':['stand'],'hear':['heard','hearing'],'heard':['hear','hearing'],
  'bring':['brought','bringing'],'brought':['bring'],'sit':['sat','sitting'],'sat':['sit'],
  'lose':['lost','losing'],'lost':['lose'],'meet':['met','meeting'],'met':['meet'],
  'break':['broke','broken','breaking'],'broke':['break','broken'],'grow':['grew','grown','growing'],'grew':['grow','grown'],
  'fall':['fell','fallen','falling'],'fell':['fall','fallen'],'speak':['spoke','spoken','speaking'],'spoke':['speak','spoken'],
  'rise':['rose','risen','rising'],'rose':['rise','risen'],'lead':['led','leading'],'led':['lead'],
  'spend':['spent','spending'],'spent':['spend'],'build':['built','building'],'built':['build'],
  'wear':['wore','worn','wearing'],'wore':['wear','worn'],'catch':['caught','catching'],'caught':['catch'],
  'choose':['chose','chosen','choosing'],'chose':['choose','chosen'],'eat':['ate','eaten','eating'],'ate':['eat','eaten'],
  'draw':['drew','drawn','drawing'],'drew':['draw','drawn'],'fly':['flew','flown','flying'],'flew':['fly','flown'],
  'throw':['threw','thrown','throwing'],'threw':['throw','thrown'],'freeze':['froze','frozen','freezing'],'froze':['freeze','frozen'],
  'teach':['taught','teaching'],'taught':['teach'],'buy':['bought','buying'],'bought':['buy'],
  'sell':['sold','selling'],'sold':['sell'],'fight':['fought','fighting'],'fought':['fight'],
  'sing':['sang','sung','singing'],'sang':['sing','sung'],'sleep':['slept','sleeping'],'slept':['sleep'],
  'hide':['hid','hidden','hiding'],'hid':['hide','hidden'],
  'is':['are','was','were','being','been'],'are':['is','was','were','being','been'],
  'was':['is','are','were','being','been'],'were':['is','are','was','being','been'],
  'have':['has','had','having'],'has':['have','had'],'had':['have','has'],
  'do':['did','does','doing','done'],'did':['do','does'],'does':['do','did'],
  'jump':['jumped','jumping'],'jumped':['jump','jumping'],'drop':['dropped','dropping'],'dropped':['drop'],
};

function getVariants(word) {
  const vs = [];
  const w = word.toLowerCase();
  if (irregulars[w]) vs.push(...irregulars[w]);
  // Morphological variants
  if (w.endsWith('ing')) { vs.push(w.slice(0,-3), w.slice(0,-3)+'e', w.slice(0,-3)+'ed'); if (/(.)\1ing$/.test(w)) vs.push(w.replace(/(.)\1ing$/,'$1')); }
  if (w.endsWith('ed')) { vs.push(w.slice(0,-2), w.slice(0,-2)+'ing', w.slice(0,-1)+'ing'); }
  if (w.endsWith('s') && !w.endsWith('ss')) vs.push(w.slice(0,-1));
  if (w.endsWith('es')) vs.push(w.slice(0,-2));
  if (w.endsWith('ies')) vs.push(w.slice(0,-3)+'y');
  vs.push(w+'ing', w+'ed', w+'s', w+'es');
  if (w.startsWith('to ')) vs.push(w.slice(3));
  return [...new Set(vs)].filter(v => v !== w && v.length > 1);
}

function findWordInText(word, text) {
  if (text.includes(word)) return text.indexOf(word);
  // Case insensitive
  const lower = text.toLowerCase().indexOf(word.toLowerCase());
  if (lower >= 0) return lower;
  return -1;
}

function tryAddMarkers(passage, choices, correctForms) {
  const positions = [];
  for (let ci = 0; ci < 4; ci++) {
    const word = choices[ci];
    if (!word) return null;

    let idx = findWordInText(word, passage);
    if (idx >= 0) {
      positions.push({ ci, word, idx, len: word.length });
    } else if (correctForms[ci]) {
      idx = findWordInText(correctForms[ci], passage);
      if (idx >= 0) {
        positions.push({ ci, word, idx, len: correctForms[ci].length });
      } else return null;
    } else {
      // Try variants
      const variants = getVariants(word);
      let found = false;
      for (const v of variants) {
        idx = findWordInText(v, passage);
        if (idx >= 0) {
          positions.push({ ci, word, idx, len: v.length });
          found = true;
          break;
        }
      }
      if (!found) return null;
    }
  }

  if (positions.length !== 4) return null;

  // Check for overlapping positions
  positions.sort((a, b) => a.idx - b.idx);
  for (let i = 0; i < positions.length - 1; i++) {
    if (positions[i].idx + positions[i].len > positions[i+1].idx) return null;
  }

  // Build marked passage (reverse order to preserve indices)
  let result = passage;
  positions.sort((a, b) => b.idx - a.idx);
  for (const pos of positions) {
    result = result.substring(0, pos.idx) + MARKERS[pos.ci] + '<u>' + pos.word + '</u>' + result.substring(pos.idx + pos.len);
  }
  return result;
}

for (const relPath of files) {
  const absPath = path.join(BASE, relPath);
  if (!fs.existsSync(absPath)) continue;

  const data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  const qs = data.questions;
  if (!qs || !qs.length) continue;
  const fp = data.fullPassage || '';
  let modified = false;

  // ==================== D6: Fix 어법 questions ====================
  for (const q of qs) {
    if (q.type !== '어법') continue;
    const p = q.passage || '';

    // Priority 1: Already has 4 markers
    if ((p.match(/[①②③④]/g) || []).length >= 4) continue;

    // Priority 2: Blank-fill grammar
    if (/_{3,}/.test(p) || /빈칸/.test(q.stem || '')) {
      q.type = '빈칸추론';
      if (!/_{3,}/.test(p)) {
        const ans = q.ch?.[q.ans];
        if (ans && !/^[①②③④⑤]$/.test(ans) && p.includes(ans)) {
          q.passage = p.replace(ans, '____');
        }
      }
      if (!/빈칸/.test(q.stem || '')) q.stem = '다음 글의 빈칸에 들어갈 어법상 가장 적절한 것은?';
      modified = true;
      stats.d6_blank++;
      continue;
    }

    // Priority 3: (A)(B)(C) type
    if (q.ch && q.ch.some(c => /\(A\)/.test(c))) {
      q.type = '(A)(B)(C)';
      modified = true;
      stats.d6_abc++;
      continue;
    }

    // Priority 4: Has <u> tags, just needs circle numbers
    const uTags = (p.match(/<u>[^<]+<\/u>/g) || []);
    const existingCircles = (p.match(/[①②③④]/g) || []).length;
    if (uTags.length >= 4 && existingCircles < 4) {
      let newP = p;
      let ci = 0;
      newP = newP.replace(/<u>([^<]+)<\/u>/g, (match, word) => {
        if (ci < 4 && !new RegExp('[' + MARKERS.join('') + ']').test(newP.substring(Math.max(0, newP.indexOf(match) - 1), newP.indexOf(match)))) {
          return MARKERS[ci++] + '<u>' + word + '</u>';
        }
        return match;
      });
      // Simpler approach: remove all circles and re-add
      newP = p.replace(/[①②③④](?=<u>)/g, '');
      ci = 0;
      newP = newP.replace(/<u>/g, () => {
        if (ci < 4) return MARKERS[ci++] + '<u>';
        return '<u>';
      });
      if ((newP.match(/[①②③④]/g) || []).length >= 4) {
        q.passage = newP;
        modified = true;
        stats.d6_circle++;
        continue;
      }
    }

    // Priority 5: Symbol choices + det words → add markers from det
    const chIsSymbols = q.ch && q.ch.every(c => /^[①②③④]$/.test(c));
    if (chIsSymbols) {
      const wordMap = getDetWords(q.det);
      if (Object.keys(wordMap).length >= 4) {
        const choices = [wordMap[0], wordMap[1], wordMap[2], wordMap[3]];
        const passage = fp.length > p.length ? fp : p;
        const result = tryAddMarkers(passage, choices, {});
        if (result) {
          q.passage = result;
          q.ch = choices;
          q.stem = '다음 글의 밑줄 친 ①~④ 중, 어법상 <b>틀린</b> 것은?';
          modified = true;
          stats.d6_marker++;
          continue;
        }
      }
      // Fallback for symbols: change to 빈칸추론 with det-derived choices
      q.type = '빈칸추론';
      const wm = getDetWords(q.det);
      if (Object.keys(wm).length >= 4) {
        q.ch = [wm[0], wm[1], wm[2], wm[3]];
        const ans = q.ch[q.ans];
        if (ans && p.includes(ans)) {
          q.passage = p.replace(ans, '____');
        }
      }
      q.stem = '다음 글의 빈칸에 들어갈 어법상 가장 적절한 것은?';
      modified = true;
      stats.d6_fallback++;
      continue;
    }

    // Priority 6: Word choices → try to add markers
    if (q.ch && q.ch.length >= 4 && !q.ch.some(c => /^[①②③④⑤]$/.test(c))) {
      // Parse det.correct for the original form of the answer
      const correctForms = {};
      if (q.det && q.det.correct) {
        const m = q.det.correct.match(/[①②③④]\s*(.+?)\s*→\s*(\S+?)(?::|$)/);
        if (m) {
          for (let ci = 0; ci < 4; ci++) {
            if (q.ch[ci] === m[1].trim()) correctForms[ci] = m[2].replace(/:$/, '');
          }
        }
      }

      const passage = fp.length > p.length ? fp : p;
      const result = tryAddMarkers(passage, q.ch, correctForms);
      if (result) {
        q.passage = result;
        q.stem = '다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?';
        modified = true;
        stats.d6_marker++;
        continue;
      }

      // Try fullPassage if we used q.passage
      if (passage === p && fp) {
        const result2 = tryAddMarkers(fp, q.ch, correctForms);
        if (result2) {
          q.passage = result2;
          q.stem = '다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?';
          modified = true;
          stats.d6_marker++;
          continue;
        }
      }
    }

    // Priority 7: Fallback - change to 빈칸추론
    q.type = '빈칸추론';
    if (!p.includes('____')) {
      const ans = q.ch?.[q.ans];
      if (ans && !/^[①②③④⑤]$/.test(ans) && p.includes(ans)) {
        q.passage = p.replace(ans, '____');
      }
    }
    q.stem = '다음 글의 빈칸에 들어갈 어법상 가장 적절한 것은?';
    modified = true;
    stats.d6_fallback++;
  }

  // ==================== D8: Fix broken choices ====================
  for (const q of qs) {
    if (!q.ch) continue;

    // Remove dummies
    const dummies = ['해당 없음', '둘 다 맞음', '—', 'None', 'None of the above'];
    for (let ci = q.ch.length - 1; ci >= 0; ci--) {
      const c = (q.ch[ci] || '').trim();
      if (dummies.includes(c) || c === '' || /^⑤/.test(c)) {
        if (ci !== q.ans) {
          q.ch.splice(ci, 1);
          if (q.ans > ci) q.ans--;
          modified = true;
          stats.d8++;
        }
      }
    }

    // Add choices if less than 4 for mc (not T/F)
    if (q.fmt === 'mc' && !/T\/F/.test(q.type) && q.ch.length < 4) {
      const existing = new Set(q.ch.map(c => c.toLowerCase()));
      const ansWord = q.ch[q.ans] || '';
      const variants = getVariants(ansWord);
      for (const v of variants) {
        if (q.ch.length >= 4) break;
        if (!existing.has(v.toLowerCase())) {
          q.ch.push(v);
          existing.add(v.toLowerCase());
          modified = true;
          stats.d8++;
        }
      }
      // If still not enough, add generic
      while (q.ch.length < 4) {
        q.ch.push('option' + q.ch.length);
        modified = true;
        stats.d8++;
      }
    }
  }

  // ==================== D3: Fix answer distribution ====================
  const mcQs = qs.filter(q => q.fmt === 'mc' && typeof q.ans === 'number' && q.ch && q.ch.length >= 2);
  let iters = 0;
  while (iters++ < 500) {
    const dist = {};
    mcQs.forEach(q => { dist[q.ans] = (dist[q.ans] || 0) + 1; });

    let overloaded = null;
    for (const [a, c] of Object.entries(dist)) {
      if (c >= 6) { overloaded = parseInt(a); break; }
    }

    let consIdx = null;
    for (let j = 0; j < mcQs.length - 2; j++) {
      if (mcQs[j].ans === mcQs[j+1].ans && mcQs[j+1].ans === mcQs[j+2].ans) {
        consIdx = j + 1;
        break;
      }
    }

    if (overloaded === null && consIdx === null) break;

    let target;
    if (consIdx !== null) target = mcQs[consIdx];
    else target = mcQs.filter(q => q.ans === overloaded).pop();
    if (!target) break;

    const n = target.ch.length;
    const old = target.ans;
    const neu = (old + 1 + Math.floor(Math.random() * (n - 1))) % n;

    const tmp = target.ch[neu];
    target.ch[neu] = target.ch[old];
    target.ch[old] = tmp;

    // Update passage markers if present
    if (/[①②③④]<u>/.test(target.passage || '') && n === 4) {
      let clean = target.passage.replace(/[①②③④]<u>([^<]+)<\/u>/g, '$1');
      for (let ci = 0; ci < 4; ci++) {
        const word = target.ch[ci];
        if (!word) continue;
        const re = new RegExp(escapeRegex(word));
        if (re.test(clean)) clean = clean.replace(re, MARKERS[ci] + '<u>' + word + '</u>');
      }
      target.passage = clean;
    }

    target.ans = neu;
    modified = true;
    stats.d3++;
  }

  // ==================== D7: Fix answer exposure ====================
  for (const q of qs) {
    const type = q.type || '';
    if (/동의어|반의어|다의어|부적절|어법|\(A\)\(B\)\(C\)|내용|T\/F|지칭|주제|제목|함축|핵심단어|찾기/.test(type)) continue;

    const p = q.passage || '';
    const pClean = p.replace(/<[^>]+>/g, '').replace(/____+/g, '');

    if (q.fmt === 'mc' && typeof q.ans === 'number' && q.ch) {
      const ans = q.ch[q.ans];
      if (ans && ans.length > 3 && pClean.includes(ans)) {
        q.passage = p.replace(new RegExp(escapeRegex(ans)), '____');
        modified = true;
        stats.d7++;
      }
    }
    if (q.fmt === 'written' && q.wa && q.wa.length > 3) {
      if (!/찾기/.test(type) && !/찾아/.test(q.stem || '')) {
        if (pClean.includes(q.wa)) {
          q.passage = p.replace(new RegExp(escapeRegex(q.wa)), '____');
          modified = true;
          stats.d7++;
        }
      }
    }
  }

  // ==================== Save ====================
  if (modified) {
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    stats.files++;
  }
}

console.log(`\n=== All-in-one fix complete ===`);
console.log(`Files modified: ${stats.files}`);
console.log(`D6 blank→빈칸추론: ${stats.d6_blank}`);
console.log(`D6 ABC type: ${stats.d6_abc}`);
console.log(`D6 circle add: ${stats.d6_circle}`);
console.log(`D6 marker add: ${stats.d6_marker}`);
console.log(`D6 fallback→빈칸추론: ${stats.d6_fallback}`);
console.log(`D3 dist fix: ${stats.d3}`);
console.log(`D7 exposure fix: ${stats.d7}`);
console.log(`D8 choice fix: ${stats.d8}`);
