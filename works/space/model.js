import * as THREE from 'three';
import models from './lander-model.json' with {type:'json'};
import {createFlightHardware} from '../../engine/vehicle/flight-hardware.js';
import {sourceMaterial,flightMaterial} from './surfaces.js';
import {addFlightDetails,bevelHullTiles} from './details.js';
function bytes(base64){return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}
export const exposureAt=(t,passage=1)=>Math.min(1,Math.max(0,((passage-1)*64+t)/128));
export function createSurveyor(tier,passage=1){
  const group=new THREE.Group();group.name='survey-lander-flight';
  for(const batch of models[tier]){
    const positions=new Int16Array(bytes(batch.p).buffer),normals=new Int8Array(bytes(batch.n).buffer);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(Float32Array.from(positions,v=>v/2000),3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(Float32Array.from(normals,v=>v/127),3));geometry.computeBoundingSphere();
    const material=sourceMaterial(batch);
    const mesh=new THREE.Mesh(bevelHullTiles(geometry),material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  addFlightDetails(group,tier);
  const hardware=createFlightHardware(tier,{graphite:flightMaterial([.033,.042,.049],'graphite'),metal:flightMaterial([.23,.26,.28],'metal')}),radiators=hardware.radiators;group.add(hardware.group);
  const jets=[];
  const jetMaterial=new THREE.MeshBasicMaterial({color:0xa6b7c1,transparent:true,opacity:.16,depthWrite:false});
  for(const side of [-1,1]){const jet=new THREE.Mesh(new THREE.ConeGeometry(.035,.32,8),jetMaterial);jet.position.set(side*3.6,4.8,1.8);jet.rotation.z=side*Math.PI/2;jet.visible=false;group.add(jet);jets.push(jet);}
  const exposureUniforms=new Set();group.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.userData.exposure)exposureUniforms.add(m.userData.exposure);});
  return {group,exposure:()=>({amount:exposureUniforms.values().next().value?.value??0,materials:exposureUniforms.size}),update(t,response){for(const uniform of exposureUniforms)uniform.value=exposureAt(t,passage);const deployment=THREE.MathUtils.smoothstep(t,20,34)*(1-THREE.MathUtils.smoothstep(t,52,62))*response.radiator;hardware.setDeployment(deployment);jets.forEach(j=>j.visible=(t>=40&&t<40.25)||(t>47.75&&t<48));},radiators};
}
