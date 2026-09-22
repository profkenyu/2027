import * as THREE from 'three';
import {PossibilityModel,GRID} from './possibility-model.js';
export function createPossibility(scene,heightAt,evidence,seed){
 const model=new PossibilityModel(evidence,seed),pixels=new Uint8Array(GRID*GRID*4);
 const texture=new THREE.DataTexture(pixels,GRID,GRID,THREE.RGBAFormat);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;
 texture.colorSpace=THREE.SRGBColorSpace;
 // A small surface trace, not a floating particle or a luminous cell icon.
 const geometry=new THREE.PlaneGeometry(2.8,2.8,16,16);geometry.rotateX(-Math.PI/2);
 const position=geometry.attributes.position;
 for(let i=0;i<position.count;i++){const x=position.getX(i)+728,z=position.getZ(i)+1012;position.setXYZ(i,x,heightAt(x,z)+.035,z);}
 geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));mesh.visible=false;scene.add(mesh);
 const target=new THREE.Vector3(728,heightAt(728,1012),1012),start=new THREE.Quaternion(),end=new THREE.Quaternion();
 function update(t,camera){
  mesh.visible=t>=108&&!!evidence;
  if(t<108)return;
  const p=THREE.MathUtils.smootherstep(t,108,114);
  start.copy(camera.quaternion);camera.lookAt(target);end.copy(camera.quaternion);camera.quaternion.copy(start).slerp(end,p);camera.updateMatrixWorld();
  model.advance(t-114);
  const reveal=THREE.MathUtils.smoothstep(t,114,118);
  for(let i=0;i<model.field.length;i++){
   const o=i*4,concentration=model.field[i],edge=THREE.MathUtils.smoothstep(concentration,.008,.09);
   // Dark fissure and living possibility share one spatial boundary; depleted
   // segments return to bare fissure instead of a permanently painted green mark.
   const crack=model.substrate[i]*.32;
   pixels[o]=Math.round(28+edge*41);pixels[o+1]=Math.round(25+edge*58);pixels[o+2]=Math.round(21+edge*33);
   pixels[o+3]=Math.round(Math.max(crack,edge*.88)*reveal*230);
  }
  texture.needsUpdate=true;
 }
 return {update,snapshot:()=>model.snapshot()};
}
