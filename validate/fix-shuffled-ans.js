#!/usr/bin/env node
/**
 * ch 셔플 후 ans 미업데이트 버그 자동 탐지 + 수정
 *
 * 마커형 문항(어법/부적절/오류찾기)에서 ch=["③","①","②","④"] 셔플 시
 * ans가 마커번호 그대로 남아있는 버그를 찾아 수정합니다.
 *
 * --dry-run: 수정 없이 탐지만
 * --fix: 실제 수정
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = !process.argv.includes('--fix');

const MARKER_CH = ['①', '②', '③', '④', '⑤'];
const MARKER_TYPES = ['어법', '문맥상 부적절한 어휘', '부적절한 어휘', '부적절', '오류찾기'];

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
      results.push(...walk(full));
    } else if (entry.isFile() && /^(단어|워크북|퀴즈)\.json$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = walk('data');
let totalFiles = 0;
let totalShuffled = 0;
let totalBugs = 0;
let totalFixed = 0;
const bugsByCategory = {};

for (const f of files) {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    const data = JSON.parse(raw);
    if (!data.questions) continue;
    totalFiles++;

    let fileChanged = false;

    for (const q of data.questions) {
      if (!MARKER_TYPES.includes(q.type) || !Array.isArray(q.ch)) continue;

      // Check if ch contains only markers
      const allMarkers = q.ch.every(c => {
        const first = c.trim().charAt(0);
        return MARKER_CH.includes(first) && c.trim().length <= 2;
      });
      if (!allMarkers) continue;

      // Check if ch is shuffled (not in order)
      const ordered = q.ch.every((c, i) => MARKER_CH.indexOf(c.trim()) === i);
      if (ordered) continue;

      totalShuffled++;

      // Bug pattern: ans = marker_number, but that marker is at a different position
      const intendedMarker = MARKER_CH[q.ans - 1]; // ans=3 → '③'
      const actualPos = q.ch.findIndex(c => c.trim() === intendedMarker);

      if (actualPos >= 0 && actualPos !== q.ans - 1) {
        const correctAns = actualPos + 1;
        const cat = f.split('/')[1] || 'unknown';
        bugsByCategory[cat] = (bugsByCategory[cat] || 0) + 1;
        totalBugs++;

        console.log(`❌ ${f} Q${q.id} [${q.type}]: ans=${q.ans} → ${correctAns} (${intendedMarker} at ch[${actualPos}])`);

        if (!DRY_RUN) {
          q.ans = correctAns;

          // Also fix det.analysis if present
          if (q.det && q.det.analysis) {
            // det.analysis references marker numbers, update to reflect correct ch position
            // This is complex — just flag for manual review
          }
          fileChanged = true;
          totalFixed++;
        }
      }
    }

    if (fileChanged) {
      fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
  } catch (e) {
    // skip parse errors
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`파일 스캔: ${totalFiles}`);
console.log(`셔플된 마커형 문항: ${totalShuffled}`);
console.log(`ans 버그 발견: ${totalBugs}`);
if (!DRY_RUN) console.log(`수정 완료: ${totalFixed}`);
else console.log('(dry-run — --fix 옵션으로 실제 수정)');
console.log('\n카테고리별:', JSON.stringify(bugsByCategory, null, 2));
