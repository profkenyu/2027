import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const server=await startPreviewServer();let browser;
const reports=[];
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=user-gesture-required']});
  for(const tier of ['high','mid','low']){
    const page=await browser.newPage({viewport:tier==='low'?{width:390,height:844}:{width:1180,height:820},hasTouch:tier==='low',isMobile:tier==='low'});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`${server.url}/ending.html?test&quality=${tier}`);
    await page.waitForFunction(()=>window.FIRST_DAWN);await page.waitForFunction(()=>document.getElementById('loading').hidden);
    assert.equal((await page.evaluate(()=>FIRST_DAWN.audio())).context,'locked');
    if(tier==='low')await page.touchscreen.tap(180,240);else await page.mouse.click(180,240);
    await page.waitForFunction(()=>FIRST_DAWN.audio().ready&&document.getElementById('sound').getAttribute('aria-pressed')==='true');
    await page.evaluate(()=>FIRST_DAWN.seek(30));await page.waitForTimeout(2300);
    const active=await page.evaluate(()=>FIRST_DAWN.audio());
    assert.equal(active.context,'running');assert.equal(active.decay,{high:20,mid:16,low:12}[tier]);
    assert(active.waveform.some(x=>Math.abs(x)>.00001),'Audio graph is silent');
    assert(active.waveform.every(Number.isFinite));assert(Math.max(...active.waveform.map(Math.abs))<.9);
    await page.evaluate(()=>FIRST_DAWN.seek(FIRST_DAWN.audio().nextEvent));
    let event=await page.evaluate(()=>FIRST_DAWN.audio());assert.equal(event.eventCount,1);assert(event.nextEvent-event.time>=40&&event.nextEvent-event.time<=90);
    for(const [at,zeros] of [[84,['high']],[94,['high','mid']],[101,['high','mid','drone']],[108,['high','mid','drone','floor']]]){
      await page.evaluate(t=>FIRST_DAWN.seek(t),at);
      const state=await page.evaluate(()=>FIRST_DAWN.audio());for(const name of zeros)assert.equal(state.score[name],0);
      if(at===101)assert(state.score.floor>0);
    }
    await page.waitForTimeout(300);const end=await page.evaluate(()=>FIRST_DAWN.audio());assert.equal(end.context,'suspended');
    await page.locator('#replay').click();await page.waitForFunction(()=>FIRST_DAWN.audio().ready&&FIRST_DAWN.audio().context==='running');
    assert.equal((await page.evaluate(()=>FIRST_DAWN.audio())).eventCount,0);
    await page.locator('#sound').click();await page.waitForTimeout(220);assert.equal((await page.evaluate(()=>FIRST_DAWN.audio())).enabled,false);
    await page.mouse.click(180,240);assert.equal((await page.evaluate(()=>FIRST_DAWN.audio())).enabled,false);
    await page.locator('#sound').click();await page.waitForFunction(()=>FIRST_DAWN.audio().context==='running');
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    await page.waitForFunction(()=>FIRST_DAWN.audio().context==='suspended');
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await page.waitForFunction(()=>FIRST_DAWN.audio().context==='running');
    await page.evaluate(()=>FIRST_DAWN.seek(94));
    await mkdir('output/qa/ending-audio',{recursive:true});
    await page.screenshot({path:`output/qa/ending-audio/${tier}-icon.png`});
    assert.deepEqual(errors,[]);reports.push({tier,peak:Math.max(...active.waveform.map(Math.abs)),decay:active.decay,eventInterval:event.nextEvent-event.time,errors});await page.close();
  }
  const local=await browser.newPage();await local.goto(pathToFileURL(resolve('ending.html')).href+'?test');
  await local.waitForFunction(()=>window.FIRST_DAWN);await local.waitForFunction(()=>document.getElementById('loading').hidden);
  await local.locator('#sound').click();await local.waitForFunction(()=>FIRST_DAWN.audio().ready&&FIRST_DAWN.audio().context==='running');await local.close();
  await writeFile('output/qa/ending-audio/report.json',JSON.stringify(reports,null,2));
  console.log('PASS: high/mid/low signal, gesture unlock, event, staged extinction, replay, mute, lifecycle, file:// audio');
}finally{await browser?.close();await server.close();}
