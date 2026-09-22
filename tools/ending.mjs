import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {Scene,Raycaster,Vector3,PerspectiveCamera} from 'three';
import {createSurface} from '../works/first_dawn/surface.js';
import {directCamera} from '../works/first_dawn/camera.js';
const evidence={samples:6,water:true,nodes:3,temperature:246,energy:1,radiation:0,distance:100};
const server=await startPreviewServer(),report={frames:[],errors:[]};let browser;
await mkdir('output/qa/ten-pages',{recursive:true});
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]]){
  const scene=new Scene(),surface=createSurface(scene,tier),camera=new PerspectiveCamera(60,width/height,.5,80000),ray=new Raycaster();scene.updateMatrixWorld(true);
  for(let t=68;t<=108;t+=.5){directCamera(camera,t,null,surface.heightAt,null);ray.set(camera.position.clone().add(new Vector3(0,100,0)),new Vector3(0,-1,0));const hit=ray.intersectObject(surface.group.children[0])[0];assert(hit);const clearance=camera.position.y-hit.point.y;assert(clearance>=4.99&&clearance<=8.01);}
  scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(server.url+'/migration.html?test&quality='+tier);await page.waitForFunction(()=>window.FIRST_DAWN);
  for(const t of [0,5,19,20,30,40,54,67,68]){
   const s=await page.evaluate(t=>{FIRST_DAWN.seek(t);return FIRST_DAWN.snapshot();},t);assert.equal(s.phase,'migration');assert.equal(s.duration,68);assert.equal(s.total,6);assert.equal(s.referenceArks,1);assert.equal(s.originalArks,5);assert(s.independent);assert.notEqual(s.shot,'surface');report.frames.push(s);
  }
  await page.evaluate(()=>FIRST_DAWN.seek(54));await page.waitForTimeout(1400);await page.screenshot({path:`output/qa/ten-pages/${tier}-migration.png`});
  const a=await page.evaluate(()=>{FIRST_DAWN.seek(30);return FIRST_DAWN.positions();});await page.evaluate(()=>FIRST_DAWN.seek(60));const b=await page.evaluate(()=>{FIRST_DAWN.seek(30);return FIRST_DAWN.positions();});assert.deepEqual(a,b);
  await page.addInitScript(e=>{if(location.pathname.endsWith('/arrival.html'))sessionStorage.setItem('beyond-known:post-mission:v1',JSON.stringify({version:1,phase:'arrival',elapsed:0,seed:'abcdef',evidence:e,outcome:null}));},evidence);
  await page.goto(server.url+'/arrival.html?test&quality='+tier);await page.waitForFunction(()=>window.FIRST_DAWN);
  for(const t of [68,74,88,108,114,124,136,138]){
   const s=await page.evaluate(t=>{FIRST_DAWN.seek(t);return FIRST_DAWN.snapshot();},t);assert.equal(s.phase,'arrival');assert.equal(s.shot,'surface');assert.equal(s.duration,70);assert(s.cameraPosition[1]-s.surfaceHeight>=4.99);assert(!s.preview);report.frames.push(s);
   if(t===136)assert.equal(s.possibility.status,'persisting');
  }
  await page.evaluate(()=>FIRST_DAWN.seek(132));await page.waitForTimeout(1400);await page.screenshot({path:`output/qa/ten-pages/${tier}-possibility.png`});
  assert.match(await page.locator('#line').innerText(),/실제 생명 발견 아님/);
  const expected=await page.evaluate(()=>FIRST_DAWN.snapshot().possibility);await page.evaluate(()=>{FIRST_DAWN.seek(115);FIRST_DAWN.seek(132);});assert.deepEqual(await page.evaluate(()=>FIRST_DAWN.snapshot().possibility),expected);
  await page.evaluate(()=>{FIRST_DAWN.seek(138);FIRST_DAWN.next();});await page.waitForURL('**/ending.html?**');await page.waitForFunction(()=>window.BTK_ENDING);
  const live=await page.evaluate(()=>BTK_ENDING.snapshot());assert(live.outcome&&live.outcome.mass>0);assert.equal(await page.locator('canvas').count(),0);
  await page.goto(server.url+'/ending.html?test&quality='+tier);await page.waitForFunction(()=>window.BTK_ENDING);await page.evaluate(()=>BTK_ENDING.seek(18));
  assert.equal(await page.locator('#line').innerText(),'우리는 이제 여기서 시작한다');assert(!await page.locator('#archive').isHidden());await page.screenshot({path:`output/qa/ten-pages/${tier}-ending.png`});
  await page.locator('#replay').click();await page.waitForURL('**/migration.html?**');await page.waitForFunction(()=>window.FIRST_DAWN);assert(await page.evaluate(()=>FIRST_DAWN.snapshot().elapsed)<3);
  await page.close();console.log(`PASS ${tier}: preserved six-ship sequence / surface clearance / deterministic possibility / final caption / replay`);
 }
 const direct=await browser.newPage();await direct.goto(server.url+'/arrival.html?test&quality=low');await direct.waitForFunction(()=>window.FIRST_DAWN);await direct.evaluate(()=>FIRST_DAWN.seek(130));assert((await direct.evaluate(()=>FIRST_DAWN.snapshot())).preview);assert.equal((await direct.evaluate(()=>FIRST_DAWN.snapshot())).possibility.status,'unavailable');await direct.close();
 for(const name of ['migration','arrival','ending']){const page=await browser.newPage();await page.goto(pathToFileURL(resolve(name+'.html')).href+'?test&quality=low');await page.waitForFunction(()=>window.FIRST_DAWN||window.BTK_ENDING);await page.close();}
 assert.deepEqual(report.errors,[]);await writeFile('output/qa/ten-pages/render-report.json',JSON.stringify(report,null,2));
 console.log('PASS direct preview without fabricated evidence / standalone file pages / no runtime errors');
}finally{await browser?.close();await server.close();}
