import * as THREE from 'three';
import { createFleet } from './ships.js';
import { createReferenceArk } from './reference-ark.js';
import { createEnvironment } from './environment.js';
import { createTimeline } from 'animejs';
import {CUTS,directCamera} from './camera.js';
import {approachProgress} from './flight.js';
import {DURATION} from './timeline.js';
import {createDeepSpaceAudio} from './audio.js';
import {installCinemaFrame} from '../shared/cinema-frame.js';
import {createFlightEnvironment} from '../space/surfaces.js';
import {POST_PHASES,enterPostMission,savePostMission,readPostMission} from '../shared/post-mission-state.js';
import {createPossibility} from './possibility.js';

const params=new URLSearchParams(location.search), requested=params.get('quality');
const phase=document.body.dataset.phase==='arrival'?'arrival':'migration',segment=POST_PHASES[phase];
const state=enterPostMission(phase),endTime=segment.start+segment.duration;
const targetPath=file=>location.pathname.includes('/works/first_dawn/')?'../terra_incognita/'+file:file;
let leaving=false,lastSaved=-1,possibility;
const tier=['high','mid','low'].includes(requested)?requested:innerWidth<700?'low':navigator.hardwareConcurrency>=8?'high':'mid';
const quality={high:{dpr:1.65,shadow:2048},mid:{dpr:1.25,shadow:1024},low:{dpr:1,shadow:512}}[tier];
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const schedule=[{start:1.5,duration:69,z:-150,x:50,y:20,scale:1.6},{start:4,duration:70,z:-1400,x:-800,y:220,scale:.65},{start:6,duration:72,z:-1750,x:1050,y:420,scale:.74},{start:8,duration:73,z:-2500,x:-1620,y:80,scale:.6},{start:9.5,duration:74,z:-3200,x:1830,y:490,scale:.62},{start:3,duration:92,z:-4100,x:-1250,y:620,scale:2.8}];
const motion=schedule.map(()=>({approach:0,deploy:0}));
const choreography=createTimeline({autoplay:false});
schedule.forEach((s,i)=>{
  choreography.add(motion[i],{approach:[0,1],duration:s.duration*1000,ease:'linear'},s.start*1000);
  choreography.add(motion[i],{deploy:[0,1],duration:16000,ease:'inOutSine'},(45+i*3)*1000);
});
let currentShot='arrival';
let renderer,scene,camera,fleet,environment,keyLight,seconds=segment.start+(params.has('test')?0:state.elapsed),paused=false,last=performance.now(),frame=0,frameTime=16,pixelRatio=Math.min(devicePixelRatio,quality.dpr);
const sunlightOffset=new THREE.Vector3(-1400,2600,1700);
const title=document.getElementById('line'),replay=document.getElementById('replay'),archive=document.getElementById('archive'),sound=document.getElementById('sound');
const audio=createDeepSpaceAudio(tier,on=>{
  sound.setAttribute('aria-pressed',String(on));
  sound.setAttribute('aria-label',on?'사운드 끄기':'사운드 켜기');
  sound.title=on?'사운드 끄기':'사운드 켜기';
},{inspect:params.has('test')});
document.getElementById('return').href=location.pathname.includes('/works/first_dawn/')?'../terra_incognita/index.html':'index.html';
archive.href=location.pathname.includes('/works/first_dawn/')?'../terra_incognita/field-archive.html':'field-archive.html';
title.textContent=state.evidence?'시뮬레이션 · 생명 발생 가능성 / 실제 생명 발견 아님':'미리보기 · 선행 탐사 기록 없음 / 생명 가능성 모형 미실행';
function persist(){state.elapsed=seconds-segment.start;if(phase==='arrival'&&seconds>=114)state.outcome=possibility?.snapshot();savePostMission(state);}
function next(){if(leaving)return;leaving=true;persist();state.phase=segment.next;state.elapsed=0;savePostMission(state);audio.pause();const url=new URL(targetPath(POST_PHASES[segment.next].file),location.href);for(const key of ['quality','full','terminal'])if(params.has(key))url.searchParams.set(key,params.get(key));location.assign(url.href);}

