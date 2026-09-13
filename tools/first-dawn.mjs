import {chromium} from 'playwright';
import {startPreviewServer} from './lib/preview-server.mjs';
const server=await startPreviewServer();let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const [tier,width,height] of [['high',1600,900],['mid',1180,820],['low',390,844]]) {
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${server.url}/tools/first-dawn.html?quality=${tier}`);
    await page.waitForFunction(()=>window.ready).catch(e=>{throw Error(`${e.message}\n${errors.join('\n')}`);});
    await page.mouse.click(10,10);
    await page.evaluate(()=>{
      const a=preview.ambient;a.beginFinale();a.updateFinale(25);
      if(a.finaleVoices.length!==5 || !a.finaleActive || a.ctx.state!=='running')throw Error('Finale audio unavailable');
      a.endFinale();if(a.finaleVoices.length || a.finaleBus || a.finaleActive)throw Error('Finale audio did not release');
    });
    await page.evaluate(async()=>{
      await preview.render(6);
      if(preview.dawn.snapshot().ships!==2)throw Error('Arrival starts are not staggered');
      await preview.render(9);
      if(preview.dawn.snapshot().ships!==4)throw Error('Late arrival missing');
      const before=preview.dawn.ships.map(s=>s.position.clone());
      await preview.render(10);
      const speeds=preview.dawn.ships.slice(0,4).map((s,i)=>Math.round(s.position.distanceTo(before[i])*100));
      if(new Set(speeds).size!==4)throw Error('Approach speeds are not independent');
      for(let i=0;i<5;i++){
        const displacement=preview.dawn.ships[i].position.clone().sub(before[i]);
        if(Math.abs(displacement.dot(preview.dawn.right))>1e-7 || Math.abs(displacement.y)>1e-7)throw Error('Approach deviated from common vanishing direction');
      }
      if(preview.dawn.ships.length!==5)throw Error('Fleet must contain five arks');
      for(const s of preview.dawn.ships){
        const wire=s.getObjectByName('migration-structural-wireframe');
        if(!wire?.geometry.attributes.position.count || !wire.material.depthTest)throw Error('Structural wireframe unavailable');
      }
    });
    for(const seconds of [0,12,26,38]) {
      const state=await page.evaluate(s=>preview.render(s),seconds);
      if(state.ships!==(seconds<5?0:5) || !Number.isFinite(state.wave))throw Error('Invalid ending phase');
      await page.screenshot({path:`dist/first-dawn-${tier}-${seconds}.png`});
    }
    await page.evaluate(()=>{preview.dawn.reset();if(preview.dawn.group.visible||preview.dawn.active)throw Error('Reset failed');});
    if(errors.length)throw Error(errors.join('\n'));
    console.log({tier,phases:'pass',reset:'pass',audio:'pass',errors:0});await page.close();
  }
}finally{await browser?.close();await server.close();}
