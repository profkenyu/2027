import assert from 'node:assert/strict';
import {PerspectiveCamera,Group} from 'three';
import {surfaceEdit,passageEdit} from '../engine/core/flight-edit.js';
import {flightProfile} from '../engine/core/flight-profiles.js';
import {pose} from '../works/space/scene.js';
for(const world of ['terra','desert','granite']){
 const p=flightProfile(world),end=(p.ignitionMs+p.liftMs)/1000;
 assert.equal(surfaceEdit('lift',end-.2,p).veil,1);
 assert.equal(surfaceEdit('lift',end-.2,p).audio,0);
 assert.equal(surfaceEdit('descent',0,p).veil,1);
 assert.equal(surfaceEdit('descent',0,p).audio,0);
 assert.equal(surfaceEdit('descent',2.4,p).approach,0);
 assert.equal(surfaceEdit('arrived',0,p).audio,1);
 for(let t=0;t<10;t+=1/60)for(const phase of ['lift','descent','departing']){
  const a=surfaceEdit(phase,t,p),b=surfaceEdit(phase,t+1/60,p);
  for(const key of ['veil','audio','approach']){assert(a[key]>=0&&a[key]<=1);assert(Math.abs(a[key]-b[key])<.03);}
 }
}
for(const passage of [1,2])for(const aspect of [1.6,390/844,844/390]){
 const camera=new PerspectiveCamera(45,aspect,.25,30000),ship=new Group(),cuts=passage===1?[20,40]:[26,44];
 for(let t=0;t<=64;t+=1/60){
  pose(camera,ship,t,passage);
  const side=camera.position.x-ship.position.x;
  assert(passage===1?side>=-1e-6:side<0,'Camera crossed the flight axis');
  assert(camera.position.distanceTo(ship.position)>11);
  const a=passageEdit(t,cuts),b=passageEdit(t+1/60,cuts);
  assert(a.audio>=0&&a.audio<=1);assert(Math.abs(a.audio-b.audio)<.03);
 }
 for(const t of [0,63.8,64])assert.equal(passageEdit(t,cuts).veil,1);
 for(const t of [0,34,38,42,63.8,64])assert.equal(passageEdit(t,cuts).audio,0);
}
console.log('PASS flight edit: black/silent boundaries, smooth envelopes, same-side cameras, clearance, portrait/landscape');
