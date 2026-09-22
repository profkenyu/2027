import * as THREE from 'three';
// One authored solar direction shared by hull, reflection and destination.
export const flightSun=passage=>new THREE.Vector3(passage===2?-28:28,24,26);

// The source geometry remains the surface lander. These are close-view optical
// approximations: no painted lighting, glow, or moving noise on the hull.
export function flightMaterial(rgb,kind){
  const properties={ceramic:[.58,.08],metal:[.31,.82],graphite:[.74,.16],foil:[.38,.78],glass:[.16,.18],dark:[.87,.05]};
  const [roughness,metalness]=properties[kind];
  const material=new THREE.MeshStandardMaterial({color:new THREE.Color(...rgb),roughness,metalness,envMapIntensity:kind==='glass'?.65:.4,side:THREE.DoubleSide});
  material.name=`flight-${kind}`;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHullPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHullPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vHullPosition;
      float hullGrain(vec3 p){return sin(p.x*139.+p.z*91.+sin(p.y*31.))*sin(p.y*157.-p.z*69.+sin(p.x*43.));}
    `).replace('#include <color_fragment>',`#include <color_fragment>
      float grain=hullGrain(vHullPosition);
      float resolved=1.-smoothstep(.02,.12,length(fwidth(vHullPosition)));
      diffuseColor.rgb*=1.+grain*resolved*.006;
      ${kind==='metal'?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.225,.24,.255),smoothstep(2.8,3.4,vHullPosition.y)*.7);':''}
    `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+grain*resolved*.012,.12,.95);
      ${kind==='metal'?'roughnessFactor=mix(roughnessFactor,.53,smoothstep(2.8,3.4,vHullPosition.y));':''}
    `).replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      ${kind==='metal'?'metalnessFactor=mix(metalnessFactor,.28,smoothstep(2.8,3.4,vHullPosition.y));':''}
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      // Derivative surface gradient in view space; detail disappears when unresolved.
      float relief=resolved*${kind==='foil'?'0.00035':'0.000025'}*grain;
      vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
      vec3 rx=cross(dy,normal),ry=cross(normal,dx);
      float det=dot(dx,rx);
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*rx+dFdy(relief)*ry));
    `);
  };
  material.customProgramCacheKey=()=>`flight-surface-v2-${kind}`;
  return material;
}

export function sourceMaterial(batch){
  const [r,g,b]=batch.rgb;
  const kind=r>.26&&g<.2?'foil':g>.025&&r<.02?'glass':r>.25?'ceramic':batch.metalness>.4?'metal':r>.035?'graphite':'dark';
  return flightMaterial(batch.rgb,kind);
}

export function createFlightEnvironment(renderer,tier,passage,directions={}){
  // A sparse solar/planetary radiance map, not an indoor studio HDRI.
  const width=tier==='high'?512:256,height=width/2,data=new Float32Array(width*height*4);
  const sun=(directions.sun?.clone()??flightSun(passage)).normalize();
  const planet=(directions.planet?.clone()??new THREE.Vector3(passage===2?-1650:1450,-250,-5700)).normalize();
  const direction=new THREE.Vector3(),planetColor=passage===2?[.095,.12,.14]:[.13,.095,.06];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const theta=Math.PI*(y+.5)/height,phi=2*Math.PI*(x+.5)/width;
    direction.set(-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta));
    const solar=Math.exp((direction.dot(sun)-1)*1800)*12;
    const bounce=THREE.MathUtils.smoothstep(direction.dot(planet),.65,.95);
    const i=(y*width+x)*4;
    for(let c=0;c<3;c++)data[i+c]=.0015+solar*(passage===2?[.91,.96,1]:[1,.91,.77])[c]+bounce*planetColor[c];
    data[i+3]=1;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;
  const generator=new THREE.PMREMGenerator(renderer),environment=generator.fromEquirectangular(texture);generator.dispose();texture.dispose();return environment;
}
