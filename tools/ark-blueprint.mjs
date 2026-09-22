import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
const root=new URL('../',import.meta.url),out='output/qa/ark-blueprint';await mkdir(out,{recursive:true});
const models=JSON.parse(await readFile(new URL('works/opening/blueprints.json',root),'utf8'));
assert.deepEqual([...new Set(models.ship.segmentParts)].sort(),[0,1,2,3,4]);assert(models.ship.dimensions.y>350,'Twin rings missing');
assert(models.ship.coords.every(Number.isFinite));
const server=await startPreviewServer();let browser;const report={cases:[],errors:[]};
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [tier,width,height,motion] of [['high',1440,1000,'no-preference'],['mid',1180,820,'no-preference'],['low',820,1180,'reduce'],['low',390,844,'no-preference'],['low',568,320,'reduce']]){
  const page=await browser.newPage({viewport:{width,height},isMobile:tier==='low',hasTouch:tier==='low'});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.emulateMedia({reducedMotion:motion});await page.goto(server.url+`/index.html?test&quality=${tier}`);await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship);
  const state=await page.evaluate(()=>{TI_OPENING_TEST.seek(TI_BLUEPRINT().duration-1000);return TI_BLUEPRINT();});
  assert.equal(state.current,'ship-hold');assert(state.annotationCount===5);assert(!await page.evaluate(()=>!!window.TI_WORLD));
  assert.match(await page.locator('.bp-spec').innerText(),/2 rings \/ 10 pressure modules/i);assert.match(await page.locator('.bp-spec').innerText(),/4 aft nozzles/i);
  const fit=await page.locator('.bp-drawing canvas').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;});assert(fit);
  await page.screenshot({path:`${out}/${tier}-${width}x${height}.png`});report.cases.push({tier,width,height,motion,state});await page.close();
 }
 assert.deepEqual(report.errors,[]);console.log('PASS twin-ring blueprint: five systems / all tiers / five viewports / reduced motion / independent opening');
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();await server.close();}
