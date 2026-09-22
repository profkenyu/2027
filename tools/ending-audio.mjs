import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await startPreviewServer(),reports=[];let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=user-gesture-required']});
 for(const tier of ['high','mid','low']){
  const page=await browser.newPage({viewport:{width:tier==='low'?390:1180,height:844},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${server.url}/migration.html?test&quality=${tier}`);await page.waitForFunction(()=>window.FIRST_DAWN);await page.waitForFunction(()=>document.getElementById('loading').hidden);
  assert.equal((await page.evaluate(()=>FIRST_DAWN.audio())).context,'locked');
  await page.locator('#sound').tap();await page.waitForFunction(()=>FIRST_DAWN.audio().ready);await page.evaluate(()=>FIRST_DAWN.seek(30));await page.waitForTimeout(2400);
  const active=await page.evaluate(()=>FIRST_DAWN.audio());assert(active.waveform.some(v=>Math.abs(v)>.00001));assert(active.waveform.every(Number.isFinite));assert.equal(active.decay,{high:20,mid:16,low:12}[tier]);
  await page.locator('#sound').tap();await page.waitForTimeout(250);await page.touchscreen.tap(180,240);assert.equal((await page.evaluate(()=>FIRST_DAWN.audio())).enabled,false);
  await page.goto(`${server.url}/arrival.html?test&quality=${tier}`);await page.waitForFunction(()=>window.FIRST_DAWN);await page.waitForFunction(()=>document.getElementById('loading').hidden);
  await page.touchscreen.tap(180,240);assert.equal((await page.evaluate(()=>FIRST_DAWN.audio())).enabled,false,'Mute must survive a page boundary');
  await page.locator('#sound').tap();await page.waitForFunction(()=>FIRST_DAWN.audio().ready);await page.evaluate(()=>FIRST_DAWN.seek(88));await page.waitForTimeout(1200);
  const wind=await page.evaluate(()=>FIRST_DAWN.audio());assert.equal(wind.score.phase,'surface-wind');assert(wind.waveform.some(v=>Math.abs(v)>.00001));
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));await page.waitForFunction(()=>FIRST_DAWN.audio().context==='suspended');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));await page.waitForFunction(()=>FIRST_DAWN.audio().context==='running');
  await page.evaluate(()=>FIRST_DAWN.seek(120));await page.waitForTimeout(300);assert.equal((await page.evaluate(()=>FIRST_DAWN.audio())).context,'suspended');
  assert.deepEqual(errors,[]);reports.push({tier,peak:Math.max(...active.waveform.map(Math.abs)),windPeak:Math.max(...wind.waveform.map(Math.abs)),errors});await page.close();console.log(`PASS ${tier}: gesture / migration signal / retained mute / surface wind / silence / lifecycle`);
 }
 await mkdir('output/qa/ending-audio',{recursive:true});await writeFile('output/qa/ending-audio/report.json',JSON.stringify(reports,null,2));
}finally{await browser?.close();await server.close();}
