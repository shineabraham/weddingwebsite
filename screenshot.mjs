const puppeteer = require('puppeteer');
const { mkdirSync, readdirSync } = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';
const dir = path.join(__dirname, 'temporary screenshots');
mkdirSync(dir, { recursive: true });

const existing = readdirSync(dir).filter(f => f.startsWith('screenshot-'));
const num = existing.length + 1;
const filename = label ? `screenshot-${num}-${label}.png` : `screenshot-${num}.png`;

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: path.join(dir, filename), fullPage: true });
  await browser.close();
  console.log('Screenshot saved: ' + path.join(dir, filename));
})();
