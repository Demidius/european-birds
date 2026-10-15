// Species board: group columns, family dividers, genus cards with a segment per species, shared filters and study.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function fixture(){
 const dom=new JSDOM(read('study.html'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.localStorage.setItem('europeanBirds:filters',JSON.stringify({typicalPoland:false,onlyPoland:false}));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
 w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};
 for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','study-data.js','data-biology.js','biology.js','app.js','study-tree.js','species-board.js'])w.eval(read(f));
 const B=d.getElementById('speciesBoard'),$=s=>B.querySelector(s),$$=s=>[...B.querySelectorAll(s)];
 return {w,d,B,$,$$,close:()=>w.close()};
}
test('Board tab shows group columns, family dividers and every genus once',()=>{
 const f=fixture(),{w,d,B,$,$$}=f;try{
  assert.equal(B.hidden,true);assert.equal(B.innerHTML,'','the board is built only when opened');
  d.getElementById('boardView').click();assert.equal(B.hidden,false);assert.equal(d.getElementById('treeBoard').hidden,true);
  assert.equal(d.getElementById('boardView').getAttribute('aria-pressed'),'true');
  assert.deepEqual($$('.sb-head h3').map(h=>h.textContent),['Враноподобные','Славкоподобные','Мухоловкоподобные','Воробьиная клада','Неворобьиные','Кричащие воробьинообразные'],'vagrant-only group goes last');
  assert.equal($$('.sb-card').length,168);assert.equal($$('.sb-fam').length,51);assert.equal($$('.sb-bar i').length,435);
  assert.match($('.sb-stat').textContent,/выучено 0 из \d+ видов/);
  const parus=$('[data-sb-genus="Parus"]');assert.match(parus.textContent,/Большие синицы/);assert.match(parus.textContent,/PL 1/);assert.match(parus.textContent,/0\/1 · 0%/);
  assert.equal($$('.sb-col.on').length,1,'one column is active for phones');
  assert.equal(w.localStorage.getItem('europeanBirds:view'),'board');
 }finally{f.close();}
});
test('Genus and family study open cards; grades repaint the card',()=>{
 const f=fixture(),{w,d,$,$$}=f;try{
  d.getElementById('boardView').click();
  $('[data-sb-study="Parus"]').click();assert.equal(d.getElementById('cardDialog').open,true);assert.match(d.getElementById('sessionCount').textContent,/Большие синицы · Parus/);
  d.querySelector('#cardBody [data-act="flip"]').click();d.querySelector('#cardBody [data-grade="good"]').click();d.getElementById('closeCard').click();
  const card=$('[data-sb-genus="Parus"]');assert.equal(card.dataset.status,'learning');assert.equal(card.querySelectorAll('.sb-bar i.learning').length,1);assert.match(card.textContent,/изучаю/);assert.match(card.textContent,/0\/1 · 20%/);
  $('[data-sb-study="Paridae"]').click();assert.match(d.getElementById('sessionCount').textContent,/Синицевые/);assert.match(d.querySelector('#cardBody .fc-meta').textContent,/осталось 9/,'the great tit waits for its date');
  d.getElementById('closeCard').click();
 }finally{f.close();}
});
test('Genus opens its species; filters and status chips narrow the board',()=>{
 const f=fixture(),{w,d,$,$$}=f;try{
  d.getElementById('boardView').click();
  $('[data-sb-toggle="Cyanistes"]').click();const card=$('[data-sb-genus="Cyanistes"]');assert.ok(card.classList.contains('open'));
  assert.equal(card.querySelectorAll('.drill-species').length,3);assert.ok(card.querySelector('[data-tree-species="blue-tit"] [lang=pl]'));
  card.querySelector('[data-tree-detail="blue-tit"]').click();assert.equal(d.getElementById('infoDialog').open,true);d.getElementById('closeInfo').click();
  $('[data-sb-toggle="Cyanistes"]').click();assert.equal($('[data-sb-genus="Cyanistes"] .drill-species'),null);
  d.getElementById('onlyPoland').checked=true;d.getElementById('onlyPoland').dispatchEvent(new w.Event('change'));
  assert.ok(!$$('.sb-head h3').some(h=>/Кричащие/.test(h.textContent)),'no Poland species among tyrant flycatchers');assert.equal($$('.sb-bar i').length,196);
  d.getElementById('onlyPoland').checked=false;d.getElementById('onlyPoland').dispatchEvent(new w.Event('change'));
  d.getElementById('treeSearch').value='Parus major';d.getElementById('treeSearch').dispatchEvent(new w.Event('input'));
  assert.equal($$('.sb-card').length,1);assert.equal($$('.sb-col').length,1);
  d.getElementById('treeSearch').value='';d.getElementById('treeSearch').dispatchEvent(new w.Event('input'));
  $('[data-sb-filter="new"]').click();assert.ok($('.sb-grid').classList.contains('filtered'));assert.equal($('.sb-grid').dataset.filter,'new');assert.equal($('[data-sb-filter="new"]').getAttribute('aria-pressed'),'true');
 }finally{f.close();}
});
test('Arrows and group chips switch the active column',()=>{
 const f=fixture(),{w,d,$,$$}=f;try{
  d.getElementById('boardView').click();const on=()=>$('.sb-col.on').dataset.sbColumn;
  assert.equal(on(),'Corvides');$('.sb-col.on [data-sb-step="1"]').click();assert.equal(on(),'Sylviida');
  $('.sb-col.on [data-sb-step="-1"]').click();$('.sb-col.on [data-sb-step="-1"]').click();assert.equal(on(),'Tyranni','wraps around');
  $('[data-sb-col="Passerida"]').click();assert.equal(on(),'Passerida');assert.equal($('[data-sb-col="Passerida"]').getAttribute('aria-pressed'),'true');
  assert.equal(w.localStorage.getItem('europeanBirds:boardColumn'),'Passerida');
  d.getElementById('treeView').click();assert.equal(d.getElementById('speciesBoard').hidden,true);assert.equal(d.getElementById('treeBoard').hidden,false);
 }finally{f.close();}
});
