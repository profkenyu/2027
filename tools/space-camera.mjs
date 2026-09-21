import assert from 'node:assert/strict';
import {PerspectiveCamera,Group,Vector3} from 'three';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pose,CUTS,DURATION} from '../works/space/scene.js';
import {startPreviewServer} from './lib/preview-server.mjs';
const reports=[];await mkdir('output/qa/space-camera',{recursive:true});
for(const [width,height] of [[1600,1000],[1180,820],[390,844],[844,390]]){
 const camera=new PerspectiveCamera(45,width/height,.25,30000),ship=new Group(),center=new Vector3();
 let previous=null,minClearance=Infinity,maxStep=0;
 for(let i=0;i<=DURATION*60;i++){
  const t=i/60,shot=pose(camera,ship,t);const clearance=camera.position.distanceTo(ship.position);minClearance=Math.min(minClearance,clearance);assert(clearance>11,'Camera penetrates spacecraft envelope');
  center.copy(ship.position);center.y+=3;center.project(camera);assert(Math.abs(center.x)<.87&&Math.abs(center.y)<.8&&center.z<1,`Lost spacecraft at ${width}x${height}, ${t}: ${center.toArray()}`);
  if(previous&&previous.shot===shot){const step=camera.position.distanceTo(previous.position);maxStep=Math.max(maxStep,step);assert(step<.4,'Camera acceleration or position discontinuity');}
  previous={shot,position:camera.position.clone()};
 }
 pose(camera,ship,1);const start=camera.position.distanceTo(ship.position);pose(camera,ship,19);const near=camera.position.distanceTo(ship.position);assert(start>near*2,'Missing actual distant approach');
 pose(camera,ship,21);const fore=camera.position.z-ship.position.z;pose(camera,ship,39);const aft=camera.position.z-ship.position.z;assert(fore<-20&&aft>25,'Camera did not pass the hull');
 pose(camera,ship,41);const release=camera.position.distanceTo(ship.position);pose(camera,ship,61);assert(camera.position.distanceTo(ship.position)>release*1.8,'Missing camera release');
 reports.push({width,height,minClearance,maxFrameStep:maxStep,approachRatio:start/near,fore,aft});
}
const server=await startPreviewServer();let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${server.url}/space-01.html?test&quality=${tier}`);await page.waitForFunction(()=>window.BTK_SPACE);
  for(const t of [3,10,19,21,26,30,35,39,41,50,60]){await page.evaluate(t=>BTK_SPACE.seek(t),t);await page.screenshot({path:`output/qa/space-camera/${tier}-${t}.png`});}
  // Seeking is deterministic; cuts remain covered, and the final landing exit remains available.
  const a=await page.evaluate(()=>{BTK_SPACE.seek(30);return BTK_SPACE.snapshot().cameraPosition;});await page.evaluate(()=>BTK_SPACE.seek(52));const b=await page.evaluate(()=>{BTK_SPACE.seek(30);return BTK_SPACE.snapshot().cameraPosition;});assert.deepEqual(a,b);
  for(const cut of CUTS){assert.equal(await page.evaluate(t=>{BTK_SPACE.seek(t);return Number(document.getElementById('veil').style.opacity);},cut),1);}
  assert.deepEqual(errors,[]);console.log(`PASS ${tier}: approach / hull passage / release / camera clearance / deterministic seek`);await page.close();
 }
 await writeFile('output/qa/space-camera/report.json',JSON.stringify(reports,null,2));
}finally{await browser?.close();await server.close();}
