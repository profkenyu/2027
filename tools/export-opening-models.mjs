import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const server=await startPreviewServer();let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage();
  await page.goto(`${server.url}/tools/vehicle-model.html?quality=high`);
  await page.waitForFunction(()=>window.ready);
  const data=await page.evaluate(async()=>{
    const {OpeningBlueprintSequence}=await import('../works/terra_incognita/opening-blueprints.js');
    const {createReferenceArk}=await import('../works/first_dawn/reference-ark.js');
    const ship=createReferenceArk('high');
    for(const {pivot} of ship.userData.deployables)pivot.rotation.z=0;
    const bp=new OpeningBlueprintSequence({rover:preview.rover,lander:preview.lander,ship,tier:'high'});bp._capture();
    return Object.fromEntries(Object.entries(bp.models).map(([key,m])=>[key,{coords:Array.from(m.coords,n=>Math.round(n*10000)/10000),segmentParts:Array.from(m.segmentParts),segments:m.segments,sourceSegments:m.sourceSegments,meshes:m.meshes,parts:m.parts,dimensions:m.dimensions}]));
  });
  await writeFile(new URL('../works/opening/blueprints.json',import.meta.url),JSON.stringify(data));
  console.log(Object.fromEntries(Object.entries(data).map(([k,m])=>[k,{segments:m.segments,meshes:m.meshes}])));
}finally{await browser?.close();await server.close();}
