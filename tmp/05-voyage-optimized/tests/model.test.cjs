/* Run: node --test tests/model.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../model.js');
const V=globalThis.Voyage;

test('all terrain and illumination samples stay finite and deterministic',()=>{
  for(const p of V.worlds){
    for(let x=-340;x<=340;x+=17)for(let z=-340;z<=340;z+=17){
      const h=V.height(x,z,p),surface=V.surface(x,z,p);
      assert.equal(h,V.height(x,z,p));
      assert(Number.isFinite(h+surface.dx+surface.dz+surface.slope));
      const sun=V.illumination(x,z,p,180,h);
      assert(sun.exposure>=0&&sun.exposure<=1);assert(sun.y>0);
    }
  }
});

test('stationary, driven and repeated-measurement sessions terminate with balanced energy',()=>{
  for(const p of V.worlds)for(const mode of ['stationary','drive','measure']){
    const s=new V.Simulation(p);
    while(!s.ended){
      if(mode==='measure'&&!s.pendingScan&&!s.scanning)s.requestScan();
      s.step(.1,{throttle:mode==='drive'?1:0});
      assert(s.energy>=0&&s.energy<=s.capacity);
      assert(Math.abs(s.energy-(s.capacity+s.generated-s.consumed-s.curtailed))<1e-9);
      assert(Number.isFinite(s.x+s.y+s.z+s.speed+s.energy));
    }
    assert(s.elapsed<=360.04);assert(V.validRecord(s.record()));
    assert(['energy','window'].includes(s.endReason));
    if(mode==='measure')assert(s.samples.length>0);
  }
});

test('moving cancels an unfinished measurement without restoring consumed energy',()=>{
  const s=new V.Simulation(V.worlds[1]);s.requestScan();
  for(let t=0;t<3;t+=.1)s.step(.1);
  assert(s.scanning);assert.equal(s.samples.length,0);
  const energy=s.energy;s.step(.1,{throttle:1});
  assert(!s.scanning);assert.equal(s.samples.length,0);assert(s.energy<energy);
});

test('measurement completes only after stopping and six continuous seconds',()=>{
  const s=new V.Simulation(V.worlds[1]);
  for(let i=0;i<30;i++)s.step(.1,{throttle:1});
  s.requestScan();s.step(.1);assert(s.pendingScan);assert.equal(s.samples.length,0);
  for(let i=0;i<90;i++)s.step(.1);
  assert.equal(s.samples.length,1);assert(!s.scanning);
  const sample=s.samples[0];assert(Math.abs(sample.x-s.x)<.1&&Math.abs(sample.z-s.z)<.1);
});

test('energy depletion, visitor stop and mission-window cutoff freeze all simulation state',()=>{
  for(const reason of ['visitor','energy','window','idle']){
    const s=new V.Simulation(V.worlds[0]);s.end(reason);const saved=JSON.stringify(s.record());
    const before={elapsed:s.elapsed,x:s.x,energy:s.energy};s.step(1,{throttle:1,steer:1});
    assert.deepEqual({elapsed:s.elapsed,x:s.x,energy:s.energy},before);assert.equal(s.endReason,reason);assert(V.validRecord(JSON.parse(saved)));
  }
});

test('stored data rejects malformed routes, wrong worlds and invalid measurement values',()=>{
  const s=new V.Simulation(V.worlds[1]);s.end();const good=s.record();assert(V.validRecord(good));
  for(const changed of [{planet:'unknown'},{route:[[NaN,2]]},{route:[[0,900]]},{route:Array(2202).fill([0,0])},{samples:[{x:0}]},{elapsed:Infinity},{reason:'bogus'}])assert(!V.validRecord({...good,...changed}));
});

test('traversal stays inside its operating region and does not cross a blocking boulder',()=>{
  const s=new V.Simulation(V.worlds[1]);s.x=341.95;s.z=0;s.heading=-Math.PI/2;s.speed=.9;
  s.surface=V.surface(s.x,s.z,s.p);s.step(.1,{throttle:1});assert(Math.hypot(s.x,s.z)<=342);
  const t=new V.Simulation(V.worlds[1]);t.rocks=[{x:0,z:7.5,size:2}];t.speed=.9;t.step(1,{throttle:1});
  assert(t.z-7.5>=2*.76+.6);assert(t.blocked);
});
