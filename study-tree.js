(()=>{
'use strict';
const A=window.BirdAtlas,C=window.BirdStudy,$=id=>document.getElementById(id);
if(!A||!$('treeBoard'))return;
const ids=['coal-tit','marsh-tit','willow-tit','blue-tit','great-tit'];
const birds=ids.map(id=>window.BIRD_DATA.find(b=>b.id===id)).filter(Boolean);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Pruned to the five available species from Johansson et al. (2013), Fig. 1.
// Omitted taxa and branch lengths are not reconstructed by this learning board.
const clades=[
 {label:'Московки и гаички',genera:[{name:'Periparus',label:'Московки',ids:['coal-tit']},{name:'Poecile',label:'Гаички',ids:['marsh-tit','willow-tit']}]},
 {label:'Лазоревки и большие синицы',genera:[{name:'Cyanistes',label:'Лазоревки',ids:['blue-tit']},{name:'Parus',label:'Большие синицы',ids:['great-tit']}]}
];
let quiz=null,view='tree',returnFocus=null;
const dialog=document.createElement('dialog');dialog.id='treeQuiz';dialog.className='tree-quiz';dialog.setAttribute('aria-labelledby','treeQuizTitle');
dialog.innerHTML='<div class="dialog-top"><span id="treeQuizCount" class="eyebrow"></span><button id="closeTreeQuiz" class="close" aria-label="Закрыть тест">×</button></div><h2 id="treeQuizTitle">Кто это?</h2><div id="treeQuizMedia" class="card-media"></div><p id="treeQuizQuestion" class="tree-quiz-question"></p><div id="treeQuizChoices" class="tree-quiz-choices"></div><div id="treeQuizResult" aria-live="polite"></div><button id="nextTreeQuiz" class="reveal" hidden>Следующая птица</button>';
document.body.append(dialog);
function label(s){return s.reps===0?'Новое знакомство':s.level===10?'Выучено':s.level>=5?'Повторяю':'Изучаю';}
function tone(s){return s.reps===0?'new':s.level===10?'mastered':s.level>=5?'review':'learning';}
function card(id){const b=birds.find(b=>b.id===id),s=A.state(id),usable=A.available(id),ctx=A.context();return '<article class="tree-species '+tone(s)+'" data-tree-species="'+id+'"><button class="tree-photo" data-tree-detail="'+id+'" aria-label="Открыть карточку: '+esc(b.ru)+'"><img src="'+esc(b.photos[0].src)+'" alt="'+esc(b.ru)+'" loading="lazy" decoding="async"></button><div class="tree-species-body"><p class="tree-status">'+label(s)+'</p><h3>'+esc(b.ru)+'</h3><p class="tree-latin">'+esc(b.latin)+'</p><div class="tree-level"><span>Уровень знания</span><strong>'+s.level+'<small> / 10</small></strong></div><div class="tree-meter" role="img" aria-label="Уровень знания '+s.level+' из 10">'+Array.from({length:10},(_,i)=>'<i'+(i<s.level?' class="filled"':'')+'></i>').join('')+'</div><div class="tree-card-actions"><button data-tree-detail="'+id+'">Карточка</button><button data-tree-test="'+id+'"'+(!ctx.own||!usable?' disabled':'')+'>Тест</button></div>'+(!usable?'<p class="tree-missing">Голос пока не добавлен</p>':'')+'</div></article>';}
function render(){const ctx=A.context(),pool=birds.filter(b=>A.available(b.id)),learned=pool.filter(b=>A.state(b.id).level===10).length;
 const langName={ru:'русский',en:'английский',latin:'латынь',pl:'польский'}[ctx.language],description=ctx.mode==='photo'?'Узнавание по фото · ответы: '+langName:ctx.mode==='audio'?'Узнавание по голосу · ответы: '+langName:'Названия: '+langName;
 $('treeBoard').innerHTML='<div class="tree-heading"><div><p class="eyebrow">ПЕРВАЯ ВЕТВЬ · PARIDAE</p><h2 id="treeTitle">Дерево синиц</h2><p class="tree-subtitle">Общие предки, разные приметы.</p></div><button id="testTitBranch" class="tree-test-button"'+(!ctx.own||!pool.length?' disabled':'')+'>Проверить синиц <span>'+pool.length+' видов</span></button></div><div class="tree-toolbar"><span>'+description+'</span><span>Выучено '+learned+' / '+pool.length+'</span><span class="tree-score-rule">Верно +1 · Ошибка −2</span></div><div class="phylo-tree"><div class="tree-root"><span class="tree-root-mark" aria-hidden="true">✦</span><div><strong>Синицевые</strong><span>Paridae · общий предок показанных видов</span></div><span class="tree-root-count">5 видов</span></div><ol class="tree-clades">'+clades.map(c=>'<li class="tree-clade"><div class="tree-clade-label">'+c.label+'</div><ol class="tree-genera">'+c.genera.map(g=>'<li class="tree-genus"><div class="tree-genus-label"><strong>'+g.name+'</strong><span>'+g.label+'</span></div><div class="tree-leaves">'+g.ids.map(card).join('')+'</div></li>').join('')+'</ol></li>').join('')+'</ol></div><details class="tree-explanation"><summary>Как читать это дерево</summary><p>Узлы обозначают общих предков. Современные виды находятся на концах ветвей: одна синица не произошла от другой современной синицы.</p><p>Учебная схема сокращена до пяти видов из базы. Остальные синицевые опущены; длина линий не показывает время или генетическое расстояние. Гаички соединены внутри рода Poecile, но это не утверждение, что они ближайшие родственники среди всех видов рода.</p><p>Основа родственных связей: <a href="https://doi.org/10.1016/j.ympev.2013.06.019" target="_blank" rel="noopener">Johansson и соавт., 2013, рис. 1</a>. Длиннохвостая синица (Aegithalidae) находится в другом семействе.</p><p>Уровень относится к выбранному выше режиму. Результат теста сразу сохраняется в тот же прогресс, что и обычные карточки. На 10-м уровне повторения продолжаются.</p></details>';
 if(quiz&&(quiz.context.uid!==ctx.uid||quiz.context.mode!==ctx.mode||quiz.context.language!==ctx.language||!ctx.own))closeQuiz();
}
function setView(next){view=next;$('treeBoard').hidden=view!=='tree';$('catalogSection').hidden=view!=='catalog';$('treeView').setAttribute('aria-pressed',String(view==='tree'));$('catalogView').setAttribute('aria-pressed',String(view==='catalog'));}
function stopAudio(){dialog.querySelectorAll('audio').forEach(a=>a.pause());}
function closeQuiz(){stopAudio();quiz=null;if(dialog.open)dialog.close();if(returnFocus?.isConnected)returnFocus.focus();}
function startQuiz(id){const ctx=A.context();if(!ctx.own)return;const pool=birds.filter(b=>A.available(b.id));const queue=id?pool.filter(b=>b.id===id):C.shuffle(pool);if(!queue.length)return;
 returnFocus=document.activeElement;quiz={context:ctx,queue,index:0,correct:0,rated:0,skipped:0,answered:false,media:null};dialog.showModal();showQuestion();}
function showQuestion(){stopAudio();const q=quiz,b=q.queue[q.index],ctx=q.context;q.answered=false;q.blocked=false;
 $('treeQuizCount').textContent=({photo:'ПО ФОТО',audio:'ПО ГОЛОСУ',names:'НАЗВАНИЯ'}[ctx.mode])+' · '+(q.index+1)+' / '+q.queue.length;
 $('treeQuizTitle').textContent=ctx.mode==='names'?'Вспомни название':'Кто это?';$('treeQuizQuestion').textContent=ctx.mode==='names'?(ctx.language==='ru'?b.latin:b.ru):'Выбери вид птицы.';$('treeQuizQuestion').classList.toggle('latin',ctx.mode==='names'&&ctx.language==='ru');
 const media=ctx.mode==='photo'?b.photos:ctx.mode==='audio'?b.audio:[];q.media=media.length?media[Math.floor(Math.random()*media.length)]:null;
 $('treeQuizMedia').innerHTML=ctx.mode==='photo'?'<img src="'+esc(q.media.src)+'" alt="Птица для определения">':ctx.mode==='audio'?'<div class="audio-question"><div class="audio-mark" aria-hidden="true">▂▅▇▃▆</div><audio controls preload="none" src="'+esc(q.media.src)+'" aria-label="Голос птицы для определения"></audio><p>Послушай запись, затем выбери вид.</p></div>':'';
 $('treeQuizResult').innerHTML='';$('nextTreeQuiz').hidden=true;$('nextTreeQuiz').textContent='Следующая птица';
 const options=C.answerChoices(b,window.BIRD_DATA,ctx.language);
 $('treeQuizChoices').innerHTML=options.map(x=>'<button data-tree-answer="'+x.id+'"'+(ctx.language==='latin'?' class="latin"':'')+'>'+esc(x[ctx.language])+'</button>').join('');
 const fail=()=>{if(quiz!==q||q.queue[q.index]!==b||q.answered)return;q.blocked=true;$('treeQuizChoices').querySelectorAll('button').forEach(e=>e.disabled=true);$('treeQuizResult').innerHTML='<p>Материал не загрузился. Пропусти вопрос без изменения уровня.</p>';$('nextTreeQuiz').hidden=false;$('nextTreeQuiz').textContent='Пропустить';};
 $('treeQuizMedia').querySelector('img')?.addEventListener('error',fail,{once:true});$('treeQuizMedia').querySelector('audio')?.addEventListener('error',fail,{once:true});
 $('treeQuizChoices').querySelector('button')?.focus();
}
function answer(id){if(!quiz||quiz.answered||quiz.blocked)return;const q=quiz,b=q.queue[q.index],ok=id===b.id,before=A.state(b.id).level;
 q.answered=true;const after=A.grade(b.id,ok,q.context);if(after===null){closeQuiz();return;}q.rated++;if(ok)q.correct++;
 $('treeQuizChoices').querySelectorAll('button').forEach(e=>{e.disabled=true;e.classList.toggle('correct',e.dataset.treeAnswer===b.id);e.classList.toggle('wrong',!ok&&e.dataset.treeAnswer===id);});
 const m=q.media,source=m?'<p class="media-credit">'+esc(m.author)+' · <a href="'+esc(m.source)+'" target="_blank" rel="noopener">Источник</a> · <a href="'+esc(m.licenseUrl||m.source)+'" target="_blank" rel="noopener">'+esc(m.license)+'</a></p>':'';
 $('treeQuizResult').innerHTML='<div class="tree-answer-result '+(ok?'correct':'wrong')+'"><strong>'+(ok?'Верно!':'Правильный ответ: '+esc(b[q.context.language]))+'</strong><span>Уровень '+before+' -> '+after+' / 10'+(ok?' · +1 за верный ответ':' · −2 за ошибку')+'</span></div><h3>'+esc(b.ru)+'</h3><p class="tree-answer-names">англ. '+esc(b.en)+'<br>лат. <em>'+esc(b.latin)+'</em><br>пол. '+esc(b.pl)+'</p><p class="fact">'+esc(b.tip)+'</p>'+source;
 $('nextTreeQuiz').hidden=false;$('nextTreeQuiz').textContent=q.index+1===q.queue.length?'Завершить':'Следующая птица';$('nextTreeQuiz').focus();
}
function nextQuestion(){if(!quiz||(!quiz.answered&&!quiz.blocked))return;if(quiz.blocked)quiz.skipped++;quiz.index++;if(quiz.index<quiz.queue.length){showQuestion();return;}
 const total=quiz.rated,correct=quiz.correct,skipped=quiz.skipped;stopAudio();quiz=null;$('treeQuizMedia').innerHTML='';$('treeQuizQuestion').textContent='';$('treeQuizChoices').innerHTML='';$('treeQuizTitle').textContent='Ветка проверена';$('treeQuizCount').textContent='СИНИЦЕВЫЕ · PARIDAE';$('treeQuizResult').innerHTML='<div class="tree-quiz-finish"><strong>'+correct+' / '+total+'</strong><p>Верных ответов. Пропущено: '+skipped+'.</p><p>'+(total?'Уровни видов обновлены.':'Уровни не изменены.')+'</p><button id="returnToTree" class="reveal">Вернуться к дереву</button></div>';$('nextTreeQuiz').hidden=true;$('returnToTree').focus();
}
document.addEventListener('click',e=>{if(e.target.closest('#treeView'))setView('tree');if(e.target.closest('#catalogView'))setView('catalog');if(e.target.closest('#testTitBranch'))startQuiz();const detail=e.target.closest('[data-tree-detail]');if(detail)A.detail(detail.dataset.treeDetail);const test=e.target.closest('[data-tree-test]');if(test)startQuiz(test.dataset.treeTest);const choice=e.target.closest('[data-tree-answer]');if(choice)answer(choice.dataset.treeAnswer);if(e.target.closest('#nextTreeQuiz'))nextQuestion();if(e.target.closest('#closeTreeQuiz')||e.target.closest('#returnToTree'))closeQuiz();});
dialog.addEventListener('cancel',()=>{stopAudio();quiz=null;});window.addEventListener('birdatlas:render',render);window.addEventListener('pagehide',stopAudio);
render();setView('tree');
})();
