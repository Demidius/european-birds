(()=>{
'use strict';
const A=window.BirdAtlas,C=window.BirdStudy,$=id=>document.getElementById(id);
if(!A||!$('treeBoard'))return;
const birds=window.BIRD_DATA,byBird=new Map(birds.map(b=>[b.id,b]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const taxonomy=window.STUDY_TREE,branches=new Map(),parents=new Map(),nodes=new Map();
(function index(n,p){nodes.set(n.id,n);if(p)parents.set(n.id,p.id);(n.children||[]).forEach(c=>index(c,n));})(taxonomy);
let currentId=taxonomy.id;
let filteredTree=taxonomy,filteredIds=null;
function leaves(n){return n.rank==='species'?[n.birdId]:(n.children||[]).flatMap(leaves);}

// Search and filters (markup in study.html / index.html).
const SEASONS=['polandBreeding','polandPassage','polandWinter'],FILTER_IDS=['onlyPoland','includeVagrants',...SEASONS];
const FILTER_LABELS={onlyPoland:'Только Польша',polandBreeding:'Гнездятся',polandPassage:'Пролётом',polandWinter:'Зимуют'};
function prune(n,parentMatch=false){
 const q=C.normalizeAnswer($('treeSearch').value),match=parentMatch||!q||C.normalizeAnswer(C.searchNames(n)).includes(q);
 if(n.rank==='species'){
  const region=window.BIRD_REGIONS?.poland?.species?.[n.id],local=$('onlyPoland').checked;
  const seasons=['breeding','passage','winter'].filter((k,i)=>$(SEASONS[i]).checked);
  if(local&&(!region||(seasons.length&&!seasons.some(k=>region.seasons?.[k]))))return null;
  if(!local&&!$('includeVagrants').checked&&n.vagrant)return null;
  return match?n:null;
 }
 const children=(n.children||[]).map(c=>prune(c,match&&!!q)).filter(Boolean);return children.length?{...n,children}:null;
}
function activeFilters(){const local=$('onlyPoland').checked,on=[];if(local)on.push(FILTER_LABELS.onlyPoland);SEASONS.forEach(id=>{if($(id).checked)on.push(FILTER_LABELS[id]);});if(!local&&!$('includeVagrants').checked)on.push('Без редких залётов');return on;}
function syncFilters(){
 const on=activeFilters(),count=$('filterCount'),summary=$('filterSummary'),panel=$('filterPanel');
 // Vagrants only matter outside Poland: inside, the national list decides.
 $('includeVagrants').disabled=$('onlyPoland').checked;
 if(count){count.hidden=!on.length;count.textContent=on.length||'';}
 if(summary){summary.hidden=!on.length||(panel&&!panel.hidden);summary.innerHTML=on.length?'<span>'+on.map(esc).join(' · ')+'</span><button type="button" data-filter-reset>Сбросить</button>':'';}
}
function applyFilters(){filteredTree=prune(taxonomy);filteredIds=filteredTree?leaves(filteredTree):[];syncFilters();A.setScope(filteredIds);}

let view='tree';
function label(s){return s.reps===0?'Новое знакомство':s.level===10?'Выучено':s.level>=5?'Повторяю':'Изучаю';}
function tone(s){return s.reps===0?'new':s.level===10?'mastered':s.level>=5?'review':'learning';}
const nameOf=n=>n.ru&&n.ru!==n.latin?n.ru:n.latin;
const POLAND=()=>window.BIRD_REGIONS?.poland?.species||{};
// The Latin name stays gold; its Russian reading is quieter so the name itself is easy to scan.
const latinHTML=latin=>latin?esc(latin)+' <span class="drill-read">('+esc(C.latinReading(latin))+')</span>':'';
// Rows load a 160 px square thumbnail (tools/build-thumbs.py -> assets/thumbs/) and fall back to the full photo.
// THUMBS stays false until assets/thumbs/ is in the repository, so no row asks for a missing file.
const THUMBS=false;
const thumbOf=src=>THUMBS&&/^assets\/(photos|bird-photos)\/[^/]+\.(jpe?g|png|webp)$/i.test(src||'')?src.replace(/^assets\/([^/]+)\/(.+)\.\w+$/,'assets/thumbs/$1/$2.webp'):src;
function photoHTML(photo){if(!photo)return '<span>нет фото</span>';const t=thumbOf(photo.src);return '<img src="'+esc(t)+'"'+(t!==photo.src?' data-full="'+esc(photo.src)+'" onerror="this.onerror=null;this.src=this.dataset.full"':'')+' alt="" width="80" height="80" loading="lazy" decoding="async">';}
// Progress of a branch: only species that can be studied in the current mode count.
function summary(ids){const st=ids.filter(id=>A.available(id)).map(id=>A.state(id));
 return {n:st.length,mastered:st.filter(s=>s.level===10).length,review:st.filter(s=>s.level>=5&&s.level<10).length,learning:st.filter(s=>s.reps>0&&s.level<5).length};}
function progressHTML(sum){if(!sum.n||!(sum.mastered+sum.review+sum.learning))return '';const seg=(k,cls)=>sum[k]?'<i class="'+cls+'" style="width:'+(sum[k]/sum.n*100).toFixed(2)+'%"></i>':'';
 return '<span class="drill-prog" role="img" aria-label="Выучено '+sum.mastered+' из '+sum.n+', повторяю '+sum.review+', изучаю '+sum.learning+'">'+seg('mastered','mastered')+seg('review','review')+seg('learning','learning')+'</span>';}
function statsText(sum){return [['mastered','выучено'],['review','повторяю'],['learning','изучаю']].filter(([k])=>sum[k]).map(([k,t])=>' · '+t+' '+sum[k]).join('');}
// A branch is shown with a clear photo of a familiar bird: the study collection's own photos first,
// then species that breed in Poland, then regular visitors.
const covers=new Map();
function cover(id){if(covers.has(id))return covers.get(id);const P=POLAND();let best=null,score=-1;
 for(const bid of leaves(nodes.get(id)||{children:[]})){const b=byBird.get(bid);if(!b?.photos?.length)continue;const r=P[b.treeId||bid],s=(/^assets\/photos\//.test(b.photos[0].src)?4:0)+(r?(!r.rare?(/^L/.test(r.status||'')?3:2):1):0);if(s>score){best=b;score=s;if(s===7)break;}}
 covers.set(id,best);return best;}
function findIn(tree,id){if(!tree)return null;if(tree.id===id)return tree;for(const c of tree.children||[]){const f=findIn(c,id);if(f)return f;}return null;}
function visibleNode(){let id=currentId,n=findIn(filteredTree,id);while(!n&&parents.has(id)){id=parents.get(id);n=findIn(filteredTree,id);}
 while(n&&n.rank==='group'&&n.children.length===1&&n.children[0].rank!=='species')n=n.children[0];return n||filteredTree;}
function pathTo(id){const a=[];while(id){a.unshift(nodes.get(id));id=parents.get(id);}return a.filter(n=>n&&n.rank!=='group');}
function familyOf(id){let p=parents.get(id);while(p){const n=nodes.get(p);if(n.rank==='family')return n;p=parents.get(p);}return null;}
function speciesRow(id,context){const b=byBird.get(id);if(!b)return '';const s=A.state(id),usable=A.available(id),ctx=A.context(),region=POLAND()[b.treeId||id];
 const pl=region?'<span class="drill-badge'+(/^[LP]/.test(region.status||'')?'':' rare')+'" title="Статус в Польше">PL '+esc(region.status||'')+'</span>':'';
 return '<article class="drill-species '+tone(s)+'" data-tree-species="'+id+'"><button class="drill-open" data-tree-detail="'+id+'" aria-label="Открыть карточку: '+esc(b.ru)+'"><span class="drill-thumb">'+photoHTML(b.photos[0])+'</span><span class="drill-names"><strong lang="ru">'+esc(b.ru)+pl+'</strong><em lang="la">'+latinHTML(b.latin)+'</em><span class="drill-pl" lang="pl">'+esc(b.pl)+'</span>'+(context?'<small>'+esc(context)+'</small>':'')+'<span class="drill-meter" role="img" aria-label="'+label(s)+', уровень '+s.level+' из 10">'+Array.from({length:10},(_,i)=>'<i'+(i<s.level?' class="filled"':'')+'></i>').join('')+'</span></span></button><button class="drill-test" data-tree-test="'+id+'" aria-label="Учить: '+esc(b.ru)+'"'+(!ctx.own||!usable?' disabled':'')+'>Учить</button></article>';}
function nodeRow(n){const ids=leaves(n),sum=summary(ids),b=cover(n.id);
 return '<button class="drill-row" data-tree-go="'+esc(n.id)+'"><span class="drill-thumb">'+photoHTML(b?.photos?.[0])+'</span><span class="drill-names"><strong>'+esc(nameOf(n))+'</strong>'+(n.ru&&n.ru!==n.latin?'<em lang="la">'+latinHTML(n.latin)+'</em>':'')+'<span class="drill-count">'+ids.length+' '+C.word(ids.length)+statsText(sum)+'</span>'+progressHTML(sum)+'</span><span class="drill-chev" aria-hidden="true">›</span></button>';}
function section(title,latin,count){return '<h4 class="drill-section"><span>'+esc(title)+(latin?' · <em lang="la">'+latinHTML(latin)+'</em>':'')+'</span><span>'+count+'</span></h4>';}
function list(items){return '<div class="drill-list">'+items.join('')+'</div>';}
// Blocks (a genus, a group of families) flow in columns on wide screens instead of one per row.
function blocks(items){return '<div class="drill-cols">'+items.map(x=>'<div class="drill-block">'+x+'</div>').join('')+'</div>';}
function screenHTML(n){
 if($('treeSearch').value.trim()){const ids=leaves(filteredTree);return list(ids.map(id=>{const b=byBird.get(id),f=familyOf(b?.treeId||id);return speciesRow(id,f?nameOf(f):'');}));}
 const kids=n.children||[];
 if(kids.length===1&&kids[0].rank!=='species'){const only=kids[0],label={family:'Семейство',genus:'Род'}[only.rank]||'';return '<p class="drill-only">'+(label?label+' ':'')+'<strong>'+esc(nameOf(only))+'</strong>'+(only.ru&&only.ru!==only.latin?' · <em lang="la">'+latinHTML(only.latin)+'</em>':'')+'</p>'+screenHTML(only);}
 if(kids.every(c=>c.rank==='species'))return list(kids.map(c=>speciesRow(c.birdId)));
 if(n.rank==='family'||kids.every(c=>c.rank==='genus'||c.rank==='species'))return blocks(kids.map(g=>{if(g.rank==='species')return list([speciesRow(g.birdId)]);const ids=leaves(g);return section(g.ru&&g.ru!==g.latin?'Род '+g.ru:'Род',g.latin,ids.length)+list(g.children.map(c=>c.rank==='species'?speciesRow(c.birdId):nodeRow(c)));}));
 if(kids.some(c=>c.rank==='group')){const secs=[];(function walk(x,owner){if(x!==n&&x.rank!=='group'){let s=secs.find(s=>s.owner===owner);if(!s)secs.push(s={owner,items:[]});s.items.push(x);return;}(x.children||[]).forEach(c=>walk(c,x.rank==='group'?x:owner));})(n,n);
  return blocks(secs.map(s=>{const count=s.items.reduce((a,x)=>a+leaves(x).length,0);return (s.owner!==n?section(nameOf(s.owner),s.owner.ru&&s.owner.ru!==s.owner.latin?s.owner.latin:'',count+' '+C.word(count)):'')+list(s.items.map(x=>x.rank==='species'?speciesRow(x.birdId):nodeRow(x)));}));}
 return blocks(kids.map(c=>c.rank==='species'?speciesRow(c.birdId):nodeRow(c)));
}
function drillHTML(){
 if(!filteredTree)return '<p class="drill-empty">Птицы не найдены. Измени поиск или фильтры.</p>';
 const q=$('treeSearch').value.trim(),n=q?filteredTree:visibleNode(),ids=leaves(n),ctx=A.context(),usable=ids.filter(id=>A.available(id)),sum=summary(ids);if(!q)currentId=n.id;branches.set(n.id,ids);
 const path=pathTo(n.id),root=!q&&!parents.has(n.id),crumbs=q?'<button data-tree-clear>Все птицы</button><span aria-hidden="true">›</span><button aria-current="page">Поиск</button>':path.map((x,i)=>(i?'<span aria-hidden="true">›</span>':'')+'<button data-tree-go="'+esc(x.id)+'"'+(i===path.length-1?' aria-current="page"':'')+'>'+esc(i?nameOf(x):'Все птицы')+'</button>').join('');
 const title=q?'Найдено':nameOf(n),latin=!q&&n.ru&&n.ru!==n.latin?n.latin:'',action=q?'Учить найденных':root?'Учить всех':'Учить ветку';
 // One study button per level, pinned with the breadcrumbs so it stays in reach while scrolling.
 return '<div class="drill-bar"><button class="drill-back" data-tree-back aria-label="Назад"'+(root?' disabled':'')+'>‹</button><nav class="drill-crumbs" aria-label="Путь по дереву">'+crumbs+'</nav>'+
  '<button class="drill-branch-test" data-test-branch="'+esc(n.id)+'" aria-label="'+action+': '+usable.length+' '+C.word(usable.length)+'"'+(!ctx.own||!usable.length?' disabled':'')+'>'+action+'</button></div>'+
  '<div class="drill-hero"><h3>'+esc(title)+'</h3>'+(latin?'<em lang="la">'+latinHTML(latin)+'</em>':'')+'<p class="drill-total">'+ids.length+' '+C.word(ids.length)+statsText(sum)+'</p>'+progressHTML(sum)+'</div>'+screenHTML(n);
}
function reveal(){const t=$('treeBoard').querySelector('.unified-tree');if(t&&t.getBoundingClientRect().top<0)t.scrollIntoView({block:'start'});}
function fade(c){c.classList.toggle('cut',c.scrollLeft>2);}
function go(id){currentId=id;history.pushState({...(history.state||{}),tree:id,depth:(history.state?.depth||0)+1},'');render();reveal();}
// Links to #treeBoard land on the view switch and the search, which sit just above the board.
function anchorOffset(){const v=document.querySelector('.board-views'),t=$('treeBoard');if(!v||t.hidden)return;document.documentElement.style.setProperty('--board-lead',Math.max(0,Math.round(t.getBoundingClientRect().top-v.getBoundingClientRect().top+8))+'px');}
function render(){const ctx=A.context();
 const langName={ru:'русский',en:'английский',latin:'латынь',pl:'польский'}[ctx.language];branches.clear();
 $('treeBoard').innerHTML='<div class="tree-head"><h2 id="treeTitle">Дерево птиц</h2><span class="tree-mode">'+({photo:'По фото',audio:'По голосу',names:'Названия'}[ctx.mode])+' · '+langName+'</span></div><div class="unified-tree drill">'+drillHTML()+'</div><details class="tree-explanation"><summary>Как читать дерево</summary><p>Дерево открывается по уровням: отряд, семейство, виды. Нажми на ветвь, чтобы спуститься, на птицу — чтобы открыть её карточку. «Учить» в верхней строке запускает карточки по всей открытой ветви, «Учить» у вида — по одной птице.</p><p>Роды показаны подзаголовками, крупные группы воробьинообразных — разделами. Порядок соседних ветвей не обозначает степень родства. Показаны воробьинообразные Европы и дополнительные отряды из учебной коллекции. Для дополнительных отрядов состав неполный.</p><p>Полоса под ветвью: зелёный — выучено, золотой — повторяю, голубой — изучаю. Прогресс общий для дерева и тестов, отдельно для каждого режима и языка. Записи голосов доступны только для видов с добавленным аудио.</p><p>Таксономия: AviList v2025b; европейский состав: Avibase. Статусы Польши: Komisja Faunistyczna и видовые очерки Ptaki.info. Авторы и лицензии фотографий доступны в карточках.</p></details>';
 // The breadcrumbs end on the open level; the cut-off start fades out.
 const c=$('treeBoard').querySelector('.drill-crumbs');if(c){c.scrollLeft=c.scrollWidth;fade(c);}
 anchorOffset();
}
const VIEWS={tree:['treeView','treeBoard'],board:['boardView','speciesBoard'],catalog:['catalogView','catalogSection']},VIEW_KEY='europeanBirds:view';
function setView(next,remember){if(!VIEWS[next]||!$(VIEWS[next][1]))next='tree';view=next;for(const [k,[btn,sec]] of Object.entries(VIEWS)){if($(sec))$(sec).hidden=k!==view;if($(btn))$(btn).setAttribute('aria-pressed',String(k===view));}
 if(remember)try{localStorage.setItem(VIEW_KEY,view);}catch(e){}window.dispatchEvent(new CustomEvent('birdatlas:view',{detail:view}));anchorOffset();}
// Shared with species-board.js: the filtered taxonomy and the species row of the tree.
window.BirdTree={filtered:()=>filteredTree,speciesRow,nameOf,thumbs:THUMBS,get view(){return view;}};
document.addEventListener('click',e=>{const v=e.target.closest('#treeView,#boardView,#catalogView');if(v)setView({treeView:'tree',boardView:'board',catalogView:'catalog'}[v.id],true);const detail=e.target.closest('[data-tree-detail]');if(detail)A.detail(detail.dataset.treeDetail);const test=e.target.closest('[data-tree-test]');if(test){const b=byBird.get(test.dataset.treeTest);A.study([test.dataset.treeTest],b?b.ru:'');}});
window.addEventListener('birdatlas:render',render);

history.replaceState({...(history.state||{}),tree:currentId},'');
window.addEventListener('popstate',e=>{const id=e.state?.tree;if(id&&nodes.has(id)){currentId=id;render();reveal();}});
for(const id of ['treeSearch',...FILTER_IDS])$(id).addEventListener(id==='treeSearch'?'input':'change',()=>{
 if(id==='onlyPoland'&&!$(id).checked)SEASONS.forEach(k=>$(k).checked=false);
 if(id.startsWith('poland')&&$(id).checked)$('onlyPoland').checked=true;
 applyFilters();
});
document.addEventListener('click',e=>{
 const toggle=e.target.closest('#filterToggle');if(toggle){const panel=$('filterPanel'),open=panel.hidden;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));syncFilters();anchorOffset();}
 if(e.target.closest('[data-filter-reset]')){FILTER_IDS.forEach(id=>$(id).checked=id==='includeVagrants');applyFilters();}
 const branch=e.target.closest('[data-test-branch]');if(branch){e.preventDefault();const n=nodes.get(branch.dataset.testBranch);A.study(branches.get(branch.dataset.testBranch),n&&n.id!==taxonomy.id?nameOf(n):$('treeSearch').value.trim()?'Найдено':'Все птицы');}
 const to=e.target.closest('[data-tree-go]');if(to&&!to.hasAttribute('aria-current')){const id=to.dataset.treeGo;if($('treeSearch').value){$('treeSearch').value='';applyFilters();}go(id);}
 if(e.target.closest('[data-tree-clear]')){$('treeSearch').value='';applyFilters();}
 if(e.target.closest('[data-tree-back]')){if($('treeSearch').value.trim()){$('treeSearch').value='';applyFilters();}else if(history.state?.tree===currentId&&history.state.depth)history.back();else if(parents.has(currentId))go(parents.get(currentId));}
});
window.addEventListener('resize',anchorOffset);
document.addEventListener('scroll',e=>{if(e.target.classList?.contains('drill-crumbs'))fade(e.target);},true);
// The browser may scroll to #treeBoard before the board is drawn; settle on the final position once.
window.addEventListener('load',()=>{anchorOffset();if(location.hash==='#treeBoard'&&!$('treeBoard').hidden)$('treeBoard').scrollIntoView({block:'start'});});
applyFilters();setView((()=>{try{return localStorage.getItem(VIEW_KEY);}catch(e){return null;}})()||'tree');
})();
