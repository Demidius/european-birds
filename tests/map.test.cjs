// Zoomable tree diagram: branches as pills joined by arrows, families with genera and species, shared filters and study.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function fixture(){
 const dom=new JSDOM(read('study.html'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.localStorage.setItem('europeanBirds:filters',JSON.stringify({typicalPoland:false,onlyPoland:false}));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
 w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};
 for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','data-poland-additions.js','study-data.js','data-biology.js','biology.js','app.js','study-tree.js','species-board.js','tree-map.js'])w.eval(read(f));
 const M=d.getElementById('treeMap'),$=s=>M.querySelector(s),$$=s=>[...M.querySelectorAll(s)];
 const count=(n,rank)=>(n.rank===rank?1:0)+(n.children||[]).reduce((a,c)=>a+count(c,rank),0);
 return {w,d,M,$,$$,count,close:()=>w.close()};
}
test('Map tab draws every branch down to families, with genera and species listed underneath',()=>{
 const f=fixture(),{w,d,M,$,$$,count}=f;try{
  assert.equal(M.hidden,true);assert.equal(M.innerHTML,'','the map is built only when opened');
  d.getElementById('mapView').click();assert.equal(M.hidden,false);assert.equal(d.getElementById('treeBoard').hidden,true);
  assert.equal(d.getElementById('mapView').getAttribute('aria-pressed'),'true');assert.equal(w.localStorage.getItem('europeanBirds:view'),'map');
  const T=w.STUDY_TREE,branches=1+count(T,'order')+count(T,'group')+count(T,'family');
  assert.equal($$('.tm-node').length,branches);assert.equal($$('.tm-family').length,count(T,'family'));
  assert.equal($$('.tm-genus').length,count(T,'genus'));assert.equal($$('.tm-sp').length,w.BIRD_DATA.length);
  assert.equal($$('.tm-arrow').length,branches-1,'one arrow into every branch below the root');
  assert.match($('.tm-focus').textContent,/Птицы Европы/);assert.equal($('[data-tm="up"]').disabled,true);
  const fam=n=>Number($('[data-map="'+n+'"] .tm-name').getAttribute('font-size')),parent=Number($('[data-map="Passeriformes"] .tm-name').getAttribute('font-size'));
  assert.ok(fam('Muscicapidae')>fam('Paridae'),'bigger families are drawn bigger');assert.ok(fam('Passeri')<parent,'every level is smaller than its parent');
 }finally{f.close();}
});
test('Tapping a branch zooms into it; species open their card; study runs on the focused branch',()=>{
 const f=fixture(),{w,d,$}=f;try{
  d.getElementById('mapView').click();const k0=w.BirdMap.view.k;
  $('[data-map="Paridae"] .tm-pill').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  assert.equal(w.BirdMap.focusId,'Paridae');assert.ok(w.BirdMap.view.k>k0*3,'the family fills the screen');
  assert.match($('.tm-focus').textContent,/Синицевые/);assert.equal($('[data-tm="up"]').disabled,false);
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
  assert.ok(d.body.classList.contains('map-view'),'the page Poland chips are hidden on the map');
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
  d.getElementById('treeView').click();assert.equal(d.body.classList.contains('map-view'),false);
 }finally{f.close();}
});
