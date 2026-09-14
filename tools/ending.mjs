import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
import {mkdir,mkdtemp,copyFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DURATION,CUTS,TITLE_AT,ARCHIVE_AT} from '../works/first_dawn/timeline.js';
const server=await startPreviewServer(),reports=[];let browser;
await mkdir('output/qa/ending-90',{recursive:true});
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
    await page.goto(`${server.url}/ending.html?test&quality=${tier}`);
    await page.waitForFunction(()=>window.FIRST_DAWN,null,{timeout:60000});
    await page.waitForFunction(()=>document.getElementById('loading').hidden);
    const frames=[];
    for(const t of [0,5,10,19,21,32,44,46,60,72,89,90]){
      const state=await page.evaluate(t=>{FIRST_DAWN.seek(t);return FIRST_DAWN.snapshot();},t);
      assert.equal(state.total,5);assert(state.independent);assert.equal(state.duration,DURATION);
      assert.equal(state.shot,t<CUTS[0]?'arrival':t<CUTS[1]?'hull':'surface');
      if(t===DURATION){assert(state.deployment.every(v=>v===1));assert.equal(state.animation,'anime.js');if(tier==='low')assert(state.triangles<350000);}
      await page.screenshot({path:`output/qa/ending-90/${tier}-${t}.png`});frames.push(state);
    }
    await page.evaluate(({DURATION,CUTS,TITLE_AT,ARCHIVE_AT})=>{
      const positions=t=>{FIRST_DAWN.seek(t);return FIRST_DAWN.positions();};
      const farA=positions(10),farB=positions(11),nearA=positions(54),nearB=positions(55),speeds=[];
      farA.forEach((p,i)=>{
        const far=farB[i][2]-p[2],near=nearB[i][2]-nearA[i][2];
        if(far<=0||near<far*4)throw Error('Approach must accelerate');
        if(nearA[i][0]!==nearB[i][0]||nearA[i][1]!==nearB[i][1])throw Error('Lateral drift');
        speeds.push(Math.round(near*100));
      });
      if(new Set(speeds).size!==5)throw Error('Identical fleet speed');
      const shot=t=>{FIRST_DAWN.seek(t);return FIRST_DAWN.snapshot();};
      for(const cut of CUTS){shot(cut);if(Number(document.getElementById('cut').style.opacity)!==1)throw Error('Missing authored cut');}
      if(shot(CUTS[0]-.01).shot!=='arrival'||shot(CUTS[1]-.01).shot!=='hull')throw Error('Shot ends early');
      for(const [a,b]of [[2,19],[21,44]])if(shot(b).cameraFov>=shot(a).cameraFov)throw Error('Scale reveal missing');
      const first=shot(CUTS[1]),end=shot(DURATION);
      if(Math.abs(first.cameraPosition[2]-end.cameraPosition[2]-120)>1e-6)throw Error('Ground push-in changed');
      if(Math.abs(end.cameraPosition[1]-end.surfaceHeight-1.7)>1e-6)throw Error('Observer height changed');
      shot(TITLE_AT-1);if(Number(document.getElementById('line').style.opacity)!==0)throw Error('Early title');
      shot(ARCHIVE_AT-1);if(!document.getElementById('archive').hidden)throw Error('Early archive');
      shot(DURATION+100);if(FIRST_DAWN.snapshot().seconds!==DURATION)throw Error('Duration clamp missing');
      if(document.getElementById('line').textContent!=='우리는 이제 여기서 시작한다')throw Error('Final copy changed');
      const a=JSON.stringify(positions(30));positions(80);if(JSON.stringify(positions(30))!==a)throw Error('Nondeterministic seeking');
      dispatchEvent(new PageTransitionEvent('pagehide'));if(!FIRST_DAWN.snapshot().paused)throw Error('Pause failed');dispatchEvent(new PageTransitionEvent('pageshow'));shot(DURATION);
    },{DURATION,CUTS,TITLE_AT,ARCHIVE_AT});
    await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
    await page.locator('#sound').click();await page.locator('#replay').click();assert.equal(await page.evaluate(()=>FIRST_DAWN.snapshot().seconds),0);
    assert(!requests.some(url=>!url.includes('/ending.html')));assert.deepEqual(errors,[]);
    reports.push({tier,frames,errors});console.log(`${tier}: 90s / 20s opening / acceleration / atmosphere / camera / audio / replay PASS`);await page.close();
  }
  const live=await browser.newPage();await live.goto(`${server.url}/ending.html`);await live.waitForFunction(()=>window.FIRST_DAWN);
  const before=await live.evaluate(()=>FIRST_DAWN.snapshot().seconds);await live.waitForTimeout(1200);assert(await live.evaluate(()=>FIRST_DAWN.snapshot().seconds)>before);
  await live.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));const paused=await live.evaluate(()=>FIRST_DAWN.snapshot().seconds);await live.waitForTimeout(300);assert.equal(await live.evaluate(()=>FIRST_DAWN.snapshot().seconds),paused);await live.close();
  const portable=await mkdtemp(join(tmpdir(),'first-dawn-standalone-'));
  try{
    const file=join(portable,'ending.html');await copyFile(new URL('../ending.html',import.meta.url),file);
    const local=await browser.newPage();await local.goto(pathToFileURL(file).href);await local.waitForFunction(()=>window.FIRST_DAWN?.snapshot().independent);await local.close();
  }finally{await rm(portable,{recursive:true,force:true});}
  await writeFile('output/qa/ending-90/report.json',JSON.stringify(reports,null,2));
  console.log('autonomous playback / live pause / isolated file:// PASS');
}finally{await browser?.close();await server.close();}
