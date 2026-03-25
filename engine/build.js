#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — build.js
 * Builds a standalone HTML file from a JSON data file.
 *
 * Usage: node engine/build.js data/모의고사/고1/3월/18번/단어.json
 * Output: dist/모의고사/고1/3월/18번/단어테스트.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = __dirname;

// ── Theme mapping ──
const THEME_MAP = {
  '단어': { css: 'theme-green.css', brand: '온라인단어 TEST', titleHtml: '온라인단어 <span>TEST</span>', prefix: 'wordTest_' },
  '워크북': { css: 'theme-purple.css', brand: '온라인워크북 TEST', titleHtml: '온라인워크북 <span>TEST</span>', prefix: 'workbookTest_' },
  '퀴즈': { css: 'theme-orange.css', brand: '온라인퀴즈 TEST', titleHtml: '온라인퀴즈 <span>TEST</span>', prefix: 'quizTest_' }
};

const TEST_TYPE_NAME = { '단어': '단어', '워크북': '워크북', '퀴즈': '퀴즈' };

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node engine/build.js <json-file>');
    process.exit(1);
  }

  const jsonPath = path.resolve(args[0]);
  if (!fs.existsSync(jsonPath)) {
    console.error(`[ERROR] File not found: ${jsonPath}`);
    process.exit(1);
  }

  // ── 1. Read & parse JSON ──
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.error(`[ERROR] JSON parse failed: ${e.message}`);
    process.exit(1);
  }

  const { testType, ei, fullPassage, questions } = data;

  // ── 2. Basic validation ──
  if (!THEME_MAP[testType]) {
    console.error(`[ERROR] Invalid testType: "${testType}". Must be 단어/워크북/퀴즈`);
    process.exit(1);
  }
  if (!ei || !questions || !fullPassage) {
    console.error('[ERROR] Missing required fields: ei, fullPassage, questions');
    process.exit(1);
  }
  if (questions.length === 0) {
    console.error(`[ERROR] questions array is empty`);
    process.exit(1);
  }
  const totalPts = questions.reduce((s, q) => s + q.pts, 0);

  // ── 3. Load engine files ──
  const commonCss = fs.readFileSync(path.join(ENGINE_DIR, 'common.css'), 'utf8');
  const themeCss = fs.readFileSync(path.join(ENGINE_DIR, THEME_MAP[testType].css), 'utf8');
  const engineJs = fs.readFileSync(path.join(ENGINE_DIR, 'engine.js'), 'utf8');
  const template = fs.readFileSync(path.join(ENGINE_DIR, 'template.html'), 'utf8');

  // ── 4. Build data block ──
  // Handle __FULL__ marker: replace with FULL_PASSAGE reference in JS
  const qForJs = questions.map(q => {
    const copy = Object.assign({}, q);
    if (copy.passage === '__FULL__') {
      copy._fullRef = true;
    }
    return copy;
  });

  // Serialize Q array, replacing __FULL__ passages with FULL_PASSAGE reference
  let qStr = JSON.stringify(qForJs, null, 0);
  // Replace `"passage":"__FULL__","_fullRef":true` with `"passage":FULL_PASSAGE`
  // We need to be more careful: remove _fullRef and replace passage value
  const qForOutput = questions.map(q => {
    const copy = Object.assign({}, q);
    // ch can be null for written questions
    if (copy.ch === null) delete copy.ch;
    return copy;
  });

  let dataBlock = '';
  dataBlock += `const EI=${JSON.stringify(ei)};\n`;
  dataBlock += `const FULL_PASSAGE=${JSON.stringify(fullPassage)};\n`;

  // Build Q array string manually to support FULL_PASSAGE references
  const qParts = qForOutput.map(q => {
    if (q.passage === '__FULL__') {
      const copy = Object.assign({}, q);
      delete copy.passage;
      const json = JSON.stringify(copy);
      // Insert passage:FULL_PASSAGE after "fmt":"..."
      return json.replace(/^{/, '{"passage":FULL_PASSAGE,').replace(/,}$/, '}');
    }
    return JSON.stringify(q);
  });
  dataBlock += `const Q=[${qParts.join(',\n')}];\n`;

  // ── 5. Build placeholders ──
  const theme = THEME_MAP[testType];
  const typeName = TEST_TYPE_NAME[testType];

  const title = `${ei.subject} ${ei.pub} 온라인${typeName}TEST`;
  const subtitle = `${ei.subject} · ${ei.pub} · ${ei.lesson} · 20문항`;
  const infoHeader = '시험 정보';
  const infoRows = [
    `<div class="info-row"><span class="info-label">시험</span><span class="info-value">${ei.subject}</span></div>`,
    `<div class="info-row"><span class="info-label">문항</span><span class="info-value">${ei.pub} (${ei.lesson})</span></div>`,
    `<div class="info-row"><span class="info-label">지문</span><span class="info-value">${ei.title}</span></div>`
  ].join('\n    ');

  // Topbar: shorten subject if needed
  const topbarInfo = `${ei.subject} · <span>${ei.pub}</span>`;

  // ── 6. Replace placeholders ──
  let html = template;
  html = html.replace('{{TITLE}}', title);
  html = html.replace('{{THEME_CSS}}', themeCss);
  html = html.replace('{{COMMON_CSS}}', commonCss);
  html = html.replace('{{BRAND_BADGE}}', theme.brand);
  html = html.replace('{{TEST_TITLE_HTML}}', theme.titleHtml);
  html = html.replace('{{SUBTITLE}}', subtitle);
  html = html.replace('{{INFO_HEADER}}', infoHeader);
  html = html.replace('{{INFO_ROWS}}', infoRows);
  html = html.replace('{{TOPBAR_INFO}}', topbarInfo);
  html = html.replace('{{DATA_BLOCK}}', dataBlock);
  html = html.replace('{{ENGINE_JS}}', engineJs);

  // ── 7. Determine output path ──
  // Input:  data/모의고사/고1/3월/18번/단어.json
  // Output: dist/모의고사/고1/3월/18번/단어테스트.html
  const relFromData = path.relative(path.join(ROOT, 'data'), jsonPath);
  const parsed = path.parse(relFromData);
  const outName = parsed.name + '테스트.html';
  const outDir = path.join(ROOT, 'dist', parsed.dir);
  const outPath = path.join(outDir, outName);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');

  const sizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`[BUILD] ${outPath}`);
  console.log(`        Size: ${sizeKB} KB | Type: ${testType} | Questions: ${questions.length} | Points: ${totalPts}`);
}

main();
