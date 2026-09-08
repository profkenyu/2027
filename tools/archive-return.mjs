import { chromium } from 'playwright';
import { startPreviewServer } from './lib/preview-server.mjs';

const server = await startPreviewServer({routes:{'/previous':'<meta name="referrer" content="no-referrer"><title>Previous page</title><a rel="noreferrer" id="archive">Archive</a>'}});
let browser;
try {
  browser = await chromium.launch({channel:'chrome',headless:true});
  for (const viewport of [{width:1400,height:1000},{width:390,height:844}]) {
    for (const route of ['/field-archive.html','/works/terra_incognita/field-archive.html','/dist/FIELD_ARCHIVE.html']) {
      const context = await browser.newContext({viewport});
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror', error=>errors.push(String(error)));
      const previous=`${server.url}/previous?position=retained`;
      await page.goto(previous);
      await page.locator('#archive').evaluate((a,href)=>a.href=href,route);
      await page.locator('#archive').click();
      if(await page.evaluate(()=>document.referrer)) throw Error('Expected empty referrer');
      await page.reload();
      await page.locator('[data-return]').click();
      await page.waitForURL(previous);
      await context.close();
      const directContext=await browser.newContext({viewport});
      const direct=await directContext.newPage();
      await direct.evaluate(url=>location.replace(url),`${server.url}${route}`);
      await direct.waitForURL(`${server.url}${route}`);
      const expected=route.replace(/[^/]+$/,route.includes('/dist/')?'TERRA_INCOGNITA.html':'index.html');
      const href=await direct.locator('[data-return]').getAttribute('href');
      if(new URL(href,direct.url()).pathname!==expected) throw Error('Wrong direct-entry fallback');
      if(await direct.evaluate(()=>history.length)!==1) throw Error('Not a cold entry');
      await direct.locator('[data-return]').click();
      await direct.waitForURL(`${server.url}${expected}`);
      await directContext.close();
      if(errors.length) throw Error(errors.join('\n'));
      console.log({route,width:viewport.width,noReferrerBack:'pass',reloadBack:'pass',directFallback:'pass'});
    }
  }
  for (const route of ['field-archive.html','works/terra_incognita/field-archive.html','dist/FIELD_ARCHIVE.html']) {
    const context=await browser.newContext();
    const page=await context.newPage();
    const previous=new URL('../README.md',import.meta.url).href;
    const archive=new URL(`../${route}`,import.meta.url).href;
    await page.goto(previous);
    await page.evaluate(url=>location.href=url,archive);
    await page.waitForURL(archive);
    await page.locator('[data-return]').click();
    await page.waitForURL(previous);
    console.log({route,localFileBack:'pass'});
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
