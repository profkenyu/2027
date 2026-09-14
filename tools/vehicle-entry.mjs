import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
const server=await startPreviewServer({routes:{'/external':'<link rel="icon" href="data:,"><a href="/index.html?test&quality=low">Enter</a>'}});
const browser=await chromium.launch({channel:'chrome',headless:true});
async function opening(page){
 await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship,null,{timeout:30000});
 if(await page.evaluate(()=>!!window.TI_WORLD))throw Error('Opening loaded mission engine');
}
async function start(page){
 await page.evaluate(()=>TI_OPENING_TEST.seek(TI_BLUEPRINT().duration));
 await page.locator((await page.evaluate(()=>innerWidth<700))?'#ti-mobile-start':'#ti-start').click();
 await page.waitForURL('**/planet-01.html?**');
 await page.waitForFunction(()=>window.TI_WORLD&&window.TI_CAMERA&&window.TI_PROLOGUE?.().released||document.getElementById('fh-gate')||document.getElementById('fh-fatal'),null,{timeout:60000});
}
try{
 const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
 const gate=await blocked.newPage();await gate.goto(server.url+'/index.html?test');await opening(gate);await start(gate);
 if(!await gate.locator('#fh-gate').count()||await gate.evaluate(()=>!!window.TI_WORLD))throw Error('Unsupported GPU was accepted');
 console.log('Unsupported GPU: opening works, mission gate rejects');await blocked.close();
 for(const external of [false,true]){
  const context=await browser.newContext({viewport:external?{width:390,height:844}:{width:1400,height:1000},isMobile:external,hasTouch:external});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.url())});
  if(external){await page.goto(server.url+'/external');await page.getByRole('link',{name:'Enter'}).click();}
  else await page.goto(server.url+'/index.html?test&quality=low');
  await opening(page);await page.reload();await opening(page);await start(page);
  if(!await page.evaluate(()=>!!window.TI_WORLD&&!!window.TI_CAMERA))throw Error('Artwork did not initialize');
  await page.reload();await page.waitForFunction(()=>window.TI_WORLD&&window.TI_PROLOGUE?.().released,null,{timeout:60000});
  await page.goBack();await opening(page);
  if(errors.length)throw Error(errors.join('\n'));console.log({entry:external?'external-mobile':'direct-desktop',openingReload:'pass',missionReload:'pass',historyReturn:'pass'});await context.close();
 }
}finally{await browser.close();await server.close();}
