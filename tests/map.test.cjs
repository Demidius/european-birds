// Zoomable tree diagram: branches as pills joined by arrows, one size and colour per rank, families with genera and species, filters and study.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function fixture(){
 const dom=new JSDOM(read('study.html'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.localStorage.setItem('europeanBirds:filters',JSON.stringify({typicalPoland:false,onlyPoland:false}));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
 w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};
 for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','data-poland-additions.js','study-data.js','data-biology.js','biology.js','app.js','study-tree.js','tree-map.js'])w.eval(read(f));
 const M=d.getElementById('treeMap'),$=s=>M.querySelector(s),$$=s=>[...M.querySelectorAll(s)];
 const count=(n,rank)=>(n.rank===rank?1:0)+(n.children||[]).reduce((a,c)=>a+count(c,rank),0);
 return {w,d,M,$,$$,count,close:()=>w.close()};
}
test('Map tab draws every branch down to families, with genera and species listed underneath',()=>{
 const f=fixture(),{w,d,M,$,$$,count}=f;try{
  assert.equal(M.hidden,true);assert.equal(M.innerHTML,'','the map is built only when opened');
  d.getElementById('mapView').click();assert.equal(M.hidden,false);assert.ok(M.classList.contains('tm-full'),'the map opens over the page');assert.equal(d.getElementById('treeBoard').hidden,false,'the page view stays underneath');
  assert.equal(d.getElementById('mapView').getAttribute('aria-pressed'),'true');assert.notEqual(w.localStorage.getItem('europeanBirds:view'),'map','the map is not a page view');
  const T=w.STUDY_TREE,branches=1+count(T,'order')+count(T,'group')+count(T,'family');
  assert.equal($$('.tm-node').length,branches);assert.equal($$('.tm-family').length,count(T,'family'));
  assert.equal($$('.tm-genus').length,count(T,'genus'));assert.equal($$('.tm-sp').length,w.BIRD_DATA.length);
  assert.equal($$('.tm-arrow').length,branches-1,'one arrow into every branch below the root');
  assert.match($('.tm-focus').textContent,/Птицы Европы/);assert.equal($('[data-tm="up"]').disabled,true);
  const size=n=>Number($('[data-map="'+n+'"] .tm-name').getAttribute('font-size'));
  assert.equal(size('Muscicapidae'),size('Paridae'),'every family has one size, whatever its species count');assert.equal(size('Passeriformes'),size('Anseriformes'),'every order has one size');
  assert.deepEqual(['Tyranni','Passeri','Corvides','Passerides','Sylviida','Muscicapida','Passerida'].map(n=>$('[data-map="'+n+'"]').dataset.rank),['suborder','suborder','infraorder','infraorder','parvorder','parvorder','parvorder']);
  const ranks=['class','order','suborder','infraorder','parvorder','family'],sizes=ranks.map(r=>[...new Set($$('[data-rank="'+r+'"] .tm-name').map(t=>t.getAttribute('font-size')))]);
  sizes.forEach((v,i)=>assert.equal(v.length,1,'one size for rank '+ranks[i]));sizes.slice(1).forEach((v,i)=>assert.ok(Number(v[0])<Number(sizes[i][0]),ranks[i+1]+' is smaller than '+ranks[i]));
  for(const r of ranks)assert.ok($$('[data-rank="'+r+'"]').every(g=>g.classList.contains('tm-r-'+r)),'rank colour class for '+r);
  assert.deepEqual($$('.tm-legend li').map(l=>l.textContent),['Класс','Отряд','Подотряд','Инфраотряд','Парвотряд','Семейство','Род','Вид']);
 }finally{f.close();}
});
test('Tapping a branch zooms into it; species open their card; study runs on the focused branch',()=>{
 const f=fixture(),{w,d,$}=f;try{
  d.getElementById('mapView').click();const k0=w.BirdMap.view.k;
  $('[data-map="Paridae"] .tm-pill').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  assert.equal(w.BirdMap.focusId,'Paridae');assert.ok(w.BirdMap.view.k>k0*3,'the family fills the screen');
  assert.match($('.tm-focus').textContent,/Синицевые/);assert.match($('.tm-focus em').textContent,/^Семейство · Paridae/);assert.equal($('[data-tm="up"]').disabled,false);
  $('[data-tm="study"]').click();assert.equal(d.getElementById('cardDialog').open,true);assert.match(d.getElementById('sessionCount').textContent,/Синицевые/);d.getElementById('closeCard').click();
  $('[data-map-sp="great-tit"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal(d.getElementById('infoDialog').open,true);assert.match(d.getElementById('infoTitle').textContent,/Большая синица/);d.getElementById('closeInfo').click();
  $('[data-map="Parus"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.match($('.tm-focus').textContent,/Parus/);
  $('[data-tm="up"]').click();assert.equal(w.BirdMap.focusId,'Paridae');$('[data-tm="all"]').click();assert.equal(w.BirdMap.view.k,k0);
  const k=w.BirdMap.view.k;$('[data-tm="in"]').click();assert.ok(w.BirdMap.view.k>k);
 }finally{f.close();}
});
test('The map shows every species; its own check boxes keep Polish species and passerines; progress colours the dots',()=>{
 const f=fixture(),{w,d,$,$$}=f;try{
  d.getElementById('typicalPoland').checked=true;d.getElementById('typicalPoland').dispatchEvent(new w.Event('change'));
  d.getElementById('mapView').click();assert.equal($$('.tm-sp').length,w.BIRD_DATA.length,'the page Poland filter does not cut the map');
  w.BirdAtlas.study(['great-tit'],'Большая синица');d.querySelector('#cardBody [data-act="flip"]').click();d.querySelector('#cardBody [data-grade="good"]').click();d.getElementById('closeCard').click();
  assert.equal($('[data-map-sp="great-tit"] .tm-dot').getAttribute('class'),'tm-dot learning');
  const X=w.BirdTaxonomy,all=[];(function walk(n,p){if(n.rank==='species')all.push({n,p});(n.children||[]).forEach(c=>walk(c,p||n.latin==='Passeriformes'));})(w.STUDY_TREE,false);
  const polish=all.filter(x=>{const r=X.region(x.n);return r&&['A','C'].includes(r.category);});
  const tick=k=>{const c=$('[data-mf="'+k+'"]');c.checked=!c.checked;c.dispatchEvent(new w.Event('change',{bubbles:true}));};
  tick('poland');assert.equal($$('.tm-sp').length,polish.length);assert.equal($('[data-map="Tyranni"]'),null);assert.ok($('[data-map="Anatidae"]'),'other orders stay');
  tick('passer');assert.equal($$('.tm-sp').length,polish.filter(x=>x.p).length,'all Polish passerines');assert.equal($('[data-map="Anatidae"]'),null);assert.ok($('[data-map="Paridae"]'));
  assert.equal(JSON.stringify(w.BirdMap.filters),'{"poland":true,"passer":true}');assert.deepEqual(JSON.parse(w.localStorage.getItem('europeanBirds:mapFilters')),{poland:true,passer:true});
  tick('poland');assert.equal($$('.tm-sp').length,all.filter(x=>x.p).length,'all passerines on the site');tick('passer');assert.equal($$('.tm-sp').length,w.BIRD_DATA.length);
  d.getElementById('treeSearch').value='Parus major';d.getElementById('treeSearch').dispatchEvent(new w.Event('input'));
  assert.equal($$('.tm-sp').length,1);assert.equal($$('.tm-family').length,1);
  d.getElementById('treeSearch').value='zzzz';d.getElementById('treeSearch').dispatchEvent(new w.Event('input'));assert.equal($('.tm-empty').hidden,false);
  $('[data-tm-close]').click();assert.equal(f.M.hidden,true);
 }finally{f.close();}
});
test('The map lives only behind the «Схема» button: it opens on the whole screen, × or Esc closes it',()=>{
 const f=fixture(),{w,d,M,$}=f;try{
  assert.equal(M.hidden,true);const tree=d.getElementById('treeBoard');assert.equal(tree.hidden,false);
  w.localStorage.setItem('europeanBirds:view','map');
  let asked=0;M.requestFullscreen=()=>{asked++;return Promise.reject(new Error('not allowed'));};
  d.getElementById('mapView').click();assert.equal(asked,1,'asks the browser for full screen');assert.equal(M.hidden,false);assert.ok(M.classList.contains('tm-full'),'covers the window even if the browser refuses');
  assert.ok(d.documentElement.classList.contains('tm-full-page'),'the page underneath does not scroll');assert.equal(w.BirdMap.isOpen,true);assert.equal(tree.hidden,false);
  $('[data-map-sp="great-tit"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal(d.getElementById('infoDialog').open,true,'species cards open over the map');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(M.hidden,false,'Esc closes an open card first');d.getElementById('closeInfo').click();
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(M.hidden,true,'Esc closes the map');assert.equal(d.documentElement.classList.contains('tm-full-page'),false);
  assert.equal(d.getElementById('mapView').getAttribute('aria-pressed'),'false');
  d.getElementById('mapView').click();$('[data-map="Paridae"] .tm-pill').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  $('[data-tm-close]').click();assert.equal(M.hidden,true,'× closes the map');assert.equal(tree.hidden,false);
  d.getElementById('mapView').click();assert.equal(w.BirdMap.focusId,'Paridae','reopening keeps the last place');w.BirdMap.close();
  d.getElementById('catalogView').click();assert.equal(M.hidden,true);assert.equal(d.getElementById('catalogSection').hidden,false,'other tabs still switch the page');
 }finally{f.close();}
});
test('A page saved on the old map tab opens on the tree',()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','study.html'),'utf8'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 try{w.localStorage.setItem('europeanBirds:view','map');w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};
  for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','data-poland-additions.js','study-data.js','data-biology.js','biology.js','app.js','study-tree.js','tree-map.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
  assert.equal(d.getElementById('treeMap').hidden,true);assert.equal(d.getElementById('treeBoard').hidden,false);assert.equal(w.localStorage.getItem('europeanBirds:view'),'tree');
 }finally{w.close();}
});
