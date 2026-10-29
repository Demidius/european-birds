// Real-browser checks for free practice, including local licensed photos and mobile layout.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.BIRD_QA_OUTPUT||path.resolve(root,'../practice-qa');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
(async()=>{
 const server=http.createServer((req,res)=>{
  let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(rel.endsWith('/'))rel+='index.html';
  const file=path.resolve(root,'.'+rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.BIRD_CHROMIUM||undefined,headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/,route=>route.abort());
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/study.html?offline=1');
  await page.evaluate(()=>{
   localStorage.setItem('europeanBirds:v1:progress:guest',JSON.stringify({'great-tit__photo-pl':{status:'learning',level:5},'blue-tit__photo-pl':{status:'known',level:10}}));
   localStorage.setItem('europeanBirds:v1:settings',JSON.stringify({testFormat:'choices',testLanguage:'pl'}));
  });
  await page.reload();
  const before=await page.evaluate(()=>localStorage.getItem('europeanBirds:v1:progress:guest'));
  await page.locator('[data-tree-go="Passeriformes"]').click();await page.locator('[data-tree-go="Paridae"]').click();
  assert.equal(await page.locator('[data-study-format="choices"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-practice-language]').inputValue(),'pl');
  await page.setViewportSize({width:1440,height:1000});await page.locator('.drill-hero').scrollIntoViewIfNeeded();
  fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'practice-categories-desktop.png')});
  for(const width of [1440,1024,760,390,320]){
   await page.setViewportSize({width,height:width<500?844:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow '+width);
   await page.locator('#reviewBtn').click();
   assert.equal(await page.locator('[data-answer]').count(),4);
   await page.locator('.fc-front img').evaluate(img=>img.complete&&img.naturalWidth?true:new Promise((resolve,reject)=>{img.onload=()=>resolve(true);img.onerror=reject;}));
   assert.equal(await page.locator('#cardDialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,'dialog overflow '+width);
   if(width===1440||width===390)await page.screenshot({path:path.join(out,'practice-question-'+(width===1440?'desktop':'mobile')+'.png')});
   await page.locator('[data-answer]:not([data-answer="great-tit"])').first().click();
   assert.match(await page.locator('.practice-feedback').innerText(),/Правильный ответ: Bogatka/);
   assert.equal(await page.locator('.fc-answer > h3').innerText(),'Большая синица');
   assert.equal(await page.locator('#cardBody [data-pc-level], #cardBody [data-act="kopen"]').count(),0);
   assert.equal(await page.locator('#cardBody [data-pc-status]').count(),3);
   if(width===1440)await page.screenshot({path:path.join(out,'practice-answer-desktop.png')});
   await page.locator('[data-act="next"]').click();await page.keyboard.press('4');
   assert.equal(await page.locator('.fc-answer').count(),1);await page.keyboard.press('Enter');
   assert.equal(await page.locator('.fc-answer').count(),0,'Enter moves to a fresh question');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#cardDialog').isVisible(),false);
  }
  // Exercise every language with both media-free names and real photo questions.
  for(const mode of ['names','photo','audio']){
   await page.locator('[data-mode="'+mode+'"]').click();
   for(const language of ['ru','en','latin','pl']){
    await page.locator('[data-practice-language]').selectOption(language);
    await page.evaluate(()=>BirdAtlas.study(['great-tit'],'Синица'));
    assert.equal(await page.locator('[data-answer]').count(),4);
    const expected=await page.evaluate(l=>BIRD_DATA.find(b=>b.id==='great-tit')[l],language);
    assert.ok((await page.locator('[data-answer="great-tit"]').innerText()).includes(expected));
    await page.locator('[data-answer="great-tit"]').click();assert.match(await page.locator('.practice-feedback').innerText(),/Верно!/);
    await page.locator('#closeCard').click();
   }
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('europeanBirds:v1:progress:guest')),before);
  assert.equal(await page.evaluate(()=>localStorage.getItem('europeanBirds:v1:pending:guest')),null);
  assert.deepEqual(errors,[]);
  // Default cards still reveal the answer and allow manual progress updates.
  await page.locator('[data-mode="photo"]').click();await page.locator('[data-study-format="cards"]').click();
  await page.evaluate(()=>BirdAtlas.study(['great-tit'],'Синица'));await page.locator('[data-act="flip"]').click();
  await page.locator('[data-pc-status="known"]').click();assert.equal(await page.evaluate(()=>BirdAtlas.state('great-tit').status),'known');
  console.log('PRACTICE BROWSER PASSED: 5 widths, all languages/modes, card reveal, keyboard, unchanged progress, normal cards.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
