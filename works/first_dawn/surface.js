import * as THREE from 'three';
import {CUTS} from './timeline.js';
import {SURFACE_TRAVEL,surfaceTrackX,surfaceTrackZ} from './surface-flight.js';

// Authored dry basin: relief is a procedural interpretation, not Mars DEM data.
export function groundHeight(x,z){
  const distance=Math.hypot(x-850,z-1800);
  const basin=THREE.MathUtils.smoothstep(distance,600,6500);
  const ridge=Math.pow(.5+.5*Math.sin(x*.00058+Math.sin(z*.00043)*1.7),3);
  return -760+basin*(60+ridge*530+Math.sin(x*.0021+z*.0013)*24)+Math.sin(x*.008)*Math.sin(z*.007)*1.3;
}
export function createSurface(scene,tier){
  const group=new THREE.Group();group.name='dry-mineral-basin';group.visible=false;scene.add(group);
  const segments={high:220,mid:150,low:90}[tier];
  const geometry=new THREE.PlaneGeometry(48000,48000,segments,segments);geometry.rotateX(-Math.PI/2);
  const pos=geometry.attributes.position,colors=[];
  const pale=new THREE.Color(0x76604d),dark=new THREE.Color(0x514235),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,groundHeight(x,z));
    const strata=.5+.5*Math.sin(x*.0017+z*.0011+Math.sin(z*.002)*2);
    c.copy(dark).lerp(pale,.25+strata*.6);colors.push(c.r,c.g,c.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  // Match the displayed triangle heights, including the coarse LOW grid.
  const heightAt=(x,z)=>{
    const gx=THREE.MathUtils.clamp((x+24000)/48000*segments,0,segments-1e-6);
    const gz=THREE.MathUtils.clamp((z+24000)/48000*segments,0,segments-1e-6);
    const ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz;
    const a=iz*(segments+1)+ix,b=a+segments+1;
    return fx+fz<=1?pos.getY(a)+(pos.getY(a+1)-pos.getY(a))*fx+(pos.getY(b)-pos.getY(a))*fz:
      pos.getY(b+1)+(pos.getY(b)-pos.getY(b+1))*(1-fx)+(pos.getY(a+1)-pos.getY(b+1))*(1-fz);
  };
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
  // Fine sediment striations affect the surface only, never the ship or sky.
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 basinPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nbasinPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 basinPosition;').replace('#include <color_fragment>',`#include <color_fragment>
      float grit=sin(basinPosition.x*2.3+sin(basinPosition.z*3.7))*sin(basinPosition.z*2.9+sin(basinPosition.x*2.1));
      float ripple=sin(basinPosition.x*.23+sin(basinPosition.z*.031)*4.);
      float detailFade=1.-smoothstep(180.,2000.,length(vViewPosition));
      float rippleAA=1.-smoothstep(.25,1.2,fwidth(basinPosition.x*.23+sin(basinPosition.z*.031)*4.));
      float gritAA=1.-smoothstep(.2,1.,max(fwidth(basinPosition.x),fwidth(basinPosition.z))*3.7);
      diffuseColor.rgb*=1.+(grit*.035*gritAA+ripple*.085*rippleAA)*detailFade;
      // Ground-hugging gas masks distant relief while retaining a near horizon.
      float groundVeil=1.-exp(-length(vViewPosition)*.0019);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.215,.16),groundVeil*.82);`);
  };
  const terrain=new THREE.Mesh(geometry,material);terrain.receiveShadow=true;group.add(terrain);
  // Fixed boulders provide foreground scale without particles or animation.
  const rockGeometry=new THREE.IcosahedronGeometry(1,tier==='low'?0:1),rockMaterial=new THREE.MeshStandardMaterial({color:0x50382b,roughness:1});
  const rocks=new THREE.InstancedMesh(rockGeometry,rockMaterial,tier==='low'?3:7);
  const dummy=new THREE.Object3D();let seed=7103;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<rocks.count;i++){
    const along=(i/28)*1.15+.035,side=i%2?1:-1;
    const x=i<28?surfaceTrackX(along)+side*(100+rand()*160):850+(rand()-.5)*2600;
    const z=i<28?surfaceTrackZ(along)+(rand()-.5)*SURFACE_TRAVEL*.03:1400-rand()*4000;
    const r=i<28?1.8+rand()*4:1+Math.pow(rand(),3)*6;
    dummy.position.set(x,heightAt(x,z)+r*.2,z);dummy.scale.set(r,r*.55,r*.8);dummy.rotation.set(rand(),rand()*6,rand());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }
  rocks.computeBoundingSphere();group.add(rocks);
  // Slant optical depth and a broad forward-scattering lobe organize the sky.
  // The faint inherited colour veil remains an artistic atmospheric layer.
  const skyUniforms={elapsed:{value:CUTS[2]},surfaceStart:{value:CUTS[2]}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(39000,32,20),new THREE.ShaderMaterial({
    uniforms:skyUniforms,side:THREE.BackSide,depthWrite:false,
    vertexShader:`varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      uniform float elapsed;uniform float surfaceStart;varying vec3 skyDirection;
      void main(){
        vec3 direction=normalize(skyDirection);
        float h=max(0.,direction.y),az=atan(direction.x,-direction.z);
        float age=max(0.,elapsed-surfaceStart);
        float emergence=smoothstep(0.,10.,age);
        float airMass=1./sqrt(h*h+.025);
        vec3 beta=vec3(.12,.17,.235),transmittance=exp(-beta*airMass);
        vec3 solar=normalize(vec3(-.46,.18,-.87));
        float mu=dot(direction,solar),g=.72;
        float mie=(1.-g*g)/pow(max(.08,1.+g*g-2.*g*mu),1.5);
        float rayleigh=.75*(1.+mu*mu);
        vec3 col=vec3(.014,.023,.042)*transmittance;
        col+=(1.-transmittance)*mix(vec3(.30,.205,.125),vec3(.09,.14,.20),smoothstep(.1,.8,h))*(.62+rayleigh*.13);
        col+=vec3(.22,.135,.065)*(1.-transmittance)*mie*.045;
        float bend=.13+.035*sin(az*3.2+age*.037)+.018*sin(az*7.-age*.022);
        float envelope=smoothstep(.015,.075,h)*(1.-smoothstep(.32,.58,h));
        float curtain=exp(-abs(h-bend)*12.);
        float folds=.62+.22*sin(az*22.+sin(az*5.+age*.045)*2.5)+.10*sin(az*49.-age*.03);
        float mist=exp(-pow((h-.22)/.19,2.));
        float shift=.5+.5*sin(az*1.8+age*.055);
        vec3 gasTint=mix(vec3(.032,.092,.075),vec3(.077,.047,.088),shift);
        // Broad low-contrast colour change, with faint upward folds only.
        col+=gasTint*(curtain*folds*.35+mist*.12)*envelope*emergence;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.position.set(850,-760,1800);group.add(sky);
  return {group,heightAt,observerHeight:heightAt(850,1800),update(seconds){skyUniforms.elapsed.value=seconds;}};
}
