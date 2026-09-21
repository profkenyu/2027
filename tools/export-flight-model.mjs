import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
const server=await startPreviewServer();let browser;
const models={};
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const tier of ['high','mid','low']){
    const page=await browser.newPage();await page.goto(`${server.url}/tools/vehicle-model.html?quality=${tier}`);
    await page.waitForFunction(()=>window.ready);
    const batches=await page.evaluate(async()=>{
      const THREE=await import('../vendor/three.webgpu.js');
      const {lander}=preview;lander.setRestorationLevel(4);lander.setRamp(0);lander.setLegFold(1);lander.group.visible=true;lander.group.updateMatrixWorld(true);
      const groups=new Map(),inverse=lander.group.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),normal=new THREE.Matrix3();
      lander.group.traverseVisible(o=>{
        if(!o.isMesh||!o.geometry?.attributes.position||o===lander.exhaust.mesh||o.userData.flightHardware)return;
        const mat=o.material;if(Array.isArray(mat))return;
        const surface=mat.userData?.flightSurface;
        const rgb=surface?.rgb??(mat.color?mat.color.toArray():[.09,.10,.11]);
        const roughness=surface?Math.max(.36,1-surface.sheen):.65,metalness=surface?.gloss>=58?.52:.12;
        const key=JSON.stringify({rgb,roughness,metalness});if(!groups.has(key))groups.set(key,{rgb,roughness,metalness,p:[],n:[]});
        const bucket=groups.get(key),g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;
        matrix.multiplyMatrices(inverse,o.matrixWorld);normal.getNormalMatrix(matrix);
        const p=new THREE.Vector3(),n=new THREE.Vector3();
        for(let i=0;i<g.attributes.position.count;i++){
          p.fromBufferAttribute(g.attributes.position,i).applyMatrix4(matrix);
          if(Math.max(...p.toArray().map(Math.abs))>16)throw Error('Model exceeds quantization bounds');
          n.fromBufferAttribute(g.attributes.normal,i).applyMatrix3(normal).normalize();
          bucket.p.push(...p.toArray());bucket.n.push(...n.toArray());
        }
        if(g!==o.geometry)g.dispose();
      });return [...groups.values()];
    });
    models[tier]=batches.map(({p,n,...material})=>({...material,count:p.length/3,p:Buffer.from(Int16Array.from(p,v=>Math.round(v*2000)).buffer).toString('base64'),n:Buffer.from(Int8Array.from(n,v=>Math.round(v*127)).buffer).toString('base64')}));
    console.log(`${tier}: ${batches.reduce((n,b)=>n+b.p.length/9,0)} triangles, ${batches.length} material batches`);await page.close();
  }
  await mkdir('works/space',{recursive:true});await writeFile('works/space/lander-model.json',JSON.stringify(models));
}finally{await browser?.close();await server.close();}
