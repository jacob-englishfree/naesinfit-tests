#!/usr/bin/env node
/**
 * 내신핏 테스트 렌더링 검증 스크립트 v1
 *
 * Puppeteer(headless Chrome)로 실제 브라우저에서 테스트 HTML을 열고:
 *  R1. JS 콘솔 에러 감지 (빈 화면 원인)
 *  R2. HTML 태그 깨짐 (<u>, <b> 미닫힘/중첩)
 *  R3. 유니코드/특수문자 깨짐 (? □ 등)
 *  R4. 가로 스크롤 / overflow (전체 + 문항별)
 *  R5. 문항 렌더링 누락 (20문항 전부 표시되는지)
 *  R6. 결과 화면 렌더링 (제출 후 결과 표시)
 *  R7. 해설 영역 잘림/미표시
 *
 * 사용법:
 *   node render-test.js                    # 전체 검증
 *   node render-test.js --path 모의고사/고3/3월/20번  # 특정 폴더만
 *   node render-test.js --verbose          # 상세 출력
 *
 * 의존성: puppeteer (내신핏v21/node_modules에서 resolve)
 */

const puppeteer = require('/Users/woobumpark/Desktop/내신핏v21/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

const REPO = '/Users/woobumpark/Desktop/naesinfit-tests';
const VERBOSE = process.argv.includes('--verbose');
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;

// --path 옵션 파싱
let filterPath = null;
const pathIdx = process.argv.indexOf('--path');
if (pathIdx !== -1 && process.argv[pathIdx + 1]) {
  filterPath = process.argv[pathIdx + 1];
}

const issues = [];
let totalFiles = 0;
let passCount = 0;
let failCount = 0;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTML 파일 수집
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function collectTestFiles(baseDir) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/테스트\.html$/.test(entry.name)) {
        const rel = path.relative(REPO, full);
        if (!filterPath || rel.startsWith(filterPath)) {
          files.push({ abs: full, rel });
        }
      }
    }
  }
  walk(baseDir);
  return files;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 단일 파일 렌더링 검증
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testFile(browser, filePath, relPath) {
  totalFiles++;
  const fileIssues = [];
  let page;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });

    // ── R1: JS 콘솔 에러 감지 ──
    const jsErrors = [];
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });

    const fileUrl = 'file://' + filePath;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    if (jsErrors.length > 0) {
      fileIssues.push({
        check: 'R1', severity: 'S',
        msg: `JS 에러 ${jsErrors.length}건: ${jsErrors[0].substring(0, 100)}`,
      });
    }

    // ── R2: HTML 태그 깨짐 ──
    const tagIssues = await page.evaluate(() => {
      const problems = [];
      // 페이지 전체 HTML에서 닫히지 않은 태그 탐지
      const html = document.body.innerHTML;
      // <u>, <b>, <i> 태그의 열림/닫힘 카운트
      for (const tag of ['u', 'b', 'i']) {
        const openCount = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
        const closeCount = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
        if (openCount !== closeCount) {
          problems.push(`<${tag}> 열림=${openCount}, 닫힘=${closeCount}`);
        }
      }
      return problems;
    });
    if (tagIssues.length > 0) {
      fileIssues.push({
        check: 'R2', severity: 'A',
        msg: `태그 깨짐: ${tagIssues.join(', ')}`,
      });
    }

    // ── 시험 시작 (이름 입력 → startExam) ──
    await page.evaluate(() => {
      const inp = document.getElementById('inpName');
      if (inp) inp.value = '렌더링테스트';
    });
    await page.evaluate(() => {
      if (typeof startExam === 'function') startExam();
    });
    await page.waitForSelector('#examScreen.active', { timeout: 5000 }).catch(() => null);

    // JS 에러 재확인 (시험 시작 후)
    if (jsErrors.length > 0 && fileIssues.every(i => i.check !== 'R1')) {
      fileIssues.push({
        check: 'R1', severity: 'S',
        msg: `시험 시작 후 JS 에러: ${jsErrors[jsErrors.length - 1].substring(0, 100)}`,
      });
    }

    // ── R5: 문항 렌더링 누락 ──
    const qCardCount = await page.evaluate(() => {
      return document.querySelectorAll('.q-card').length;
    });
    const expectedQ = await page.evaluate(() => {
      return typeof Q !== 'undefined' ? Q.length : 20;
    });
    if (qCardCount === 0) {
      fileIssues.push({
        check: 'R5', severity: 'S',
        msg: `문항 렌더링 0개 (기대: ${expectedQ}개)`,
      });
    } else if (qCardCount < expectedQ) {
      fileIssues.push({
        check: 'R5', severity: 'A',
        msg: `문항 렌더링 ${qCardCount}개 / 기대 ${expectedQ}개`,
      });
    }

    // ── R3: 유니코드/특수문자 깨짐 ──
    if (qCardCount > 0) {
      const unicodeIssues = await page.evaluate(() => {
        const text = document.getElementById('examScreen')?.innerText || '';
        const problems = [];
        // 깨진 문자 패턴
        if (/\ufffd/.test(text)) problems.push('U+FFFD(대체문자) 발견');
        if (/â€[™""˜œ]/.test(text)) problems.push('UTF-8 이중인코딩 의심');
        if (/Ã[¢£¤¥¦§¨©]/.test(text)) problems.push('Latin-1 깨짐 패턴');
        // □ 문자 (의도적 체크박스 제외)
        const squares = (text.match(/□/g) || []).length;
        if (squares > 5) problems.push(`□ 문자 ${squares}개 (깨짐 의심)`);
        return problems;
      });
      if (unicodeIssues.length > 0) {
        fileIssues.push({
          check: 'R3', severity: 'A',
          msg: `유니코드 깨짐: ${unicodeIssues.join(', ')}`,
        });
      }
    }

    // ── R4: 가로 스크롤 / overflow ──
    if (qCardCount > 0) {
      const overflowIssues = await page.evaluate(() => {
        const problems = [];
        // 페이지 전체 가로 스크롤
        if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
          problems.push(`페이지 전체: scrollW=${document.documentElement.scrollWidth}, clientW=${document.documentElement.clientWidth}`);
        }
        // 문항별 overflow
        const cards = document.querySelectorAll('.q-card');
        cards.forEach((card, i) => {
          if (card.scrollWidth > card.clientWidth + 2) {
            problems.push(`Q${i + 1}: scrollW=${card.scrollWidth}, clientW=${card.clientWidth}`);
          }
          // 선택지 overflow
          card.querySelectorAll('.choice-btn').forEach((btn, ci) => {
            if (btn.scrollWidth > btn.clientWidth + 2) {
              problems.push(`Q${i + 1} 선지${ci + 1}: overflow ${btn.scrollWidth - btn.clientWidth}px`);
            }
          });
        });
        return problems;
      });
      if (overflowIssues.length > 0) {
        fileIssues.push({
          check: 'R4', severity: 'B',
          msg: `overflow ${overflowIssues.length}건: ${overflowIssues.slice(0, 3).join(' | ')}`,
        });
      }
    }

    // ── 전 문항 응답 → 제출 ──
    if (qCardCount > 0) {
      await page.evaluate(() => {
        // 모든 객관식 첫 번째 선택지 클릭, 서술형은 아무 값 입력
        if (typeof Q !== 'undefined') {
          for (let i = 0; i < Q.length; i++) {
            if (Q[i].fmt === 'mc' || Q[i].ch) {
              if (typeof sel === 'function') sel(i, 0);
            } else {
              // 서술형
              const inp = document.querySelector(`#wa_${i}`) ||
                          document.querySelector(`input[data-q="${i}"]`);
              if (inp) inp.value = 'test';
              // S.ans 배열 직접 설정
              if (typeof S !== 'undefined' && S.ans) S.ans[i] = 'test';
            }
          }
        }
      });

      // confirm 다이얼로그 자동 수락
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await page.evaluate(() => {
        if (typeof submitExam === 'function') submitExam();
      });

      // 결과 화면 대기
      await page.waitForSelector('#resultScreen.active', { timeout: 5000 }).catch(() => null);

      // ── R6: 결과 화면 렌더링 ──
      const resultVisible = await page.evaluate(() => {
        const rs = document.getElementById('resultScreen');
        return rs && rs.classList.contains('active') && rs.offsetHeight > 0;
      });
      if (!resultVisible) {
        fileIssues.push({
          check: 'R6', severity: 'A',
          msg: '결과 화면 미표시 (제출 후 resultScreen 안 보임)',
        });
      }

      // ── R7: 해설 영역 확인 ──
      if (resultVisible) {
        const detIssues = await page.evaluate(() => {
          const problems = [];
          const revCards = document.querySelectorAll('.rev-card');
          if (revCards.length === 0) {
            problems.push('해설 카드(.rev-card) 0개');
          } else {
            // 해설 영역이 높이 0인 경우
            let zeroHeight = 0;
            revCards.forEach((card) => {
              if (card.offsetHeight < 10) zeroHeight++;
            });
            if (zeroHeight > 0) {
              problems.push(`해설 카드 높이=0: ${zeroHeight}개`);
            }
          }
          // 결과 점수 표시 확인
          const score = document.querySelector('.r-score');
          if (!score || score.innerText.trim() === '') {
            problems.push('점수 표시(.r-score) 없음');
          }
          return problems;
        });
        if (detIssues.length > 0) {
          fileIssues.push({
            check: 'R7', severity: 'A',
            msg: `해설 문제: ${detIssues.join(', ')}`,
          });
        }
      }
    }

    // 최종 JS 에러 체크 (전체 과정)
    const postErrors = jsErrors.filter(e =>
      !e.includes('net::ERR_') && // 네트워크 에러 무시 (로컬 파일)
      !e.includes('favicon')
    );
    if (postErrors.length > 0 && fileIssues.every(i => i.check !== 'R1')) {
      fileIssues.push({
        check: 'R1', severity: 'S',
        msg: `JS 에러 ${postErrors.length}건: ${postErrors[0].substring(0, 100)}`,
      });
    }

  } catch (e) {
    fileIssues.push({
      check: 'R0', severity: 'S',
      msg: `Puppeteer 실행 오류: ${e.message.substring(0, 120)}`,
    });
  } finally {
    if (page) await page.close().catch(() => {});
  }

  // 결과 집계
  if (fileIssues.length === 0) {
    passCount++;
    if (VERBOSE) console.log(`  ✅ ${relPath}`);
  } else {
    failCount++;
    fileIssues.forEach(i => {
      issues.push({ file: relPath, ...i });
    });
    if (VERBOSE) {
      console.log(`  ❌ ${relPath}`);
      fileIssues.forEach(i => console.log(`     [${i.check}/${i.severity}] ${i.msg}`));
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function main() {
  console.log('🖥️  내신핏 렌더링 검증 v1 (Puppeteer)\n');

  // 교과서 + 모의고사 + 수능특강 모두 수집
  const testFiles = [];
  for (const dir of ['교과서', '모의고사', '수능특강']) {
    const target = path.join(REPO, dir);
    if (fs.existsSync(target)) {
      testFiles.push(...collectTestFiles(target));
    }
  }

  if (testFiles.length === 0) {
    console.log('⚠️  검증 대상 파일 없음');
    if (filterPath) console.log(`   --path "${filterPath}" 필터 적용됨`);
    process.exit(0);
  }

  console.log(`📁 대상 파일: ${testFiles.length}개\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  // 병렬 처리 (동시 3개 탭)
  const CONCURRENCY = 3;
  for (let i = 0; i < testFiles.length; i += CONCURRENCY) {
    const batch = testFiles.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(f => testFile(browser, f.abs, f.rel)));

    // 진행률 표시 (10파일마다)
    if (!VERBOSE && (i + CONCURRENCY) % 10 < CONCURRENCY) {
      const done = Math.min(i + CONCURRENCY, testFiles.length);
      process.stdout.write(`\r  진행: ${done}/${testFiles.length}`);
    }
  }

  await browser.close();

  if (!VERBOSE) process.stdout.write('\r');

  // ━━━ 리포트 ━━━
  console.log('\n' + '='.repeat(80));
  console.log('🖥️  렌더링 검증 결과');
  console.log('='.repeat(80));
  console.log(`파일: ${totalFiles}개  |  ✅ 통과: ${passCount}개  |  ❌ 실패: ${failCount}개`);

  const sIssues = issues.filter(i => i.severity === 'S');
  const aIssues = issues.filter(i => i.severity === 'A');
  const bIssues = issues.filter(i => i.severity === 'B');

  console.log(`🔴 S등급 (치명): ${sIssues.length}건`);
  console.log(`🟠 A등급 (중요): ${aIssues.length}건`);
  console.log(`🟡 B등급 (경미): ${bIssues.length}건`);

  function printGroup(label, items, max) {
    if (items.length === 0) return;
    console.log(`\n─── ${label} ───`);
    const cats = {};
    items.forEach(e => {
      if (!cats[e.check]) cats[e.check] = [];
      cats[e.check].push(e);
    });
    Object.entries(cats).sort((a, b) => b[1].length - a[1].length).forEach(([check, list]) => {
      console.log(`\n  [${check}] (${list.length}건)`);
      list.slice(0, max).forEach(e => {
        console.log(`    ${e.file}`);
        console.log(`      → ${e.msg}`);
      });
      if (list.length > max) console.log(`    ... 외 ${list.length - max}건`);
    });
  }

  printGroup('🔴 S등급 (치명)', sIssues, 20);
  printGroup('🟠 A등급 (중요)', aIssues, 15);
  printGroup('🟡 B등급 (경미)', bIssues, 10);

  // JSON 리포트 저장
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles, passCount, failCount,
    issues: { S: sIssues, A: aIssues, B: bIssues },
  };
  fs.writeFileSync(
    path.join(REPO, 'render-report.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('\n📄 render-report.json 저장 완료');

  process.exit(sIssues.length > 0 ? 2 : failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('❌ 실행 오류:', e.message);
  process.exit(2);
});
