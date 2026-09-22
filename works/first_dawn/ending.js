import {enterPostMission,savePostMission,readPostMission,POST_PHASES} from '../shared/post-mission-state.js';
import {installCinemaFrame} from '../shared/cinema-frame.js';
const params=new URLSearchParams(location.search),state=enterPostMission('ending');
let seconds=params.has('test')?0:state.elapsed,paused=false,leaving=false,last=performance.now(),lastSaved=-1;
const title=document.getElementById('line'),archive=document.getElementById('archive'),replay=document.getElementById('replay');
const path=file=>location.pathname.includes('/works/first_dawn/')?'../terra_incognita/'+file:file;
document.getElementById('loading').hidden=true;document.getElementById('sound').hidden=true;
document.getElementById('return').href=path('index.html');archive.href=path('field-archive.html');
Object.assign(title.style,{top:'40%',bottom:'auto',zIndex:'4'});
title.textContent='우리는 이제 여기서 시작한다';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function persist(){state.elapsed=seconds;savePostMission(state);}
function render(t){seconds=Math.max(0,Math.min(18,t));title.style.opacity=String(smooth((seconds-4)/6));archive.hidden=replay.hidden=seconds<12;}
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.1,(now-last)/1000);last=now;if(paused||document.hidden||params.has('test')||seconds>=18)return;render(seconds+dt);if(seconds-lastSaved>=2||seconds>=18){persist();lastSaved=seconds;}}
function pause(){paused=true;if(!leaving)persist();}function resume(){if(leaving){const saved=readPostMission();if(saved)location.replace(new URL(path(POST_PHASES[saved.phase].file),location.href));return;}paused=false;last=performance.now();}
replay.addEventListener('click',()=>{leaving=true;state.phase='migration';state.elapsed=0;state.outcome=null;savePostMission(state);const url=new URL(path('migration.html'),location.href);if(params.has('quality'))url.searchParams.set('quality',params.get('quality'));location.assign(url.href);});
addEventListener('pagehide',pause);addEventListener('pageshow',resume);document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());
installCinemaFrame();render(seconds);requestAnimationFrame(tick);
window.BTK_ENDING={snapshot:()=>({phase:'ending',seconds,duration:18,paused,independent:true,preview:!state.evidence,outcome:state.outcome}),...(params.has('test')?{seek:render}:{})};
