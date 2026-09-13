import * as THREE from 'three';
import { createFleet } from './ships.js';
import { createEnvironment } from './environment.js';
import { createTimeline } from 'animejs';
import {CUTS,directCamera} from './camera.js';

const params=new URLSearchParams(location.search), requested=params.get('quality');
const tier=['high','mid','low'].includes(requested)?requested:innerWidth<700?'low':navigator.hardwareConcurrency>=8?'high':'mid';
const quality={high:{dpr:1.65,shadow:2048},mid:{dpr:1.25,shadow:1024},low:{dpr:1,shadow:512}}[tier];
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const schedule=[{start:5,duration:143,z:-150,x:50,y:20,scale:1.35},{start:18,duration:129,z:-1400,x:-800,y:220,scale:.65},{start:12,duration:155,z:-1750,x:1050,y:420,scale:.74},{start:27,duration:144,z:-2500,x:-1620,y:80,scale:.6},{start:36,duration:139,z:-3200,x:1830,y:490,scale:.62}];
const motion=schedule.map(()=>({approach:0,deploy:0}));
const choreography=createTimeline({autoplay:false});
schedule.forEach((s,i)=>{
  choreography.add(motion[i],{approach:[0,1],duration:s.duration*1000,ease:'linear'},s.start*1000);
  choreography.add(motion[i],{deploy:[0,1],duration:24000,ease:'inOutSine'},(91+i*7)*1000);
});
let currentShot='arrival';
let renderer,scene,camera,fleet,environment,seconds=0,paused=false,last=performance.now(),frame=0,frameTime=16,pixelRatio=Math.min(devicePixelRatio,quality.dpr),audio=null,playing=false;
const title=document.getElementById('line'),replay=document.getElementById('replay'),archive=document.getElementById('archive'),sound=document.getElementById('sound');
const isDist=/\/dist\//.test(location.pathname);
document.getElementById('return').href=isDist?'TERRA_INCOGNITA.html':/\/works\/first_dawn\//.test(location.pathname)?'../terra_incognita/index.html':'index.html';
archive.href=isDist?'FIELD_ARCHIVE.html':/\/works\/first_dawn\//.test(location.pathname)?'../terra_incognita/field-archive.html':'field-archive.html';

