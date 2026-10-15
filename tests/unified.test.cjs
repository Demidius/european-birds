const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
function fixture(){const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../study.html'),'utf8'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','study-data.js','app.js','study-tree.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
return {w,d:w.document,close:()=>w.close()};}
test('All taxonomy species share learning cards; filters, languages, branch tests and progress work',()=>{
const {w,d,close}=fixture();try{
assert.equal(d.querySelectorAll('.rank-family').length,43);assert.equal(d.querySelectorAll('.rank-genus').length,157);
const ids=[];function walk(n){if(n.rank==='species')ids.push(n.birdId);(n.children||[]).forEach(walk)}walk(w.PASSERINE_TREE.root);
assert.equal(new Set(ids).size,423);assert.ok(ids.every(id=>w.BIRD_DATA.some(b=>b.id===id)));
assert.equal(d.querySelectorAll('.tree-species').length,w.BIRD_DATA.length);assert.equal(w.BIRD_DATA.length,436);
for(const lang of ['ru','en','la','pl'])assert.equal(d.querySelectorAll('.tree-names [lang='+lang+']').length,436);
const search=d.getElementById('treeSearch');search.value='Paridae';search.dispatchEvent(new w.Event('input'));
assert.equal(d.querySelectorAll('.tree-species').length,10);assert.equal(d.getElementById('newCount').textContent,'10');
d.getElementById('language').value='pl';d.getElementById('language').dispatchEvent(new w.Event('change'));
const answer=w.BIRD_DATA.find(b=>b.id===ids.find(id=>d.querySelector('[data-tree-species="'+id+'"]')));
d.querySelector('[data-test-branch="Paridae"]').click();assert.equal(d.getElementById('treeQuiz').open,true);assert.equal(d.querySelectorAll('[data-tree-answer]').length,6);
const q=d.querySelector('#treeQuizMedia img'),current=w.BIRD_DATA.find(b=>b.photos.some(p=>p.src===q.getAttribute('src')));
assert.ok(current);assert.ok(d.getElementById('treeQuizCount').textContent.endsWith('/ 10'));
const correct=d.querySelector('[data-tree-answer="'+current.id+'"]');assert.equal(correct.textContent,current.pl);correct.click();assert.equal(w.BirdAtlas.state(current.id).level,1);assert.equal(d.querySelector('[data-tree-species="'+current.id+'"] .tree-level strong').textContent,'1 / 10');correct.click();assert.equal(w.BirdAtlas.state(current.id).reps,1);
d.getElementById('closeTreeQuiz').click();search.value='';search.dispatchEvent(new w.Event('input'));
d.getElementById('onlyPoland').checked=true;d.getElementById('onlyPoland').dispatchEvent(new w.Event('change'));const polandCount=d.querySelectorAll('.tree-species').length;assert.ok(polandCount>100&&polandCount<423);
d.getElementById('polandWinter').checked=true;d.getElementById('polandWinter').dispatchEvent(new w.Event('change'));assert.ok(d.querySelectorAll('.tree-species').length<polandCount);
search.value='no such bird';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.tree-species').length,0);assert.equal(d.getElementById('learnBtn').disabled,true);
}finally{close()}});
