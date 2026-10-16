// Anki-style card sessions: front, answer, four grades, "again" waiting list, undo, typed Latin and skipping.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function fixture(progress){
 const dom=new JSDOM(read('study.html'),{url:'https://example.org/?offline=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 if(progress)w.localStorage.setItem('europeanBirds:v1:progress:guest',JSON.stringify(progress));
 w.localStorage.setItem('europeanBirds:filters',JSON.stringify({typicalPoland:false,onlyPoland:false}));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
 let now=Date.UTC(2026,9,15,12);w.Date.now=()=>now;
 for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','data-poland-additions.js','study-data.js','data-biology.js','biology.js','app.js','study-tree.js'])w.eval(read(f));
 const body=()=>d.getElementById('cardBody'),$=s=>body().querySelector(s),stored=()=>JSON.parse(w.localStorage.getItem('europeanBirds:v1:progress:guest')||'{}');
 const current=()=>{const img=$('.fc-front img'),audio=$('.fc-front audio'),prompt=$('.fc-prompt');
  if(img)return w.BIRD_DATA.find(b=>b.photos.some(p=>p.src===img.getAttribute('src')));
  if(audio)return w.BIRD_DATA.find(b=>b.audio.some(p=>p.src===audio.getAttribute('src')));
  return w.BIRD_DATA.find(b=>b.ru===prompt.textContent||w.BirdStudy.latinLabel(b.latin)===prompt.textContent);};
 return {w,d,body,$,stored,current,tick:ms=>{now+=ms;},close:()=>w.close()};
}
test('Every mode shows the right front, reveals all names and saves the grade under its own key',()=>{
 for(const [mode,language,front] of [['photo','ru','.fc-front img'],['audio','ru','.fc-front audio'],['names','ru','.fc-prompt.latin'],['names','latin','.fc-prompt'],['names','pl','.fc-prompt']]){
  const f=fixture(),{w,d,$}=f;try{
   d.querySelector('[data-mode="'+mode+'"]').click();d.getElementById('language').value=language;d.getElementById('language').dispatchEvent(new w.Event('change'));d.getElementById('learnBtn').click();
   assert.equal(d.getElementById('cardDialog').open,true);assert.ok($(front),mode+' '+language);const b=f.current();assert.ok(b,mode+' '+language);
   assert.ok($('.grades.hidden-grades'),'grades wait under the button');assert.equal($('.fc-answer'),null);
   $('[data-act="flip"]').click();assert.equal($('.fc-answer h3').textContent,b.ru);const names=$('.bird-names').textContent;for(const n of [b.en,b.latin,b.pl])assert.ok(names.includes(n),n);
   assert.deepEqual([...f.body().querySelectorAll('.grade')].map(x=>x.firstChild.textContent),['Снова','Трудно','Хорошо','Легко']);
   assert.deepEqual([...f.body().querySelectorAll('.grade small')].map(x=>x.textContent),['10 мин','12 ч','1 дн.','4 дн.']);
   $('[data-grade="easy"]').click();const k=b.id+'__'+(mode==='names'?'names-'+language:mode);
   assert.equal(f.stored()[k].level,4);assert.equal(f.stored()[k].interval,4);assert.equal(f.stored()[k].reps,1);
   assert.notEqual(f.current(),undefined,'next card is shown');
  }finally{f.close();}
 }
});
test('Again keeps the card in a 10-minute waiting list; undo restores the previous state',async()=>{
 const f=fixture(),{w,d,$}=f;try{
  w.BirdAtlas.study(['great-tit'],'Большая синица');assert.match(d.getElementById('sessionCount').textContent,/ПО ФОТО · Большая синица/);
  $('[data-act="flip"]').click();$('[data-grade="again"]').click();
  assert.equal(f.stored()['great-tit__photo'].level,1);assert.equal(f.stored()['great-tit__photo'].lapses,1);
  assert.ok($('.wait-box'),'waiting screen');assert.match($('.wait-box').textContent,/1 вид ждёт/);assert.equal($('#waitN').textContent,'10:00');
  $('[data-act="undo"]').click();assert.ok($('.fc-answer'),'undo returns to the answered card');assert.equal(f.stored()['great-tit__photo'].reps,0);
  $('[data-grade="again"]').click();f.tick(10*60000);await new Promise(r=>setTimeout(r,1100));
  assert.ok($('.fc-front img'),'card returns after ten minutes');assert.equal(f.current().id,'great-tit');
  $('[data-act="flip"]').click();$('[data-grade="good"]').click();assert.equal(f.stored()['great-tit__photo'].level,2);
  assert.ok($('.fc-done'),'session ends');assert.match($('.fc-list').textContent,/Большая синица/);assert.match($('.fc-list').textContent,/0 → 2 · через 1 дн\./);
  $('[data-act="close"]').click();assert.equal(d.getElementById('cardDialog').open,false);
 }finally{f.close();}
});
test('Typed Latin name marks the species learned; a wrong name only reveals the answer',()=>{
 const f=fixture(),{w,d,$}=f;try{
  w.BirdAtlas.study(['great-tit','blue-tit'],'Синицы');const first=f.current();
  $('[data-act="kopen"]').click();$('#knownIn').value='  '+first.latin.toUpperCase()+'.';$('#knownForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('.kok-t').textContent,'Засчитано');const s=f.stored()[first.id+'__photo'];assert.equal(s.level,10);assert.equal(s.interval,180);
  $('[data-act="knext"]').click();const second=f.current();assert.notEqual(second.id,first.id);
  $('[data-act="kopen"]').click();$('#knownIn').value='Parus minor';$('#knownForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.match($('.kres').textContent,/Parus minor/);assert.ok($('.fc-answer'));assert.equal(f.stored()[second.id+'__photo'],undefined,'nothing saved before a grade');
  assert.equal($('.fc-know').disabled,true);$('[data-grade="hard"]').click();assert.equal(f.stored()[second.id+'__photo'].interval,0.5);
 }finally{f.close();}
});
test('Keyboard: space shows the answer, 1-4 grade; broken media can be skipped without progress',()=>{
 const f=fixture(),{w,d,$}=f;try{
  w.BirdAtlas.study(['great-tit','blue-tit'],'');const b=f.current();
  d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',bubbles:true}));assert.ok($('.fc-answer'));
  d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'3',bubbles:true}));assert.equal(f.stored()[b.id+'__photo'].level,2);
  const before=JSON.stringify(f.stored());$('.fc-front img').dispatchEvent(new w.Event('error'));
  assert.ok($('[data-act="skip"]'));assert.equal($('[data-act="flip"]'),null);$('[data-act="skip"]').click();
  assert.equal(JSON.stringify(f.stored()),before);assert.match($('.fc-done .session-results').textContent,/пропущено: 1/);
 }finally{f.close();}
});
test('Tree study queues due species first, then new ones; an all-scheduled branch is still practised',()=>{
 const T=Date.UTC(2026,9,15,12),f=fixture({'blue-tit__photo':{level:3,interval:2,ease:2.5,due:T-1000,reps:2,lapses:0,updatedAt:1},'great-tit__photo':{level:5,interval:8,ease:2.5,due:T+5*864e5,reps:3,lapses:0,updatedAt:1}}),{w,d,$}=f;try{
  const tits=w.BIRD_DATA.filter(b=>/^(Parus|Cyanistes|Periparus|Lophophanes|Poecile) /.test(b.latin)).map(b=>b.id);assert.equal(tits.length,10);
  w.BirdAtlas.study(tits,'Синицевые');assert.equal(f.current().id,'blue-tit','the due card comes first');assert.match($('.fc-meta').textContent,/осталось 9/,'the scheduled great tit waits for its date');
  d.getElementById('closeCard').click();w.BirdAtlas.study(['great-tit'],'Большая синица');assert.equal(f.current().id,'great-tit','a single species can always be practised');
  assert.match($('.fc-level').textContent,/уровень 5 из 10 · интервал 8 дн\./);
 }finally{f.close();}
});
