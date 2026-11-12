(function(){
  'use strict';
  const V=window.Voyage,$=id=>document.getElementById(id),keys=new Set();
  const ui={selection:$('selection'),survey:$('survey'),record:$('record'),transition:$('transition'),notice:$('notice')};
  const storageKey='gunwoo:05-voyage:field-records:v1';
  let renderer,sim=null,phase='select',paused=false,contextLost=false,pageActive=true;
  let frame=0,lastTick=0,lastDraw=0,lastRenderAt=0,uiClock=0,atlasClock=0,qualityClock=0,slowTime=0,lastInput=performance.now();
  let records=[],persistent=true,noticeTimer=0,resetTimer=0,drag=null,transitionToken=0,lastBlocked=-10;
  const touch=new Set();
  const seconds=s=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  const signed=x=>`${x<0?'−':'+'}${Math.abs(Math.round(x)).toString().padStart(3,'0')}`;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  class Sound{
    constructor(){this.enabled=false;this.ctx=null;}
    async toggle(){
      if(!this.ctx){
        const Context=window.AudioContext||window.webkitAudioContext;if(!Context){say('이 브라우저는 사운드를 지원하지 않습니다.');return;}
        this.ctx=new Context();this.gain=this.ctx.createGain();this.gain.gain.value=0;this.gain.connect(this.ctx.destination);
        this.motor=this.ctx.createOscillator();this.motor.type='sine';this.motor.frequency.value=48;this.motor.connect(this.gain);this.motor.start();
      }
      this.enabled=!this.enabled;
      if(this.enabled)await this.ctx.resume();
      else await this.ctx.suspend();
      $('sound').setAttribute('aria-pressed',String(this.enabled));$('sound').textContent=`SOUND / ${this.enabled?'ON':'OFF'}`;
    }
    update(){if(!this.ctx||!this.enabled)return;const active=phase==='survey'&&!paused&&!contextLost&&!document.hidden;
      this.gain.gain.setTargetAtTime(active?.004+Math.abs(sim.speed)*.014:0,this.ctx.currentTime,.4);
      this.motor.frequency.setTargetAtTime(active?44+Math.abs(sim.speed)*24:44,this.ctx.currentTime,.35);
    }
    event(){if(!this.ctx||!this.enabled||paused)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime;
      o.type='sine';o.frequency.value=420;o.connect(g);g.connect(this.ctx.destination);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.018,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.start();o.stop(t+.32);o.onended=()=>{o.disconnect();g.disconnect();};}
    reset(){
      this.enabled=false;if(this.ctx){this.gain.gain.value=0;this.ctx.suspend().catch(()=>{});}
      $('sound').setAttribute('aria-pressed','false');$('sound').textContent='SOUND / OFF';
    }
  }
  const audio=new Sound();
  function say(text,duration=3800){clearTimeout(noticeTimer);ui.notice.textContent=text;ui.notice.classList.toggle('visible',!!text);if(text)noticeTimer=setTimeout(()=>ui.notice.classList.remove('visible'),duration);}
  function loadRecords(){
    try{const raw=localStorage.getItem(storageKey);if(raw&&raw.length>2400000)throw Error('oversize');const all=JSON.parse(raw||'[]');if(Array.isArray(all))records=all.filter(V.validRecord).slice(-18);}catch{persistent=false;records=[];}
  }
  function saveRecord(record){
    records.push(record);records=records.slice(-18);
    try{localStorage.setItem(storageKey,JSON.stringify(records));persistent=true;}catch{persistent=false;}
  }
  function setPhase(next){
    phase=next;document.body.dataset.phase=next;
    ui.selection.hidden=next!=='select';ui.survey.hidden=next!=='survey';ui.record.hidden=next!=='record';
    if(next!=='survey')clearInput();audio.update();
  }
  function clearInput(){keys.clear();touch.clear();drag=null;}
  function setPaused(value){
    paused=value;document.body.classList.toggle('paused',value);$('resume').hidden=!value;
    clearInput();lastTick=lastRenderAt=0;audio.update();updateHUD();if(!value)queue();
  }
  function fail(error){console.error(error);$('failure').hidden=false;cancelAnimationFrame(frame);frame=0;pageActive=false;audio.update();}

  async function start(index){
    if(phase!=='select')return;
    const token=++transitionToken;phase='landing';clearInput();ui.transition.classList.add('visible');
    $('transition-text').textContent=`${V.worlds[index].id} / ESTABLISHING OPTICAL LINK`;
    await wait(850);if(token!==transitionToken)return;
    try{sim=new V.Simulation(V.worlds[index]);renderer.enter(sim.p);}
    catch(e){fail(e);return;}
    $('world-id').textContent=sim.p.id;$('world-name').textContent=sim.p.name;
    $('reading').hidden=true;$('scan-progress').hidden=true;$('light').textContent='LIGHT / OFF';$('light').setAttribute('aria-pressed','false');
    uiClock=atlasClock=qualityClock=slowTime=0;lastBlocked=-10;lastDraw=lastRenderAt=0;
    setPhase('survey');setPaused(document.hidden||!pageActive);updateHUD();drawAtlas($('atlas'),false);
    renderer.render(sim,1/60,performance.now()/1000);
    await wait(100);if(token!==transitionToken)return;
    ui.transition.classList.remove('visible');lastInput=performance.now();lastTick=0;
    $('view').setAttribute('tabindex','-1');$('view').focus({preventScroll:true});
    say('로버 전방 카메라 연결\n방향키로 이동 · SPACE로 정지·측정',6000);
  }
  async function finish(reason='visitor',returnHome=false){
    if(phase!=='survey'||!sim)return;
    sim.end(reason);phase='ending';clearInput();setPaused(false);audio.update();
    const token=++transitionToken;ui.transition.classList.add('visible');
    $('transition-text').textContent=sim.endReason==='energy'?'OPTICAL LINK LOST':'CLOSING FIELD RECORD';
    await wait(1100);if(token!==transitionToken)return;
    saveRecord(sim.record());setPhase('record');
    if(returnHome){await restart();return;}
    $('record-world').textContent=`${sim.p.id} / ${sim.p.name}`;
    $('end-reason').textContent={energy:'에너지가 소진되었습니다. 로버는 이곳에 남습니다.',window:'6분의 통신 창이 닫혔습니다. 이번 탐사를 기록합니다.',visitor:'관객이 탐사를 마쳤습니다. 지나온 경로를 기록합니다.',idle:'관객의 조작이 멈추어 이번 탐사를 기록했습니다.'}[sim.endReason];
    $('record-stats').replaceChildren();
    for(const [label,value] of [['이동 거리',`${sim.distance.toFixed(0)} m`],['측정 지점',`${sim.samples.length}`],['탐사 시간',seconds(sim.elapsed)]]){
      const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;div.append(dt,dd);$('record-stats').append(div);
    }
    const prior=records.filter(r=>r.planet===sim.p.id).length-1;
    $('archive-status').textContent=persistent?`이 기기에 남은 ${Math.max(0,prior)}개의 이전 탐사와 함께 기록되었습니다. 관측한 영역만 지도에 드러납니다.`:'기록은 현재 실행 중에만 유지됩니다. 이 브라우저에서는 영구 저장을 사용할 수 없습니다.';
    drawAtlas($('record-atlas'),true);await wait(100);if(token!==transitionToken)return;
    ui.transition.classList.remove('visible');$('restart').focus({preventScroll:true});
    let deadline=Date.now()+30000;clearInterval(resetTimer);
    resetTimer=setInterval(()=>{const n=Math.max(0,Math.ceil((deadline-Date.now())/1000));$('reset-clock').textContent=`${n}초 후 다음 관객을 위해 돌아갑니다.`;if(n===0)restart().catch(fail);},1000);
    $('reset-clock').textContent='30초 후 다음 관객을 위해 돌아갑니다.';
  }
  async function restart(){
    if(phase!=='record')return;clearInterval(resetTimer);phase='reset';
    const token=++transitionToken;ui.transition.classList.add('visible');$('transition-text').textContent='A WORLD, STILL UNKNOWN';
    await wait(800);if(token!==transitionToken)return;
    renderer.showSelection();sim=null;audio.reset();setPaused(false);setPhase('select');say('');
    renderer.render(null,1/60,performance.now()/1000);await wait(80);ui.transition.classList.remove('visible');
    document.querySelector('.planet-option').focus({preventScroll:true});lastTick=lastDraw=lastRenderAt=0;queue();
  }
  function measure(){if(phase!=='survey'||paused)return;lastInput=performance.now();sim.requestScan();if(sim.pendingScan)say('로버를 정지한 뒤 측정을 시작합니다.',2000);}
  function updateHUD(){
    if(!sim)return;const pct=V.clamp(sim.energy/sim.capacity*100,0,100);
    $('battery').textContent=`PWR ${pct.toFixed(0)}%`;$('battery-bar').style.width=`${pct}%`;
    $('battery-bar').style.background=pct<18?'#b79968':'#a8c1a4';
    $('solar').textContent=`SOLAR ${sim.solar.toFixed(0)} W`;$('distance').textContent=`${sim.distance.toFixed(0)} M`;$('clock').textContent=seconds(sim.elapsed);
    const head=(sim.heading*180/Math.PI%360+360)%360;$('heading').textContent=`${(Math.round(360-head)%360).toString().padStart(3,'0')}°`;
    $('atlas-position').textContent=`RVR ${signed(sim.x)} / ${signed(-sim.z)}`;$('sample-count').textContent=`${sim.samples.length} RECORDS`;
    $('status').textContent=paused?'교신 일시 정지':sim.scanning?'현장 측정 중':sim.pendingScan?'정지하는 중':sim.energy<.9?'예비 전력 · 탐사 지속':sim.illumination.exposure<.1?'지형 그림자 · 발전량 감소':'탐사 중 · 전방 카메라';
    $('scan-progress').hidden=!sim.scanning;$('scan-bar').style.width=`${Math.min(sim.scan/6*100,100)}%`;
    $('scan-label').textContent=`측정 중 · ${(6-sim.scan).toFixed(1)}초`;
    $('measure').firstChild.textContent=sim.scanning?'측정 취소 ':sim.pendingScan?'정지 중 ':'측정 ';
  }
  function showSample(){
    const s=sim.samples.at(-1);if(!s)return;
    $('reading').hidden=false;$('reading-values').replaceChildren();
    for(const [label,value] of [['GRAVITY',`${s.g.toFixed(2)} m/s²`],['TEMPERATURE',`${s.temperature.toFixed(1)} °C`],['PRESSURE',`${(s.pressure/1000).toFixed(2)} kPa`],['RADIATION',`${s.radiation.toFixed(0)} µSv/h`]]){
      const span=document.createElement('span'),b=document.createElement('b');span.textContent=label;b.textContent=value;span.append(b);$('reading-values').append(span);
    }
    $('reading-note').textContent=`지표 경사 ${s.slope.toFixed(1)}° · 이 지점의 가상 측정값\n다른 지역의 조건은 아직 알 수 없습니다.`;
    audio.event();say('하나의 지점이 기록되었습니다.',3000);
  }

  const atlas=new V.SurveyAtlas();
  function drawAtlas(canvas,overview){
    if(sim)atlas.draw(canvas,sim,records,overview);
  }

  function input(){return{throttle:Number(keys.has('ArrowUp')||keys.has('KeyW')||touch.has('up'))-Number(keys.has('ArrowDown')||keys.has('KeyS')||touch.has('down')),steer:Number(keys.has('ArrowLeft')||keys.has('KeyA')||touch.has('left'))-Number(keys.has('ArrowRight')||keys.has('KeyD')||touch.has('right'))};}
  function queue(){if(pageActive&&!document.hidden&&!contextLost&&!paused&&['select','survey','landing'].includes(phase)&&!frame)frame=requestAnimationFrame(tick);}
  function tick(now){
    frame=0;if(!pageActive||document.hidden||contextLost)return;
    try{
    const raw=lastTick?(now-lastTick)/1000:0,dt=Math.min(raw,.08);lastTick=now;
    if(phase==='survey'&&!paused&&sim){
      const controls=input();if(controls.throttle||controls.steer)lastInput=now;
      sim.step(dt,controls);
      if(sim.event){if(sim.event==='sample')showSample();else if(sim.event==='cancelled')say('측정이 취소되었습니다. 사용한 에너지는 돌아오지 않습니다.');sim.event=null;}
      if(sim.blocked&&sim.elapsed-lastBlocked>6){say('주행이 어려운 지형입니다. 다른 경로를 선택해 주십시오.');lastBlocked=sim.elapsed;}
      if(sim.ended){finish(sim.endReason).catch(fail);}
      else if(now-lastInput>120000){finish('idle').catch(fail);}
      uiClock+=dt;atlasClock+=dt;
      if(uiClock>.2){updateHUD();uiClock=0;audio.update();}
      if(atlasClock>.8){drawAtlas($('atlas'),false);atlasClock=0;}
      if(sim.elapsed>2&&raw>0){
        const observed=Math.min(raw,.25),budget=Math.max(1/48,1/renderer.fps*1.6);
        qualityClock+=observed;if(raw>budget)slowTime+=observed;
        if(qualityClock>=6){if(slowTime/qualityClock>.65)renderer.downgrade();qualityClock=slowTime=0;}
      }
    }
    const interval=1000/renderer.fps;
    if((phase==='select'||phase==='survey'||phase==='landing')&&!paused&&now-lastDraw>=interval-.1){
      const drawDelta=lastRenderAt?Math.min((now-lastRenderAt)/1000,.15):dt;
      renderer.render(sim,drawDelta,now/1000);lastRenderAt=now;
      const elapsed=now-lastDraw;
      if(lastDraw&&elapsed<interval*4)lastDraw+=Math.max(1,Math.floor((elapsed+.1)/interval))*interval;
      else lastDraw=now;
    }
    queue();
    }catch(error){fail(error);}
  }
  function resume(){lastInput=performance.now();setPaused(false);queue();}
  function bind(){
    document.querySelectorAll('[data-planet]').forEach(b=>{b.addEventListener('click',()=>start(Number(b.dataset.planet)).catch(fail));b.addEventListener('mouseenter',()=>renderer.focus=Number(b.dataset.planet));b.addEventListener('focus',()=>renderer.focus=Number(b.dataset.planet));b.addEventListener('mouseleave',()=>renderer.focus=-1);});
    $('home').addEventListener('click',()=>{if(phase==='survey')finish('visitor',true).catch(fail);else if(phase==='record')restart().catch(fail);});
    $('measure').addEventListener('click',measure);$('finish').addEventListener('click',()=>finish().catch(fail));$('restart').addEventListener('click',()=>restart().catch(fail));$('resume').addEventListener('click',resume);
    $('light').addEventListener('click',()=>{if(phase!=='survey'||paused)return;sim.light=!sim.light;lastInput=performance.now();$('light').setAttribute('aria-pressed',String(sim.light));$('light').textContent=`LIGHT / ${sim.light?'ON':'OFF'}`;});
    $('sound').addEventListener('click',()=>{lastInput=performance.now();audio.toggle().catch(()=>say('사운드를 시작할 수 없습니다.'));});
    $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else if(document.documentElement.webkitRequestFullscreen)document.documentElement.webkitRequestFullscreen();else say('브라우저의 전체 화면 기능을 사용해 주십시오.');}catch{say('브라우저 메뉴에서 전체 화면을 선택해 주십시오.');}});
    window.addEventListener('keydown',e=>{
      if(phase!=='survey')return;
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      if(e.code==='Escape'){e.preventDefault();setPaused(!paused);lastInput=performance.now();return;}
      if(paused){if(e.code==='Enter')resume();return;}
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);lastInput=performance.now();}
      if(e.code==='Space'&&(e.target===document.body||e.target===$('view')||e.target===$('measure'))){e.preventDefault();if(!e.repeat)measure();}
    });
    window.addEventListener('keyup',e=>keys.delete(e.code));
    window.addEventListener('blur',()=>{clearInput();if(phase==='survey')setPaused(true);});
    document.addEventListener('visibilitychange',()=>{lastTick=lastDraw=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;if(phase==='survey')setPaused(true);}else queue();audio.update();});
    window.addEventListener('pagehide',()=>{pageActive=false;clearInput();cancelAnimationFrame(frame);frame=0;audio.update();});
    window.addEventListener('pageshow',()=>{pageActive=true;lastTick=0;queue();});
    window.addEventListener('resize',()=>{renderer.setSize();lastDraw=lastRenderAt=0;});
    const canvas=renderer.canvas;
    canvas.addEventListener('pointerdown',e=>{if(phase!=='survey'||paused)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);lastInput=performance.now();});
    canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;renderer.lookYaw=V.clamp(renderer.lookYaw-(e.clientX-drag.x)*.0025,-1.15,1.15);renderer.lookPitch=V.clamp(renderer.lookPitch-(e.clientY-drag.y)*.002,-.5,.4);drag.x=e.clientX;drag.y=e.clientY;lastInput=performance.now();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
    canvas.addEventListener('dblclick',()=>{renderer.lookYaw=renderer.lookPitch=0;});
    document.querySelectorAll('[data-drive]').forEach(b=>{
      b.addEventListener('pointerdown',e=>{if(phase!=='survey'||paused)return;e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.drive);lastInput=performance.now();});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>touch.delete(b.dataset.drive));
    });
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;cancelAnimationFrame(frame);frame=0;clearInput();if(phase==='survey')setPaused(true);say('화면 연결을 복구하고 있습니다.',9000);});
    canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;lastTick=0;say('화면이 복구되었습니다. 탐사를 계속할 수 있습니다.');queue();});
  }
  try{
    loadRecords();renderer=new V.ArtworkRenderer($('view'));bind();queue();
    // Read-only inspection for on-site checks; no test controls in the visitor UI.
    if(new URLSearchParams(location.search).has('inspect'))window.voyageInspect=()=>({phase,paused,quality:renderer.quality,cameraMode:'rover-first-person',camera:renderer.camera.position.toArray(),atlasBuilds:atlas.builds,atlasHeightSamples:atlas.heightSamples,sim:sim?{x:sim.x,y:sim.y,z:sim.z,energy:sim.energy,elapsed:sim.elapsed,distance:sim.distance,samples:sim.samples.length,scanning:sim.scanning,generated:sim.generated,consumed:sim.consumed}:null,records:records.length,persistent});
  }catch(error){fail(error);}
})();
