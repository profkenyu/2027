import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await startPreviewServer(),report={started:new Date().toISOString(),events:[],errors:[],complete:false};let browser;
await mkdir('output/qa/ten-pages',{recursive:true});
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(server.url+'/planet-01.html?quality=low&fresh=1');await page.waitForFunction(()=>window.TI_WORLD==='terra'&&window.TI_CAMERA&&TI_PROLOGUE().released,null,{timeout:90000});
 await page.keyboard.press('Equal');await page.waitForFunction(()=>TI_MEMORY().ledger.samples.length===6);
 await page.goto(server.url+'/planet-02.html?quality=low');await page.waitForFunction(()=>window.TI_SEQUENCE?.().water==='searching',null,{timeout:90000});await page.keyboard.press('Equal');await page.waitForFunction(()=>TI_MEMORY().ledger.water?.confirmed);
 await page.goto(server.url+'/planet-03.html?quality=low');await page.waitForFunction(()=>window.TI_SEQUENCE?.().mission==='searching'&&TI_SEQUENCE().voyage==='arrived',null,{timeout:90000});await page.keyboard.press('Equal');
 await page.waitForURL('**/migration.html?**',{timeout:45000});await page.waitForFunction(()=>window.FIRST_DAWN);
 const state=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('beyond-known:post-mission:v1')));assert.equal(state.evidence.nodes,3);assert.equal(state.evidence.samples,6);assert.equal(state.evidence.water,true);report.events.push({handoff:state});console.log('PASS actual planet-03 completion → migration with retained evidence');
 await page.waitForTimeout(4000);const before=await page.evaluate(()=>FIRST_DAWN.snapshot().elapsed);await page.reload();await page.waitForFunction(()=>window.FIRST_DAWN);assert(Math.abs((await page.evaluate(()=>FIRST_DAWN.snapshot().elapsed))-before)<2.5);
 await page.waitForURL('**/arrival.html?**',{timeout:110000});await page.waitForFunction(()=>window.FIRST_DAWN);assert(!(await page.evaluate(()=>FIRST_DAWN.snapshot())).preview);console.log('PASS natural migration → arrival');
 await page.waitForFunction(()=>FIRST_DAWN.snapshot().seconds>=129,null,{timeout:100000});report.events.push({possibility:await page.evaluate(()=>FIRST_DAWN.snapshot().possibility)});await page.screenshot({path:'output/qa/ten-pages/natural-possibility.png'});
 await page.waitForURL('**/ending.html?**',{timeout:30000});await page.waitForFunction(()=>window.BTK_ENDING);await page.waitForFunction(()=>BTK_ENDING.snapshot().seconds>=18,null,{timeout:35000});report.events.push({ending:await page.evaluate(()=>BTK_ENDING.snapshot())});
 assert.equal(await page.locator('#line').innerText(),'우리는 이제 여기서 시작한다');await page.locator('#archive').tap();await page.waitForURL('**/field-archive.html');assert.equal(await page.locator('[data-return]').getAttribute('href'),'ending.html');await page.locator('[data-return]').tap();await page.waitForFunction(()=>window.BTK_ENDING);assert((await page.evaluate(()=>BTK_ENDING.snapshot().seconds))>=17);
 await page.goto(server.url+'/index.html?test&quality=low');await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship);await page.evaluate(()=>TI_OPENING_TEST.seek(1e6));assert.equal(await page.locator('#ti-start span').innerText(),'RESUME');await page.locator('#ti-mobile-start:visible, #ti-start:visible').tap();await page.waitForURL('**/ending.html?**');
 await page.goto(server.url+'/index.html?test&quality=low');await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship);await page.evaluate(()=>TI_OPENING_TEST.seek(1e6));await page.locator('#ti-restart').tap();await page.waitForURL('**/planet-01.html?**');assert.equal(await page.evaluate(()=>sessionStorage.getItem('beyond-known:post-mission:v1')),null);
 assert.deepEqual(report.errors,[]);report.complete=true;console.log('PASS natural arrival / possibility / final caption / archive return / RESUME / NEW MISSION');
}finally{report.finished=new Date().toISOString();await writeFile('output/qa/ten-pages/route-report.json',JSON.stringify(report,null,2));await browser?.close();await server.close();}
