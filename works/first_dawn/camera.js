import * as THREE from 'three';

export const CUTS=[15,35];
export const shotAt=t=>t<CUTS[0]?'arrival':t<CUTS[1]?'hull':'surface';
const target=new THREE.Vector3();

// Three authored observation stations; two cuts, no orbiting showcase camera.
export function directCamera(camera,t,lead,surfaceHeight){
  const portrait=camera.aspect<1,shot=shotAt(t);
  camera.near=shot==='surface'?.5:2;
  if(shot==='arrival'){
    const progress=THREE.MathUtils.smoothstep(t,0,15);
    camera.fov=(portrait?56:42)-progress*6;
    camera.position.set((portrait?260:560)-progress*45,285,(portrait?2000:1000)-progress*320);
    target.set(0,95,-1000);
  }else if(shot==='hull'){
    const progress=THREE.MathUtils.smoothstep(t,15,35);
    camera.fov=(portrait?58:48)-progress*5;
    // Parallel tracking plus a slow lateral approach reveals the ship's flank.
    // A small look-target shift lets the hull move gently through the frame.
    camera.position.copy(lead.position).add(target.set((portrait?1350:1050)-progress*125,-200+progress*25,(portrait?1700:1050)-progress*145));
    target.copy(lead.position);target.y+=25;target.z+=-40+progress*65;
  }else{
    // A restrained ground-level push-in continues through the subtitle.
    // Absolute-time easing makes replay and seeking deterministic.
    const progress=THREE.MathUtils.smoothstep(t,35,60);
    camera.fov=portrait?70-progress*3:57-progress*3.5;
    camera.position.set(850-progress*45,surfaceHeight+1.7,1800-progress*120);
    target.set(portrait?-600:-80,portrait?20:0,portrait?-1700:-2300);
  }
  camera.lookAt(target);camera.updateProjectionMatrix();
  return shot;
}
