import * as THREE from 'three';
import {createSurface} from './surface.js';
import {createAtmosphere} from './atmosphere.js';

export function createEnvironment(scene,tier){
  // A curved planet is a spatial reference for the kilometre-scale fleet.
  const uniforms={time:{value:0},dawn:{value:0},sun:{value:new THREE.Vector3(-1400,2600,1700).normalize()}};
  const geometry=new THREE.SphereGeometry(16500,tier==='low'?64:128,tier==='low'?40:80);
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:`
    varying vec3 vN;varying vec3 vP;
    void main(){vN=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `,fragmentShader:`
    precision highp float;varying vec3 vN;varying vec3 vP;uniform float time;uniform float dawn;uniform vec3 sun;
    float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.07+vec3(17,3,8);a*=.5;}return s;}
    void main(){
      vec3 n=normalize(vP);
      float light=max(0.,dot(n,sun));
      // Broad, opaque aerosol banks obscure the mineral surface. This is an
      // authored atmosphere, not a claim about the composition of Mars.
      vec3 drift=vec3(time*.00055,0.,time*.00018);
      float warp=fbm(n*3.4+drift);
      float bank=fbm(n*8.+vec3(warp*2.8,n.y*5.,0.)+drift);
      float veil=smoothstep(.22,.78,bank);
      vec3 gas=mix(vec3(.14,.09,.067),vec3(.38,.29,.205),veil);
      gas=mix(gas,vec3(.31,.255,.20),.28+.15*warp);
      float limb=pow(1.-max(0.,vN.z),2.5);
      vec3 color=gas*(.065+light*1.3)+vec3(.24,.17,.105)*limb*pow(light,.4)*.48;
      // Bessel Bloom's radial interference, confined to three settlement regions.
      float wave=0.;for(int i=0;i<3;i++){
        vec3 origin=normalize(vec3(-.09+float(i)*.11,.95,.3+float(i)*.07));
        float r=length(n-origin)*75.;float age=max(0.,time-110.-float(i)*5.);
        float front=1.-smoothstep(age*.08,age*.08+.3,r);
        wave+=cos(r*12.-age*.6-.7854)/sqrt(max(1.,r*12.))*front*exp(-r*.4);
      }
      color+=vec3(.27,.15,.07)*wave*wave*dawn*.035;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `});
  const planet=new THREE.Mesh(geometry,material);planet.position.set(0,-17400,-10500);scene.add(planet);
  const atmo=createAtmosphere(planet,uniforms.sun.value,tier);
  atmo.position.copy(planet.position);scene.add(atmo);
  // A fixed celestial sphere: sparse bright stars and a subdued stellar band.
  // Stars do not follow ship motion or twinkle in vacuum.
  const points=[],colours=[],sizes=[];let seed=231;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const count={high:6500,mid:4200,low:2000}[tier];
  const direction=new THREE.Vector3();
  for(let i=0;i<count;i++){
    const az=rand()*Math.PI*2;
    const band=i>count*.58;
    const latitude=band?(rand()+rand()+rand()-1.5)*.14:Math.asin(rand()*2-1);
    direction.set(Math.cos(latitude)*Math.cos(az),Math.sin(latitude),Math.cos(latitude)*Math.sin(az));
    direction.applyAxisAngle(new THREE.Vector3(0,0,1),.42);
    points.push(direction.x*60000,direction.y*60000,direction.z*60000);
    const bright=rand(),power=band?.13+bright*.19:.23+Math.pow(bright,5)*.72;
    const warm=rand()>.75;
    colours.push(power*(warm?1:.83),power*.9,power*(warm?.76:1));
    sizes.push(band?.85+rand()*.55:1.05+Math.pow(bright,7)*2.1);
  }
  const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.Float32BufferAttribute(points,3));stars.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));stars.setAttribute('starSize',new THREE.Float32BufferAttribute(sizes,1));
  const starfield=new THREE.Points(stars,new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{pixelScale:{value:Math.min(devicePixelRatio,1.5)}},vertexShader:`attribute float starSize;uniform float pixelScale;varying vec3 tint;void main(){tint=color;gl_PointSize=starSize*pixelScale;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 tint;void main(){float r=length(gl_PointCoord-.5)*2.;float alpha=1.-smoothstep(.2,1.,r);if(alpha<.01)discard;gl_FragColor=vec4(tint,alpha);
#include <colorspace_fragment>
}`}));scene.add(starfield);
  const surface=createSurface(scene,tier);
  const surfaceFog=new THREE.FogExp2(0x594334,.00022);
  return {observerHeight:surface.observerHeight,surfaceHeightAt:surface.heightAt,update(seconds,onSurface=false,camera=null,elapsed=seconds){
    surface.update(elapsed);
    if(camera)starfield.position.copy(camera.position);
    uniforms.time.value=seconds;uniforms.dawn.value=THREE.MathUtils.smoothstep(seconds,110,160);
    planet.visible=atmo.visible=starfield.visible=!onSurface;surface.group.visible=onSurface;
    scene.fog=onSurface?surfaceFog:null;
  }};
}
