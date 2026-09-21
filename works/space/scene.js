import * as THREE from 'three';
export const DURATION=64;
export const CUTS=[20,40];
const target=new THREE.Vector3(),offset=new THREE.Vector3();
const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
// Finite acceleration, inertial coast, finite braking. Exhibition time/length units.
export function displacement(t){t=THREE.MathUtils.clamp(t,0,DURATION);return t<8?.5*t*t:t<52?32+8*(t-8):384+8*(t-52)-(t-52)**2/3;}
export function shotAt(t,passage=1){return passage===2?(t<26?'keel':t<44?'crossing':'horizon'):t<20?'departure':t<40?'structure':'destination';}
export function pose(camera,ship,t,passage=1){
  t=THREE.MathUtils.clamp(t,0,DURATION);
  ship.position.set(0,0,-displacement(t));ship.rotation.set(.045,-.24+smooth(40,48,t)*.09,.06);
  const portrait=camera.aspect<1,shot=shotAt(t);
  if(passage===2){
    // A longer lower-hull pass, then a lateral crossing, then a quiet release.
    // Separation, not object scaling, produces the change in apparent size.
    if(t<26){
      const p=smooth(0,26,t);
      camera.position.copy(ship.position).add(offset.set((portrait?31:22)-p*5,-10+p*14,-37+p*65));
      target.copy(ship.position).add(offset.set(0,2,0));camera.fov=portrait?66:46;
    }else if(t<44){
      const p=smooth(26,44,t);
      camera.position.copy(ship.position).add(offset.set(-65+p*30,20-p*7,60+p*10));
      target.copy(ship.position).add(offset.set(portrait?-2:-10,3,0));camera.fov=portrait?61:39;
    }else{
      const p=smooth(44,64,t);
      camera.position.copy(ship.position).add(offset.set(portrait?-5:-22,15+p*12,85+p*95));
      target.copy(ship.position).add(offset.set(portrait?-25:-70,24,-220));camera.fov=portrait?69:44;
    }
    camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    camera.userData.focus??=new THREE.Vector3();camera.userData.focus.copy(target);
    return shotAt(t,passage);
  }
  // Authored observer paths, not orbital dynamics. As in the ending, the
  // camera reveals structure by changing actual separation and parallax.
  if(shot==='departure'){
    const p=smooth(0,20,t);
    // The observer is ahead of the vessel, outside its trajectory. The craft
    // approaches an almost stationary viewpoint instead of being glued to it.
    camera.position.set((portrait?38:58)-p*7,21-p*3,-215+t*.6);
    target.copy(ship.position).add(offset.set(portrait?-4:-18,-4+p*2,0));
    camera.fov=(portrait?57:44)-p*4;
  }else if(shot==='structure'){
    const p=smooth(20,40,t);
    // Match the ending's hull passage: a foreground-to-aft translation,
    // lowering the observer to expose fittings, landing struts and the keel.
    camera.position.copy(ship.position).add(offset.set(portrait?-26+p*4:-18+p*6,9-p*6,-22+p*50));
    target.copy(ship.position).add(offset.set(0,3.2-p*.8,-2+p*5));
    camera.fov=(portrait?64:45)-p*4;
  }else{
    const p=smooth(40,64,t);
    // Fall behind the ship as it leaves for the planet. Its shrinking scale
    // against a persistent large limb creates depth without star streaks.
    camera.position.copy(ship.position).add(offset.set(portrait?5-p*5:28-p*16,12+p*8,78+p*82));
    target.copy(ship.position).add(offset.set(portrait?24+p*8:40+p*55,14,-150-p*110));
    camera.fov=(portrait?70:43)-p*(portrait?6:5);
  }
  camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  camera.userData.focus??=new THREE.Vector3();camera.userData.focus.copy(target);
  return shot;
}
export function createVoid(scene,tier,passage=1){
  const stars=new THREE.Group();const count={high:850,mid:550,low:300}[tier];let seed=4917;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const p=[],c=[];
  for(let i=0;i<count;i++){const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);p.push(r*Math.cos(a)*18000,y*18000,r*Math.sin(a)*18000);const l=.04+Math.pow(random(),5)*.46;c.push(l*.9,l*.95,l);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  stars.add(new THREE.Points(g,new THREE.PointsMaterial({size:.85,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.65,depthWrite:false})));scene.add(stars);
  const planetMaterial=new THREE.ShaderMaterial({uniforms:{sun:{value:new THREE.Vector3(-.85,.23,-.32).normalize()}},vertexShader:`varying vec3 n;varying vec3 world;void main(){n=normalize(normalMatrix*normal);world=normalize(normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform vec3 sun;varying vec3 n;varying vec3 world;
    float field(vec3 p){return sin(p.x*19.+sin(p.z*13.)*2.)*sin(p.y*23.+p.z*11.);}
    void main(){vec3 N=normalize(world);float light=max(dot(N,sun),0.);float strata=.5+.5*field(N);float detail=.5+.5*field(N*3.7);vec3 ground=mix(vec3(.085,.063,.042),vec3(.27,.19,.10),strata*.65+detail*.15);vec3 color=ground*(.004+light*1.6);float limb=pow(1.-abs(normalize(n).z),5.);color+=vec3(.15,.12,.075)*limb*pow(light,.7)*.5;gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  if(passage===2){
    planetMaterial.fragmentShader=planetMaterial.fragmentShader.replace('vec3(.085,.063,.042),vec3(.27,.19,.10)','vec3(.052,.065,.077),vec3(.24,.27,.29)').replace('vec3(.15,.12,.075)','vec3(.085,.12,.15)');
    planetMaterial.uniforms.sun.value.set(.75,.35,-.36).normalize();
  }
  // Deliberately larger than the frame: the vessel is a near-field scale cue,
  // not a peer of a conveniently framed globe. Spatial scale is exhibition-authored.
  const planet=new THREE.Mesh(new THREE.SphereGeometry(passage===2?3700:3300,tier==='low'?96:144,tier==='low'?64:88),planetMaterial);planet.position.set(passage===2?-1650:1450,passage===2?-100:-430,-5700);scene.add(planet);
  return {stars,planet};
}
