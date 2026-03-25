#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — validate-render.js
 * Layer ④: 렌더링 검증
 *
 * Puppeteer로 빌드된 HTML을 모바일 뷰포트에서 열고:
 * R1: 페이지 로드 성공
 * R2: JS 에러 없음
 * R3: 시작화면 렌더링 (제목, 시작 버튼)
 * R4: 문항 전환 작동
 * R5: 선지/입력 필드 존재
 * R6: 글자 잘림/overflow 없음
 * R7: 결과화면 도달 가능
 *
 * Usage: node validate/validate-render.js dist/.../단어테스트.html
 *        node validate/validate-render.js --all
 *        node validate/validate-render.js --all --screenshot
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const SCREENSHOT_DIR = path.join(ROOT, 'validate', 'screenshots');

const SEV = { S: 'S', A: 'A', B: 'B', C: 'C' };

class RenderResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.errors = [];
    this.warnings = [];
    this.screenshots = [];
  }
  add(id, sev, msg) {
    const entry = { id, sev, msg };
    if (sev === SEV.S || sev === SEV.A) this.errors.push(entry);
    else this.warnings.push(entry);
  }
  get pass() { return this.errors.length === 0; }
}

async function validateRender(htmlPath, opts = {}) {
  const result = new RenderResult(htmlPath);
  const takeScreenshots = opts.screenshot || false;

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    result.add('R-DEP', SEV.C, 'puppeteer not installed — render validation skipped. Install: npm i -g puppeteer');
    return result;
  }

  if (!fs.existsSync(htmlPath)) {
    result.add('R-FILE', SEV.S, `HTML file not found: ${htmlPath}`);
    return result;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Mobile viewport (iPhone SE size — smallest common device)
    await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });

    // Collect JS errors
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') jsErrors.push(msg.text());
    });

    // ── R1: Page load ──
    const fileUrl = `file://${path.resolve(htmlPath)}`;
    try {
      await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    } catch (e) {
      result.add('R1', SEV.S, `페이지 로드 실패: ${e.message}`);
      await browser.close();
      return result;
    }

    // Wait for any animations
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    // ── R2: JS errors ──
    if (jsErrors.length > 0) {
      result.add('R2', SEV.S, `JS 에러 ${jsErrors.length}개: ${jsErrors[0].substring(0, 100)}`);
    }

    // ── R3: Start screen elements ──
    const startScreen = await page.evaluate(() => {
      // Check for title element
      const title = document.querySelector('.title, .test-title, h1, h2');
      const startBtn = document.querySelector('button, .start-btn, .btn-start, [onclick]');
      const body = document.body;
      return {
        hasTitle: !!title,
        titleText: title ? title.textContent.trim().substring(0, 50) : '',
        hasStartBtn: !!startBtn,
        startBtnText: startBtn ? startBtn.textContent.trim() : '',
        bodyEmpty: body.textContent.trim().length < 10,
        bodyHeight: body.scrollHeight
      };
    });

    if (startScreen.bodyEmpty) {
      result.add('R3', SEV.S, '시작화면 빈 화면 — 콘텐츠 없음');
    }
    if (!startScreen.hasTitle) {
      result.add('R3', SEV.A, '시작화면에 제목 요소 없음');
    }
    if (!startScreen.hasStartBtn) {
      result.add('R3', SEV.A, '시작화면에 시작 버튼 없음');
    }

    // Take start screen screenshot
    if (takeScreenshots) {
      const ssDir = path.join(SCREENSHOT_DIR, path.relative(DIST_DIR, path.dirname(htmlPath)));
      fs.mkdirSync(ssDir, { recursive: true });
      const ssPath = path.join(ssDir, path.basename(htmlPath, '.html') + '_start.png');
      await page.screenshot({ path: ssPath, fullPage: false });
      result.screenshots.push(ssPath);
    }

    // ── R4: Enter name and start exam ──
    try {
      // Fill in name field
      const hasNameField = await page.evaluate(() => {
        const inp = document.getElementById('inpName');
        if (inp) { inp.value = 'RenderTest'; return true; }
        return false;
      });

      if (!hasNameField) {
        result.add('R4', SEV.A, '이름 입력 필드(inpName) 없음');
      }

      // Click start button
      const started = await page.evaluate(() => {
        // Override confirm to auto-accept
        window.confirm = () => true;
        // Try startExam function directly
        if (typeof startExam === 'function') {
          startExam();
          return true;
        }
        // Fallback: click button
        const btns = Array.from(document.querySelectorAll('button'));
        const startBtn = btns.find(b => /시작|START|시험/i.test(b.textContent));
        if (startBtn) { startBtn.click(); return true; }
        return false;
      });

      if (!started) {
        result.add('R4', SEV.S, '시험 시작 불가 — startExam 함수 없음');
      } else {
        await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

        // ── R5: Full playthrough — Q1~Q20 ──
        const totalQ = await page.evaluate(() => typeof EI !== 'undefined' ? EI.totalQ : 0);

        if (totalQ === 0) {
          result.add('R5', SEV.S, 'EI.totalQ가 0 — 문항 데이터 없음');
        } else {
          let stuckAt = -1;

          for (let qi = 0; qi < totalQ; qi++) {
            // Check current question rendered
            const qState = await page.evaluate((idx) => {
              const passage = document.getElementById('slidePassage');
              const bottom = document.getElementById('slideBottom');
              const choiceBtns = document.querySelectorAll('.choice-btn');
              const writtenInput = document.querySelector('.written-input');

              return {
                hasPassage: !!passage && passage.innerHTML.length > 10,
                hasBottom: !!bottom && bottom.innerHTML.length > 10,
                choiceCount: choiceBtns.length,
                hasWrittenInput: !!writtenInput,
                passageLen: passage ? passage.innerHTML.length : 0,
                curIdx: typeof S !== 'undefined' ? S.cur : -1
              };
            }, qi);

            if (!qState.hasPassage && !qState.hasBottom) {
              stuckAt = qi + 1;
              result.add('R5', SEV.S, `Q${qi + 1}: 문항 렌더링 실패 — 빈 화면`);
              break;
            }

            // Answer the question
            if (qState.choiceCount > 0) {
              // MC: click first choice
              await page.evaluate((idx) => {
                if (typeof selectAns === 'function') selectAns(idx, 0);
              }, qi);
            } else if (qState.hasWrittenInput) {
              // Written: type answer
              await page.evaluate((idx) => {
                if (typeof writeAns === 'function') writeAns(idx, 'test');
              }, qi);
            } else {
              result.add('R5', SEV.B, `Q${qi + 1}: 선지도 입력필드도 없음`);
            }

            await page.evaluate(() => new Promise(r => setTimeout(r, 100)));

            // Navigate to next (selectAns auto-advances for MC, manual for written)
            if (qi < totalQ - 1 && qState.hasWrittenInput) {
              await page.evaluate(() => {
                if (typeof navQ === 'function') navQ(1);
              });
              await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
            }

            // Take screenshot of middle question
            if (takeScreenshots && qi === Math.floor(totalQ / 2)) {
              const ssDir = path.join(SCREENSHOT_DIR, path.relative(DIST_DIR, path.dirname(htmlPath)));
              fs.mkdirSync(ssDir, { recursive: true });
              const ssPath = path.join(ssDir, path.basename(htmlPath, '.html') + `_q${qi + 1}.png`);
              await page.screenshot({ path: ssPath, fullPage: false });
              result.screenshots.push(ssPath);
            }
          }

          if (stuckAt === -1) {
            // ── R6: Overflow check on last question ──
            const overflowCheck = await page.evaluate(() => {
              const allElements = document.querySelectorAll('*');
              let overflowCount = 0;
              for (const el of allElements) {
                if (el.scrollWidth > el.clientWidth + 5 && el.clientWidth > 0) {
                  const style = window.getComputedStyle(el);
                  if (style.overflow !== 'hidden' && style.overflowX !== 'hidden' &&
                      style.overflow !== 'scroll' && style.overflowX !== 'scroll') {
                    overflowCount++;
                  }
                }
              }
              return { overflowCount };
            });

            if (overflowCheck.overflowCount > 3) {
              result.add('R6', SEV.A,
                `가로 스크롤(overflow) ${overflowCheck.overflowCount}개 요소 — 모바일 깨짐`);
            }

            // ── R7: Submit and check result screen ──
            try {
              await page.evaluate(() => {
                if (typeof submitExam === 'function') submitExam();
              });
              await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

              const resultScreen = await page.evaluate(() => {
                const rs = document.getElementById('resultScreen');
                if (!rs) return { exists: false };
                const visible = rs.style.display !== 'none' && rs.offsetHeight > 0;
                const hasScore = rs.textContent.includes('점') || rs.textContent.includes('score');
                return { exists: true, visible, hasScore, textLen: rs.textContent.length };
              });

              if (!resultScreen.exists) {
                result.add('R7', SEV.S, '결과화면(resultScreen) 요소 없음');
              } else if (!resultScreen.visible) {
                result.add('R7', SEV.A, '결과화면이 표시되지 않음 (display:none)');
              } else if (resultScreen.textLen < 20) {
                result.add('R7', SEV.A, '결과화면 콘텐츠 비어있음');
              }

              // Take result screenshot
              if (takeScreenshots) {
                const ssDir = path.join(SCREENSHOT_DIR, path.relative(DIST_DIR, path.dirname(htmlPath)));
                const ssPath = path.join(ssDir, path.basename(htmlPath, '.html') + '_result.png');
                await page.screenshot({ path: ssPath, fullPage: false });
                result.screenshots.push(ssPath);
              }
            } catch (e) {
              result.add('R7', SEV.A, `결과화면 전환 실패: ${e.message.substring(0, 100)}`);
            }
          }
        }
      }
    } catch (e) {
      result.add('R4', SEV.S, `플레이스루 실패: ${e.message.substring(0, 200)}`);
    }

  } catch (e) {
    result.add('R-ERR', SEV.S, `Puppeteer error: ${e.message.substring(0, 200)}`);
  } finally {
    if (browser) await browser.close();
  }

  return result;
}

