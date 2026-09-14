import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    const bytes=await readFile(new URL('.'+path,root));
    res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/html');res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try {
  for(const [number,world,quality] of [['01','terra','high'],['02','desert','mid'],['03','granite','low']]){
    await page.goto(`${origin}/planet-${number}.html?quality=${quality}`);
    await page.waitForFunction(w=>window.TI_WORLD===w&&!!window.TI_CAMERA&&window.TI_PROLOGUE?.().released,world,{timeout:60000});
    assert.equal(await page.locator('script[src="./planet-engine.js"]').count(),1);
    const seed=await page.evaluate(()=>UNIVERSE_SEED);
    await page.reload();
    await page.waitForFunction(w=>window.TI_WORLD===w&&window.TI_PROLOGUE?.().released,world,{timeout:60000});
    assert.equal(await page.evaluate(()=>UNIVERSE_SEED),seed);
    console.log(`PASS HTTP direct entry + reload: planet ${number}, ${quality}`);
  }
  await page.waitForFunction(()=>TI_SEQUENCE().voyage==='arrived',null,{timeout:60000});
  await page.locator('#ti-prior-mission').waitFor();
  await mkdir(new URL('output/qa/planet-pages/',root),{recursive:true});
  await page.screenshot({path:new URL('output/qa/planet-pages/direct-03.png',root).pathname});
  await page.goto(`${origin}/field-archive.html`);
  assert.match(await page.locator('[data-return]').getAttribute('href'),/planet-03\.html$/);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.doesNotMatch(await page.locator('body').innerText(),/[\uac00-\ud7a3]/);
  assert.deepEqual(errors,[]);
  console.log('PASS last-planet return link, English archive, missing-evidence recovery, no page errors');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
