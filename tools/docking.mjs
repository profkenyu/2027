import { chromium } from 'playwright';
import { startPreviewServer } from './lib/preview-server.mjs';

const server = await startPreviewServer();
let browser;
try {
  browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  for (const tier of ['high','mid','low']) {
    const page = await browser.newPage();
    await page.goto(`${server.url}/tools/vehicle-model.html?quality=${tier}`);
    await page.waitForFunction(() => window.ready);
    const result = await page.evaluate(async () => {
      const { DockingSequence } = await import('../engine/core/docking.js');
      const { rover, lander } = preview;
      const effect = Object.fromEntries(['beginDeparture','depart','finish','beginArrival','arrive'].map(k=>[k,()=>{}]));
      const docking = new DockingSequence({rover,lander,effect});
      rover.metricEnabled = false;
      const results = [];
      for (const [sx,sz] of [[0,0],[.15,.08],[-.15,-.08],[.3,-.2]]) for (const yaw of [0,1.2,3.8]) {
        docking.reset();
        rover.h = lander.h = (x,z) => sx*x + sz*z + .12*Math.sin(x*.8)*Math.cos(z*.6);
        lander.site = null;
        lander.place(0,0,yaw);
        lander.setRestorationLevel(4);
        lander.setRamp(1);
        lander.group.updateMatrixWorld(true);
        const length = lander.dock.hatchZ - lander.dock.toeZ;
        const tip = lander.rampPivot.localToWorld(lander.group.position.clone().set(0,0,-length));
        const expected = lander.dockingPoint(lander.dock.entryZ);
        if (tip.distanceTo(expected)>1e-6) throw Error('ramp mesh/contact mismatch');
        docking.start(0);
        let time=0;
        for (;time<180000 && !docking.docked;time+=1000/60) {
          docking.beforeRover(time,1/60);
          rover.update(1/60);
          docking.afterRover();
        }
        if (!docking.docked) throw Error(JSON.stringify({sx,sz,yaw,phase:docking.phase,local:lander.dockingLocal(rover.pos.x,rover.pos.z),speed:rover.speed,heading:rover.heading,landerYaw:lander.group.rotation.y}));
        lander.group.position.y += 30;
        lander.group.position.x += 10;
        rover.keys.add('KeyW');
        for(let i=0;i<120;i++) rover.update(1/60);
        rover.keys.clear();
        const local=lander.dockingLocal(rover.pos.x,rover.pos.z);
        if(Math.abs(local.x)>1e-6 || Math.abs(local.z+.58)>1e-6 || rover.speed!==0 || Math.abs(rover.pitch)>1e-6 || Math.abs(rover.roll)>1e-6) throw Error('stowed pose drift');
        results.push({sx,sz,yaw,seconds:Math.round(time/1000)});
      }
      docking.reset();
      if(rover.stowedIn) throw Error('stow reset');
      docking.start(0);
      docking.phase = 'approach';
      const outside = lander.dockingPoint(-.58, 3);
      rover.teleport(outside.x, outside.z, lander.group.rotation.y + Math.PI);
      docking.beforeRover(31000, 0);
      if(docking.phase !== 'approach' || rover.stowedIn) throw Error('false docking outside bay after timeout');
      docking.reset();
      return results;
    });
    console.log(JSON.stringify({tier,cases:result.length,results:result}));
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
