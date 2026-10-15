(()=>{
'use strict';
const $=id=>document.getElementById(id),C=BirdStudy,BIRDS=window.BIRD_DATA||[],PREFIX='europeanBirds:v1:',GROUPS={all:'Все виды',garden:'Сады и парки',forest:'Лесные',urban:'Рядом с человеком',corvid:'Врановые',water:'У воды',wetland:'Луга и болота',raptor:'Хищные',unclassified:'Среда не уточнена'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
function state(b){return states[key(b)]||C.initial();}
const status=C.status;
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function showNotice(){if(!own()){notice('Ты смотришь чужой прогресс. Изменять его нельзя.');return;}if(!me){notice('Гость: прогресс сохраняется на этом устройстве.');return;}notice(cloudState||'Прогресс сохранён в аккаунте.');}
function setMode(next){if(session)finishSession(false);mode=next;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));render();}
function render(){const pool=eligible(),counts=C.progress(pool.map(state)),done=counts.mastered,due=pool.filter(b=>C.due(state(b))).length,newN=counts.new;
 $('speciesCount').textContent=BIRDS.length;$('dueCount').textContent=due;$('newCount').textContent=newN;$('masteredCount').textContent=done;$('totalCount').textContent='/ '+pool.length+' '+C.word(pool.length);
 $('reviewBtn').disabled=!own()||due===0;$('learnBtn').disabled=!own()||newN===0;
 const labels={photo:'Узнаю по фото',audio:'Узнаю по голосу',names:'Помню названия'};$('progressTitle').textContent=labels[mode];
 const meta=[['new','Новые','none'],['learning','Изучаю','learn'],['review','Повторяю','review'],['mastered','Выучено','master']];
 $('progressBar').innerHTML=meta.map(([s,,color])=>'<span style="width:'+(pool.length?counts[s]/pool.length*100:0)+'%;background:var(--'+color+')"></span>').join('');$('progressBar').setAttribute('aria-label',meta.map(([s,l])=>l+': '+counts[s]).join(', '));
 $('legend').innerHTML=meta.map(([s,l,color])=>'<span><i class="dot" style="background:var(--'+color+')"></i>'+l+' '+counts[s]+'</span>').join('');
 $('modeNote').textContent=mode==='photo'?'Посмотри на фото и вспомни вид, затем открой ответ и оцени себя.':mode==='audio'?'Послушай голос и вспомни вид, затем открой ответ и оцени себя.':language==='ru'?'Латинское название -> вспомни русское и остальные названия.':'Русское название -> вспомни '+({en:'английское',latin:'латинское',pl:'польское'}[language])+' и остальные названия.';
 renderCatalog();showNotice();window.dispatchEvent(new CustomEvent('birdatlas:render'));
}
function renderCatalog(){const sf=$('statusFilter').value;
 const pool=scoped(),visible=pool.filter(b=>sf==='all'||sf===status(state(b)));
 $('resultCount').textContent=visible.length+' из '+pool.length+' '+C.word(pool.length);$('empty').hidden=visible.length>0;
 $('birdGrid').innerHTML=visible.map(b=>{const s=state(b),p=b.photos[0];return '<button class="bird-tile" data-bird="'+b.id+'" aria-label="'+esc(b.ru)+': карточка вида"><span class="tile-img'+(!p?' placeholder':'')+'">'+(p?'<img src="'+esc(p.src)+'" alt="'+esc(b.ru)+'" loading="lazy" decoding="async">':'Без фото')+(b.audio.length?'<span class="voice-badge">Есть голос</span>':'')+'</span><span class="tile-body"><strong>'+esc(b.ru)+'</strong><em>'+esc(C.latinLabel(b.latin))+'</em><span class="tile-progress"><span>'+({new:'Новое знакомство',learning:'Изучаю',review:'Повторяю',mastered:'Выучено'}[status(s)])+'</span><span>'+s.level+' / 10</span></span><span class="mini-bar"><span style="width:'+(s.level*10)+'%"></span></span></span></button>';}).join('');
}
function renderGroups(){$('groups').innerHTML=Object.entries(GROUPS).map(([id,title])=>'<button data-group="'+id+'" aria-pressed="'+(group===id)+'">'+title+'</button>').join('');}
function openDialog(id){restoreFocus=document.activeElement;$(id).showModal();}
function closeDialog(id){$(id).close();if(restoreFocus?.isConnected)restoreFocus.focus();}
function stopAudio(){document.querySelectorAll('audio').forEach(a=>{a.pause();});}
// Anki-style cards, the same flow as the English site: front, "Показать ответ", four grades.
function pickOne(list){return list.length?list[Math.floor(Math.random()*list.length)]:null;}
function start(kind,bird=null){if(!own()||(bird&&!available(bird)))return;openSession(bird?[bird]:C.queue(eligible(),states,b=>key(b),kind,Date.now(),batchSize),kind==='due'?'Повторение':'Новые виды');}
function study(ids,title){if(!own())return;const set=new Set(ids||[]),pool=BIRDS.filter(b=>set.has(b.id)&&available(b)),now=Date.now();
 let q=pool.length===1?pool:[...pool.filter(b=>C.due(state(b),now)).sort((a,b)=>state(a).due-state(b).due),...C.shuffle(pool.filter(b=>state(b).reps===0))].slice(0,batchSize);
 if(!q.length)q=pool.slice().sort((a,b)=>state(a).due-state(b).due).slice(0,batchSize);
 openSession(q,title);}
function openSession(queue,title){if(session)finishSession(false);if(!queue.length)return;
 session={queue:queue.slice(),wait:[],done:0,skipped:0,seen:[],start:{},hist:[],media:{},flipped:false,kbox:false,kres:'',kdone:null,blocked:false,timer:null,mode,language,uid,title:title||''};
 openDialog('cardDialog');renderCard();}
function credit(m){if(!m)return '';return '<p class="media-credit">'+esc(m.author||'Автор указан в источнике')+' · <a target="_blank" rel="noopener" href="'+esc(m.source)+'">Источник</a> · <a target="_blank" rel="noopener" href="'+esc(m.licenseUrl||m.source)+'">'+esc(m.license)+'</a></p>';}
function sessionHead(s,extra){$('sessionCount').textContent=(extra||({photo:'ПО ФОТО',audio:'ПО ГОЛОСУ',names:'НАЗВАНИЯ'}[s.mode]))+(s.title?' · '+s.title:'');}
function canKnow(s){return !(s.mode==='names'&&s.language==='ru');}
function meter(level){let h='<span class="fc-meter" role="img" aria-label="уровень '+level+' из 10">';for(let i=1;i<=10;i++)h+='<i'+(i<=level?' class="on"':'')+'></i>';return h+'</span>';}
function renderCard(){const s=session;if(!s)return;clearInterval(s.timer);s.timer=null;stopAudio();
 if(s.kdone){renderKnown();return;}
 if(!s.flipped&&!s.kbox&&s.wait.length){const now=Date.now(),ready=s.wait.filter(x=>x.due<=now);if(ready.length){s.wait=s.wait.filter(x=>x.due>now);s.queue.unshift(...ready.map(x=>x.b));}}
 if(!s.queue.length){if(s.wait.length)renderWait();else renderDone();return;}
 const b=s.queue[0],sm=s.mode,st=C.clean(states[key(b,sm,s.language)]),now=Date.now();s.blocked=false;
 if(!(b.id in s.media))s.media[b.id]=sm==='photo'?pickOne(b.photos):sm==='audio'?pickOne(b.audio):null;
 const m=s.media[b.id],total=s.done+s.queue.length+s.wait.length,pct=total?Math.round(s.done/total*100):0,nx=g=>C.ivlLabel(C.schedule(st,g,now).due-now),latinPrompt=sm==='names'&&s.language==='ru';
 sessionHead(s);
 let h='<div class="fc-meta"><span>осталось '+s.queue.length+(s.wait.length?' · ждут '+s.wait.length:'')+'</span><span>готово '+s.done+'</span></div><div class="fc-bar"><span style="width:'+pct+'%"></span></div>'+
  '<h2 id="cardTitle" class="fc-title">'+(sm==='names'?'Вспомни название':'Кто это?')+'</h2>';
 if(sm==='photo')h+=m?'<div class="card-media fc-front"><img src="'+esc(m.src)+'" alt="Птица для определения"></div>':'<p class="error-media">Для этого вида пока нет фотографии.</p>';
 else if(sm==='audio')h+=m?'<div class="card-media fc-front"><div class="audio-question"><div class="audio-mark" aria-hidden="true">▂▅▇▃▆</div><audio controls preload="none" src="'+esc(m.src)+'" aria-label="Голос птицы для определения"></audio><p>Послушай запись и вспомни вид.</p></div></div>':'<p class="error-media">Для этого вида пока нет записи голоса.</p>';
 else h+='<div class="fc-prompt'+(latinPrompt?' latin':'')+'">'+esc(latinPrompt?C.latinLabel(b.latin):b.ru)+'</div>';
 if(!s.flipped&&s.kbox)h+='<form class="kbox" id="knownForm" autocomplete="off"><label for="knownIn">Напиши латинское название</label><div class="kbox-row"><input id="knownIn" type="text" lang="la" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Genus species"><button type="submit" class="reveal">Проверить</button></div><button type="button" class="linkbtn" data-act="kcancel">Отмена</button></form>';
 if(s.flipped){
  if(s.kres)h+='<div class="kres" role="status">Ты написал: <b>'+esc(s.kres)+'</b> — не совпадает, вид не засчитан. Оцени себя как обычно.</div>';
  h+='<div class="fc-answer">'+(sm!=='photo'&&b.photos[0]?'<div class="card-media fc-photo"><img src="'+esc(b.photos[0].src)+'" alt="'+esc(b.ru)+'"></div>':'')+'<h3>'+esc(b.ru)+'</h3>'+names(b)+'<p class="fact">'+esc(b.tip||'Смотри на сочетание признаков: силуэт, окраску, клюв и поведение. Одна фотография не показывает все варианты оперения.')+'</p>'+(window.BirdBiology?window.BirdBiology.render(b,{audio:false}):'')+credit(m||(sm!=='photo'?b.photos[0]:null))+'</div>';
 }
 h+='<div class="fc-level">'+meter(st.level)+'<span>уровень '+st.level+' из 10'+(st.reps&&st.interval?' · интервал '+C.ivlLabel(st.interval*C.DAY):'')+'</span></div><div class="fc-actions'+(s.flipped?' sticky':'')+'">';
 const ti=s.flipped?'':' tabindex="-1"';
 h+='<div class="grades'+(s.flipped?'':' hidden-grades')+'"'+(s.flipped?'':' aria-hidden="true"')+'>'+[['again','Снова'],['hard','Трудно'],['good','Хорошо'],['easy','Легко']].map(([g,l])=>'<button type="button" class="grade '+g+'" data-grade="'+g+'"'+ti+'>'+l+'<small>'+nx(g)+'</small></button>').join('')+'</div>'+
  (s.flipped?'':'<button type="button" class="reveal fc-show" data-act="flip">Показать ответ</button>')+'</div>'+
  '<div class="fc-row"><button type="button" class="quiet" data-act="undo"'+(s.hist.length?'':' disabled')+'>← Предыдущая</button>'+
  (canKnow(s)?'<button type="button" class="quiet fc-know" data-act="kopen"'+(s.flipped||s.kbox?' disabled':'')+' title="Впиши латинское название: если верно — уровень 10, вид не повторяется полгода">Я знаю</button>':'')+'</div>'+
  '<p class="fc-hint">'+(s.flipped?'Клавиши 1–4 — оценка':'Пробел — показать ответ')+'</p>';
 $('cardBody').innerHTML=h;$('cardDialog').scrollTop=0;
 const fail=()=>{if(session!==s||s.queue[0]!==b||s.flipped||s.blocked)return;s.blocked=true;const a=$('cardBody').querySelector('.fc-actions');if(a)a.innerHTML='<p class="error-media">Материал не загрузился. Пропусти карточку — прогресс не изменится.</p><button type="button" class="reveal" data-act="skip">Пропустить</button>';};
 $('cardBody').querySelector('.fc-front img')?.addEventListener('error',fail,{once:true});$('cardBody').querySelector('.fc-front audio')?.addEventListener('error',fail,{once:true});
 if(sm!=='names'&&!m)fail();
 const f=$('cardBody').querySelector(s.blocked?'[data-act="skip"]':!s.flipped&&s.kbox?'#knownIn':s.flipped?'.grade.good':'[data-act="flip"]');f?.focus({preventScroll:true});
}
function flip(){const s=session;if(!s||s.flipped||s.kbox||s.blocked||!s.queue.length)return;s.flipped=true;renderCard();}
function skip(){const s=session;if(!s||!s.blocked||!s.queue.length)return;s.queue.shift();s.skipped++;renderCard();}
function grade(g){const s=session;if(!s||!s.flipped||!s.queue.length||!own()||s.uid!==uid)return;
 const b=s.queue[0],k=key(b,s.mode,s.language),prev=states[k]?{...states[k]}:null;
 s.hist.push({queue:s.queue.slice(),wait:s.wait.slice(),done:s.done,seen:s.seen.slice(),k,prev});
 s.queue.shift();if(!(b.id in s.start))s.start[b.id]=C.clean(prev).level;
 const next=C.schedule(prev,g,Date.now());saveState(k,next);if(!s.seen.includes(b))s.seen.push(b);
 if(g==='again'){s.wait.push({b,due:next.due});s.wait.sort((x,y)=>x.due-y.due);}else s.done++;
 s.flipped=false;s.kbox=false;s.kres='';render();renderCard();}
function undo(){const s=session;if(!s||!s.hist.length||!own()||s.uid!==uid)return;const h=s.hist.pop();
 s.queue=h.queue;s.wait=h.wait;s.done=h.done;s.seen=h.seen;s.flipped=true;s.kbox=false;s.kres='';s.kdone=null;
 saveState(h.k,{...(h.prev?C.clean(h.prev):C.initial()),updatedAt:Date.now()});render();renderCard();}
function latinAnswers(b){const out=new Set([C.normalizeAnswer(b.latin)]);for(const a of [b.aliases].flat(2).concat(Object.values(b.aliases&&!Array.isArray(b.aliases)?b.aliases:{}).flat()))if(typeof a==='string'&&/^[A-Z][a-z]+ [a-z-]+$/.test(a.trim()))out.add(C.normalizeAnswer(a));return out;}
function checkKnown(){const s=session;if(!s||s.flipped||!s.kbox||!s.queue.length)return;const typed=($('knownIn')?.value||'').trim();if(!typed){$('knownIn')?.focus();return;}
 const b=s.queue[0];s.kbox=false;s.flipped=true;
 if(latinAnswers(b).has(C.normalizeAnswer(typed))){s.kdone={b,typed};grade('known');}else{s.kres=typed;renderCard();}}
function renderKnown(){const s=session,b=s.kdone.b;sessionHead(s);
 $('cardBody').innerHTML='<div class="kok" role="status"><div class="kok-ico" aria-hidden="true">✓</div><h2 id="cardTitle" class="kok-t">Засчитано</h2><div class="kok-w"><span>'+esc(b.ru)+'</span><b class="latin">'+esc(b.latin)+'</b></div><p>Вид отмечен как выученный: уровень 10, следующий показ не раньше чем через полгода.</p></div>'+
  '<div class="fc-row"><button type="button" class="quiet" data-act="undo">Отменить</button><button type="button" class="reveal" data-act="knext">Дальше →</button></div>';
 $('cardBody').querySelector('[data-act="knext"]').focus({preventScroll:true});}
function renderWait(){const s=session,n=s.wait.length;sessionHead(s,'ПАУЗА');
 $('cardBody').innerHTML='<div class="wait-box" role="status"><h2 id="cardTitle">Следующая карточка через</h2><div class="wait-n" id="waitN">—</div><p>'+n+' '+C.word(n,['вид ждёт','вида ждут','видов ждут'])+' повтора: после «Снова» карточка возвращается через 10 минут. Можно подождать здесь или закрыть — виды придут в «Повторить», когда подойдёт срок.</p></div>'+
  '<div class="fc-row">'+(s.hist.length?'<button type="button" class="quiet" data-act="undo">← Предыдущая</button>':'')+'<button type="button" class="quiet" data-act="wend">Завершить</button></div>';
 const tick=()=>{if(session!==s||!s.wait.length){clearInterval(s.timer);return;}const ms=s.wait[0].due-Date.now();if(ms<=0){clearInterval(s.timer);s.timer=null;renderCard();return;}const t=Math.ceil(ms/1000),e=$('waitN');if(e)e.textContent=Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
 s.timer=setInterval(tick,1000);tick();}
function renderDone(){const s=session;clearInterval(s.timer);s.timer=null;const now=Date.now(),due=eligible().filter(b=>C.due(state(b),now)).length;sessionHead(s,'ИТОГ');
 const rows=s.seen.map(b=>{const st=C.clean(states[key(b,s.mode,s.language)]);return '<li><span>'+esc(b.ru)+'</span><em class="latin">'+esc(b.latin)+'</em><b>'+s.start[b.id]+' → '+st.level+(st.due>now?' · через '+C.ivlLabel(st.due-now):'')+'</b></li>';}).join('');
 $('cardBody').innerHTML='<div class="fc-done"><h2 id="cardTitle">Занятие завершено</h2><p class="session-results">Видов: '+s.seen.length+(s.skipped?' · пропущено: '+s.skipped:'')+'. Сейчас к повторению: '+due+'.</p>'+(rows?'<ol class="fc-list">'+rows+'</ol>':'')+'</div>'+
  '<div class="fc-row">'+(s.hist.length?'<button type="button" class="quiet" data-act="undo">← Предыдущая</button>':'')+'<button type="button" class="reveal" id="doneBtn" data-act="close">Закрыть</button></div>';
 $('doneBtn').focus({preventScroll:true});}
async function saveState(k,v){if(!own()||session&&session.uid!==uid)return;states[k]=v;write('progress:'+uid,states);if(me){const pending=read('pending:'+uid,{});pending[k]=v;write('pending:'+uid,pending);await syncPending();}}
async function syncPending(){if(!db||!me||uid!==me.uid||!cloudReady)return;const saveUid=me.uid,pending=read('pending:'+saveUid,{});if(!Object.keys(pending).length)return;
 cloudState='Сохраняю прогресс…';showNotice();try{const batch=db.batch();for(const[k,v]of Object.entries(pending).slice(0,400))batch.set(db.doc('profiles/'+saveUid+'/birdProgress/'+k),v);await batch.commit();const currentPending=read('pending:'+saveUid,{});for(const[k,v]of Object.entries(pending).slice(0,400))if(currentPending[k]?.updatedAt===v.updatedAt)delete currentPending[k];write('pending:'+saveUid,currentPending);if(me?.uid===saveUid){cloudState='Прогресс сохранён в аккаунте.';showNotice();}}catch(e){if(me?.uid===saveUid){cloudState=e.code==='permission-denied'?'На этом устройстве сохранено. Облачный доступ к карточкам птиц ещё не включён.':'На этом устройстве сохранено. Синхронизация повторится при подключении.';showNotice();}}}
function finishSession(){stopAudio();if(!session)return;clearInterval(session.timer);session=null;if($('cardDialog').open)closeDialog('cardDialog');render();}
function names(b){return '<dl class="bird-names"><dt>англ.</dt><dd class="name-en">'+esc(b.en)+'</dd><dt>лат.</dt><dd class="name-latin latin">'+esc(C.latinLabel(b.latin))+'</dd><dt>пол.</dt><dd class="name-pl">'+esc(b.pl)+'</dd></dl>';}
function info(title,html){$('infoTitle').textContent=title;$('infoBody').innerHTML=html;openDialog('infoDialog');}
function detail(b){info(b.ru,(b.photos[0]?'<div class="card-media"><img src="'+esc(b.photos[0].src)+'" alt="'+esc(b.ru)+'"></div>':'')+names(b)+(b.importSource?'<p class="fact">Польша: '+esc(b.polandStatus)+'. <a href="'+esc(b.importSource)+'" target="_blank" rel="noopener">Источник списка</a></p>':'')+'<p class="fact">'+esc(b.tip||'')+'</p>'+(window.BirdBiology?window.BirdBiology.render(b):(b.audio[0]?'<h3>Голос</h3><audio controls preload="none" src="'+esc(b.audio[0].src)+'" style="width:100%"></audio>':''))+b.photos.concat(window.BirdBiology?[]:b.audio).map(credit).join('')+'<div class="detail-actions">'+(own()?'<button class="quiet" data-start-bird="'+b.id+'"'+(!available(b)?' disabled':'')+'>Учить в этом режиме</button>':'<p>Доступен только просмотр чужого прогресса.</p>')+'</div>');}
function renderProfiles(){const opts=me?profiles:[];$('profileSelect').innerHTML=me?opts.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===uid?' selected':'')+'>'+esc(p.name)+(p.id===me.uid?' (я)':'')+'</option>').join(''):'<option value="guest">Гость (это устройство)</option>';$('profileSelect').disabled=!me;$('backToMe').hidden=own();$('accountBtn').textContent=me?'Аккаунт':'Войти';}
function selectProfile(next){if(session)finishSession(false);const token=++loadToken;unsubProgress?.();unsubProgress=null;uid=next;states=cleanMap(read('progress:'+uid,{}));cloudReady=false;renderProfiles();render();if(!me||!db)return;
 cloudState='Загружаю прогресс…';showNotice();unsubProgress=db.collection('profiles/'+uid+'/birdProgress').onSnapshot(q=>{if(token!==loadToken)return;const cloud={};q.forEach(doc=>{if(validKeys.has(doc.id))cloud[doc.id]=C.clean(doc.data());});const pending=uid===me.uid?cleanMap(read('pending:'+uid,{})):{};states={...cloud,...pending};cloudReady=true;write('progress:'+uid,states);cloudState='Прогресс загружен.';render();syncPending();},e=>{if(token!==loadToken)return;cloudReady=false;cloudState=own()?'Облачный доступ к птицам ещё не включён. Можно заниматься локально.':'Прогресс этого ученика пока недоступен.';render();});}
