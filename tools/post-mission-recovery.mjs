import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const prior=JSON.parse(await readFile('output/qa/ten-pages/route-report.json','utf8'));
assert.equal(prior.events.at(-1).ending.seconds,18);assert.deepEqual(prior.errors,[]);
const saved={...prior.events[0].handoff,phase:'ending',elapsed:18,outcome:prior.events.at(-1).ending.outcome};
const server=await startPreviewServer(),report={errors:[],checks:[],complete:false};let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(server.url+'/index.html?test&quality=low');await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship);
 await page.evaluate(s=>{sessionStorage.setItem('beyond-known:post-mission:v1',JSON.stringify(s));dispatchEvent(new PageTransitionEvent('pageshow'));TI_OPENING_TEST.seek(1e6);},saved);
 await page.locator('#ti-mobile-start:visible').tap();await page.waitForURL('**/ending.html?**');await page.waitForFunction(()=>window.BTK_ENDING);assert.equal((await page.evaluate(()=>BTK_ENDING.snapshot())).outcome.status,saved.outcome.status);report.checks.push('mobile RESUME retained actual mission outcome');
 await page.evaluate(()=>BTK_ENDING.seek(18));await page.locator('#archive').tap();await page.waitForURL('**/field-archive.html');assert.equal(await page.locator('[data-return]').getAttribute('href'),'ending.html');await page.locator('[data-return]').tap();await page.waitForFunction(()=>window.BTK_ENDING);report.checks.push('archive return');
 // Test-mode documents intentionally start at zero after a history reload.
 await page.evaluate(()=>BTK_ENDING.seek(18));await page.locator('#replay').tap();await page.waitForURL('**/migration.html?**');await page.waitForFunction(()=>window.FIRST_DAWN);assert((await page.evaluate(()=>FIRST_DAWN.snapshot())).elapsed<3);await page.waitForTimeout(2500);const elapsed=await page.evaluate(()=>FIRST_DAWN.snapshot().elapsed);await page.reload();await page.waitForFunction(()=>window.FIRST_DAWN);assert(Math.abs((await page.evaluate(()=>FIRST_DAWN.snapshot())).elapsed-elapsed)<2.5);report.checks.push('REPLAY and reload');
 await page.goto(server.url+'/index.html?test&quality=low');await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship);await page.evaluate(()=>TI_OPENING_TEST.seek(1e6));await page.locator('#ti-restart').tap();await page.waitForURL('**/planet-01.html?**');assert.equal(await page.evaluate(()=>sessionStorage.getItem('beyond-known:post-mission:v1')),null);report.checks.push('NEW MISSION clears post-mission state');
 const blocked=await browser.newPage();await blocked.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});await blocked.goto(server.url+'/arrival.html?test&quality=low');await blocked.waitForFunction(()=>window.FIRST_DAWN);await blocked.evaluate(()=>FIRST_DAWN.seek(130));assert.equal((await blocked.evaluate(()=>FIRST_DAWN.snapshot())).possibility.status,'unavailable');report.checks.push('storage denied: visible preview, no fabricated observations');await blocked.close();
 assert.deepEqual(report.errors,[]);report.complete=true;console.log('PASS post-mission recovery: '+report.checks.join(' / '));
}finally{await writeFile('output/qa/ten-pages/recovery-report.json',JSON.stringify(report,null,2));await browser?.close();await server.close();}
