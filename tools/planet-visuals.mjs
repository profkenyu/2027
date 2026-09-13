import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreviewServer } from './lib/preview-server.mjs';
const out = new URL('../output/qa/planet-upgrade/', import.meta.url);
await mkdir(out, { recursive: true });
const server = await startPreviewServer();
let browser;
const reports = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  for (const tier of ['high', 'mid', 'low']) {
    const page = await browser.newPage({viewport: tier === 'low' ? {width:390,height:844} : {width:1400,height:1000}});
    const errors = [];page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.goto(`${server.url}/tools/vehicle-model.html?quality=${tier}`);
    await page.waitForFunction(()=>window.ready);
    const report = await page.evaluate(async tier=>{
      const THREE = await import('three');
      const { VoyageSequence } = await import('../engine/core/voyage.js');
      const { flightProfile } = await import('../engine/core/flight-profiles.js');
      const { ShotDirector } = await import('../engine/core/shot-director.js');
      const { buildSky } = await import('../engine/world/sky.js');
      const { shadeSky, setWorldMode } = await import('../works/terra_incognita/surface.js');
      const { renderer, lander, rover } = preview;
      renderer.setSize(innerWidth,innerHeight);
      const camera = new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,2200);
      const scene = new THREE.Scene();scene.background = new THREE.Color(0x010203);
      const sky = buildSky(shadeSky);scene.add(sky,lander.group);
      const voyage = new VoyageSequence({lander,rover,camera,onSwap:()=>{lander.place(0,0,0);lander.group.position.set(0,0,0);}});
      scene.add(voyage.group);
      const director = new ShotDirector({camera,rover,lander,voyage,restoration:{group:{visible:false}},docking:{started:false},heightAt:()=>0});
      const samples = [];
      for(const key of ['terra','desert','granite']) {
        voyage.reset();lander.group.position.set(0,0,0);lander.group.rotation.set(0,0,0);
        voyage.start({key,id:key,label:key,start:[0,0],mission:'test'},0);
        voyage.departureProfile = flightProfile(key);
        await voyage.beforeRover(1500);
        const liftStart = voyage.t0, profile = flightProfile(key);
        await voyage.beforeRover(liftStart + profile.ignitionMs + profile.liftMs*.5);
        director.underside(3000);
        const ascent = {position:lander.group.position.toArray(),camera:director._camera.toArray(),fov:camera.fov};
        await voyage.beforeRover(liftStart + profile.ignitionMs + profile.liftMs);
        const transitStart = voyage.t0;
        await voyage.beforeRover(transitStart+5000);
        let lines=0;voyage.group.traverse(o=>{if(o.isLine)lines++});
        if(lines)throw Error('Transit contains line geometry');
        const starsBefore=voyage.layers[0].points.geometry.attributes.position.array.slice();
        await voyage.beforeRover(transitStart+7000);
        if(starsBefore.some((v,i)=>v!==voyage.layers[0].points.geometry.attributes.position.array[i]))throw Error('Star position mutated');
        await voyage.beforeRover(transitStart+15000);
        const descentStart=voyage.t0;
        await voyage.beforeRover(descentStart+profile.descentMs*.5);
        director.underside(4000);
        const descent={position:lander.group.position.toArray(),camera:director._camera.toArray(),fov:camera.fov};
        await voyage.beforeRover(descentStart+profile.descentMs);
        if(Math.hypot(lander.group.position.x-voyage.flightOrigin.x,lander.group.position.z-voyage.flightOrigin.z,lander.group.position.y-lander.site.y)>1e-6||voyage.phase!=='settle')throw Error('Landing datum mismatch '+key);
        samples.push({key,ascent,descent,touchdown:'exact',starLines:lines});
      }
      window.visualQA={scene,camera,sky,voyage,director,renderer,lander,async render(key,phase){
        voyage.reset();lander.group.position.set(0,0,0);lander.group.rotation.set(0,0,0);lander.setRestorationLevel(4);
        setWorldMode(key);sky.visible=phase!=='transit';
        voyage.start({key,id:key,label:key,start:[0,0],mission:'test'},0);
        voyage.departureProfile=flightProfile(key);voyage.arrivalProfile=flightProfile(key);
        voyage.phase=phase;voyage.t0=0;voyage.baseY=0;
        if(phase==='transit') {voyage.group.visible=true;await voyage.beforeRover(5000);director.underside(5000);}
        else {await voyage.beforeRover(flightProfile(key).descentMs*.6);director.underside(3000);}
        director.applyPortraitSafeFrame('ascent');camera.position.copy(director._camera);camera.lookAt(director._aim);camera.updateProjectionMatrix();
        voyage.afterRover();sky.position.copy(camera.position);renderer.render(scene,camera);
      }};
      return {tier,samples,stars:voyage.layers.reduce((n,l)=>n+l.points.geometry.attributes.position.count,0)};
    },tier);
    for(const key of ['terra','desert','granite']) {
      await page.evaluate(key=>visualQA.render(key,'descent'),key);
      await page.screenshot({path:new URL(`${tier}-${key}.png`,out).pathname});
    }
    await page.evaluate(()=>visualQA.render('terra','transit'));
    await page.screenshot({path:new URL(`${tier}-space.png`,out).pathname});
    if(errors.length)throw Error(errors.join('\n'));
    await page.goto(`${server.url}/index.html?test&quality=${tier}`);
    await page.waitForFunction(()=>TI_BLUEPRINT()?.models?.ship);
    const plate=await page.evaluate(()=>{
      const state=TI_BLUEPRINT();TI_OPENING_TEST.seek(state.duration-1000);
      const e=document.querySelector('.bp-spec');
      return {...TI_BLUEPRINT(),overflow:e.scrollHeight>e.clientHeight+1};
    });
    if(plate.current!=='ship-hold'||plate.annotationCount!==5||plate.overflow)throw Error('Ship blueprint layout failure '+JSON.stringify(plate));
    await page.screenshot({path:new URL(`${tier}-blueprint.png`,out).pathname});
    report.blueprint={annotations:plate.annotationCount,segments:plate.models.ship.segments,overflow:plate.overflow};
    reports.push(report);console.log(JSON.stringify(report));await page.close();
  }
  await writeFile(new URL('report.json',out),JSON.stringify(reports,null,2));
} finally {await browser?.close();await server.close();}
