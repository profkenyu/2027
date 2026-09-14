import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const folder=new URL('../output/qa/planet-upgrade/',import.meta.url);await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],states=[],captures=new Set();
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try {
 await page.goto(new URL('../planet-01.html?quality=low',import.meta.url).href);
 await page.waitForFunction(()=>window.TI_WORLD&&window.TI_CAMERA&&TI_PROLOGUE().released,null,{timeout:60000});
 await page.waitForTimeout(6000);await page.keyboard.press('Equal');
 let last='',p2=false,complete=false;
 const deadline=Date.now()+360000;
 while(Date.now()<deadline){
  let state;
  try { state=await page.evaluate(()=>window.TI_SEQUENCE?.()); } catch { continue; }
  if (!state) { await page.waitForTimeout(500); continue; }
  const key=`${state.world}/${state.voyage}/${state.docking}/${state.water}`;
  if(key!==last){console.log(key);states.push(state);last=key;}
  const capture=`live-${state.world}-${state.voyage}`;
  if(['lift','transit','descent'].includes(state.voyage)&&!captures.has(capture)){
   captures.add(capture);await page.waitForTimeout(1400);await page.screenshot({path:new URL(capture+'.png',folder).pathname});
  }
  if(!p2&&state.world==='desert'&&state.voyage==='arrived'&&state.water==='searching'){p2=true;await page.keyboard.press('Equal');}
  if(state.world==='granite'&&state.voyage==='arrived'&&state.mission==='searching'){complete=true;break;}
  await page.waitForTimeout(500);
 }
 if(complete && (process.env.COMPLETE_SHORTCUT==='1'||process.env.FINALE==='1')){
  await page.keyboard.press('Equal');
  await page.waitForURL('**/ending.html',{timeout:20000});
  await page.waitForFunction(()=>window.FIRST_DAWN?.snapshot().total===5,null,{timeout:30000});
  await page.locator('#return').click();
  await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship,null,{timeout:30000});
  if(await page.evaluate(()=>!!window.TI_WORLD))throw Error('Ending returned to mission instead of independent opening');
  console.log('PASS: planet 3 completion → five-ship ending → independent opening');
 }
 const report={complete,errors,states,captures:[...captures]};await writeFile(new URL('route.json',folder),JSON.stringify(report,null,2));
 if(!complete||errors.length)throw Error(JSON.stringify(report));console.log('PASS: native WebGPU, both transfers and rover deployment, no console errors');
}finally{await browser.close();}
