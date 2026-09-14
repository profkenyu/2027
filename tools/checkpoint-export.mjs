import assert from 'node:assert/strict';
import {CHECKPOINT_KEY,writeCheckpoint,readCheckpoint,clearCheckpoint,validCheckpoint} from '../engine/core/checkpoint.js';
import {createArchiveExport,archiveCSV} from '../engine/core/archive-export.js';
import {MissionMemory} from '../engine/core/mission-memory.js';
import {approachProgress} from '../works/first_dawn/flight.js';
const rows=new Map(),storage={getItem:k=>rows.get(k),setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)};
const memory=new MissionMemory({storage});
const state={version:1,world:'terra',seed:'ABC123',savedAt:1,rover:{x:240,z:530,heading:.2},charge:.8,mode:'explorer',selections:[1,-1,7,-1,-1,-1],geological:0,memory:memory.snapshot()};
assert(writeCheckpoint(state,storage));assert.deepEqual(readCheckpoint(storage),state);
for(const changed of [{version:99},{world:'../../x'},{charge:NaN},{rover:{...state.rover,x:Infinity}},{selections:[1,1,7,-1,-1,-1]},{memory:{version:3,samples:[],water:{absorptionBandsMicron:'invalid'}}}])assert(!validCheckpoint({...state,...changed}));
assert(!writeCheckpoint(state,{setItem(){throw Error('quota')}}));
rows.set(CHECKPOINT_KEY,'broken');assert.equal(readCheckpoint(storage),null);
writeCheckpoint(state,storage);clearCheckpoint(storage);assert.equal(readCheckpoint(storage),null);
const png='data:image/png;base64,aGVsbG8=';
const stations=[{id:'P01-001',body:'terra',planet:'PLANET 01',world:'SHEAR WORLD',label:'=1+2',x:-2,z:3},
{id:'P01-002',body:'terra',planet:'PLANET 01',world:'SHEAR WORLD',label:'UNRESOLVED',x:2,z:4}];
const exported=createArchiveExport({stations,records:[{...stations[0],image:png,capturedAt:123,frame:1}],seed:'ABC123'},new Date(0));
assert.equal(exported.count,1);assert.equal(exported.stations[0].capture.image,png);assert.equal(exported.stations[1].capture,null);
assert.equal(exported.stations[0].capture.pageElapsedMs,123);
assert(archiveCSV(exported).includes('"\'=1+2"'));assert(!archiveCSV(exported).includes(png));
assert.equal(createArchiveExport({stations,records:[{...stations[0],image:'https://example.com/image.png'}]}).stations[0].capture.image,null);
assert.equal(approachProgress(0),0);assert.equal(approachProgress(1),1);
let previous=0;for(let i=1;i<=1000;i++){const n=approachProgress(i/1000);assert(n>=previous&&n<=1);previous=n;}
const speed=u=>(approachProgress(u+.0001)-approachProgress(u-.0001))/.0002;
assert(speed(.75)>speed(.15)*8,'near approach must be materially faster than distant approach');
assert(Math.abs(speed(.8599)-speed(.8601))<.01,'braking joins continuously');
assert(speed(.999)<.002,'arrival settles without a sudden stop');
console.log('PASS checkpoint validation/quota/corruption; export images/CSV safety; monotonic accelerating approach and smooth braking');