function nickToEmail(n){n=n.trim().toLowerCase();if(/^[a-z0-9._-]+$/.test(n))return n+'@users.skilltree.app';return 'x-'+Array.from(new TextEncoder().encode(n)).map(b=>b.toString(16).padStart(2,'0')).join('')+'@users.skilltree.app';}
function authError(e){return ({'auth/invalid-credential':'Неверный ник или пароль.','auth/email-already-in-use':'Ник уже занят. Попробуй войти.','auth/weak-password':'Пароль должен содержать не меньше 6 символов.','auth/too-many-requests':'Слишком много попыток. Попробуй позже.','auth/network-request-failed':'Нет связи с сервером.'})[e.code]||'Не удалось войти. Проверь данные и подключение.';}
function account(){if(me){info('Аккаунт','<p>Ты вошёл как <strong>'+esc(profiles.find(p=>p.id===me.uid)?.name||'Ученик')+'</strong>. Аккаунт общий с сайтом английского; прогресс птиц хранится отдельно.</p><div class="settings-actions"><button class="quiet" id="importGuest">Перенести гостевой прогресс</button><button class="quiet" id="logout">Выйти</button></div><p id="accountMessage" role="status"></p>');return;}
 info('Вход в Bird Atlas','<p>Используй тот же ник и пароль, что на сайте английского.</p><form class="auth-form" id="birdAuth"><label>Ник<input id="nick" name="username" autocomplete="username" minlength="2" maxlength="15" required></label><label>Пароль<input id="password" name="password" type="password" autocomplete="current-password" minlength="6" required></label><p id="authError" role="alert"></p><div class="auth-actions"><button type="submit" id="loginSubmit">Войти</button><button type="button" id="register">Создать аккаунт</button></div></form><p class="fact">Без входа все занятия тоже работают, но прогресс остаётся на этом устройстве.</p>');}
