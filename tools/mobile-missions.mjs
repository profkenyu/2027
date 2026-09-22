import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const out='output/qa/mobile-missions';await mkdir(out,{recursive:true});
const server=await startPreviewServer();let browser;
const report={started:new Date().toISOString(),events:[],errors:[],complete:false};
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(server.url+'/planet-01.html?quality=low&fresh=1');
 await page.waitForFunction(()=>window.TI_WORLD==='terra'&&window.TI_CAMERA&&TI_PROLOGUE().released,null,{timeout:90000});
 // Only prerequisite planet-1 records use the existing shortcut. Neither of
 // the requested planet-2/3 missions uses force acquisition or teleports.
 await page.keyboard.press('Equal');await page.waitForFunction(()=>TI_MEMORY().ledger.samples.length===6);
 await page.goto(server.url+'/planet-02.html?quality=low');
 await page.waitForFunction(()=>window.TI_SEQUENCE?.().water==='searching'&&TI_SEQUENCE().voyage==='arrived',null,{timeout:90000});
 for(const [width,height] of [[390,844],[568,320],[844,390],[320,568]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(1200);
  const layout=await page.evaluate(()=>{
   const ids=['ti-sound','ti-light','ti-camera','ti-field-archive','ti-drive-mode','ti-green'];
   const boxes=ids.map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect(),s=getComputedStyle(el);let opacity=+s.opacity;for(let p=el.parentElement;p;p=p.parentElement)opacity*=+getComputedStyle(p).opacity;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id,x:r.x,y:r.y,w:r.width,h:r.height,opacity,hit:el.contains(hit),display:s.display};});
   return {boxes,width:innerWidth,height:innerHeight,classes:document.body.className,tools:document.getElementById('ti-rover-tools').getAttribute('style'),html:document.documentElement.getAttribute('style'),state:TI_SEQUENCE()};
  });
  report.events.push({layout});await page.screenshot({path:`${out}/planet02-${width}x${height}.png`});
  for(const b of layout.boxes){assert(b.opacity>.1&&b.display!=='none'&&b.hit,`Hidden/covered ${width} ${b.id} ${JSON.stringify(layout)}`);assert(b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1,`Offscreen ${width} ${b.id}`);}
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#ti-light').tap();await page.locator('#ti-light').tap();
 const end=Date.now()+900000;
 while(Date.now()<end&&!page.url().includes('/ending.html')){
  await page.waitForTimeout(10000);
  const state=await page.evaluate(()=>window.TI_SEQUENCE?{...TI_SEQUENCE(),memory:TI_MEMORY().ledger,geology:TI_MEMORY().geological,drive:TI_EXPERIENCE()}:window.BTK_SPACE?.snapshot()??null);
  report.events.push({url:page.url(),state});
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(state&&{world:state.world,water:state.water,distance:state.world==='granite'?state.geology?.distance:state.waterDistance,node:state.geologicalNode,mission:state.mission,docking:state.docking,voyage:state.voyage,seconds:state.seconds}));
 }
 assert(page.url().includes('/ending.html'),'Natural missions timed out');
 await page.waitForFunction(()=>window.FIRST_DAWN);await page.screenshot({path:`${out}/ending.png`});
 assert.deepEqual(report.errors,[]);report.complete=true;
 console.log('PASS mobile: natural water scan → docking → flight → three natural geological scans → ending');
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();await server.close();}
