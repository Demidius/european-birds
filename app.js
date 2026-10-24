(()=>{
'use strict';
const $=id=>document.getElementById(id),C=BirdStudy,BIRDS=window.BIRD_DATA||[],PREFIX='europeanBirds:v1:',GROUPS={all:'Все виды',garden:'Сады и парки',forest:'Лесные',urban:'Рядом с человеком',corvid:'Врановые',water:'У воды',wetland:'Луга и болота',raptor:'Хищные',unclassified:'Среда не уточнена'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The three study buttons live on the bird tree (study-tree.js) and work on the open branch,
// so the old buttons in the page header are removed; the status filter is rebuilt for the new statuses.
(()=>{document.querySelector('.study-hub .study-actions')?.remove();
 const f=document.getElementById('statusFilter');if(f)f.innerHTML='<option value="all">Любой статус</option><option value="unknown">Не знаю</option><option value="learning">Изучаю</option><option value="known">Знаю</option>';
 document.getElementById('helpBtn')?.setAttribute('aria-label','Как устроено изучение');})();
const savedSettings=read('settings',{});
let mode='photo',language=['ru','en','latin','pl'].includes(savedSettings.testLanguage)?savedSettings.testLanguage:'ru',group='all',states={},uid='guest',me=null,profiles=[],db=null,auth=null,session=null,loadToken=0,unsubProgress=null,unsubProfiles=null,cloudReady=false,cloudState='',restoreFocus=null;
let treeScope=null;
let batchSize=Number(savedSettings.batchSize)||20;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(PREFIX+key))??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(PREFIX+key,JSON.stringify(value));return true;}catch{return false;}}
function key(b,m=mode,l=language){if(m==='names')return b.id+'__names-'+l;return b.id+'__'+(l==='ru'?m:m+'-'+l);}
const validKeys=new Set(BIRDS.flatMap(b=>['photo','audio','photo-en','photo-latin','photo-pl','audio-en','audio-latin','audio-pl','names-ru','names-en','names-latin','names-pl'].map(m=>b.id+'__'+m)));
function cleanMap(obj){const out={};const aliases=window.BIRD_ID_ALIASES||{};if(obj&&typeof obj==='object'&&!Array.isArray(obj)){obj={...obj};for(const [oldId,newId]of Object.entries(aliases))for(const k of Object.keys(obj))if(k.startsWith(oldId+'__')){const to=newId+k.slice(oldId.length);if(!obj[to]||(obj[k]?.updatedAt||0)>(obj[to]?.updatedAt||0))obj[to]=obj[k];}}if(obj&&typeof obj==='object'&&!Array.isArray(obj))for(const [k,v]of Object.entries(obj))if(validKeys.has(k))out[k]=C.clean(v);return out;}
function own(){return uid==='guest'?!me:!!me&&uid===me.uid;}
function available(b,m=mode){return m==='names'||(m==='photo'?b.photos.length:b.audio.length)>0;}
function scoped(){return BIRDS.filter(b=>(!treeScope||treeScope.has(b.id))&&(group==='all'||b.group===group));}
function eligible(){return scoped().filter(b=>available(b));}
function state(b){return C.clean(states[key(b)]);}
const status=C.status;
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function showNotice(){if(!own()){notice('Ты смотришь чужой прогресс. Изменять его нельзя.');return;}if(!me){notice('Гость: прогресс сохраняется на этом устройстве.');return;}notice(cloudState||'Прогресс сохранён в аккаунте.');}
function setMode(next){if(session)finishSession(false);mode=next;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));render();}
function render(){const pool=eligible(),counts=C.progress(pool.map(state));
 $('speciesCount').textContent=BIRDS.length;$('masteredCount').textContent=counts.known;$('totalCount').textContent='/ '+pool.length+' '+C.word(pool.length);
 const labels={photo:'Узнаю по фото',audio:'Узнаю по голосу',names:'Помню названия'};$('progressTitle').textContent=labels[mode];
 const meta=[['unknown','Не знаю','none'],['learning','Изучаю','learn'],['known','Знаю','master']];
 $('progressBar').innerHTML=meta.map(([s,,color])=>'<span style="width:'+(pool.length?counts[s]/pool.length*100:0)+'%;background:var(--'+color+')"></span>').join('');$('progressBar').setAttribute('aria-label',meta.map(([s,l])=>l+': '+counts[s]).join(', ')+', средний уровень '+(pool.length?(counts.levels/pool.length).toFixed(1):0));
 $('legend').innerHTML=meta.map(([s,l,color])=>'<span><i class="dot" style="background:var(--'+color+')"></i>'+l+' '+counts[s]+'</span>').join('')+'<span class="legend-level">ср. уровень '+(pool.length?(counts.levels/pool.length).toFixed(1):'0')+'</span>';
 $('modeNote').textContent=mode==='photo'?'Посмотри на фото и вспомни вид, затем открой ответ и отметь статус и уровень.':mode==='audio'?'Послушай голос и вспомни вид, затем открой ответ и отметь статус и уровень.':language==='ru'?'Латинское название -> вспомни русское и остальные названия.':'Русское название -> вспомни '+({en:'английское',latin:'латинское',pl:'польское'}[language])+' и остальные названия.';
 renderCatalog();showNotice();window.dispatchEvent(new CustomEvent('birdatlas:render'));
}
function renderCatalog(){const sf=$('statusFilter').value;
 const pool=scoped(),visible=pool.filter(b=>sf==='all'||sf===status(state(b)));
 $('resultCount').textContent=visible.length+' из '+pool.length+' '+C.word(pool.length);$('empty').hidden=visible.length>0;
 $('birdGrid').innerHTML=visible.map(b=>{const s=state(b),p=b.photos[0];return '<button class="bird-tile" data-bird="'+b.id+'" aria-label="'+esc(b.ru)+': карточка вида"><span class="tile-img'+(!p?' placeholder':'')+'">'+(p?'<img src="'+esc(p.src)+'" alt="'+esc(b.ru)+'" loading="lazy" decoding="async">':'Без фото')+(b.audio.length?'<span class="voice-badge">Есть голос</span>':'')+'</span><span class="tile-body"><strong>'+esc(b.ru)+'</strong><em>'+esc(C.latinLabel(b.latin))+'</em><span class="tile-progress"><span>'+C.LABELS[s.status]+'</span><span>'+s.level+' / 10</span></span><span class="mini-bar"><span style="width:'+(s.level*10)+'%"></span></span></span></button>';}).join('');
}
function renderGroups(){$('groups').innerHTML=Object.entries(GROUPS).map(([id,title])=>'<button data-group="'+id+'" aria-pressed="'+(group===id)+'">'+title+'</button>').join('');}
function openDialog(id){restoreFocus=document.activeElement;$(id).showModal();}
function closeDialog(id){$(id).close();if(restoreFocus?.isConnected)restoreFocus.focus();}
function stopAudio(){document.querySelectorAll('audio').forEach(a=>{a.pause();});}
// Manual study: the learner sets each species' status (не знаю / изучаю / знаю) and level 0–10.
// The three buttons draw species at random from one status; species shown more often today come up less.
const CATS={learning:{title:'Изучаемое',head:'ПОВТОРЯЮ ИЗУЧАЕМОЕ'},known:{title:'Известное',head:'ПОВТОРЯЮ ИЗВЕСТНОЕ'},unknown:{title:'Новые виды',head:'НОВЫЙ ВИД'}};
function pickOne(list){return list.length?list[Math.floor(Math.random()*list.length)]:null;}
function start(cat,bird=null){if(!own()||(bird&&!available(bird)))return;if(bird){openSession({fixed:[bird.id],title:bird.ru});return;}openSession({cat,title:''});}
// With a status (cat) the cards come straight from that group of the branch; without one a branch first asks which group.
function study(ids,title,cat){if(!own())return;const set=new Set(ids||[]),pool=BIRDS.filter(b=>set.has(b.id)&&available(b));if(!pool.length)return;
 if(cat&&C.STATUSES.includes(cat)){openSession({ids:pool.map(b=>b.id),cat,title});return;}
 if(pool.length===1){openSession({fixed:[pool[0].id],title});return;}
 if(session)finishSession(false);session=newSession({ids:pool.map(b=>b.id),title,choose:true});openDialog('cardDialog');renderCard();}
