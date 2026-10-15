(()=>{
'use strict';
const A=window.BirdAtlas,C=window.BirdStudy,$=id=>document.getElementById(id);
if(!A||!$('treeBoard'))return;
const birds=window.BIRD_DATA;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const taxonomy=window.STUDY_TREE,openStates=new Map(),branches=new Map();
let filteredTree=taxonomy,filteredIds=null;
function leaves(n){return n.rank==='species'?[n.birdId]:(n.children||[]).flatMap(leaves);}
function prune(n,parentMatch=false){
 const q=C.normalizeAnswer($('treeSearch').value),match=parentMatch||!q||C.normalizeAnswer(C.searchNames(n)).includes(q);
 if(n.rank==='species'){
  const region=window.BIRD_REGIONS?.poland?.species?.[n.id],local=$('onlyPoland').checked;
  const seasons=['breeding','passage','winter'].filter((k,i)=>$( ['polandBreeding','polandPassage','polandWinter'][i]).checked);
  if(local&&(!region||(seasons.length&&!seasons.some(k=>region.seasons?.[k]))))return null;
  if(!local&&!$('includeVagrants').checked&&n.vagrant)return null;
  return match?n:null;
 }
 const children=(n.children||[]).map(c=>prune(c,match&&!!q)).filter(Boolean);return children.length?{...n,children}:null;
}
function applyFilters(){filteredTree=prune(taxonomy);filteredIds=filteredTree?leaves(filteredTree):[];A.setScope(filteredIds);}
let quiz=null,view='tree',returnFocus=null;
const dialog=document.createElement('dialog');dialog.id='treeQuiz';dialog.className='tree-quiz';dialog.setAttribute('aria-labelledby','treeQuizTitle');
dialog.innerHTML='<div class="dialog-top"><span id="treeQuizCount" class="eyebrow"></span><button id="closeTreeQuiz" class="close" aria-label="Закрыть тест">×</button></div><h2 id="treeQuizTitle">Кто это?</h2><div id="treeQuizMedia" class="card-media"></div><p id="treeQuizQuestion" class="tree-quiz-question"></p><div id="treeQuizChoices" class="tree-quiz-choices"></div><div id="treeQuizResult" aria-live="polite"></div><button id="nextTreeQuiz" class="reveal" hidden>Следующая птица</button>';
document.body.append(dialog);
function label(s){return s.reps===0?'Новое знакомство':s.level===10?'Выучено':s.level>=5?'Повторяю':'Изучаю';}
function tone(s){return s.reps===0?'new':s.level===10?'mastered':s.level>=5?'review':'learning';}
function card(id){const b=birds.find(b=>b.id===id),s=A.state(id),usable=A.available(id),ctx=A.context();return '<article class="tree-species '+tone(s)+'" data-tree-species="'+id+'"><button class="tree-photo" data-tree-detail="'+id+'" aria-label="Открыть карточку: '+esc(b.ru)+'">'+(b.photos[0]?'<img src="'+esc(b.photos[0].src)+'" alt="'+esc(b.ru)+'" loading="lazy" decoding="async">':'<span>Фото пока нет</span>')+'</button><div class="tree-species-body"><p class="tree-status">'+label(s)+'</p><div class="tree-names"><h3 lang="ru">'+esc(b.ru)+'</h3><p lang="en">'+esc(b.en)+'</p><p lang="la">'+esc(C.latinLabel(b.latin))+'</p><p lang="pl">'+esc(b.pl)+'</p></div><div class="tree-level"><span>Уровень знания</span><strong>'+s.level+'<small> / 10</small></strong></div><div class="tree-meter" role="img" aria-label="Уровень знания '+s.level+' из 10">'+Array.from({length:10},(_,i)=>'<i'+(i<s.level?' class="filled"':'')+'></i>').join('')+'</div><div class="tree-card-actions"><button data-tree-detail="'+id+'">Карточка</button><button data-tree-test="'+id+'"'+(!ctx.own||!usable?' disabled':'')+'>Тест</button></div>'+(!usable?'<p class="tree-missing">Голос пока не добавлен</p>':'')+'</div></article>';}
function branchHTML(n){
 if(n.rank==='species')return card(n.birdId);
 const ids=leaves(n),ctx=A.context(),usable=ids.filter(id=>A.available(id));branches.set(n.id,ids);
 const open=$('treeSearch').value.trim()?true:openStates.has(n.id)?openStates.get(n.id):['class','order','group'].includes(n.rank);
 const heading=n.ru&&n.ru!==n.latin?'<strong>'+esc(n.ru)+'</strong><em>'+esc(C.latinLabel(n.latin))+'</em>':'<span class="taxon-kind">'+(n.rank==='genus'?'РОД':'КЛАДА')+'</span><strong>'+esc(C.latinLabel(n.latin))+'</strong>';
 return '<details class="study-branch rank-'+n.rank+'" data-branch="'+esc(n.id)+'" data-rank="'+n.rank+'"'+(open?' open':'')+'><summary><span class="branch-label">'+heading+'<span class="branch-count">'+ids.length+' '+C.word(ids.length)+'</span></span><button class="branch-test" aria-label="Тест: '+esc(n.ru&&n.ru!==n.latin?n.ru:(n.rank==='genus'?'Род '+n.latin:n.latin))+'" data-test-branch="'+esc(n.id)+'"'+(!ctx.own||!usable.length?' disabled':'')+'>Тест</button></summary><div class="branch-content"><div class="branch-children">'+n.children.map(branchHTML).join('')+'</div></div></details>';
}
function render(){const ctx=A.context(),pool=birds.filter(b=>(!filteredIds||filteredIds.includes(b.id))&&A.available(b.id)),learned=pool.filter(b=>A.state(b.id).level===10).length;
 const langName={ru:'русский',en:'английский',latin:'латынь',pl:'польский'}[ctx.language];branches.clear();
 $('treeBoard').innerHTML='<div class="tree-heading"><div><p class="eyebrow">ЕДИНАЯ ДОСКА · ДЕРЕВО И ТЕСТЫ</p><h2 id="treeTitle">Дерево птиц</h2><p class="tree-subtitle">Раскрой семейство и род, выбери птицу или проверь всю ветку.</p></div><button id="testTitBranch" class="tree-test-button"'+(!ctx.own||!pool.length?' disabled':'')+'>Проверить выборку <span>'+pool.length+' '+C.word(pool.length)+'</span></button></div><div class="tree-toolbar"><span>'+({photo:'По фото',audio:'По голосу',names:'Названия'}[ctx.mode])+' · '+langName+'</span><span>Выучено '+learned+' / '+pool.length+'</span><span class="tree-score-rule">Верно +1 · Ошибка -2</span></div><div class="unified-tree">'+(filteredTree?branchHTML(filteredTree):'<p>Птицы не найдены. Измени фильтры.</p>')+'</div><details class="tree-explanation"><summary>Как читать дерево</summary><p>Ветви показывают принадлежность к отрядам, семействам и родам. Порядок соседних ветвей и длина линий не обозначают степень родства. Показаны воробьинообразные Европы и дополнительные отряды из учебной коллекции. Для дополнительных отрядов состав неполный.</p><p>Таксономия: AviList v2025b; европейский состав: Avibase. Статусы Польши: Komisja Faunistyczna и видовые очерки Ptaki.info. Авторы и лицензии фотографий доступны в карточках.</p><p>Прогресс общий для дерева и тестов, отдельно для каждого режима и языка. Записи голосов доступны только для видов с добавленным аудио.</p></details>';
 if(quiz&&(quiz.context.uid!==ctx.uid||quiz.context.mode!==ctx.mode||quiz.context.language!==ctx.language||!ctx.own))closeQuiz();
}
function setView(next){view=next;$('treeBoard').hidden=view!=='tree';$('catalogSection').hidden=view!=='catalog';$('treeView').setAttribute('aria-pressed',String(view==='tree'));$('catalogView').setAttribute('aria-pressed',String(view==='catalog'));}
function stopAudio(){dialog.querySelectorAll('audio').forEach(a=>a.pause());}
function closeQuiz(){stopAudio();quiz=null;if(dialog.open)dialog.close();if(returnFocus?.isConnected)returnFocus.focus();}
function startQuiz(id,branchIds=null){const ctx=A.context();if(!ctx.own)return;const pool=birds.filter(b=>A.available(b.id)&&(branchIds?branchIds.includes(b.id):!filteredIds||filteredIds.includes(b.id)));const queue=id?pool.filter(b=>b.id===id):C.shuffle(pool);if(!queue.length)return;
 returnFocus=document.activeElement;quiz={context:ctx,queue,index:0,correct:0,rated:0,skipped:0,answered:false,media:null};dialog.showModal();showQuestion();}
function showQuestion(){stopAudio();const q=quiz,b=q.queue[q.index],ctx=q.context;q.answered=false;q.blocked=false;
 $('treeQuizCount').textContent=({photo:'ПО ФОТО',audio:'ПО ГОЛОСУ',names:'НАЗВАНИЯ'}[ctx.mode])+' · '+(q.index+1)+' / '+q.queue.length;
 $('treeQuizTitle').textContent=ctx.mode==='names'?'Вспомни название':'Кто это?';$('treeQuizQuestion').textContent=ctx.mode==='names'?(ctx.language==='ru'?C.latinLabel(b.latin):b.ru):'Выбери вид птицы.';$('treeQuizQuestion').classList.toggle('latin',ctx.mode==='names'&&ctx.language==='ru');
 const media=ctx.mode==='photo'?b.photos:ctx.mode==='audio'?b.audio:[];q.media=media.length?media[Math.floor(Math.random()*media.length)]:null;
 $('treeQuizMedia').innerHTML=ctx.mode==='photo'?'<img src="'+esc(q.media.src)+'" alt="Птица для определения">':ctx.mode==='audio'?'<div class="audio-question"><div class="audio-mark" aria-hidden="true">▂▅▇▃▆</div><audio controls preload="none" src="'+esc(q.media.src)+'" aria-label="Голос птицы для определения"></audio><p>Послушай запись, затем выбери вид.</p></div>':'';
 $('treeQuizResult').innerHTML='';$('nextTreeQuiz').hidden=true;$('nextTreeQuiz').textContent='Следующая птица';
 const options=C.answerChoices(b,window.BIRD_DATA,ctx.language);
 $('treeQuizChoices').innerHTML=options.map(x=>'<button data-tree-answer="'+x.id+'"'+(ctx.language==='latin'?' class="latin"':'')+'>'+esc(ctx.language==='latin'?C.latinLabel(x.latin):x[ctx.language])+'</button>').join('');
 const fail=()=>{if(quiz!==q||q.queue[q.index]!==b||q.answered)return;q.blocked=true;$('treeQuizChoices').querySelectorAll('button').forEach(e=>e.disabled=true);$('treeQuizResult').innerHTML='<p>Материал не загрузился. Пропусти вопрос без изменения уровня.</p>';$('nextTreeQuiz').hidden=false;$('nextTreeQuiz').textContent='Пропустить';};
 $('treeQuizMedia').querySelector('img')?.addEventListener('error',fail,{once:true});$('treeQuizMedia').querySelector('audio')?.addEventListener('error',fail,{once:true});
 $('treeQuizChoices').querySelector('button')?.focus();
}
function answer(id){if(!quiz||quiz.answered||quiz.blocked)return;const q=quiz,b=q.queue[q.index],ok=id===b.id,before=A.state(b.id).level;
 q.answered=true;const after=A.grade(b.id,ok,q.context);if(after===null){closeQuiz();return;}q.rated++;if(ok)q.correct++;
 $('treeQuizChoices').querySelectorAll('button').forEach(e=>{e.disabled=true;e.hidden=e.dataset.treeAnswer!==b.id;e.classList.toggle('correct',e.dataset.treeAnswer===b.id);e.classList.toggle('wrong',!ok&&e.dataset.treeAnswer===id);});
 const m=q.media,source=m?'<p class="media-credit">'+esc(m.author)+' · <a href="'+esc(m.source)+'" target="_blank" rel="noopener">Источник</a> · <a href="'+esc(m.licenseUrl||m.source)+'" target="_blank" rel="noopener">'+esc(m.license)+'</a></p>':'';
 $('treeQuizResult').innerHTML='<div class="tree-answer-result '+(ok?'correct':'wrong')+'"><strong>'+(ok?'Верно!':'Правильный ответ: '+esc(q.context.language==='latin'?C.latinLabel(b.latin):b[q.context.language]))+'</strong><span>Уровень '+before+' -> '+after+' / 10'+(ok?' · +1 за верный ответ':' · −2 за ошибку')+'</span></div><h3>'+esc(b.ru)+'</h3><p class="tree-answer-names">англ. '+esc(b.en)+'<br>лат. <em>'+esc(C.latinLabel(b.latin))+'</em><br>пол. '+esc(b.pl)+'</p><p class="fact">'+esc(b.tip)+'</p>'+source;
 $('nextTreeQuiz').hidden=false;$('nextTreeQuiz').textContent=q.index+1===q.queue.length?'Завершить':'Следующая птица';$('nextTreeQuiz').focus();
}
function nextQuestion(){if(!quiz||(!quiz.answered&&!quiz.blocked))return;if(quiz.blocked)quiz.skipped++;quiz.index++;if(quiz.index<quiz.queue.length){showQuestion();return;}
 const total=quiz.rated,correct=quiz.correct,skipped=quiz.skipped;stopAudio();quiz=null;$('treeQuizMedia').innerHTML='';$('treeQuizQuestion').textContent='';$('treeQuizChoices').innerHTML='';$('treeQuizTitle').textContent='Ветка проверена';$('treeQuizCount').textContent='ДЕРЕВО ПТИЦ';$('treeQuizResult').innerHTML='<div class="tree-quiz-finish"><strong>'+correct+' / '+total+'</strong><p>Верных ответов. Пропущено: '+skipped+'.</p><p>'+(total?'Уровни видов обновлены.':'Уровни не изменены.')+'</p><button id="returnToTree" class="reveal">Вернуться к дереву</button></div>';$('nextTreeQuiz').hidden=true;$('returnToTree').focus();
}
document.addEventListener('click',e=>{if(e.target.closest('#treeView'))setView('tree');if(e.target.closest('#catalogView'))setView('catalog');if(e.target.closest('#testTitBranch'))startQuiz();const detail=e.target.closest('[data-tree-detail]');if(detail)A.detail(detail.dataset.treeDetail);const test=e.target.closest('[data-tree-test]');if(test)startQuiz(test.dataset.treeTest);const choice=e.target.closest('[data-tree-answer]');if(choice)answer(choice.dataset.treeAnswer);if(e.target.closest('#nextTreeQuiz'))nextQuestion();if(e.target.closest('#closeTreeQuiz')||e.target.closest('#returnToTree'))closeQuiz();});
dialog.addEventListener('cancel',()=>{stopAudio();quiz=null;});window.addEventListener('birdatlas:render',render);window.addEventListener('pagehide',stopAudio);

$('treeBoard').addEventListener('toggle',e=>{if(e.target.matches('details[data-branch]')&&e.target.isConnected)openStates.set(e.target.dataset.branch,e.target.open);},true);
for(const id of ['treeSearch','onlyPoland','includeVagrants','polandBreeding','polandPassage','polandWinter'])$(id).addEventListener(id==='treeSearch'?'input':'change',()=>{
 if(id==='onlyPoland'&&!$(id).checked)['polandBreeding','polandPassage','polandWinter'].forEach(k=>$(k).checked=false);
 if(id.startsWith('poland')&&$(id).checked)$('onlyPoland').checked=true;
 applyFilters();
});
document.addEventListener('click',e=>{
 const branch=e.target.closest('[data-test-branch]');if(branch){e.preventDefault();startQuiz(null,branches.get(branch.dataset.testBranch));}
 const depth=e.target.closest('[data-depth]');if(depth){const level=depth.dataset.depth;$('treeBoard').querySelectorAll('details[data-branch]').forEach(d=>{d.open=level==='species'||level==='genus'&&d.dataset.rank!=='genus'||level==='family'&&['class','order','group'].includes(d.dataset.rank);openStates.set(d.dataset.branch,d.open);});}
});
applyFilters();setView('tree');
})();

