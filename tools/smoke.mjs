import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
if (process.env.SEQUENCE === '1') {
  await import('./planet-route.mjs');
} else {
  const mobile = process.env.MOBILE === '1';
  const [width,height] = (process.env.VIEWPORT ?? '1600x900').split('x').map(Number);
  const root = new URL('../',import.meta.url);
  await mkdir(new URL('dist/',root),{recursive:true});
  const browser = await chromium.launch({channel:'chrome',headless:!process.env.HEADED,args:['--allow-file-access-from-files']});
  const page = await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  try {
    await page.emulateMedia({reducedMotion:mobile?'reduce':'no-preference'});
    await page.goto(process.argv[2] ?? new URL(`index.html?test&quality=${mobile?'low':'mid'}`,root).href);
    await page.waitForFunction(()=>window.TI_BLUEPRINT?.().models?.ship,null,{timeout:30000});
    const opening=await page.evaluate(()=>{
      const state=TI_BLUEPRINT();
      if(window.TI_WORLD)throw Error('Opening loaded the mission engine');
      if(TI_OPENING_TEST){
        for(const ms of [10000,17500,state.duration-1000]){
          TI_OPENING_TEST.seek(ms);
          const current=TI_BLUEPRINT();if(!current.annotationCount)throw Error('Missing blueprint callouts');
        }
        TI_OPENING_TEST.seek(state.duration);
      }
      return state.models;
    });
    const start=mobile?'#ti-mobile-start':'#ti-start';
    await page.waitForFunction(id=>document.querySelector(id)?.disabled===false,start,{timeout:45000});
    await page.locator(start).click();
    await page.waitForURL('**/planet.html?**');
    await page.waitForFunction(()=>window.TI_WORLD&&window.TI_CAMERA&&window.TI_PROLOGUE?.().released,null,{timeout:60000});
    await page.waitForFunction(()=>!TI_CAMERA().locked,null,{timeout:15000});
    const initial=await page.evaluate(()=>TI_EXPERIENCE());
    if(!initial.auto)throw Error('AUTO is not the initial drive mode');
    await page.locator('#ti-light').click();
    await page.waitForFunction(()=>document.getElementById('ti-light').dataset.lightState==='off');
    await page.locator('#ti-light').click();
    await page.waitForFunction(()=>document.getElementById('ti-light').dataset.lightState==='on');
    await page.locator('#ti-camera').click();
    await page.waitForFunction(()=>TI_CAMERA().source==='manual'&&TI_CAMERA().shot==='rear');
    await page.locator('#ti-camera').click();
    await page.waitForFunction(()=>TI_CAMERA().shot==='mast');
    if(!(await page.evaluate(()=>TI_CAMERA().roverPOV)))throw Error('Mast POV not active');
    await page.locator('#ti-drive-mode').click();
    await page.waitForFunction(()=>!TI_EXPERIENCE().auto);
    await page.waitForTimeout(1100);
    if((await page.evaluate(()=>TI_EXPERIENCE())).auto)throw Error('MANUAL did not persist');
    await page.locator('#ti-drive-mode').click();
    await page.waitForFunction(()=>TI_EXPERIENCE().auto);
    const beforeGreen=await page.locator('#ti-green').getAttribute('data-green-current');
    await page.locator('#ti-green').click();
    await page.waitForFunction(before=>document.getElementById('ti-green').dataset.greenCurrent!==before,beforeGreen);
    await page.locator('#ti-green').click();
    const soundBefore=await page.locator('#ti-sound').getAttribute('aria-pressed');
    await page.locator('#ti-sound').click();
    await page.waitForFunction(before=>document.getElementById('ti-sound').getAttribute('aria-pressed')!==before,soundBefore);
    await page.locator('#ti-sound').click();
    const layout=await page.evaluate(()=>{
      const ids=['ti-sound','ti-light','ti-camera','ti-field-archive','ti-drive-mode','ti-green'];
      const boxes=ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return{id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}});
      for(const r of boxes)if(r.width<24||r.height<24||r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)throw Error('Control outside viewport '+r.id);
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j];if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)throw Error('Controls overlap '+a.id+'/'+b.id);
      }
      if(document.documentElement.scrollWidth>innerWidth+1)throw Error('Horizontal overflow');
      return {world:TI_WORLD,camera:TI_CAMERA(),drive:TI_EXPERIENCE(),boxes};
    });
    await page.waitForTimeout(Number(process.env.DWELL ?? 1500));
    await page.screenshot({path:new URL(`dist/smoke-${mobile?`${width}x${height}`:'desktop'}.png`,root).pathname});
    if(errors.length)throw Error(errors.join('\n'));
    console.log(JSON.stringify({opening:Object.keys(opening),mobile,width,height,world:layout.world,controls:'light/camera/mast/AUTO/MANUAL/GREEN/audio pass',layout:'pass',errors:0}));
  } finally {await browser.close();}
}
