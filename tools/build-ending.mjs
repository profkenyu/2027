import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildEnding(){
  await build({entryPoints:[resolve(root,'node_modules/tone/build/esm/index.js')],bundle:true,format:'esm',target:'es2022',minify:true,outfile:resolve(root,'works/first_dawn/tone-runtime.js')});
  const result=await build({entryPoints:[resolve(root,'works/first_dawn/main.js')],bundle:true,format:'esm',target:'es2022',minify:true,write:false,metafile:true});
  if(Object.keys(result.metafile.inputs).some(p=>resolve(root,p).startsWith(resolve(root,'engine')+'/')))throw Error('Ending depends on mission engine');
  const shell=await readFile(resolve(root,'works/first_dawn/dev.html'),'utf8');
  await mkdir(resolve(root,'dist'),{recursive:true});
  const closing=await build({entryPoints:[resolve(root,'works/first_dawn/ending.js')],bundle:true,format:'esm',target:'es2022',minify:true,write:false});
  for(const [phase,label] of [['migration','MIGRATION'],['arrival','FIRST DAWN'],['ending','BEYOND THE KNOWN']]){
    const code=phase==='ending'?closing.outputFiles[0].text:result.outputFiles[0].text;
    const html=shell.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<body>',`<body data-phase="${phase}">`).replace('<header>FIRST DAWN ',`<header>${label} `).replace('· FIRST DAWN</title>',`· ${label}</title>`).replace('<script type="module" src="./main.js"></script>',()=>`<script type="module">${code}</script>`);
    for(const folder of ['', 'works/terra_incognita/', 'dist/'])await writeFile(resolve(root,`${folder}${phase}.html`),html);
    console.log(`✓ independent ${phase} — ${Math.round(Buffer.byteLength(html)/1024)} KB, no mission engine or external assets`);
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildEnding();
