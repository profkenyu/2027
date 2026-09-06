import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (request.url === '/external') {
    response.end('<a href="/index.html?test&quality=low">Enter</a>');
    return;
  }
  try { response.end(await readFile('index.html')); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({channel: 'chrome', headless: true});
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const entry of ['direct', 'external']) {
    const context = await browser.newContext(entry === 'external'
      ? {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}
      : {viewport: {width: 1400, height: 1000}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    if (entry === 'external') {
      await page.goto(`${base}/external`);
      await page.getByRole('link', {name: 'Enter'}).click();
    } else await page.goto(`${base}/index.html?test`);
    await page.waitForFunction(() => window.TI_READY === true, null, {timeout: 60000});
    const cold = await page.evaluate(() => ({ready: window.TI_READY, gpu: !!navigator.gpu}));
    await page.reload({waitUntil: 'load'});
    await page.waitForFunction(() => window.TI_READY === true, null, {timeout: 60000});
    if (errors.length) throw Error(errors.join('\n'));
    console.log({entry, cold, reload: 'pass', errors: 0});
    await context.close();
  }
} finally {
  await browser?.close();
  server.close();
}
