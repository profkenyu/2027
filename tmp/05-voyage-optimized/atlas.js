/* Cache geography once per planet; reveal only visited corridors and samples. */
(function(root){
  'use strict';
  const V=root.Voyage;
  class SurveyAtlas{
    constructor(){
      this.terrain=document.createElement('canvas');
      this.surface=document.createElement('canvas');
      this.mask=document.createElement('canvas');
      this.worldKey='';this.frameKey='';this.builds=0;this.heightSamples=0;
      this.worldRange=430;
    }
    prepare(p){
      const key=`${p.id}:${p.seed}`;if(key===this.worldKey)return;
      const size=512,step=2;this.terrain.width=this.terrain.height=size;
      const ctx=this.terrain.getContext('2d');
      for(let y=0;y<size;y+=step)for(let x=0;x<size;x+=step){
        const tx=(x/size-.5)*this.worldRange*2,tz=(y/size-.5)*this.worldRange*2;
        const h=V.height(tx,tz,p),contour=V.smooth(.12,0,Math.abs(h/3-Math.round(h/3)));
        const value=V.clamp(20+h*.6+contour*12,13,60);
        ctx.fillStyle=`rgb(${value*.78},${value},${value*.65})`;ctx.fillRect(x,y,step,step);this.heightSamples++;
      }
      this.worldKey=key;this.frameKey='';this.builds++;
    }
    resize(canvas,w,h){if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;}
    draw(canvas,sim,records,overview=false){
      this.prepare(sim.p);
      const w=canvas.width,h=canvas.height;
      const key=overview?'':`${this.worldKey}:${w}:${h}:${sim.x.toFixed(1)}:${sim.z.toFixed(1)}:${sim.heading.toFixed(2)}:${sim.route.length}:${sim.samples.length}`;
      if(!overview&&key===this.frameKey)return false;
      this.frameKey=key;
      const ctx=canvas.getContext('2d'),range=overview?355:75,cx=overview?0:sim.x,cz=overview?0:sim.z,scale=(w-24)/(range*2);
      const project=(x,z)=>[(x-cx)*scale+w/2,(z-cz)*scale+h/2];
      ctx.clearRect(0,0,w,h);ctx.fillStyle=overview?'#080c0b':'#07100b';ctx.fillRect(0,0,w,h);
      ctx.strokeStyle=overview?'#94b1790c':'#94b17912';ctx.lineWidth=1;
      const grid=overview?80:25;ctx.beginPath();
      for(let n=Math.floor((cx-range)/grid)*grid;n<=cx+range;n+=grid){const [x]=project(n,cz);ctx.moveTo(x,0);ctx.lineTo(x,h);}
      for(let n=Math.floor((cz-range)/grid)*grid;n<=cz+range;n+=grid){const [,y]=project(cx,n);ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
      const journeys=overview?records.filter(r=>r.planet===sim.p.id):[{route:sim.route,samples:sim.samples}];
      this.resize(this.surface,w,h);this.resize(this.mask,w,h);
      const terrain=this.surface.getContext('2d'),mask=this.mask.getContext('2d');
      terrain.globalCompositeOperation='source-over';terrain.clearRect(0,0,w,h);mask.clearRect(0,0,w,h);
      const bitmapScale=this.terrain.width/(this.worldRange*2);
      const sx=(cx-range+this.worldRange)*bitmapScale,sy=(cz-range+this.worldRange)*bitmapScale,side=range*2*bitmapScale;
      // Account for the 12 px coordinate margin in the same mapping as paths.
      terrain.drawImage(this.terrain,sx,sy,side,side,12,12,w-24,h-24);
      mask.strokeStyle='#fff';mask.fillStyle='#fff';mask.lineJoin='round';mask.lineCap='round';
      for(const journey of journeys){
        mask.lineWidth=Math.max(2,scale*9);mask.beginPath();
        journey.route.forEach(([x,z],i)=>{const p=project(x,z);if(i===0)mask.moveTo(...p);else mask.lineTo(...p);});mask.stroke();
        for(const [x,z] of [journey.route[0],journey.route.at(-1)]){const p=project(x,z);mask.beginPath();mask.arc(...p,Math.max(2,scale*4.5),0,Math.PI*2);mask.fill();}
        for(const s of journey.samples){const p=project(s.x,s.z);mask.beginPath();mask.arc(...p,Math.max(3,scale*19),0,Math.PI*2);mask.fill();}
      }
      terrain.globalCompositeOperation='destination-in';terrain.drawImage(this.mask,0,0);ctx.drawImage(this.surface,0,0);
      const drawPath=(route,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.beginPath();route.forEach(([x,z],i)=>{const p=project(x,z);if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);});ctx.stroke();};
      if(overview)for(const r of journeys.slice(0,-1))drawPath(r.route,'#6b87514d',1.2);
      drawPath(sim.route,overview?'#b4cc9f':'#a8c590',overview?2:1.6);
      for(const s of sim.samples){const p=project(s.x,s.z);ctx.strokeStyle='#c7dcb5';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...p,overview?4:3,0,Math.PI*2);ctx.stroke();}
      const pos=project(sim.x,sim.z);ctx.save();ctx.translate(...pos);ctx.rotate(-sim.heading);ctx.strokeStyle='#c9dcba';ctx.fillStyle='#c9dcba';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(0,0,overview?6:9,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(-4,-5);ctx.lineTo(4,-5);ctx.closePath();ctx.fill();ctx.restore();
      ctx.fillStyle='#839a72';ctx.font=`${overview?12:10}px monospace`;ctx.textAlign='center';ctx.fillText('N',w/2,overview?22:15);
      ctx.textAlign='left';const bar=overview?50:20;ctx.strokeStyle='#708961';ctx.beginPath();ctx.moveTo(18,h-22);ctx.lineTo(18+bar*scale,h-22);ctx.stroke();ctx.fillText(`${bar} m`,18,h-30);
      return true;
    }
  }
  V.SurveyAtlas=SurveyAtlas;
})(window);