function newSession(o){return {cat:null,ids:null,fixed:null,choose:false,title:'',hist:[],at:-1,shown:0,round:0,media:{},flipped:false,kbox:false,kres:'',kdone:null,kprev:null,blocked:false,mode,language,uid,...o};}
function openSession(o){if(session)finishSession(false);session=newSession(o);openDialog('cardDialog');if(!advance())renderCard();}
function sessionPool(s){const set=s.fixed||s.ids;return set?BIRDS.filter(b=>set.includes(b.id)&&available(b,s.mode)):eligible();}
function catCount(s,cat){return sessionPool(s).filter(b=>C.status(states[key(b,s.mode,s.language)])===cat).length;}
function currentBird(s){return s.at>=0?BIRDS.find(b=>b.id===s.hist[s.at]):null;}
// Moves to the next card: forward through history after "← Предыдущая", otherwise a new weighted draw.
function advance(){const s=session;if(!s)return false;s.flipped=false;s.kbox=false;s.kres='';s.kdone=null;s.kprev=null;s.blocked=false;
 if(s.at<s.hist.length-1){s.at++;renderCard();return true;}
 if(s.fixed){if(s.hist.length){renderDone();return true;}s.hist.push(s.fixed[0]);s.at=0;seen(s);renderCard();return true;}
 if(s.round>=batchSize){renderDone(true);return true;}
 const b=C.pick(sessionPool(s),states,x=>key(x,s.mode,s.language),s.cat,Date.now(),Math.random,s.hist[s.at]);
 if(!b){renderDone();return true;}
 s.hist.push(b.id);s.at=s.hist.length-1;s.round++;seen(s);renderCard();return true;}
