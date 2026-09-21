import assert from 'node:assert/strict';
import {PerspectiveCamera,Group,Vector3} from 'three';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pose} from '../works/space/scene.js';
import {startPreviewServer} from './lib/preview-server.mjs';
const out='output/qa/second-passage';await mkdir(out,{recursive:true});const report={camera:[],frames:[],errors:[]};
for(const [width,height] of [[1600,1000],[1180,820],[390,844],[844,390]]){
 const camera=new PerspectiveCamera(45,width/height,.25,30000),ship=new Group(),center=new Vector3();let previous=null,min=Infinity;
 for(let i=0;i<=3840;i++){
  const shot=pose(camera,ship,i/60,2),distance=camera.position.distanceTo(ship.position);min=Math.min(min,distance);assert(distance>11);
  center.copy(ship.position);center.y+=3;center.project(camera);assert(Math.abs(center.x)<.87&&Math.abs(center.y)<.8&&center.z<1,`Framing ${width} ${i/60}`);
  if(previous?.shot===shot)assert(camera.position.distanceTo(previous.position)<.4);
  previous={shot,position:camera.position.clone()};
 }report.camera.push({width,height,minClearance:min});
}
const server=await startPreviewServer();let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]]){
  const page=await browser.newPage({viewport:{width,height}}),requests=[];page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>requests.push(r.url()));
  await page.goto(`${server.url}/space-02.html?test&quality=${tier}`);await page.waitForFunction(()=>window.BTK_SPACE);
  for(const t of [3,13,24,30,40,46,60]){const s=await page.evaluate(t=>{BTK_SPACE.seek(t);return BTK_SPACE.snapshot();},t);assert.equal(s.passage,2);assert.equal(s.environment.temperature,218);assert(s.independent);report.frames.push(s);await page.screenshot({path:`${out}/${tier}-${t}.png`});}
  for(const t of [26,44])assert.equal(await page.evaluate(t=>{BTK_SPACE.seek(t);return +document.querySelector('#veil').style.opacity;},t),1);
  await page.locator('#sound').click();assert.equal((await page.evaluate(()=>BTK_SPACE.snapshot())).audio.state,'running');
  assert(requests.every(u=>u.startsWith(server.url+'/space-02.html')));await page.close();console.log(`PASS ${tier}: second passage camera / independent rendering / audio`);
 }
 if(!process.argv.includes('--render-only')){
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(String(e)));
 // Prepare genuine first-planet sample records with the existing acquisition shortcut.
 // Only the first transit is skipped; this test exercises the complete second transit.
 await page.goto(server.url+'/planet-01.html?quality=low&fresh=1');await page.waitForFunction(()=>window.TI_WORLD==='terra'&&window.TI_CAMERA&&TI_PROLOGUE().released,null,{timeout:60000});
 await page.keyboard.press('Equal');await page.waitForFunction(()=>TI_MEMORY().ledger.samples.length===6);
 await page.goto(server.url+'/planet-02.html?quality=low');await page.waitForFunction(()=>window.TI_WORLD==='desert'&&window.TI_SEQUENCE&&TI_SEQUENCE().voyage==='arrived'&&TI_SEQUENCE().water==='searching',null,{timeout:90000});
 await page.keyboard.press('Equal');console.log('Water acquisition shortcut; real docking and liftoff follow.');
 await page.waitForURL('**/space-02.html?**',{timeout:180000});await page.waitForFunction(()=>window.BTK_SPACE);
 const transfer=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('beyond-known:transfer:v1')));assert.equal(transfer.source,'desert');assert.equal(transfer.target,'granite');assert.equal(transfer.environment.water,1);report.transfer=transfer;
 await page.waitForTimeout(4500);const before=await page.evaluate(()=>BTK_SPACE.snapshot().seconds);await page.reload();await page.waitForFunction(()=>window.BTK_SPACE);assert(Math.abs((await page.evaluate(()=>BTK_SPACE.snapshot().seconds))-before)<3);
 await page.goto(server.url+'/index.html?test&quality=low');await page.waitForFunction(()=>window.TI_OPENING_TEST);await page.evaluate(()=>TI_OPENING_TEST.seek(1e6));await page.locator('#ti-start').click();await page.waitForURL('**/space-02.html?**');await page.waitForFunction(()=>window.BTK_SPACE);assert.equal((await page.evaluate(()=>BTK_SPACE.snapshot())).environment.water,1);
 console.log('PASS: planet-02 liftoff → space-02 / water evidence / reload / opening RESUME');
 // Opening test mode propagates its query; leave that mode before natural playback.
 const live=new URL(page.url());live.searchParams.delete('test');await page.goto(live.href);await page.waitForFunction(()=>window.BTK_SPACE);
 await page.waitForURL('**/planet-03.html?**',{timeout:90000});await page.waitForFunction(()=>window.TI_WORLD==='granite'&&window.TI_SEQUENCE,null,{timeout:60000});assert.equal(await page.evaluate(()=>TI_SEQUENCE().voyage),'descent');assert.equal(await page.evaluate(()=>UNIVERSE_SEED),transfer.seed);
 await page.screenshot({path:`${out}/planet-03-descent.png`});await page.waitForFunction(()=>TI_SEQUENCE().voyage==='arrived',null,{timeout:90000});await page.waitForTimeout(5500);assert((await page.evaluate(()=>TI_PLANET_STATE())).worlds.granite.observations>0);
 await page.reload();await page.waitForFunction(()=>window.TI_WORLD==='granite'&&TI_CHECKPOINT().restored,null,{timeout:60000});assert.equal(await page.evaluate(()=>TI_SEQUENCE().voyage),'arrived');
 assert.deepEqual(report.errors,[]);console.log('PASS: natural flight → planet-03 descent / exploration / checkpoint restore');
 }
}finally{await writeFile(`${out}/${process.argv.includes('--render-only')?'render-report':'report'}.json`,JSON.stringify(report,null,2));await browser?.close();await server.close();}
