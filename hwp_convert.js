const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const INPUT_DIR = '/tmp/rp_check';
const OUTPUT_DIR = '/tmp/rp_check/pdf';

async function convertOne(browser, filePath, outputName) {
  const page = await browser.newPage();
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: OUTPUT_DIR
  });

  console.log(`  > 사이트 로딩...`);
  await page.goto('https://products.aspose.app/words/conversion/hwp-to-pdf', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // 파일 input 찾기
  const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
  console.log(`  > 파일 업로드: ${path.basename(filePath)}`);
  await fileInput.uploadFile(filePath);

  // 업로드 후 convert 버튼 대기
  console.log(`  > 업로드 처리 대기...`);
  await new Promise(r => setTimeout(r, 3000));

  // Convert 버튼 찾아서 클릭
  try {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, a')];
      const convertBtn = btns.find(b => /convert/i.test(b.textContent) && !/login|sign/i.test(b.textContent));
      if (convertBtn) convertBtn.click();
    });
    console.log(`  > Convert 클릭됨`);
  } catch (e) {
    console.log(`  > Convert 버튼 클릭 실패`);
  }

  // 변환 완료 + 다운로드 링크 대기
  console.log(`  > 변환 대기...`);
  await new Promise(r => setTimeout(r, 20000));

  // 다운로드 버튼 찾기
  try {
    const downloadBtn = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('a, button')];
      return btns.find(b => /download/i.test(b.textContent)) || null;
    });
    if (downloadBtn) {
      await downloadBtn.click();
      console.log(`  > Download 클릭됨`);
      await new Promise(r => setTimeout(r, 10000));
    }
  } catch (e) {
    console.log(`  > 다운로드 실패`);
  }

  await page.close();
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.hwp')).sort();
  console.log(`변환할 파일: ${files.length}개\n`);

  // 테스트용으로 1개만 먼저
  const testFile = files[0];

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  console.log(`[테스트] ${testFile}`);
  await convertOne(browser, path.join(INPUT_DIR, testFile), testFile.replace('.hwp','.pdf'));

  console.log('\n대기중 (20초)... 브라우저에서 실제 결과 확인');
  await new Promise(r => setTimeout(r, 20000));

  await browser.close();

  const downloaded = fs.readdirSync(OUTPUT_DIR);
  console.log(`\n다운로드된 파일: ${downloaded.length}개`);
  downloaded.forEach(f => console.log(' ', f));
}

main().catch(e => { console.error(e); process.exit(1); });
