import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const out='output/qa/exhibition-route';await mkdir(out,{recursive:true});
const server=await startPreviewServer(),report={started:new Date().toISOString(),events:[],errors:[],complete:false};let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text()+' @ '+m.location().url);});
 await page.goto(server.url+'/index.html?quality=low');await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship,null,{timeout:60000});
 const opening=await page.evaluate(()=>TI_BLUEPRINT());assert(!await page.evaluate(()=>!!window.TI_WORLD));report.events.push({opening});
 // Let noise, all blueprints and the text/START sequence run without seeking.
 await page.waitForFunction(()=>!document.querySelector('#ti-start').disabled,null,{timeout:90000});await page.screenshot({path:`${out}/opening-start.png`});await page.locator('#ti-start').click();
 const enter=async world=>{await page.waitForFunction(w=>window.TI_WORLD===w&&window.TI_CAMERA&&TI_PROLOGUE().released,world,{timeout:90000});};
 await enter('terra');await page.waitForTimeout(5000);const seed=await page.evaluate(()=>UNIVERSE_SEED);
 for(const [source,target,number] of [['terra','desert','01'],['desert','granite','02']]){
  if(source==='desert')await page.waitForFunction(()=>TI_SEQUENCE().voyage==='arrived'&&TI_SEQUENCE().water==='searching',null,{timeout:90000});
  const exploration=await page.evaluate(()=>({state:TI_SEQUENCE(),memory:TI_MEMORY().ledger}));report.events.push({exploration});
  await page.screenshot({path:`${out}/planet-${number}-exploration.png`});
  // Existing acquisition shortcut prepares evidence only. Docking, lift, both
  // 64-second flights and descents remain natural-time production behavior.
  await page.keyboard.press('Equal');console.log(`${source}: acquisition shortcut; natural docking / liftoff`);
  await page.waitForURL(`**/space-${number}.html?**`,{timeout:180000});await page.waitForFunction(()=>window.BTK_SPACE);
  const departure=await page.evaluate(()=>({transfer:JSON.parse(sessionStorage.getItem('beyond-known:transfer:v1')),memory:JSON.parse(sessionStorage.getItem('terra-incognita:mission-memory:v3'))}));
  assert.equal(departure.transfer.source,source);assert.equal(departure.transfer.target,target);assert.equal(departure.transfer.seed,seed);assert.equal(departure.memory.samples.length,6);if(number==='02')assert(departure.memory.water.confirmed);
  report.events.push({departure});await page.locator('#sound').click();await page.waitForTimeout(13000);await page.screenshot({path:`${out}/space-${number}.png`});
  await page.waitForURL(`**/planet-0${Number(number)+1}.html?**`,{timeout:90000});await enter(target);assert.equal(await page.evaluate(()=>TI_SEQUENCE().voyage),'descent');assert.equal(await page.evaluate(()=>UNIVERSE_SEED),seed);
  report.events.push({arrival:await page.evaluate(()=>TI_SEQUENCE())});console.log(`PASS space-${number}: natural flight → ${target} descent / evidence / seed`);
 }
 await page.waitForFunction(()=>TI_SEQUENCE().voyage==='arrived'&&TI_SEQUENCE().mission==='searching',null,{timeout:90000});await page.waitForTimeout(5000);
 const finalMemory=await page.evaluate(()=>TI_MEMORY().ledger);assert.equal(finalMemory.samples.length,6);assert(finalMemory.water.confirmed);report.events.push({finalMemory});
 await page.screenshot({path:`${out}/planet-03-exploration.png`});await page.keyboard.press('Equal');await page.waitForURL('**/ending.html',{timeout:45000});await page.waitForFunction(()=>window.FIRST_DAWN);assert.equal(await page.evaluate(()=>FIRST_DAWN.snapshot().total),6);await page.locator('#sound').click();
 await page.waitForFunction(()=>FIRST_DAWN.snapshot().seconds>=88,null,{timeout:130000});await page.screenshot({path:`${out}/ending-arrival.png`});
 await page.waitForFunction(()=>FIRST_DAWN.snapshot().seconds>=108,null,{timeout:45000});assert.equal(await page.locator('#line').innerText(),'우리는 이제 여기서 시작한다');await page.screenshot({path:`${out}/ending-caption.png`});report.events.push({ending:await page.evaluate(()=>FIRST_DAWN.snapshot())});
 await page.locator('#archive').click();await page.waitForURL('**/field-archive.html');await page.screenshot({path:`${out}/archive.png`});await page.goto(server.url+'/index.html?quality=low');await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship);assert(!await page.evaluate(()=>!!window.TI_WORLD));assert.deepEqual(report.errors,[]);
 report.complete=true;console.log('PASS full exhibition: natural opening → three missions / two flights → six-ship ending / captions / archive → independent opening');
}finally{report.finished=new Date().toISOString();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();await server.close();}
