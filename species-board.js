// Species board: the English site's topic board, with bird groups as columns, families as dividers
// and genera as cards. Shares progress, filters and study sessions with the tree (study-tree.js).
(()=>{
'use strict';
const A=window.BirdAtlas,C=window.BirdStudy,T=window.BirdTree,$=id=>document.getElementById(id),root=$('speciesBoard');
if(!A||!C||!T||!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const birds=new Map(window.BIRD_DATA.map(b=>[b.id,b])),taxonomy=window.STUDY_TREE;
const POLAND=()=>window.BIRD_REGIONS?.poland?.species||{};
const COLORS=['#7b5f8f','#3f6f8a','#3f7a5c','#8a6a35','#8a4f45','#4f6470','#5d6b3a'];
const COL_KEY='europeanBirds:boardColumn',STATUS=[['all','Все'],['new','Не начато'],['learning','Изучаю'],['review','Повторяю'],['mastered','Выучено']];
const TONE_LABEL={new:'не начато',learning:'изучаю',review:'повторяю',mastered:'выучено'};
const nameOf=n=>T.nameOf(n);

// Columns: the passerine groups whose children are families, then every other order together.
const COLUMNS=[];
(function walk(n){
 if(n.rank==='order'&&n.latin!=='Passeriformes'){let c=COLUMNS.find(c=>c.id==='non-passerines');if(!c)COLUMNS.push(c={id:'non-passerines',ru:'Неворобьиные',latin:'',info:'Все остальные отряды учебной коллекции',orders:[]});c.orders.push(n.id);return;}
 const kids=n.children||[];
 if(n.rank==='group'&&kids.length&&kids.every(k=>k.rank==='family')){COLUMNS.push({id:n.id,ru:n.ru,latin:n.latin});return;}
 kids.forEach(walk);
})(taxonomy);
// Groups made only of rare vagrants (American tyrant flycatchers) go to the end.
const byId=new Map();(function walk(n){byId.set(n.id,n);(n.children||[]).forEach(walk);})(taxonomy);
const vagrantOnly=c=>{const sp=(c.orders||[c.id]).flatMap(id=>{const out=[];(function walk(n){if(n.rank==='species')out.push(n);(n.children||[]).forEach(walk);})(byId.get(id));return out;});return sp.length>0&&sp.every(n=>n.vagrant);};
COLUMNS.sort((a,b)=>vagrantOnly(a)-vagrantOnly(b));
COLUMNS.forEach((c,i)=>c.color=COLORS[i%COLORS.length]);

let filter='all',dirty=true,active=(()=>{try{return localStorage.getItem(COL_KEY);}catch(e){return null;}})();
const open=new Set();

function index(tree){const m=new Map();(function walk(n){if(!n)return;m.set(n.id,n);(n.children||[]).forEach(walk);})(tree);return m;}
function leaves(n){return n.rank==='species'?[n.birdId]:(n.children||[]).flatMap(leaves);}
function tone(s){return s.reps===0?'new':s.level===10?'mastered':s.level>=5?'review':'learning';}
// Progress counts only species that can be studied in the current mode (photo/voice/names).
function summary(ids){const usable=ids.filter(id=>A.available(id)),st=usable.map(id=>A.state(id));
 const learned=st.filter(s=>s.level===10).length,review=st.filter(s=>s.level>=5&&s.level<10).length,learning=st.filter(s=>s.reps>0&&s.level<5).length;
 const pct=usable.length?Math.round(st.reduce((a,s)=>a+s.level,0)/(10*usable.length)*100):0;
 const status=!usable.length||st.every(s=>s.reps===0)?'new':learned===usable.length?'mastered':st.every(s=>s.level>=5)?'review':'learning';
 return {n:usable.length,learned,review,learning,pct,status};}
function regular(ids){const P=POLAND();return ids.filter(id=>{const r=P[birds.get(id)?.treeId||id];return r&&!r.rare;}).length;}

function columnFamilies(col,idx){
 if(col.orders)return col.orders.map(o=>idx.get(o)).filter(Boolean).flatMap(o=>(o.children||[]).filter(f=>f.rank==='family').map(f=>({f,order:o})));
 const g=idx.get(col.id);return g?(g.children||[]).map(f=>({f})):[];
}
function genusCard(g,fam){
 const ids=leaves(g),sum=summary(ids),ctx=A.context(),isOpen=open.has(g.id),pl=regular(ids);
 const gloss=g.ru&&g.ru!==g.latin?g.ru:ids.map(id=>birds.get(id)?.ru).filter(Boolean).join(', ');
 const bar=ids.map(id=>{const b=birds.get(id);if(!A.available(id))return '<i class="na" title="'+esc(b?.ru)+': нет материала для этого режима"></i>';const s=A.state(id);return '<i class="'+tone(s)+'" title="'+esc(b?.ru)+': уровень '+s.level+'"></i>';}).join('');
 return '<article class="sb-card'+(isOpen?' open':'')+'" data-sb-genus="'+esc(g.id)+'" data-status="'+sum.status+'">'+
  '<div class="sb-card-top"><button class="sb-open" data-sb-toggle="'+esc(g.id)+'" aria-expanded="'+isOpen+'" aria-label="'+esc((g.ru||'Род')+' '+g.latin)+': '+(isOpen?'скрыть':'показать')+' виды">'+
   '<span class="sb-t"><em lang="la">'+esc(g.latin)+'</em><span class="sb-chev" aria-hidden="true">›</span></span><span class="sb-g">'+esc(gloss)+'</span></button>'+
   '<button class="sb-test" data-sb-study="'+esc(g.id)+'"'+(!ctx.own||!sum.n?' disabled':'')+' aria-label="Учить род '+esc(g.latin)+'">Учить</button></div>'+
  '<span class="sb-bar" aria-hidden="true">'+bar+'</span>'+
  '<span class="sb-foot"><span class="sb-chip">'+TONE_LABEL[sum.status]+'</span>'+(pl?'<span class="sb-pl" title="Регулярно встречаются в Польше">PL '+pl+'</span>':'')+'<span class="sb-n">'+sum.learned+'/'+sum.n+' · '+sum.pct+'%</span></span>'+
  (isOpen?'<div class="sb-species">'+ids.map(id=>T.speciesRow(id)).join('')+'</div>':'')+
 '</article>';
}
function familyBlock({f,order}){
 const ids=leaves(f),ctx=A.context(),usable=ids.filter(id=>A.available(id)).length;
 return '<div class="sb-fam"><span class="sb-fam-name">'+(order?esc(nameOf(order))+' · ':'')+esc(nameOf(f))+' <em lang="la">'+esc(f.latin)+'</em></span><span class="sb-fam-n">'+ids.length+'</span>'+
  '<button class="sb-fam-test" data-sb-study="'+esc(f.id)+'"'+(!ctx.own||!usable?' disabled':'')+' aria-label="Учить семейство '+esc(nameOf(f))+'">Учить</button></div>'+
  (f.children||[]).map(g=>g.rank==='genus'?genusCard(g,f):'').join('');
}
function render(){
 if(root.hidden){dirty=true;return;}dirty=false;
 const tree=T.filtered(),idx=index(tree),ctx=A.context(),scroll=root.querySelector('.sb-scroll'),left=scroll?scroll.scrollLeft:0;
 const cols=COLUMNS.map(c=>{const fams=columnFamilies(c,idx);return {...c,fams,ids:fams.flatMap(x=>leaves(x.f))};}).filter(c=>c.ids.length);
 if(!cols.some(c=>c.id===active))active=cols[0]?.id||null;
 const all=cols.flatMap(c=>c.ids),total=summary(all),langName={ru:'русский',en:'английский',latin:'латынь',pl:'польский'}[ctx.language];
 const seg=(n,cls)=>total.n?'<span class="'+cls+'" style="width:'+(n/total.n*100)+'%"></span>':'';
 let h='<div class="tree-heading"><div><p class="eyebrow">ДОСКА ВИДОВ · ГРУППЫ, СЕМЕЙСТВА, РОДЫ</p><h2 id="boardTitle">Доска видов</h2><p class="tree-subtitle">Колонка — группа, внутри семейства и роды. Нажми на род, чтобы увидеть виды.</p></div></div>'+
  '<div class="tree-toolbar"><span>'+({photo:'По фото',audio:'По голосу',names:'Названия'}[ctx.mode])+' · '+langName+'</span><span>Выучено '+total.learned+' / '+total.n+'</span><span class="tree-score-rule">Снова · Трудно · Хорошо · Легко</span></div>'+
  '<div class="sb-stats"><p class="sb-stat">выучено <b>'+total.learned+'</b> из '+total.n+' видов · повторяю '+total.review+' · изучаю '+total.learning+'</p><div class="sb-total" aria-hidden="true">'+seg(total.learned,'mastered')+seg(total.review,'review')+seg(total.learning,'learning')+'</div>'+
  '<p class="sb-legend"><span><i class="new"></i>новое</span><span><i class="learning"></i>изучаю (1–4)</span><span><i class="review"></i>повторяю (5–9)</span><span><i class="mastered"></i>выучено (10)</span></p></div>'+
  '<div class="sb-filter" role="group" aria-label="Фильтр родов"><span>Род</span>'+STATUS.map(([k,t])=>'<button class="sb-f" data-sb-filter="'+k+'" aria-pressed="'+(filter===k)+'">'+t+'</button>').join('')+'</div>';
 if(!cols.length){root.innerHTML=h+'<p class="drill-empty">Птицы не найдены. Измени фильтры.</p>';return;}
 h+='<nav class="sb-jump" aria-label="Переход к группе">'+cols.map(c=>'<button data-sb-col="'+esc(c.id)+'" aria-pressed="'+(c.id===active)+'" style="--c:'+c.color+'">'+esc(c.ru)+'</button>').join('')+'</nav>'+
  '<div class="sb-scroll"><div class="sb-grid'+(filter!=='all'?' filtered':'')+'" data-filter="'+filter+'" style="--cols:'+cols.length+'">'+cols.map((c,i)=>{const s=summary(c.ids);
   return '<section class="sb-col'+(c.id===active?' on':'')+'" data-sb-column="'+esc(c.id)+'" aria-label="'+esc(c.ru)+'"><header class="sb-head" style="--c:'+c.color+'">'+
    '<div class="sb-mnav"><button class="sb-arrow" data-sb-step="-1" aria-label="Предыдущая группа">‹</button><span>'+(i+1)+' / '+cols.length+'</span><button class="sb-arrow" data-sb-step="1" aria-label="Следующая группа">›</button></div>'+
    '<h3>'+esc(c.ru)+'</h3>'+(c.latin?'<em lang="la">'+esc(c.latin)+'</em>':'<em>'+esc(c.info)+'</em>')+
    '<p>'+s.learned+' / '+s.n+' видов · '+s.pct+'%</p><span class="sb-pb"><span style="width:'+s.pct+'%"></span></span></header>'+
    '<div class="sb-body">'+c.fams.map(familyBlock).join('')+'</div></section>';}).join('')+'</div></div>'+
  '<details class="tree-explanation"><summary>Как пользоваться доской</summary><p>Доска устроена как доска тем в English Skill Tree: колонка — группа, серые разделители — семейства, карточки — роды. Полоска на карточке — виды рода, по сегменту на вид: серый — новое, голубой — изучаю, жёлтый — повторяю, зелёный — выучено. Штриховка — для вида нет фото или записи в этом режиме.</p><p>Нажми на род, чтобы раскрыть его виды. «Учить» на роде или семействе запускает карточки Anki из этих видов: сначала те, что пора повторить, потом новые. Прогресс общий с деревом и каталогом. Поиск и фильтры Польши выше действуют и на доску.</p><p>PL — сколько видов рода регулярно встречается в Польше. На телефоне группы листаются стрелками ‹ › или свайпом.</p></details>';
 root.innerHTML=h;
 const sc=root.querySelector('.sb-scroll');if(sc)sc.scrollLeft=left;
}
function setColumn(id,scrollTop){active=id;try{localStorage.setItem(COL_KEY,id);}catch(e){}
 root.querySelectorAll('.sb-col').forEach(c=>c.classList.toggle('on',c.dataset.sbColumn===id));
 root.querySelectorAll('[data-sb-col]').forEach(b=>{const on=b.dataset.sbCol===id;b.setAttribute('aria-pressed',String(on));if(on&&phone())b.scrollIntoView({inline:'center',block:'nearest'});});
 if(!phone()){const col=[...root.querySelectorAll('.sb-col')].find(c=>c.dataset.sbColumn===id),sc=root.querySelector('.sb-scroll');if(col&&sc)sc.scrollTo({left:Math.max(0,col.offsetLeft-sc.offsetLeft-8),behavior:'smooth'});}
 else if(scrollTop){const j=root.querySelector('.sb-jump');if(j&&j.getBoundingClientRect().top<0)j.scrollIntoView({block:'start'});}
}
function step(dir){const ids=[...root.querySelectorAll('.sb-col')].map(c=>c.dataset.sbColumn);if(!ids.length)return;const i=ids.indexOf(active);setColumn(ids[(i+dir+ids.length)%ids.length],true);}
const phone=()=>!!window.matchMedia?.('(max-width:760px)').matches;
function nodeById(id){let hit=null;(function walk(n){if(!n||hit)return;if(n.id===id){hit=n;return;}(n.children||[]).forEach(walk);})(T.filtered());return hit;}

root.addEventListener('click',e=>{
 const t=e.target.closest('[data-sb-toggle]');if(t){const id=t.dataset.sbToggle;open.has(id)?open.delete(id):open.add(id);render();return;}
 const s=e.target.closest('[data-sb-study]');if(s){const n=nodeById(s.dataset.sbStudy);if(n)A.study(leaves(n),n.rank==='genus'?(n.ru&&n.ru!==n.latin?n.ru+' · ':'Род ')+n.latin:nameOf(n));return;}
 const f=e.target.closest('[data-sb-filter]');if(f){filter=f.dataset.sbFilter;render();return;}
 const c=e.target.closest('[data-sb-col]');if(c){setColumn(c.dataset.sbCol,true);return;}
 const a=e.target.closest('[data-sb-step]');if(a)step(+a.dataset.sbStep);
});
// Swipe between groups on phones.
let sx=0,sy=0,st=0,track=false;
root.addEventListener('touchstart',e=>{if(!phone()||e.touches.length!==1||!e.target.closest('.sb-grid'))return;track=true;sx=e.touches[0].clientX;sy=e.touches[0].clientY;st=Date.now();},{passive:true});
root.addEventListener('touchend',e=>{if(!track)return;track=false;const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;if(Date.now()-st<700&&Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.8)step(dx<0?1:-1);},{passive:true});
window.addEventListener('birdatlas:render',render);
window.addEventListener('birdatlas:view',e=>{if(e.detail==='board'&&dirty)render();});
if(T.view==='board')render();
})();
