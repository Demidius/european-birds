const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
function fixture(progress){const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../study.html'),'utf8'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
if(progress)w.localStorage.setItem('europeanBirds:v1:progress:guest',JSON.stringify(progress));
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','study-data.js','app.js','study-tree.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
return {w,d:w.document,close:()=>w.close()};}
test('All taxonomy species share learning cards; filters, languages, branch tests and progress work',()=>{
const {w,d,close}=fixture();try{
assert.equal(d.querySelectorAll('.rank-family').length,51);assert.equal(d.querySelectorAll('.rank-genus').length,168);
const ids=[];function walk(n){if(n.rank==='species')ids.push(n.birdId);(n.children||[]).forEach(walk)}walk(w.PASSERINE_TREE.root);
assert.equal(new Set(ids).size,423);assert.ok(ids.every(id=>w.BIRD_DATA.some(b=>b.id===id)));
assert.equal(d.querySelectorAll('.tree-species').length,w.BIRD_DATA.length);assert.equal(w.BIRD_DATA.length,435);
for(const lang of ['ru','en','la','pl'])assert.equal(d.querySelectorAll('.tree-names [lang='+lang+']').length,435);
const search=d.getElementById('treeSearch');search.value='Paridae';search.dispatchEvent(new w.Event('input'));
assert.equal(d.querySelectorAll('.tree-species').length,10);assert.equal(d.getElementById('newCount').textContent,'10');
d.getElementById('language').value='pl';d.getElementById('language').dispatchEvent(new w.Event('change'));
const answer=w.BIRD_DATA.find(b=>b.id===ids.find(id=>d.querySelector('[data-tree-species="'+id+'"]')));
d.querySelector('[data-test-branch="Paridae"]').click();assert.equal(d.getElementById('treeQuiz').open,true);assert.equal(d.querySelectorAll('[data-tree-answer]').length,6);
const q=d.querySelector('#treeQuizMedia img'),current=w.BIRD_DATA.find(b=>b.photos.some(p=>p.src===q.getAttribute('src')));
assert.ok(current);assert.ok(d.getElementById('treeQuizCount').textContent.endsWith('/ 10'));
const correct=d.querySelector('[data-tree-answer="'+current.id+'"]');assert.equal(correct.textContent,current.pl);correct.click();assert.equal(w.BirdAtlas.state(current.id).level,1);assert.equal(d.querySelector('[data-tree-species="'+current.id+'"] .tree-level strong').textContent,'1 / 10');assert.equal(d.querySelectorAll('[data-tree-answer]:not([hidden])').length,1);assert.equal(d.querySelector('[data-tree-answer]:not([hidden])').dataset.treeAnswer,current.id);correct.click();assert.equal(w.BirdAtlas.state(current.id).reps,1);
d.getElementById('closeTreeQuiz').click();search.value='';search.dispatchEvent(new w.Event('input'));
d.getElementById('onlyPoland').checked=true;d.getElementById('onlyPoland').dispatchEvent(new w.Event('change'));const polandCount=d.querySelectorAll('.tree-species').length;assert.ok(polandCount>100&&polandCount<423);
d.getElementById('polandWinter').checked=true;d.getElementById('polandWinter').dispatchEvent(new w.Event('change'));assert.ok(d.querySelectorAll('.tree-species').length<polandCount);
search.value='no such bird';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.tree-species').length,0);assert.equal(d.getElementById('learnBtn').disabled,true);
}finally{close()}});

