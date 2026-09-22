import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export async function buildSpace(){
  const root=new URL('../',import.meta.url);
  const bundle=await build({entryPoints:[fileURLToPath(new URL('works/space/main.js',root))],bundle:true,format:'esm',target:'es2022',minify:true,write:false});
  const shell=await readFile(new URL('works/space/dev.html',root),'utf8');
  const html=shell.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./main.js"></script>',()=>`<script type="module">${bundle.outputFiles[0].text}</script>`);
  await mkdir(new URL('dist/',root),{recursive:true});
  for(const passage of [1,2]){
    const name=`space-0${passage}.html`;
    const output=passage===1?html:html.replace('<body>','<body data-passage="2">').replaceAll('Passage 01','Passage 02').replaceAll('PASSAGE 01','PASSAGE 02');
    for(const file of [name,'works/terra_incognita/'+name,'dist/'+name])await writeFile(new URL(file,root),output);
  }
  console.log(`✓ two independent passages — ${Math.round(Buffer.byteLength(html)/1024)} KB each`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildSpace();