function resize(){
  camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<1?56:42;
  camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
}
function render(t){
  seconds=THREE.MathUtils.clamp(t,segment.start,endTime);
  const sceneTime=Math.min(seconds,DURATION),flightTime=sceneTime*2;
  choreography.seek(sceneTime*1000);
  const portrait=camera.aspect<1;
  fleet.forEach((ship,i)=>{
    const s=schedule[i],p=sceneTime<s.start?(sceneTime-s.start)/s.duration:motion[i].approach;
    // The flight frame is independent of all three observer positions.
    const anchorZ=portrait?2000:1000,near=anchorZ-s.z,far=16000+i*2200;
    const travel=approachProgress(p);
    const depth=THREE.MathUtils.lerp(far,near,travel);
    ship.position.set(s.x*(portrait?.5:1),s.y,anchorZ-depth);
    // All six vessels already occupy the distant scene; none spawn on a timer.
    ship.scale.setScalar(s.scale);ship.visible=true;
    // One small rest-to-rest attitude correction, no perpetual floating wobble.
    const correction=smooth((flightTime-64-i*3)/22);
    ship.rotation.set(-.025+i*.008,-.13+correction*.085,(i-2)*.012);
    const pulse=flightTime-(64+i*3);
    ship.userData.jets.forEach(j=>{j.visible=(pulse>=0&&pulse<.38)||(pulse>21.6&&pulse<22);});
    for(const {pivot,side} of ship.userData.deployables)pivot.rotation.z=side*(1-motion[i].deploy)*1.28;
  });
  currentShot=directCamera(camera,phase==='migration'?Math.min(sceneTime,68-.0001):sceneTime,fleet[0],environment.surfaceHeightAt,fleet[5]);
  // Follow the observed vessel with the shadow frustum, preserving solar direction.
  const shadowSubject=currentShot==='ring-passage'?fleet[5]:fleet[0];
  keyLight.target.position.copy(shadowSubject.position);
  keyLight.position.copy(shadowSubject.position).add(sunlightOffset);
  environment.update(flightTime,currentShot==='surface',camera,sceneTime);
  if(phase==='arrival')possibility.update(seconds,camera);
  const enter=smooth((seconds-segment.start)/.75),exit=1-smooth((seconds-(endTime-1.2))/.9);
  document.getElementById('cut').style.opacity=String(Math.max(1-enter,1-exit,...CUTS.map(at=>1-smooth(Math.abs(seconds-at)/.75))));
  title.style.opacity=String(phase==='arrival'?smooth((seconds-108)/2)*exit:0);
  replay.hidden=true;archive.hidden=true;
  audio.update(sceneTime,camera.position.distanceTo(shadowSubject.position),enter*exit);
  renderer.render(scene,camera);
}
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(paused || leaving || document.hidden || renderer.getContext().isContextLost())return;
  if(params.has('test'))return;
  frameTime=frameTime*.97+dt*1000*.03;
  if(++frame%180===0 && frameTime>27 && pixelRatio>.8){pixelRatio=Math.max(.8,pixelRatio-.15);renderer.setPixelRatio(pixelRatio);}
  render(seconds+dt);
  if(seconds-lastSaved>=2){persist();lastSaved=seconds;}
  if(seconds>=endTime)next();
}
function pause(){paused=true;if(!leaving)persist();audio.pause();}
function resume(){if(leaving){const saved=readPostMission();if(saved)location.replace(new URL(targetPath(POST_PHASES[saved.phase].file),location.href));return;}paused=false;last=performance.now();audio.resume();}
let soundChosen=false;
function firstInput(e){
  if(soundChosen||e.target.closest?.('button,a')||e.type==='keydown'&&['Shift','Control','Alt','Meta','Tab','Escape'].includes(e.key))return;
  try{if(sessionStorage.getItem('ti_audio_muted')==='1')return;}catch{}
  soundChosen=true;audio.enable();
}
try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:tier==='low'?'low-power':'high-performance'});
  renderer.setPixelRatio(pixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);scene=new THREE.Scene();scene.background=new THREE.Color(0x030507);
  camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,2,80000);resize();
  scene.environment=createFlightEnvironment(renderer,tier,1,{sun:sunlightOffset,planet:new THREE.Vector3(0,-17400,-10500)}).texture;
  scene.environmentIntensity=.55;
  scene.add(new THREE.HemisphereLight(0xb7cbdf,0x584535,.16));
  keyLight=new THREE.DirectionalLight(0xffe4c4,2.45);keyLight.castShadow=true;
  keyLight.shadow.mapSize.setScalar(quality.shadow);Object.assign(keyLight.shadow.camera,{left:-1900,right:1900,top:1900,bottom:-1900,near:100,far:9000});keyLight.shadow.bias=-.00012;keyLight.shadow.normalBias=1.1;scene.add(keyLight,keyLight.target);
  const fill=new THREE.DirectionalLight(0x8faccc,.22);fill.position.set(1800,-600,-2200);scene.add(fill);
  environment=createEnvironment(scene,tier);fleet=[...createFleet(tier),createReferenceArk(tier)];fleet.forEach(ship=>scene.add(ship));
  possibility=createPossibility(scene,environment.surfaceHeightAt,state.evidence,state.seed);
  render(seconds);document.getElementById('loading').classList.add('done');
  setTimeout(()=>{document.getElementById('loading').hidden=true;},1300);
  installCinemaFrame((width,height,left,top)=>{camera.aspect=width/height;renderer.setSize(width,height);Object.assign(renderer.domElement.style,{left:`${left}px`,top:`${top}px`});render(seconds);});
  document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());addEventListener('pagehide',pause);addEventListener('pageshow',resume);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();document.getElementById('error').hidden=false;document.getElementById('error').textContent='화면 연결이 중단되었습니다. 새로고침하면 다시 시작합니다.';});
  replay.addEventListener('click',()=>{audio.replay();render(segment.start);resume();if(!soundChosen){soundChosen=true;audio.enable();}});
  sound.addEventListener('click',()=>{soundChosen=true;if(audio.enabled)audio.mute();else audio.enable();});
  addEventListener('pointerdown',firstInput);addEventListener('keydown',firstInput);
  window.FIRST_DAWN={snapshot:()=>({phase,seconds,elapsed:seconds-segment.start,duration:segment.duration,endTime,preview:!state.evidence,possibility:possibility.snapshot(),tier,shot:currentShot,cameraPosition:camera.position.toArray(),cameraFov:camera.fov,surfaceHeight:environment.surfaceHeightAt(camera.position.x,camera.position.z),ships:fleet.filter(s=>s.visible).length,total:fleet.length,referenceArks:fleet.filter(s=>s.name==='sf-migration-ark').length,originalArks:fleet.filter(s=>s.name.startsWith('ark-')).length,paused,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,pixelRatio,independent:!window.TI_WORLD,animation:'anime.js',motion:'restrained-distant / accelerating-approach / finite-braking',deployment:motion.map(s=>s.deploy)}),...(params.has('test')?{seek:render,next,positions:()=>fleet.map(s=>s.position.toArray())}:{})};
  if(params.has('test'))window.FIRST_DAWN.audio=audio.snapshot;
  requestAnimationFrame(tick);
}catch(error){document.getElementById('loading').hidden=true;const box=document.getElementById('error');box.hidden=false;box.textContent='3D 화면을 시작할 수 없습니다. WebGL을 지원하는 브라우저에서 다시 열어주세요.';console.error(error);}
