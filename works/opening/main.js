import {OpeningBlueprintSequence} from '../terra_incognita/opening-blueprints.js';
import {AnimeRituals} from '../terra_incognita/anime-rituals.js';
import preparedModels from './blueprints.json' with {type:'json'};
import {readCheckpoint, clearCheckpoint, PLANET_PAGES} from '../../engine/core/checkpoint.js';
import {readTransfer,resetPlanetState,transferPage} from '../../engine/core/planet-state.js';
import {readPostMission,clearPostMission,POST_PHASES} from '../shared/post-mission-state.js';

const params=new URLSearchParams(location.search);
const tier=['high','mid','low'].includes(params.get('quality'))?params.get('quality'):innerWidth<900?'low':'high';
const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<700;
document.body.classList.toggle('ti-mobile',mobile);
let phase='blueprints',leaving=false;
const buttons=[...document.querySelectorAll('#ti-start,#ti-mobile-start')];
const restart=document.getElementById('ti-restart');
let checkpoint=readCheckpoint();
let transfer=readTransfer();
let post=readPostMission();
function syncResume(){
  checkpoint=readCheckpoint();
  transfer=readTransfer();
  post=readPostMission();
  buttons.forEach(button=>{button.querySelector('span').textContent=post||checkpoint||transfer?'RESUME':'START';button.setAttribute('aria-label',post||checkpoint||transfer?'저장된 지점에서 탐사 재개':'새 탐사 시작');});
  restart.hidden=!(post||checkpoint||transfer);restart.disabled=phase!=='start';
}
syncResume();
const rituals=new AnimeRituals();
const blueprints=new OpeningBlueprintSequence({preparedModels,tier});
function ready(){
  phase='start';document.body.classList.add('ti-prologue-reading');
  document.getElementById('ti-prologue').classList.add('armed');
  rituals.beginTitleBinding();buttons.forEach(button=>button.disabled=false);
  syncResume();
}
function start(fresh=false){
  if(phase!=='start'||leaving)return;
  leaving=true;buttons.forEach(button=>button.disabled=true);
  document.getElementById('depart').style.opacity='1';
  if(fresh){clearCheckpoint();resetPlanetState();clearPostMission();}
  const page=!fresh&&post?POST_PHASES[post.phase].file:!fresh&&checkpoint?PLANET_PAGES[checkpoint.world]:!fresh&&transfer?transferPage(transfer):'planet-01.html';
  const target=new URL((location.pathname.includes('/works/opening/')?'../terra_incognita/':'')+page,location.href);
  if(fresh||(!post&&!checkpoint&&!transfer))target.searchParams.set('fresh','1');
  for(const key of ['quality','terminal','full','test'])if(params.has(key))target.searchParams.set(key,params.get(key));
  setTimeout(()=>location.assign(target.href),650);
}
buttons.forEach(button=>button.addEventListener('click',()=>start()));
restart.addEventListener('click',()=>start(true));
addEventListener('keydown',event=>{if(!event.repeat&&(event.code==='Enter'||event.code==='Space')){event.preventDefault();start();}});
function suspend(){blueprints.suspend();rituals.suspend?.();}
function resume(){
  syncResume();
  if(leaving){leaving=false;document.getElementById('depart').style.opacity='0';buttons.forEach(button=>button.disabled=phase!=='start');}
  blueprints.resume();rituals.resume?.();
}
addEventListener('pagehide',suspend);addEventListener('pageshow',resume);
document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());
window.TI_BLUEPRINT=()=>blueprints.snapshot();
window.TI_OPENING=()=>({...blueprints.snapshot(),phase,independent:!window.TI_WORLD});
if(params.has('test'))window.TI_OPENING_TEST={seek(ms){blueprints.suspend();blueprints.elapsed=ms;blueprints._apply(ms,true);if(ms>=blueprints.total)blueprints._complete();return window.TI_OPENING();}};
try{blueprints.start(ready);window.TI_READY=true;}
catch(error){const box=document.getElementById('opening-error');box.hidden=false;box.textContent='설계도를 시작할 수 없습니다. 페이지를 다시 열어주세요.';console.error(error);}
