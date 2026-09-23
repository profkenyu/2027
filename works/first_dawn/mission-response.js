// Bounded artistic translation of mission evidence; not thermal engineering.
const clamp=x=>Math.max(0,Math.min(1,x));
export function migrationResponse(evidence){
 if(!evidence)return {source:'preview',energy:null,thermal:null,opening:1,duration:16};
 const energy=clamp(evidence.energy),thermal=clamp((evidence.temperature-210)/65);
 return {source:'mission-record',energy,thermal,
  opening:.48+.32*thermal+.2*energy,duration:22-8*energy};
}
export function sampleSignatures(samples){
 if(!Array.isArray(samples)||samples.length!==6||samples.some(s=>typeof s?.sample!=='string'||typeof s?.sign!=='string'))return null;
 return samples.map(s=>{let hash=2166136261;for(const char of `${s.sample}|${s.sign}`){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0)/4294967295;});
}
