import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildOpening(){
  const result=await build({entryPoints:[resolve(root,'works/opening/main.js')],bundle:true,format:'esm',target:'es2022',minify:true,write:false,metafile:true});
  if(Object.keys(result.metafile.inputs).some(p=>/engine\/(vehicle|tsl|cpu)\/|terra_incognita\/main\.js|three\.webgpu/.test(p)))throw Error('Opening includes mission engine');
  const shell=await readFile(resolve(root,'works/opening/dev.html'),'utf8');
  const fonts=await readFile(resolve(root,'engine/fonts.css'),'utf8');
  const cameraIcon=(await readFile(resolve(root,'works/terra_incognita/assets/camera-icon.png'))).toString('base64');
  const lightIcon=(await readFile(resolve(root,'works/terra_incognita/assets/light-icon.png'))).toString('base64');
  const iconMarkup=`<img hidden src="data:image/png;base64,${cameraIcon}"><img hidden src="data:image/png;base64,${lightIcon}">`;
  const html=shell.replace('<link rel="stylesheet" href="../../engine/fonts.css">',()=>`<style>${fonts}</style>`).replace('<body>','<body>'+iconMarkup).replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./main.js"></script>',()=>`<script type="module">${result.outputFiles[0].text}</script>`);
  await mkdir(resolve(root,'dist'),{recursive:true});
  for(const file of ['index.html','works/terra_incognita/index.html','dist/index.html'])await writeFile(resolve(root,file),html);
  console.log(`✓ independent opening — 3 production blueprints, ${Math.round(Buffer.byteLength(html)/1024)} KB, no mission engine`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildOpening();
