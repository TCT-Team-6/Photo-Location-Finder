import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/repl/tools/bin/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({viewport: {width:1500,height:1500}});
  page.on('console', message => {
    if (message.text().startsWith('[3D]') || message.type() === 'error') console.log(message.text());
  });
  page.on('pageerror', error => console.error(error.message));
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/?instrument-kit=export`);
  await page.waitForFunction(() => document.querySelectorAll('[data-instrument-kind][data-rendered="true"]').length >= 12, {timeout:60000});
  await page.evaluate(() => document.fonts.ready);
  const frames = await page.evaluate(() => window.InstrumentKitExport());
  await writeFile('/tmp/instrument-renders.json', JSON.stringify(frames));
  console.log(`Exported ${frames.length} rendered instrument frames.`);
} finally {
  await browser.close();
}
