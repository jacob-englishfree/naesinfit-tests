#!/usr/bin/env node
/**
 * 고1/3월_2026 최종 자동수정
 * - 각 수정은 멱등성 보장 (두 번 적용해도 안전)
 * - _passages/ 폴더 제외
 */
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..', 'data', '모의고사', '고1', '3월_2026');

function getAllFiles() {
  const results = [];
  const dirs = fs.readdirSync(BASE).filter(d => {
    const p = path.join(BASE, d);
    return fs.statSync(p).isDirectory() && !d.startsWith('_');
  });
  for (const dir of dirs) {
    const dirPath = path.join(BASE, dir);
    for (const j of fs.readdirSync(dirPath).filter(f => f.endsWith('.json'))) {
      results.push(path.join(dirPath, j));
    }
  }
  return results;
}

let stats = { tf: 0, noPassage: 0, waInPassage: 0, notFull: 0, p23: 0, markerLeak: 0 };

function fixFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const fp = data.fullPassage;
  if (!fp) return false;

  let changed = false;

  for (const q of data.questions || []) {
    const type = q.type || '';
    const fmt = q.fmt || '';
    const ch = q.ch || [];

    // 1. S-TF-ORDER: F→T를 T→F로
    if (type === 'T/F' || type.includes('T/F')) {
      if (ch.length === 2) {
        const c0lower = (ch[0] || '').toLowerCase().trim();
        if (c0lower.startsWith('f')) {
          q.ch = [ch[1], ch[0]];
          q.ans = q.ans === 1 ? 2 : 1;
          changed = true;
          stats.tf++;
        }
      }
    }

    // 2. S-NO-PASSAGE: 서술형(written) passage 없으면 추가
    if (fmt === 'written' && (!q.passage || q.passage.trim() === '')) {
      let newP = fp;
      // 마커 정리
      newP = newP.replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1').replace(/[①②③④⑤]/g, '');

      const wa = q.wa || '';
      const isFindType = (q.stem || '').includes('찾아') || (q.stem || '').includes('찾으시오');

      if (!isFindType && wa) {
        // wa를 ______로 마스킹
        const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(newP)) {
          newP = newP.replace(regex, '______');
        }
      }

      // 어형변환 원형 표시
      if (type.includes('어형')) {
        const stemMatch = (q.stem || '').match(/\((\w+)\)/);
        if (stemMatch) {
          // wa가 이미 마스킹되어 ______ 있으면 [원형] 추가
          if (newP.includes('______')) {
            newP = newP.replace('______', `__________ [${stemMatch[1]}]`);
          }
        }
      }

      q.passage = newP;
      changed = true;
      stats.noPassage++;
    }

    // 3. S-WA-IN-PASSAGE: 서술형 wa가 passage에 그대로 노출
    if (fmt === 'written' && q.passage && q.wa) {
      const isFindType = (q.stem || '').includes('찾아') || (q.stem || '').includes('찾으시오');
      if (!isFindType) {
        const wa = q.wa;
        const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // passage에 wa가 있고 ______가 없는 경우만
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(q.passage) && !q.passage.includes('______')) {
          q.passage = q.passage.replace(regex, '______');
          changed = true;
          stats.waInPassage++;
        }
      }
    }

    // 4. S-MARKER-LEAK: 서술형 passage에서 마커 제거
    if (fmt === 'written' && q.passage && /[①②③④⑤]/.test(q.passage)) {
      q.passage = q.passage
        .replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1')
        .replace(/[①②③④⑤]/g, '');
      changed = true;
      stats.markerLeak++;
    }

    // 5. S-PASSAGE-NOT-FULL: mc passage가 85% 미만
    if (fmt === 'mc' && q.passage) {
      const ratio = q.passage.length / fp.length;
      if (ratio < 0.85) {
        // 빈칸추론/빈칸어휘: fullPassage에서 정답을 ______로
        if ((type.includes('빈칸') || type.includes('추론')) && q.ans >= 1 && q.ans <= ch.length) {
          const ansWord = ch[q.ans - 1];
          if (ansWord && !q.passage.includes('______')) {
            // 기존 passage에 ______ 없으면 이미 다른 유형일 수 있으므로 skip
          }
          if (ansWord && q.passage.includes('______')) {
            const escaped = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            if (regex.test(fp)) {
              q.passage = fp.replace(regex, '______');
              changed = true;
              stats.notFull++;
            }
          }
        }
        // 어형변환 (written): 이미 2번에서 처리됨
        // 내용/주제/요지: fullPassage 그대로
        if (type.includes('내용') || type.includes('주제') || type.includes('요지') || type.includes('제목')) {
          q.passage = fp;
          changed = true;
          stats.notFull++;
        }
      }
    }

    // 6. P23: 부적절 마커 4개 보장 (이전 v3과 동일 로직이지만 멱등)
    if ((type.includes('부적절') || type.includes('오류')) && fmt === 'mc' && q.passage) {
      const markerCount = (q.passage.match(/[①②③④⑤]\s*<u>/g) || []).length;
      if (markerCount < 4 && markerCount >= 2) {
        const ans = q.ans;
        for (let i = 0; i < Math.min(ch.length, 4); i++) {
          const word = ch[i];
          const marker = ['①','②','③','④'][i];
          if (q.passage.includes(`${marker}<u>`)) continue;

          if (i === ans - 1) {
            // 오답어: det에서 원문 찾기
            const all = (q.det?.tip || '') + ' ' + (q.det?.analysis || '') + ' ' + (q.det?.korean || '');
            let origWord = null;
            const p1 = all.match(/원문\s+(\w+)/); if (p1) origWord = p1[1];
            if (!origWord) { const p2 = (q.det?.tip || '').match(/↔\s*(\w+)/); if (p2) origWord = p2[1]; }
            if (origWord) {
              const esc = origWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const rx = new RegExp(`(?<![①②③④⑤]<u>)\\b${esc}\\b(?!<\\/u>)`, 'i');
              if (rx.test(q.passage)) {
                q.passage = q.passage.replace(rx, `${marker}<u>${word}</u>`);
                changed = true;
                stats.p23++;
              }
            }
          } else {
            const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(`(?<![①②③④⑤]\\s*<u>)\\b${esc}\\b(?!<\\/u>)`, 'i');
            if (rx.test(q.passage)) {
              q.passage = q.passage.replace(rx, `${marker}<u>${word}</u>`);
              changed = true;
              stats.p23++;
            }
          }
        }
      }
    }
  }

  if (changed) {
    const out = JSON.stringify(data, null, 2) + '\n';
    if (out !== raw) {
      fs.writeFileSync(filePath, out, 'utf8');
      return true;
    }
  }
  return false;
}

const files = getAllFiles();
console.log(`\n=== 최종 수정 ===\n대상: ${files.length}파일\n`);

let fixedCount = 0;
for (const f of files) {
  if (fixFile(f)) {
    fixedCount++;
    console.log(`  OK: ${path.relative(BASE, f)}`);
  }
}

console.log(`\n${fixedCount}파일 수정.`);
console.log(`  T/F순서: ${stats.tf}, NO-PASSAGE: ${stats.noPassage}, WA노출: ${stats.waInPassage}`);
console.log(`  NOT-FULL: ${stats.notFull}, P23마커: ${stats.p23}, 마커누출: ${stats.markerLeak}`);
