const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const canonical=name=>name.replace(/ forma urbana$/,'').replace(/^Corvus cornix$/,'Corvus corone');
function data(imported=true){const w={window:{}};for(const f of ['data-birds.js','data-passerines.js','data-regions.js','data-photos.js',...(imported?['data-poland-additions.js']:[]),'study-data.js'])vm.runInNewContext(read(f),w);return w.window;}
function fixture(){
 const dom=new JSDOM(read('study.html'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLMediaElement.prototype.pause=function(){};
 w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};
 for(const script of d.querySelectorAll('script[src]'))w.eval(read(script.getAttribute('src').split('?')[0]));
 return {w,d,close:()=>w.close()};
}
test('All 475 document species occur exactly once, adding 278 with a Wikipedia photo and retaining old identities',()=>{
 const w=data(),old=data(false),doc=JSON.parse(read('sources/poland-document-20261016.json'));
 assert.equal(w.BIRD_DATA.length,713);assert.equal(w.POLAND_ADDITIONS.records.length,278);assert.equal(w.POLAND_ADDITIONS.existingCount,197);
 const byLatin=new Map(w.BIRD_DATA.map(b=>[b.latin,b]));assert.equal(byLatin.size,713);
 const nodes=[],parents=new Map();(function walk(n){nodes.push(n);for(const c of n.children||[]){parents.set(c.id,n);walk(c);}})(w.STUDY_TREE);
 const species=nodes.filter(n=>n.rank==='species');assert.equal(species.length,713);assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
 assert.equal(new Set(species.map(n=>n.birdId)).size,713);
 for(const row of doc.records){const b=byLatin.get(canonical(row.latin));assert.ok(b,row.latin);assert.equal(species.filter(n=>n.birdId===b.id).length,1);}
 for(const row of w.POLAND_ADDITIONS.records){
  const b=byLatin.get(row.latin);assert.equal(b.photos.length,1);assert.equal(b.photos[0].provider,'Wikimedia Commons');assert.equal(b.photos[0].taxonName,row.latin);assert.ok(b.photos[0].author&&b.photos[0].license&&/^https:\/\/commons\.wikimedia\.org\//.test(b.photos[0].source));assert.equal(b.audio.length,0);assert.ok(!b.tip.includes('пока не добавлена'));assert.equal(b.importSource,doc.source);
  const genus=parents.get(b.treeId),family=parents.get(genus.id);assert.equal(genus.latin,row.genus);assert.equal(family.latin,row.family);
  assert.equal(w.BirdTaxonomy.region(b).category,row.category);
 }
 for(const b of old.BIRD_DATA){const retained=byLatin.get(b.latin);assert.equal(retained.id,b.id);assert.equal(JSON.stringify(retained.photos),JSON.stringify(b.photos));assert.equal(JSON.stringify(retained.audio),JSON.stringify(b.audio));assert.equal(retained.ru,b.ru);}
 assert.equal(byLatin.get('Columba livia').id,'rock-dove');
 assert.equal(byLatin.get('Corvus corone').id,'hooded-crow');
 assert.equal(w.BirdTaxonomy.region(byLatin.get('Mergus serrator')).seasons.breeding,false,'former breeding is not current breeding');
 assert.equal(w.BirdTaxonomy.region(byLatin.get('Clangula hyemalis')).seasons.winter,null,'passage does not establish wintering');
});
test('Species from the Polish list appear across views with Wikipedia photos and study in every mode with media; Poland excludes historical records',()=>{
 const {w,d,close}=fixture();try{
  const find=q=>{d.getElementById('treeSearch').value=q;d.getElementById('treeSearch').dispatchEvent(new w.Event('input'));};
  const change=id=>d.getElementById(id).dispatchEvent(new w.Event('change'));
  find('Columba livia forma urbana');assert.equal(d.querySelectorAll('.drill-species').length,1);assert.ok(d.querySelector('[data-tree-species="rock-dove"]'));
  find('Ciconia ciconia');const row=d.querySelector('[data-tree-species="Ciconia_ciconia"]');assert.ok(row);assert.ok(row.querySelector('img'));assert.equal(row.querySelector('[data-tree-test]').disabled,false);
  assert.equal(d.getElementById('newCount').textContent,'1');assert.equal(d.getElementById('learnBtn').disabled,false);
  d.querySelector('[data-tree-detail="Ciconia_ciconia"]').click();assert.ok(d.getElementById('infoBody').textContent.includes('гнездится'));assert.ok(d.querySelector('#infoBody img'));assert.equal(d.querySelector('[data-start-bird]').disabled,false);d.getElementById('closeInfo').click();
  d.getElementById('catalogView').click();assert.equal(d.querySelectorAll('.bird-tile').length,1);assert.ok(d.querySelector('.bird-tile img'));
  d.getElementById('learnBtn').click();assert.equal(d.getElementById('cardDialog').open,true);assert.ok(d.querySelector('#cardBody .fc-front img'));d.querySelector('[data-act="flip"]').click();assert.match(d.getElementById('cardBody').textContent,/Ciconia ciconia/);assert.match(d.getElementById('cardBody').textContent,/Wikimedia|Источник/);
  d.querySelector('[data-grade="good"]').click();d.getElementById('closeCard').click();assert.equal(w.BirdAtlas.state('Ciconia_ciconia').level,2);
  find('');d.getElementById('onlyPoland').checked=false;change('onlyPoland');
  assert.equal(d.querySelectorAll('.bird-tile').length,713);assert.equal(d.getElementById('newCount').textContent,'712');
  find('Lagopus lagopus');assert.equal(d.querySelectorAll('.bird-tile').length,1);
  d.getElementById('onlyPoland').checked=true;change('onlyPoland');assert.equal(d.querySelectorAll('.bird-tile').length,0);
  find('');assert.equal(d.querySelectorAll('.bird-tile').length,471);
  d.getElementById('typicalPoland').checked=true;change('typicalPoland');assert.equal(d.querySelectorAll('.bird-tile').length,285);
 }finally{close();}
});
