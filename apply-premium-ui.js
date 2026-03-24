#!/usr/bin/env node
/**
 * apply-premium-ui.js v2
 *
 * Reads the premium template (1강 단어테스트.html), extracts CSS + JS,
 * then applies them to ALL *테스트.html files with appropriate color theming.
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const TEMPLATE = path.join(BASE, '부교재', '수능특강', '영어', '1강', '단어테스트.html');
const DIRS = [
  path.join(BASE, '부교재', '수능특강', '영어'),
  path.join(BASE, '모의고사'),
  path.join(BASE, '교과서'),
];

let totalFiles = 0;
let updatedFiles = 0;
let skippedFiles = 0;
let errorFiles = [];

// ─── Read template ───
const tmpl = fs.readFileSync(TEMPLATE, 'utf8');

// Extract CSS from template (between <style> and </style>)
const tmplCSS = tmpl.match(/<style>([\s\S]*?)<\/style>/)[1];

// Extract JS from template (between <script>\n and \n</script>)
// This includes everything: EI, passages, Q, typeTag, let S=, all functions
const tmplScriptMatch = tmpl.match(/<script>\n([\s\S]*?)\n<\/script>/);
const tmplFullJS = tmplScriptMatch[1];

// Split template JS into DATA part and FUNCTIONS part
// DATA = from start to (but not including) "let S="
// FUNCTIONS = from "let S=" to end
const letSIdx = tmplFullJS.indexOf('let S=');
const tmplFunctions = tmplFullJS.substring(letSIdx); // "let S=..." to end

// Extract HTML structure from template
const tmplBody = tmpl.match(/<body>([\s\S]*?)<script>/)[1];

// ─── Color mapping for themes ───
// Green theme (단어): --g:#16A34A etc. (template default)
// Purple theme (워크북): --o:#7C3AED
// Orange theme (퀴즈): --o:#E8772E

// The template uses --g/--gd/--gl/--gxl/--gxxl for green theme
// 워크북/퀴즈 files use --o/--od/--ol/--oxl/--oxxl

function findTestFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('테스트.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

function isPremiumV2(content) {
  // Check if the file already has all premium UI markers
  if (!content.includes('exam-progress') || !content.includes('selectPulse') || !content.includes('initSwipe')) {
    return false;
  }
  // Count standalone <script> tags (not <script src=)
  const scriptTags = (content.match(/<script>(?!\s*<\/script>)/g) || []).length;
  // Valid premium file has exactly 1 inline script block
  return scriptTags === 1;
}

function getColorScheme(content) {
  // Returns 'green', 'purple', or 'orange' based on root vars
  if (content.match(/:root\{--g:#16A34A/)) return 'green';
  if (content.match(/:root\{--o:#7C3AED/)) return 'purple';
  if (content.match(/:root\{--o:#E8772E/)) return 'orange';
  // Fallback based on filename will be done later
  return null;
}

function getColorSchemeFromName(filename) {
  if (filename.includes('단어')) return 'green';
  if (filename.includes('워크북')) return 'purple';
  if (filename.includes('퀴즈')) return 'orange';
  return 'green';
}

function extractOriginalRootVars(content) {
  const m = content.match(/:root\{([^}]+)\}/);
  return m ? m[1] : null;
}

function extractOrigData(content) {
  // Extract the data portion from the file's <script>
  // Data = EI, passage constants, Q array, typeTag
  // Use the LAST standalone <script>...</script> block before </body>
  const allScripts = content.match(/<script>[\s\S]*?<\/scr/g);
  // Get the last script block content
  const lastScriptStart = content.lastIndexOf('<script>');
  const lastScriptEnd = content.indexOf('</scr', lastScriptStart);
  if (lastScriptStart === -1 || lastScriptEnd === -1) return null;
  const script = content.substring(lastScriptStart + 8, lastScriptEnd);

  // Find where data ends - look for "let S=" first, then "function getHistory" as fallback
  let endIdx = script.indexOf('\nlet S=');
  if (endIdx === -1) endIdx = script.indexOf('\nfunction getHistory');
  if (endIdx === -1) endIdx = script.indexOf('\nfunction startExam');
  if (endIdx === -1) return null;

  let dataSection = script.substring(0, endIdx).trim();
  // Clean up any broken state init remnant
  dataSection = dataSection.replace(/\n\s*\d+,ti:null[^;]*;\s*$/, '').trim();
  return dataSection;
}

function extractTitle(content) {
  const m = content.match(/<title>(.*?)<\/title>/);
  return m ? m[1] : '';
}

function extractStartScreenParts(content) {
  // First isolate the startScreen HTML section (before examScreen)
  const ssStart = content.indexOf('<div id="startScreen"');
  const ssEnd = content.indexOf('<div id="examScreen"');
  const startSection = (ssStart !== -1 && ssEnd !== -1) ? content.substring(ssStart, ssEnd) : content;

  // Extract topbar from examScreen section
  const examStart = content.indexOf('<div id="examScreen"');
  const resultStart = content.indexOf('<div id="resultScreen"');
  const examSection = (examStart !== -1 && resultStart !== -1) ? content.substring(examStart, resultStart) : content;

  const brandM = startSection.match(/<div class="brand-badge">([\s\S]*?)<\/div>/);
  const titleM = startSection.match(/<h1 class="start-title">([\s\S]*?)<\/h1>/);
  const subtitleM = startSection.match(/<p class="start-subtitle">([\s\S]*?)<\/p>/);
  const infoCardM = startSection.match(/(<div class="info-card">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>)/);
  const chipM = startSection.match(/(<div class="chip-row">[\s\S]*?)<\/div>\s*\n?\s*<div class="input-group">/);
  const topbarInfoM = examSection.match(/<div class="topbar-info">([\s\S]*?)<\/div>/);
  const gradeM = startSection.match(/<select id="inpGrade">([\s\S]*?)<\/select>/);

  return {
    brandBadge: brandM ? brandM[1].trim() : '',
    startTitle: titleM ? titleM[1].trim() : '',
    startSubtitle: subtitleM ? subtitleM[1].trim() : '',
    infoCard: infoCardM ? infoCardM[1].trim() : '',
    chipRow: chipM ? chipM[1].trim() + '</div>' : '',
    topbarInfo: topbarInfoM ? topbarInfoM[1].trim() : '',
    gradeSelect: gradeM ? gradeM[1] : '<option>고1</option><option>고2</option><option>고3</option><option>중3</option>',
  };
}

// Color transformation functions
// Template uses green theme: --g, --gd, --gl, --gxl, --gxxl, var(--g), #16A34A, etc.
// Purple theme: --o, --od, --ol, --oxl, --oxxl, different colors
// Orange theme: --o, --od, --ol, --oxl, --oxxl, different colors

function transformCSSForColor(css, scheme, origRootVars) {
  if (scheme === 'green') {
    // Template is already green, just use as-is but substitute root vars
    return css.replace(/:root\{[^}]+\}/, ':root{' + origRootVars + '}');
  }

  // For purple/orange, we need to:
  // 1. Replace root vars
  // 2. Replace var(--g) -> var(--o), var(--gd) -> var(--od), etc.
  // 3. Replace color-specific values

  let result = css.replace(/:root\{[^}]+\}/, ':root{' + origRootVars + '}');

  // Variable name replacements
  result = result.replace(/var\(--gxxl\)/g, 'var(--oxxl)');
  result = result.replace(/var\(--gxl\)/g, 'var(--oxl)');
  result = result.replace(/var\(--gl\)/g, 'var(--ol)');
  result = result.replace(/var\(--gd\)/g, 'var(--od)');
  result = result.replace(/var\(--g\)/g, 'var(--o)');

  // Background gradients
  if (scheme === 'purple') {
    result = result.replace(/#F0FDF4,#E8F5E9 40%,#DCFCE7/g, '#F3F0FF,#EDE7F6 40%,#E8E0F6');
    result = result.replace(/#0D9488/g, '#6D28D9');
    result = result.replace(/rgba\(22,163,74,/g, 'rgba(124,58,237,');
    result = result.replace(/#dde8df/g, '#d8d0e8');
    result = result.replace(/#d0dcd2/g, '#c8c0d8');
    result = result.replace(/#c8d8ca/g, '#c0b8d8');
    result = result.replace(/#f0f5f1/g, '#f0edf5');
    result = result.replace(/#FAFDFB/g, '#FAFAFF');
    result = result.replace(/#F5FAF6/g, '#F5F3FA');
    result = result.replace(/#e8efe9/g, '#e8e0f0');
    result = result.replace(/#e0ece2/g, '#e0d8e8');
    result = result.replace(/#166534/g, '#4A148C');
    result = result.replace(/var\(--o\)/g, 'var(--warn)'); // timer warn stays as --warn for purple
    // Undo the overkill on timer warn
    result = result.replace(/\.timer\.warn\{color:var\(--warn\)\}/g, '.timer.warn{color:var(--warn)}');
  } else { // orange
    result = result.replace(/#F0FDF4,#E8F5E9 40%,#DCFCE7/g, '#FFF3E8,#FFE8D6 40%,#FFDDC8');
    result = result.replace(/#0D9488/g, '#D97706');
    result = result.replace(/rgba\(22,163,74,/g, 'rgba(232,119,46,');
    result = result.replace(/#dde8df/g, '#ddd8d2');
    result = result.replace(/#d0dcd2/g, '#d0c8c2');
    result = result.replace(/#c8d8ca/g, '#c8c0b8');
    result = result.replace(/#f0f5f1/g, '#f0ede8');
    result = result.replace(/#FAFDFB/g, '#FFFAF8');
    result = result.replace(/#F5FAF6/g, '#F5F0EB');
    result = result.replace(/#e8efe9/g, '#e8e0d8');
    result = result.replace(/#e0ece2/g, '#e0d8d0');
    result = result.replace(/#166534/g, '#BF360C');
  }

  return result;
}

function transformJSForColor(js, scheme) {
  if (scheme === 'green') return js;

  let result = js;

  // Replace CSS variable references in JS strings
  result = result.replace(/var\(--gxxl\)/g, 'var(--oxxl)');
  result = result.replace(/var\(--gxl\)/g, 'var(--oxl)');
  result = result.replace(/var\(--gl\)/g, 'var(--ol)');
  result = result.replace(/var\(--gd\)/g, 'var(--od)');
  result = result.replace(/var\(--g\)/g, 'var(--o)');

  // Replace var(--o) in timer warn context
  if (scheme !== 'green') {
    // The timer warn should use --warn for purple/orange themes
    result = result.replace(/'warn',S\.left<=300&&S\.left>60/g, "'warn',S.left<=300&&S.left>60");
  }

  return result;
}

function processFile(filePath) {
  totalFiles++;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);

    // Check if already has premium v2
    if (isPremiumV2(content)) {
      skippedFiles++;
      return { status: 'skipped', path: filePath };
    }

    // Determine color scheme
    let scheme = getColorScheme(content);
    if (!scheme) scheme = getColorSchemeFromName(filename);

    // Extract original root vars
    const origRootVars = extractOriginalRootVars(content);
    if (!origRootVars) {
      errorFiles.push({ path: filePath, error: 'No root vars found' });
      return { status: 'error', path: filePath };
    }

    // Extract data section
    const dataSection = extractOrigData(content);
    if (!dataSection) {
      errorFiles.push({ path: filePath, error: 'Could not extract data section' });
      return { status: 'error', path: filePath };
    }

    // Extract display info
    const title = extractTitle(content);
    const parts = extractStartScreenParts(content);

    // Transform CSS and JS for this file's color scheme
    const css = transformCSSForColor(tmplCSS, scheme, origRootVars);
    const functions = transformJSForColor(tmplFunctions, scheme);

    // Build new file
    let newContent = '<!DOCTYPE html>\n<html lang="ko">\n<head>\n';
    newContent += '<meta charset="UTF-8">\n';
    newContent += '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n';
    newContent += '<title>' + title + '</title>\n';
    newContent += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">\n';
    newContent += '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></scr' + 'ipt>\n';
    newContent += '<style>\n' + css + '\n</style>\n';
    newContent += '</head>\n<body>\n';
    newContent += '<div class="toast" id="toast"></div>\n';
    newContent += '<div id="startScreen" class="screen active">\n';
    newContent += '<div class="start-container">\n';
    newContent += '  <div class="brand-badge">' + parts.brandBadge + '</div>\n';
    newContent += '  <h1 class="start-title">' + parts.startTitle + '</h1>\n';
    newContent += '  <p class="start-subtitle">' + parts.startSubtitle + '</p>\n';
    newContent += '  ' + parts.infoCard + '\n';
    newContent += '  ' + parts.chipRow + '\n';
    newContent += '  <div class="input-group"><label>\uC774\uB984 *</label><input type="text" id="inpName" placeholder="\uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694"></div>\n';
    newContent += '  <div class="input-row">\n';
    newContent += '    <div class="input-group" style="flex:1"><label>\uD559\uAD50</label><input type="text" id="inpSchool" placeholder="\uC120\uD0DD"></div>\n';
    newContent += '    <div class="input-group" style="flex:.6"><label>\uD559\uB144</label><select id="inpGrade">' + parts.gradeSelect + '</select></div>\n';
    newContent += '  </div>\n';
    newContent += '  <button class="btn btn-primary" onclick="startExam()">\uC2DC\uD5D8 \uC2DC\uC791\uD558\uAE30 \u2192</button>\n';
    newContent += '  <button class="btn btn-outline" onclick="toggleHistory()">\uD83D\uDCCB \uC2DC\uD5D8 \uAE30\uB85D \uBCF4\uAE30 <span class="history-badge" id="hCount">0</span></button>\n';
    newContent += '  <div id="historyPanel"></div>\n';
    newContent += '</div>\n</div>\n';
    newContent += '<div id="examScreen" class="screen">\n';
    newContent += '  <div class="exam-topbar"><div class="topbar-left"><div class="topbar-dot"></div><div class="topbar-info">' + parts.topbarInfo + '</div></div><div class="timer" id="timer">20:00</div><button class="btn-submit" onclick="submitExam()">\uC81C\uCD9C\uD558\uAE30</button></div>\n';
    newContent += '  <div class="exam-progress"><div class="exam-progress-fill" id="progressFill"></div></div>\n';
    newContent += '  <div class="ans-count" id="ansCount">0/20</div>\n';
    newContent += '  <div class="exam-scroll" id="examScroll"></div>\n';
    newContent += '  <div class="slide-wrap" id="slideWrap">\n';
    newContent += '    <div class="slide-passage" id="slidePassage"></div>\n';
    newContent += '    <div class="slide-bottom" id="slideBottom"></div>\n';
    newContent += '  </div>\n';
    newContent += '</div>\n';
    newContent += '<div id="resultScreen" class="screen"></div>\n';
    newContent += '<scr' + 'ipt>\n';
    newContent += dataSection + '\n\n';
    newContent += functions + '\n';
    newContent += '</scr' + 'ipt>\n';
    newContent += '</body>\n</html>';

    fs.writeFileSync(filePath, newContent, 'utf8');
    updatedFiles++;
    return { status: 'updated', path: filePath };

  } catch (err) {
    errorFiles.push({ path: filePath, error: err.message });
    return { status: 'error', path: filePath };
  }
}

// Main
console.log('=== Premium UI Applicator v2 ===');
console.log('Template: ' + TEMPLATE);
console.log('Finding test files...\n');

let allFiles = [];
for (const dir of DIRS) {
  if (fs.existsSync(dir)) {
    const files = findTestFiles(dir);
    console.log('  ' + dir + ': ' + files.length + ' files');
    allFiles = allFiles.concat(files);
  } else {
    console.log('  ' + dir + ': directory not found, skipping');
  }
}

console.log('\nTotal files found: ' + allFiles.length + '\n');
console.log('Processing...\n');

for (const file of allFiles) {
  const result = processFile(file);
  const rel = path.relative(BASE, file);
  if (result.status === 'updated') {
    console.log('  [UPDATED] ' + rel);
  } else if (result.status === 'skipped') {
    console.log('  [SKIP]    ' + rel);
  } else {
    console.log('  [ERROR]   ' + rel);
  }
}

console.log('\n=== Summary ===');
console.log('Total files:   ' + totalFiles);
console.log('Updated:       ' + updatedFiles);
console.log('Skipped:       ' + skippedFiles);
console.log('Errors:        ' + errorFiles.length);

if (errorFiles.length > 0) {
  console.log('\nError details:');
  for (const e of errorFiles) {
    console.log('  ' + path.relative(BASE, e.path) + ': ' + e.error);
  }
}
