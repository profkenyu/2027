import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const out='output/qa/exhibition-audit';await mkdir(out,{recursive:true});
const jobs=[
 ['terrain',['tools/terrain.mjs']],['memory',['tools/memory.mjs']],['observation',['tools/observation.mjs']],['harness',['tools/harness.mjs']],
 ['model',['tools/vehicle-model.mjs']],['docking',['tools/docking.mjs']],['archive-return',['tools/archive-return.mjs']],['blueprints',['tools/blueprints.mjs']],
 ['entry',['tools/vehicle-entry.mjs']],['desktop',['tools/smoke.mjs']],['completion',['tools/completion.mjs']],
 ['mobile-landscape',['tools/smoke.mjs'],{MOBILE:'1',VIEWPORT:'844x390'}],['mobile-portrait',['tools/smoke.mjs'],{MOBILE:'1',VIEWPORT:'390x844'}],['mobile-narrow',['tools/smoke.mjs'],{MOBILE:'1',VIEWPORT:'320x568'}],
 ['flight-finish',['tools/flight-finish.mjs']],['space-01',['tools/space-qa.mjs']],['space-camera',['tools/space-camera.mjs']],['space-02',['tools/second-passage.mjs','--render-only']],
 ['possibility',['tools/possibility-model.mjs']],['ending',['tools/ending.mjs']],['ending-audio',['tools/ending-audio.mjs']],['cinema-ui',['tools/cinema-ui.mjs']],['planet-pages',['tools/planet-pages.mjs']]
];
const reports=[];
for(const [name,args,env={}] of jobs){
 const started=Date.now();let log='';console.log(`RUN ${name}`);
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,args,{env:{...process.env,...env}});child.stdout.on('data',d=>{log+=d;});child.stderr.on('data',d=>{log+=d;});child.on('error',e=>{log+=String(e);resolve(-1);});child.on('close',resolve);});
 await writeFile(`${out}/${name}.log`,log);reports.push({name,code,seconds:Math.round((Date.now()-started)/1000)});await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));console.log(`${code===0?'PASS':'FAIL'} ${name} (${reports.at(-1).seconds}s)`);if(code!==0)console.log(log.slice(-1600));
}
if(reports.some(r=>r.code!==0))process.exitCode=1;
