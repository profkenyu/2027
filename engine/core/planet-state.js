// Environmental values are authored simulation estimates, never real planetary measurements.
export const PLANET_STATE_KEY='beyond-known:planet-state:v1';
export const TRANSFER_KEY='beyond-known:transfer:v1';
const worlds=['terra','desert','granite'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const defaults={terra:{temperature:246,radiation:.32},desert:{temperature:218,radiation:.56},granite:{temperature:233,radiation:.21}};
function storage(){try{return globalThis.sessionStorage;}catch{return null;}}
function read(key){try{return JSON.parse(storage()?.getItem(key)||'null');}catch{return null;}}
function write(key,value){try{storage()?.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function resetPlanetState(){try{storage()?.removeItem(PLANET_STATE_KEY);storage()?.removeItem(TRANSFER_KEY);}catch{}}
export function validEnvironment(p){return p&&Number.isFinite(p.temperature)&&p.temperature>=100&&p.temperature<=500&&Number.isFinite(p.radiation)&&p.radiation>=0&&p.radiation<=1&&Number.isFinite(p.energy)&&p.energy>=0&&p.energy<=1&&Number.isFinite(p.elapsed)&&p.elapsed>=0&&Number.isFinite(p.terrainHeight)&&Number.isFinite(p.water)&&p.water>=0&&p.water<=1;}
export function baseline(world='terra'){return {...defaults[world],energy:1,terrainHeight:0,water:0,elapsed:0,observations:0,provenance:'authored environmental estimate'};}
export class PlanetState{
  constructor(){const saved=read(PLANET_STATE_KEY);this.worlds={};for(const world of worlds)this.worlds[world]=saved?.version===1&&validEnvironment(saved.worlds?.[world])?saved.worlds[world]:baseline(world);this.accumulator=0;this.persistClock=0;}
  observe(world,dt,probe,charge,waterConfirmed=false){
    if(!worlds.includes(world)||!Number.isFinite(dt))return;
    const p=this.worlds[world],step=clamp(dt,0,.1);p.elapsed+=step;this.accumulator+=step;this.persistClock+=step;
    if(this.accumulator<1)return;this.accumulator=0;
    const height=Number.isFinite(probe.height)?probe.height:0;
    // A bounded diurnal/elevation field, not a climate or biological model.
    const solar=.5+.5*Math.cos((p.elapsed/600)+((probe.x||0)*.0004));
    p.temperature+=((defaults[world].temperature+solar*12-height*.001)-p.temperature)*.08;
    p.radiation=clamp(defaults[world].radiation*(.75+.25*solar),0,1);
    p.energy=clamp(Number.isFinite(charge)?charge:p.energy,0,1);p.terrainHeight=height;
    p.water=waterConfirmed?1:0;p.observations++;if(this.persistClock>=5){this.persistClock=0;this.persist();}
  }
  snapshot(world){return world?{...this.worlds[world]}:{version:1,worlds:structuredClone(this.worlds)};}
  persist(){write(PLANET_STATE_KEY,this.snapshot());}
  departure(world,charge){if(Number.isFinite(charge))this.worlds[world].energy=clamp(charge,0,1);this.persist();return this.snapshot(world);}
}
export function transferPage(t){return t.stage==='flight'?(t.source==='desert'?'space-02.html':'space-01.html'):(t.target==='granite'?'planet-03.html':'planet-02.html');}
export function readTransfer(){const t=read(TRANSFER_KEY);return t?.version===1&&((t.source==='terra'&&t.target==='desert')||(t.source==='desert'&&t.target==='granite'))&&['flight','arrival'].includes(t.stage)&&/^[0-9a-f]{6}$/i.test(t.seed)&&Number.isFinite(t.elapsed)&&t.elapsed>=0&&t.elapsed<=64&&validEnvironment(t.environment)?t:null;}
export function beginTransfer(seed,environment,source='terra',target='desert'){const t={version:1,source,target,stage:'flight',seed,elapsed:0,environment};write(TRANSFER_KEY,t);return t;}
export function saveTransfer(t){if(t&&validEnvironment(t.environment))write(TRANSFER_KEY,t);}
export function flightResponse(environment){
  const e=validEnvironment(environment)?environment:baseline();
  // Instrument-to-form and instrument-to-sound mappings are artistic, bounded and shared.
  const thermal=clamp((e.temperature-210)/65,0,1);
  return {thermal,radiator:clamp(.2+thermal*.65+(1-e.energy)*.15,0,1),toneHz:36+e.radiation*18,signalGain:.015+e.radiation*.025,energy:e.energy};
}
