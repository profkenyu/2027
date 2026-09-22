import * as THREE from 'three';
import {flightSun} from './surfaces.js';
export const DURATION=64;
export const CUTS=[20,40];
const target=new THREE.Vector3(),offset=new THREE.Vector3();
const smooth=(a,b,t)=>{const x=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return x*x*x*(x*(x*6-15)+10);};
// Each shot observes an already moving vessel. Do not restart a rest-to-rest
// easing curve at editorial cuts: it freezes relative hull/camera motion.
const travel=(a,b,t)=>THREE.MathUtils.clamp((t-a)/(b-a),0,1);
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
      const p=travel(0,26,t);
      camera.position.copy(ship.position).add(offset.set(-(portrait?31:22)+p*5,-10+p*14,-37+p*65));
      target.copy(ship.position).add(offset.set(0,2,0));camera.fov=portrait?66:46;
    }else if(t<44){
      const p=travel(26,44,t);
      camera.position.copy(ship.position).add(offset.set(-65+p*30,20-p*7,60+p*10));
      target.copy(ship.position).add(offset.set(portrait?-2:-10,3,0));camera.fov=portrait?61:39;
    }else{
      const p=travel(44,64,t);
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
    const p=travel(0,20,t);
    // The observer is ahead of the vessel, outside its trajectory. The craft
    // approaches an almost stationary viewpoint instead of being glued to it.
    camera.position.set((portrait?38:58)-p*7,21-p*3,-215+t*.6);
    target.copy(ship.position).add(offset.set(portrait?-4:-18,-4+p*2,0));
    camera.fov=(portrait?57:44)-p*4;
  }else if(shot==='structure'){
    const p=travel(20,40,t);
    // Match the ending's hull passage: a foreground-to-aft translation,
    // lowering the observer to expose fittings, landing struts and the keel.
    // Stay on the departure side of the flight axis across all three shots.
    camera.position.copy(ship.position).add(offset.set(portrait?26-p*4:17-p*5,10-p*8,-25+p*53));
    target.copy(ship.position).add(offset.set(0,3.2-p*.8,-2+p*5));
    camera.fov=(portrait?64:45)-p*4;
  }else{
    const p=travel(40,64,t);
    // Fall behind the ship as it leaves for the planet. Its shrinking scale
    // against a persistent large limb creates depth without star streaks.
    camera.position.copy(ship.position).add(offset.set(portrait?5-p*5:28-p*16,12+p*8,72+p*88));
    target.copy(ship.position).add(offset.set(portrait?24+p*8:40+p*55,14,-150-p*110));
    camera.fov=(portrait?70:43)-p*(portrait?6:5);
  }
  camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  camera.userData.focus??=new THREE.Vector3();camera.userData.focus.copy(target);
  return shot;
}
export function createVoid(scene,tier,passage=1){
  const stars=new THREE.Group();const count={high:1800,mid:1200,low:700}[tier];let seed=4917;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const p=[],c=[];
  for(let i=0;i<count;i++){const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);p.push(r*Math.cos(a)*18000,y*18000,r*Math.sin(a)*18000);const l=.12+Math.pow(random(),4)*.7;c.push(l*.9,l*.95,l);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  stars.add(new THREE.Points(g,new THREE.PointsMaterial({size:1.2,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,toneMapped:false})));scene.add(stars);
  const planetMaterial=new THREE.ShaderMaterial({uniforms:{sun:{value:flightSun(passage).normalize()}},vertexShader:`varying vec3 n;varying vec3 world;void main(){n=normalize(normalMatrix*normal);world=normalize(normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform vec3 sun;varying vec3 n;varying vec3 world;
    float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
    float field(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float terrain(vec3 p){float s=0.,a=.5;for(int i=0;i<${tier==='low'?3:5};i++){s+=field(p)*a;p=p*2.07+vec3(7,13,3);a*=.5;}return s;}
    void main(){
      vec3 N=normalize(world);float incidence=dot(N,sun),light=max(incidence,0.);
      float strata=terrain(N*5.3);float detail=terrain(N*27.+strata*2.);
      vec3 ground=mix(vec3(.085,.063,.042),vec3(.27,.19,.10),smoothstep(.25,.72,strata)*.7+detail*.2);
      // Static terrain albedo, a bounded penumbra and a thin sunlit limb.
      // Not a geological reconstruction or a full atmospheric scattering solve.
      // A bounded exhibition fill preserves the night-side silhouette. It is
      // an artistic exposure aid, not reflected light from an inferred moon.
      vec3 color=ground*(.055+light*2.1);
      float limb=pow(1.-abs(normalize(n).z),4.5);
      float daylight=smoothstep(-.055,.13,incidence);
      color+=vec3(.15,.12,.075)*limb*daylight*.48;
      gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  if(passage===2){
    planetMaterial.fragmentShader=planetMaterial.fragmentShader.replace('vec3(.085,.063,.042),vec3(.27,.19,.10)','vec3(.052,.065,.077),vec3(.24,.27,.29)').replace('vec3(.15,.12,.075)','vec3(.085,.12,.15)');
  }
  // Deliberately larger than the frame: the vessel is a near-field scale cue,
  // not a peer of a conveniently framed globe. Spatial scale is exhibition-authored.
  const planet=new THREE.Mesh(new THREE.SphereGeometry(passage===2?3700:3300,tier==='low'?96:144,tier==='low'?64:88),planetMaterial);planet.position.set(passage===2?-1650:1450,passage===2?-100:-430,-5700);scene.add(planet);
  let atmosphere=null;
  if(passage===1){
    // Single shell: tangent optical depth and broad stratification, not a
    // volumetric gas simulation. No animation/noise added to the void.
    atmosphere=new THREE.Mesh(planet.geometry,new THREE.ShaderMaterial({
      uniforms:{sun:{value:flightSun(passage).normalize()}},transparent:true,depthWrite:false,
      vertexShader:`varying vec3 worldN;varying vec3 viewN;varying vec3 viewPos;
        void main(){worldN=normal;viewN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);viewPos=p.xyz;gl_Position=projectionMatrix*p;}`,
      fragmentShader:`uniform vec3 sun;varying vec3 worldN;varying vec3 viewN;varying vec3 viewPos;
        void main(){vec3 N=normalize(worldN);float mu=clamp(dot(normalize(viewN),normalize(-viewPos)),0.,1.);
          float rim=pow(1.-mu,2.5);float day=smoothstep(-.2,.6,dot(N,sun));
          float strata=.82+.18*sin(N.y*33.+N.x*3.);
          float alpha=(.055+rim*.48)*(.22+day*.78)*strata*smoothstep(0.,.12,mu);
          vec3 haze=mix(vec3(.19,.23,.25),vec3(.68,.46,.23),day);
          gl_FragColor=vec4(haze,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    }));atmosphere.scale.setScalar(1.026);atmosphere.position.copy(planet.position);scene.add(atmosphere);
  }
  return {stars,planet,atmosphere};
}
