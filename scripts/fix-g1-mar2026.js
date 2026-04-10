#!/usr/bin/env node
/**
 * 고1/3월_2026 자동수정 스크립트
 *
 * 수정 대상:
 * 1. S-PASSAGE-NOT-FULL: passage를 fullPassage 기반으로 교체 + 유형별 오버레이
 * 2. S-MARKER-LEAK: 비마커 유형에서 ①②③④⑤ 제거
 * 3. S-TF-ORDER: T/F 순서 수정 (① T → ② F)
 * 4. V76: 영영풀이 passage → null
 */

const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..', 'data', '모의고사', '고1', '3월_2026');

function globSync(pattern) {
  const results = [];
  const dirs = fs.readdirSync(BASE).filter(d => fs.statSync(path.join(BASE, d)).isDirectory() && !d.startsWith('_'));
  for (const dir of dirs) {
    const dirPath = path.join(BASE, dir);
    const jsons = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    for (const j of jsons) {
      results.push(path.join(dirPath, j));
    }
  }
  return results;
}

// 마커 유형 (passage에 ①②③④⑤ 허용)
const MARKER_TYPES = [
  '어법(밑줄)', '어법', '문맥상 부적절한 어휘', '부적절한 어휘',
  '내용일치', '문장삽입', '순서배열', '오류찾기'
];

// (A)(B)(C) 유형
const ABC_TYPES = ['(A)(B)(C) 조합형'];

// passage 불필요 유형
const NO_PASSAGE_TYPES = ['영영풀이 매칭', '영영풀이'];

function stripMarkers(text) {
  if (!text) return text;
  // ①②③④⑤ 및 주변 <u></u> 제거 (마커+밑줄 함께 제거)
  return text
    .replace(/[①②③④⑤]\s*<u>([^<]*)<\/u>/g, '$1')
    .replace(/[①②③④⑤]/g, '');
}

function fixFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fp = data.fullPassage;
  if (!fp) {
    console.log(`  SKIP (no fullPassage): ${filePath}`);
    return 0;
  }

  let fixes = 0;
  const qs = data.questions || [];

  for (const q of qs) {
    const type = q.type || '';
    const fmt = q.fmt || '';

    // V76: 영영풀이 passage → null
    if (NO_PASSAGE_TYPES.some(t => type.includes(t))) {
      if (q.passage !== null && q.passage !== undefined) {
        q.passage = null;
        fixes++;
      }
      continue;
    }

    // 서술형(written)은 passage 필요하지만 오버레이 방식이 다름
    // mc+passage 유형만 fullPassage 교체
    if (!q.passage && fmt === 'written') {
      // 서술형에 passage 없으면 fullPassage + 빈칸 처리
      // wa가 있으면 해당 단어를 ____로 교체
      if (q.wa && q.type && q.type.includes('어형 변환')) {
        // 어형변환: fullPassage에서 wa 위치에 빈칸 + [원형]
        // 이건 수동 처리 필요 - skip
        continue;
      }
      // 기타 서술형: fullPassage 그대로 (찾기 유형 등)
      continue;
    }

    // passage가 있고 mc인 경우: fullPassage 기반으로 교체
    if (q.passage && fmt === 'mc') {
      const passageLen = q.passage.length;
      const fpLen = fp.length;

      // 이미 85% 이상이면 마커 누출만 체크
      const ratio = passageLen / fpLen;

      // S-MARKER-LEAK: 비마커 유형에서 마커 제거
      if (!MARKER_TYPES.some(t => type.includes(t)) && !ABC_TYPES.some(t => type.includes(t))) {
        if (/[①②③④⑤]/.test(q.passage)) {
          q.passage = stripMarkers(q.passage);
          fixes++;
        }
      }

      // S-PASSAGE-NOT-FULL: passage가 fullPassage의 85% 미만이면 교체
      if (ratio < 0.85) {
        // 유형별 오버레이 적용
        let newPassage = fp;

        if (type.includes('(A)(B)(C)')) {
          // (A)(B)(C) 마커는 기존 passage에서 가져와야 함 — 위치 정보 필요
          // 자동 교체 어려움, skip하고 수동 처리
          // 하지만 기존 passage에 마커가 있으면 fullPassage에 삽입 시도
          continue; // (A)(B)(C)는 수동 처리
        }

        if (type.includes('부적절') || type.includes('어법') || type.includes('오류')) {
          // 마커 유형: 기존 passage의 마커 패턴을 보존해야 함
          // 기존 passage에서 마커+밑줄 단어 추출
          const markerPattern = /([①②③④⑤])\s*<u>([^<]*)<\/u>/g;
          const markers = [];
          let m;
          while ((m = markerPattern.exec(q.passage)) !== null) {
            markers.push({ marker: m[1], word: m[2] });
          }

          if (markers.length > 0) {
            // fullPassage에서 해당 단어 위치에 마커+밑줄 삽입
            newPassage = fp;
            for (const { marker, word } of markers) {
              // 원래 단어 또는 변형된 단어를 찾아 마커 삽입
              // 정확한 단어 매칭
              const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(?<![①②③④⑤]\\s*<u>)\\b${escaped}\\b(?!<\\/u>)`, 'i');
              if (regex.test(newPassage)) {
                newPassage = newPassage.replace(regex, `${marker}<u>${word}</u>`);
              }
            }
            q.passage = newPassage;
            fixes++;
          } else {
            // 마커 없는 마커유형 — 기존 passage 유지
            continue;
          }
        } else if (type.includes('빈칸')) {
          // 빈칸 유형: 기존 passage에서 ____ 위치의 단어 파악
          const blankMatch = q.passage.match(/______*/);
          if (blankMatch) {
            // 기존 passage에서 빈칸 앞뒤 컨텍스트로 fullPassage에서 위치 찾기
            const idx = q.passage.indexOf('______');
            const before = q.passage.substring(Math.max(0, idx - 30), idx).trim();
            const after = q.passage.substring(idx + blankMatch[0].length, idx + blankMatch[0].length + 30).trim();

            // det에서 정답 단어 추출
            const detK = q.det?.korean || '';
            const ansIdx = q.ans;
            const ansWord = q.ch?.[ansIdx - 1] || '';

            if (ansWord && fp.includes(ansWord)) {
              // fullPassage에서 정답 단어를 ______로 교체
              newPassage = fp.replace(new RegExp(`\\b${ansWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '______');
              q.passage = newPassage;
              fixes++;
            } else {
              // 정답 단어가 fullPassage에 없으면 기존 유지
              continue;
            }
          }
        } else if (type.includes('동의어') || type.includes('반의어')) {
          // 동의어/반의어: fullPassage + 밑줄 대상 단어에 <u> 추가
          const ulMatch = q.passage.match(/<u>([^<]+)<\/u>/);
          if (ulMatch) {
            const targetWord = ulMatch[1];
            const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            newPassage = fp.replace(new RegExp(`\\b${escaped}\\b`, 'i'), `<u>${targetWord}</u>`);
            q.passage = newPassage;
            fixes++;
          }
        } else if (type.includes('다의어')) {
          // 다의어: fullPassage + 밑줄 + (A)(B) 문장
          // 기존 passage 구조 유지 (본문 + (A)(B) 예문)
          // fullPassage에서 밑줄 단어 찾아 교체
          const ulMatch = q.passage.match(/<u>([^<]+)<\/u>/);
          if (ulMatch) {
            const targetWord = ulMatch[1];
            // (A)(B) 부분 추출
            const abMatch = q.passage.match(/(<br><br>\(A\).*$)/s);
            const abPart = abMatch ? abMatch[1] : '';

            const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let mainPassage = fp.replace(new RegExp(`\\b${escaped}\\b`, 'i'), `<u>${targetWord}</u>`);
            newPassage = mainPassage + abPart;
            q.passage = newPassage;
            fixes++;
          }
        } else if (type.includes('함축') || type.includes('지칭')) {
          // 함축의미/지칭: fullPassage + 밑줄
          const ulMatch = q.passage.match(/<u>([^<]+)<\/u>/);
          if (ulMatch) {
            const targetPhrase = ulMatch[1];
            const escaped = targetPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            newPassage = fp.replace(new RegExp(escaped, 'i'), `<u>${targetPhrase}</u>`);
            q.passage = newPassage;
            fixes++;
          }
        } else if (type.includes('내용일치') || type.includes('주제') || type.includes('제목') || type.includes('요지') || type.includes('T/F')) {
          // 내용 유형: fullPassage 그대로
          q.passage = fp;
          fixes++;
        } else if (type.includes('문장삽입') || type.includes('순서')) {
          // 문장삽입/순서: 기존 passage 유지 (마커 위치가 중요)
          continue;
        } else {
          // 기타: fullPassage 그대로
          q.passage = fp;
          fixes++;
        }
      }
    }

    // S-TF-ORDER: T/F 순서 수정
    if (type.includes('T/F') || type === 'T/F') {
      if (q.ch && q.ch.length === 2 && q.ch[0] === 'F' && q.ch[1] === 'T') {
        q.ch = ['T', 'F'];
        q.ans = q.ans === 1 ? 2 : 1;
        fixes++;
      }
    }
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`  FIXED ${fixes}건: ${path.relative(BASE, filePath)}`);
  }
  return fixes;
}

// Main
const files = globSync();
console.log(`\n=== 고1/3월_2026 자동수정 ===`);
console.log(`대상: ${files.length}파일\n`);

let totalFixes = 0;
for (const f of files) {
  totalFixes += fixFile(f);
}

console.log(`\n총 ${totalFixes}건 수정 완료.`);
