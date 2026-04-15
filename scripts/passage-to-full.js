#!/usr/bin/env node
/**
 * passage-to-full.js
 * 모의고사/부교재 테스트 JSON의 question.passage를
 * fullPassage 통째로 + 해당 문항 마커만 splice한 버전으로 변환.
 *
 * Usage:
 *   node scripts/passage-to-full.js <folder> [--dry-run|--apply]
 *
 * Safety:
 *   - --apply 시 git tag 자동 생성 (pre-fullpass-<slug>-<ts>)
 *   - 이 스크립트는 절대 git commit/push를 하지 않음. 사용자가 수동으로 검토 후 커밋.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MANUAL_QUEUE_PATH = path.join(__dirname, 'passage-manual-queue.txt');
const LEAK_SUSPICION_PATH = path.join(__dirname, 'passage-leak-suspicions.txt');
const MARKER_CLUSTER_PATH = path.join(__dirname, 'passage-marker-cluster.txt');

// ---------- utils ----------
function walkJson(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkJson(p, out);
    else if (/\.(json)$/i.test(name) && /^(단어|워크북|퀴즈)\.json$/.test(name)) out.push(p);
  }
  return out;
}

// Strip all markers/HTML/blanks to get "normal" comparable text.
// For (A)(B)(C)(D) [X / Y] patterns, pick the FIRST option.
function normalize(s) {
  if (!s) return '';
  return s
    .replace(/<b>\([A-D]\)<\/b>\s*\[\s*([^\]/]+?)\s*\/[^\]]*\]/g, ' $1 ')
    .replace(/<\/?[bu]>/g, '')
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')
    .replace(/\(\s*[①②③④⑤]\s*\)/g, ' ')
    .replace(/_{2,}/g, ' ')
    .replace(/\([^()]{1,30}\)/g, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitSentences(text) {
  const parts = [];
  const re = /[^.!?]+[.!?]+(?:["')\]]*)/g;
  let m;
  while ((m = re.exec(text)) !== null) parts.push(m[0].trim());
  if (parts.length === 0 && text.trim()) parts.push(text.trim());
  return parts;
}

function hasMarkers(s) {
  return /[①②③④⑤]|<u>|<b>\([A-D]\)<\/b>|_{2,}|\(\s*[①②③④⑤]\s*\)/.test(s);
}

function hasParenBlank(s) {
  return /\([a-zA-Z][^()]{0,25}\)/.test(s);
}

function classify(pass) {
  if (!pass) return 'empty';
  if (/<b>\([A-D]\)<\/b>\s*\[/.test(pass)) return 'ABCD';
  if (/[①②③④⑤]\s*<u>|<u>[^<]*<\/u>/.test(pass) && /[①②③④⑤]/.test(pass)) return 'grammar';
  if (/[①②③④⑤]\s*[A-Z]/.test(pass) && !/<u>/i.test(pass) && (pass.match(/[①②③④⑤]/g) || []).length >= 3) return 'sentence-grammar';
  if (/\(\s*[①②③④⑤]\s*\)/.test(pass)) return 'insert';
  if (/_{2,}/.test(pass)) return 'blank';
  if (hasParenBlank(pass) && !hasMarkers(pass)) return 'paren';
  return 'plain';
}

// Find best matching full-passage sentence for a given extracted sentence.
function bestMatch(normExtract, fullSentsNorm, usedSet) {
  if (!normExtract) return -1;
  const avail = (i) => !usedSet || !usedSet.has(i);

  // Strategy A: prefix 30
  {
    const key = normExtract.slice(0, 30);
    let best = -1, bestScore = 0;
    for (let i = 0; i < fullSentsNorm.length; i++) {
      if (!avail(i)) continue;
      const f = fullSentsNorm[i];
      if (!f) continue;
      if (f.startsWith(key) || normExtract.startsWith(f.slice(0, 30))) {
        let n = 0;
        while (n < f.length && n < normExtract.length && f[n] === normExtract[n]) n++;
        if (n > bestScore) { bestScore = n; best = i; }
      }
    }
    if (best >= 0) return best;
  }

  // Strategy B: suffix 30
  {
    const tail = normExtract.slice(-30);
    if (tail.length >= 15) {
      for (let i = 0; i < fullSentsNorm.length; i++) {
        if (!avail(i)) continue;
        const f = fullSentsNorm[i];
        if (f && f.endsWith(tail)) return i;
      }
    }
  }

  // Strategy C: longest unchanged substring ≥ 20 chars
  {
    let best = -1, bestLen = 19;
    for (let i = 0; i < fullSentsNorm.length; i++) {
      if (!avail(i)) continue;
      const f = fullSentsNorm[i];
      if (!f) continue;
      const L = 25;
      for (let s = 0; s + L <= normExtract.length; s += 5) {
        const win = normExtract.slice(s, s + L);
        if (f.includes(win)) {
          if (L > bestLen) { bestLen = L; best = i; }
          break;
        }
      }
    }
    if (best >= 0) return best;
  }

  // Strategy D: bag-of-words overlap ≥ 70%
  {
    const exToks = new Set(normExtract.split(/\s+/).filter(w => w.length >= 3));
    if (exToks.size >= 4) {
      let best = -1, bestRatio = 0.69;
      for (let i = 0; i < fullSentsNorm.length; i++) {
        if (!avail(i)) continue;
        const f = fullSentsNorm[i];
        if (!f) continue;
        const fToks = new Set(f.split(/\s+/).filter(w => w.length >= 3));
        if (fToks.size === 0) continue;
        let common = 0;
        for (const t of exToks) if (fToks.has(t)) common++;
        const ratio = common / Math.max(exToks.size, fToks.size);
        if (ratio > bestRatio) { bestRatio = ratio; best = i; }
      }
      if (best >= 0) return best;
    }
  }

  return -1;
}

function isSkipType(type) {
  if (!type) return false;
  const t = String(type).replace(/\s+/g, '');
  if (/어형변환/.test(t)) return true;
  if (/영영풀이/.test(t)) return true;
  return false;
}

// Extract ALL <u>...</u> occurrences from a passage
function extractAllUnderlines(passage) {
  if (!passage) return [];
  const out = [];
  const re = /<u>([\s\S]*?)<\/u>/gi;
  let m;
  while ((m = re.exec(passage)) !== null) {
    const inner = m[1];
    const plain = inner
      .replace(/<\/?[a-z]+>/gi, '')
      .replace(/[①②③④⑤]/g, '')
      .trim();
    if (plain) out.push({ raw: inner, plain });
  }
  return out;
}

// Re-wrap each underline in newPassage in order (walking forward).
// Returns { passage, ok } — ok=false if any needle not found.
function reapplyUnderlines(newPassage, uList) {
  if (!uList || uList.length === 0) return { passage: newPassage, ok: true };
  if (/<u>/i.test(newPassage)) return { passage: newPassage, ok: true };
  let out = '';
  let rest = newPassage;
  for (const u of uList) {
    const idx = rest.indexOf(u.plain);
    if (idx < 0) return { passage: newPassage, ok: false, missing: u.plain.slice(0, 30) };
    out += rest.slice(0, idx) + '<u>' + u.plain + '</u>';
    rest = rest.slice(idx + u.plain.length);
  }
  out += rest;
  return { passage: out, ok: true };
}

// Self-contained short passage: no conversion needed
function isSelfContainedShort(fullPassage) {
  if (!fullPassage) return false;
  return fullPassage.length < 500 || splitSentences(fullPassage).length <= 6;
}

// Core: convert one question's passage
function convertPassage(origPassage, fullPassage, qType) {
  if (isSkipType(qType)) {
    return { ok: true, kind: 'skip-type', newPassage: origPassage, skipped: true };
  }

  // Self-contained short: fullPassage is already short enough; variation meaningless
  if (isSelfContainedShort(fullPassage)) {
    const origKind = classify(origPassage);
    // If original has markers (blank/grammar/insert), splice still needed even on short text.
    // If plain/empty, just use fullPassage.
    if (origKind === 'empty' || origKind === 'plain') {
      return { ok: true, kind: 'self-contained-short', newPassage: fullPassage, skipped: true };
    }
  }

  if (classify(origPassage) === 'sentence-grammar') {
    return { ok: true, kind: 'skip-sentence-grammar', newPassage: origPassage, skipped: true };
  }

  if (origPassage && fullPassage && origPassage.length >= fullPassage.length * 0.9) {
    const origKind = classify(origPassage);
    if (origKind !== 'empty') {
      return { ok: true, kind: 'already-full', newPassage: origPassage, skipped: true };
    }
  }

  // Preserve ALL underlines from original (함축/지칭/동의어 with 2+ underlines)
  const uList = extractAllUnderlines(origPassage);

  const kind = classify(origPassage);
  if (kind === 'empty' || kind === 'plain') {
    let np = fullPassage;
    if (uList.length > 0) {
      const r = reapplyUnderlines(np, uList);
      np = r.passage;
      if (!r.ok) {
        return { ok: false, kind, reason: `밑줄 재적용 실패 (${r.missing || '?'}...)` };
      }
    }
    return { ok: true, kind, newPassage: np };
  }

  const extractSents = splitSentences(origPassage);
  const fullSents = splitSentences(fullPassage);
  const fullNorm = fullSents.map(normalize);

  const result = fullSents.slice();
  const used = new Set();
  let failed = 0;
  let replaced = 0;

  const extractToFull = new Array(extractSents.length).fill(-1);
  for (let i = 0; i < extractSents.length; i++) {
    const ex = extractSents[i];
    const hasMark = hasMarkers(ex) || (kind === 'paren' && hasParenBlank(ex));
    if (hasMark) continue;
    const idx = bestMatch(normalize(ex), fullNorm, used);
    if (idx >= 0) {
      extractToFull[i] = idx;
      used.add(idx);
    }
  }

  // Second pass: splice marker-bearing sentences (monotonic, supports up to 5 markers)
  const markerFails = [];
  let lastPlaced = -1;
  for (let i = 0; i < extractSents.length; i++) {
    const ex = extractSents[i];
    const hasMark = hasMarkers(ex) || (kind === 'paren' && hasParenBlank(ex));
    if (!hasMark) continue;
    const nEx = normalize(ex);
    let idx = nEx.length >= 3 ? bestMatch(nEx, fullNorm, used) : -1;
    if (idx >= 0 && idx <= lastPlaced) {
      idx = -1;
    }
    if (idx < 0) {
      let prevAnchor = -1, nextAnchor = -1;
      for (let j = i - 1; j >= 0; j--) if (extractToFull[j] >= 0) { prevAnchor = extractToFull[j]; break; }
      for (let j = i + 1; j < extractSents.length; j++) if (extractToFull[j] >= 0) { nextAnchor = extractToFull[j]; break; }
      let cand = prevAnchor >= 0 ? prevAnchor + 1 : (nextAnchor >= 0 ? nextAnchor - 1 : -1);
      if (cand <= lastPlaced) cand = lastPlaced + 1;
      if (cand >= 0 && cand < fullSents.length && !used.has(cand)) {
        idx = cand;
      }
    }
    if (idx < 0 || used.has(idx) || idx <= lastPlaced) {
      failed++;
      markerFails.push(i);
      continue;
    }
    used.add(idx);
    lastPlaced = idx;
    extractToFull[i] = idx;
    result[idx] = ex.trim();
    replaced++;
  }

  const shortExcerpt = extractSents.length <= 2 && origPassage.length < fullPassage.length * 0.35;
  if (replaced === 0 && shortExcerpt) {
    return { ok: true, kind, newPassage: fullPassage, fallback: 'short-excerpt' };
  }

  if (replaced === 0 || failed > 0) {
    return { ok: false, kind, reason: `매칭 실패 (replaced=${replaced}, failed=${failed})` };
  }
  return { ok: true, kind, newPassage: result.join(' ') };
}

// ---------- post-conversion scans ----------

// Answer leak scan: for blank-type questions, check if answer appears within 5 words of ____
// For (A)(B)(C)(D), check if correct option appears adjacent to marker (unmarked).
function scanAnswerLeak(newPassage, q) {
  if (!newPassage) return null;
  const kind = classify(newPassage);

  // Blank: check ____ neighborhood
  if (kind === 'blank' && q.wa) {
    const answer = String(q.wa).trim().toLowerCase();
    if (!answer) return null;
    const ansWord = answer.split(/\s+/)[0].replace(/[^\w-]/g, '');
    if (!ansWord || ansWord.length < 3) return null;
    // Find blank position
    const blankIdx = newPassage.search(/_{2,}/);
    if (blankIdx < 0) return null;
    // Get 5 words before and after
    const before = newPassage.slice(Math.max(0, blankIdx - 200), blankIdx);
    const after = newPassage.slice(blankIdx).replace(/_{2,}/, '');
    const beforeWords = before.split(/\s+/).slice(-5).join(' ').toLowerCase();
    const afterWords = after.split(/\s+/).slice(0, 5).join(' ').toLowerCase();
    const re = new RegExp(`\\b${ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(beforeWords) || re.test(afterWords)) {
      return `blank 답(${ansWord}) 가 빈칸 5단어 이내 노출`;
    }
  }

  return null;
}

// Marker distribution (cluster) check
function scanMarkerCluster(newPassage, fullPassage) {
  if (!newPassage || !fullPassage) return null;
  const positions = [];
  const re = /[①②③④⑤]|\(\s*[①②③④⑤]\s*\)|<u>/g;
  let m;
  while ((m = re.exec(newPassage)) !== null) positions.push(m.index);
  if (positions.length < 3) return null;
  const span = Math.max(...positions) - Math.min(...positions);
  const threshold = fullPassage.length * 0.5;
  if (span < threshold) {
    return `마커 ${positions.length}개 span=${span}자, fullPassage=${fullPassage.length}자 (50% 미만)`;
  }
  return null;
}

// ---------- safety: git backup tag ----------
function createBackupTag(folder) {
  const slug = folder.replace(/[/\\]/g, '_').replace(/[^\w가-힣_-]/g, '').slice(0, 80);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tag = `pre-fullpass-${slug}-${ts}`;
  try {
    require('child_process').execSync(`git tag ${tag}`, { stdio: 'pipe' });
    console.log(`✅ 백업 태그: ${tag}`);
    return tag;
  } catch (e) {
    console.log(`⚠️ git tag 실패 (skip): ${(e.message || '').split('\n')[0]}`);
    return null;
  }
}

// ---------- main ----------
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node passage-to-full.js <folder> [--dry-run|--apply]');
    process.exit(1);
  }
  const folder = path.resolve(args[0]);
  const apply = args.includes('--apply');
  const dry = !apply;

  const files = walkJson(folder);

  let totalQ = 0, autoOk = 0, manualQ = 0;
  let skipType = 0, skipShort = 0, skipSentGrammar = 0, alreadyFull = 0;
  const manualLines = [];
  const leakLines = [];
  const clusterLines = [];

  // Safety: create backup tag ONLY when applying
  let backupTag = null;
  if (apply) {
    backupTag = createBackupTag(path.relative(process.cwd(), folder));
  }

  console.log(`\n[변환 결과] (${dry ? 'DRY-RUN' : 'APPLY'})`);
  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { console.log(`  ⚠️ JSON parse error: ${rel}`); continue; }
    const full = data.fullPassage;
    if (!full) { console.log(`  ⚠️ no fullPassage: ${rel}`); continue; }
    const qs = data.questions || [];
    console.log(`파일: ${rel}`);
    let fileChanged = false;
    for (const q of qs) {
      totalQ++;
      if (!q.passage) continue;
      const origLen = q.passage.length;
      const r = convertPassage(q.passage, full, q.type);
      const tag = `Q${q.id} ${q.type || ''}`;
      if (r.ok) {
        autoOk++;
        if (r.kind === 'skip-type') skipType++;
        else if (r.kind === 'self-contained-short') skipShort++;
        else if (r.kind === 'skip-sentence-grammar') skipSentGrammar++;
        else if (r.kind === 'already-full') alreadyFull++;

        const note = r.skipped ? `skipped (${r.kind})` : (r.kind === 'plain' ? 'plain copy' : `splice OK (${r.kind})`);
        console.log(`  ${tag}: ${origLen}자 → ${r.newPassage.length}자 ✅ ${note}`);
        if (apply && r.newPassage !== q.passage) {
          q.passage = r.newPassage;
          fileChanged = true;
        }

        // Post-conversion scans (on final passage)
        if (!r.skipped) {
          const leak = scanAnswerLeak(r.newPassage, q);
          if (leak) leakLines.push(`${rel}\tQ${q.id}\t${q.type || ''}\t${leak}`);
          const cluster = scanMarkerCluster(r.newPassage, full);
          if (cluster) clusterLines.push(`${rel}\tQ${q.id}\t${q.type || ''}\t${cluster}`);
        }
      } else {
        manualQ++;
        console.log(`  ${tag}: ${origLen}자 ⚠️ ${r.reason} → 수동`);
        manualLines.push(`${rel}\tQ${q.id}\t${q.type || ''}\t${r.reason}`);
      }
    }
    if (apply && fileChanged) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
  }

  // ---------- Summary ----------
  const summary = [];
  summary.push(`Folder: ${path.relative(process.cwd(), folder)}`);
  summary.push(`Mode: ${dry ? 'DRY-RUN' : 'APPLY'}`);
  if (backupTag) summary.push(`Backup tag: ${backupTag}`);
  summary.push(`Total questions: ${totalQ}`);
  summary.push(`Auto-converted: ${autoOk}`);
  summary.push(`  - Skipped (type): ${skipType}`);
  summary.push(`  - Skipped (short passage): ${skipShort}`);
  summary.push(`  - Skipped (sentence-level grammar): ${skipSentGrammar}`);
  summary.push(`  - Already full: ${alreadyFull}`);
  summary.push(`Manual queue: ${manualQ}`);
  summary.push(`Leak suspicions: ${leakLines.length}`);
  summary.push(`Marker clusters: ${clusterLines.length}`);

  console.log(`\n[요약]`);
  for (const l of summary) console.log(l);

  if (manualLines.length > 0) {
    fs.writeFileSync(MANUAL_QUEUE_PATH, manualLines.join('\n') + '\n', 'utf8');
    console.log(`수동 큐 파일: ${path.relative(process.cwd(), MANUAL_QUEUE_PATH)}`);
  }
  if (leakLines.length > 0) {
    fs.writeFileSync(LEAK_SUSPICION_PATH, leakLines.join('\n') + '\n', 'utf8');
    console.log(`정답노출 의심: ${path.relative(process.cwd(), LEAK_SUSPICION_PATH)}`);
  }
  if (clusterLines.length > 0) {
    fs.writeFileSync(MARKER_CLUSTER_PATH, clusterLines.join('\n') + '\n', 'utf8');
    console.log(`마커 클러스터링: ${path.relative(process.cwd(), MARKER_CLUSTER_PATH)}`);
  }

  // Folder-specific report
  const folderSlug = path.relative(process.cwd(), folder).replace(/[/\\]/g, '_').replace(/[^\w가-힣_-]/g, '').slice(0, 80);
  const reportPath = path.join(__dirname, `passage-conversion-report-${folderSlug}.txt`);
  const reportBody = [
    ...summary,
    '',
    '[매뉴얼 큐]',
    ...manualLines.slice(0, 200),
    '',
    '[정답노출 의심]',
    ...leakLines.slice(0, 200),
    '',
    '[마커 클러스터링]',
    ...clusterLines.slice(0, 200),
  ].join('\n');
  fs.writeFileSync(reportPath, reportBody + '\n', 'utf8');
  console.log(`폴더 리포트: ${path.relative(process.cwd(), reportPath)}`);

  console.log(`\n⚠️  이 스크립트는 git commit/push를 하지 않습니다. 결과 검토 후 수동으로 커밋하세요.`);
}

main();
