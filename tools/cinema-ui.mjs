import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const out='output/qa/cinema-ui';await mkdir(out,{recursive:true});
const server=await startPreviewServer(),report={cases:[],errors:[]};let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const file of ['space-01','space-02','ending']){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(`${server.url}/${file}.html?test&quality=low`);
  await page.waitForFunction(()=>window.BTK_SPACE||window.FIRST_DAWN);await page.waitForTimeout(1400);
  for(const [width,height] of [[1600,1000],[390,844],[320,568],[568,320],[844,390],[820,1180]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>window.FIRST_DAWN?FIRST_DAWN.seek(108):BTK_SPACE.seek(30));await page.waitForTimeout(180);
   const layout=await page.evaluate(()=>{
    const footer=document.querySelector('footer');
    return {text:footer.innerText,overflow:document.documentElement.scrollWidth>innerWidth+1,buttons:[...footer.querySelectorAll('button,a')].filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect();return{id:e.id,x:r.x,y:r.y,w:r.width,h:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})};
   });
   assert(!layout.overflow);assert(!/PLANET|→/.test(layout.text));
   for(const b of layout.buttons){assert(b.w>=44&&b.h>=44);assert(b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1,`${file} ${width} ${JSON.stringify(b)}`);assert(b.hit,`Covered ${file} ${b.id}`);}
   report.cases.push({file,width,height,layout});
   if(width===320||width===568)await page.screenshot({path:`${out}/${file}-${width}.png`});
  }
  // Browser-toolbar/keyboard viewport contraction, without altering layout viewport.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const v=new EventTarget();Object.assign(v,{width:390,height:620,offsetLeft:0,offsetTop:20});Object.defineProperty(window,'visualViewport',{configurable:true,value:v});window.dispatchEvent(new Event('resize'));});
  await page.waitForTimeout(200);
  const visible=await page.evaluate(()=>{const r=document.querySelector('footer').getBoundingClientRect();return{top:r.top,bottom:r.bottom};});
  assert(visible.top>=20&&visible.bottom<=640,`${file} visual viewport ${JSON.stringify(visible)}`);
  await page.close();console.log(`PASS ${file}: six viewport sizes / 44px targets / footer hit-testing / contracted visual viewport`);
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();await server.close();}
