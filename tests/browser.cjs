// Real-browser coverage for the drill-down tree: layout, history, filters, cards, quizzes and catalog.
// Logic without layout is covered by tests/unified.test.cjs (jsdom). Remote photos are replaced
// with a local placeholder so the run does not depend on the network.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),http=require('http');
const LOCAL_CHROMIUM='/opt/pw-browsers/chromium';
(async()=>{
const root=path.resolve(__dirname,'..'),out=process.env.BIRD_QA_OUTPUT||path.resolve(root,'../bird-qa');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.webmanifest':'application/manifest+json'};
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
 await page.addInitScript(()=>{if(!localStorage.getItem('europeanBirds:filters'))localStorage.setItem('europeanBirds:filters',JSON.stringify({typicalPoland:false,onlyPoland:false}));});
 await page.goto(base+'/?offline=1');await page.waitForSelector('.drill-row');

 // Styles come from plain <link> tags; the old depth buttons are gone.
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/<link rel="stylesheet" href="study-tree-drill\.css\?v=[\w-]+">/);
 assert.equal(await page.locator('link[href^="study-tree-drill.css"]').count(),1,'drill CSS must be linked exactly once');
 assert.equal(await page.locator('.tree-depth, [data-depth]').count(),0);
 assert.equal(await page.locator('details.study-branch, .tree-species').count(),0,'no nested frames from the old tree');
 assert.equal(await page.locator('.drill-bar').evaluate(e=>getComputedStyle(e).position),'sticky');

 // Root level: orders only, nothing to go back to.
 assert.equal(await total(),713);assert.ok(await page.locator('.drill-row[data-tree-go="Passeriformes"]').count());
 assert.equal(await page.locator('.drill-back').isDisabled(),true);

 // Search by any of the four languages and by former names.
 for(const [query,latin] of [['Буроголовая','Poecile montanus'],['Common Chaffinch','Fringilla coelebs'],['Drozd śpiewak','Turdus philomelos'],['Corvus cornix','Corvus corone']]){
  await page.locator('#treeSearch').fill(query);const id=await idOf(latin);
  assert.equal(await page.locator('.drill-species').count(),1,query);assert.equal(await page.locator('[data-tree-species="'+id+'"]').count(),1,query);
  for(const lang of ['ru','la','pl'])assert.equal(await page.locator('.drill-species [lang='+lang+']').count(),1,query+' '+lang);
  assert.match(await page.locator('.drill-crumbs').innerText(),/Поиск/);
 }
 await page.locator('.drill-back').click();assert.equal(await page.locator('#treeSearch').inputValue(),'','Back clears the search');assert.equal(await total(),713);

 // Filters: vagrants, Poland and seasons. The chips open from one button; the count and the summary show what is on.
 assert.equal(await page.locator('#filterPanel').isHidden(),true);await page.locator('#filterToggle').click();assert.equal(await page.locator('#filterToggle').getAttribute('aria-expanded'),'true');
 await page.locator('#includeVagrants').uncheck();await page.locator('#treeSearch').fill('Ficedula parva');assert.equal(await page.locator('[data-tree-species="Ficedula_parva"]').count(),1);await page.locator('#treeSearch').fill('');
 await page.locator('#onlyPoland').check();assert.equal(await total(),471);
 for(const latin of ['Corvus corone','Anas platyrhynchos','Columba palumbus','Ardea cinerea']){await page.locator('#treeSearch').fill(latin);assert.equal(await page.locator('[data-tree-species="'+await idOf(latin)+'"]').count(),1,latin);}
 await page.locator('#treeSearch').fill('');
 await page.locator('#polandBreeding').check();const breeding=await total();assert.ok(breeding<471);
 await page.locator('#treeSearch').fill('Anas platyrhynchos');assert.equal(await page.locator('[data-tree-species="mallard"]').count(),1);await page.locator('#treeSearch').fill('');
 await page.locator('#polandWinter').check();assert.ok(await total()>=breeding,'seasons combine with OR');
 await page.locator('#onlyPoland').uncheck();assert.equal(await page.locator('#polandBreeding').isChecked(),false);assert.equal(await page.locator('#polandWinter').isChecked(),false);
 await page.locator('#includeVagrants').check();assert.equal(await total(),713);
 await page.locator('#onlyPoland').check();assert.equal(await page.locator('#includeVagrants').isDisabled(),true,'vagrants do not apply inside Poland');await page.locator('#filterToggle').click();
 assert.equal(await page.locator('#filterCount').innerText(),'1');assert.match(await page.locator('#filterSummary').innerText(),/Только Польша/);
 await page.locator('[data-filter-reset]').click();assert.equal(await total(),713);assert.equal(await page.locator('#filterCount').isHidden(),true);assert.equal(await page.locator('#filterSummary').isHidden(),true);

 // Imported birds are browsable without photos, and names can be studied immediately.
 await page.locator('#treeSearch').fill('Ciconia ciconia');assert.equal(await page.locator('.drill-species').count(),1,'a tautonym does not match the whole genus');
 assert.equal(await page.locator('[data-tree-species="Ciconia_ciconia"] img').count(),0);
 assert.equal(await page.locator('[data-tree-test="Ciconia_ciconia"]').isDisabled(),true);
 await page.locator('[data-tree-detail="Ciconia_ciconia"]').click();assert.match(await page.locator('#infoBody').innerText(),/гнездится/);
 assert.equal(await page.locator('#infoBody img').count(),0);assert.equal(await page.locator('[data-start-bird]').isDisabled(),true);await page.locator('#closeInfo').click();
 await page.locator('#catalogView').click();assert.equal(await page.locator('.bird-tile').count(),1);assert.match(await page.locator('.bird-tile').innerText(),/Без фото/);
 await page.locator('[data-mode="names"]').click();assert.equal(await page.locator('#newCount').innerText(),'1');
 await page.locator('#learnBtn').click();await page.locator('[data-act="flip"]').click();assert.match(await page.locator('#cardBody').innerText(),/Ciconia ciconia/);
 assert.equal(await page.locator('#cardBody img').count(),0);await page.locator('[data-grade="good"]').click();await page.locator('#closeCard').click();
 await page.locator('[data-mode="photo"]').click();await page.locator('#treeView').click();
 await page.locator('#treeSearch').fill('Columba livia forma urbana');assert.equal(await page.locator('.drill-species').count(),1);assert.equal(await page.locator('[data-tree-species="rock-dove"]').count(),1,'the urban form reuses the existing pigeon');
 await page.locator('#treeSearch').fill('Ciconia ciconia');
 for(const width of [390,1440]){await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'imported-stork-'+width+'.png')});}
 await page.locator('#treeSearch').fill('');

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
  assert.equal(await page.locator('[data-test-branch]').count(),1,'one study button per level at '+width);
  assert.ok((await page.locator('.drill-bar .drill-branch-test').boundingBox()).height>=44,'the branch study button is tappable at '+width);
  if(width===390){const img=page.locator('[data-tree-species="great-tit"] .drill-thumb img');await img.scrollIntoViewIfNeeded();if(await page.evaluate(()=>window.BirdTree.thumbs))assert.match(await img.getAttribute('src'),/^assets\/thumbs\//);assert.ok(await img.evaluate(i=>i.complete&&i.naturalWidth?i.naturalWidth:new Promise(r=>{i.onload=()=>r(i.naturalWidth);i.onerror=()=>r(0);})),'row thumbnails load');}
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
 // Anki-style cards from the tree: front, answer with every name, four grades with the next interval.
 await page.locator('.drill-branch-test').click();assert.equal(await page.locator('#cardDialog').evaluate(d=>d.open),true);assert.match(await page.locator('#sessionCount').innerText(),/Синицевые/);
 assert.match(await page.locator('.fc-meta').innerText(),/осталось 10/);assert.equal(await page.locator('.grades').isVisible(),false);await page.keyboard.press(' ');
 assert.equal(await page.locator('.grades').isVisible(),true);assert.deepEqual(await page.locator('.grade small').allInnerTexts(),['10 мин','12 ч','1 дн.','4 дн.']);
 await page.keyboard.press('3');assert.match(await page.locator('.fc-meta').innerText(),/осталось 9/);assert.match(await page.locator('.fc-meta').innerText(),/готово 1/);
 await page.locator('[data-act="undo"]').click();assert.equal(await page.locator('.fc-answer').isVisible(),true);await page.locator('#closeCard').click();
 await page.selectOption('#language','latin');await page.locator('[data-tree-test="great-tit"]').click();await page.locator('[data-act="kopen"]').click();
 await page.locator('#knownIn').fill('parus major');await page.locator('#knownIn').press('Enter');assert.equal(await page.locator('.kok-t').innerText(),'Засчитано');
 assert.equal(await page.evaluate(()=>window.BirdAtlas.state('great-tit').level),10);await page.locator('[data-act="knext"]').click();assert.ok(await page.locator('.fc-done').isVisible());await page.locator('[data-act="close"]').click();
 assert.equal(await page.locator('[data-tree-species="great-tit"] .drill-meter i.filled').count(),10,'the tree shows the new level');
 assert.equal(await hero(),'Синицевые','closing the cards keeps the current level');

 // Catalog view shares the same data.
 await page.locator('#catalogView').click();assert.equal(await page.locator('#treeBoard').isHidden(),true);await page.locator('#treeSearch').fill('Буроголовая');assert.equal(await page.locator('.bird-tile').count(),1);assert.ok((await page.locator('.bird-tile').innerText()).includes(await page.evaluate(()=>window.BIRD_DATA.find(b=>b.latin==='Poecile montanus').ru)));
 await page.locator('#treeSearch').fill('');await page.locator('#treeView').click();assert.equal(await page.locator('#treeBoard').isVisible(),true);

 // Card layout on phones and desktop: nothing overflows, grade buttons stay tappable and on one row (two rows at 320).
 for(const width of [320,390,760,1440]){
  await page.setViewportSize({width,height:844});await page.locator('[data-tree-test="blue-tit"]').click();
  await page.locator('.fc-front img').evaluate(i=>i.complete||new Promise(r=>{i.onload=i.onerror=r;}));
  const box=await page.locator('#cardDialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,'dialog fits at '+width);
  assert.ok(await page.locator('#cardDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1),'no sideways scroll at '+width);
  const show=await page.locator('[data-act="flip"]').boundingBox(),grades=await page.locator('.grades').boundingBox();assert.ok(Math.abs(show.height-grades.height)<=1,'the answer button covers the grades');
  if(width===390||width===1440)await page.screenshot({path:path.join(out,'card-front-'+width+'.png')});
  await page.locator('#cardDialog').evaluate(d=>{d.scrollTop=d.scrollHeight;});await page.locator('[data-act="flip"]').click();assert.equal(await page.locator('#cardDialog').evaluate(d=>d.scrollTop),0,'the answer opens from the top at '+width);const nameSizes=await page.locator('.fc-answer>h3, .fc-answer .bird-names dd').evaluateAll(d=>d.map(x=>getComputedStyle(x).fontSize));assert.equal(nameSizes.length,4);assert.equal(new Set(nameSizes).size,1,'all four names share one size at '+width);const g=await page.locator('.grade').evaluateAll(b=>b.map(x=>x.getBoundingClientRect()).map(r=>({h:r.height,top:Math.round(r.top)})));
  assert.ok(g.every(r=>r.h>=44),'grade buttons are tappable at '+width);assert.equal(new Set(g.map(r=>r.top)).size,width<=360?2:1,'grade rows at '+width);
  if(width===390||width===1440){await page.locator('.fc-actions').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'card-back-'+width+'.png')});}
  await page.locator('#closeCard').click();
 }

 // Species board: group columns, genus cards; one column at a time on phones, side by side on desktop.
 for(const width of [320,390,760,1440]){
  await page.setViewportSize({width,height:844});await page.locator('#boardView').click();assert.equal(await page.locator('#speciesBoard').isVisible(),true);assert.equal(await page.locator('#treeBoard').isHidden(),true);
  await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1,'Board overflow at '+width);
  const sb=await page.locator('#speciesBoard').boundingBox(),cw=await page.evaluate(()=>document.documentElement.clientWidth);assert.ok(Math.abs(sb.x)<=1&&Math.abs(sb.width-cw)<=1,'board spans the screen at '+width+': '+sb.x+' '+sb.width);
  const cols=await page.locator('.sb-col').evaluateAll(c=>c.filter(x=>x.getBoundingClientRect().height>0).map(x=>Math.round(x.getBoundingClientRect().top)));
  if(width<=760){assert.equal(cols.length,1,'one group per screen at '+width);const before=await page.locator('.sb-col.on h3').innerText();await page.locator('.sb-col.on [data-sb-step="1"]').click();assert.notEqual(await page.locator('.sb-col.on h3').innerText(),before);await page.locator('.sb-col.on [data-sb-step="-1"]').click();}
  else{assert.ok(cols.length>=2&&new Set(cols).size===1,'groups stand side by side at '+width);assert.ok(await page.locator('.sb-scroll').evaluate(e=>e.scrollWidth>e.clientWidth),'columns scroll sideways at '+width);}
  await page.locator('[data-sb-col="Sylviida"]').click();const card=await page.locator('[data-sb-genus="Parus"]').boundingBox(),btn=await page.locator('[data-sb-study="Parus"]').boundingBox();
  assert.ok(btn.height>=44&&btn.x+btn.width<=card.x+card.width+1,'genus study button fits and is tappable at '+width);
  if(width===390||width===1440){await page.locator('.sb-jump').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'board-'+width+'.png')});}
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-sb-toggle="Cyanistes"]').click();assert.equal(await page.locator('[data-sb-genus="Cyanistes"] .drill-species').count(),3);
 const open=await page.locator('[data-sb-genus="Cyanistes"]').boundingBox(),row=await page.locator('[data-sb-genus="Cyanistes"] [data-tree-test="blue-tit"]').boundingBox();assert.ok(row.x+row.width<=open.x+open.width+1,'species rows fit inside the genus card');
 await page.locator('[data-sb-study="Cyanistes"]').click();assert.equal(await page.locator('#cardDialog').evaluate(d=>d.open),true);assert.match(await page.locator('#sessionCount').innerText(),/Лазоревки/);await page.locator('#closeCard').click();
 await page.locator('#treeView').click();assert.equal(await page.locator('#speciesBoard').isHidden(),true);

 // Zoomable diagram: fits every width, drags, pinches, wheel-zooms; a tap zooms into a branch or opens a species.
 for(const width of [320,390,760,1440]){
  await page.setViewportSize({width,height:844});await page.locator('#mapView').click();await page.waitForSelector('.tm-node');assert.equal(await page.locator('#treeBoard').isHidden(),true);
  await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1,'Map overflow at '+width);
  const m=await page.locator('#treeMap').boundingBox(),cw=await page.evaluate(()=>document.documentElement.clientWidth);assert.ok(Math.abs(m.x)<=1&&Math.abs(m.width-cw)<=1,'map spans the screen at '+width);
  for(const b of await page.locator('#treeMap .tm-tools button, #treeMap .tm-filters .tf-chip').evaluateAll(x=>x.map(e=>e.getBoundingClientRect())))assert.ok(b.height>=44&&b.right<=width+1,'map tools and check boxes fit at '+width);
  assert.equal(await page.locator('#typicalPoland').isVisible(),false,'the page Poland chip is hidden on the map');
  await page.locator('[data-tm="all"]').click();await page.locator('.tm-view').evaluate(e=>e.scrollIntoView({block:'center'}));await page.waitForTimeout(550);
  if(width===390||width===1440)await page.screenshot({path:path.join(out,'map-'+width+'.png')});
 }
 // Check boxes: every species on the site, then Polish species, then Polish passerines only.
 const spCount=()=>page.locator('.tm-sp').count();assert.equal(await spCount(),713);
 await page.locator('.tm-filters .tf-chip').filter({hasText:'Только Польша'}).click();assert.equal(await spCount(),471);
 await page.locator('.tm-filters .tf-chip').filter({hasText:'Только воробьиные'}).click();assert.equal(await spCount(),185,'all Polish passerines');
 await page.locator('[data-tm="all"]').click();await page.waitForTimeout(550);await page.screenshot({path:path.join(out,'map-polish-passerines-1440.png')});
 await page.locator('.tm-filters .tf-chip').filter({hasText:'Только Польша'}).click();await page.locator('.tm-filters .tf-chip').filter({hasText:'Только воробьиные'}).click();assert.equal(await spCount(),713);
 const mv=()=>page.evaluate(()=>window.BirdMap.view),svgBox=await page.locator('.tm-svg').boundingBox(),mx=svgBox.x+svgBox.width/2,my=svgBox.y+svgBox.height/2,v0=await mv();
 await page.mouse.move(mx,my);await page.mouse.down();await page.mouse.move(mx+80,my+40,{steps:6});await page.mouse.up();
 let v=await mv();assert.ok(Math.abs(v.x-v0.x-80)<1&&Math.abs(v.y-v0.y-40)<1&&v.k===v0.k,'drag pans the map');
 await page.mouse.wheel(0,-400);v=await mv();assert.ok(v.k>v0.k*1.5,'wheel zooms in');
 await page.setViewportSize({width:390,height:844});await page.locator('[data-tm="all"]').click();await page.waitForTimeout(550);
 const sb=await page.locator('.tm-svg').boundingBox(),px=sb.x+sb.width/2,py=sb.y+sb.height/2,k1=(await mv()).k,cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:px-30,y:py,id:1},{x:px+30,y:py,id:2}]});
 for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px-30-i*15,y:py,id:1},{x:px+30+i*15,y:py,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await mv()).k>k1*3,'pinch zooms in');await cdp.detach();
 await page.locator('[data-tm="all"]').click();await page.waitForTimeout(550);
 const pill=await page.locator('[data-map="Paridae"] .tm-pill').boundingBox();await page.mouse.click(pill.x+pill.width/2,pill.y+pill.height/2);await page.waitForTimeout(650);
 assert.equal(await page.evaluate(()=>window.BirdMap.focusId),'Paridae');const big=await page.locator('[data-map="Paridae"] .tm-pill').boundingBox();assert.ok(big.width>sb.width*0.5,'the tapped family fills the screen');
 assert.match(await page.locator('.tm-focus').innerText(),/Синицевые/);await page.screenshot({path:path.join(out,'map-paridae-390.png')});
 const spRow=await page.locator('[data-map-sp="great-tit"] .tm-hit').boundingBox();await page.mouse.click(spRow.x+spRow.width/2,spRow.y+spRow.height/2);
 assert.equal(await page.locator('#infoDialog').evaluate(d=>d.open),true);assert.match(await page.locator('#infoTitle').innerText(),/Большая синица/);await page.locator('#closeInfo').click();
 await page.locator('#treeView').click();assert.equal(await page.locator('#treeMap').isHidden(),true);

 // Links to #treeBoard land on the view switch and the search above the tree.
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/study.html?offline=1#treeBoard');await page.waitForSelector('.drill-row');await page.waitForLoadState('load');await page.waitForTimeout(150);
 const lead=await page.evaluate(()=>({views:document.querySelector('.board-views').getBoundingClientRect().top,search:document.getElementById('treeSearch').getBoundingClientRect().top}));
 assert.ok(lead.views>=0&&lead.views<40&&lead.search>0&&lead.search<200,'#treeBoard shows the view switch and the search: '+JSON.stringify(lead));
 await page.screenshot({path:path.join(out,'tree-anchor-390.png')});
 // A new visitor starts with regular Polish species; compact controls keep the board in reach.
 const polish=await browser.newPage();polish.on('pageerror',e=>errors.push(e.message));
 await polish.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/,r=>r.abort());
 await polish.goto(base+'/study.html?offline=1');await polish.waitForSelector('.drill-row');
 assert.equal(await polish.locator('#typicalPoland').isChecked(),true);
 assert.equal(await polish.locator('#newCount').innerText(),'120');
 for(const width of [320,390,760,1440]){
  await polish.setViewportSize({width,height:844});await polish.evaluate(()=>document.fonts.ready);
  const lead=await polish.locator('.board-views').evaluate(e=>e.getBoundingClientRect().top+scrollY);
  assert.ok(lead<(width===320?440:width<=760?390:325),'compact page lead at '+width+': '+lead);
  assert.ok(await polish.evaluate(()=>document.documentElement.scrollWidth)<=width+1);
  for(const id of ['learnBtn','reviewBtn']){
   const button=await polish.locator('#'+id).boundingBox();assert.ok(button.height>=44);
   assert.ok(button.x>=0&&button.x+button.width<=width,'study action fits at '+width);
  }
 }
 await polish.locator('#catalogView').click();assert.equal(await polish.locator('input[type=search]:visible').count(),1);
 await polish.locator('#treeSearch').fill('Paridae');assert.equal(await polish.locator('.bird-tile').count(),6);
 await polish.locator('#treeSearch').fill('');await polish.locator('#typicalPoland').uncheck();
 assert.equal(await polish.locator('#newCount').innerText(),'196');await polish.reload();
 assert.equal(await polish.locator('#typicalPoland').isChecked(),false);assert.equal(await polish.locator('#newCount').innerText(),'196');
 await polish.close();
 assert.deepEqual(errors,[]);console.log('BROWSER: drill-down tree, history, filters, species cards, Anki sessions, catalog, species board, zoomable map and layouts at 320-1440px passed');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
