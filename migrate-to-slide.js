#!/usr/bin/env node
/**
 * migrate-to-slide.js
 *
 * Reads old-style test HTML files (scroll UI, missing features) and
 * rewrites them using the 1강 template (slide UI, all features).
 *
 * Preserves each file's own: title, startScreen HTML, EI, passage constants, Q, typeTag.
 * Replaces: CSS, exam screen HTML structure, all JS functions.
 */

const fs = require('fs');
const path = require('path');

// ─── Read the 3 reference templates ─────────────────────────────────────
const BASE = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests';
const TEMPLATES = {
  단어: fs.readFileSync(path.join(BASE, '부교재/수능특강/영어/1강/단어테스트.html'), 'utf-8'),
  워크북: fs.readFileSync(path.join(BASE, '부교재/수능특강/영어/1강/워크북테스트.html'), 'utf-8'),
  퀴즈: fs.readFileSync(path.join(BASE, '부교재/수능특강/영어/1강/퀴즈테스트.html'), 'utf-8'),
};

function detectType(filePath) {
  const name = path.basename(filePath);
  if (name.includes('단어')) return '단어';
  if (name.includes('워크북')) return '워크북';
  if (name.includes('퀴즈')) return '퀴즈';
  return null;
}

function splitTemplate(template) {
  // Split template into:
  // 1. HEAD: from start through </style>\n</head>\n<body>\n<div class="toast"...
  //    up to and including <div id="startScreen" class="screen active">
  // 2. START_SCREEN_CONTENT: the inner content of startScreen
  // 3. EXAM_STRUCTURE: from </div>\n<div id="examScreen"... to <script>
  // 4. DATA_SECTION: const EI=... through const typeTag=...
  // 5. JS_FUNCTIONS: let S=... through end

  // Strategy: split at key markers
  const lines = template.split('\n');

  // Find key line indices
  let headEndIdx = -1;       // line with </style>
  let scriptStartIdx = -1;   // line with <script>
  let scriptEndIdx = -1;     // line with </script>

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('</style>')) headEndIdx = i;
    if (lines[i].trim() === '<script>') scriptStartIdx = i;
    if (lines[i].includes('</script>')) scriptEndIdx = i;
  }

  // The CSS portion: lines 0..headEndIdx (inclusive of </style>)
  // Then </head><body>... to <script>
  // The JS portion: lines after <script> to before </script>

  return { lines, headEndIdx, scriptStartIdx, scriptEndIdx };
}

function extractDataFromOldFile(content) {
  // Extract everything between <script> and the first function/let S= line
  const lines = content.split('\n');

  let scriptStart = -1;
  let scriptEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '<script>') scriptStart = i;
    if (lines[i].includes('</script>')) scriptEnd = i;
  }

  if (scriptStart === -1) return null;

  const jsLines = lines.slice(scriptStart + 1, scriptEnd);
  const jsContent = jsLines.join('\n');

  // Extract EI
  const eiMatch = jsContent.match(/const EI\s*=\s*(\{[^;]+\});/);

  // Extract passage constants (P_GW, P_EX01, etc. or FULL_PASSAGE, PASSAGE)
  // These are const declarations that are NOT EI, Q, typeTag, or S
  const passageLines = [];
  const qStartPattern = /^const Q\s*=\s*\[/;
  const typeTagPattern = /^const typeTag\s*=/;

  let inQ = false;
  let inPassage = false;
  let qContent = '';
  let bracketCount = 0;
  let typeTagContent = '';

  for (let i = 0; i < jsLines.length; i++) {
    const line = jsLines[i];
    const trimmed = line.trim();

    // Skip empty lines and EI
    if (trimmed === '' || trimmed.startsWith('const EI')) continue;

    // Collect Q array
    if (qStartPattern.test(trimmed) || inQ) {
      inQ = true;
      qContent += line + '\n';
      // Count brackets to find end
      for (const ch of line) {
        if (ch === '[') bracketCount++;
        if (ch === ']') bracketCount--;
      }
      if (bracketCount <= 0 && qContent.length > 5) {
        inQ = false;
      }
      continue;
    }

    // Collect typeTag
    if (typeTagPattern.test(trimmed)) {
      typeTagContent = line;
      continue;
    }

    // Everything that's a const and before Q = passage constants
    if (trimmed.startsWith('const ') && !trimmed.startsWith('const Q') && !trimmed.startsWith('const typeTag')) {
      // Passage constant - could span multiple lines
      passageLines.push(line);
      continue;
    }

    // If line starts with function or let S, we've passed data section
    if (trimmed.startsWith('let S') || trimmed.startsWith('function ')) break;

    // Continuation of passage constants (backtick strings spanning multiple lines)
    if (passageLines.length > 0) {
      const lastPassage = passageLines[passageLines.length - 1];
      const backtickCount = (lastPassage.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0) {
        // Unfinished backtick string, append
        passageLines[passageLines.length - 1] += '\n' + line;
        continue;
      }
    }
  }

  // Extract startScreen content
  let startScreenStart = -1;
  let startScreenEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<div id="startScreen"')) startScreenStart = i;
    if (startScreenStart >= 0 && lines[i].includes('<div id="examScreen"')) {
      startScreenEnd = i;
      break;
    }
  }

  // Find the start-container content
  let startContent = '';
  if (startScreenStart >= 0 && startScreenEnd >= 0) {
    startContent = lines.slice(startScreenStart, startScreenEnd).join('\n');
  }

  // Extract title
  const titleMatch = content.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1] : '';

  return {
    title,
    startContent,
    ei: eiMatch ? eiMatch[0] : '',
    passages: passageLines.join('\n'),
    q: qContent.trim(),
    typeTag: typeTagContent,
  };
}

