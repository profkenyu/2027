import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const out='output/qa/mobile-reentry';await mkdir(out,{recursive:true});
// Reuse evidence from a completed real exhibition traversal, not invented samples.
const prior=JSON.parse(await readFile('output/qa/exhibition-route/report.json','utf8'));
const ledger=prior.events.find(e=>e.finalMemory)?.finalMemory;assert.equal(ledger?.samples.length,6);assert(ledger.water.confirmed);
const server=await startPreviewServer({routes:{'/external':'<link rel="icon" href="data:,"><a href="/planet-03.html?quality=low">Enter</a>'}});
let browser;const report={checks:[],errors:[]};
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(server.url+'/external');await page.evaluate(ledger=>sessionStorage.setItem('terra-incognita:mission-memory:v3',JSON.stringify(ledger)),ledger);
 await page.getByRole('link',{name:'Enter',exact:true}).click();
 const ready=()=>page.waitForFunction(()=>window.TI_WORLD==='granite'&&TI_SEQUENCE().voyage==='arrived'&&TI_SEQUENCE().mission==='searching',null,{timeout:90000});await ready();await page.waitForTimeout(1500);
 async function controls(label){
  const state=await page.evaluate(()=>({classes:document.body.className,hidden:['ti-rover-tools','fh-mission','ti-monitor'].filter(id=>+getComputedStyle(document.getElementById(id)).opacity<.1)}));
  assert(!state.classes.includes('ti-voyage'));assert.deepEqual(state.hidden,[]);
  await page.locator('#ti-drive-mode').tap();await page.waitForFunction(()=>TI_EXPERIENCE().mode==='explorer');
  await page.locator('#ti-mobile-steer').waitFor({state:'visible'});await page.locator('#ti-drive-mode').tap();await page.waitForFunction(()=>TI_EXPERIENCE().mode==='observer');
  report.checks.push({label,state});await page.screenshot({path:`${out}/${label}.png`});
 }
 await controls('cold-entry');await page.waitForTimeout(6000);await page.reload();await ready();await page.waitForTimeout(1500);assert(await page.evaluate(()=>TI_CHECKPOINT().restored));await controls('reload');
 await page.locator('#ti-field-archive').tap();await page.waitForURL('**/field-archive.html');await page.goBack();await ready();await page.waitForTimeout(1500);await controls('history-return');
 const blocked=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await blocked.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Storage disabled','SecurityError');}});});
 const noStore=await blocked.newPage();noStore.on('pageerror',e=>report.errors.push(String(e)));await noStore.goto(server.url+'/planet-01.html?quality=low');await noStore.waitForFunction(()=>window.TI_CAMERA&&TI_PROLOGUE().released,null,{timeout:90000});
 assert.equal(await noStore.locator('#arrive').evaluate(e=>e.style.opacity),'0');report.checks.push({label:'storage-denied',boot:'visible',persistence:'unavailable by design'});await blocked.close();
 assert.deepEqual(report.errors,[]);console.log('PASS planet 3 mobile: external landing / visible controls / MANUAL touch / reload / history / storage-denied boot');
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();await server.close();}