function seen(s){const b=currentBird(s);if(!b)return;s.shown++;const k=key(b,s.mode,s.language);saveState(k,C.markSeen(states[k],Date.now()));render();}
function credit(m){if(!m)return '';return '<p class="media-credit">'+esc(m.author||'Автор указан в источнике')+' · <a target="_blank" rel="noopener" href="'+esc(m.source)+'">Источник</a> · <a target="_blank" rel="noopener" href="'+esc(m.licenseUrl||m.source)+'">'+esc(m.license)+'</a></p>';}
function sessionHead(s,extra){$('sessionCount').textContent=(extra||(s.cat?CATS[s.cat].head:({photo:'ПО ФОТО',audio:'ПО ГОЛОСУ',names:'НАЗВАНИЯ'}[s.mode])))+(s.title?' · '+s.title:'');}
function canKnow(s){return !(s.mode==='names'&&s.language==='ru');}
// Status and level controls: the same block on the card back and in the species window.
function progressControls(b,st){const lv=st.level;let cells='';for(let i=1;i<=10;i++)cells+='<button type="button" class="pc-cell'+(i<=lv?' on':'')+'" data-pc-level="'+(i===lv?i-1:i)+'" aria-label="Уровень '+i+'"'+(i===lv?' aria-pressed="true"':'')+'></button>';
 return '<div class="pc" data-pc="'+esc(b.id)+'"><div class="pc-status" role="group" aria-label="Статус вида">'+C.STATUSES.map(x=>'<button type="button" class="pc-s '+x+'" data-pc-status="'+x+'" aria-pressed="'+(st.status===x)+'">'+C.LABELS[x]+'</button>').join('')+'</div>'+
  '<div class="pc-level" role="group" aria-label="Уровень изученности"><button type="button" class="pc-step" data-pc-level="'+Math.max(0,lv-1)+'" aria-label="Уровень ниже"'+(lv<=0?' disabled':'')+'>−</button><span class="pc-meter">'+cells+'</span><button type="button" class="pc-step" data-pc-level="'+Math.min(10,lv+1)+'" aria-label="Уровень выше"'+(lv>=10?' disabled':'')+'>+</button><span class="pc-num"><b>'+lv+'</b>/10</span></div></div>';}
function applyControl(id,what,value){if(!own())return;const b=BIRDS.find(x=>x.id===id);if(!b)return;const s=session&&!session.choose&&currentBird(session)===b?session:null,k=key(b,s?s.mode:mode,s?s.language:language);
 saveState(k,what==='status'?C.setStatus(states[k],value,Date.now()):C.setLevel(states[k],value,Date.now()));render();
 if(s)renderCard();const box=[...$('infoBody').querySelectorAll('[data-pc]')].find(e=>e.dataset.pc===id);if(box&&$('infoDialog').open)box.outerHTML=progressControls(b,state(b));}
function renderChooser(){const s=session;sessionHead(s,'ЧТО УЧИМ');const n=sessionPool(s).length;
 $('cardBody').innerHTML='<h2 id="cardTitle" class="fc-title">'+esc(s.title||'Выбранная ветка')+'</h2><p class="session-results">'+n+' '+C.word(n)+' в ветке. Карточки берутся случайно из выбранной группы; чем чаще вид попадался сегодня, тем реже он выпадает.</p><div class="fc-choose">'+
  [['learning','Повторить изучаемое','review'],['known','Повторить известное','known'],['unknown','Изучить новый вид','learn']].map(([c,l,cls])=>{const k=catCount(s,c);return '<button type="button" class="action '+cls+'" data-act="cat" data-cat="'+c+'"'+(k?'':' disabled')+'><span>'+l+'</span><strong>'+k+'</strong></button>';}).join('')+'</div>';
 $('cardBody').querySelector('[data-act="cat"]:not(:disabled)')?.focus({preventScroll:true});}
