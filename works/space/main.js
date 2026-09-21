import * as THREE from 'three';
import {createSurveyor} from './model.js';
import {DURATION,CUTS,pose,createVoid,shotAt} from './scene.js';
import {createCabinAudio} from './audio.js';
import {createFlightEnvironment} from './surfaces.js';
import {readTransfer,saveTransfer,baseline,flightResponse} from '../../engine/core/planet-state.js';
const params=new URLSearchParams(location.search),test=params.has('test');
const passage=document.body.dataset.passage==='2'?2:1,source=passage===2?'desert':'terra',destination=passage===2?'planet-03.html':'planet-02.html';
const cuts=passage===2?[26,44]:CUTS;
const tier=['high','mid','low'].includes(params.get('quality'))?params.get('quality'):innerWidth<700?'low':navigator.hardwareConcurrency>=8?'high':'mid';
const quality={high:{dpr:1.65,shadow:2048},mid:{dpr:1.25,shadow:1024},low:{dpr:1,shadow:512}}[tier];
const savedTransfer=readTransfer(),transfer=savedTransfer?.source===source?savedTransfer:null,response=flightResponse(transfer?.environment??baseline(source));
const audio=createCabinAudio(response),veil=document.getElementById('veil'),sound=document.getElementById('sound');
const lightOffset=new THREE.Vector3(passage===2?28:-28,24,-14);
let renderer,scene,camera,surveyor,voidScene,keyLight,t=test?0:transfer?.stage==='flight'?Math.min(transfer.elapsed,DURATION-2):0,last=performance.now(),paused=false,leaving=false,average=16,frames=0,lastSave=t;
let dpr=Math.min(devicePixelRatio,quality.dpr);
const targetPath=file=>location.pathname.includes('/works/space/')?'../terra_incognita/'+file:file;
document.getElementById('return').href=targetPath('index.html');
function persist(){if(transfer&&transfer.stage==='flight'){transfer.elapsed=t;saveTransfer(transfer);}}
function arrive(){if(leaving)return;leaving=true;audio.pause();if(transfer){transfer.stage='arrival';transfer.elapsed=DURATION;saveTransfer(transfer);}const url=new URL(targetPath(destination),location.href);for(const key of ['quality','full','terminal'])if(params.has(key))url.searchParams.set(key,params.get(key));location.assign(url.href);}
function render(seconds){
  t=THREE.MathUtils.clamp(seconds,0,DURATION);pose(camera,surveyor.group,t,passage);surveyor.update(t,response);
  voidScene.stars.position.copy(camera.position);keyLight.target.position.copy(surveyor.group.position);keyLight.position.copy(surveyor.group.position).add(lightOffset);
  const blackout=Math.max(1-THREE.MathUtils.smoothstep(t,0,2),THREE.MathUtils.smoothstep(t,61.5,64),...cuts.map(c=>1-THREE.MathUtils.smoothstep(Math.abs(t-c),0,.7)));
  veil.style.opacity=String(blackout);audio.update(t);renderer.render(scene,camera);
}
function resize(){camera.aspect=innerWidth/innerHeight;renderer.setSize(innerWidth,innerHeight);render(t);}
function pause(){paused=true;persist();audio.pause();}
function resume(){paused=false;last=performance.now();audio.resume();}
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.1,(now-last)/1000);last=now;if(paused||document.hidden||leaving||test)return;average=.97*average+.03*dt*1000;if(++frames%180===0&&average>27&&dpr>.8){dpr=Math.max(.8,dpr-.15);renderer.setPixelRatio(dpr);}render(t+dt);if(t-lastSave>=2){lastSave=t;persist();}if(t>=DURATION)arrive();}
try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:tier==='low'?'low-power':'high-performance'});renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0x030507);scene.environment=createFlightEnvironment(renderer,tier,passage).texture;camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.25,30000);
  scene.add(new THREE.HemisphereLight(0x9bacba,0x15110d,.23));keyLight=new THREE.DirectionalLight(0xffe4c4,2.45);keyLight.castShadow=true;keyLight.shadow.mapSize.setScalar(quality.shadow);Object.assign(keyLight.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:1,far:100});keyLight.shadow.normalBias=.025;keyLight.shadow.bias=-.00015;scene.add(keyLight,keyLight.target);
  if(passage===2)keyLight.color.setHex(0xe4ecf3);
  const fill=new THREE.DirectionalLight(0x8faccc,.22);fill.position.set(10,5,20);scene.add(fill);
  surveyor=createSurveyor(tier);scene.add(surveyor.group);voidScene=createVoid(scene,tier,passage);render(t);document.getElementById('loading').hidden=true;
  window.BTK_SPACE={snapshot:()=>({passage,seconds:t,duration:DURATION,shot:shotAt(t,passage),tier,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,dpr,paused,independent:!window.TI_WORLD,response,environment:transfer?.environment??baseline(source),radiators:surveyor.radiators.map(r=>r.pivot.rotation.z),audio:audio.snapshot(),position:surveyor.group.position.toArray(),cameraPosition:camera.position.toArray(),cameraFov:camera.fov,cameraFocus:camera.userData.focus.toArray()}),...(test?{seek:render,arrive}:{})};
  sound.addEventListener('click',async()=>{if(audio.enabled)audio.mute();else await audio.enable();sound.setAttribute('aria-pressed',String(audio.enabled));audio.update(t);});
  // Browser audio permission remains a deliberate gesture on this document.
  addEventListener('resize',resize);addEventListener('pagehide',pause);addEventListener('pageshow',resume);document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();const error=document.getElementById('error');error.hidden=false;error.textContent='화면 연결이 중단되었습니다. 새로고침하면 저장된 항해 지점에서 재개합니다.';});
  requestAnimationFrame(tick);
}catch(error){document.getElementById('loading').hidden=true;const box=document.getElementById('error');box.hidden=false;box.textContent='우주비행 화면을 시작하지 못했습니다. 새로고침해 다시 시도해주세요.';console.error(error);}
