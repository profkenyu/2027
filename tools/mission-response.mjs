import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPreviewServer} from './lib/preview-server.mjs';
import {migrationResponse,sampleSignatures} from '../works/first_dawn/mission-response.js';
import {PossibilityModel} from '../works/first_dawn/possibility-model.js';
import {beginPostMission,readPostMission,POST_KEY} from '../works/shared/post-mission-state.js';
const samples=Array.from({length:6},(_,i)=>({sample:`TEST MATERIAL ${i}`,sign:`TEST SIGN ${i}`}));
const signatures=sampleSignatures(samples);
const evidence={samples:6,nodes:3,water:true,temperature:246,radiation:.1,energy:1,sampleSignatures:signatures};
assert.equal(sampleSignatures([{}, {}, {}, {}, {}, {}]),null);
assert.deepEqual(sampleSignatures(samples),signatures);
assert(migrationResponse(evidence).opening>migrationResponse({...evidence,energy:0}).opening);
assert(migrationResponse(evidence).duration<migrationResponse({...evidence,energy:0}).duration);
const storage=new Map();globalThis.sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
beginPostMission('abcdef',{ready:true,samples,water:{confirmed:true}},evidence,{complete:true,records:[1,2,3]});
assert.deepEqual(readPostMission().evidence.sampleSignatures,signatures);
const corrupt=readPostMission();corrupt.evidence.sampleSignatures=[2];storage.set(POST_KEY,JSON.stringify(corrupt));assert.equal(readPostMission(),null);
const a=new PossibilityModel(evidence,'abcdef'),b=new PossibilityModel({...evidence,sampleSignatures:signatures.map(v=>1-v)},'abcdef');a.advance(24);b.advance(24);
assert.notDeepEqual([...a.resource],[...b.resource]);assert.notDeepEqual([...a.field],[...b.field]);
const server=await startPreviewServer(),report={syntheticEvidence:true,cases:[],errors:[]};let browser;
await mkdir('output/qa/mission-response',{recursive:true});
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [tier,width,height] of [['high',1600,1000],['mid',1180,820],['low',390,844]]){
  const results=[];
  for(const energy of [0,1]){
   const page=await browser.newPage({viewport:{width,height}});
   page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   await page.addInitScript(e=>{if(!sessionStorage.getItem('beyond-known:post-mission:v1'))sessionStorage.setItem('beyond-known:post-mission:v1',JSON.stringify({version:1,phase:'migration',elapsed:0,seed:'abcdef',evidence:e,outcome:null}));},{...evidence,energy});
   await page.goto(server.url+'/migration.html?test&quality='+tier);await page.waitForFunction(()=>window.FIRST_DAWN);
   const result=await page.evaluate(()=>{FIRST_DAWN.seek(60);return {response:FIRST_DAWN.missionResponse(),positions:FIRST_DAWN.positions(),deployment:FIRST_DAWN.snapshot().deployment};});
   assert(result.response.resourceLinked);assert.equal(result.response.source,'mission-record');
   await page.waitForFunction(()=>document.getElementById('loading').hidden);
   await page.screenshot({path:`output/qa/mission-response/${tier}-energy-${energy}.png`});
   await page.evaluate(()=>{FIRST_DAWN.seek(20);FIRST_DAWN.seek(60);});assert.deepEqual(await page.evaluate(()=>FIRST_DAWN.missionResponse()),result.response);
   await page.reload();await page.waitForFunction(()=>window.FIRST_DAWN);await page.evaluate(()=>FIRST_DAWN.seek(60));assert.deepEqual(await page.evaluate(()=>FIRST_DAWN.missionResponse()),result.response);
   await page.evaluate(()=>FIRST_DAWN.next());await page.waitForURL('**/arrival.html?**');await page.waitForFunction(()=>window.FIRST_DAWN);assert.equal(await page.evaluate(()=>FIRST_DAWN.missionResponse().energy),energy);
   await page.goto(server.url+'/arrival.html?test&quality='+tier);await page.waitForFunction(()=>window.FIRST_DAWN);
   result.outcome=await page.evaluate(()=>{FIRST_DAWN.seek(138);return FIRST_DAWN.snapshot().possibility;});
   results.push(result);await page.close();
  }
  assert.deepEqual(results[0].positions,results[1].positions);
  assert(results[0].deployment[0]<results[1].deployment[0]);
  assert.notDeepEqual(results[0].response.angles,results[1].response.angles);
  assert.notEqual(results[0].outcome.mass,results[1].outcome.mass);
  report.cases.push({tier,results});console.log(`PASS ${tier}: evidence → actual radiator pivots / identical flight / reload / arrival outcome`);
 }
 assert.deepEqual(report.errors,[]);await writeFile('output/qa/mission-response/report.json',JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
