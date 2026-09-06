import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const server=createServer(async(q,s)=>{try{s.setHeader('Content-Type',q.url.split('?')[0].endsWith('.html')?'text/html':'text/javascript');s.end(await readFile('.'+q.url.split('?')[0]));}catch{s.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const tier of ['high','mid','low']){
  const page=await browser.newPage({viewport:{width:1400,height:1000}});const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error(e);});
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/vehicle-model.html?quality=${tier}`);await page.waitForFunction(()=>window.ready);
  console.log(await page.evaluate(()=>preview.check()));
  for(const kind of ['rover','lander','fold','bay']){await page.evaluate(kind=>preview.frame(kind),kind);await page.screenshot({path:`dist/model-${tier}-${kind}.png`});}
  if(errors.length)throw Error(errors.join('\n'));await page.close();
 }
}finally{await browser?.close();server.close();}