function migrateFile(filePath) {
  const type = detectType(filePath);
  if (!type) {
    console.log(`  SKIP: Cannot detect type for ${filePath}`);
    return false;
  }

  const template = TEMPLATES[type];
  const oldContent = fs.readFileSync(filePath, 'utf-8');

  // Check if already migrated
  if (oldContent.includes('function renderSlide') && oldContent.includes('function reviewHistory') && oldContent.includes('function shareImage')) {
    console.log(`  SKIP: Already has all features: ${path.basename(filePath)}`);
    return false;
  }

  const data = extractDataFromOldFile(oldContent);
  if (!data) {
    console.log(`  ERROR: Cannot extract data from ${filePath}`);
    return false;
  }

  // Build new file by taking template and replacing data section
  const templateLines = template.split('\n');

  // Find template boundaries
  let tplScriptStart = -1;
  let tplDataEnd = -1; // line with "let S="
  let tplTitleLine = -1;
  let tplStartScreenStart = -1;
  let tplExamScreenStart = -1;

  for (let i = 0; i < templateLines.length; i++) {
    if (templateLines[i].includes('<title>')) tplTitleLine = i;
    if (templateLines[i].includes('<div id="startScreen"')) tplStartScreenStart = i;
    if (templateLines[i].includes('<div id="examScreen"')) tplExamScreenStart = i;
    if (templateLines[i].trim() === '<script>') tplScriptStart = i;
    if (templateLines[i].trim().startsWith('let S=')) tplDataEnd = i;
  }

  // Build the output:
  // 1. Template CSS (line 0 to </style></head><body><toast>)
  //    but replace the <title> line
  // 2. Old file's startScreen content
  // 3. Template's exam screen HTML (slide-wrap structure)
  // 4. <script>
  // 5. Old file's data (EI, passages, Q, typeTag)
  // 6. Template's JS functions (from "let S=" onwards)

  const result = [];

  // Part 1: Template head through toast div, replacing title
  for (let i = 0; i <= tplStartScreenStart - 1; i++) {
    let line = templateLines[i];
    if (i === tplTitleLine) {
      line = `<title>${data.title}</title>`;
    }
    result.push(line);
  }

  // Part 2: Old file's startScreen content
  result.push(data.startContent);

  // Part 3: Template's exam screen structure (with slide-wrap)
  // We need to keep the template's exam structure but replace the topbar info
  // Extract topbar info from old startContent
  const topbarMatch = oldContent.match(/<div class="topbar-info">([^<]*<span>[^<]+<\/span>)<\/div>/);

  for (let i = tplExamScreenStart; i < tplScriptStart; i++) {
    let line = templateLines[i];
    if (topbarMatch && line.includes('topbar-info')) {
      line = line.replace(/<div class="topbar-info">[^<]*<span>[^<]+<\/span><\/div>/,
        `<div class="topbar-info">${topbarMatch[1]}</div>`);
    }
    result.push(line);
  }

  // Part 4: <script> + data
  result.push('<script>');
  result.push(data.ei);
  result.push('');
  if (data.passages.trim()) {
    result.push(data.passages);
    result.push('');
  }
  result.push(data.q);
  result.push('');
  if (data.typeTag) {
    result.push(data.typeTag);
  } else {
    // Use template typeTag
    result.push(templateLines.find(l => l.trim().startsWith("const typeTag=")));
  }
  result.push('');

  // Part 5: Template JS functions (from "let S=" to end)
  for (let i = tplDataEnd; i < templateLines.length; i++) {
    result.push(templateLines[i]);
  }

  const output = result.join('\n');
  fs.writeFileSync(filePath, output, 'utf-8');
  console.log(`  OK: ${path.relative(BASE, filePath)}`);
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────

// Problem 1: 수능특강 7강 (3 files)
console.log('\n=== 수능특강 7강 ===');
const gang7 = path.join(BASE, '부교재/수능특강/영어/7강');
['단어테스트.html', '워크북테스트.html', '퀴즈테스트.html'].forEach(f => {
  migrateFile(path.join(gang7, f));
});

// Problem 2: 고3 2025 3월 — 단어+워크북 (44 files)
console.log('\n=== 고3 3월 단어+워크북 ===');
const g3dir = path.join(BASE, '모의고사/고3/3월');
const folders = fs.readdirSync(g3dir).filter(f => fs.statSync(path.join(g3dir, f)).isDirectory());
folders.sort();

let count = 0;
folders.forEach(folder => {
  ['단어테스트.html', '워크북테스트.html'].forEach(f => {
    const fp = path.join(g3dir, folder, f);
    if (fs.existsSync(fp)) {
      if (migrateFile(fp)) count++;
    }
  });
});

console.log(`\nDone. Migrated ${count} 고3 files + 7강 files.`);
