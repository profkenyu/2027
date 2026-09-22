import assert from 'node:assert/strict';
import {WaterMission} from '../engine/core/water-mission.js';
import {GeologicalMemory} from '../engine/core/geological-memory.js';
const site={x:0,z:0,acquireRadius:4.2,scanRadius:6.4,scanHoldMs:4200,id:'test',objective:'test',coherence:1};
const water=new WaterMission(()=>0,site);water.activate(0);
// Exercise the production geological state machine without its GPU visuals.
const geology=Object.create(GeologicalMemory.prototype);
Object.assign(geology,{state:'searching',model:{sites:[site,{...site,x:20},{...site,x:40}]},current:0,event:null,records:[],group:{visible:true},uTime:{},uCurrent:{},uMissionVisible:{},uIntegration:{},finale:0,_updateSiteVisuals(){}});
for(const mission of [water,geology]){
  // Former dead zone: 0.1 units outside acquisition, at rest.
  const target=mission.site??mission.target;
  assert.equal(mission.shouldHold({x:target.x+4.3,z:0}),false);
  let x=target.x+4.3,speed=0,now=0;
  while(!mission.complete&&now<60000){
    const target=mission.site??mission.target;
    const dir=Math.sign(target.x-x),held=mission.shouldHold({x,z:0});
    speed+=(held?0:1.85-speed)*.08;if(held)speed*=.8;
    x+=dir*speed*.05;now+=50;
    await mission.update({x,z:0,speed},now,true);
  }
  assert(mission.complete,`${mission.constructor.name} stalled`);
  console.log(`PASS ${mission.constructor.name}: former dead zone → braking → actual scan → complete`);
}
