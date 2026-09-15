import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
import {mkdir,mkdtemp,copyFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DURATION,CUTS,TITLE_AT,ARCHIVE_AT} from '../works/first_dawn/timeline.js';
import {Scene,Raycaster,Vector3,PerspectiveCamera} from 'three';
import {createSurface} from '../works/first_dawn/surface.js';
import {directCamera} from '../works/first_dawn/camera.js';
const server=await startPreviewServer(),reports=[];let browser;
await mkdir('output/qa/ending-sf',{recursive:true});
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]]){
    const scene=new Scene(),surface=createSurface(scene,tier),camera=new PerspectiveCamera(60,width/height,.5,80000);
    scene.updateMatrixWorld(true);
    const raycaster=new Raycaster(),down=new Vector3(0,-1,0),origin=new Vector3();
    for(let t=CUTS[2];t<=DURATION;t+=.5){
      directCamera(camera,t,null,surface.heightAt,null);
      origin.copy(camera.position);origin.y+=100;
      raycaster.set(origin,down);
      const hit=raycaster.intersectObject(surface.group.children[0])[0];
      assert(hit,'Rendered terrain missing below camera');
      const clearance=camera.position.y-hit.point.y;
      assert(clearance>=4.99&&clearance<=8.01,`Camera intersects rendered ${tier} terrain: ${clearance}`);
    }
    scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});
    const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
    await page.goto(`${server.url}/ending.html?test&quality=${tier}`);
    await page.waitForFunction(()=>window.FIRST_DAWN,null,{timeout:60000});
    await page.waitForFunction(()=>document.getElementById('loading').hidden);
    const frames=[];
    await page.evaluate(()=>{
      for(const at of [0,1.5,3,4,6,8,9.5]){
        const a=Math.max(0,at-.01),b=at+.01;
        FIRST_DAWN.seek(a);const before=FIRST_DAWN.positions();
        if(FIRST_DAWN.snapshot().ships!==6)throw Error('Distant fleet missing before approach');
        FIRST_DAWN.seek(b);const after=FIRST_DAWN.positions();
        if(FIRST_DAWN.snapshot().ships!==6)throw Error('Timed ship appearance');
        for(let i=0;i<6;i++)if(after[i][2]<=before[i][2]||after[i][2]-before[i][2]>4)throw Error('Discontinuous distant coast');
      }
    });
    for(const t of [0,5,10,19,21,32,39,41,48,54,60,67,69,74,80,88,94,100,108]){
      const state=await page.evaluate(t=>{FIRST_DAWN.seek(t);return FIRST_DAWN.snapshot();},t);
      assert.equal(state.total,6);assert.equal(state.referenceArks,1);assert.equal(state.originalArks,5);assert(state.independent);assert.equal(state.duration,DURATION);assert(DURATION<=120);
      assert.equal(state.shot,t<CUTS[0]?'arrival':t<CUTS[1]?'hull':t<CUTS[2]?'ring-passage':'surface');
      if(t===DURATION){assert(state.deployment.every(v=>v===1));assert.equal(state.animation,'anime.js');if(tier==='low')assert(state.triangles<350000);}
      if((tier==='high'&&[54,88].includes(t))||(tier==='low'&&t===88)){
        await page.screenshot({path:`output/qa/ending-sf/${tier}-${t}.png`});
      }
      frames.push(state);
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
      if(new Set(speeds).size!==6)throw Error('Identical fleet speed');
      const shot=t=>{FIRST_DAWN.seek(t);return FIRST_DAWN.snapshot();};
      for(const cut of CUTS){shot(cut);if(Number(document.getElementById('cut').style.opacity)!==1)throw Error('Missing authored cut');}
      if(shot(CUTS[0]-.01).shot!=='arrival'||shot(CUTS[1]-.01).shot!=='hull'||shot(CUTS[2]-.01).shot!=='ring-passage')throw Error('Shot ends early');
      for(const [a,b]of [[2,19],[21,39],[41,67]])if(shot(b).cameraFov>=shot(a).cameraFov)throw Error('Scale reveal missing');
      const encounterStart=shot(41).cameraPosition,shipStart=positions(41)[5];
      const encounterEnd=shot(67).cameraPosition,shipEnd=positions(67)[5];
      if(encounterStart[2]-shipStart[2]<1700||encounterEnd[2]-shipEnd[2]>-1700)throw Error('Camera did not pass both habitat rings');
      const first=shot(CUTS[2]),end=shot(DURATION);
      if(first.cameraPosition[2]-end.cameraPosition[2]<750)throw Error('Surface travel too short');
      const speed=t=>{const a=shot(t).cameraPosition,b=shot(t+1).cameraPosition;return Math.hypot(b[0]-a[0],b[2]-a[2]);};
      if(speed(87)<speed(73)*4||speed(101)>speed(87)*.3)throw Error('Surface acceleration or final braking missing');
      for(let t=CUTS[2];t<=DURATION;t+=2){const state=shot(t),clearance=state.cameraPosition[1]-state.surfaceHeight;if(clearance<4.99||clearance>8.01)throw Error('Unsafe surface altitude');}
      shot(TITLE_AT-1);if(Number(document.getElementById('line').style.opacity)!==0)throw Error('Early title');
      shot(ARCHIVE_AT-1);if(!document.getElementById('archive').hidden)throw Error('Early archive');
      shot(DURATION+100);if(FIRST_DAWN.snapshot().seconds!==DURATION)throw Error('Duration clamp missing');
      if(document.getElementById('line').textContent!=='우리는 이제 여기서 시작한다')throw Error('Final copy changed');
      const a=JSON.stringify(positions(30));positions(80);if(JSON.stringify(positions(30))!==a)throw Error('Nondeterministic seeking');
      dispatchEvent(new PageTransitionEvent('pagehide'));if(!FIRST_DAWN.snapshot().paused)throw Error('Pause failed');dispatchEvent(new PageTransitionEvent('pageshow'));shot(DURATION);
    },{DURATION,CUTS,TITLE_AT,ARCHIVE_AT});
    await page.locator('#sound').click();await page.waitForFunction(()=>document.getElementById('sound').getAttribute('aria-pressed')==='true');
    await page.locator('#sound').click();await page.locator('#replay').click();assert.equal(await page.evaluate(()=>FIRST_DAWN.snapshot().seconds),0);
    // Tone's inline clock worker uses a local blob URL, not a network asset.
    assert(!requests.some(url=>!url.includes('/ending.html')&&!url.startsWith('blob:')),JSON.stringify(requests));assert.deepEqual(errors,[]);
    reports.push({tier,frames,errors});console.log(`${tier}: ${DURATION}s / five original arks + one reference ark / ring passage / acceleration / atmosphere / audio / replay PASS`);await page.close();
  }
  const live=await browser.newPage();await live.goto(`${server.url}/ending.html`);await live.waitForFunction(()=>window.FIRST_DAWN);
  const before=await live.evaluate(()=>FIRST_DAWN.snapshot().seconds);await live.waitForTimeout(1200);assert(await live.evaluate(()=>FIRST_DAWN.snapshot().seconds)>before);
  await live.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));const paused=await live.evaluate(()=>FIRST_DAWN.snapshot().seconds);await live.waitForTimeout(300);assert.equal(await live.evaluate(()=>FIRST_DAWN.snapshot().seconds),paused);await live.close();
  const portable=await mkdtemp(join(tmpdir(),'first-dawn-standalone-'));
  try{
    const file=join(portable,'ending.html');await copyFile(new URL('../ending.html',import.meta.url),file);
    const local=await browser.newPage();await local.goto(pathToFileURL(file).href);await local.waitForFunction(()=>window.FIRST_DAWN?.snapshot().independent);await local.close();
  }finally{await rm(portable,{recursive:true,force:true});}
  await writeFile('output/qa/ending-sf/report.json',JSON.stringify(reports,null,2));
  console.log('autonomous playback / live pause / isolated file:// PASS');
}finally{await browser?.close();await server.close();}
