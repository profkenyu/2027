// Resource-limited reaction/diffusion toy. Its field is NOT an organism,
// biological evidence, a probability of abiogenesis, or a planetary forecast.
export const GRID=32,STEP=.05;
const clamp=x=>Math.max(0,Math.min(1,x));
export function possibilityConditions(evidence){
 if(!evidence)return null;
 const thermal=clamp(1-Math.abs(evidence.temperature-246)/80);
 return {resource:clamp(.3+evidence.energy*.5),growth:.3+thermal*.25,
  decay:.12+clamp(evidence.radiation)*.55+(1-clamp(evidence.energy))*.15,
  diffusion:.32,water:evidence.water?1:0};
}
export class PossibilityModel{
 constructor(evidence,seed='000000'){
  this.conditions=possibilityConditions(evidence);this.seed=parseInt(seed||'000000',16)||0;
  this.field=new Float32Array(GRID*GRID);this.next=new Float32Array(GRID*GRID);this.resource=new Float32Array(GRID*GRID);this.steps=0;this.reset();
 }
 reset(){this.steps=0;this.field.fill(0);this.next.fill(0);
  // A fixed, bounded substrate corridor makes resource geometry constrain
  // the expansion. It is a toy boundary condition, not measured soil.
  for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++){
   const corridor=.5+.5*Math.sin(x*.75+Math.sin(y*.42)+(this.seed%13)*.2);
   this.resource[y*GRID+x]=(this.conditions?.resource??0)*(.55+.45*corridor);
  }
  if(this.conditions){const x=14+(this.seed%5),y=14+((this.seed>>>4)%5);this.field[y*GRID+x]=.8;this.field[y*GRID+x+1]=.3;}
 }
 advance(seconds){const target=Math.floor(Math.max(0,Math.min(24,seconds))/STEP+1e-8);if(target<this.steps)this.reset();
  const c=this.conditions;if(!c)return;
  while(this.steps<target){
   this.next.fill(0);
   for(let y=1;y<GRID-1;y++)for(let x=1;x<GRID-1;x++){
    const i=y*GRID+x,u=this.field[i],r=this.resource[i];
    const lap=this.field[i-1]+this.field[i+1]-2*u+.3*(this.field[i-GRID]+this.field[i+GRID]-2*u);
    const reaction=c.growth*c.water*r*u*(1-u)-c.decay*u;
    this.next[i]=clamp(u+STEP*(c.diffusion*lap+reaction));
    this.resource[i]=clamp(r-STEP*.09*u*r);
   }
   [this.field,this.next]=[this.next,this.field];this.steps++;
  }
 }
 snapshot(){let mass=0,peak=0;for(const v of this.field){mass+=v;peak=Math.max(peak,v);}return {steps:this.steps,mass,peak,status:!this.conditions?'unavailable':mass<.25?'fading':mass>1.1?'persisting':'fragile',conditions:this.conditions};}
}
