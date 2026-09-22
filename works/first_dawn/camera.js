import * as THREE from 'three';

import {CUTS} from './timeline.js';
import {surfaceProgress,surfaceTrackX,surfaceTrackZ} from './surface-flight.js';
export {CUTS};
export const shotAt=t=>t<CUTS[0]?'arrival':t<CUTS[1]?'hull':t<CUTS[2]?'ring-passage':'surface';
const target=new THREE.Vector3();

// The close encounter travels alongside the keel and then lets the aft ring pass.
// Observer motion is authored, not a simulated orbital manoeuvre.
export function directCamera(camera,t,lead,surfaceHeightAt,referenceArk){
  const portrait=camera.aspect<1,shot=shotAt(t);
  camera.near=shot==='surface'?.5:2;
  if(shot==='arrival'){
    const progress=THREE.MathUtils.smoothstep(t,0,CUTS[0]);
    camera.fov=(portrait?56:42)-progress*2;
    camera.position.set((portrait?260:560)-progress*130,285,(portrait?2000:1000)-progress*400);
    // Observe the actual distant formation, not a nearby empty point that
    // makes the fleet slide sideways as the lens and camera move.
    target.copy(lead.position);target.x-=200;target.y-=1000-progress*350;
  }else if(shot==='hull'){
    const progress=Math.pow(THREE.MathUtils.clamp((t-CUTS[0])/(CUTS[1]-CUTS[0]),0,1),1.7);
    camera.fov=(portrait?58:48)-progress*5;
    // Parallel tracking plus a slow lateral approach reveals the ship's flank.
    // A small look-target shift lets the hull move gently through the frame.
    camera.position.copy(lead.position).add(target.set((portrait?1350:980)-progress*(portrait?230:300),-245+progress*80,(portrait?1700:1050)-progress*260));
    target.copy(lead.position);target.y+=25;target.z+=-40+progress*65;
  }else if(shot==='ring-passage'){
    const progress=THREE.MathUtils.smoothstep(t,CUTS[1],CUTS[2]);
    camera.fov=(portrait?65:52)-progress*4;
    camera.position.copy(referenceArk.position).add(target.set(
      (portrait?2100:1750)-progress*(portrait?750:920),
      -480+progress*220,
      1900-progress*3800
    ));
    target.copy(referenceArk.position);target.y+=30;target.z+=460-progress*900;
  }else{
    // Translate through real foreground geometry; the sky retains a quiet horizon.
    const progress=surfaceProgress(t);
    const x=surfaceTrackX(progress),z=surfaceTrackZ(progress);
    camera.fov=portrait?72-progress*3:62-progress*4;
    camera.position.set(x,surfaceHeightAt(x,z)+8-progress*3,z);
    target.set(x-(portrait?520:220),camera.position.y+310+progress*110,z-2300);
  }
  camera.lookAt(target);camera.updateProjectionMatrix();
  return shot;
}