test('Latin names have Russian readings; wrong options disappear after a wrong answer',()=>{
const {w,d,close}=fixture();try{
assert.equal(w.BirdStudy.latinLabel('Pyrrhula pyrrhula'),'Pyrrhula pyrrhula (Пиррула пиррула)');
assert.equal(w.BirdStudy.latinReading('Phylloscopus collybita'),'Филлоскопус коллибита');
assert.equal(w.BirdStudy.latinReading('Cyanistes caeruleus'),'Цианистес церулеус');
assert.equal(w.BirdStudy.latinReading('Parus major'),'Парус майор');
for(const b of w.BIRD_DATA)assert.doesNotMatch(w.BirdStudy.latinReading(b.latin),/[a-z]/i);
d.querySelector('[data-mode="names"]').click();d.getElementById('language').value='latin';d.getElementById('language').dispatchEvent(new w.Event('change'));
d.querySelector('[data-tree-test="great-tit"]').click();
assert.equal(d.querySelector('[data-tree-answer="great-tit"]').textContent,'Parus major (Парус майор)');
d.querySelector('[data-tree-answer]:not([data-tree-answer="great-tit"])').click();
assert.equal(d.querySelectorAll('[data-tree-answer]:not([hidden])').length,1);
assert.equal(d.querySelector('[data-tree-answer]:not([hidden])').dataset.treeAnswer,'great-tit');
assert.match(d.getElementById('treeQuizResult').textContent,/Parus major \(Парус майор\)/);
d.getElementById('closeTreeQuiz').click();d.getElementById('learnBtn').click();
assert.equal(d.querySelectorAll('[data-answer]:not([hidden])').length,6);
d.querySelector('[data-answer]').click();assert.equal(d.querySelectorAll('[data-answer]:not([hidden])').length,1);
d.getElementById('nextCard').click();assert.equal(d.querySelectorAll('[data-answer]:not([hidden])').length,6);
}finally{close()}});

test('Audit regressions: canonical names, aliases, Poland filters, taxonomy and saved crow progress',()=>{
const {w,d,close}=fixture({'Corvus_corone__photo':{level:4,reps:5,updatedAt:200},'hooded-crow__photo':{level:2,reps:2,updatedAt:100}});try{
const birds=w.BIRD_DATA;
assert.equal(birds.length,435);assert.equal(birds.filter(b=>b.latin==='Corvus corone').length,1);assert.equal(birds.some(b=>b.latin==='Corvus cornix'),false);
assert.equal(w.BirdAtlas.state('hooded-crow').level,4);
assert.ok(birds.every(b=>/[А-Яа-яЁё]/.test(b.ru)));
assert.equal(new Set(birds.map(b=>b.ru)).size,birds.length,'Russian answer labels must distinguish every species');
assert.ok(birds.filter(b=>b.group==='forest').length<50);
const search=d.getElementById('treeSearch');
for(const [query,latin]of [['Буроголовая','Poecile montanus'],['Обыкновенная лазоревка','Cyanistes caeruleus'],['Drozd śpiewak','Turdus philomelos'],['Common Chaffinch','Fringilla coelebs'],['Corvus cornix','Corvus corone']]){
search.value=query;search.dispatchEvent(new w.Event('input'));const b=birds.find(b=>b.latin===latin);assert.equal(d.querySelectorAll('.tree-species').length,1,query);assert.ok(d.querySelector('[data-tree-species="'+b.id+'"]'),query);
}
search.value='';search.dispatchEvent(new w.Event('input'));d.getElementById('includeVagrants').checked=false;d.getElementById('includeVagrants').dispatchEvent(new w.Event('change'));assert.ok(d.querySelector('[data-tree-species="Ficedula_parva"]'));
d.getElementById('onlyPoland').checked=true;d.getElementById('onlyPoland').dispatchEvent(new w.Event('change'));
for(const latin of ['Corvus corone','Anas platyrhynchos','Columba palumbus','Ardea cinerea']){const b=birds.find(b=>b.latin===latin);assert.ok(d.querySelector('[data-tree-species="'+b.id+'"]'),latin);}
assert.ok(d.querySelector('[data-branch="Corvidae"] [data-tree-species="hooded-crow"]'));
assert.ok(d.querySelector('[data-branch="Anseriformes"] [data-branch="Anatidae"] [data-branch="Anas"]'));
assert.equal(d.querySelector('[data-branch="Remiz"] .branch-count').textContent,'1 вид');
}finally{close()}});
