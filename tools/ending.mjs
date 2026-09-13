import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
import {mkdtemp,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const server=await startPreviewServer();let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
    await page.goto(`${server.url}/ending.html?test&quality=${tier}`);
    await page.waitForFunction(()=>window.FIRST_DAWN,null,{timeout:60000}).catch(e=>{throw Error(`${e}\n${errors.join('\n')}`);});
    await page.waitForFunction(()=>document.getElementById('loading').hidden);
    let peak;
    for(const t of [0,10,14,16,25,34,36,45,59,60]){
      const state=await page.evaluate(t=>{FIRST_DAWN.seek(t);return FIRST_DAWN.snapshot();},t);
      if(state.total!==5||!state.independent||state.ships!==(t?5:0))throw Error('Incorrect fleet/state');
      if(t===60){peak=state;if(state.animation!=='anime.js'||state.deployment.some(v=>v!==1))throw Error('Mechanical deployment did not complete');if(tier==='low'&&state.triangles>350000)throw Error('LOW geometry budget exceeded');}
      await page.screenshot({path:`dist/ending-${tier}-${t}.png`});
    }
    await page.evaluate(()=>{
      FIRST_DAWN.seek(20);const a=FIRST_DAWN.positions();FIRST_DAWN.seek(21);const b=FIRST_DAWN.positions();
      const speeds=[];a.forEach((p,i)=>{if(p[0]!==b[i][0]||p[1]!==b[i][1]||b[i][2]<=p[2])throw Error('Vanishing point path failure');speeds.push(Math.round((b[i][2]-p[2])*100));});
      if(new Set(speeds).size!==5)throw Error('Identical approach speeds');
      dispatchEvent(new PageTransitionEvent('pagehide'));if(!FIRST_DAWN.snapshot().paused)throw Error('Pause failure');dispatchEvent(new PageTransitionEvent('pageshow'));
      FIRST_DAWN.seek(59);
    });
    await page.evaluate(()=>{
      const expected=['arrival','hull','hull','surface'];
      [10,20,30,45].forEach((t,i)=>{FIRST_DAWN.seek(t);if(FIRST_DAWN.snapshot().shot!==expected[i])throw Error('Camera sequence mismatch');});
      for(const [from,to,relative] of [[2,14,false],[16,34,true]]){
        FIRST_DAWN.seek(from);const start=FIRST_DAWN.snapshot(),shipA=FIRST_DAWN.positions()[0];
        FIRST_DAWN.seek(to);const end=FIRST_DAWN.snapshot(),shipB=FIRST_DAWN.positions()[0];
        if(end.cameraFov>=start.cameraFov)throw Error('Shot zoom missing');
        const az=start.cameraPosition[2]-(relative?shipA[2]:0),bz=end.cameraPosition[2]-(relative?shipB[2]:0);
        if(bz>=az)throw Error('Shot forward approach missing');
      }
      const sequence=[];
      for(let t=0;t<=60;t+=1){FIRST_DAWN.seek(t);const shot=FIRST_DAWN.snapshot().shot;if(sequence.at(-1)!==shot)sequence.push(shot);}
      if(sequence.join(',')!=='arrival,hull,surface')throw Error('Expected exactly three shots');
      FIRST_DAWN.seek(25);if(Number(document.getElementById('cut').style.opacity)!==0)throw Error('Obsolete camera cut remains');
      FIRST_DAWN.seek(34);if(Number(document.getElementById('line').style.opacity)!==0)throw Error('Subtitle before ground shot');
      FIRST_DAWN.seek(45);const a=FIRST_DAWN.snapshot();
      if(Math.abs(a.cameraPosition[1]-a.surfaceHeight-1.7)>1e-6)throw Error('Camera is not at surface eye height');
      FIRST_DAWN.seek(59);const b=FIRST_DAWN.snapshot();
      if(b.cameraPosition[2]>=a.cameraPosition[2]||b.cameraPosition[0]>=a.cameraPosition[0]||b.cameraFov>=a.cameraFov)throw Error('Final push-in or zoom missing');
      if(b.cameraPosition[1]!==a.cameraPosition[1])throw Error('Ground camera height drift');
      FIRST_DAWN.seek(60);const end=FIRST_DAWN.snapshot();
      FIRST_DAWN.seek(35);const start=FIRST_DAWN.snapshot();
      if(Math.abs(start.cameraPosition[2]-end.cameraPosition[2]-120)>1e-6)throw Error('Push-in distance mismatch');
      FIRST_DAWN.seek(100);if(FIRST_DAWN.snapshot().seconds!==60)throw Error('Duration exceeds 60 seconds');
      FIRST_DAWN.seek(14.99);if(FIRST_DAWN.snapshot().shot!=='arrival')throw Error('First shot ends early');
      FIRST_DAWN.seek(15);if(FIRST_DAWN.snapshot().shot!=='hull')throw Error('15-second cut mismatch');
      FIRST_DAWN.seek(35);if(FIRST_DAWN.snapshot().shot!=='surface')throw Error('35-second cut mismatch');
      FIRST_DAWN.seek(59);
      if(document.getElementById('line').textContent!=='우리는 이제 여기서 시작한다')throw Error('Exact final copy mismatch');
      FIRST_DAWN.seek(20);const first=JSON.stringify(FIRST_DAWN.positions());
      FIRST_DAWN.seek(45);FIRST_DAWN.seek(20);
      if(first!==JSON.stringify(FIRST_DAWN.positions()))throw Error('Camera affects fleet trajectory');
      FIRST_DAWN.seek(59);
    });
    if(await page.locator('#line').evaluate(e=>Number(getComputedStyle(e).opacity))!==1)throw Error('Final title missing');
    await page.locator('#sound').click();if(await page.locator('#sound').getAttribute('aria-pressed')!=='true')throw Error('Audio gesture failure');
    await page.locator('#sound').click();await page.locator('#replay').click();
    if((await page.evaluate(()=>FIRST_DAWN.snapshot())).seconds!==0)throw Error('Replay failure');
    if(requests.some(url=>!url.includes('/ending.html')))throw Error('Standalone page fetched an external dependency: '+requests.join(','));
    if(errors.length)throw Error(errors.join('\n'));
    console.log(tier,{triangles:peak.triangles,calls:peak.calls,ships:peak.total,animation:peak.animation},'render / paths / lifecycle / audio / replay PASS');await page.close();
  }
  const live=await browser.newPage();await live.goto(`${server.url}/ending.html`);await live.waitForFunction(()=>window.FIRST_DAWN);
  const before=await live.evaluate(()=>FIRST_DAWN.snapshot().seconds);await live.waitForTimeout(1200);
  const after=await live.evaluate(()=>FIRST_DAWN.snapshot().seconds);if(after<=before)throw Error('Autonomous playback stalled');
  await live.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));const paused=await live.evaluate(()=>FIRST_DAWN.snapshot().seconds);await live.waitForTimeout(300);
  if(await live.evaluate(()=>FIRST_DAWN.snapshot().seconds)!==paused)throw Error('Live pause failed');
  console.log('autonomous playback / live pause PASS');await live.close();
  const portable=await mkdtemp(join(tmpdir(),'first-dawn-standalone-'));
  try{
    const file=join(portable,'ending.html');await copyFile(new URL('../ending.html',import.meta.url),file);
    const local=await browser.newPage(),failures=[];local.on('pageerror',e=>failures.push(String(e)));
    await local.goto(pathToFileURL(file).href);await local.waitForFunction(()=>window.FIRST_DAWN?.snapshot().independent);
    if(failures.length)throw Error(failures.join('\n'));console.log('isolated file:// HTML without mission files PASS');await local.close();
  }finally{await rm(portable,{recursive:true,force:true});}
}finally{await browser?.close();await server.close();}
