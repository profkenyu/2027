// Resource-limited reaction/diffusion toy. Its field is NOT an organism,
// biological evidence, a probability of abiogenesis, or a planetary forecast.
export const GRID=64,STEP=.05;
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
  this.field=new Float32Array(GRID*GRID);this.next=new Float32Array(GRID*GRID);this.resource=new Float32Array(GRID*GRID);this.substrate=new Float32Array(GRID*GRID);this.steps=0;
  // Authored fracture graph: geometry is a boundary condition, not geological evidence.
  let state=this.seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  this.fractures=[];
  const branch=(x,y,angle,length,depth)=>{
   const nx=x+Math.cos(angle)*length,ny=y+Math.sin(angle)*length;
   this.fractures.push([x,y,nx,ny]);
   if(depth)for(const side of [-1,1])branch(nx,ny,angle+side*(.3+random()*.8),length*(.5+random()*.35),depth-1);
  };
  for(const angle of [-.8,1.4,3.4])branch(32,32,angle+random()*.25,11,2);
  for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++){
   let distance=Infinity;
   for(const [ax,ay,bx,by] of this.fractures){const dx=bx-ax,dy=by-ay,p=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));distance=Math.min(distance,Math.hypot(x-ax-p*dx,y-ay-p*dy));}
   const permeability=Math.exp(-distance*distance/1.2);
   this.substrate[y*GRID+x]=permeability<.01?0:permeability;
  }
  this.reset();
 }
 reset(){this.steps=0;this.field.fill(0);this.next.fill(0);
  for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++){
   const i=y*GRID+x;
   this.resource[i]=(this.conditions?.resource??0)*this.substrate[i];
  }
  if(this.conditions){this.field[32*GRID+32]=.8;this.field[32*GRID+33]=.3;}
 }
 advance(seconds){const target=Math.floor(Math.max(0,Math.min(24,seconds))/STEP+1e-8);if(target<this.steps)this.reset();
  const c=this.conditions;if(!c)return;
  while(this.steps<target){
   this.next.fill(0);
   for(let y=1;y<GRID-1;y++)for(let x=1;x<GRID-1;x++){
    const i=y*GRID+x,u=this.field[i],r=this.resource[i];
    // Symmetric edge conductance: transport follows the same visible cracks.
    const s=this.substrate[i];
    const flux=Math.min(s,this.substrate[i-1])*(this.field[i-1]-u)
     +Math.min(s,this.substrate[i+1])*(this.field[i+1]-u)
     +Math.min(s,this.substrate[i-GRID])*(this.field[i-GRID]-u)
     +Math.min(s,this.substrate[i+GRID])*(this.field[i+GRID]-u);
    const reaction=4*c.growth*c.water*r*u*(1-u)-(c.decay+.12)*u;
    this.next[i]=clamp(u+STEP*(4*flux+reaction));
    this.resource[i]=clamp(r-STEP*.75*u*r);
   }
   [this.field,this.next]=[this.next,this.field];this.steps++;
  }
 }
 snapshot(){let mass=0,peak=0;for(const v of this.field){mass+=v;peak=Math.max(peak,v);}return {steps:this.steps,mass,peak,status:!this.conditions?'unavailable':mass<.25?'fading':mass>1.1?'persisting':'fragile',conditions:this.conditions};}
}
