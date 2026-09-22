import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const out='output/qa/flight-edit';await mkdir(out,{recursive:true});
const server=await startPreviewServer(),report={checks:[],errors:[],complete:false};let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{
  const frames=[];
  const sample=()=>{
   if(window.TI_SEQUENCE&&document.querySelector('#ti-shot-dissolve')){
    const phase=TI_SEQUENCE().voyage;
    if(['lift','descent','departing'].includes(phase))frames.push({phase,veil:+document.querySelector('#ti-shot-dissolve').style.opacity,audio:window.TI_AUDIO?.().flightEdit});
   }
   requestAnimationFrame(sample);
  };requestAnimationFrame(sample);window.__editFrames=frames;
  addEventListener('pagehide',()=>{if(frames.length)sessionStorage.setItem('edit-test:last',JSON.stringify(frames));});
 });
 await page.goto(server.url+'/planet-01.html?test&quality=low&fresh=1');
 await page.waitForFunction(()=>window.TI_WORLD==='terra'&&window.TI_CAMERA&&TI_PROLOGUE().released,null,{timeout:90000});
 for(const number of ['01','02']){
  if(number==='02')await page.waitForFunction(()=>TI_SEQUENCE().voyage==='arrived'&&TI_SEQUENCE().water==='searching',null,{timeout:90000});
  // Acquisition shortcut only; docking and lift use real elapsed time.
  await page.keyboard.press('Equal');
  await page.waitForURL(`**/space-${number}.html?**`,{timeout:180000});await page.waitForFunction(()=>window.BTK_SPACE);
  const departure=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('edit-test:last')));
  assert(departure.some(f=>f.phase==='lift'&&f.veil===1&&f.audio===0),'Departure must render fully black and silent before navigation');
  // Production arrival intentionally drops the test query. Re-enter the
  // testing surface only after verifying the genuine departure boundary.
  if(!await page.evaluate(()=>!!BTK_SPACE.seek)){
   const url=new URL(page.url());url.searchParams.set('test','');
   await page.goto(url.href);await page.waitForFunction(()=>window.BTK_SPACE?.seek);
  }
  assert.equal(await page.locator('#veil').evaluate(el=>+el.style.opacity),1);
  await page.locator('#sound').tap();
  await page.evaluate(()=>BTK_SPACE.seek(63.8));await page.waitForTimeout(900);
  const tail=await page.evaluate(()=>({veil:+document.querySelector('#veil').style.opacity,audio:BTK_SPACE.snapshot().audio}));
  assert.equal(tail.veil,1);assert(tail.audio.gain<.0001);
  await page.evaluate(()=>BTK_SPACE.arrive());
  const next=Number(number)+1;
  await page.waitForURL(`**/planet-0${next}.html?**`);await page.waitForFunction(()=>window.TI_SEQUENCE&&TI_SEQUENCE().voyage==='descent',null,{timeout:90000});
  await page.waitForTimeout(2600);
  const arrival=await page.evaluate(()=>window.__editFrames);
  assert(arrival.some(f=>f.veil>.95),'Arrival starts covered');
  assert(arrival.some(f=>f.veil===0),'Arrival reveals');
  assert(arrival.some(f=>f.audio===1),'Arrival audio envelope restores');
  await page.screenshot({path:`${out}/arrival-${next}.png`});
  report.checks.push({number,departure:departure.slice(-20),tail,arrival});
  console.log(`PASS ${number}: natural lift → covered navigation / silent flight tail → covered descent reveal`);
 }
 await page.waitForFunction(()=>TI_SEQUENCE().voyage==='arrived',null,{timeout:90000});
 assert.deepEqual(report.errors,[]);report.complete=true;
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();await server.close();}
