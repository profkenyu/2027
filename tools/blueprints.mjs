import { chromium } from 'playwright';
import { startPreviewServer } from "./lib/preview-server.mjs";
const server = await startPreviewServer();
let browser;
try {
  browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
  for (const test of [
    {name: 'desktop', width: 1400, height: 1000, motion: 'no-preference', tier: 'high'},
    {name: 'ipad', width: 820, height: 1180, motion: 'no-preference', tier: 'low'},
    {name: 'ipad-reduced', width: 820, height: 1180, motion: 'reduce', tier: 'low'},
    {name: 'ipad-landscape', width: 1180, height: 820, motion: 'reduce', tier: 'low'}
  ]) {
    const page = await browser.newPage({viewport: {width: test.width, height: test.height}, hasTouch: test.tier === 'low', isMobile: test.tier === 'low'});
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.emulateMedia({reducedMotion: test.motion});
    await page.goto(`${server.url}/tools/vehicle-model.html?quality=${test.tier}`);
    await page.waitForFunction(() => window.ready);
    const report = await page.evaluate(async tier => {
      const THREE = await import('three');
      const {OpeningBlueprintSequence} = await import('../works/terra_incognita/opening-blueprints.js');
      for (const key of ['--frame-top', '--frame-bottom', '--safe-top', '--safe-bottom']) document.documentElement.style.setProperty(key, '0px');
      const {rover, lander} = preview;
      const meta = document.createElement('meta');
      meta.name = 'viewport'; meta.content = 'width=device-width, initial-scale=1';
      document.head.append(meta);
      preview.renderer.domElement.style.display = 'none';
      document.body.style.overflow = 'hidden';
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const bp = new OpeningBlueprintSequence({rover, lander, tier});
      window.bp = bp;
      const fail = message => { throw Error(message); };
      const state = () => JSON.stringify(lander.parts.map(part => [part.state, ...part.objects.map(o => [o.visible,...o.scale.toArray()])]));
      const before = state();
      bp.start();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!bp.models) fail('Deferred model capture did not complete');
      bp.suspend();
      if (state() !== before) fail('Capture mutated restoration state');
      for (const [key, root, objects] of [
        ['rover', rover.group, (() => {const a=[];rover.group.traverse(o=>{if(o.isMesh && o!==rover.acquisitionGlow)a.push(o)});return a;})()],
        ['lander', lander.group, lander.parts.flatMap(part => part.objects)]
      ]) {
        root.updateMatrixWorld(true);
        const inverse = root.matrixWorld.clone().invert();
        const bounds = new THREE.Box3();
        for(const object of objects){object.geometry.computeBoundingBox();bounds.union(object.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld)));}
        const size=bounds.getSize(new THREE.Vector3());
        for(const axis of ['x','y','z'])if(Math.abs(bp.models[key].dimensions[axis]-size[axis])>1e-6)fail(key+' bounds mismatch');
        if(bp.models[key].meshes!==objects.length)fail(key+' mesh count mismatch');
      }
      const roverCoords = bp.models.rover.coords.slice();
      const chassisRotation = rover.chassis.rotation.clone();
      const rootRotation = rover.group.rotation.clone();
      for (const [pitch, roll, yaw] of [[.28,-.22,1.4],[-.32,.25,-2.1]]) {
        rover.chassis.rotation.set(pitch,0,roll);
        rover.group.rotation.y=yaw;
        bp._capture();
        if(bp.models.rover.coords.length!==roverCoords.length || roverCoords.some((n,i)=>Math.abs(n-bp.models.rover.coords[i])>1e-5)) fail('Terrain attitude rotated rover blueprint');
        if(rover.chassis.rotation.x!==pitch || rover.chassis.rotation.z!==roll || rover.group.rotation.y!==yaw) fail('Blueprint capture changed live rover attitude');
      }
      rover.chassis.rotation.copy(chassisRotation);
      rover.group.rotation.copy(rootRotation);
      bp._capture();
      // Move a real leg and ramp without rebuilding the restoration wire cache.
      const original = bp.models.lander.coords.slice();
      lander.setLegFold(1);lander.setRamp(0);bp._capture();
      if(original.length===bp.models.lander.coords.length && original.every((n,i)=>n===bp.models.lander.coords[i]))fail('Stale lander cache');
      lander.setLegFold(0);lander.setRamp(1);bp._capture();
      for(const key of ['rover','lander']) {
        const offset = bp.timing.noise + (key==='lander' ? bp.timing.rover+bp.timing.roverHold+bp.timing.gap : 0);
        const samples = [.2,.4,.6,.8].map(t=>{bp._apply(offset+bp.timing[key]*t);return bp.snapshot();});
        if(!(samples[1].scan>samples[0].scan && samples[2].scan>samples[3].scan && samples[0].scanDirection===1 && samples[3].scanDirection===-1))fail('Scan does not reciprocate');
      }
      bp._apply(bp.timing.noise+bp.timing.rover*.8);
      return {source: bp.snapshot().models, reduced: bp.reduced, scanBothWays: true, unchangedRestoration: true, followsPose: true, terrainIndependentRoverAngle: true};
    }, test.tier);
    await page.screenshot({path: `dist/blueprint-${test.name}-rover.png`});
    await page.evaluate(() => bp._apply(bp.timing.noise+bp.timing.rover+bp.timing.roverHold+bp.timing.gap+bp.timing.lander*.8));
    await page.screenshot({path: `dist/blueprint-${test.name}-lander.png`});
    if(errors.length)throw Error(errors.join('\n'));
    console.log(test.name, JSON.stringify(report));
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
