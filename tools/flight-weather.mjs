import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {exposureAt,createSurveyor} from '../works/space/model.js';
import {PerspectiveCamera,Group,Vector3} from 'three';
import {pose} from '../works/space/scene.js';
import {startPreviewServer} from './lib/preview-server.mjs';
assert.equal(exposureAt(64,1),exposureAt(0,2));
for(const tier of ['high','mid','low']){
 const model=createSurveyor(tier,2);model.update(32,{radiator:.5});assert.equal(model.exposure().amount,.75);assert(model.exposure().materials>0);
 model.update(0,{radiator:.5});model.update(32,{radiator:.5});assert.equal(model.exposure().amount,.75);
}
for(const passage of [1,2])for(const aspect of [1.6,390/844,844/390]){
 const camera=new PerspectiveCamera(45,aspect,.25,30000),ship=new Group();let prev=null,maxAngle=0,minDistance=Infinity;
 for(let i=1;i<64*120;i++){
  pose(camera,ship,i/120,passage);const direction=camera.getWorldDirection(new Vector3());
  if(prev){maxAngle=Math.max(maxAngle,direction.angleTo(prev));assert(direction.angleTo(prev)<.025,'Abrupt camera angular jump');}
  minDistance=Math.min(minDistance,camera.position.distanceTo(ship.position));prev=direction;
 }
 assert(minDistance>11);
}
const server=await startPreviewServer(),report={frames:[],errors:[]};let browser;
await mkdir('output/qa/flight-weather',{recursive:true});
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]])for(const passage of [1,2]){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(`${server.url}/space-0${passage}.html?test&quality=${tier}`);await page.waitForFunction(()=>window.BTK_SPACE);
  for(const t of [0,19,20,21,30,39,40,41,60,64]){
   const s=await page.evaluate(t=>{BTK_SPACE.seek(t);return BTK_SPACE.exposure();},t);assert.equal(s.amount,exposureAt(t,passage));report.frames.push({tier,passage,t,...s});
   if([20,30,40].includes(t))await page.screenshot({path:`output/qa/flight-weather/${tier}-${passage}-${t}.png`});
  }
  await page.close();console.log(`PASS ${tier} passage ${passage}: progressive fixed-surface exposure / compiled shaders / transition frames`);
 }
 assert.deepEqual(report.errors,[]);await writeFile('output/qa/flight-weather/report.json',JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
