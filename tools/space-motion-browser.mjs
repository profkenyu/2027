import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
import {baseline} from '../engine/core/planet-state.js';
const server=await startPreviewServer(),report={cases:[],errors:[]};let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [tier,width,height] of [['high',1440,900],['low',390,844]])for(const [passage,cut] of [[1,20],[1,40],[2,26],[2,44]]){
  const source=passage===1?'terra':'desert',target=passage===1?'desert':'granite';
  const page=await browser.newPage({viewport:{width,height},isMobile:tier==='low'});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(transfer=>sessionStorage.setItem('beyond-known:transfer:v1',JSON.stringify(transfer)),{version:1,source,target,seed:'abcdef',stage:'flight',elapsed:cut-.8,environment:baseline(source)});
  await page.goto(`${server.url}/space-0${passage}.html?quality=${tier}`);await page.waitForFunction(()=>window.BTK_SPACE);
  const frames=await page.evaluate(cut=>new Promise(resolve=>{
   const frames=[];function sample(){const s=BTK_SPACE.snapshot();frames.push({t:s.seconds,shot:s.shot,ship:s.position,relative:s.cameraPosition.map((v,i)=>v-s.position[i]),veil:+document.querySelector('#veil').style.opacity});if(s.seconds>=cut+.8)resolve(frames);else requestAnimationFrame(sample);}sample();
  }),cut);
  assert(frames.some(f=>f.t<cut)&&frames.some(f=>f.t>cut));let minSpeed=Infinity,maxCover=0;
  for(let i=1;i<frames.length;i++){
   const a=frames[i-1],b=frames[i],dt=b.t-a.t;if(dt<=0)continue;
   assert(Math.abs((a.ship[2]-b.ship[2])/dt-8)<1e-5);
   if(a.shot===b.shot)minSpeed=Math.min(minSpeed,Math.hypot(...b.relative.map((v,j)=>(v-a.relative[j])/dt)));
   if(b.veil>.01)maxCover=Math.max(maxCover,Math.abs(b.t-cut));
  }
  assert(minSpeed>.5);assert(maxCover<.091);
  report.cases.push({tier,passage,cut,minRelativeSpeed:minSpeed,maxCoverFromCut:maxCover,frames});await page.close();console.log(`PASS ${tier} passage ${passage} cut ${cut}: live playback, no tracking stop`);
 }
 assert.deepEqual(report.errors,[]);
}finally{await mkdir('output/qa/space-motion',{recursive:true});await writeFile('output/qa/space-motion/report.json',JSON.stringify(report,null,2));await browser?.close();await server.close();}
