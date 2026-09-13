import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildEnding(){
  const result=await build({entryPoints:[resolve(root,'works/first_dawn/main.js')],bundle:true,format:'esm',target:'es2022',minify:true,write:false,metafile:true});
  if(Object.keys(result.metafile.inputs).some(p=>resolve(root,p).startsWith(resolve(root,'engine')+'/')))throw Error('Ending depends on mission engine');
  const shell=await readFile(resolve(root,'works/first_dawn/dev.html'),'utf8');
  const html=shell.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./main.js"></script>',()=>`<script type="module">${result.outputFiles[0].text}</script>`);
  await mkdir(resolve(root,'dist'),{recursive:true});
  for(const file of ['ending.html','works/terra_incognita/ending.html','dist/ending.html'])await writeFile(resolve(root,file),html);
  console.log(`✓ independent ending — ${Math.round(Buffer.byteLength(html)/1024)} KB, no mission engine or external assets`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildEnding();