function renderCard(){const s=session;if(!s)return;stopAudio();
 if(s.choose){renderChooser();return;}
 if(s.kdone){renderKnown();return;}
 const b=currentBird(s);if(!b){renderDone();return;}
 const sm=s.mode,st=C.clean(states[key(b,sm,s.language)]),latinPrompt=sm==='names'&&s.language==='ru',left=s.cat?catCount(s,s.cat):0,today=C.todayCount(st,Date.now());s.blocked=false;
 if(!(b.id in s.media))s.media[b.id]=sm==='photo'?pickOne(b.photos):sm==='audio'?pickOne(b.audio):null;
 const m=s.media[b.id];
 sessionHead(s);
 let h='<div class="fc-meta"><span>'+(s.cat?'в группе '+left+' '+C.word(left):'один вид')+'</span><span>показано '+s.shown+(today>1?' · этот вид сегодня '+today+'-й раз':'')+'</span></div><div class="fc-bar"><span style="width:'+(s.fixed?100:Math.min(100,Math.round(s.round/batchSize*100)))+'%"></span></div>'+
  '<h2 id="cardTitle" class="fc-title">'+(sm==='names'?'Вспомни название':'Кто это?')+'</h2>';
 if(sm==='photo')h+=m?'<div class="card-media fc-front"><img src="'+esc(m.src)+'" alt="Птица для определения"></div>':'<p class="error-media">Для этого вида пока нет фотографии.</p>';
 else if(sm==='audio')h+=m?'<div class="card-media fc-front"><div class="audio-question"><div class="audio-mark" aria-hidden="true">▂▅▇▃▆</div><audio controls preload="none" src="'+esc(m.src)+'" aria-label="Голос птицы для определения"></audio><p>Послушай запись и вспомни вид.</p></div></div>':'<p class="error-media">Для этого вида пока нет записи голоса.</p>';
 else h+='<div class="fc-prompt'+(latinPrompt?' latin':'')+'">'+esc(latinPrompt?C.latinLabel(b.latin):b.ru)+'</div>';
 if(!s.flipped&&s.kbox)h+='<form class="kbox" id="knownForm" autocomplete="off"><label for="knownIn">Напиши латинское название</label><div class="kbox-row"><input id="knownIn" type="text" lang="la" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Genus species"><button type="submit" class="reveal">Проверить</button></div><button type="button" class="linkbtn" data-act="kcancel">Отмена</button></form>';
 if(s.flipped){
  if(s.kres)h+='<div class="kres" role="status">Ты написал: <b>'+esc(s.kres)+'</b> — не совпадает. Статус и уровень не изменились.</div>';
  h+='<div class="fc-answer">'+(sm!=='photo'&&b.photos[0]?'<div class="card-media fc-photo"><img src="'+esc(b.photos[0].src)+'" alt="'+esc(b.ru)+'"></div>':'')+'<h3>'+esc(b.ru)+'</h3>'+names(b)+(window.BirdEtymology?window.BirdEtymology.render(b):'')+(window.BirdBiology?window.BirdBiology.render(b,{audio:false}):'')+credit(m||(sm!=='photo'?b.photos[0]:null))+'</div>';
 }
 h+='<div class="fc-actions'+(s.flipped?' sticky':'')+'">';
 if(s.flipped)h+=progressControls(b,st)+'<div class="fc-row fc-nav"><button type="button" class="quiet" data-act="back"'+(s.at>0?'':' disabled')+'>← Назад</button><button type="button" class="reveal" data-act="next">'+(s.fixed&&s.at>=s.hist.length-1?'Готово':'Дальше')+'</button></div>';
 else h+='<button type="button" class="reveal fc-show" data-act="flip">Показать ответ</button>';
 h+='</div><div class="fc-row">'+(s.flipped?'':'<button type="button" class="quiet" data-act="back"'+(s.at>0?'':' disabled')+'>← Назад</button>')+
  (canKnow(s)&&!s.flipped?'<button type="button" class="quiet fc-know" data-act="kopen"'+(s.kbox?' disabled':'')+' title="Впиши латинское название: если верно — статус «Знаю» и уровень 10">Я знаю</button>':'')+
  '<button type="button" class="quiet" data-act="end">Завершить</button></div>'+
  '<p class="fc-hint">'+(s.flipped?'1–3 — статус, −/+ — уровень, Enter — дальше':'Пробел — показать ответ')+'</p>';
 $('cardBody').innerHTML=h;$('cardDialog').scrollTop=0;
 const fail=()=>{if(session!==s||currentBird(s)!==b||s.flipped||s.blocked)return;s.blocked=true;const a=$('cardBody').querySelector('.fc-actions');if(a)a.innerHTML='<p class="error-media">Материал не загрузился. Пропусти карточку — статус и уровень не изменятся.</p><button type="button" class="reveal" data-act="next">Пропустить</button>';};
 $('cardBody').querySelector('.fc-front img')?.addEventListener('error',fail,{once:true});$('cardBody').querySelector('.fc-front audio')?.addEventListener('error',fail,{once:true});
 if(sm!=='names'&&!m)fail();
 const f=$('cardBody').querySelector(s.blocked?'[data-act="next"]':!s.flipped&&s.kbox?'#knownIn':s.flipped?'[data-act="next"]':'[data-act="flip"]');f?.focus({preventScroll:true});
}
function flip(){const s=session;if(!s||s.choose||s.flipped||s.kbox||s.blocked||!currentBird(s))return;s.flipped=true;renderCard();}
function back(){const s=session;if(!s||s.at<=0)return;s.at--;s.flipped=true;s.kbox=false;s.kres='';s.kdone=null;renderCard();}
function latinAnswers(b){const out=new Set([C.normalizeAnswer(b.latin)]);for(const a of [b.aliases].flat(2).concat(Object.values(b.aliases&&!Array.isArray(b.aliases)?b.aliases:{}).flat()))if(typeof a==='string'&&/^[A-Z][a-z]+ [a-z-]+$/.test(a.trim()))out.add(C.normalizeAnswer(a));return out;}
function checkKnown(){const s=session;if(!s||s.flipped||!s.kbox)return;const b=currentBird(s);if(!b)return;const typed=($('knownIn')?.value||'').trim();if(!typed){$('knownIn')?.focus();return;}
 s.kbox=false;s.flipped=true;
 if(latinAnswers(b).has(C.normalizeAnswer(typed))){const k=key(b,s.mode,s.language);s.kprev=C.clean(states[k]);s.kdone={b,typed};saveState(k,C.setLevel(C.setStatus(states[k],'known',Date.now()),10,Date.now()));render();renderCard();}else{s.kres=typed;renderCard();}}
