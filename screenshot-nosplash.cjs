const puppeteer = require('puppeteer');
const { mkdirSync } = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || 'nosplash';
const scrollY = parseInt(process.argv[4] || '0');
const dir = path.join(__dirname, 'temporary screenshots');
mkdirSync(dir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  // Hide splash overlay
  await page.evaluate(() => {
    var s = document.getElementById('splash-overlay');
    if (s) s.style.display = 'none';
  });
  if (scrollY > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await new Promise(r => setTimeout(r, 1000));
  }
  await page.screenshot({ path: path.join(dir, label + '.png') });
  await browser.close();
  console.log('Done: ' + label);
})();
