#!/usr/bin/env node
/**
 * sync-rules.js — question-schema.json → CLAUDE.md 테스트 규칙 섹션 자동 동기화
 *
 * 사용법: node scripts/sync-rules.js
 *
 * question-schema.json이 유일한 진실 소스.
 * 이 스크립트가 CLAUDE.md의 테스트 규칙 섹션을 schema 기반으로 덮어씁니다.
 *
 * CLAUDE.md에 직접 규칙을 추가하면 다음 sync 시 덮어쓰기됩니다.
 * 규칙 추가/수정은 반드시 question-schema.json에서 하세요.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', 'validate', 'question-schema.json');
const CLAUDE_MD_PATH = path.join(require('os').homedir(), '.claude', 'CLAUDE.md');

const SECTION_START = '<!-- SYNC-RULES-START -->';
const SECTION_END = '<!-- SYNC-RULES-END -->';

function main() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  // ── 규칙 섹션 생성 ──
  const lines = [];
  lines.push(SECTION_START);
  lines.push('');
  lines.push('> **아래 섹션은 `question-schema.json`에서 자동 생성됩니다. 직접 수정하지 마세요.**');
  lines.push('> 규칙 추가/수정: `naesinfit-tests/validate/question-schema.json` → `node scripts/sync-rules.js`');
  lines.push('');

  // 1. 배점/문항 수
  lines.push('### 자동 생성 규칙 (schema 기준)');
  lines.push('');
  const g = schema.global;
  lines.push(`- 총 문항: ${g.totalQuestions}문항, 총점: ${g.totalScore}점`);
  for (const [diff, info] of Object.entries(g.diffDistribution)) {
    lines.push(`- ${diff}: ${info.count}문항 × ${info.pts}점 = ${info.count * info.pts}점`);
  }
  lines.push(`- ans: ${g.ansRules.indexed}, 최대 동일번호 ${g.ansRules.maxSameAns}개, 최대 연속 ${g.ansRules.maxConsecutive}개`);
  lines.push('');

  // 2. 모의고사 특수 규칙
  const mock = schema.sourceTypes?.['모의고사'];
  if (mock) {
    lines.push('### 모의고사 특수 규칙');
    lines.push('');
    if (mock.shortPassageRestrictions) {
      const nums = mock.shortPassageRestrictions.numbers.join(', ');
      const forbidden = mock.shortPassageRestrictions.forbidden.join(', ');
      lines.push(`- 짧은 지문(${nums}번): **${forbidden}** 금지`);
    }
    const excluded = Object.entries(mock.questionNumberTypeMap || {})
      .filter(([k, v]) => v.includes('제외'))
      .map(([k]) => k);
    if (excluded.length) {
      lines.push(`- 출제 제외 번호: ${excluded.join(', ')}번`);
    }
    lines.push('');
  }

  // 3. 유형별 passageRule + overlay
  lines.push('### 유형별 규칙');
  lines.push('');
  lines.push('| 유형 | passage | overlay | 비고 |');
  lines.push('|------|---------|---------|------|');
  for (const [type, info] of Object.entries(schema.questionTypes)) {
    const pRule = typeof info.passageRule === 'string'
      ? info.passageRule.slice(0, 40)
      : 'source별 상이';
    const overlay = (info.overlayRequired || '').slice(0, 40);
    const note = (info.stemRule || info.restriction || '').slice(0, 30);
    lines.push(`| ${type} | ${pRule} | ${overlay} | ${note} |`);
  }
  lines.push('');

  // 4. validate S급 규칙
  const vRules = schema.validateRules;
  if (vRules) {
    lines.push('### validate S급 차단 규칙');
    lines.push('');
    const sRules = vRules['S급 (즉시 차단)'] || vRules['S급'] || {};
    for (const [code, desc] of Object.entries(sRules)) {
      if (!code.startsWith('_')) {
        lines.push(`- **${code}**: ${desc}`);
      }
    }
    lines.push('');
  }

  // 5. 금지 목록
  if (g.forbidden) {
    lines.push('### 금지 목록');
    lines.push('');
    for (const item of g.forbidden) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  lines.push(SECTION_END);

  const newSection = lines.join('\n');

  // ── CLAUDE.md 업데이트 ──
  if (!fs.existsSync(CLAUDE_MD_PATH)) {
    console.log('⚠️ CLAUDE.md not found at', CLAUDE_MD_PATH);
    console.log('생성된 규칙 섹션:');
    console.log(newSection);
    return;
  }

  let md = fs.readFileSync(CLAUDE_MD_PATH, 'utf8');

  const startIdx = md.indexOf(SECTION_START);
  const endIdx = md.indexOf(SECTION_END);

  if (startIdx >= 0 && endIdx >= 0) {
    // 기존 섹션 교체
    md = md.slice(0, startIdx) + newSection + md.slice(endIdx + SECTION_END.length);
    console.log('✅ CLAUDE.md 기존 sync-rules 섹션 교체 완료');
  } else {
    // 섹션 마커가 없으면 "내신해방공식 테스트 작업 시" 앞에 삽입
    const insertBefore = '## 내신해방공식 테스트 작업 시';
    const insertIdx = md.indexOf(insertBefore);
    if (insertIdx >= 0) {
      md = md.slice(0, insertIdx) + newSection + '\n\n' + md.slice(insertIdx);
      console.log('✅ CLAUDE.md에 sync-rules 섹션 신규 삽입 완료');
    } else {
      md += '\n\n' + newSection;
      console.log('✅ CLAUDE.md 끝에 sync-rules 섹션 추가');
    }
  }

  fs.writeFileSync(CLAUDE_MD_PATH, md, 'utf8');

  // ── 검증: CLAUDE.md에 schema에 없는 규칙이 있는지 확인 ──
  const schemaTypes = new Set(Object.keys(schema.questionTypes));
  const mdTypes = [...md.matchAll(/유형["\s]*[:=]\s*["']([^"']+)["']/g)].map(m => m[1]);
  const unknown = mdTypes.filter(t => !schemaTypes.has(t));
  if (unknown.length) {
    console.log(`⚠️ CLAUDE.md에 schema에 없는 유형 참조: ${unknown.join(', ')}`);
  }

  console.log(`\n규칙 동기화 완료:`);
  console.log(`  - 유형: ${Object.keys(schema.questionTypes).length}개`);
  console.log(`  - S급 규칙: ${Object.keys(vRules?.['S급 (즉시 차단)'] || vRules?.['S급'] || {}).filter(k => !k.startsWith('_')).length}개`);
  console.log(`  - 금지 목록: ${g.forbidden.length}개`);
}

main();