// ── CLI ──
function findHtmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findHtmlFiles(full));
    } else if (entry.name.endsWith('.html') && entry.name.includes('테스트')) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const takeScreenshots = args.includes('--screenshot');
  const filteredArgs = args.filter(a => a !== '--screenshot');

  if (filteredArgs.length === 0) {
    console.error('Usage: node validate/validate-render.js <html-file>');
    console.error('       node validate/validate-render.js --all [--screenshot]');
    process.exit(1);
  }

  // Check puppeteer
  try {
    require('puppeteer');
  } catch (e) {
    console.log('[SKIP] puppeteer not installed — render validation disabled');
    console.log('Install: npm i -g puppeteer');
    process.exit(0);
  }

  let files = [];
  if (filteredArgs[0] === '--all') {
    files = findHtmlFiles(DIST_DIR);
    if (files.length === 0) {
      console.log('No HTML test files found in dist/');
      process.exit(0);
    }
    console.log(`Found ${files.length} HTML files to validate`);
  } else {
    files = [path.resolve(filteredArgs[0])];
  }

  if (takeScreenshots) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  let totalPass = 0, totalFail = 0;
  for (const f of files) {
    const result = await validateRender(f, { screenshot: takeScreenshots });
    const rel = path.relative(ROOT, f);

    if (result.pass) {
      totalPass++;
      const wc = result.warnings.length;
      if (wc > 0) {
        console.log(`[PASS] ${rel} (${wc} warnings)`);
      } else {
        console.log(`[PASS] ${rel}`);
      }
    } else {
      totalFail++;
      console.log(`[FAIL] ${rel} (${result.errors.length} issues)`);
      result.errors.forEach(e => console.log(`  [${e.sev}] ${e.id}: ${e.msg}`));
    }

    result.warnings.forEach(w => console.log(`  [${w.sev}] ${w.id}: ${w.msg}`));
  }

  if (files.length > 1) {
    console.log(`\n--- Render Validation Summary ---`);
    console.log(`Total: ${files.length} | PASS: ${totalPass} | FAIL: ${totalFail}`);
    if (takeScreenshots) {
      console.log(`Screenshots: ${SCREENSHOT_DIR}`);
    }
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

module.exports = { validateRender };
if (require.main === module) main();
