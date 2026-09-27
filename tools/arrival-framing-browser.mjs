import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
import {baseline} from '../engine/core/planet-state.js';
const out='output/qa/arrival-framing';await mkdir(out,{recursive:true});
const server=await startPreviewServer(),report={checks:[],errors:[],complete:false};let browser;
try {
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [quality,viewport] of [['high',{width:1440,height:900}],['mid',{width:1024,height:768}],['low',{width:390,height:844}]]) for(const passage of [1,2]) {
  const page=await browser.newPage({viewport});page.on('pageerror',e=>report.errors.push(String(e)));
  const source=passage===1?'terra':'desert',target=passage===1?'desert':'granite';
  // Explicit fixture: tests the real page handoff, not prior mission completion.
  await page.addInitScript(t=>{if(!sessionStorage.getItem('beyond-known:transfer:v1'))sessionStorage.setItem('beyond-known:transfer:v1',JSON.stringify(t));},{version:1,source,target,stage:'flight',seed:'a1b2c3',elapsed:61,environment:baseline(source)});
  await page.goto(`${server.url}/space-0${passage}.html?test&quality=${quality}`);
  await page.waitForFunction(()=>window.BTK_SPACE?.seek);
  await page.evaluate(()=>BTK_SPACE.seek(61.6));
  await page.screenshot({path:`${out}/${quality}-${passage}-space.png`});
  await page.evaluate(()=>BTK_SPACE.arrive());
  await page.waitForFunction(()=>window.TI_SEQUENCE?.().voyage==='descent'&&window.TI_CAMERA,null,{timeout:90000});
  await page.waitForTimeout(1600);
  await page.screenshot({path:`${out}/${quality}-${passage}-landing.png`});
  await page.waitForFunction(()=>TI_SEQUENCE().voyage==='arrived',null,{timeout:90000});
  assert.equal(await page.evaluate(()=>TI_WORLD),target);
  report.checks.push({quality,passage,world:target,arrived:true});
  console.log(`PASS ${quality} passage ${passage}: actual navigation / visible descent / arrived`);
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.complete=true;
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();await server.close();}
