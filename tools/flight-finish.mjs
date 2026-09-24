import assert from 'node:assert/strict';
import {Scene,PerspectiveCamera,Box3,Vector3} from 'three';
import {createSurveyor} from '../works/space/model.js';
import {createVoid,pose,DURATION} from '../works/space/scene.js';
for(const tier of ['high','mid','low']){
 const ship=createSurveyor(tier);let triangles=0;
 ship.group.traverse(o=>{
  if(!o.isMesh)return;
  for(const name of ['position','normal'])for(const value of o.geometry.attributes[name].array)assert(Number.isFinite(value));
  triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.count??1);
 });
 const size=new Box3().setFromObject(ship.group).getSize(new Vector3());assert(size.x<10&&size.y<6.6&&size.z<9,'Original silhouette must remain bounded');
 for(const passage of [1,2])for(const aspect of [1.6,390/844]){
  const scene=new Scene(),environment=createVoid(scene,tier,passage),camera=new PerspectiveCamera(45,aspect,.25,30000);
  const radius=environment.planet.geometry.parameters.radius;assert.equal(radius,passage===1?3300:3700);
  assert.equal(environment.stars.children[0].geometry.attributes.position.count,{high:1800,mid:1200,low:700}[tier]);
  assert(environment.atmosphere,'Both destination planets have authored gas layers');
  assert(environment.planet.material.uniforms.sun.value.z>0,'Destination lit hemisphere must face the arrival observer');
  if(environment.atmosphere){assert.equal(environment.atmosphere.geometry,environment.planet.geometry);assert.equal(environment.atmosphere.material.depthWrite,false);}
  for(let t=0;t<=DURATION;t+=.25){pose(camera,ship.group,t,passage);assert(camera.position.distanceTo(environment.planet.position)>radius+100);assert(ship.group.position.distanceTo(environment.planet.position)>radius+100);}
  pose(camera,ship.group,60,passage);const angle=2*Math.asin(radius/camera.position.distanceTo(environment.planet.position))*180/Math.PI;assert(angle>camera.fov,'Destination must exceed the vertical frame');
 }
 console.log(`PASS ${tier}: ${triangles} ship triangles / finite geometry / retained silhouette / large planet / clearance`);
}
