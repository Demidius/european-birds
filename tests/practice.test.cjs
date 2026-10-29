const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function fixture(progress={},filters={typicalPoland:false,onlyPoland:false}){
 const dom=new JSDOM(read('study.html'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.localStorage.setItem('europeanBirds:v1:progress:guest',JSON.stringify(progress));
 w.localStorage.setItem('europeanBirds:filters',JSON.stringify(filters));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
 for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','data-poland-additions.js','study-data.js','practice.js','app.js','study-tree.js'])w.eval(read(f));
 const $=s=>d.querySelector(s),all=s=>[...d.querySelectorAll(s)],click=s=>{assert.ok($(s),s);$(s).click();};
 const change=(s,value)=>{$(s).value=value;$(s).dispatchEvent(new w.Event('change',{bubbles:true}));};
 const current=()=>{const img=$('.fc-front img'),audio=$('.fc-front audio'),prompt=$('.fc-prompt');return w.BIRD_DATA.find(b=>img?b.photos.some(p=>p.src===img.getAttribute('src')):audio?b.audio.some(p=>p.src===audio.getAttribute('src')):b.ru===prompt?.textContent||b.latin===prompt?.textContent);};
 const storage=()=>JSON.stringify(Object.fromEntries(Object.keys(w.localStorage).filter(k=>!k.includes('settings')).sort().map(k=>[k,w.localStorage.getItem(k)])));
 click('[data-study-format="choices"]');
 return {w,d,$,all,click,change,current,storage,close:()=>w.close()};
}
test('Every species has four unique options in each language, with all closer available relatives preferred',()=>{
 const f=fixture();try{
  const {w}=f,P=w.BirdPractice;
  for(const language of ['pl','latin','ru','en'])for(const bird of w.BIRD_DATA){
   const options=P.options(bird,language),ids=options.map(b=>b.id),labels=options.map(b=>P.label(b,language).toLowerCase());
   assert.equal(ids.length,4,bird.latin+' '+language);assert.equal(new Set(ids).size,4);assert.equal(new Set(labels).size,4);assert.ok(ids.includes(bird.id));
   const minimum=Math.min(...options.filter(b=>b!==bird).map(b=>P.proximity(bird,b)));
   assert.ok(w.BIRD_DATA.filter(b=>P.label(b,language)&&P.proximity(bird,b)>minimum).every(b=>labels.includes(P.label(b,language).toLowerCase())),bird.latin+' skips a closer relative');
  }
  const thrush=w.BIRD_DATA.find(b=>b.latin==='Turdus merula');assert.ok(P.options(thrush,'pl').every(b=>b.latin.startsWith('Turdus ')));
  assert.ok(P.options(w.BIRD_DATA.find(b=>b.id==='great-tit'),'ru').every(b=>/^(Parus|Cyanistes|Periparus|Lophophanes|Poecile) /.test(b.latin)));
 }finally{f.close();}
});
test('Correct and wrong answers reveal status controls without automatically writing progress',()=>{
 const f=fixture({'great-tit__photo':{status:'learning',level:6,seen:20,updatedAt:10}});try{
  const {w,click,change,current,$,all}=f;
  for(const language of ['pl','latin','ru','en']){
   change('[data-practice-language]',language);assert.equal($('#language').value,language);
   const before=f.storage();w.BirdAtlas.study(['great-tit'],'Синица');
   assert.equal(all('[data-answer]').length,4);assert.equal($('.fc-answer'),null);assert.equal($('.pc'),null);const bird=current();
   assert.ok(all('[data-answer] span[lang]').every(el=>el.lang===(language==='latin'?'la':language)));
   const wrong=all('[data-answer]').find(button=>button.dataset.answer!==bird.id);wrong.click();
   assert.match($('.practice-feedback').textContent,/Правильный ответ/);assert.ok($('.practice-feedback').textContent.includes(bird[language]));
   assert.equal($('.fc-answer h3').textContent,bird.ru);assert.equal(all('.practice-option.correct').length,1);assert.equal(all('.practice-option.wrong').length,1);
   assert.ok(all('[data-answer]').every(button=>button.disabled));assert.equal($('[data-pc-level], [data-act="kopen"], [data-grade]'),null);
   assert.equal(all('[data-pc-status]').length,3);assert.equal($('.pc').dataset.pc,bird.id);
   for(const key of ['1','2','3','4','+','-',' '])w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true}));
   click('[data-act="next"]');click('[data-answer="great-tit"]');assert.match($('.practice-feedback').textContent,/Верно!/);
   click('#closeCard');assert.equal(f.storage(),before,language+' changes saved state');
  }
 }finally{f.close();}
});
test('Manual practice status changes persist only for the current species, mode and language',()=>{
 const f=fixture({'blue-tit__photo':{status:'known',level:9}});try{
  const {w,d,click,change,$,all}=f;
  for(const mode of ['photo','audio','names'])for(const language of ['ru','en','latin','pl']){
   click('[data-mode="'+mode+'"]');change('[data-practice-language]',language);
   w.BirdAtlas.set('great-tit','level',6);
   const before=JSON.parse(w.localStorage.getItem('europeanBirds:v1:progress:guest'));
   w.BirdAtlas.study(['great-tit'],'Синица');click('[data-answer="great-tit"]');
   const card=$('.fc-answer'),photo=$('.fc-front'),feedback=$('.practice-feedback').textContent;
   const key='great-tit__'+(mode==='names'?'names-'+language:mode+(language==='ru'?'':'-'+language));
   for(const status of ['learning','known','unknown']){
    const button=$('[data-pc-status="'+status+'"]');button.focus();$('#cardDialog').scrollTop=180;button.click();
    assert.equal(w.BirdAtlas.state('great-tit').status,status);
    assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(all('[data-pc-status][aria-pressed="true"]').length,1);
    assert.equal(d.activeElement,button);assert.equal($('#cardDialog').scrollTop,180);
    assert.equal($('.fc-answer'),card);assert.equal($('.fc-front'),photo);assert.equal($('.practice-feedback').textContent,feedback);
    const saved=JSON.parse(w.localStorage.getItem('europeanBirds:v1:progress:guest'));
    assert.equal(saved[key].status,status);assert.deepEqual(Object.keys(saved).sort(),Object.keys(before).sort());
    assert.deepEqual({...saved[key],status:before[key].status,updatedAt:before[key].updatedAt},before[key]);
    for(const other of Object.keys(before).filter(k=>k!==key))assert.deepEqual(saved[other],before[other]);
   }
   click('[data-pc-status="learning"]');click('#closeCard');
   w.BirdAtlas.study(['great-tit'],'Синица');click('[data-answer="great-tit"]');
   assert.equal($('[data-pc-status="learning"]').getAttribute('aria-pressed'),'true');click('#closeCard');
  }
 }finally{f.close();}
});
test('Changing a practice status updates categories and excludes the species from subsequent questions',()=>{
 const f=fixture();try{
  const {w,click,current,$}=f,ids=['great-tit','blue-tit'];
  const countBefore=Number($('#reviewBtn strong').textContent);
  w.BirdAtlas.study(ids,'Синицы','unknown');const first=current().id;
  click('[data-answer="'+first+'"]');click('[data-pc-status="learning"]');
  assert.equal(Number($('#reviewBtn strong').textContent),countBefore+1);
  click('[data-act="next"]');assert.notEqual(current().id,first);
  const second=current().id;click('[data-answer="'+second+'"]');click('[data-pc-status="known"]');
  click('[data-act="next"]');assert.match($('#cardTitle').textContent,/Нет подходящих/);
  click('[data-act="close"]');w.BirdAtlas.study(ids,'Синицы','learning');assert.equal(current().id,first);
 }finally{f.close();}
});
test('Practice cycles without the batch limit, without adjacent repeats, and never calls localStorage writes',()=>{
 const f=fixture();try{
  const {w,click,current}=f,ids=['great-tit','blue-tit','coal-tit'];
  let writes=0;const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(...args){writes++;return original.apply(this,args);};
  w.BirdAtlas.study(ids,'Синицы','unknown');let previous=null,round=[];
  for(let i=0;i<65;i++){
   const bird=current();assert.ok(ids.includes(bird.id));assert.notEqual(bird.id,previous);previous=bird.id;round.push(bird.id);
   if(round.length===3){assert.equal(new Set(round).size,3);round=[];}
   click('[data-answer="'+bird.id+'"]');click('[data-act="next"]');
  }
  click('#closeCard');assert.equal(writes,0);
 }finally{f.close();}
});
test('Branch, search, regional filters and all three categories constrain questions but not distractors',()=>{
 const f=fixture({'great-tit__photo':{status:'learning',level:4},'blue-tit__photo':{status:'known',level:10}},{typicalPoland:true,onlyPoland:true});try{
  const {w,click,current,all,$}=f;
  click('[data-tree-go="Passeriformes"]');click('[data-tree-go="Paridae"]');
  for(const [button,expected]of [['#reviewBtn','great-tit'],['#knownBtn','blue-tit']]){click(button);assert.equal(current().id,expected);click('#closeCard');}
  const eligible=new Set(w.BirdTaxonomy.leaves(w.BirdTree.filtered()).filter(id=>w.BirdAtlas.state(id).status==='unknown'));
  click('#learnBtn');for(let i=0;i<12;i++){const bird=current();assert.ok(eligible.has(bird.id));assert.ok(w.BirdTaxonomy.isTypical(bird));click('[data-answer="'+bird.id+'"]');click('[data-act="next"]');}click('#closeCard');
  $('#treeSearch').value='Parus major';$('#treeSearch').dispatchEvent(new w.Event('input'));
  click('#reviewBtn');assert.equal(current().id,'great-tit');assert.equal(all('[data-answer]').length,4);assert.equal(all('[data-answer="great-tit"]').length,1);click('#closeCard');
  assert.equal($('#learnBtn').disabled,true);assert.equal($('#knownBtn').disabled,true);
  w.BirdAtlas.study(['great-tit'],'Пустая категория','unknown');assert.match($('#cardTitle').textContent,/Нет подходящих/);click('[data-act="close"]');
 }finally{f.close();}
});
test('Photo, audio and name prompts hide the answer; broken materials are skipped without a write',()=>{
 const f=fixture();try{
  const {w,click,change,current,$,all}=f;
  for(const mode of ['photo','audio','names'])for(const language of ['ru','pl']){
   click('[data-mode="'+mode+'"]');change('[data-practice-language]',language);const before=f.storage();w.BirdAtlas.study(['great-tit'],'Синица');
   assert.equal(current().id,'great-tit');assert.equal(all('[data-answer]').length,4);assert.equal($('.fc-answer'),null);
   if(mode==='names')assert.equal($('.fc-prompt').textContent,language==='ru'?'Parus major':'Большая синица');
   if(mode!=='names'){
    $('.fc-front '+(mode==='photo'?'img':'audio')).dispatchEvent(new w.Event('error'));assert.ok(all('[data-answer]').every(button=>button.disabled));
    click('[data-act="next"]');assert.match($('#cardTitle').textContent,/Нет доступных/);
   }else{
    const correct=all('[data-answer]').findIndex(b=>b.dataset.answer==='great-tit');w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:String(correct+1),bubbles:true}));assert.match($('.practice-feedback').textContent,/Верно/);
   }
   click('#closeCard');assert.equal(f.storage(),before);
  }
 }finally{f.close();}
});
test('Format settings persist and switching back retains normal card and manual progress behaviour',()=>{
 const f=fixture();try{
  const {w,click,$,change}=f;
  change('[data-practice-language]','pl');assert.deepEqual(JSON.parse(w.localStorage.getItem('europeanBirds:v1:settings')),{testFormat:'choices',testLanguage:'pl'});
  click('[data-study-format="cards"]');assert.equal($('[data-study-format="cards"]').getAttribute('aria-pressed'),'true');
  w.BirdAtlas.study(['great-tit'],'Синица');assert.equal($('[data-answer]'),null);click('[data-act="flip"]');assert.ok($('.pc'));click('[data-pc-status="learning"]');
  assert.equal(w.BirdAtlas.state('great-tit').status,'learning');click('#closeCard');
  assert.equal(JSON.parse(w.localStorage.getItem('europeanBirds:v1:settings')).testFormat,'cards');
 }finally{f.close();}
});
