import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const server=await startPreviewServer();let browser;const report={events:[],errors:[]};await mkdir('output/qa/first-passage-route',{recursive:true});
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(server.url+'/planet-01.html?quality=low&fresh=1');await page.waitForFunction(()=>window.TI_WORLD==='terra'&&window.TI_CAMERA&&TI_PROLOGUE().released,null,{timeout:60000});
 await page.waitForTimeout(4000);const before=await page.evaluate(()=>TI_PLANET_STATE());assert(before.worlds.terra.observations>0);
 await page.keyboard.press('Equal');console.log('Acquisition shortcut requested; docking and lift remain real-time.');
 await page.waitForURL('**/space-01.html?**',{timeout:180000});await page.waitForFunction(()=>window.BTK_SPACE);
 const departure=await page.evaluate(()=>({state:BTK_SPACE.snapshot(),memory:JSON.parse(sessionStorage.getItem('terra-incognita:mission-memory:v3')),transfer:JSON.parse(sessionStorage.getItem('beyond-known:transfer:v1'))}));
 assert.equal(departure.memory.samples.length,6);assert.equal(departure.transfer.target,'desert');assert.equal(departure.state.environment.temperature,departure.transfer.environment.temperature);report.events.push({departure});
 console.log('PASS: actual docking / lift → independent space-01, six samples and PlanetState preserved');
 await page.waitForTimeout(6000);const savedTime=await page.evaluate(()=>BTK_SPACE.snapshot().seconds);await page.reload();await page.waitForFunction(()=>window.BTK_SPACE);const resumedTime=await page.evaluate(()=>BTK_SPACE.snapshot().seconds);assert(resumedTime>=savedTime-2.5&&resumedTime<=savedTime+3);
 await page.locator('#sound').click();console.log('PASS: first-passage reload resumes saved flight time');
 await page.waitForURL('**/planet-02.html?**',{timeout:90000});await page.waitForFunction(()=>window.TI_WORLD==='desert'&&window.TI_CAMERA&&window.TI_SEQUENCE,null,{timeout:60000});
 const arrival=await page.evaluate(()=>({sequence:TI_SEQUENCE(),seed:UNIVERSE_SEED,ledger:TI_MEMORY().ledger}));assert.equal(arrival.sequence.voyage,'descent');assert.equal(arrival.seed,departure.transfer.seed);assert.equal(arrival.ledger.samples.length,6);report.events.push({arrival});
 await page.screenshot({path:'output/qa/first-passage-route/planet-02-descent.png'});
 await page.waitForFunction(()=>TI_SEQUENCE().voyage==='arrived'&&TI_SEQUENCE().water==='searching',null,{timeout:60000});
 await page.waitForTimeout(5500);const settled=await page.evaluate(()=>({state:TI_PLANET_STATE(),sequence:TI_SEQUENCE(),checkpoint:TI_CHECKPOINT()}));assert(settled.state.worlds.desert.observations>0);assert(settled.state.worlds.terra.observations>0);report.events.push({settled});
 await page.screenshot({path:'output/qa/first-passage-route/planet-02-exploration.png'});
 await page.reload();await page.waitForFunction(()=>window.TI_WORLD==='desert'&&TI_CHECKPOINT().restored,null,{timeout:60000});assert.equal(await page.evaluate(()=>TI_SEQUENCE().voyage),'arrived');
 assert.deepEqual(report.errors,[]);console.log('PASS: natural 64s flight → planet-02 descent → rover exploration / checkpoint reload / preserved seed and samples');
}finally{await writeFile('output/qa/first-passage-route/report.json',JSON.stringify(report,null,2));await browser?.close();await server.close();}