async function doAuth(register=false){if(!auth){$('authError').textContent='Сервис входа недоступен. Заниматься можно без регистрации.';return;}const form=$('birdAuth');if(!form.reportValidity())return;const nick=$('nick').value.trim(),password=$('password').value;if(/[\s@]/.test(nick)){$('authError').textContent='В нике не должно быть пробелов и @.';return;}form.querySelectorAll('button').forEach(b=>b.disabled=true);try{const r=await auth[register?'createUserWithEmailAndPassword':'signInWithEmailAndPassword'](nickToEmail(nick),password);if(register)await db.doc('profiles/'+r.user.uid).set({name:nick,createdAt:Date.now()},{merge:true});if($('infoDialog').open)closeDialog('infoDialog');}catch(e){if($('authError'))$('authError').textContent=authError(e);}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function settings(){info('Настройки занятия','<label class="settings-row">Карточек за занятие<input id="batchSize" type="number" min="5" max="50" step="5" value="'+batchSize+'"></label><p class="fact">Фото, голоса и названия на каждом языке имеют независимый прогресс. Уровень 10 означает «выучено», но повторения продолжаются.</p><div class="settings-actions"><button class="quiet" id="saveSettings">Сохранить</button><button class="quiet" id="exportProgress">Экспорт прогресса</button><button class="quiet" id="importProgress"'+(!own()?' disabled':'')+'>Импорт прогресса</button><input type="file" id="progressFile" accept="application/json" hidden></div><p id="settingsMessage" role="status"></p>');}
function exportProgress(){const data={app:'european-birds',version:1,exportedAt:new Date().toISOString(),progress:states};const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='european-birds-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importProgress(file){if(!own()||!file)return;try{if(file.size>2_000_000)throw Error('Файл слишком большой.');const x=JSON.parse(await file.text());if(x.app!=='european-birds'||x.version!==1)throw Error('Это не файл прогресса Bird Atlas.');const imported=cleanMap(x.progress);for(const[k,v]of Object.entries(imported))if(!states[k]||states[k].updatedAt<v.updatedAt)states[k]=v;write('progress:'+uid,states);if(me){write('pending:'+uid,{...read('pending:'+uid,{}),...states});syncPending();}render();$('settingsMessage').textContent='Импортировано '+Object.keys(imported).length+' карточек. Более свежий прогресс сохранён.';}catch(e){$('settingsMessage').textContent=e.message||'Не удалось прочитать файл.';}}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
async function initCloud(){if(new URLSearchParams(location.search).get('offline')==='1')return;try{for(const p of ['app','auth','firestore'])await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-'+p+'-compat.js');firebase.initializeApp(window.BIRD_FIREBASE_CONFIG);db=firebase.firestore();auth=firebase.auth();auth.onAuthStateChanged(user=>{me=user;unsubProfiles?.();unsubProfiles=null;if(!user){profiles=[];selectProfile('guest');return;}profiles=[{id:user.uid,name:user.displayName||(user.email||'').split('@')[0]}];selectProfile(user.uid);unsubProfiles=db.collection('profiles').onSnapshot(q=>{profiles=q.docs.map(d=>({id:d.id,name:String(d.data().name||'Ученик')}));if(!profiles.some(p=>p.id===me?.uid))profiles.unshift({id:user.uid,name:(user.email||'').split('@')[0]});profiles.sort((a,b)=>a.id===user.uid?-1:b.id===user.uid?1:a.name.localeCompare(b.name));renderProfiles();},()=>renderProfiles());});}catch{notice('Вход сейчас недоступен. Занимайся без регистрации: прогресс сохраняется здесь.');}}
// Events are delegated so card re-rendering does not duplicate listeners.
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('language').addEventListener('change',()=>{language=$('language').value;write('settings',{...read('settings',{}),testLanguage:language});render();});$('groups').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){group=b.dataset.group;renderGroups();render();}});$('statusFilter').addEventListener('change',renderCatalog);$('birdGrid').addEventListener('click',e=>{const b=e.target.closest('[data-bird]');if(b)detail(BIRDS.find(x=>x.id===b.dataset.bird));});
$('reviewBtn').addEventListener('click',()=>start('due'));$('learnBtn').addEventListener('click',()=>start('new'));
$('cardDialog').addEventListener('click',e=>{const a=e.target.closest('[data-act],[data-grade]');if(!a||a.disabled||!session)return;if(a.dataset.grade){grade(a.dataset.grade);return;}
 const act=a.dataset.act;if(act==='flip')flip();else if(act==='undo')undo();else if(act==='skip')skip();else if(act==='kopen'){session.kbox=true;renderCard();}else if(act==='kcancel'){session.kbox=false;renderCard();}else if(act==='knext'){session.kdone=null;renderCard();}else if(act==='wend'){session.wait=[];renderDone();}else if(act==='close')finishSession();});
$('cardDialog').addEventListener('submit',e=>{if(e.target.id==='knownForm'){e.preventDefault();checkKnown();}});
$('closeCard').addEventListener('click',()=>{if(session)finishSession();else closeDialog('cardDialog');});$('cardDialog').addEventListener('cancel',()=>{stopAudio();if(session)clearInterval(session.timer);session=null;render();});$('closeInfo').addEventListener('click',()=>{stopAudio();closeDialog('infoDialog');});$('infoDialog').addEventListener('cancel',stopAudio);
$('profileSelect').addEventListener('change',()=>selectProfile($('profileSelect').value));$('backToMe').addEventListener('click',()=>me&&selectProfile(me.uid));$('accountBtn').addEventListener('click',account);$('settingsBtn').addEventListener('click',settings);
$('helpBtn').addEventListener('click',()=>info('Как работают карточки','<p>Карточки устроены как в Anki и на сайте английского. Выбери фото, голоса или названия и группу птиц. «Изучать» открывает новые виды, «Повторить» — те, у которых подошёл срок. В дереве «Учить ветку» берёт виды выбранной ветки.</p><ol><li>Посмотри на фото, послушай голос или прочитай название и вспомни вид.</li><li>Нажми «Показать ответ» (или пробел): откроются русское, латинское с чтением, польское и английское названия, биотоп и голос.</li><li>Оцени себя: «Снова» — карточка вернётся через 10 минут; «Трудно», «Хорошо», «Легко» — через растущее число дней. Под кнопкой видно, когда вид вернётся. Клавиши 1–4 тоже работают.</li></ol><p>«Я знаю» — впиши латинское название до ответа. Если верно, вид получает уровень 10 и не повторяется полгода. «← Предыдущая» отменяет последнюю оценку.</p><p>Уровень 0–10 показывает текущий интервал: 2 — сутки, 5 — неделя, 8 — полтора месяца, 10 — полгода и больше. Фото, голоса и названия на каждом языке имеют отдельный прогресс. Если материал не загрузился, карточку можно пропустить без изменения прогресса.</p>'));
$('creditsBtn').addEventListener('click',()=>info('Авторы фото и записей','<p>Фотографии и записи получены из Wikimedia Commons, iNaturalist и xeno-canto; источники каждого материала указаны отдельно. Для каждого сохранены автор, ссылка на оригинал и лицензия. Записи и снимки не созданы ИИ.</p><ol class="credits-list">'+BIRDS.flatMap(b=>b.photos.concat(b.audio).map(m=>'<li><strong>'+esc(b.ru)+'</strong> · '+(m.mime.startsWith('audio')?'аудио':'фото')+credit(m)+'</li>')).join('')+'</ol>'));
$('infoDialog').addEventListener('submit',e=>{if(e.target.id==='birdAuth'){e.preventDefault();doAuth(false);}});
$('infoDialog').addEventListener('click',e=>{if(e.target.closest('#register'))doAuth(true);if(e.target.closest('#logout'))auth?.signOut().then(()=>closeDialog('infoDialog'));if(e.target.closest('[data-start-bird]')){const b=BIRDS.find(b=>b.id===e.target.closest('[data-start-bird]').dataset.startBird);stopAudio();closeDialog('infoDialog');if(available(b))start('new',b);}
 if(e.target.closest('#saveSettings')){batchSize=Math.max(5,Math.min(50,Number($('batchSize').value)||20));write('settings',{...read('settings',{}),batchSize,testLanguage:language});$('settingsMessage').textContent='Настройки сохранены.';}
 if(e.target.closest('#exportProgress'))exportProgress();if(e.target.closest('#importProgress'))$('progressFile').click();
 if(e.target.closest('#importGuest')&&me&&own()){const guest=cleanMap(read('progress:guest',{}));for(const[k,v]of Object.entries(guest))if(!states[k]||states[k].updatedAt<v.updatedAt)states[k]=v;write('progress:'+uid,states);write('pending:'+uid,{...read('pending:'+uid,{}),...states});syncPending();render();$('accountMessage').textContent='Гостевой прогресс перенесён. Более свежие результаты сохранены.';}
});
$('infoDialog').addEventListener('change',e=>{if(e.target.id==='progressFile')importProgress(e.target.files[0]);});
document.addEventListener('keydown',e=>{const s=session;if(!s||!$('cardDialog').open||e.repeat||e.target.matches('input,textarea,select'))return;if(e.key===' '&&!s.flipped&&!e.target.closest('button')){e.preventDefault();flip();}else if(s.flipped&&!s.kdone&&/^[1-4]$/.test(e.key)){e.preventDefault();grade(['again','hard','good','easy'][Number(e.key)-1]);}});
window.addEventListener('online',syncPending);window.addEventListener('pagehide',stopAudio);
// Shared progress API for the phylogenetic board; no second progress store.
window.BirdAtlas={
 context:()=>({uid,mode,language,own:own()}),
 setScope:ids=>{treeScope=ids?new Set(ids):null;render();},
 state:id=>C.clean(states[key(BIRDS.find(b=>b.id===id))]),
 summary:ids=>C.progress(ids.map(id=>BIRDS.find(b=>b.id===id)).filter(b=>b&&available(b)).map(state)),
 available:id=>available(BIRDS.find(b=>b.id===id)),
 detail:id=>detail(BIRDS.find(b=>b.id===id)),
 study:(ids,title)=>study(ids,title)
};
states=cleanMap(read('progress:guest',{}));$('language').value=language;renderGroups();renderProfiles();render();initCloud();
})();
