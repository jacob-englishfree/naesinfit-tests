#!/usr/bin/env node
/**
 * DUPLICATE_CHOICE 수정 + WA_NOT_IN_ACCEPT + WRITTEN_WRONG_LANG 수정
 * API 미사용
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function loadJson(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function saveJson(fp, data) { fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8'); }

const files = execSync(`find "${ROOT}/data/모의고사" -name "*.json" -type f`)
  .toString().trim().split('\n').filter(Boolean).sort();

let stats = { dupFixed: 0, waFixed: 0, langFixed: 0, filesModified: 0 };

for (const fp of files) {
  let data;
  try { data = loadJson(fp); } catch { continue; }
  if (!data.questions || !Array.isArray(data.questions)) continue;

  let modified = false;

  for (const q of data.questions) {
    // ── Fix DUPLICATE_CHOICE ──
    if (q.fmt === 'mc' && Array.isArray(q.ch) && q.ch.length >= 4) {
      const norm = q.ch.map(c => c.trim().toLowerCase());
      const seen = {};
      const dupeIndices = [];

      for (let i = 0; i < norm.length; i++) {
        if (seen[norm[i]] !== undefined) {
          dupeIndices.push({ first: seen[norm[i]], second: i, word: norm[i] });
        } else {
          seen[norm[i]] = i;
        }
      }

      if (dupeIndices.length > 0) {
        const typeNorm = (q.type || '').trim();
        const passage = q.passage || '';

        if (typeNorm.includes('어법') || typeNorm.includes('밑줄')) {
          // 어법: passage에서 위치 마커(①②③④) 찾아서 선지에 추가
          const markers = ['①', '②', '③', '④'];
          for (const dupe of dupeIndices) {
            // Add position marker to disambiguate
            const firstMarker = markers[dupe.first] || `(${dupe.first + 1}번)`;
            const secondMarker = markers[dupe.second] || `(${dupe.second + 1}번)`;

            // Check if passage has context around the word
            const word = q.ch[dupe.second].trim();

            // Find the word occurrences in passage
            const passageClean = passage.replace(/<[^>]+>/g, ' ');
            const regex = new RegExp(`(\\S+\\s+)?${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+\\S+)?`, 'gi');
            const matches = [];
            let m;
            while ((m = regex.exec(passageClean)) !== null) {
              matches.push(m[0].trim());
            }

            if (matches.length >= 2) {
              // Use surrounding context to distinguish
              // e.g., "them" → "holds them" vs "reached them"
              const ctx1 = matches[0];
              const ctx2 = matches[1];
              if (ctx1 !== ctx2) {
                // Only add context if it helps disambiguate
                const w1 = ctx1.replace(new RegExp(word, 'i'), '').trim();
                const w2 = ctx2.replace(new RegExp(word, 'i'), '').trim();
                if (w1 && w2 && w1 !== w2) {
                  q.ch[dupe.first] = `${word} (... ${w1} ${word} ...)`;
                  q.ch[dupe.second] = `${word} (... ${w2} ${word} ...)`;
                  stats.dupFixed++;
                  modified = true;
                  continue;
                }
              }
            }

            // Fallback: add numbered position markers
            q.ch[dupe.first] = `${word} ${firstMarker}`;
            q.ch[dupe.second] = `${word} ${secondMarker}`;
            stats.dupFixed++;
            modified = true;
          }
        } else {
          // 비어법: 오답 중복은 fullPassage에서 대체어 찾기
          for (const dupe of dupeIndices) {
            const dupeIdx = dupe.second;
            // Don't change if it's the answer
            if (dupeIdx === q.ans - 1) continue;

            // Try to find a replacement word from passage
            const fp_text = (data.fullPassage || q.passage || '').replace(/<[^>]+>/g, ' ');
            const words = fp_text.match(/[a-zA-Z]{4,}/g) || [];
            const usedWords = new Set(q.ch.map(c => c.trim().toLowerCase()));
            const candidates = [...new Set(words)]
              .filter(w => !usedWords.has(w.toLowerCase()) && w.length >= 4)
              .slice(0, 10);

            if (candidates.length > 0) {
              // Pick a random-ish candidate
              const replacement = candidates[dupeIdx % candidates.length];
              q.ch[dupeIdx] = replacement;
              stats.dupFixed++;
              modified = true;
            }
          }
        }
      }
    }

    // ── Fix WA_NOT_IN_ACCEPT ──
    if (q.fmt === 'written' && q.wa && Array.isArray(q.accept)) {
      const wa = q.wa.trim();
      if (!q.accept.some(a => a.trim() === wa)) {
        q.accept.unshift(wa);
        stats.waFixed++;
        modified = true;
      }
    }

    // ── Fix WRITTEN_WRONG_LANG (한글 wa in 영작) ──
    if (q.fmt === 'written' && q.wa) {
      const typeNorm = (q.type || '').trim();
      if ((typeNorm.includes('영작') || typeNorm.includes('한영')) && /[가-힣]/.test(q.wa)) {
        // Check det for English answer
        if (q.det && q.det.analysis) {
          const engMatch = q.det.analysis.match(/[a-zA-Z]{3,}[^가-힣]{5,}/);
          if (engMatch) {
            // Don't auto-fix — flag for manual review
            console.log(`⚠️  영작 한글 wa: ${path.relative(ROOT, fp)} Q${q.id} wa="${q.wa}"`);
          }
        }
        stats.langFixed++;
      }
    }
  }

  if (modified) {
    saveJson(fp, data);
    stats.filesModified++;
  }
}

console.log('\n=== 수정 결과 ===');
console.log(`DUPLICATE_CHOICE: ${stats.dupFixed}건 수정`);
console.log(`WA_NOT_IN_ACCEPT: ${stats.waFixed}건 수정`);
console.log(`WRITTEN_WRONG_LANG: ${stats.langFixed}건 (수동 확인 필요)`);
console.log(`수정된 파일: ${stats.filesModified}개`);
