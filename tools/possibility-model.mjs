import assert from 'node:assert/strict';
import {PossibilityModel} from '../works/first_dawn/possibility-model.js';
import {POST_PHASES,beginPostMission,readPostMission,clearPostMission} from '../works/shared/post-mission-state.js';
const favourable={temperature:246,energy:1,radiation:0,water:true},hostile={temperature:170,energy:.1,radiation:1,water:true};
const a=new PossibilityModel(favourable,'abcdef'),b=new PossibilityModel(hostile,'abcdef'),empty=new PossibilityModel(null);
a.advance(24);b.advance(24);empty.advance(24);
assert.equal(a.snapshot().status,'persisting');assert.equal(b.snapshot().status,'fading');assert.equal(empty.snapshot().status,'unavailable');
for(const m of [a,b])for(const f of [m.field,m.resource])assert([...f].every(v=>Number.isFinite(v)&&v>=0&&v<=1));
const expected=[...a.field];a.advance(3);a.advance(24);assert.deepEqual([...a.field],expected);
const c=new PossibilityModel(favourable,'abcdef');for(let t=0;t<24;t+=.037)c.advance(t);c.advance(24);assert.deepEqual([...c.field],expected);
// The fracture boundary must materially determine transport; a decorative
// overlay would fail the off-network and depleted-origin checks.
const branching=new PossibilityModel(favourable,'abcdef');branching.advance(8);
const earlyCenter=branching.field[32*64+32],earlyMass=branching.snapshot().mass;
branching.advance(18);assert(branching.snapshot().mass>earlyMass);
branching.advance(24);assert(branching.field[32*64+32]<earlyCenter*.2);
assert(branching.resource[32*64+32]<.05);
assert(branching.fractures.length===21);
let offNetwork=0;for(let i=0;i<branching.field.length;i++)if(branching.substrate[i]<.01)offNetwork+=branching.field[i];
assert(offNetwork<branching.snapshot().mass*.01,'Trace escaped fracture boundary');
const other=new PossibilityModel(favourable,'123456');other.advance(24);assert.notDeepEqual([...other.field],expected);
const dry=new PossibilityModel({...favourable,water:false},'abcdef');dry.advance(24);assert.equal(dry.snapshot().status,'fading');
const storage=new Map();globalThis.sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
assert.throws(()=>beginPostMission('abcdef',{},favourable,{}));
beginPostMission('abcdef',{ready:true,samples:Array(6).fill({}),water:{confirmed:true}},favourable,{complete:true,records:['a','b','c']});
assert.equal(readPostMission().evidence.nodes,3);clearPostMission();assert.equal(readPostMission(),null);
assert.equal(Object.values(POST_PHASES).reduce((n,s)=>n+s.duration,0),156);
console.log('PASS possibility: bounded resource field / growth and extinction / no evidence no simulation / deterministic seek / frame-rate independence / post-mission validation');
