export const CHECKPOINT_KEY='terra-incognita:checkpoint:v1';
export const PLANET_PAGES=Object.freeze({terra:'planet-01.html',desert:'planet-02.html',granite:'planet-03.html'});
const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
function session(){try{return globalThis.sessionStorage;}catch{return null;}}
export function validCheckpoint(value){
  if(value?.version!==1||!Object.hasOwn(PLANET_PAGES,value.world))return false;
  const memory=value.memory;
  if(memory?.version!==3||!Array.isArray(memory.samples)||memory.samples.length>6||
    memory.samples.some(sample=>!sample||typeof sample!=='object'))return false;
  if(memory.water && (!Array.isArray(memory.water.absorptionBandsMicron)||memory.water.absorptionBandsMicron.length>8||
    memory.water.absorptionBandsMicron.some(n=>!Number.isFinite(n))))return false;
  if(value.world==='granite'&&(memory.samples.length!==6||memory.water?.confirmed!==true))return false;
  const p=value.rover;
  return /^[0-9a-f]{6}$/i.test(value.seed)&&finite(value.savedAt,0,1e15)&&
    !!p&&finite(p.x,-20000,20000)&&finite(p.z,-20000,20000)&&finite(p.heading,-1e6,1e6)&&
    finite(value.charge,.001,1)&&['observer','explorer'].includes(value.mode)&&
    Array.isArray(value.selections)&&value.selections.length===6&&value.selections.every((n,i)=>Number.isInteger(n)&&(n===-1||Math.floor(n/3)===i))&&
    Number.isInteger(value.geological)&&value.geological>=0&&value.geological<3&&
    !!memory;
}
export function readCheckpoint(storage=session()){
  try{const raw=storage?.getItem(CHECKPOINT_KEY)||'null';if(raw.length>64000)return null;const value=JSON.parse(raw);return validCheckpoint(value)?value:null;}catch{return null;}
}
export function writeCheckpoint(value,storage=session()){
  if(!validCheckpoint(value)||!storage)return false;
  try{storage.setItem(CHECKPOINT_KEY,JSON.stringify(value));return true;}catch{return false;}
}
export function clearCheckpoint(storage=session()){
  try{storage?.removeItem(CHECKPOINT_KEY);}catch{}
}
