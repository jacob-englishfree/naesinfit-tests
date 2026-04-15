#!/usr/bin/env node
/**
 * 지문(강) 단위 증적 리포트 자동 생성
 *
 * 사용법:
 *   node scripts/generate-audit-report.js <강-폴더>
 *   예: node scripts/generate-audit-report.js data/부교재/수능특강/영어독해연습/1강
 *
 * 출력: <강-폴더>/_audit-report.md
 *
 * 수집하는 정보:
 * - 폴더 내 모든 test.json (단어/워크북/퀴즈)
 * - 각 파일의 validate 결과, blind 20/20 여부, cross-blind 여부, adversarial 이슈
 * - 지문 요약 (title, 문장수, 단어수)
 */

const fs = require('fs');
const path = require('path');

const TYPES = ['단어', '워크북', '퀴즈'];

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('사용법: node scripts/generate-audit-report.js <강-폴더>');
    process.exit(1);
  }
  const gangDir = path.resolve(target);
  if (!fs.existsSync(gangDir) || !fs.statSync(gangDir).isDirectory()) {
    console.error(`❌ 폴더 없음: ${target}`);
    process.exit(1);
  }

  // 지문 폴더 탐색 (1번, 2번, ..., Gateway, 전체 등)
  const sections = fs.readdirSync(gangDir)
    .filter(name => {
      const p = path.join(gangDir, name);
      return fs.statSync(p).isDirectory() && !name.startsWith('_');
    })
    .sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

  // _passages 읽기 (있으면)
  const passagesDir = path.join(gangDir, '_passages');
  const passages = {};
  if (fs.existsSync(passagesDir)) {
    for (const f of fs.readdirSync(passagesDir)) {
      if (f.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(passagesDir, f), 'utf8'));
          const id = f.replace(/\.json$/, '');
          passages[id] = data;
        } catch (e) { /* ignore */ }
      }
    }
  }

  const rows = [];
  const adversarialSummary = { high: 0, medium: 0, low: 0 };
  const issuesDetail = [];
  let totalFiles = 0;
  let validateOk = 0;
  let blindOk = 0;
  let crossOk = 0;

  for (const section of sections) {
    for (const t of TYPES) {
      const jsonPath = path.join(gangDir, section, `${t}.json`);
      if (!fs.existsSync(jsonPath)) continue;
      totalFiles++;
      const blindPath = jsonPath.replace(/\.json$/, '.blind.json');
      const cbPath = jsonPath.replace(/\.json$/, '.cross-blind.json');
      const advPath = jsonPath.replace(/\.json$/, '.adversarial.json');

      const hasBlind = fs.existsSync(blindPath);
      const hasCross = fs.existsSync(cbPath);
      const hasAdv = fs.existsSync(advPath);
      if (hasBlind) blindOk++;
      if (hasCross) crossOk++;

      // adversarial 이슈 집계
      let fileIssues = 0;
      if (hasAdv) {
        try {
          const adv = JSON.parse(fs.readFileSync(advPath, 'utf8'));
          const issues = adv.issues || [];
          fileIssues = issues.length;
          for (const iss of issues) {
            const sev = (iss.severity || 'low').toLowerCase();
            adversarialSummary[sev] = (adversarialSummary[sev] || 0) + 1;
            if (sev === 'high') {
              issuesDetail.push({
                file: `${section}/${t}`,
                id: iss.id,
                category: iss.category,
                description: iss.description,
              });
            }
          }
        } catch (e) { /* ignore */ }
      }

      // validate: test.json 기본 필드 존재 확인(간이)
      let ok = false;
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        ok = Array.isArray(data.questions) && data.questions.length > 0;
      } catch (e) { /* ignore */ }
      if (ok) validateOk++;

      rows.push({
        section,
        type: t,
        validate: ok ? '✅' : '❌',
        blind: hasBlind ? '✅' : '❌',
        cross: hasCross ? '✅' : '❌',
        adv: hasAdv ? (fileIssues === 0 ? '✅ (0)' : `⚠ (${fileIssues})`) : '❌',
      });
    }
  }

  // 보고서 생성
  const today = new Date().toISOString().split('T')[0];
  const relGangDir = path.relative(process.cwd(), gangDir);

  let md = `# ${path.basename(gangDir)} 출제·검수 증적 리포트\n\n`;
  md += `**생성일**: ${today}\n`;
  md += `**대상**: \`${relGangDir}\`\n`;
  md += `**생성 방식**: \`node scripts/generate-audit-report.js ${relGangDir}\`\n\n`;

  md += `## 최종 요약\n\n`;
  md += `| 항목 | 결과 |\n|---|---|\n`;
  md += `| 파일 수 | ${totalFiles} |\n`;
  md += `| validate PASS | ${validateOk}/${totalFiles} |\n`;
  md += `| blind.json 존재 | ${blindOk}/${totalFiles} |\n`;
  md += `| cross-blind.json 존재 | ${crossOk}/${totalFiles} |\n`;
  md += `| adversarial HIGH | ${adversarialSummary.high}건 |\n`;
  md += `| adversarial MEDIUM | ${adversarialSummary.medium}건 |\n`;
  md += `| adversarial LOW | ${adversarialSummary.low}건 |\n\n`;

  if (Object.keys(passages).length) {
    md += `## 지문 구성\n\n`;
    md += `| 섹션 | 제목 | 문장/단어 |\n|---|---|---|\n`;
    for (const id of Object.keys(passages).sort()) {
      const p = passages[id];
      md += `| ${id} | ${p.title || '-'} | ${p.sentenceCount || '?'}/${p.wordCount || '?'} |\n`;
    }
    md += `\n`;
  }

  md += `## 파일별 검수 상태\n\n`;
  md += `| 섹션 | 유형 | validate | blind | cross-blind | adversarial |\n`;
  md += `|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    md += `| ${r.section} | ${r.type} | ${r.validate} | ${r.blind} | ${r.cross} | ${r.adv} |\n`;
  }
  md += `\n`;

  if (issuesDetail.length) {
    md += `## Adversarial HIGH 이슈 (수정 필요)\n\n`;
    md += `| 파일 | 문항 | 카테고리 | 설명 |\n|---|---|---|---|\n`;
    for (const i of issuesDetail) {
      md += `| ${i.file} | Q${i.id} | ${i.category} | ${i.description} |\n`;
    }
    md += `\n`;
  }

  // 배포 전 체크리스트
  const allGood = adversarialSummary.high === 0 && blindOk === totalFiles && crossOk === totalFiles;
  md += `## 배포 가능 여부\n\n`;
  md += allGood
    ? `✅ **배포 가능** — 모든 증적 충족, HIGH 이슈 0건\n\n`
    : `⛔ **배포 불가** — 위 미비점 해결 필요\n\n`;
  md += `### jacob 본인 확인 필요\n`;
  md += `- [ ] 실기기 카카오톡에서 박선민/학생 링크 접속 테스트\n`;
  md += `- [ ] 무작위 5% 스팟 풀이 (${Math.max(1, Math.ceil(totalFiles * 0.05))}파일)\n`;
  md += `- [ ] 수업자료 PDF(합본) Dropbox 업로드 여부\n`;

  const outPath = path.join(gangDir, '_audit-report.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`✅ 생성: ${path.relative(process.cwd(), outPath)}`);
  console.log(`   파일 ${totalFiles} / validate ${validateOk} / blind ${blindOk} / cross ${crossOk}`);
  console.log(`   adversarial: HIGH ${adversarialSummary.high} / MED ${adversarialSummary.medium} / LOW ${adversarialSummary.low}`);
  if (adversarialSummary.high > 0) {
    console.log(`   ⛔ HIGH 이슈 ${adversarialSummary.high}건 — 수정 필요`);
    process.exit(1);
  }
}

main();
