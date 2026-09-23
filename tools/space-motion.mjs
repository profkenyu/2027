import assert from 'node:assert/strict';
import {PerspectiveCamera,Group,Vector3} from 'three';
import {pose,displacement} from '../works/space/scene.js';
import {passageEdit} from '../engine/core/flight-edit.js';
for(const passage of [1,2])for(const aspect of [1.6,390/844,844/390]){
 const cuts=passage===1?[20,40]:[26,44],bounds=[0,...cuts,64],camera=new PerspectiveCamera(45,aspect,.25,30000),ship=new Group();
 const relative=t=>{pose(camera,ship,t,passage);return new Vector3().subVectors(camera.position,ship.position);};
 const speed=t=>relative(t+.001).sub(relative(t)).length()/.001;
 for(let i=0;i<3;i++){
  const a=bounds[i],b=bounds[i+1];
  for(const t of [a+.01,a+.1,a+.5,b-.5,b-.1,b-.01])assert(speed(t)>.5,`Relative camera stopped at passage ${passage}, ${t}`);
  if(passage===2||i===1){const reference=speed((a+b)/2);assert(Math.abs(speed(a+3.1)-reference)<.001);assert(Math.abs(speed(b-3.1)-reference)<.001);}
 }
 for(const cut of cuts){
  for(const t of [cut-.1,cut,cut+.1])assert(Math.abs((displacement(t+.001)-displacement(t))/.001-8)<1e-6,'Ship velocity changed at cut');
  assert.equal(passageEdit(cut,cuts).veil,0);
  for(const edge of [cut-3,cut+3]){
   const before=relative(edge).sub(relative(edge-.001)).divideScalar(.001);
   const after=relative(edge+.001).sub(relative(edge)).divideScalar(.001);
   assert(before.distanceTo(after)<.03,'Camera bridge velocity discontinuity');
  }
 }
}
console.log('PASS both passages: nonzero relative speed / matched bridge velocities / uninterrupted ship velocity / no interior blackout');
