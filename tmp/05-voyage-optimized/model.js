/* Shared deterministic terrain and energy model. Units: metres, seconds, W, Wh.
 * Fictitious worlds; terrain and illumination are numerical approximations.
 * Surface gravity/pressure/radiation are authored assumptions, not discoveries.
 */
(function (root) {
  'use strict';
  const V = root.Voyage = root.Voyage || {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  function hash(x,z,seed) { let n = Math.imul(x ^ seed,374761393) ^ Math.imul(z,668265263); n = Math.imul(n ^ n>>>13,1274126177); return ((n ^ n>>>16)>>>0)/4294967295; }
  function noise(x,z,seed) {
    const ix=Math.floor(x), iz=Math.floor(z), u=smooth(0,1,x-ix), v=smooth(0,1,z-iz);
    return mix(mix(hash(ix,iz,seed),hash(ix+1,iz,seed),u),mix(hash(ix,iz+1,seed),hash(ix+1,iz+1,seed),u),v)*2-1;
  }
  function fbm(x,z,seed,octaves=4) { let sum=0,amp=.57; for(let i=0;i<octaves;i++){sum+=noise(x,z,seed+i*53)*amp; x=x*2.03+17.1;z=z*2.03-9.2;amp*=.48;}return sum; }
  const worlds = [
    {id:'P01',name:'NIVAL',label:'얼어붙은 세계',seed:1049,kind:0,g:2.18,pressure:180,temp:-126,radiation:145,transmission:.82,basePower:65,ground:'#69787b',high:'#c4c9bd',shadow:'#18262b',sky:'#10191b',haze:'#536664',fog:.0048,skyColor:[.025,.042,.047],horizonColor:[.25,.32,.31]},
    {id:'P02',name:'ARID',label:'메마른 세계',seed:7283,kind:1,g:3.72,pressure:650,temp:-42,radiation:210,transmission:.96,basePower:55,ground:'#79644e',high:'#b6a080',shadow:'#28251e',sky:'#211a12',haze:'#7b6445',fog:.0045,skyColor:[.072,.048,.027],horizonColor:[.43,.29,.15]},
    {id:'P03',name:'VEIL',label:'가려진 세계',seed:3917,kind:2,g:5.46,pressure:46000,temp:12,radiation:38,transmission:.24,basePower:55,ground:'#656349',high:'#9a9773',shadow:'#1c2520',sky:'#24291d',haze:'#7a8160',fog:.016,skyColor:[.054,.069,.048],horizonColor:[.32,.36,.24]}
  ];
  function height(x,z,p) {
    const s=p.seed, r=Math.hypot(x,z), a=Math.atan2(z,x);
    let h=fbm(x*.009,z*.009,s)*13+fbm(x*.045,z*.045,s+71,3)*1.8;
    // A distant basin rim creates a geographic destination and a bounded horizon.
    h+=(31+16*noise(a*3,1,s+19))*Math.exp(-(((r-265)/63)**2));
    if(p.kind===0){
      const fracture=x+22+9*Math.sin(z*.024)+4*Math.sin(z*.061);
      h-=6*Math.exp(-((fracture/2.7)**2));
      h+=.65*Math.abs(Math.sin((x+z*.18)*.13+noise(x*.025,z*.025,s)*2));
    }else if(p.kind===1){
      const c=Math.hypot(x-68,z+108);
      h-=13*Math.exp(-((c/34)**4));
      h+=7.5*Math.exp(-(((c-44)/9)**2));
      h+=1.4*Math.sin(z*.075+x*.022+noise(x*.014,z*.014,s)*2)*smooth(15,80,r);
    }else{
      h+=Math.pow(Math.max(0,Math.sin(x*.052+fbm(x*.018,z*.008,s)*2)),4)*6;
      h+=fbm(x*.12,z*.12,s+59,2)*.38;
    }
    // The deployment patch is flat; its transition is continuous.
    return h*smooth(9,42,Math.hypot(x,z-10));
  }
  function surface(x,z,p,out={}) {
    const e=.5;out.height=height(x,z,p);out.dx=(height(x+e,z,p)-height(x-e,z,p))/(2*e);out.dz=(height(x,z+e,p)-height(x,z-e,p))/(2*e);out.slope=Math.atan(Math.hypot(out.dx,out.dz));return out;
  }
  const sunDirection={x:-.83,z:-.56};
  function illumination(x,z,p,elapsed,localHeight) {
    const altitude=Math.max(.015,.30-elapsed*.00077), horizontal=Math.cos(altitude), y=Math.sin(altitude);
    let exposure=1;
    for(let i=1;i<=16;i++){
      const d=i*i*.7;
      if(height(x+sunDirection.x*d,z+sunDirection.z*d,p)>localHeight+.32+d*y/horizontal){exposure=.07;break;}
    }
    return {altitude,exposure,x:sunDirection.x*horizontal,y,z:sunDirection.z*horizontal};
  }
  function obstacles(p) {
    const arr=[];
    for(let i=0;i<175;i++){
      const x=(hash(i,1,p.seed)-.5)*740,z=(hash(i,2,p.seed)-.5)*740;
      if(Math.hypot(x,z-10)<12)continue;
      const size=.25+Math.pow(hash(i,3,p.seed),3)*2.3;
      // Ice plates and small rocks remain traversable; boulders block the rover.
      arr.push({x,z,y:height(x,z,p),size,angle:hash(i,4,p.seed)*Math.PI*2});
    }
    return arr;
  }
  class Simulation {
    constructor(p) {
      this.p=p;this.x=0;this.z=10;this.y=0;this.heading=0;this.speed=0;this.elapsed=0;this.distance=0;
      this.capacity=5;this.energy=5;this.generated=0;this.consumed=0;this.curtailed=0;
      this.power=0;this.solar=0;this.light=false;this.scan=0;this.scanning=false;this.samples=[];
      this.route=[[0,10]];this.rocks=obstacles(p);this.ended=false;this.endReason='';this.blocked=false;
      this.surface=surface(this.x,this.z,p);this.illumination=illumination(this.x,this.z,p,0,0);
      this._solarClock=1;this._routeDistance=0;this.pendingScan=false;this.event=null;
    }
    requestScan(){
      if(this.ended)return false;
      if(this.scanning){this.scanning=false;this.scan=0;this.pendingScan=false;this.event='cancelled';return false;}
      this.pendingScan=true;return true;
    }
    step(dt,input={}) {
      if(this.ended)return;
      // Substeps bound collision checks, integration and sampling during frame drops.
      let left=clamp(dt,0,1);
      while(left>1e-8&&!this.ended){const h=Math.min(left,1/30);this.integrate(h,input);left-=h;}
    }
    integrate(dt,input) {
      this.elapsed+=dt;this.blocked=false;
      const steer=clamp(input.steer||0,-1,1),throttle=clamp(input.throttle||0,-1,1);
      if((throttle||steer)&&this.scanning){this.scanning=false;this.scan=0;this.event='cancelled';}
      if(throttle||steer)this.pendingScan=false;
      const stop=this.pendingScan||this.scanning;
      const target=stop?0:throttle*.9;
      this.speed+=(target-this.speed)*(1-Math.exp(-dt/(stop ? .34 : .75)));
      this.heading+=steer*dt*.43*(this.scanning?0:1);
      let nx=this.x-Math.sin(this.heading)*this.speed*dt, nz=this.z-Math.cos(this.heading)*this.speed*dt;
      const next=surface(nx,nz,this.p,{});
      let collision=false;
      for(const rock of this.rocks){if(rock.size>1.05&&Math.hypot(nx-rock.x,nz-rock.z)<rock.size*.76+.6){collision=true;break;}}
      if(Math.hypot(nx,nz)>342||next.slope>.54||collision){this.speed*=.6;nx=this.x;nz=this.z;this.blocked=true;}
      const moved=Math.hypot(nx-this.x,nz-this.z),dy=next.height-this.surface.height;
      const uphill=moved>.00001?Math.max(0,dy/moved):0;
      this.x=nx;this.z=nz;this.surface=surface(nx,nz,this.p,this.surface);this.y=this.surface.height;
      this.distance+=moved;this._routeDistance+=moved;
      if(this._routeDistance>.8&&this.route.length<2200){this.route.push([nx,nz]);this._routeDistance=0;}
      if(this.pendingScan&&Math.abs(this.speed)<.025){this.pendingScan=false;this.scanning=true;this.scan=0;this.event='scan-start';}
      if(this.scanning){
        this.scan+=dt;
        if(this.scan>=6){this.completeSample();this.scanning=false;this.scan=0;this.event='sample';}
      }
      this._solarClock+=dt;
      if(this._solarClock>.25){this.illumination=illumination(nx,nz,this.p,this.elapsed,this.y);this._solarClock=0;}
      // P_solar = P_normal * sin(sun altitude) * transmission * terrain visibility.
      // P_drive = m g v (rolling resistance + uphill grade) / efficiency.
      const speed=moved/dt, drive=120*this.p.g*speed*(.02+uphill)/.65+(Math.abs(steer)>0?12:0);
      this.power=this.p.basePower+drive+(this.blocked&&throttle?12:0)+(this.scanning?65:0)+(this.light?9:0);
      this.solar=160*this.illumination.y*this.p.transmission*this.illumination.exposure;
      const generated=this.solar*dt/3600,consumed=this.power*dt/3600;
      this.generated+=generated;this.consumed+=consumed;
      const e=this.energy+generated-consumed;
      this.curtailed+=Math.max(0,e-this.capacity);
      // The last substep can request more energy than remains. Only delivered
      // energy is counted as consumption, keeping the energy ledger balanced.
      if(e<0)this.consumed+=e;
      this.energy=clamp(e,0,this.capacity);
      if(this.energy<=0)this.end('energy');
      else if(this.elapsed>=360)this.end('window');
    }
    completeSample(){
      const p=this.p,local=fbm(this.x*.025,this.z*.025,p.seed+91);
      const sample={x:this.x,z:this.z,at:this.elapsed,g:p.g,pressure:p.pressure*(1-.00012*this.y),temperature:p.temp+local*4+this.illumination.exposure*2,radiation:p.radiation*(1+local*.08),slope:this.surface.slope*180/Math.PI};
      if(this.samples.length<64)this.samples.push(sample);
    }
    end(reason='visitor'){
      if(this.ended)return;this.ended=true;this.endReason=reason;this.speed=0;this.scanning=false;this.pendingScan=false;
      const last=this.route[this.route.length-1];if(Math.hypot(this.x-last[0],this.z-last[1])>.05)this.route.push([this.x,this.z]);
    }
    record(){return{version:1,planet:this.p.id,at:Date.now(),reason:this.endReason,elapsed:this.elapsed,distance:this.distance,samples:this.samples.map(s=>({...s})),route:this.route.map(p=>p.slice())};}
  }
  function validRecord(r){
    return r&&r.version===1&&worlds.some(p=>p.id===r.planet)&&Number.isFinite(r.at)&&Number.isFinite(r.elapsed)&&r.elapsed>=0&&r.elapsed<=362&&Number.isFinite(r.distance)&&r.distance>=0&&r.distance<=1000&&['visitor','energy','window','idle'].includes(r.reason)&&Array.isArray(r.route)&&r.route.length>=1&&r.route.length<=2201&&r.route.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<500))&&Array.isArray(r.samples)&&r.samples.length<=64&&r.samples.every(s=>s&&['x','z','at','g','pressure','temperature','radiation','slope'].every(k=>Number.isFinite(s[k]))&&Math.abs(s.x)<500&&Math.abs(s.z)<500&&s.at>=0&&s.at<=362&&s.g>0&&s.g<100&&s.pressure>=0&&s.pressure<1e8&&s.temperature>=-273.15&&s.temperature<1000&&s.radiation>=0&&s.radiation<1e6&&s.slope>=0&&s.slope<=90);
  }
  Object.assign(V,{clamp,mix,smooth,hash,noise,fbm,worlds,height,surface,illumination,obstacles,Simulation,validRecord});
})(typeof window!=='undefined'?window:globalThis);
