export const POST_KEY='beyond-known:post-mission:v1';
export const POST_PHASES=Object.freeze({migration:{file:'migration.html',start:0,duration:68,next:'arrival'},arrival:{file:'arrival.html',start:68,duration:70,next:'ending'},ending:{file:'ending.html',start:0,duration:18,next:null}});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function readPostMission(){
 try{const s=JSON.parse(sessionStorage.getItem(POST_KEY)||'null');
  if(s?.version!==1||!POST_PHASES[s.phase]||!Number.isFinite(s.elapsed)||s.elapsed<0||s.elapsed>POST_PHASES[s.phase].duration)return null;
  if(s.evidence&&(!/^[0-9a-f]{6}$/i.test(s.seed)||!Number.isFinite(s.evidence.temperature)||!Number.isFinite(s.evidence.energy)||!Number.isFinite(s.evidence.radiation)||s.evidence.samples!==6||s.evidence.water!==true||s.evidence.nodes!==3))return null;
  return s;
 }catch{return null;}
}
export function savePostMission(state){try{sessionStorage.setItem(POST_KEY,JSON.stringify(state));return true;}catch{return false;}}
export function clearPostMission(){try{sessionStorage.removeItem(POST_KEY);}catch{}}
export function beginPostMission(seed,ledger,environment,geology){
 if(!ledger?.ready||ledger.samples?.length!==6||!ledger.water?.confirmed||!geology?.complete||geology.records?.length!==3)throw Error('Post-mission requires completed observations');
 const state={version:1,phase:'migration',elapsed:0,seed,evidence:{samples:6,water:true,nodes:3,
  temperature:clamp(environment.temperature,100,500),energy:clamp(environment.energy,0,1),radiation:clamp(environment.radiation,0,1),
  distance:Math.max(0,ledger.journey?.distance??0)},outcome:null};savePostMission(state);return state;
}
export function enterPostMission(phase){
 const saved=readPostMission();
 const state=saved??{version:1,phase,elapsed:0,seed:null,evidence:null,outcome:null};
 if(state.phase!==phase){state.phase=phase;state.elapsed=0;}
 return state;
}
