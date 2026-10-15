// Real-browser coverage for the drill-down tree: layout, history, filters, cards, quizzes and catalog.
// Logic without layout is covered by tests/unified.test.cjs (jsdom). Remote photos are replaced
// with a local placeholder so the run does not depend on the network.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),http=require('http');
const LOCAL_CHROMIUM='/opt/pw-browsers/chromium';
(async()=>{
const root=path.resolve(__dirname,'..'),out=process.env.BIRD_QA_OUTPUT||path.resolve(root,'../bird-qa');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(rel.endsWith('/'))rel+='index.html';const file=path.resolve(root,'.'+rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,b)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(b);});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const placeholder='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#4a6355"/></svg>';
try{
 browser=await chromium.launch({executablePath:process.env.BIRD_CHROMIUM||(fs.existsSync(LOCAL_CHROMIUM)?LOCAL_CHROMIUM:undefined),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/,r=>r.request().resourceType()==='image'?r.fulfill({contentType:'image/svg+xml',body:placeholder}):r.abort());
 const base='http://127.0.0.1:'+server.address().port;
 const total=async()=>Number((await page.locator('.drill-total').innerText()).split(' ')[0]);
 const hero=()=>page.locator('.drill-hero h3').innerText();
 const idOf=latin=>page.evaluate(l=>window.BIRD_DATA.find(b=>b.latin===l).id,latin);
 await page.goto(base+'/?offline=1');await page.waitForSelector('.drill-row');

 // Styles come from plain <link> tags; the old depth buttons are gone.
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/<link rel="stylesheet" href="study-tree-drill\.css\?v=[\w-]+">/);
 assert.equal(await page.locator('link[href^="study-tree-drill.css"]').count(),1,'drill CSS must be linked exactly once');
 assert.equal(await page.locator('.tree-depth, [data-depth]').count(),0);
 assert.equal(await page.locator('details.study-branch, .tree-species').count(),0,'no nested frames from the old tree');
 assert.equal(await page.locator('.drill-bar').evaluate(e=>getComputedStyle(e).position),'sticky');

 // Root level: orders only, nothing to go back to.
 assert.equal(await total(),435);assert.ok(await page.locator('.drill-row[data-tree-go="Passeriformes"]').count());
 assert.equal(await page.locator('.drill-back').isDisabled(),true);

 // Search by any of the four languages and by former names.
 for(const [query,latin] of [['Буроголовая','Poecile montanus'],['Common Chaffinch','Fringilla coelebs'],['Drozd śpiewak','Turdus philomelos'],['Corvus cornix','Corvus corone']]){
  await page.locator('#treeSearch').fill(query);const id=await idOf(latin);
  assert.equal(await page.locator('.drill-species').count(),1,query);assert.equal(await page.locator('[data-tree-species="'+id+'"]').count(),1,query);
  for(const lang of ['ru','la','pl'])assert.equal(await page.locator('.drill-species [lang='+lang+']').count(),1,query+' '+lang);
  assert.match(await page.locator('.drill-crumbs').innerText(),/Поиск/);
 }
 await page.locator('.drill-back').click();assert.equal(await page.locator('#treeSearch').inputValue(),'','Back clears the search');assert.equal(await total(),435);

 // Filters: vagrants, Poland and seasons.
 await page.locator('#includeVagrants').uncheck();await page.locator('#treeSearch').fill('Ficedula parva');assert.equal(await page.locator('[data-tree-species="Ficedula_parva"]').count(),1);await page.locator('#treeSearch').fill('');
 await page.locator('#onlyPoland').check();assert.equal(await total(),196);
 for(const latin of ['Corvus corone','Anas platyrhynchos','Columba palumbus','Ardea cinerea']){await page.locator('#treeSearch').fill(latin);assert.equal(await page.locator('[data-tree-species="'+await idOf(latin)+'"]').count(),1,latin);}
 await page.locator('#treeSearch').fill('');
 await page.locator('#polandBreeding').check();const breeding=await total();assert.ok(breeding<196);
 await page.locator('#treeSearch').fill('Anas platyrhynchos');assert.equal(await page.locator('[data-tree-species="mallard"]').count(),1);await page.locator('#treeSearch').fill('');
 await page.locator('#polandWinter').check();assert.ok(await total()>=breeding,'seasons combine with OR');
 await page.locator('#onlyPoland').uncheck();assert.equal(await page.locator('#polandBreeding').isChecked(),false);assert.equal(await page.locator('#polandWinter').isChecked(),false);
 await page.locator('#includeVagrants').check();assert.equal(await total(),435);

 // Drill-down, breadcrumbs, the Back button and browser history.
 await page.locator('[data-tree-go="Passeriformes"]').click();assert.equal(await hero(),'Воробьинообразные');
 await page.locator('.drill-row[data-tree-go="Paridae"]').click();assert.equal(await hero(),'Синицевые');assert.equal(await total(),10);
 assert.match(await page.locator('.drill-crumbs').innerText(),/Все птицы\s*›\s*Воробьинообразные\s*›\s*Синицевые/);
 await page.locator('.drill-back').click();assert.equal(await hero(),'Воробьинообразные');
 await page.goBack();assert.equal(await hero(),'Птицы Европы');assert.equal(await page.locator('.drill-back').isDisabled(),true);
 await page.goForward();assert.equal(await hero(),'Воробьинообразные');
 await page.locator('.drill-crumbs button').first().click();assert.equal(await hero(),'Птицы Европы');
 await page.locator('[data-tree-go="Columbiformes"]').click();assert.match(await page.locator('.drill-only').innerText(),/Голубиные/,'a single family opens at once');assert.ok(await page.locator('.drill-species').count()>0);
 await page.locator('.drill-crumbs button').first().click();

 // Layout at phone, tablet and desktop widths.
 for(const width of [320,390,760,1024,1440]){
  await page.setViewportSize({width,height:844});
  await page.locator('[data-tree-go="Passeriformes"]').click();
  const row=page.locator('.drill-row[data-tree-go="Paridae"]');await row.scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,innerHeight/3));await row.click();
  const top=await page.locator('.drill-hero').evaluate(e=>e.getBoundingClientRect().top);assert.ok(top>=0&&top<844,'family title must be visible after opening a family at '+width+': '+top);
  await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1,'Page overflow at '+width);
  const card=await page.locator('[data-tree-species="great-tit"]').boundingBox(),test=await page.locator('[data-tree-test="great-tit"]').boundingBox();
  assert.ok(card.width>=Math.min(300,width-60),'Row is too narrow at '+width+': '+card.width);
  assert.ok(test.x>=card.x&&test.x+test.width<=card.x+card.width+1&&test.y>=card.y&&test.y+test.height<=card.y+card.height+1,'Test button leaves its row at '+width);
  assert.ok(test.height>=44,'Test button is below the 44px touch target at '+width);
  const fonts=await page.locator('[data-tree-species="great-tit"] .drill-names').evaluate(e=>['em','.drill-pl'].map(s=>getComputedStyle(e.querySelector(s)).fontSize));assert.equal(new Set(fonts).size,1,'Latin and Polish names share one size');
  await page.evaluate(()=>scrollBy(0,400));assert.ok(Math.abs(await page.locator('.drill-bar').evaluate(e=>e.getBoundingClientRect().top))<=1,'breadcrumb bar stays pinned at '+width);
  if(width===390||width===1440){await page.locator('.unified-tree').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'drill-paridae-'+width+'.png')});}
  await page.locator('.drill-crumbs button').first().click();
 }

 // Biology remains readable inside the species dialog on narrow phones.
 for(const width of [320,390,760]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>window.BirdAtlas.detail('great-tit'));
  assert.match(await page.locator('#infoBody').innerText(),/Типичный биотоп/);
  assert.match(await page.locator('#infoBody').innerText(),/Пение и голос/);
  assert.ok(await page.locator('#infoBody .biology-recording audio').count()>0);
  assert.equal(await page.locator('#infoBody audio').first().getAttribute('preload'),'none');
  assert.ok(await page.locator('#infoBody').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Biology dialog overflow at '+width);
  await page.locator('#infoBody .biology-sources summary').click();
  assert.ok(await page.locator('#infoBody .biology-sources a').count()>0);
  if(width===390)await page.screenshot({path:path.join(out,'biology-phone.png')});
  await page.locator('#closeInfo').click();
 }

 // Species card and quizzes.
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-tree-go="Passeriformes"]').click();await page.locator('.drill-row[data-tree-go="Paridae"]').click();
 await page.locator('[data-tree-detail="great-tit"]').click();assert.equal(await page.locator('#infoDialog').evaluate(d=>d.open),true);assert.match(await page.locator('#infoTitle').innerText(),/Большая синица/);await page.locator('#closeInfo').click();
 await page.locator('.drill-branch-test').click();assert.match(await page.locator('#treeQuizCount').innerText(),/\/ 10$/);assert.equal(await page.locator('[data-tree-answer]').count(),6);await page.locator('#closeTreeQuiz').click();
 await page.selectOption('#language','latin');await page.locator('[data-tree-test="great-tit"]').click();assert.equal(await page.locator('[data-tree-answer]').count(),6);assert.match(await page.locator('[data-tree-answer="great-tit"]').innerText(),/Парус майор/);
 await page.locator('[data-tree-answer]:not([data-tree-answer="great-tit"])').first().click();assert.equal(await page.locator('[data-tree-answer]:visible').count(),1);assert.equal(await page.locator('[data-tree-answer="great-tit"]').isVisible(),true);assert.match(await page.locator('#treeQuiz').innerText(),/Типичный биотоп/);await page.locator('#closeTreeQuiz').click();
 assert.equal(await hero(),'Синицевые','closing a quiz keeps the current level');

 // Catalog view shares the same data.
 await page.locator('#catalogView').click();assert.equal(await page.locator('#treeBoard').isHidden(),true);await page.locator('#search').fill('Буроголовая');assert.equal(await page.locator('.bird-tile').count(),1);assert.ok((await page.locator('.bird-tile').innerText()).includes(await page.evaluate(()=>window.BIRD_DATA.find(b=>b.latin==='Poecile montanus').ru)));
 await page.locator('#treeView').click();assert.equal(await page.locator('#treeBoard').isVisible(),true);

 // Every answer label in every language keeps its words whole (a break after a hyphen is fine).
 for(const width of [320,390,430,480,560,561,760,1024]){
  await page.setViewportSize({width,height:900});
  const split=await page.evaluate(()=>{const C=window.BirdStudy,bad=[];
   for(const [dialog,box,attr] of [['treeQuiz','treeQuizChoices','data-tree-answer'],['cardDialog','answerChoices','data-answer']]){
    const d=document.getElementById(dialog),c=document.getElementById(box),opened=!d.open;if(opened)d.showModal();const saved=c.innerHTML;
    for(const lang of ['ru','en','pl','latin']){
     c.innerHTML=window.BIRD_DATA.map(b=>'<button '+attr+'="'+b.id+'"'+(lang==='latin'?' class="latin"':'')+'>'+(lang==='latin'?C.latinLabel(b.latin):b[lang])+'</button>').join('');
     for(const t of [...c.querySelectorAll('button')].map(e=>e.firstChild)){const s=t.textContent,re=/\S+/g;let m;
      while((m=re.exec(s))){let top=null;for(let i=m.index;i<m.index+m[0].length;i++){const r=document.createRange();r.setStart(t,i);r.setEnd(t,i+1);const rc=r.getClientRects()[0];if(!rc)continue;if(top!==null&&rc.top>top+2&&!/[-‑]/.test(s[i-1])){bad.push(dialog+' '+lang+': '+m[0]);break;}top=rc.top;}}}
    }
    c.innerHTML=saved;if(opened)d.close();
   }
   return bad;});
  assert.deepEqual(split.slice(0,5),[],'answer words split mid-word at '+width+'px ('+split.length+')');
 }

 assert.deepEqual(errors,[]);console.log('BROWSER: drill-down tree, history, filters, cards, quizzes, catalog, answer wrapping and layouts at 320-1440px passed');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
