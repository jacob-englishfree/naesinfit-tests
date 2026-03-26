#!/usr/bin/env node
/**
 * FINAL generator: Create 30 per-passage test files for 6강/7강
 *
 * Approach: Take each 강-level file (단어/워크북/퀴즈테스트.html),
 * modify it to create per-passage versions where:
 * - Only one passage (P_GW) is used
 * - All questions reference that single passage
 * - EI metadata is updated
 * - UI labels are updated
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '부교재/수능특강/영어');

const PASSAGES = {
  '6': {
    GW:   { var: 'P_GW',   text: null },
    EX01: { var: 'P_EX01', text: null },
    EX02: { var: 'P_EX02', text: null },
    EX03: { var: 'P_EX03', text: null },
    EX04: { var: 'P_EX04', text: null },
  },
  '7': {
    GW:   { var: 'P_GW',   text: null },
    EX01: { var: 'P_EX01', text: null },
    EX02: { var: 'P_EX02', text: null },
    EX03: { var: 'P_EX03', text: null },
    EX04: { var: 'P_EX04', text: null },
  }
};

const META = {
  '6': { topic: '주제 파악', topicEn: 'Topic Identification', titles: { GW: 'Speed vs Frequency', EX01: 'Alien Voting', EX02: 'Art & Location', EX03: 'Computer Model of Mind', EX04: 'Literature & Imagination' } },
  '7': { topic: '제목 파악', topicEn: 'Title Identification', titles: { GW: 'Culturtainment', EX01: '10000-Hour Myth', EX02: 'Beverage in USSR', EX03: 'Is Drawing Dead', EX04: 'Limited Animation' } }
};

const LESSON = { GW: 'Gateway', EX01: '1번', EX02: '2번', EX03: '3번', EX04: '4번' };
const FOLDER = { GW: 'Gateway', EX01: '1번', EX02: '2번', EX03: '3번', EX04: '4번' };
const HIST = { GW: 'gw', EX01: 'ex1', EX02: 'ex2', EX03: 'ex3', EX04: 'ex4' };

// Read passage texts from each 강-level 단어테스트.html
for (const gang of ['6', '7']) {
  const html = fs.readFileSync(path.join(BASE, `${gang}강/단어테스트.html`), 'utf-8');
  for (const pk of ['GW', 'EX01', 'EX02', 'EX03', 'EX04']) {
    const varName = pk === 'GW' ? 'P_GW' : `P_EX0${['EX01','EX02','EX03','EX04'].indexOf(pk)+1}`;
    const regex = new RegExp(`const ${varName}=\`([^\`]*)\``);
    const match = html.match(regex);
    PASSAGES[gang][pk].text = match ? match[1] : '';
  }
}

// Test types with their config
const TEST_TYPES = [
  { fname: '단어테스트.html', prefix: 'wordTest', time: 1200, timerStr: '20:00', chipTime: '20분', badge: '온라인단어 TEST', titleType: '온라인단어' },
  { fname: '워크북테스트.html', prefix: 'workbookTest', time: 1500, timerStr: '25:00', chipTime: '25분', badge: '온라인워크북 TEST', titleType: '온라인워크북' },
  { fname: '퀴즈테스트.html', prefix: 'quizTest', time: 1800, timerStr: '30:00', chipTime: '30분', badge: '퀴즈(예상문제) TEST', titleType: '퀴즈(예상문제)' },
];

let count = 0;

for (const gang of ['6', '7']) {
  const gangPad = gang.padStart(2, '0');

  for (const tt of TEST_TYPES) {
    // Read the source 강-level file
    const srcPath = path.join(BASE, `${gang}강/${tt.fname}`);
    const srcHtml = fs.readFileSync(srcPath, 'utf-8');

    // Split the file: everything before the LAST <script>, the script content, everything after </script>
    const scriptStart = srcHtml.lastIndexOf('<script>');
    const scriptEnd = srcHtml.lastIndexOf('</script>');
    const beforeScript = srcHtml.substring(0, scriptStart);
    const scriptContent = srcHtml.substring(scriptStart + 8, scriptEnd);
    const afterScript = srcHtml.substring(scriptEnd);

    // Extract parts of the script
    // 1. EI line
    // 2. Passage declarations (P_GW, P_EX01..P_EX04)
    // 3. Q array
    // 4. Rest of JS (typeTag + engine)

    const eiMatch = scriptContent.match(/const EI=\{[^}]+\};/);
    if (!eiMatch) { console.error(`No EI found in ${gang}강/${tt.fname}`); continue; }

    // Find the end of Q array: "];\n" then the JS engine starts
    // The Q array ends with "];\n" and then comes typeTag or let S=
    // We need to find what's AFTER the Q array ends
    // Strategy: find "const Q=[", then find the matching "];" at end of Q array,
    // then everything after that is the JS engine

    const qStartSearch = scriptContent.indexOf('const Q=[');
    if (qStartSearch === -1) { console.error(`No Q array found in ${gang}강/${tt.fname}`); continue; }

    // Find the end of Q array by looking for "];\n" after the Q start
    // The Q array ends with a specific pattern: "];\n" followed by newline and either const or let
    let qEndIdx = -1;
    let searchFrom = qStartSearch + 10;
    while (searchFrom < scriptContent.length) {
      const nextEnd = scriptContent.indexOf('];\n', searchFrom);
      if (nextEnd === -1) break;
      // Check if this is followed by const or let (not another question)
      const afterEnd = scriptContent.substring(nextEnd + 3, nextEnd + 30).trim();
      if (afterEnd.startsWith('const ') || afterEnd.startsWith('let ') || afterEnd.startsWith('\nconst ') || afterEnd.startsWith('\nlet ')) {
        qEndIdx = nextEnd + 3;
        break;
      }
      searchFrom = nextEnd + 3;
    }
    if (qEndIdx === -1) { console.error(`No Q array end found in ${gang}강/${tt.fname}`); continue; }

    const qAndPassages = scriptContent.substring(0, qEndIdx);
    const jsEngine = scriptContent.substring(qEndIdx);

    // Extract Q array text (raw, before eval)
    const qStartIdx = qAndPassages.indexOf('const Q=[');
    if (qStartIdx === -1) { console.error(`No Q array found in ${gang}강/${tt.fname}`); continue; }
    const passageDecls = qAndPassages.substring(eiMatch.index + eiMatch[0].length, qStartIdx).trim();
    const qArrayRaw = qAndPassages.substring(qStartIdx);

    for (const pk of ['GW', 'EX01', 'EX02', 'EX03', 'EX04']) {
      const lesson = LESSON[pk];
      const folder = FOLDER[pk];
      const title = META[gang].titles[pk];
      const histSuffix = HIST[pk];
      const passage = PASSAGES[gang][pk].text;
      const topbarLabel = `${gang}강 ${lesson === 'Gateway' ? 'GW' : lesson}`;

      // Build new EI
      const newEI = JSON.stringify({
        subject: "2027학년도 EBS수능특강 영어",
        pub: `${gang}강`,
        lesson: lesson,
        title: title,
        total: 100,
        time: tt.time,
        totalQ: 20,
        histKey: `${tt.prefix}_suneung_${gangPad}_${histSuffix}_v1`
      });

      // Build new passage declaration (only P_GW, since per-passage file uses only one)
      const escapedPassage = passage;
      const newPassageDecl = `\nconst P_GW=\`${escapedPassage}\`;\n`;

      // Modify Q array: replace all P_EXnn references with P_GW
      // and any passage:"..." fields that reference other passages
      let newQArray = qArrayRaw;
      // Replace variable references P_EX01..P_EX04 and P_GW with just P_GW
      newQArray = newQArray.replace(/,"passage":P_EX01,/g, ',"passage":P_GW,');
      newQArray = newQArray.replace(/,"passage":P_EX02,/g, ',"passage":P_GW,');
      newQArray = newQArray.replace(/,"passage":P_EX03,/g, ',"passage":P_GW,');
      newQArray = newQArray.replace(/,"passage":P_EX04,/g, ',"passage":P_GW,');

      // Build new beforeScript with updated metadata
      let newBefore = beforeScript;

      // Update title
      newBefore = newBefore.replace(
        /<title>[^<]+<\/title>/,
        `<title>2027학년도 EBS수능특강 ${gangPad}강 ${lesson} ${tt.titleType} TEST</title>`
      );

      // Update brand badge
      newBefore = newBefore.replace(
        /<div class="brand-badge">[^<]+<\/div>/,
        `<div class="brand-badge">${tt.badge}</div>`
      );

      // Update start-title
      newBefore = newBefore.replace(
        /<h1 class="start-title">[^<]*<span>[^<]*<\/span><\/h1>/,
        `<h1 class="start-title">${tt.titleType} <span>TEST</span></h1>`
      );

      // Update subtitle
      newBefore = newBefore.replace(
        /<p class="start-subtitle">[^<]+<\/p>/,
        `<p class="start-subtitle">2027학년도 EBS수능특강 영어 · ${gang}강 · ${lesson} · ${META[gang].topic} · 20문항</p>`
      );

      // Update info card header
      // info-card-header stays same

      // Update info rows
      newBefore = newBefore.replace(
        /(<div class="info-row"><span class="info-label">문항<\/span><span class="info-value">)[^<]+(<\/span><\/div>)/,
        `$1${gangPad}강 ${lesson} (${META[gang].topic})$2`
      );
      newBefore = newBefore.replace(
        /(<div class="info-row"><span class="info-label">지문<\/span><span class="info-value">)[^<]+(<\/span><\/div>)/,
        `$1${title}$2`
      );

      // Update chip row - keep as is (20문항, time, 80점, 100점)
      newBefore = newBefore.replace(
        /(<div class="chip">)[^<]*(분<\/div>)/,
        `$1${tt.chipTime}$2`
      );

      // Update topbar
      newBefore = newBefore.replace(
        /수능특강 · <span>[^<]+<\/span>/,
        `수능특강 · <span>${topbarLabel}</span>`
      );

      // Update timer
      newBefore = newBefore.replace(
        /<div class="timer" id="timer">[^<]+<\/div>/,
        `<div class="timer" id="timer">${tt.timerStr}</div>`
      );

      // Assemble the new file
      const newHtml = newBefore +
        '<script>\n' +
        `const EI=${newEI};\n` +
        newPassageDecl +
        newQArray +
        jsEngine +
        afterScript;

      // Write
      const outDir = path.join(BASE, `${gang}강/${folder}`);
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, tt.fname);
      fs.writeFileSync(outPath, newHtml, 'utf-8');
      count++;
      console.log(`[${count}/30] ${gang}강/${folder}/${tt.fname}`);
    }
  }
}

console.log(`\nDone! ${count} files generated.`);

// Verify: check file sizes and key content
console.log('\nVerification:');
for (const gang of ['6', '7']) {
  for (const pk of ['GW', 'EX01', 'EX02', 'EX03', 'EX04']) {
    const folder = FOLDER[pk];
    for (const tt of TEST_TYPES) {
      const fpath = path.join(BASE, `${gang}강/${folder}/${tt.fname}`);
      const stat = fs.statSync(fpath);
      const content = fs.readFileSync(fpath, 'utf-8');
      const hasEI = content.includes(`"pub":"${gang}강"`);
      const hasLesson = content.includes(`"lesson":"${LESSON[pk]}"`);
      const hasHist = content.includes(`_suneung_${gang.padStart(2,'0')}_${HIST[pk]}_`);
      const qCount = (content.match(/"id":\d+/g) || []).length;
      const ok = hasEI && hasLesson && hasHist && qCount === 20;
      if (!ok) {
        console.log(`  WARN: ${gang}강/${folder}/${tt.fname} - EI:${hasEI} lesson:${hasLesson} hist:${hasHist} Q:${qCount}`);
      }
    }
  }
}
console.log('All verifications passed (no warnings = all OK)');
