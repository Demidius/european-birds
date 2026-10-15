const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
function fixture(progress,filters={typicalPoland:false,onlyPoland:false}){const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../study.html'),'utf8'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
if(progress)w.localStorage.setItem('europeanBirds:v1:progress:guest',JSON.stringify(progress));
if(filters)w.localStorage.setItem('europeanBirds:filters',JSON.stringify(filters));
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','study-data.js','app.js','study-tree.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
const d=w.document,go=id=>d.querySelector('[data-tree-go="'+id+'"]').click(),total=()=>Number(d.querySelector('.drill-total').textContent.split(' ')[0]),find=q=>{const s=d.getElementById('treeSearch');s.value=q;s.dispatchEvent(new w.Event('input'));};
return {w,d,go,total,find,close:()=>w.close()};}
test('Typical Polish species are the default scope for every view and learning; filters survive reload',()=>{
 const {w,d,total,find,close}=fixture(undefined,null);let saved;
 try{
  const typical=w.BIRD_DATA.filter(w.BirdTaxonomy.isTypical),ids=typical.map(b=>b.id);
  assert.equal(typical.length,120);assert.equal(total(),120);
  assert.equal(d.getElementById('filterSummary').hidden,true,'the visible quick filter is not repeated');
  assert.equal(d.getElementById('newCount').textContent,'120');assert.equal(d.querySelectorAll('.bird-tile').length,120);
  assert.deepEqual([...w.BirdTaxonomy.leaves(w.BirdTree.filtered())].sort(),[...ids].sort());
  assert.ok(ids.includes('great-tit'));assert.ok(ids.includes('mallard'));assert.ok(!typical.some(b=>b.latin==='Vireo olivaceus'));
  w.eval(fs.readFileSync(path.join(__dirname,'../species-board.js'),'utf8'));d.getElementById('boardView').click();
  assert.equal(d.querySelectorAll('.sb-bar i').length,120);
  const change=id=>d.getElementById(id).dispatchEvent(new w.Event('change'));
  d.getElementById('polandWinter').checked=true;change('polandWinter');
  const winter=typical.filter(b=>w.BirdTaxonomy.region(b).seasons.winter);
  assert.equal(total(),winter.length);assert.equal(d.querySelectorAll('.sb-bar i').length,winter.length);
  assert.equal(d.querySelectorAll('.bird-tile').length,winter.length);
  find('Paridae');assert.equal(d.querySelectorAll('.bird-tile').length,w.BirdTaxonomy.leaves(w.BirdTree.filtered()).length);
  find('');d.getElementById('polandWinter').checked=false;change('polandWinter');
  const original=w.BirdStudy.shuffle;w.BirdStudy.shuffle=pool=>{assert.ok(pool.every(b=>ids.includes(b.id)));return pool;};
  d.getElementById('learnBtn').click();assert.equal(d.getElementById('cardDialog').open,true);d.getElementById('closeCard').click();w.BirdStudy.shuffle=original;
  d.getElementById('typicalPoland').checked=false;change('typicalPoland');assert.equal(total(),196,'all national records remain available');
  saved=JSON.parse(w.localStorage.getItem('europeanBirds:filters'));
  d.getElementById('onlyPoland').checked=false;change('onlyPoland');assert.equal(total(),435);
  d.getElementById('typicalPoland').checked=true;change('typicalPoland');assert.equal(total(),120);
  d.querySelector('[data-mode="audio"]').click();assert.equal(d.getElementById('newCount').textContent,String(typical.filter(b=>b.audio.length).length));
 }finally{close();}
 const restored=fixture(undefined,saved);try{assert.equal(restored.total(),196);assert.equal(restored.d.getElementById('typicalPoland').checked,false);}finally{restored.close();}
});
test('All taxonomy species share learning cards; filters, languages, branch tests and progress work',()=>{
const {w,d,go,total,find,close}=fixture();try{
const ranks={};(function r(n){ranks[n.rank]=(ranks[n.rank]||0)+1;(n.children||[]).forEach(r)})(w.STUDY_TREE);assert.equal(ranks.family,51);assert.equal(ranks.genus,168);
assert.equal(d.querySelectorAll('details.study-branch').length,0,'no nested frames');assert.ok(d.querySelector('.drill-row[data-tree-go="Passeriformes"]'));
const ids=[];function walk(n){if(n.rank==='species')ids.push(n.birdId);(n.children||[]).forEach(walk)}walk(w.PASSERINE_TREE.root);
assert.equal(new Set(ids).size,423);assert.ok(ids.every(id=>w.BIRD_DATA.some(b=>b.id===id)));
assert.equal(total(),w.BIRD_DATA.length);assert.equal(w.BIRD_DATA.length,435);
find('a');const shown=d.querySelectorAll('.drill-species').length;for(const lang of ['ru','la','pl'])assert.equal(d.querySelectorAll('.drill-species [lang='+lang+']').length,shown);find('');
const search=d.getElementById('treeSearch');search.value='Paridae';search.dispatchEvent(new w.Event('input'));
assert.equal(d.querySelectorAll('.drill-species').length,10);assert.equal(d.getElementById('newCount').textContent,'10');
d.getElementById('language').value='pl';d.getElementById('language').dispatchEvent(new w.Event('change'));
d.querySelector('.drill-branch-test').click();const card=d.getElementById('cardDialog'),body=d.getElementById('cardBody');assert.equal(card.open,true);assert.match(d.getElementById('sessionCount').textContent,/Найдено/);
const src=body.querySelector('.fc-front img').getAttribute('src'),current=w.BIRD_DATA.find(b=>b.photos.some(p=>p.src===src));assert.ok(ids.includes(current.id)&&d.querySelector('[data-tree-species="'+current.id+'"]'));
assert.match(body.querySelector('.fc-meta').textContent,/осталось 10/);assert.ok(body.querySelector('.grades.hidden-grades'));body.querySelector('[data-act="flip"]').click();
assert.equal(body.querySelector('.fc-answer h3').textContent,current.ru);assert.match(body.querySelector('.fc-answer').textContent,new RegExp(current.pl));body.querySelector('[data-grade="good"]').click();
assert.equal(w.BirdAtlas.state(current.id).level,2);assert.equal(w.BirdAtlas.state(current.id).reps,1);assert.equal(d.querySelectorAll('[data-tree-species="'+current.id+'"] .drill-meter i.filled').length,2);assert.match(body.querySelector('.fc-meta').textContent,/осталось 9/);
d.getElementById('closeCard').click();assert.equal(card.open,false);search.value='';search.dispatchEvent(new w.Event('input'));
d.getElementById('onlyPoland').checked=true;d.getElementById('onlyPoland').dispatchEvent(new w.Event('change'));const polandCount=total();assert.ok(polandCount>100&&polandCount<423);
d.getElementById('polandWinter').checked=true;d.getElementById('polandWinter').dispatchEvent(new w.Event('change'));assert.ok(total()<polandCount);
search.value='no such bird';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.drill-species').length,0);assert.ok(d.querySelector('.drill-empty'));assert.equal(d.getElementById('learnBtn').disabled,true);
}finally{close()}});

