(()=>{
'use strict';
const A=window.BirdAtlas,C=window.BirdStudy,$=id=>document.getElementById(id);
if(!A||!$('treeBoard'))return;
const birds=window.BIRD_DATA;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const taxonomy=window.STUDY_TREE,branches=new Map(),parents=new Map(),nodes=new Map();
(function index(n,p){nodes.set(n.id,n);if(p)parents.set(n.id,p.id);(n.children||[]).forEach(c=>index(c,n));})(taxonomy);
let currentId=taxonomy.id;
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
let view='tree';
function label(s){return s.reps===0?'Новое знакомство':s.level===10?'Выучено':s.level>=5?'Повторяю':'Изучаю';}
function tone(s){return s.reps===0?'new':s.level===10?'mastered':s.level>=5?'review':'learning';}
const nameOf=n=>n.ru&&n.ru!==n.latin?n.ru:n.latin;
const POLAND=()=>window.BIRD_REGIONS?.poland?.species||{};
function findIn(tree,id){if(!tree)return null;if(tree.id===id)return tree;for(const c of tree.children||[]){const f=findIn(c,id);if(f)return f;}return null;}
function visibleNode(){let id=currentId,n=findIn(filteredTree,id);while(!n&&parents.has(id)){id=parents.get(id);n=findIn(filteredTree,id);}
 while(n&&n.rank==='group'&&n.children.length===1&&n.children[0].rank!=='species')n=n.children[0];return n||filteredTree;}
function pathTo(id){const a=[];while(id){a.unshift(nodes.get(id));id=parents.get(id);}return a.filter(n=>n&&n.rank!=='group');}
function familyOf(id){let p=parents.get(id);while(p){const n=nodes.get(p);if(n.rank==='family')return n;p=parents.get(p);}return null;}
function speciesRow(id,context){const b=birds.find(b=>b.id===id);if(!b)return '';const s=A.state(id),usable=A.available(id),ctx=A.context(),photo=b.photos[0],region=POLAND()[b.treeId||id];
 const pl=region?'<span class="drill-badge'+(/^[LP]/.test(region.status||'')?'':' rare')+'" title="Статус в Польше">PL '+esc(region.status||'')+'</span>':'';
 return '<article class="drill-species '+tone(s)+'" data-tree-species="'+id+'"><button class="drill-open" data-tree-detail="'+id+'" aria-label="Открыть карточку: '+esc(b.ru)+'"><span class="drill-thumb">'+(photo?'<img src="'+esc(photo.src)+'" alt="" loading="lazy" decoding="async">':'<span>нет фото</span>')+'</span><span class="drill-names"><strong lang="ru">'+esc(b.ru)+pl+'</strong><em lang="la">'+esc(C.latinLabel(b.latin))+'</em><span class="drill-pl" lang="pl">'+esc(b.pl)+'</span>'+(context?'<small>'+esc(context)+'</small>':'')+'<span class="drill-meter" role="img" aria-label="'+label(s)+', уровень '+s.level+' из 10">'+Array.from({length:10},(_,i)=>'<i'+(i<s.level?' class="filled"':'')+'></i>').join('')+'</span></span></button><button class="drill-test" data-tree-test="'+id+'" aria-label="Учить: '+esc(b.ru)+'"'+(!ctx.own||!usable?' disabled':'')+'>Учить</button></article>';}
function nodeRow(n){const ids=leaves(n);return '<button class="drill-row" data-tree-go="'+esc(n.id)+'"><span class="drill-names"><strong>'+esc(nameOf(n))+'</strong>'+(n.ru&&n.ru!==n.latin?'<em>'+esc(C.latinLabel(n.latin))+'</em>':'')+'</span><span class="drill-count">'+ids.length+' '+C.word(ids.length)+'</span><span class="drill-chev" aria-hidden="true">›</span></button>';}
function section(title,latin,count){return '<h4 class="drill-section"><span>'+esc(title)+(latin?' · <em>'+esc(C.latinLabel(latin))+'</em>':'')+'</span><span>'+count+'</span></h4>';}
function list(items){return '<div class="drill-list">'+items.join('')+'</div>';}
function screenHTML(n){
 if($('treeSearch').value.trim()){const ids=leaves(filteredTree);return list(ids.map(id=>{const b=birds.find(b=>b.id===id),f=familyOf(b?.treeId||id);return speciesRow(id,f?nameOf(f):'');}));}
 const kids=n.children||[];
 if(kids.length===1&&kids[0].rank!=='species'){const only=kids[0],label={family:'Семейство',genus:'Род'}[only.rank]||'';return '<p class="drill-only">'+(label?label+' ':'')+'<strong>'+esc(nameOf(only))+'</strong>'+(only.ru&&only.ru!==only.latin?' · <em>'+esc(C.latinLabel(only.latin))+'</em>':'')+'</p>'+screenHTML(only);}
 if(kids.every(c=>c.rank==='species'))return list(kids.map(c=>speciesRow(c.birdId)));
 if(n.rank==='family'||kids.every(c=>c.rank==='genus'||c.rank==='species'))return kids.map(g=>{if(g.rank==='species')return list([speciesRow(g.birdId)]);const ids=leaves(g);return section(g.ru&&g.ru!==g.latin?'Род '+g.ru:'Род',g.latin,ids.length)+list(g.children.map(c=>c.rank==='species'?speciesRow(c.birdId):nodeRow(c)));}).join('');
 if(kids.some(c=>c.rank==='group')){const secs=[];(function walk(x,owner){if(x!==n&&x.rank!=='group'){let s=secs.find(s=>s.owner===owner);if(!s)secs.push(s={owner,items:[]});s.items.push(x);return;}(x.children||[]).forEach(c=>walk(c,x.rank==='group'?x:owner));})(n,n);
  return secs.map(s=>{const count=s.items.reduce((a,x)=>a+leaves(x).length,0);return (s.owner!==n?section(nameOf(s.owner),s.owner.ru&&s.owner.ru!==s.owner.latin?s.owner.latin:'',count+' '+C.word(count)):'')+list(s.items.map(x=>x.rank==='species'?speciesRow(x.birdId):nodeRow(x)));}).join('');}
 return list(kids.map(c=>c.rank==='species'?speciesRow(c.birdId):nodeRow(c)));
}
function drillHTML(){
 if(!filteredTree)return '<p class="drill-empty">Птицы не найдены. Измени фильтры.</p>';
 const q=$('treeSearch').value.trim(),n=q?filteredTree:visibleNode(),ids=leaves(n),ctx=A.context(),usable=ids.filter(id=>A.available(id));if(!q)currentId=n.id;branches.set(n.id,ids);
 const path=pathTo(n.id),crumbs=q?'<button data-tree-clear>Все птицы</button><span aria-hidden="true">›</span><button aria-current="page">Поиск</button>':path.map((x,i)=>(i?'<span aria-hidden="true">›</span>':'')+'<button data-tree-go="'+esc(x.id)+'"'+(i===path.length-1?' aria-current="page"':'')+'>'+esc(i?nameOf(x):'Все птицы')+'</button>').join('');
 const title=q?'Найдено':nameOf(n),latin=!q&&n.ru&&n.ru!==n.latin?n.latin:'';
 return '<nav class="drill-bar" aria-label="Путь по дереву"><button class="drill-back" data-tree-back aria-label="Назад"'+(!q&&!parents.has(n.id)?' disabled':'')+'>‹</button><div class="drill-crumbs">'+crumbs+'</div></nav><div class="drill-hero"><div><h3>'+esc(title)+'</h3>'+(latin?'<em>'+esc(C.latinLabel(latin))+'</em>':'')+'<span class="drill-total">'+ids.length+' '+C.word(ids.length)+'</span></div><button class="drill-branch-test" data-test-branch="'+esc(n.id)+'"'+(!ctx.own||!usable.length?' disabled':'')+'>Учить ветку</button></div>'+screenHTML(n);
}
function reveal(){const t=$('treeBoard').querySelector('.unified-tree');if(t&&t.getBoundingClientRect().top<0)t.scrollIntoView({block:'start'});const c=$('treeBoard').querySelector('.drill-crumbs');if(c)c.scrollLeft=c.scrollWidth;}
function go(id){currentId=id;history.pushState({...(history.state||{}),tree:id,depth:(history.state?.depth||0)+1},'');render();reveal();}
function render(){const ctx=A.context(),pool=birds.filter(b=>(!filteredIds||filteredIds.includes(b.id))&&A.available(b.id)),learned=pool.filter(b=>A.state(b.id).level===10).length;
 const langName={ru:'русский',en:'английский',latin:'латынь',pl:'польский'}[ctx.language];branches.clear();
 $('treeBoard').innerHTML='<div class="tree-heading"><div><p class="eyebrow">ЕДИНАЯ ДОСКА · ДЕРЕВО И ТЕСТЫ</p><h2 id="treeTitle">Дерево птиц</h2><p class="tree-subtitle">Выбери отряд, затем семейство. Нажми на птицу, чтобы открыть карточку.</p></div><button id="testTitBranch" class="tree-test-button"'+(!ctx.own||!pool.length?' disabled':'')+'>Учить выборку <span>'+pool.length+' '+C.word(pool.length)+'</span></button></div><div class="tree-toolbar"><span>'+({photo:'По фото',audio:'По голосу',names:'Названия'}[ctx.mode])+' · '+langName+'</span><span>Выучено '+learned+' / '+pool.length+'</span><span class="tree-score-rule">Снова · Трудно · Хорошо · Легко</span></div><div class="unified-tree drill">'+drillHTML()+'</div><details class="tree-explanation"><summary>Как читать дерево</summary><p>Дерево открывается по уровням: отряд, семейство, виды. Роды показаны подзаголовками, крупные группы воробьинообразных — разделами. Порядок соседних ветвей не обозначает степень родства. Показаны воробьинообразные Европы и дополнительные отряды из учебной коллекции. Для дополнительных отрядов состав неполный.</p><p>Таксономия: AviList v2025b; европейский состав: Avibase. Статусы Польши: Komisja Faunistyczna и видовые очерки Ptaki.info. Авторы и лицензии фотографий доступны в карточках.</p><p>Прогресс общий для дерева и тестов, отдельно для каждого режима и языка. Записи голосов доступны только для видов с добавленным аудио.</p></details>';
}
function setView(next){view=next;$('treeBoard').hidden=view!=='tree';$('catalogSection').hidden=view!=='catalog';$('treeView').setAttribute('aria-pressed',String(view==='tree'));$('catalogView').setAttribute('aria-pressed',String(view==='catalog'));}
document.addEventListener('click',e=>{if(e.target.closest('#treeView'))setView('tree');if(e.target.closest('#catalogView'))setView('catalog');if(e.target.closest('#testTitBranch'))A.study(filteredIds||leaves(taxonomy),'Выборка дерева');const detail=e.target.closest('[data-tree-detail]');if(detail)A.detail(detail.dataset.treeDetail);const test=e.target.closest('[data-tree-test]');if(test){const b=birds.find(b=>b.id===test.dataset.treeTest);A.study([test.dataset.treeTest],b?b.ru:'');}});
window.addEventListener('birdatlas:render',render);

history.replaceState({...(history.state||{}),tree:currentId},'');
window.addEventListener('popstate',e=>{const id=e.state?.tree;if(id&&nodes.has(id)){currentId=id;render();reveal();}});
for(const id of ['treeSearch','onlyPoland','includeVagrants','polandBreeding','polandPassage','polandWinter'])$(id).addEventListener(id==='treeSearch'?'input':'change',()=>{
 if(id==='onlyPoland'&&!$(id).checked)['polandBreeding','polandPassage','polandWinter'].forEach(k=>$(k).checked=false);
 if(id.startsWith('poland')&&$(id).checked)$('onlyPoland').checked=true;
 applyFilters();
});
document.addEventListener('click',e=>{
 const branch=e.target.closest('[data-test-branch]');if(branch){e.preventDefault();const n=nodes.get(branch.dataset.testBranch);A.study(branches.get(branch.dataset.testBranch),n&&n.id!==taxonomy.id?nameOf(n):$('treeSearch').value.trim()?'Найдено':'Все птицы');}
 const to=e.target.closest('[data-tree-go]');if(to&&!to.hasAttribute('aria-current')){const id=to.dataset.treeGo;if($('treeSearch').value){$('treeSearch').value='';applyFilters();}go(id);}
 if(e.target.closest('[data-tree-clear]')){$('treeSearch').value='';applyFilters();}
 if(e.target.closest('[data-tree-back]')){if($('treeSearch').value.trim()){$('treeSearch').value='';applyFilters();}else if(history.state?.tree===currentId&&history.state.depth)history.back();else if(parents.has(currentId))go(parents.get(currentId));}
});
applyFilters();setView('tree');
})();
