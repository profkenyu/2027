import assert from 'node:assert/strict';
import {Group, PerspectiveCamera, Vector3} from 'three';
import {pose} from '../works/space/scene.js';
import {ShotDirector} from '../engine/core/shot-director.js';
import {flightProfile} from '../engine/core/flight-profiles.js';
for (const passage of [1,2]) for (const aspect of [16/9,390/844,844/390]) {
  const camera = new PerspectiveCamera(46,aspect,.25,30000), ship = new Group();
  pose(camera,ship,64,passage);
  const incoming = ship.position.clone().project(camera);
  const profile = flightProfile(passage === 1 ? 'desert' : 'granite');
  const lander = {group:new Group()};
  lander.group.position.set(120,profile.height,-250);
  lander.group.rotation.y = 1.2;
  const director = Object.create(ShotDirector.prototype);
  Object.assign(director,{camera,lander,voyage:{phase:'descent',t0:0,arrivalProfile:profile},heightAt:()=>0,_camera:new Vector3(),_aim:new Vector3()});
  let previous;
  for(let t=0;t<=profile.descentMs;t+=1000/120){
    director.underside(t);director.applyPortraitSafeFrame('ascent');
    camera.position.copy(director._camera);camera.lookAt(director._aim);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const projected=lander.group.position.clone().project(camera);
    if(t===0){assert(Math.abs(projected.x-incoming.x)<1e-8);assert(Math.abs(projected.y-incoming.y)<1e-8);}
    assert(Math.abs(projected.x)<.8&&Math.abs(projected.y)<.8);
    assert(camera.position.y>=1.2);
    if(previous)assert(camera.position.distanceTo(previous)<.07,'Arrival observer moved too fast');
    previous=camera.position.clone();
  }
}
console.log('PASS matched arrival projection, portrait lens, bounded dolly and clearance: both passages / three aspects');