function resize(){
  camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<1?56:42;
  camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
}
function render(t){
  seconds=THREE.MathUtils.clamp(t,0,60);
  // Retime the authored fleet to three editorial windows; preserve the approved
  // final approach state while bringing the fleet close within the first 15s.
  const flightTime=seconds<15?seconds*(95/15):seconds<35?95+(seconds-15)*2.5:145+(seconds-35)*1.4;
  choreography.seek(flightTime*1000);
  const portrait=camera.aspect<1;
  fleet.forEach((ship,i)=>{
    const s=schedule[i],p=motion[i].approach;
    // The flight frame is independent of all three observer positions.
    const anchorZ=portrait?2000:1000,near=anchorZ-s.z,far=18000+i*2200;
    // Constant velocity coast followed by finite-duration braking. Units and
    // encounter duration are cinematic, not an orbital ephemeris.
    const brake=.84, u=Math.min(p,brake), v=Math.max(0,(p-brake)/(1-brake));
    const travel=(u+(1-brake)*(v-v*v*v+.5*v*v*v*v))/(brake+(1-brake)*.5);
    const depth=THREE.MathUtils.lerp(far,near,travel);
    ship.position.set(s.x*(portrait?.5:1),s.y,anchorZ-depth);
    ship.scale.setScalar(s.scale);ship.visible=flightTime>=s.start;
    // One small rest-to-rest attitude correction, no perpetual floating wobble.
    const correction=smooth((flightTime-64-i*3)/22);
    ship.rotation.set(-.025+i*.008,-.13+correction*.085,(i-2)*.012);
    const pulse=flightTime-(64+i*3);
    ship.userData.jets.forEach(j=>{j.visible=(pulse>=0&&pulse<.38)||(pulse>21.6&&pulse<22);});
    for(const {pivot,side} of ship.userData.deployables)pivot.rotation.z=side*(1-motion[i].deploy)*1.28;
  });
  currentShot=directCamera(camera,seconds,fleet[0],environment.observerHeight);
  environment.update(flightTime,currentShot==='surface',camera,seconds);
  document.getElementById('cut').style.opacity=String(Math.max(...CUTS.map(at=>1-smooth(Math.abs(seconds-at)/.75))));
  title.style.opacity=String(currentShot==='surface'?smooth((seconds-38)/6):0);
  replay.hidden=seconds<59;archive.hidden=seconds<39;
  if(audio){const rise=smooth((seconds-2)/20),fall=1-smooth((seconds-35)/24);audio.gain.gain.setTargetAtTime(playing?rise*fall*.12:0,audio.ctx.currentTime,.6);}
  renderer.render(scene,camera);
}
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(paused || document.hidden || renderer.getContext().isContextLost())return;
  if(seconds>=60)return;
  if(params.has('test'))return;
  frameTime=frameTime*.97+dt*1000*.03;
  if(++frame%180===0 && frameTime>27 && pixelRatio>.8){pixelRatio=Math.max(.8,pixelRatio-.15);renderer.setPixelRatio(pixelRatio);}
  render(seconds+dt);
}
async function toggleSound(){
  if(!audio){
    const ctx=new AudioContext(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;gain.gain.value=0;gain.connect(filter);filter.connect(ctx.destination);
    const voices=[36.708,55,73.416,110,138.591].map((f,i)=>{const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=i<2?'sine':'triangle';osc.frequency.value=f;g.gain.value=.23/(1+i*.6);osc.connect(g);g.connect(gain);osc.start();return osc;});
    audio={ctx,gain,voices};
  }
  playing=!playing;await audio.ctx.resume();sound.textContent=playing?'SOUND ON':'SOUND OFF';sound.setAttribute('aria-pressed',String(playing));sound.setAttribute('aria-label',playing?'사운드 끄기':'사운드 켜기');render(seconds);
}
function pause(){paused=true;audio?.ctx.suspend();}
function resume(){paused=false;last=performance.now();if(playing)audio?.ctx.resume();}
try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:tier==='low'?'low-power':'high-performance'});
  renderer.setPixelRatio(pixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);scene=new THREE.Scene();scene.background=new THREE.Color(0x030507);
  camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,2,80000);resize();
  scene.add(new THREE.HemisphereLight(0xe6e8e5,0x655749,.28));
  const sun=new THREE.DirectionalLight(0xfff4e5,2.1);sun.position.set(-1400,2600,1700);sun.target.position.set(0,0,-150);sun.castShadow=true;
  sun.shadow.mapSize.setScalar(quality.shadow);Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,near:100,far:8000});sun.shadow.bias=-.00012;sun.shadow.normalBias=1.1;scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0xd3c5b9,.22);fill.position.set(1800,-1100,600);scene.add(fill);
  environment=createEnvironment(scene,tier);fleet=createFleet(tier);fleet.forEach(ship=>scene.add(ship));
  render(0);document.getElementById('loading').classList.add('done');
  setTimeout(()=>{document.getElementById('loading').hidden=true;},1300);
  addEventListener('resize',()=>{resize();render(seconds);});
  document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());addEventListener('pagehide',pause);addEventListener('pageshow',resume);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();document.getElementById('error').hidden=false;document.getElementById('error').textContent='화면 연결이 중단되었습니다. 새로고침하면 다시 시작합니다.';});
  replay.addEventListener('click',()=>{render(0);resume();});sound.addEventListener('click',()=>toggleSound().catch(()=>{sound.textContent='SOUND OFF';playing=false;}));
  window.FIRST_DAWN={snapshot:()=>({seconds,duration:60,tier,shot:currentShot,cameraPosition:camera.position.toArray(),cameraFov:camera.fov,surfaceHeight:environment.observerHeight,ships:fleet.filter(s=>s.visible).length,total:fleet.length,paused,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,pixelRatio,independent:!window.TI_WORLD,animation:'anime.js',motion:'inertial-coast / finite-braking',deployment:motion.map(s=>s.deploy)}),...(params.has('test')?{seek:render,positions:()=>fleet.map(s=>s.position.toArray())}:{})};
  requestAnimationFrame(tick);
}catch(error){document.getElementById('loading').hidden=true;const box=document.getElementById('error');box.hidden=false;box.textContent='3D 화면을 시작할 수 없습니다. WebGL을 지원하는 브라우저에서 다시 열어주세요.';console.error(error);}