test('Tree board: one study button per level, branch photos and progress, filter count and reset',()=>{
const {w,d,go,total,close}=fixture();try{
assert.equal(d.getElementById('testTitBranch'),null,'no second whole-tree button');assert.equal(d.querySelectorAll('[data-test-branch]').length,1);assert.ok(d.querySelector('.drill-bar .drill-branch-test'),'the study button sits in the pinned bar');
assert.equal(d.querySelector('.tree-score-rule'),null);assert.match(d.querySelector('.tree-mode').textContent,/По фото · русский/);
// With thumbnails on, every row photo is a local square thumbnail that exists in the repository.
if(w.BirdTree.thumbs)for(const b of w.BIRD_DATA){const src=b.photos[0].src;if(/^assets\/(photos|bird-photos)\//.test(src))assert.ok(fs.existsSync(path.join(__dirname,'..',src.replace(/^assets\/([^/]+)\/(.+)\.\w+$/,'assets/thumbs/$1/$2.webp'))),'thumbnail for '+src);}
const imgs=[...d.querySelectorAll('.drill-row .drill-thumb img')];assert.equal(imgs.length,d.querySelectorAll('.drill-row').length,'every branch has a photo');assert.ok(imgs.every(i=>w.BirdTree.thumbs?/^assets\/thumbs\//.test(i.getAttribute('src'))&&i.dataset.full:/^assets\/(photos|bird-photos)\//.test(i.getAttribute('src'))));
assert.equal(d.querySelectorAll('.drill-prog').length,0,'no empty progress bars before any study');
go('Passeriformes');go('Paridae');d.querySelector('[data-tree-test="great-tit"]').click();const body=d.getElementById('cardBody');body.querySelector('[data-act="flip"]').click();body.querySelector('[data-grade="good"]').click();d.getElementById('closeCard').click();
assert.ok(d.querySelector('.drill-hero .drill-prog .learning'),'the open level shows its progress');assert.match(d.querySelector('.drill-total').textContent,/изучаю 1/);
go('Passeriformes');const row=d.querySelector('.drill-row[data-tree-go="Paridae"]');assert.ok(row.querySelector('.drill-prog .learning'));assert.match(row.querySelector('.drill-count').textContent,/10 видов · изучаю 1/);
// Filters: the count, the summary while the panel is closed, vagrants off inside Poland, and reset.
const check=id=>{const e=d.getElementById(id);e.checked=!e.checked;e.dispatchEvent(new w.Event('change'));};
assert.equal(d.getElementById('filterCount').hidden,true);check('polandBreeding');
assert.equal(d.getElementById('onlyPoland').checked,true);assert.equal(d.getElementById('filterCount').textContent,'2');assert.equal(d.getElementById('includeVagrants').disabled,true);
const summary=d.getElementById('filterSummary');assert.equal(summary.hidden,false);assert.match(summary.textContent,/Только Польша · Гнездятся/);
d.getElementById('filterToggle').click();assert.equal(d.getElementById('filterPanel').hidden,false);assert.equal(summary.hidden,true,'the open panel shows the chips themselves');d.getElementById('filterToggle').click();
summary.querySelector('[data-filter-reset]').click();assert.equal(d.getElementById('onlyPoland').checked,false);assert.equal(d.getElementById('polandBreeding').checked,false);assert.equal(d.getElementById('includeVagrants').checked,true);assert.equal(d.getElementById('includeVagrants').disabled,false);
assert.equal(d.getElementById('filterCount').hidden,true);assert.equal(summary.hidden,true);
check('includeVagrants');assert.equal(d.getElementById('filterCount').textContent,'1');assert.match(summary.textContent,/Без редких залётов/);check('includeVagrants');
}finally{close()}});

test('Latin names have Russian readings; species and name cards show every name on the back',()=>{
const {w,d,close}=fixture();try{
assert.equal(w.BirdStudy.latinLabel('Pyrrhula pyrrhula'),'Pyrrhula pyrrhula (Пиррула пиррула)');
assert.equal(w.BirdStudy.latinReading('Phylloscopus collybita'),'Филлоскопус коллибита');
assert.equal(w.BirdStudy.latinReading('Cyanistes caeruleus'),'Цианистес церулеус');
assert.equal(w.BirdStudy.latinReading('Parus major'),'Парус майор');
for(const b of w.BIRD_DATA)assert.doesNotMatch(w.BirdStudy.latinReading(b.latin),/[a-z]/i);
d.querySelector('[data-mode="names"]').click();d.getElementById('language').value='latin';d.getElementById('language').dispatchEvent(new w.Event('change'));
const s2=d.getElementById('treeSearch');s2.value='Parus major';s2.dispatchEvent(new w.Event('input'));d.querySelector('[data-tree-test="great-tit"]').click();
const body=d.getElementById('cardBody');assert.equal(body.querySelector('.fc-prompt').textContent,'Большая синица');assert.ok(body.querySelector('.fc-know'));
body.querySelector('[data-act="flip"]').click();assert.match(body.querySelector('.bird-names').textContent,/Parus major \(Парус майор\)/);assert.match(body.querySelector('.bird-names').textContent,/Bogatka/);assert.match(body.querySelector('.bird-names').textContent,/Great Tit/);
d.getElementById('closeCard').click();d.getElementById('language').value='ru';d.getElementById('language').dispatchEvent(new w.Event('change'));d.querySelector('[data-tree-test="great-tit"]').click();
assert.equal(body.querySelector('.fc-prompt').textContent,'Parus major (Парус майор)');assert.equal(body.querySelector('.fc-know'),null,'no typed Latin check when the prompt is Latin');
d.getElementById('closeCard').click();s2.value='';s2.dispatchEvent(new w.Event('input'));
}finally{close()}});

test('Audit regressions: canonical names, aliases, Poland filters, taxonomy and saved crow progress',()=>{
const {w,d,go,find,close}=fixture({'Corvus_corone__photo':{level:4,reps:5,updatedAt:200},'hooded-crow__photo':{level:2,reps:2,updatedAt:100}});try{
const birds=w.BIRD_DATA;
assert.equal(birds.length,435);assert.equal(birds.filter(b=>b.latin==='Corvus corone').length,1);assert.equal(birds.some(b=>b.latin==='Corvus cornix'),false);
assert.equal(w.BirdAtlas.state('hooded-crow').level,4);
assert.ok(birds.every(b=>/[А-Яа-яЁё]/.test(b.ru)));
assert.equal(new Set(birds.map(b=>b.ru)).size,birds.length,'Russian answer labels must distinguish every species');
assert.ok(birds.filter(b=>b.group==='forest').length<50);
const search=d.getElementById('treeSearch');
for(const [query,latin]of [['Буроголовая','Poecile montanus'],['Обыкновенная лазоревка','Cyanistes caeruleus'],['Drozd śpiewak','Turdus philomelos'],['Common Chaffinch','Fringilla coelebs'],['Corvus cornix','Corvus corone']]){
search.value=query;search.dispatchEvent(new w.Event('input'));const b=birds.find(b=>b.latin===latin);assert.equal(d.querySelectorAll('.drill-species').length,1,query);assert.ok(d.querySelector('[data-tree-species="'+b.id+'"]'),query);
}
search.value='';search.dispatchEvent(new w.Event('input'));d.getElementById('includeVagrants').checked=false;d.getElementById('includeVagrants').dispatchEvent(new w.Event('change'));find('Ficedula parva');assert.ok(d.querySelector('[data-tree-species="Ficedula_parva"]'));find('');
d.getElementById('onlyPoland').checked=true;d.getElementById('onlyPoland').dispatchEvent(new w.Event('change'));
for(const latin of ['Corvus corone','Anas platyrhynchos','Columba palumbus','Ardea cinerea']){const b=birds.find(b=>b.latin===latin);find(latin);assert.ok(d.querySelector('[data-tree-species="'+b.id+'"]'),latin);}find('');
go('Passeriformes');assert.equal(d.querySelector('[data-tree-go="Remizidae"] .drill-count').textContent,'1 вид');go('Corvidae');assert.ok(d.querySelector('[data-tree-species="hooded-crow"]'));assert.match(d.querySelector('.drill-crumbs').textContent,/Воробьинообразные.*Врановые/);
go('Aves');go('Anseriformes');assert.match(d.querySelector('.drill-only').textContent,/Утиные/);assert.ok([...d.querySelectorAll('.drill-section')].some(e=>/Anas/.test(e.textContent)));assert.ok(d.querySelector('[data-tree-species]'));
assert.equal(d.querySelector('[data-tree-back]').disabled,false);go('Aves');assert.equal(d.querySelector('[data-tree-back]').disabled,true);assert.ok(d.querySelector('.drill-row[data-tree-go="Anseriformes"]'));
}finally{close()}});
