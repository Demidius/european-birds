// Integrated browser coverage for the shared tree, catalog and learning sessions.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),http=require('http');
(async()=>{
const root=path.resolve(__dirname,'..'),out=process.env.BIRD_QA_OUTPUT||path.resolve(root,'../bird-qa');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(rel.endsWith('/'))rel+='index.html';const file=path.resolve(root,'.'+rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,b)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.BIRD_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--disable-gpu']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/?offline=1');await page.waitForSelector('.tree-species',{state:'attached'});assert.equal(await page.locator('.tree-species').count(),435);
 assert.equal(await page.locator('[data-branch="Corvidae"] [data-tree-species="hooded-crow"]').count(),1);
 for(const [query,expected]of [['Буроголовая','Пухляк'],['Common Chaffinch','Зяблик'],['Drozd śpiewak','Певчий дрозд'],['Corvus cornix','Ворона']]){await page.locator('#treeSearch').fill(query);assert.equal(await page.locator('.tree-species').count(),1);assert.ok((await page.locator('.tree-names h3').innerText()).includes(expected));}
 await page.locator('#treeSearch').fill('');await page.locator('#includeVagrants').uncheck();assert.equal(await page.locator('[data-tree-species="Ficedula_parva"]').count(),1);
 await page.locator('#onlyPoland').check();assert.equal(await page.locator('.tree-species').count(),196);for(const id of ['hooded-crow','mallard','woodpigeon','grey-heron'])assert.equal(await page.locator('[data-tree-species="'+id+'"]').count(),1);
 await page.locator('#polandBreeding').check();assert.equal(await page.locator('[data-tree-species="mallard"]').count(),1);await page.locator('#onlyPoland').uncheck();
 for(const width of [320,390,760,1024,1440]){
  await page.setViewportSize({width,height:900});await page.locator('#treeSearch').fill('Parus major');await page.evaluate(()=>document.fonts.ready);await page.locator('[data-tree-species="great-tit"] img').evaluate(i=>i.decode());
  const box=await page.locator('[data-tree-species="great-tit"]').boundingBox();assert.ok(box.width>=Math.min(240,width-100),'Card is too narrow at '+width+': '+box.width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1,'Page overflow at '+width);
  const font=await page.locator('.tree-names').evaluate(e=>Array.from(e.children).map(x=>getComputedStyle(x).fontSize));assert.equal(new Set(font).size,1);
  const header=await page.locator('[data-branch="Parus"]>summary').boundingBox(),button=await page.locator('[data-test-branch="Parus"]').boundingBox();assert.ok(button.y>=header.y&&button.y+button.height<=header.y+header.height+1);
  if(width===390||width===1440){await page.locator('[data-branch="Paridae"]').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'audit-fixed-'+width+'.png')});}
 }
 await page.selectOption('#language','latin');await page.locator('[data-tree-test="great-tit"]').click();assert.equal(await page.locator('[data-tree-answer]').count(),6);assert.match(await page.locator('[data-tree-answer="great-tit"]').innerText(),/Парус майор/);
 await page.locator('[data-tree-answer]:not([data-tree-answer="great-tit"])').first().click();assert.equal(await page.locator('[data-tree-answer]:visible').count(),1);assert.equal(await page.locator('[data-tree-answer="great-tit"]').isVisible(),true);await page.locator('#closeTreeQuiz').click();
 await page.locator('#treeSearch').fill('');await page.locator('#catalogView').click();await page.locator('#search').fill('Буроголовая');assert.equal(await page.locator('.bird-tile').count(),1);assert.match(await page.locator('.bird-tile').innerText(),/Пухляк/);
 assert.deepEqual(errors,[]);console.log('UNIFIED BROWSER: canonical names, filters, taxonomy, quizzes and mobile layouts passed');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