function undoKnown(){const s=session;if(!s||!s.kdone)return;const b=s.kdone.b;saveState(key(b,s.mode,s.language),{...s.kprev,updatedAt:Date.now()});s.kdone=null;s.kprev=null;render();renderCard();}
function renderKnown(){const s=session,b=s.kdone.b;sessionHead(s);
 $('cardBody').innerHTML='<div class="kok" role="status"><div class="kok-ico" aria-hidden="true">✓</div><h2 id="cardTitle" class="kok-t">Засчитано</h2><div class="kok-w"><span>'+esc(b.ru)+'</span><b class="latin">'+esc(b.latin)+'</b></div><p>Вид переведён в «Знаю» с уровнем 10. Теперь он будет попадаться в «Повторить известное».</p></div>'+
  '<div class="fc-row"><button type="button" class="quiet" data-act="kundo">Отменить</button><button type="button" class="reveal" data-act="next">Дальше</button></div>';
 $('cardBody').querySelector('[data-act="next"]').focus({preventScroll:true});}
function renderDone(roundOver=false){const s=session;if(!s)return;s.kdone=null;const now=Date.now(),seenIds=[...new Set(s.hist)],left=s.cat?catCount(s,s.cat):0;sessionHead(s,'ИТОГ');
 const rows=seenIds.map(id=>{const b=BIRDS.find(x=>x.id===id),st=C.clean(states[key(b,s.mode,s.language)]);return '<li><span>'+esc(b.ru)+'</span><em class="latin">'+esc(b.latin)+'</em><b class="st-'+st.status+'">'+C.LABELS[st.status]+' · '+st.level+'/10</b></li>';}).join('');
 const why=roundOver?'Круг из '+batchSize+' карточек пройден.':s.cat&&!left?'В этой группе больше нет видов.':'Занятие завершено.';
 $('cardBody').innerHTML='<div class="fc-done"><h2 id="cardTitle">'+(roundOver?'Круг пройден':'Готово')+'</h2><p class="session-results">'+why+' Показано карточек: '+s.shown+', видов: '+seenIds.length+'.</p>'+(rows?'<ol class="fc-list">'+rows+'</ol>':'')+'</div>'+
  '<div class="fc-row">'+(s.hist.length?'<button type="button" class="quiet" data-act="back">← Назад</button>':'')+(roundOver&&left?'<button type="button" class="quiet" data-act="more">Ещё круг</button>':'')+'<button type="button" class="reveal" id="doneBtn" data-act="close">Закрыть</button></div>';
 s.at=s.hist.length;$('doneBtn').focus({preventScroll:true});}
async function saveState(k,v){if(!own()||session&&session.uid!==uid)return;states[k]=v;write('progress:'+uid,states);if(me){const pending=read('pending:'+uid,{});pending[k]=v;write('pending:'+uid,pending);await syncPending();}}
async function syncPending(){if(!db||!me||uid!==me.uid||!cloudReady)return;const saveUid=me.uid,pending=read('pending:'+saveUid,{});if(!Object.keys(pending).length)return;
 cloudState='Сохраняю прогресс…';showNotice();try{const batch=db.batch();for(const[k,v]of Object.entries(pending).slice(0,400))batch.set(db.doc('profiles/'+saveUid+'/birdProgress/'+k),v);await batch.commit();const currentPending=read('pending:'+saveUid,{});for(const[k,v]of Object.entries(pending).slice(0,400))if(currentPending[k]?.updatedAt===v.updatedAt)delete currentPending[k];write('pending:'+saveUid,currentPending);if(me?.uid===saveUid){cloudState='Прогресс сохранён в аккаунте.';showNotice();}}catch(e){if(me?.uid===saveUid){cloudState=e.code==='permission-denied'?'На этом устройстве сохранено. Облачный доступ к карточкам птиц ещё не включён.':'На этом устройстве сохранено. Синхронизация повторится при подключении.';showNotice();}}}
