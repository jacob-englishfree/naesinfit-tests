#!/usr/bin/env node
/**
 * Safe mechanical fixes for validation gaps.
 * Categories 4 (pts), 5 (accept), 6 (html) only.
 * Categories 1 (다의어 placeholder), 2 (한글 지문/본문), 3 (marker missing)
 *   require content re-authoring and are REPORTED, not auto-fixed.
 */
const fs = require('fs');
const path = require('path');

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const files = walk('data');
const stats = {
  cat1_dueui_placeholder: [],
  cat2_korean_passage: [],
  cat3_marker_missing: [],
  cat4_pts_fixed: 0,
  cat5_accept_fixed: 0,
  cat6_html_fixed: 0,
};

const PTS_BY_DIFF = { '쉬움': 4, '보통': 5, '어려움': 6 };

function expandAccept(wa) {
  if (typeof wa !== 'string') return null;
  const base = wa.trim();
  if (!base) return null;
  const set = new Set();
  set.add(base);
  // without trailing period
  const noDot = base.replace(/[.．。]\s*$/, '');
  set.add(noDot);
  // with trailing period
  set.add(noDot + '.');
  // lower / capitalize first
  set.add(noDot.toLowerCase());
  set.add(noDot.charAt(0).toUpperCase() + noDot.slice(1));
  // collapse whitespace variant
  set.add(noDot.replace(/\s+/g, ' '));
  return [...set].filter(Boolean);
}

function balanceHtml(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const tag of ['b', 'u', 'i']) {
    const open = (out.match(new RegExp(`<${tag}>`, 'g')) || []).length;
    const close = (out.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open > close) out = out + `</${tag}>`.repeat(open - close);
    else if (close > open) {
      // remove orphan closers from the end
      let need = close - open;
      out = out.replace(new RegExp(`</${tag}>`, 'g'), (m) => (need-- > 0 ? '' : m));
    }
  }
  return out;
}

for (const f of files) {
  let raw, j;
  try { raw = fs.readFileSync(f, 'utf8'); j = JSON.parse(raw); }
  catch { continue; }
  const qs = j.questions || j.qs;
  if (!Array.isArray(qs)) continue;
  let dirty = false;

  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (!q || typeof q !== 'object') continue;

    // Cat 1: 다의어 placeholder (REPORT ONLY)
    if (typeof q.passage === 'string' && /\(원문 맥락\)|\(다른 맥락\)/.test(q.passage)) {
      stats.cat1_dueui_placeholder.push(`${f}#${i}`);
    }

    // Cat 2: Korean 지문/본문 in passage (REPORT ONLY)
    if (typeof q.passage === 'string' && /(지문|본문)/.test(q.passage)) {
      stats.cat2_korean_passage.push(`${f}#${i}`);
    }

    // Cat 3: marker missing (REPORT ONLY — requires knowing original words)
    if (q.det && typeof q.det.analysis === 'string' && /(어법|부적절)/.test(q.type || '')) {
      const have = ['①','②','③','④'].filter(m => q.det.analysis.includes(m));
      if (have.length < 4) stats.cat3_marker_missing.push(`${f}#${i} (have ${have.length})`);
    }

    // Cat 4: pts mismatch — SAFE FIX
    if (q.diff && PTS_BY_DIFF[q.diff] && q.pts !== PTS_BY_DIFF[q.diff]) {
      q.pts = PTS_BY_DIFF[q.diff];
      stats.cat4_pts_fixed++;
      dirty = true;
    }

    // Cat 5: 서술형 accept short — SAFE FIX (mechanical variants)
    if (q.type && /서술|written/.test(q.type) || q.fmt === 'written') {
      if (typeof q.wa === 'string' && (!Array.isArray(q.accept) || q.accept.length < 2)) {
        const variants = expandAccept(q.wa);
        if (variants && variants.length >= 2) {
          q.accept = variants;
          stats.cat5_accept_fixed++;
          dirty = true;
        }
      }
    }

    // Cat 6: HTML balance in ch[] — SAFE FIX
    if (Array.isArray(q.ch)) {
      for (let k = 0; k < q.ch.length; k++) {
        const c = q.ch[k];
        if (typeof c !== 'string') continue;
        let unbalanced = false;
        for (const tag of ['b','u','i']) {
          const o = (c.match(new RegExp(`<${tag}>`, 'g')) || []).length;
          const cl = (c.match(new RegExp(`</${tag}>`, 'g')) || []).length;
          if (o !== cl) { unbalanced = true; break; }
        }
        if (unbalanced) {
          q.ch[k] = balanceHtml(c);
          stats.cat6_html_fixed++;
          dirty = true;
        }
      }
    }
  }

  if (dirty) {
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
  }
}

console.log('=== SAFE FIXES APPLIED ===');
console.log('Cat 4 (pts mismatch) fixed:', stats.cat4_pts_fixed);
console.log('Cat 5 (accept expanded)  fixed:', stats.cat5_accept_fixed);
console.log('Cat 6 (html balance)    fixed:', stats.cat6_html_fixed);
console.log();
console.log('=== REPORT-ONLY (requires re-authoring, NOT auto-fixed) ===');
console.log('Cat 1 (다의어 placeholder):', stats.cat1_dueui_placeholder.length);
stats.cat1_dueui_placeholder.forEach(x => console.log('  ' + x));
console.log('Cat 2 (한글 지문/본문 in passage):', stats.cat2_korean_passage.length);
stats.cat2_korean_passage.slice(0, 30).forEach(x => console.log('  ' + x));
if (stats.cat2_korean_passage.length > 30) console.log(`  ... +${stats.cat2_korean_passage.length - 30} more`);
console.log('Cat 3 (det.analysis marker missing):', stats.cat3_marker_missing.length);
stats.cat3_marker_missing.slice(0, 30).forEach(x => console.log('  ' + x));
if (stats.cat3_marker_missing.length > 30) console.log(`  ... +${stats.cat3_marker_missing.length - 30} more`);
