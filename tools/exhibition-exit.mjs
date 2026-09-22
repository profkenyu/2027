import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
await mkdir('output/qa/exhibition-route',{recursive:true});
const server=await startPreviewServer(),report={mode:'focused exit retest after favicon fix',errors:[],badResponses:[],complete:false};let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text()+' @ '+m.location().url);});page.on('response',r=>{if(r.status()>=400)report.badResponses.push(r.url());});
 await page.goto(server.url+'/ending.html?test&quality=low');await page.waitForFunction(()=>window.BTK_ENDING);await page.evaluate(()=>BTK_ENDING.seek(18));
 assert.equal(await page.locator('#line').innerText(),'우리는 이제 여기서 시작한다');await page.locator('#archive').click();await page.waitForURL('**/field-archive.html');await page.waitForTimeout(1500);assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'data:,');
 await page.screenshot({path:'output/qa/exhibition-route/archive-retest.png'});await page.goto(server.url+'/index.html?quality=low');await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship);await page.waitForTimeout(1000);assert(!await page.evaluate(()=>!!window.TI_WORLD));assert.deepEqual(report.errors,[]);assert.deepEqual(report.badResponses,[]);report.complete=true;
 console.log('PASS focused retest: final caption → archive → independent opening / no missing resources or console errors');
}finally{await writeFile('output/qa/exhibition-route/exit-retest.json',JSON.stringify(report,null,2));await browser?.close();await server.close();}
