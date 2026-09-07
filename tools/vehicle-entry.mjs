import { chromium } from 'playwright';
import { startPreviewServer } from "./lib/preview-server.mjs";
const server = await startPreviewServer({ routes: { "/external": '<link rel="icon" href="data:,"><a href="/index.html?test&quality=low">Enter</a>' } });
async function requireArtwork(page) {
  await page.waitForFunction(() => window.TI_READY === true && (
    document.getElementById('fh-gate') || document.getElementById('fh-fatal') ||
    (window.TI_WORLD && typeof window.TI_CAMERA === 'function' && window.TI_BLUEPRINT?.().models)
  ), null, {timeout: 60000});
  const state = await page.evaluate(() => ({
    ready: window.TI_READY,
    gate: document.getElementById("fh-gate")?.textContent.trim() ?? null,
    fatal: document.getElementById("fh-fatal")?.textContent.trim() ?? null,
    world: window.TI_WORLD ?? null,
    camera: typeof window.TI_CAMERA === "function",
    models: !!window.TI_BLUEPRINT?.().models
  }));
  if (state.gate || state.fatal || !state.world || !state.camera || !state.models) {
    throw new Error(`Artwork did not initialize: ${JSON.stringify(state)}`);
  }
  return state;
}

let browser;
try {
  browser = await chromium.launch({channel: 'chrome', headless: true});
  const base = server.url;
  const unsupportedContext = await browser.newContext();
  try {
    await unsupportedContext.addInitScript(() => Object.defineProperty(navigator, "gpu", {value: undefined}));
    const blocked = await unsupportedContext.newPage();
    await blocked.goto(`${base}/index.html?test`);
    let rejected = false;
    try { await requireArtwork(blocked); }
    catch (error) {
      if (!String(error).includes("WEBGPU UNAVAILABLE")) throw error;
      rejected = true;
    }
    if (!rejected) throw new Error("Unsupported page was accepted as the artwork");
    console.log({unsupportedGate: "correctly rejected"});
  } finally { await unsupportedContext.close(); }
  for (const entry of ['direct', 'external']) {
    const context = await browser.newContext(entry === 'external'
      ? {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}
      : {viewport: {width: 1400, height: 1000}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    if (entry === 'external') {
      await page.goto(`${base}/external`);
      await page.getByRole('link', {name: 'Enter'}).click();
    } else await page.goto(`${base}/index.html?test`);
    const cold = await requireArtwork(page);
    await page.reload({waitUntil: 'load'});
    await requireArtwork(page);
    if (errors.length) throw Error(errors.join('\n'));
    console.log({entry, cold, reload: 'pass', errors: 0});
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
