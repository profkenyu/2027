import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
import {baseline,flightResponse,PlanetState,readTransfer,TRANSFER_KEY} from '../engine/core/planet-state.js';
import {displacement} from '../works/space/scene.js';
const storage=new Map();globalThis.sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const state=new PlanetState();for(let i=0;i<100;i++)state.observe('terra',.1,{height:30,x:100},.6);state.persist();assert(new PlanetState().snapshot('terra').observations>0);assert.equal(new PlanetState().snapshot('desert').observations,0);
const low=flightResponse({...baseline(),temperature:210,radiation:.1,energy:1}),high=flightResponse({...baseline(),temperature:270,radiation:.8,energy:.4});assert(high.radiator>low.radiator);assert(high.toneHz>low.toneHz);
assert.equal(state.departure('terra',.41).energy,.41);assert.equal(new PlanetState().snapshot('terra').energy,.41);
sessionStorage.setItem(TRANSFER_KEY,JSON.stringify({version:1,source:'terra',target:'desert',seed:'abcdef',stage:'flight',elapsed:NaN,environment:baseline()}));assert.equal(readTransfer(),null);
for(let t=0;t<64;t+=.1)assert(displacement(t+.1)>=displacement(t)-1e-6);
const server=await startPreviewServer();let browser;const report=[];await mkdir('output/qa/space-01',{recursive:true});
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
  await page.goto(`${server.url}/space-01.html?test&quality=${tier}`);await page.waitForFunction(()=>window.BTK_SPACE);
  // The requested gas shell adds one draw of the existing planet mesh.
  // Keep the earlier budget plus that exact, tier-dependent triangle cost.
  const atmosphereTriangles=tier==='low'?2*96*(64-1):2*144*(88-1);
  const frames=[];for(const t of [1,10,19,21,30,39,41,50,60,64]){const s=await page.evaluate(t=>{BTK_SPACE.seek(t);return BTK_SPACE.snapshot();},t);assert(s.independent);assert(s.triangles>5000&&s.triangles<100000+atmosphereTriangles);assert.equal(s.tier,tier);frames.push(s);if([10,30,50].includes(t))await page.screenshot({path:`output/qa/space-01/${tier}-${t}.png`});}
  await page.locator('#sound').click();await page.evaluate(()=>BTK_SPACE.seek(25));assert.equal((await page.evaluate(()=>BTK_SPACE.snapshot())).audio.state,'running');
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));assert((await page.evaluate(()=>BTK_SPACE.snapshot())).paused);await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
  assert.deepEqual(errors,[]);assert(requests.every(url=>url.startsWith(server.url+'/space-01.html')));
  report.push({tier,frames,errors});await page.close();console.log(`PASS ${tier}: first passage rendering / lifecycle / audio / self-contained`);
 }
 const open=await browser.newPage({viewport:{width:390,height:844}});await open.goto(`${server.url}/index.html?test`);await open.waitForFunction(()=>window.TI_OPENING_TEST&&window.TI_BLUEPRINT?.().models?.ship);await open.evaluate(()=>TI_OPENING_TEST.seek(1e6));await open.waitForTimeout(2000);assert.equal(await open.locator('#ti-prologue h1').innerText(),'BEYOND THE KNOWN - A Terraforming Project');assert.equal(await open.evaluate(()=>getComputedStyle(document.querySelector('#ti-prologue h1')).textTransform),'none');await open.screenshot({path:'output/qa/space-01/opening-mobile.png'});await open.close();
 await writeFile('output/qa/space-01/report.json',JSON.stringify(report,null,2));
 const resume=await browser.newPage({viewport:{width:1180,height:820}});
 await resume.goto(`${server.url}/index.html?test&quality=low`);await resume.waitForFunction(()=>window.TI_OPENING_TEST&&window.TI_BLUEPRINT?.().models?.ship);
 await resume.evaluate(environment=>{sessionStorage.setItem('beyond-known:transfer:v1',JSON.stringify({version:1,source:'terra',target:'desert',stage:'flight',seed:'abcdef',elapsed:25,environment}));dispatchEvent(new PageTransitionEvent('pageshow'));TI_OPENING_TEST.seek(1e6);},{...baseline(),energy:.41,radiation:.7});
 assert.equal(await resume.locator('#ti-start span').innerText(),'RESUME');await resume.locator('#ti-start').click();await resume.waitForURL('**/space-01.html?**');await resume.waitForFunction(()=>window.BTK_SPACE);
 const resumed=await resume.evaluate(()=>BTK_SPACE.snapshot());assert.equal(resumed.environment.energy,.41);assert.equal(resumed.response.toneHz,48.6);assert(!new URL(resume.url()).searchParams.has('fresh'));
 await resume.goto(`${server.url}/index.html?test&quality=low`);await resume.waitForFunction(()=>window.TI_OPENING_TEST&&window.TI_BLUEPRINT?.().models?.ship);await resume.evaluate(()=>TI_OPENING_TEST.seek(1e6));await resume.locator('#ti-restart').click();await resume.waitForURL('**/planet-01.html?**');
 assert.equal(await resume.evaluate(()=>sessionStorage.getItem('beyond-known:transfer:v1')),null);await resume.close();console.log('PASS: opening RESUME preserves flight state / NEW MISSION clears it');
}finally{await browser?.close();await server.close();}