function finishSession(){stopAudio();if(!session)return;session=null;if($('cardDialog').open)closeDialog('cardDialog');render();}
function names(b){return '<dl class="bird-names"><dt>англ.</dt><dd class="name-en">'+esc(b.en)+'</dd><dt>лат.</dt><dd class="name-latin latin">'+esc(C.latinLabel(b.latin))+'</dd><dt>пол.</dt><dd class="name-pl">'+esc(b.pl)+'</dd></dl>';}
function info(title,html){$('infoTitle').textContent=title;$('infoBody').innerHTML=html;openDialog('infoDialog');}
function detail(b){info(b.ru,(b.photos[0]?'<div class="card-media"><img src="'+esc(b.photos[0].src)+'" alt="'+esc(b.ru)+'"></div>':'')+names(b)+(b.importSource?'<p class="fact">Польша: '+esc(b.polandStatus)+'. <a href="'+esc(b.importSource)+'" target="_blank" rel="noopener">Источник списка</a></p>':'')+'<p class="fact">'+esc(b.tip||'')+'</p>'+(window.BirdBiology?window.BirdBiology.render(b):(b.audio[0]?'<h3>Голос</h3><audio controls preload="none" src="'+esc(b.audio[0].src)+'" style="width:100%"></audio>':''))+b.photos.concat(window.BirdBiology?[]:b.audio).map(credit).join('')+''+(own()?'<h3 class="pc-title">Мой прогресс · '+({photo:'по фото',audio:'по голосу',names:'названия'}[mode])+'</h3>'+progressControls(b,state(b)):'')+'<div class="detail-actions">'+(own()?'<button class="quiet" data-start-bird="'+b.id+'"'+(!available(b)?' disabled':'')+'>Учить в этом режиме</button>':'<p>Доступен только просмотр чужого прогресса.</p>')+'</div>');}
function renderProfiles(){const opts=me?profiles:[];$('profileSelect').innerHTML=me?opts.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===uid?' selected':'')+'>'+esc(p.name)+(p.id===me.uid?' (я)':'')+'</option>').join(''):'<option value="guest">Гость (это устройство)</option>';$('profileSelect').disabled=!me;$('backToMe').hidden=own();$('accountBtn').textContent=me?'Аккаунт':'Войти';}
function selectProfile(next){if(session)finishSession(false);const token=++loadToken;unsubProgress?.();unsubProgress=null;uid=next;states=cleanMap(read('progress:'+uid,{}));cloudReady=false;renderProfiles();render();if(!me||!db)return;
 cloudState='Загружаю прогресс…';showNotice();unsubProgress=db.collection('profiles/'+uid+'/birdProgress').onSnapshot(q=>{if(token!==loadToken)return;const cloud={};q.forEach(doc=>{if(validKeys.has(doc.id))cloud[doc.id]=C.clean(doc.data());});const pending=uid===me.uid?cleanMap(read('pending:'+uid,{})):{};states={...cloud,...pending};cloudReady=true;write('progress:'+uid,states);cloudState='Прогресс загружен.';render();syncPending();},e=>{if(token!==loadToken)return;cloudReady=false;cloudState=own()?'Облачный доступ к птицам ещё не включён. Можно заниматься локально.':'Прогресс этого ученика пока недоступен.';render();});}
function nickToEmail(n){n=n.trim().toLowerCase();if(/^[a-z0-9._-]+$/.test(n))return n+'@users.skilltree.app';return 'x-'+Array.from(new TextEncoder().encode(n)).map(b=>b.toString(16).padStart(2,'0')).join('')+'@users.skilltree.app';}
function authError(e){return ({'auth/invalid-credential':'Неверный ник или пароль.','auth/email-already-in-use':'Ник уже занят. Попробуй войти.','auth/weak-password':'Пароль должен содержать не меньше 6 символов.','auth/too-many-requests':'Слишком много попыток. Попробуй позже.','auth/network-request-failed':'Нет связи с сервером.'})[e.code]||'Не удалось войти. Проверь данные и подключение.';}
function account(){if(me){info('Аккаунт','<p>Ты вошёл как <strong>'+esc(profiles.find(p=>p.id===me.uid)?.name||'Ученик')+'</strong>. Аккаунт общий с сайтом английского; прогресс птиц хранится отдельно.</p><div class="settings-actions"><button class="quiet" id="importGuest">Перенести гостевой прогресс</button><button class="quiet" id="logout">Выйти</button></div><p id="accountMessage" role="status"></p>');return;}
 info('Вход в Bird Atlas','<p>Используй тот же ник и пароль, что на сайте английского.</p><form class="auth-form" id="birdAuth"><label>Ник<input id="nick" name="username" autocomplete="username" minlength="2" maxlength="15" required></label><label>Пароль<input id="password" name="password" type="password" autocomplete="current-password" minlength="6" required></label><p id="authError" role="alert"></p><div class="auth-actions"><button type="submit" id="loginSubmit">Войти</button><button type="button" id="register">Создать аккаунт</button></div></form><p class="fact">Без входа все занятия тоже работают, но прогресс остаётся на этом устройстве.</p>');}
