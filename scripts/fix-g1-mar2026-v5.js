#!/usr/bin/env node
/**
 * 고1/3월_2026 자동수정 v5 — 잔여 에러 일괄 처리
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

function fixFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fp = data.fullPassage;
  if (!fp) return 0;
  let fixes = 0;

  for (const q of data.questions || []) {
    const type = q.type || '';
    const fmt = q.fmt || '';
    const ch = q.ch || [];

    // === S-TF-ORDER: 다양한 T/F 형식 처리 ===
    if (type === 'T/F' || type.includes('T/F')) {
      if (ch.length === 2) {
        const c0 = ch[0].toLowerCase();
        const c1 = ch[1].toLowerCase();
        if (c0.startsWith('f') && c1.startsWith('t')) {
          // F→T 순서를 T→F로 교체
          q.ch = [ch[1], ch[0]];
          q.ans = q.ans === 1 ? 2 : 1;
          fixes++;
        }
      }
    }

    // === S-WA-IN-PASSAGE: written wa가 passage에 노출 ===
    if (fmt === 'written' && q.passage && q.wa) {
      const isFindType = (q.stem || '').includes('찾아') || (q.stem || '').includes('찾으시오');
      if (!isFindType) {
        const wa = q.wa;
        // 단어 단위 매칭 (대소문자 무시)
        const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<!_)\\b${escaped}\\b`, 'i');
        if (regex.test(q.passage)) {
          q.passage = q.passage.replace(regex, '______');
          fixes++;
        }
      }
    }

    // === S-MARKER-LEAK: 서술형 passage에서 마커 제거 ===
    if (fmt === 'written' && q.passage && /[①②③④⑤]/.test(q.passage)) {
      q.passage = q.passage
        .replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1')
        .replace(/[①②③④⑤]/g, '');
      fixes++;
    }

    // === S-PASSAGE-NOT-FULL: mc 서술형에서도 fullPassage 사용 ===
    if (fmt === 'written' && q.passage) {
      const ratio = q.passage.length / fp.length;
      if (ratio < 0.85) {
        // 어형변환: stem에서 원형 추출
        if (type.includes('어형')) {
          const wa = q.wa || '';
          const stemMatch = (q.stem || '').match(/\((\w+)\)/);
          const baseWord = stemMatch ? stemMatch[1] : '';
          const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escaped}\\b`, 'i');
          let newP = fp;
          // 마커 제거
          newP = newP.replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1').replace(/[①②③④⑤]/g, '');
          if (regex.test(newP)) {
            const replacement = baseWord ? `__________ [${baseWord}]` : '______';
            newP = newP.replace(regex, replacement);
          }
          q.passage = newP;
          fixes++;
        } else if (type.includes('영작') || type.includes('조건')) {
          const wa = q.wa || '';
          let newP = fp;
          // 마커 제거
          newP = newP.replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1').replace(/[①②③④⑤]/g, '');
          if (wa) {
            const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            if (regex.test(newP)) {
              newP = newP.replace(regex, '______');
            }
          }
          q.passage = newP;
          fixes++;
        }
      }
    }

    // === S-PASSAGE-NOT-FULL: mc passage가 fullPassage 85% 미만 ===
    if (fmt === 'mc' && q.passage) {
      const ratio = q.passage.length / fp.length;
      if (ratio < 0.85) {
        // 빈칸추론: fullPassage에서 정답어를 ______로
        if (type.includes('빈칸') || type.includes('추론')) {
          const ansWord = ch[q.ans - 1];
          if (ansWord) {
            const escaped = ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            let newP = fp;
            if (regex.test(newP)) {
              newP = newP.replace(regex, '______');
              q.passage = newP;
              fixes++;
            }
          }
        }
        // 문장삽입: fullPassage에 (①)~(⑤) 위치 마커 필요 — skip
        // 순서배열: 기존 passage 유지 — skip
        // 어법(문장단위): passage 유지 — skip
      }
    }

    // === RENDER-MARKER-MISSING: 어법(마커형) 워크북 ===
    // 이건 content 이슈 — 각 문항의 4마커가 서로 다른 위치를 가리켜야 함
    // 자동수정 불가, 개별 재출제 필요

    // === P23: 부적절 마커 수 보완 (v3에서 못잡은 것들) ===
    if ((type.includes('부적절') || type.includes('오류')) && fmt === 'mc' && q.passage) {
      const markerCount = (q.passage.match(/[①②③④⑤]\s*<u>/g) || []).length;
      if (markerCount < 4) {
        // ch 단어들이 모두 passage에 마커+밑줄로 있는지 확인
        for (let i = 0; i < Math.min(ch.length, 4); i++) {
          const word = ch[i];
          const marker = ['①','②','③','④'][i];
          // 이미 마커+밑줄 있는지
          if (q.passage.includes(`${marker}<u>${word}</u>`)) continue;
          if (q.passage.includes(`${marker}<u>`)) continue; // 마커는 있지만 다른 단어

          // ans(오답어)인 경우: det에서 원문 단어 찾아 교체
          if (i === q.ans - 1) {
            const tip = q.det?.tip || '';
            const analysis = q.det?.analysis || '';
            const korean = q.det?.korean || '';
            const all = tip + ' ' + analysis + ' ' + korean;
            let origWord = null;
            const p1 = all.match(/원문\s+(\w+)/); if (p1) origWord = p1[1];
            if (!origWord) { const p2 = tip.match(/↔\s*(\w+)/); if (p2) origWord = p2[1]; }
            if (!origWord) { const p3 = all.match(/(\w+)\s*→/); if (p3 && p3[1] !== word) origWord = p3[1]; }

            if (origWord) {
              const esc = origWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const rx = new RegExp(`(?<![<])\\b${esc}\\b(?![<])`, 'i');
              if (rx.test(q.passage)) {
                q.passage = q.passage.replace(rx, `${marker}<u>${word}</u>`);
                fixes++;
              }
            }
          } else {
            // 정상 단어: passage에 삽입
            const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(`(?<![①②③④⑤]\\s*<u>)\\b${esc}\\b(?!<\\/u>)`, 'i');
            if (rx.test(q.passage)) {
              q.passage = q.passage.replace(rx, `${marker}<u>${word}</u>`);
              fixes++;
            }
          }
        }
      }
    }
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`  FIXED ${fixes}건: ${path.relative(BASE, filePath)}`);
  }
  return fixes;
}

const files = getAllFiles();
console.log(`\n=== v5 수정 ===\n`);
let total = 0;
for (const f of files) total += fixFile(f);
console.log(`\n총 ${total}건.`);
