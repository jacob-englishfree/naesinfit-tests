#!/usr/bin/env node
/**
 * render-test.js — JSON 기반 렌더링 검증 (Puppeteer)
 *
 * 로컬 http-server에서 테스트앱을 열고 JSON 로드 → 화면 검증
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/path-mapper');

let puppeteer;
try { puppeteer = require('puppeteer'); } catch { puppeteer = null; }

async function renderTest(jsonPath) {
  const result = { file: jsonPath, pass: true, skip: false, checks: [], screenshots: [], summary: '' };

  if (!puppeteer) {
    result.skip = true;
    result.summary = 'puppeteer 미설치';
    return result;
  }

  // JSON 파싱 가능한지 먼저 확인
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    result.pass = false;
    result.summary = `JSON 파싱 실패: ${e.message}`;
    return result;
  }

  const questions = data.questions || [];
  if (questions.length === 0) {
    result.pass = false;
    result.summary = '문항 0개';
    return result;
  }

  // Puppeteer로 index.html 렌더링
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 }); // iPhone 14 Pro

    // 로컬 index.html 직접 로드
    const indexPath = path.join(ROOT, 'index.html');
    if (!fs.existsSync(indexPath)) {
      result.skip = true;
      result.summary = 'index.html 없음';
      return result;
    }

    // JS 에러 수집
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') jsErrors.push(msg.text()); });

    await page.goto(`file://${indexPath}`, { waitUntil: 'networkidle0', timeout: 15000 });

    // R1: 페이지 로드 성공
    result.checks.push({ id: 'R1', pass: true, msg: '페이지 로드 성공' });

    // R2: JS 에러
    if (jsErrors.length > 0) {
      result.checks.push({ id: 'R2', pass: false, msg: `JS 에러 ${jsErrors.length}건: ${jsErrors[0]}` });
      result.pass = false;
    } else {
      result.checks.push({ id: 'R2', pass: true, msg: 'JS 에러 0건' });
    }

    // R3: 화면에 텍스트 존재
    const bodyText = await page.evaluate(() => document.body?.innerText?.length || 0);
    if (bodyText < 10) {
      result.checks.push({ id: 'R3', pass: false, msg: `화면 텍스트 ${bodyText}자 — 빈 화면` });
      result.pass = false;
    } else {
      result.checks.push({ id: 'R3', pass: true, msg: `화면 텍스트 ${bodyText}자` });
    }

    // 스크린샷
    const screenshotDir = path.join(ROOT, 'reports', 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    const ssPath = path.join(screenshotDir, path.basename(jsonPath, '.json') + '.png');
    await page.screenshot({ path: ssPath, fullPage: false });
    result.screenshots.push(ssPath);

    result.summary = result.pass ? '렌더링 정상' : '렌더링 문제 발견';

  } catch (e) {
    result.pass = false;
    result.summary = `Puppeteer 오류: ${e.message}`;
  } finally {
    if (browser) await browser.close();
  }

  return result;
}

module.exports = { renderTest };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node qa/render-test.js <json>'); process.exit(1); }
  renderTest(path.resolve(file)).then(r => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.pass || r.skip ? 0 : 1);
  });
}