async function doAuth(register=false){if(!auth){$('authError').textContent='Сервис входа недоступен. Заниматься можно без регистрации.';return;}const form=$('birdAuth');if(!form.reportValidity())return;const nick=$('nick').value.trim(),password=$('password').value;if(/[\s@]/.test(nick)){$('authError').textContent='В нике не должно быть пробелов и @.';return;}form.querySelectorAll('button').forEach(b=>b.disabled=true);try{const r=await auth[register?'createUserWithEmailAndPassword':'signInWithEmailAndPassword'](nickToEmail(nick),password);if(register)await db.doc('profiles/'+r.user.uid).set({name:nick,createdAt:Date.now()},{merge:true});if($('infoDialog').open)closeDialog('infoDialog');}catch(e){if($('authError'))$('authError').textContent=authError(e);}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function settings(){info('Настройки занятия','<label class="settings-row">Карточек в одном круге<input id="batchSize" type="number" min="5" max="50" step="5" value="'+batchSize+'"></label><p class="fact">Фото, голоса и названия на каждом языке имеют независимый прогресс. Статус и уровень ставишь сам: в карточке после ответа или в окне вида.</p><div class="settings-actions"><button class="quiet" id="saveSettings">Сохранить</button><button class="quiet" id="exportProgress">Экспорт прогресса</button><button class="quiet" id="importProgress"'+(!own()?' disabled':'')+'>Импорт прогресса</button><input type="file" id="progressFile" accept="application/json" hidden></div><p id="settingsMessage" role="status"></p>');}
function exportProgress(){const data={app:'european-birds',version:1,exportedAt:new Date().toISOString(),progress:states};const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='european-birds-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importProgress(file){if(!own()||!file)return;try{if(file.size>2_000_000)throw Error('Файл слишком большой.');const x=JSON.parse(await file.text());if(x.app!=='european-birds'||x.version!==1)throw Error('Это не файл прогресса Bird Atlas.');const imported=cleanMap(x.progress);for(const[k,v]of Object.entries(imported))if(!states[k]||states[k].updatedAt<v.updatedAt)states[k]=v;write('progress:'+uid,states);if(me){write('pending:'+uid,{...read('pending:'+uid,{}),...states});syncPending();}render();$('settingsMessage').textContent='Импортировано '+Object.keys(imported).length+' карточек. Более свежий прогресс сохранён.';}catch(e){$('settingsMessage').textContent=e.message||'Не удалось прочитать файл.';}}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
async function initCloud(){if(new URLSearchParams(location.search).get('offline')==='1')return;try{for(const p of ['app','auth','firestore'])await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-'+p+'-compat.js');firebase.initializeApp(window.BIRD_FIREBASE_CONFIG);db=firebase.firestore();auth=firebase.auth();auth.onAuthStateChanged(user=>{me=user;unsubProfiles?.();unsubProfiles=null;if(!user){profiles=[];selectProfile('guest');return;}profiles=[{id:user.uid,name:user.displayName||(user.email||'').split('@')[0]}];selectProfile(user.uid);unsubProfiles=db.collection('profiles').onSnapshot(q=>{profiles=q.docs.map(d=>({id:d.id,name:String(d.data().name||'Ученик')}));if(!profiles.some(p=>p.id===me?.uid))profiles.unshift({id:user.uid,name:(user.email||'').split('@')[0]});profiles.sort((a,b)=>a.id===user.uid?-1:b.id===user.uid?1:a.name.localeCompare(b.name));renderProfiles();},()=>renderProfiles());});}catch{notice('Вход сейчас недоступен. Занимайся без регистрации: прогресс сохраняется здесь.');}}
// Events are delegated so card re-rendering does not duplicate listeners.
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('language').addEventListener('change',()=>{language=$('language').value;write('settings',{...read('settings',{}),testLanguage:language});render();});$('groups').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){group=b.dataset.group;renderGroups();render();}});$('statusFilter').addEventListener('change',renderCatalog);$('birdGrid').addEventListener('click',e=>{const b=e.target.closest('[data-bird]');if(b)detail(BIRDS.find(x=>x.id===b.dataset.bird));});
$('cardDialog').addEventListener('click',e=>{const a=e.target.closest('[data-act],[data-pc-status],[data-pc-level]');if(!a||a.disabled||!session)return;
 if(a.dataset.pcStatus||a.dataset.pcLevel){const id=a.closest('[data-pc]')?.dataset.pc;if(a.dataset.pcStatus)applyControl(id,'status',a.dataset.pcStatus);else applyControl(id,'level',Number(a.dataset.pcLevel));return;}
 const act=a.dataset.act;if(act==='flip')flip();else if(act==='next')advance();else if(act==='back')back();else if(act==='kopen'){session.kbox=true;renderCard();}else if(act==='kcancel'){session.kbox=false;renderCard();}else if(act==='kundo')undoKnown();
 else if(act==='cat'){session.choose=false;session.cat=a.dataset.cat;advance();}else if(act==='more'){session.round=0;advance();}else if(act==='end')renderDone();else if(act==='close')finishSession();});
$('cardDialog').addEventListener('submit',e=>{if(e.target.id==='knownForm'){e.preventDefault();checkKnown();}});
$('closeCard').addEventListener('click',()=>{if(session)finishSession();else closeDialog('cardDialog');});$('cardDialog').addEventListener('cancel',()=>{stopAudio();session=null;render();});$('closeInfo').addEventListener('click',()=>{stopAudio();closeDialog('infoDialog');});$('infoDialog').addEventListener('cancel',stopAudio);
$('profileSelect').addEventListener('change',()=>selectProfile($('profileSelect').value));$('backToMe').addEventListener('click',()=>me&&selectProfile(me.uid));$('accountBtn').addEventListener('click',account);$('settingsBtn').addEventListener('click',settings);
$('helpBtn').addEventListener('click',()=>info('Как устроено изучение','<p>У каждого вида есть статус и уровень. Их ставишь ты сам — в карточке после ответа или в окне вида из дерева и каталога. Фото, голоса и названия на каждом языке имеют отдельный прогресс.</p><ul><li><b>Не знаю</b> — вид ещё не изучался. Все новые виды начинают отсюда.</li><li><b>Изучаю</b> — вид в работе.</li><li><b>Знаю</b> — вид выучен, его нужно только иногда освежать.</li></ul><p>Уровень 0–10 — твоя оценка, насколько уверенно узнаёшь вид. Он не меняет статус и не меняется сам.</p><p>Три кнопки на дереве птиц берут карточки из открытой ветки и своей группы: «Повторить изучаемое» — из «Изучаю», «Повторить известное» — из «Знаю», «Изучить новый вид» — из «Не знаю». Вид выбирается случайно, но каждый показ сегодня делает его заметно реже: второй показ — в 4 раза, третий — в 9 раз. Виды, которые давно не попадались, выпадают чаще. На верхнем уровне дерева это все виды с учётом фильтров; спустись в отряд или семейство, чтобы повторять только его.</p><ol><li>Посмотри на фото, послушай голос или прочитай название и вспомни вид.</li><li>«Показать ответ» (или пробел): откроются все названия, биотоп и голос.</li><li>Отметь статус (клавиши 1–3) и уровень (−/+), затем «Дальше» (Enter).</li></ol><p>«Я знаю» — впиши латинское название до ответа. Если верно, вид получает статус «Знаю» и уровень 10. «← Назад» возвращает к прошлой карточке. Число карточек в одном круге меняется в настройках каталога.</p>'));
$('creditsBtn').addEventListener('click',()=>info('Авторы фото и записей','<p>Фотографии и записи получены из Wikimedia Commons, iNaturalist и xeno-canto; источники каждого материала указаны отдельно. Для каждого сохранены автор, ссылка на оригинал и лицензия. Записи и снимки не созданы ИИ.</p><ol class="credits-list">'+BIRDS.flatMap(b=>b.photos.concat(b.audio).map(m=>'<li><strong>'+esc(b.ru)+'</strong> · '+(m.mime.startsWith('audio')?'аудио':'фото')+credit(m)+'</li>')).join('')+'</ol>'));
$('infoDialog').addEventListener('submit',e=>{if(e.target.id==='birdAuth'){e.preventDefault();doAuth(false);}});
$('infoDialog').addEventListener('click',e=>{const pc=e.target.closest('[data-pc-status],[data-pc-level]');if(pc&&!pc.disabled){const id=pc.closest('[data-pc]').dataset.pc;if(pc.dataset.pcStatus)applyControl(id,'status',pc.dataset.pcStatus);else applyControl(id,'level',Number(pc.dataset.pcLevel));return;}if(e.target.closest('#register'))doAuth(true);if(e.target.closest('#logout'))auth?.signOut().then(()=>closeDialog('infoDialog'));if(e.target.closest('[data-start-bird]')){const b=BIRDS.find(b=>b.id===e.target.closest('[data-start-bird]').dataset.startBird);stopAudio();closeDialog('infoDialog');if(available(b))start(null,b);}
 if(e.target.closest('#saveSettings')){batchSize=Math.max(5,Math.min(50,Number($('batchSize').value)||20));write('settings',{...read('settings',{}),batchSize,testLanguage:language});$('settingsMessage').textContent='Настройки сохранены.';}
 if(e.target.closest('#exportProgress'))exportProgress();if(e.target.closest('#importProgress'))$('progressFile').click();
 if(e.target.closest('#importGuest')&&me&&own()){const guest=cleanMap(read('progress:guest',{}));for(const[k,v]of Object.entries(guest))if(!states[k]||states[k].updatedAt<v.updatedAt)states[k]=v;write('progress:'+uid,states);write('pending:'+uid,{...read('pending:'+uid,{}),...states});syncPending();render();$('accountMessage').textContent='Гостевой прогресс перенесён. Более свежие результаты сохранены.';}
});
$('infoDialog').addEventListener('change',e=>{if(e.target.id==='progressFile')importProgress(e.target.files[0]);});
document.addEventListener('keydown',e=>{const s=session;if(!s||s.choose||s.kdone||!$('cardDialog').open||e.repeat||e.target.matches('input,textarea,select'))return;const b=currentBird(s);if(!b)return;
 if(e.key===' '&&!s.flipped&&!e.target.closest('button')){e.preventDefault();flip();return;}
 if(!s.flipped)return;const st=C.clean(states[key(b,s.mode,s.language)]);
 if(/^[1-3]$/.test(e.key)){e.preventDefault();applyControl(b.id,'status',C.STATUSES[Number(e.key)-1]);}
 else if(e.key==='+'||e.key==='='){e.preventDefault();applyControl(b.id,'level',Math.min(10,st.level+1));}
 else if(e.key==='-'||e.key==='_'){e.preventDefault();applyControl(b.id,'level',Math.max(0,st.level-1));}
 else if(e.key==='Enter'&&!e.target.closest('button')){e.preventDefault();advance();}});
window.addEventListener('online',syncPending);window.addEventListener('pagehide',stopAudio);
// Shared progress API for the phylogenetic board; no second progress store.
window.BirdAtlas={
 context:()=>({uid,mode,language,own:own()}),
 setScope:ids=>{treeScope=ids?new Set(ids):null;render();},
 state:id=>C.clean(states[key(BIRDS.find(b=>b.id===id))]),
 summary:ids=>C.progress(ids.map(id=>BIRDS.find(b=>b.id===id)).filter(b=>b&&available(b)).map(state)),
 available:id=>available(BIRDS.find(b=>b.id===id)),
 detail:id=>detail(BIRDS.find(b=>b.id===id)),
 study:(ids,title,cat)=>study(ids,title,cat),
 // Status or level of one species in the current mode, set from the tree rows.
 set:(id,what,value)=>applyControl(id,what,value)
};
states=cleanMap(read('progress:guest',{}));$('language').value=language;renderGroups();renderProfiles();render();initCloud();
})();
