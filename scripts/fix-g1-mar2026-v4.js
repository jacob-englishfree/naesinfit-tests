#!/usr/bin/env node
/**
 * 고1/3월_2026 자동수정 v4
 * - S-NO-PASSAGE: 서술형(written) passage 추가
 * - S-TF-ORDER: T/F 순서 수정
 * - S-WA-IN-PASSAGE: 서술형 wa를 passage에서 ____로 마스킹
 * - P23: 부적절 마커 4개 보장
 * - RENDER-MARKER-MISSING: 어법 passage에서 누락된 마커 복원
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
    const jsons = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    for (const j of jsons) results.push(path.join(dirPath, j));
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

    // === S-NO-PASSAGE: 서술형에 passage 추가 ===
    if (fmt === 'written' && (!q.passage || q.passage === '' || q.passage === null)) {
      const wa = q.wa || '';
      if (wa && type.includes('영작')) {
        // 영작: fullPassage에서 wa를 ______로 마스킹
        const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        if (regex.test(fp)) {
          q.passage = fp.replace(regex, '______');
        } else {
          // wa가 fullPassage에 없으면 그냥 fullPassage
          q.passage = fp;
        }
        fixes++;
      } else if (wa && (type.includes('찾') || type.includes('find'))) {
        // 찾기 유형: fullPassage 그대로 (정답 노출 의도)
        q.passage = fp;
        fixes++;
      } else if (wa && type.includes('어형')) {
        // 어형변환: fullPassage에서 wa를 ______ + [원형] 처리
        const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(fp)) {
          // stem에서 원형 추출 시도
          const stemMatch = (q.stem || '').match(/\((\w+)\)/);
          const baseWord = stemMatch ? stemMatch[1] : '';
          const replacement = baseWord ? `__________ [${baseWord}]` : '______';
          q.passage = fp.replace(regex, replacement);
        } else {
          q.passage = fp;
        }
        fixes++;
      } else {
        // 기타 서술형: fullPassage 사용
        q.passage = fp;
        fixes++;
      }
    }

    // === S-WA-IN-PASSAGE: 서술형 wa가 passage에 노출 ===
    if (fmt === 'written' && q.passage && q.wa) {
      // "찾기" 유형이 아닌 경우만
      const isFindType = (q.stem || '').includes('찾아') || (q.stem || '').includes('찾으시오');
      if (!isFindType) {
        const wa = q.wa;
        const escaped = wa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 정확한 단어 매칭으로 확인
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(q.passage) && !q.passage.includes('______')) {
          q.passage = q.passage.replace(regex, '______');
          fixes++;
        }
      }
    }

    // === S-TF-ORDER: T/F 순서 ===
    if (type === 'T/F' || type.includes('T/F')) {
      const ch = q.ch || [];
      if (ch.length === 2 && ch[0] === 'F' && ch[1] === 'T') {
        q.ch = ['T', 'F'];
        q.ans = q.ans === 1 ? 2 : 1;
        fixes++;
      }
    }

    // === P23: 부적절 마커 4개 보장 ===
    if ((type.includes('부적절') || type.includes('오류')) && fmt === 'mc' && q.passage) {
      const markerCount = (q.passage.match(/[①②③④⑤]\s*<u>/g) || []).length;
      if (markerCount < 4 && markerCount >= 2) {
        // ch에서 누락된 단어 찾기
        const ch = q.ch || [];
        const existingMarkers = [];
        const mp = /([①②③④⑤])\s*<u>([^<]+)<\/u>/g;
        let mm;
        while ((mm = mp.exec(q.passage)) !== null) {
          existingMarkers.push({ marker: mm[1], word: mm[2] });
        }
        const existingWords = existingMarkers.map(m => m.word.toLowerCase());
        const markerChars = ['①', '②', '③', '④'];

        for (let i = 0; i < Math.min(ch.length, 4); i++) {
          const word = ch[i];
          if (existingWords.includes(word.toLowerCase())) continue;

          const marker = markerChars[i];
          // 이 단어의 원문을 det에서 찾기
          const analysis = (q.det?.analysis || '') + ' ' + (q.det?.korean || '') + ' ' + (q.det?.tip || '');

          // 정답(오답어)인 경우: det에서 원문 찾기
          if (i === q.ans - 1) {
            // 오답어 → 원문 찾기
            let origWord = null;
            const p1 = analysis.match(/원문\s+(\w+)/);
            if (p1) origWord = p1[1];
            if (!origWord) {
              const p2 = (q.det?.tip || '').match(/↔\s*(\w+)/);
              if (p2) origWord = p2[1];
            }

            if (origWord) {
              const escaped = origWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`\\b${escaped}\\b`, 'i');
              if (regex.test(q.passage)) {
                q.passage = q.passage.replace(regex, `${marker}<u>${word}</u>`);
                fixes++;
              }
            }
          } else {
            // 정상 단어: fullPassage에서 찾아 마커 삽입
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?<![①②③④⑤]\\s*<u>)\\b${escaped}\\b(?!<\\/u>)`, 'i');
            if (regex.test(q.passage)) {
              q.passage = q.passage.replace(regex, `${marker}<u>${word}</u>`);
              fixes++;
            }
          }
        }
      }
    }

    // === RENDER-MARKER-MISSING: 어법 passage 마커 복원 ===
    if ((type.includes('어법') && !type.includes('부적절')) && fmt === 'mc' && q.passage) {
      // 어법은 ①②③④ + <u> 필요
      const markerCount = (q.passage.match(/[①②③④]\s*<u>/g) || []).length;
      if (markerCount < 3) {
        // 어법: ch가 마커 자체(①②③④)이거나 단어형
        // ch에서 마커 단어 추출 후 passage에 삽입
        const ch = q.ch || [];
        const markerChars = ['①', '②', '③', '④'];

        for (let i = 0; i < Math.min(ch.length, 4); i++) {
          const word = ch[i];
          if (word.match(/^[①②③④⑤]$/)) continue; // 마커 자체면 skip
          const marker = markerChars[i];
          if (q.passage.includes(`${marker}<u>`)) continue; // 이미 있음

          const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(?<![①②③④⑤]\\s*<u>)\\b${escaped}\\b(?!<\\/u>)`, 'i');
          if (regex.test(q.passage)) {
            q.passage = q.passage.replace(regex, `${marker}<u>${word}</u>`);
            fixes++;
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
console.log(`\n=== 고1/3월_2026 자동수정 v4 ===\n대상: ${files.length}파일\n`);

let total = 0;
for (const f of files) total += fixFile(f);
console.log(`\n총 ${total}건 수정.`);
