import * as THREE from 'three';

import {CUTS} from './timeline.js';
import {surfaceProgress,surfaceTrackX,surfaceTrackZ} from './surface-flight.js';
export {CUTS};
export const shotAt=t=>t<CUTS[0]?'arrival':t<CUTS[1]?'hull':t<CUTS[2]?'ring-passage':t<CUTS[3]?'orbital-arrival':'surface';
const target=new THREE.Vector3();

// The close encounter travels alongside the keel and then lets the aft ring pass.
// Observer motion is authored, not a simulated orbital manoeuvre.
export function directCamera(camera,t,lead,surfaceHeightAt,referenceArk){
  const portrait=camera.aspect<1,shot=shotAt(t);
  camera.near=shot==='surface'?.5:2;
  if(shot==='arrival'){
    const progress=THREE.MathUtils.smoothstep(t,0,CUTS[0]);
    // A long off-axis approach moves from the full formation to the lead hull.
    // Relative distance, not a lens zoom, makes the limb crossing grow in frame.
    camera.fov=portrait?48:34;
    camera.position.set((portrait?3200:4100)-progress*260,5000-progress*110,-3600-progress*4800);
    target.copy(lead.position);target.x-=portrait?260:360;target.y+=(portrait?1700:1400)-progress*(portrait?2420:1820);
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
  }else if(shot==='orbital-arrival'){
    const progress=THREE.MathUtils.smoothstep(t,CUTS[2],CUTS[3]);
    // An establishing view, not a simulated orbital transfer. Maintain the
    // fleet's screen direction before the motivated cut to the surface.
    camera.fov=portrait?54:43;
    camera.position.set((portrait?4900:6700)-progress*600,3500-progress*260,7800-progress*520);
    target.set(portrait?-180:-500,-2100+progress*120,-4200-progress*400);
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
