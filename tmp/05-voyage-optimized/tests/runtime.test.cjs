/* Runtime integration tests with real Three.js geometry/math and a stubbed GPU.
 * These tests do not replace visual checks or actual WebGL shader compilation.
 * Run from this package: node --test tests/*.test.cjs
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const source=n=>fs.readFileSync(path.join(base,n),'utf8');

function environment({blockedStorage=false,width=1440,height=1000,quality='low',rafStep=1000/60}={}){
  let time=1000,id=0;const tasks=new Map(),nodes=new Map(),errors=[],renderers=[];
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.style={};this.attrs={};this.handlers={};this.children=[];this.hidden=false;this.width=this.height=360;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,v)=>{if(v??!this.classes.has(x))this.classes.add(x);else this.classes.delete(x);}};}
    set textContent(value){this.children=[{textContent:String(value)}];}get textContent(){return this.children.map(c=>c.textContent||'').join('');}
    get firstChild(){return this.children[0];}
    append(...values){this.children.push(...values);}appendChild(v){this.append(v);return v;}replaceChildren(...v){this.children=v;}
    setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
    addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}removeEventListener(){}
    dispatch(type,event={}){for(const fn of this.handlers[type]||[])fn({target:this,preventDefault(){},...event});}
    click(){this.dispatch('click');}focus(){doc.activeElement=this;this.dispatch('focus');}setPointerCapture(){}
    getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}
  }
  const html=source('index.html');
  for(const m of html.matchAll(/<([a-z0-9-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new Element(m[1]);e.id=m[2];e.hidden=/\bhidden\b/.test(m[0]);nodes.set(m[2],e);}
  nodes.get('measure').textContent='측정 ';nodes.get('measure').append(new Element('span'));
  const planetOptions=[0,1,2].map(i=>{const e=new Element('button');e.dataset.planet=String(i);return e;});
  const touchOptions=['up','left','down','right'].map(i=>{const e=new Element('button');e.dataset.drive=i;return e;});
  const doc=new Element('document');doc.body=new Element('body');doc.documentElement=new Element('html');doc.hidden=false;
  doc.getElementById=id=>nodes.get(id);doc.createElement=tag=>new Element(tag);
  doc.querySelectorAll=q=>q==='[data-planet]'?planetOptions:q==='[data-drive]'?touchOptions:[];
  doc.querySelector=q=>q==='.planet-option'?planetOptions[0]:null;doc.documentElement.requestFullscreen=async()=>doc.fullscreenElement=doc.documentElement;
  doc.exitFullscreen=async()=>doc.fullscreenElement=null;
  const win=new Element('window'),store=new Map();
  const addTask=(fn,delay,repeat=0)=>{const i=++id;tasks.set(i,{at:time+delay,fn,repeat});return i;};
  const sandbox={console:{log(){},warn(){},error(...e){errors.push(e);}},URLSearchParams,document:doc,innerWidth:width,innerHeight:height,devicePixelRatio:1,navigator:{hardwareConcurrency:8},location:{search:`?inspect&quality=${quality}`},performance:{now:()=>time},Date,
    setTimeout:(fn,ms)=>addTask(fn,ms),clearTimeout:i=>tasks.delete(i),setInterval:(fn,ms)=>addTask(fn,ms,ms),clearInterval:i=>tasks.delete(i),
    requestAnimationFrame:fn=>addTask(()=>fn(time),rafStep),cancelAnimationFrame:i=>tasks.delete(i),
    matchMedia:()=>({matches:false}),localStorage:{getItem:k=>{if(blockedStorage)throw Error('blocked');return store.get(k)||null;},setItem:(k,v)=>{if(blockedStorage)throw Error('blocked');store.set(k,v);}},
    addEventListener:win.addEventListener.bind(win),removeEventListener(){},getComputedStyle:()=>({})};
  sandbox.window=sandbox;vm.createContext(sandbox);
  vm.runInContext(source('vendor/three.local.js').replace('window.VoyageTHREE={','window.__ShaderChunk=ShaderChunk;window.__ShaderLib=ShaderLib;window.VoyageTHREE={'),sandbox);
  class FakeRenderer{
    constructor(){this.domElement=new Element('canvas');this.shadowMap={};this.renderLists={dispose(){}};this.frames=0;this.debug={};renderers.push(this);}
    setPixelRatio(v){this.ratio=v;}setSize(w,h){this.domElement.width=w*this.ratio;this.domElement.height=h*this.ratio;}
    render(scene,camera){this.frames++;scene.updateMatrixWorld();camera.updateMatrixWorld();}
  }
  sandbox.VoyageTHREE.WebGLRenderer=FakeRenderer;
  for(const name of ['model.js','renderer.js','atlas.js','voyage.js'])vm.runInContext(source(name),sandbox,{filename:name});
  async function advance(ms){const until=time+ms;let count=0;
    while(true){let next=null;for(const [i,t] of tasks){if(t.at<=until&&(!next||t.at<next[1].at))next=[i,t];}
      if(!next)break;const [i,t]=next;tasks.delete(i);time=t.at;if(t.repeat)tasks.set(i,{...t,at:time+t.repeat});t.fn();
      await Promise.resolve();await Promise.resolve();if(++count>40000)throw Error('scheduler runaway');
    }
    time=until;await Promise.resolve();await Promise.resolve();
  }
  return {sandbox,nodes,doc,errors,renderers,planetOptions,touchOptions,advance,inspect:()=>sandbox.voyageInspect(),key:(code,type='keydown',extra={})=>win.dispatch(type,{code,...extra}),windowEvent:(type,e)=>win.dispatch(type,e)};
}

test('each planet enters first person, moves, measures, records and returns to selection',async()=>{
  const env=environment();assert.equal(env.errors.length,0);assert.equal(env.inspect().phase,'select');
  for(let i=0;i<3;i++){
    env.planetOptions[i].click();await env.advance(1400);assert.equal(env.inspect().phase,'survey');
    const before=env.inspect();assert.equal(before.cameraMode,'rover-first-person');
    env.key('ArrowUp');await env.advance(1800);env.key('ArrowUp','keyup');
    assert(env.inspect().sim.distance>1);assert(env.inspect().sim.z<before.sim.z);
    // LOW renders at 30 fps while the model advances at 60 Hz, so the most
    // recently drawn mast can trail the current model by one rendered frame.
    const moving=env.inspect();assert(Math.abs(moving.camera[0]-moving.sim.x)<.04);assert(Math.abs(moving.camera[2]-moving.sim.z)<.04);
    env.nodes.get('measure').click();await env.advance(8500);assert.equal(env.inspect().sim.samples,1);
    assert.equal(env.nodes.get('reading').hidden,false);
    const oldEnergy=env.inspect().sim.energy;
    env.nodes.get('light').click();assert.equal(env.nodes.get('light').attrs['aria-pressed'],'true');
    await env.advance(500);assert(env.inspect().sim.energy<oldEnergy);
    env.nodes.get('finish').click();await env.advance(1500);
    assert.equal(env.inspect().phase,'record');assert.equal(env.inspect().records,i+1);
    assert(!env.nodes.get('record').hidden);assert(env.nodes.get('record-stats').children.length===3);
    env.nodes.get('restart').click();await env.advance(1200);assert.equal(env.inspect().phase,'select');
  }
  assert.deepEqual(env.errors,[]);
});

test('loss of focus releases held controls and freezes energy until explicit resume',async()=>{
  const env=environment();env.planetOptions[1].click();await env.advance(1400);
  env.key('ArrowUp');await env.advance(400);env.windowEvent('blur');
  const state=env.inspect();assert(state.paused);await env.advance(4000);
  assert.equal(env.inspect().sim.energy,state.sim.energy);assert.equal(env.inspect().sim.elapsed,state.sim.elapsed);
  env.nodes.get('resume').click();await env.advance(1700);assert(!env.inspect().paused);
  assert(env.inspect().sim.elapsed>state.sim.elapsed);assert(env.inspect().sim.distance-state.sim.distance<.8);
  env.doc.hidden=true;env.doc.dispatch('visibilitychange');const hidden=env.inspect().sim.energy;
  await env.advance(3000);assert.equal(env.inspect().sim.energy,hidden);
  env.doc.hidden=false;env.doc.dispatch('visibilitychange');assert(env.inspect().paused);assert.deepEqual(env.errors,[]);
});

test('moving during a scan cancels it through visitor keyboard input',async()=>{
  const env=environment();env.planetOptions[0].click();await env.advance(1400);
  env.nodes.get('measure').click();await env.advance(2500);assert(env.inspect().sim.scanning);
  env.key('ArrowLeft');await env.advance(250);env.key('ArrowLeft','keyup');
  assert(!env.inspect().sim.scanning);assert.equal(env.inspect().sim.samples,0);assert.deepEqual(env.errors,[]);
});

test('blocked storage falls back to session records and record screen automatically resets',async()=>{
  const env=environment({blockedStorage:true,width:390,height:844});
  env.planetOptions[2].click();await env.advance(1400);env.nodes.get('finish').click();await env.advance(1500);
  assert.equal(env.inspect().phase,'record');assert(!env.inspect().persistent);assert.equal(env.inspect().records,1);
  assert.match(env.nodes.get('archive-status').textContent,/영구 저장/);
  // The countdown uses wall time in production; trigger its displayed deadline
  // with an advanced Date clock without simulating any additional rover time.
  const realNow=Date.now;Date.now=()=>realNow()+31000;
  try{await env.advance(2500);}finally{Date.now=realNow;}
  assert.equal(env.inspect().phase,'select');assert.deepEqual(env.errors,[]);
});

test('real geometry and mast camera stay above the triangulated terrain in every quality tier',()=>{
  const env=environment();const V=env.sandbox.Voyage;
  for(const level of [0,1,2])for(const p of V.worlds){
    const r=new V.ArtworkRenderer(env.nodes.get('view'));r.level=level;r.enter(p);
    const s=new V.Simulation(p);
    for(const [x,z] of [[0,10],[-22,-75],[68,-108],[140,30],[-100,-100]]){
      s.x=x;s.z=z;s.surface=V.surface(x,z,p);s.y=s.surface.height;
      r.render(s,.016,0);
      assert(r.camera.position.y>=r.meshGroundHeight(x,z)+1.40);
      assert.equal(r.camera.position.x,x);assert.equal(r.camera.position.z,z);
    }
    // Assemble the actual standard shader sources and resolve their includes.
    // This validates integration, but GPU-driver compilation remains a separate check.
    const resolveIncludes=(text,depth=0)=>{
      assert(depth<40);return text.replace(/#include <([^>]+)>/g,(_,name)=>{
        assert.equal(typeof env.sandbox.__ShaderChunk[name],'string',`Missing shader chunk: ${name}`);
        return resolveIncludes(env.sandbox.__ShaderChunk[name],depth+1);
      });
    };
    r.scene.traverse(o=>{if(o.material?.onBeforeCompile&&o.material.isMeshStandardMaterial){
      const shader={uniforms:{},vertexShader:env.sandbox.__ShaderLib.standard.vertexShader,fragmentShader:env.sandbox.__ShaderLib.standard.fragmentShader};
      o.material.onBeforeCompile(shader);assert(shader.uniforms.uFog);assert(shader.fragmentShader.includes('surveyFog'));
      assert(resolveIncludes(shader.vertexShader).includes('vSurveyWorld='));assert(resolveIncludes(shader.fragmentShader).includes('surveyFog='));
    }else if(o.material?.isShaderMaterial){resolveIncludes(o.material.vertexShader);resolveIncludes(o.material.fragmentShader);}});
    r.disposeScene();
  }
  assert.deepEqual(env.errors,[]);
});

test('home button preserves the current record and returns without navigating outside the package',async()=>{
  const env=environment();env.planetOptions[1].click();await env.advance(1400);
  env.key('ArrowUp');await env.advance(500);env.key('ArrowUp','keyup');
  env.nodes.get('home').click();await env.advance(2400);
  assert.equal(env.inspect().phase,'select');assert.equal(env.inspect().records,1);
  assert.equal(env.nodes.get('sound').attrs['aria-pressed'],'false');assert.deepEqual(env.errors,[]);
});

test('atlas calculates geography once per planet and reuses it while moving or waiting',async()=>{
  const env=environment();env.planetOptions[0].click();await env.advance(1400);
  const original=env.inspect();assert.equal(original.atlasBuilds,1);assert.equal(original.atlasHeightSamples,65536);
  env.key('ArrowUp');await env.advance(4200);env.key('ArrowUp','keyup');await env.advance(2000);
  assert.equal(env.inspect().atlasBuilds,1);assert.equal(env.inspect().atlasHeightSamples,original.atlasHeightSamples);
  env.nodes.get('home').click();await env.advance(2400);env.planetOptions[0].click();await env.advance(1400);
  assert.equal(env.inspect().atlasBuilds,1);
  env.nodes.get('home').click();await env.advance(2400);env.planetOptions[2].click();await env.advance(1400);
  assert.equal(env.inspect().atlasBuilds,2);assert.deepEqual(env.errors,[]);
});

test('adaptive quality really reduces active mesh and shadow resources',()=>{
  const env=environment(),V=env.sandbox.Voyage,r=new V.ArtworkRenderer(env.nodes.get('view'));
  r.level=2;r.auto=true;r.enter(V.worlds[1]);
  const high=r.groundGeometry;let disposed=false;high.addEventListener('dispose',()=>disposed=true);
  const resources=r.resources.length;assert.equal(high.parameters.widthSegments,320);
  assert(r.downgrade());assert(disposed);assert.equal(r.resources.length,resources);
  assert.equal(r.groundGeometry.parameters.widthSegments,224);assert.equal(r.key.shadow.mapSize.x,1024);
  assert(r.downgrade());assert.equal(r.groundGeometry.parameters.widthSegments,144);assert(!r.key.castShadow);assert(!r.renderer.shadowMap.enabled);
  assert(!r.downgrade());r.disposeScene();assert.deepEqual(env.errors,[]);
});

test('even five-frame-per-second operation triggers adaptive quality reduction',async()=>{
  const env=environment({quality:'auto',rafStep:200});env.planetOptions[1].click();await env.advance(1400);
  assert.equal(env.inspect().quality,'HIGH');await env.advance(16000);
  assert.notEqual(env.inspect().quality,'HIGH');await env.advance(7000);assert.equal(env.inspect().quality,'LOW');assert.deepEqual(env.errors,[]);
});

test('MID maintains its intended 45 fps cadence on a 60 Hz scheduler',async()=>{
  const env=environment({quality:'mid'});env.planetOptions[1].click();await env.advance(1400);
  const before=env.renderers[0].frames;await env.advance(4000);
  const frames=env.renderers[0].frames-before;assert(frames>=176&&frames<=184,`Expected about 180 frames, got ${frames}`);
  assert.deepEqual(env.errors,[]);
});

test('modifier shortcuts do not drive the rover',async()=>{
  const env=environment();env.planetOptions[1].click();await env.advance(1400);
  env.key('KeyW','keydown',{metaKey:true});await env.advance(1000);assert.equal(env.inspect().sim.distance,0);assert.deepEqual(env.errors,[]);
});

test('shader compilation failure switches to the recovery message',async()=>{
  const env=environment();env.renderers[0].debug.onShaderError();await env.advance(100);
  assert.equal(env.nodes.get('failure').hidden,false);assert.equal(env.errors.length,1);
});

test('all runtime dependencies are local and navigation labels have no decorative arrows',()=>{
  const html=source('index.html');
  for(const [,url] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)){
    if(url.startsWith('data:'))continue;
    assert(!/^(https?:|\/|\.\.\/)/.test(url),url);assert(fs.existsSync(path.join(base,url)),url);
  }
  assert(!html.includes('../../index.html'));assert(!html.includes('↗'));
  assert(html.includes('data-drive="right"'));assert(html.includes('>→</button>'));
});
