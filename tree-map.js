// Zoomable bird tree drawn as a diagram: Birds → orders → passerine groups → families as pills joined by
// arrows, with genera and species listed under each family. Every rank has its own size and colour: all orders
// alike, all families alike, and each rank smaller than the one above it. Drag, pinch or scroll to move and
// zoom; tap a branch to zoom into it, a species to open its card.
// The map always starts from every species on the site; its own check boxes keep only Polish species or
// only passerines. The page's search applies; the page's Poland filters do not (they are hidden on this view).
(()=>{
'use strict';
const A=window.BirdAtlas,C=window.BirdStudy,T=window.BirdTree,$=id=>document.getElementById(id),root=$('treeMap');
if(!A||!C||!T||!root)return;
const NS='http://www.w3.org/2000/svg',FONT="'Manrope',sans-serif";
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const birds=new Map(window.BIRD_DATA.map(b=>[b.id,b]));
// One font size per rank. Passerine groups are ranked by depth: suborder (Tyranni, Passeri), infraorder
// (Corvides, Passerides), parvorder (Sylviida, Muscicapida, Passerida), as in Cracraft's passerine classification.
const SIZE={class:150,order:112,suborder:92,infraorder:76,parvorder:62,family:48},K_MAX=5,MIN_TEXT_PX=2.6;
const RANK={class:'Класс',order:'Отряд',suborder:'Подотряд',infraorder:'Инфраотряд',parvorder:'Парвотряд',family:'Семейство',genus:'Род',species:'Вид'};
const GROUPS=['suborder','infraorder','parvorder'];
const rankOf=(n,parent)=>n.rank==='group'?GROUPS[Math.min(GROUPS.length-1,parent?parent.groups:0)]:n.rank;
const nameOf=n=>T.nameOf(n);
const X=window.BirdTaxonomy,MF_KEY='europeanBirds:mapFilters',MF={poland:'Только Польша',passer:'Только воробьиные'};
let mf=(()=>{try{const v=JSON.parse(localStorage.getItem(MF_KEY)||'{}');return {poland:v.poland===true,passer:v.passer===true};}catch(e){return {poland:false,passer:false};}})();
// Polish species: categories A and C of the national list (Komisja Faunistyczna), rare visitors included.
const polish=n=>{const r=X.region(n);return !!r&&['A','C'].includes(r.category);};
function source(){const q=C.normalizeAnswer(($('treeSearch')||{}).value||'');
 const keep=(n,inPass,parentMatch)=>{const match=parentMatch||!q||C.matchesName(n,q);
  if(n.rank==='species')return (mf.passer&&!inPass)||(mf.poland&&!polish(n))||!match?null:n;
  const p=inPass||n.latin==='Passeriformes',kids=(n.children||[]).map(c=>keep(c,p,match&&!!q)).filter(Boolean);return kids.length?{...n,children:kids}:null;};
 return keep(window.STUDY_TREE,false,false);}
const measure=(()=>{let c=null;try{if(!/jsdom/i.test(navigator.userAgent))c=document.createElement('canvas').getContext('2d');}catch(e){}
 return (s,size,weight=600,italic=false)=>{if(c){c.font=(italic?'italic ':'')+weight+' 100px '+FONT;return c.measureText(s).width*size/100;}return String(s).length*size*0.6;};})();
function leaves(n){return n.rank==='species'?[n.birdId]:(n.children||[]).flatMap(leaves);}
function tone(id){if(!A.available(id))return 'na';const s=A.state(id);return s.reps===0?'new':s.level===10?'mastered':s.level>=5?'review':'learning';}
function wrap(text,size,maxW,weight,italic){const words=String(text).split(/\s+/).filter(Boolean),lines=[];let cur='';
 for(const w of words){const t=cur?cur+' '+w:w;if(cur&&measure(t,size,weight,italic)>maxW){lines.push(cur);cur=w;}else cur=t;}if(cur)lines.push(cur);return lines.length?lines:[''];}

// ---- layout (world units) ----
// Families hang under their parent as a bunch of grapes: round berries of one size, rows narrowing downwards.
let L=null,view={x:0,y:0,k:1},focusId=null,lastKey='',anim=0,dirty=true,sheetFor=null;
const FAM_F=SIZE.family,NAME_F=FAM_F*0.85,LAT_F=FAM_F*0.5,CNT_F=FAM_F*0.42;
let BERRY=null;
function berry(){if(BERRY)return BERRY;let w=NAME_F*5.5;
 (function walk(n){if(n.rank==='family'){for(const word of String(nameOf(n)).split(/\s+/))w=Math.max(w,measure(word,NAME_F,700));}else(n.children||[]).forEach(walk);})(window.STUDY_TREE);
 const D=w/0.78,pitch=D*1.05;return BERRY={D,inner:w,pitch,dy:pitch*0.87,stem:D*0.42};}
// Rows of a bunch: 5,4,3,2,1 for 15 berries; one row is left out when the count is not triangular (13 → 5,4,3,1).
function bunchRows(n){let m=1;while(m*(m+1)/2<n)m++;const rows=[];for(let k=m;k>=1;k--)rows.push(k);const ex=m*(m+1)/2-n;if(ex)rows.splice(rows.indexOf(ex),1);return rows;}
function layout(tree){
 const byId=new Map(),objs=[],B=berry();
 function make(n,parent){
  const ids=leaves(n),rank=rankOf(n,parent),f=SIZE[rank]||SIZE.family,name=nameOf(n),lat=n.latin&&n.latin!==name?n.latin:'';
  const sub=(lat?lat+' · ':'')+ids.length+' '+C.word(ids.length),pad=f*0.75,groups=(parent?parent.groups:0)+(n.rank==='group'?1:0);
  const o={n,id:n.id,ids,f,rank,groups,parent,name,sub,kids:[],w:Math.max(measure(name,f),measure(sub,f*0.42,500))+pad*2,h:f*2.1};
  byId.set(o.id,o);objs.push(o);
  if(n.rank==='family'){o.berry=true;o.w=o.h=B.D;o.lines=wrap(name,NAME_F,B.inner*0.98,700,false);o.lat=n.latin;o.count=ids.length+' '+C.word(ids.length);return o;}
  const kids=(n.children||[]).filter(c=>c.rank!=='species'&&c.rank!=='genus');
  o.kids=kids.filter(c=>c.rank!=='family').map(c=>make(c,o));
  const fams=kids.filter(c=>c.rank==='family').map(c=>make(c,o));
  if(fams.length){const rows=bunchRows(fams.length),bw=Math.max(...rows)*B.pitch;
   o.bunch={isBunch:true,fams,rows,f:FAM_F,w:bw,parent:o};o.kids.push(o.bunch);}
  return o;
 }
 const top=make(tree,null);
 const gap=(a,b)=>(a.f+b.f)*0.45;
 function width(o){if(o.isBunch)return o.sw=o.w;const kw=o.kids.reduce((a,k,i)=>a+width(k)+(i?gap(o.kids[i-1],k):0),0);o.kw=kw;return o.sw=Math.max(o.w,kw);}
 width(top);
 function placeBunch(b,left,y){b.cx=left+b.w/2;b.y=y;b.top=y+B.stem;let cy=b.top+B.D/2,i=0,shift=0;
  b.rows.forEach((k,r)=>{if(r){const step=b.rows[r-1]-k;shift=step%2?0:(shift?0:0.5);cy+=B.dy;}
   for(let j=0;j<k;j++){const o=b.fams[i++];o.cx=b.cx+(j-(k-1)/2+shift)*B.pitch;o.cy=cy;o.x=o.cx-B.D/2;o.y=cy-B.D/2;
    o.box={x:o.cx-B.D*1.35,y:o.cy-B.D*1.35,w:B.D*2.7,h:B.D*2.7};o.bottom=o.y+B.D;}});
  b.bottom=cy+B.D/2;b.box={x:left,y,w:b.w,h:b.bottom-y};return b.bottom;}
 function place(o,left,y){if(o.isBunch)return placeBunch(o,left,y);
  o.y=y;o.cx=left+o.sw/2;o.x=o.cx-o.w/2;
  let x=left+(o.sw-o.kw)/2,bottom=y+o.h;const ky=y+o.h+o.f*1.3;
  o.kids.forEach((k,i)=>{if(i)x+=gap(o.kids[i-1],k);bottom=Math.max(bottom,place(k,x,ky));x+=k.sw;});
  o.box={x:left,y,w:o.sw,h:bottom-y};o.bottom=bottom;return bottom;}
 place(top,0,0);
 return {top,byId,objs,w:top.sw,h:top.bottom,B};
}

// ---- drawing ----
const svgEl=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);return e;};
const bucket=size=>'z'+Math.max(0,Math.floor(Math.log2(size)));
function draw(){
 const world=root.querySelector('.tm-world');world.textContent='';const B=L.B;
 const edges=svgEl('g',{class:'tm-edges'}),nodes=svgEl('g',{class:'tm-nodes'});world.append(edges,nodes);
 for(const o of L.objs){
  if(o.berry){drawBerry(o,nodes);continue;}
  if(o.kids.length){const sw=o.f*0.08,busY=o.y+o.h+o.f*0.6,ah=o.kids.map(k=>k.f*0.32);
   let d='M'+o.cx+' '+(o.y+o.h)+'V'+busY;
   if(o.kids.length>1)d+='M'+o.kids[0].cx+' '+busY+'H'+o.kids[o.kids.length-1].cx;
   o.kids.forEach((k,i)=>{if(!k.isBunch)d+='M'+k.cx+' '+busY+'V'+(k.y-ah[i]*0.9);});
   edges.append(svgEl('path',{d,class:'tm-edge','stroke-width':sw}));
   o.kids.forEach((k,i)=>{if(k.isBunch){drawStem(k,busY,edges);return;}const a=ah[i];edges.append(svgEl('path',{d:'M'+(k.cx-a*0.75)+' '+(k.y-a)+'L'+k.cx+' '+k.y+'L'+(k.cx+a*0.75)+' '+(k.y-a)+'Z',class:'tm-arrow'}));});}
  const g=svgEl('g',{class:'tm-node tm-r-'+o.rank,'data-map':o.id,'data-rank':o.rank,tabindex:'0',role:'button','aria-label':RANK[o.rank]+' '+o.name+', '+o.sub});
  g.append(svgEl('rect',{x:o.x,y:o.y,width:o.w,height:o.h,rx:o.h/2,class:'tm-pill'}));
  const t=svgEl('text',{x:o.cx,y:o.y+o.h*0.47,'font-size':o.f,class:'tm-name '+bucket(o.f)});t.textContent=o.name;g.append(t);
  const s=svgEl('text',{x:o.cx,y:o.y+o.h*0.47+o.f*0.62,'font-size':o.f*0.42,class:'tm-sub '+bucket(o.f*0.42)});s.textContent=o.sub;g.append(s);
  nodes.append(g);
 }
 function drawStem(b,busY,edges){const D=B.D,x=b.cx,top=b.top,first=b.fams[0];
  // stem from the branch line to the top of the bunch, a leaf on it, then thin stalks to every berry
  edges.append(svgEl('path',{d:'M'+x+' '+busY+'V'+(b.y+B.stem*0.15)+'C'+x+' '+(top-D*0.05)+' '+(x+D*0.06)+' '+(top-D*0.02)+' '+x+' '+(top+D*0.2),class:'tm-stem','stroke-width':FAM_F*0.2}));
  const ly=b.y+B.stem*0.35,lx=x+D*0.04;
  edges.append(svgEl('path',{d:'M'+lx+' '+ly+'c'+(D*0.18)+' '+(-D*0.2)+' '+(D*0.48)+' '+(-D*0.16)+' '+(D*0.62)+' '+(-D*0.02)+'c'+(-D*0.16)+' '+(D*0.2)+' '+(-D*0.46)+' '+(D*0.22)+' '+(-D*0.62)+' '+(D*0.02)+'Z',class:'tm-leaf'}));
  edges.append(svgEl('path',{d:'M'+lx+' '+ly+'l'+(D*0.55)+' '+(-D*0.02),class:'tm-vein','stroke-width':FAM_F*0.05}));
  let d='';for(const o of b.fams)d+='M'+x+' '+(top+D*0.2)+'Q'+x+' '+(o.cy-D*0.25)+' '+o.cx+' '+o.cy;
  edges.append(svgEl('path',{d,class:'tm-stalk','stroke-width':FAM_F*0.09}));}
 function drawBerry(o,nodes){const D=B.D,r=D/2,g=svgEl('g',{class:'tm-node tm-berry tm-r-family'+(sheetFor===o.id?' on':''),'data-map':o.id,'data-rank':'family',tabindex:'0',role:'button','aria-label':'Семейство '+o.name+', '+o.lat+', '+o.count});
  g.append(svgEl('circle',{cx:o.cx,cy:o.cy,r,class:'tm-pill'}));g.append(svgEl('circle',{cx:o.cx,cy:o.cy,r,class:'tm-shine'}));
  // progress band along the edge: green learned, gold reviewing, blue learning
  const c={mastered:0,review:0,learning:0};for(const id of o.ids){const t=tone(id);if(t in c)c[t]++;}let off=0;
  for(const k of ['mastered','review','learning']){if(!c[k])continue;const p=c[k]/o.ids.length*100;
   g.append(svgEl('circle',{cx:o.cx,cy:o.cy,r:r*0.93,pathLength:100,'stroke-dasharray':p+' '+(100-p),'stroke-dashoffset':-off+25,'stroke-width':D*0.05,class:'tm-ring '+k}));off+=p;}
  const lh=NAME_F*1.12,block=o.lines.length*lh+LAT_F*1.35+CNT_F*1.3;let y=o.cy-block/2+NAME_F*0.85;
  for(const ln of o.lines){const t=svgEl('text',{x:o.cx,y,'font-size':NAME_F,class:'tm-bname '+bucket(NAME_F)});t.textContent=ln;g.append(t);y+=lh;}
  y+=LAT_F*0.2;const la=svgEl('text',{x:o.cx,y,'font-size':LAT_F,class:'tm-blat '+bucket(LAT_F)});la.textContent=o.lat;g.append(la);y+=LAT_F*1.25;
  const ct=svgEl('text',{x:o.cx,y,'font-size':CNT_F,class:'tm-bcount '+bucket(CNT_F)});ct.textContent=o.count;g.append(ct);
  nodes.append(g);}
}

// ---- view: pan, zoom, levels of detail ----
const svg=()=>root.querySelector('svg.tm-svg');
function size(){const r=svg().getBoundingClientRect();return {w:r.width||800,h:r.height||600};}
function kMin(){const s=size();return Math.min(s.w/L.w,s.h/L.h)*0.5;}
let lodCut=null;
function apply(){const w=root.querySelector('.tm-world');w.setAttribute('transform','translate('+view.x+' '+view.y+') scale('+view.k+')');
 const cut=Math.ceil(Math.log2(MIN_TEXT_PX/view.k)-1);if(cut!==lodCut){lodCut=cut;let css='';for(let b=0;b<cut;b++)css+='#treeMap .z'+b+'{display:none}';root.querySelector('.tm-lod').textContent=css;}}
function clampK(k){return Math.max(kMin(),Math.min(K_MAX,k));}
function zoomAt(px,py,factor){const k=clampK(view.k*factor),wx=(px-view.x)/view.k,wy=(py-view.y)/view.k;view={k,x:px-k*wx,y:py-k*wy};apply();}
// Branches fit the screen; a family or genus list fits the width and starts at the top if it is long.
// Since every rank has one size, a wide branch on a narrow phone would shrink its labels to dots, so a branch
// is never shown smaller than minK (its child labels stay readable); it then centres on the branch itself
// and the rest is a swipe away.
function fitBox(b,listLike,minK,anchor,area){const s=area||{...size(),x:0,y:0},pad=0.06,kW=s.w/(b.w*(1+2*pad)),kH=s.h/(b.h*(1+2*pad));
 const k=clampK(Math.max(Math.min(K_MAX,listLike?kW:Math.min(kW,kH)),minK||0));let x=s.x+s.w/2-k*(b.x+b.w/2);
 if(b.w*k>s.w*(1-2*pad)&&anchor!=null)x=Math.min(s.x+s.w*pad-k*b.x,Math.max(s.x+s.w*(1-pad)-k*(b.x+b.w),s.x+s.w/2-k*anchor));
 const y=b.h*k<s.h?s.y+s.h/2-k*(b.y+b.h/2):s.y+s.h*pad-k*b.y;return {x,y,k};}
// The species sheet covers the lower half of the map on phones and a right-hand column on wide screens.
const wide=()=>size().w>=860;
function openArea(){const s=size();return wide()?{x:0,y:0,w:s.w-400,h:s.h}:{x:0,y:0,w:s.w,h:s.h*0.46};}
const READ_PX=11;
function animateTo(t){cancelAnimationFrame(anim);const s={...view},t0=performance.now(),D=450;
 if(/jsdom/i.test(navigator.userAgent)){view=t;apply();return;}
 const step=now=>{const p=Math.min(1,(now-t0)/D),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
  // interpolate in log-zoom so the motion feels even
  const k=Math.exp(Math.log(s.k)+(Math.log(t.k)-Math.log(s.k))*e);const f=(k-s.k)/((t.k-s.k)||1);
  view={k,x:s.x+(t.x-s.x)*(t.k===s.k?e:f),y:s.y+(t.y-s.y)*(t.k===s.k?e:f)};apply();if(p<1)anim=requestAnimationFrame(step);};
 anim=requestAnimationFrame(step);}
function focus(id,instant){const o=L.byId.get(id)||L.top;focusId=o.id;
 if(o.berry){sheet(o);const t=fitBox(o.box,false,0,null,openArea());instant?(cancelAnimationFrame(anim),view=t,apply()):animateTo(t);panel();markBerry();return;}
 sheet(null);markBerry();
 const kidF=o!==L.top&&o.kids.length?Math.min(...o.kids.map(c=>c.isBunch?NAME_F:c.f)):0;
 const t=fitBox(o.box||{x:o.x,y:o.y,w:o.w,h:o.h},false,kidF?READ_PX/kidF:0,o.cx);instant?(cancelAnimationFrame(anim),view=t,apply()):animateTo(t);panel();}
const markBerry=()=>root.querySelectorAll('.tm-berry').forEach(g=>g.classList.toggle('on',g.dataset.map===sheetFor));
// Genera and species of the tapped family, as the same rows as in the tree (photo, names, «Учить»).
function sheet(o){const el=root.querySelector('.tm-sheet');if(!o){el.hidden=true;sheetFor=null;return;}
 const body=el.querySelector('.tm-sheet-body'),keep=sheetFor===o.id?body.scrollTop:0;sheetFor=o.id;el.hidden=false;const ctx=A.context();
 el.querySelector('.tm-sheet-title').innerHTML='<strong>'+esc(o.name)+'</strong><em>Семейство · '+esc(o.lat)+' · '+esc(o.count)+'</em>';
 body.innerHTML=(o.n.children||[]).map(g=>{const sp=(g.children||[]).filter(c=>c.rank==='species'),use=sp.filter(c=>A.available(c.birdId)).length;
  return '<section class="tm-gsec"><h4><span class="tm-gl"><em>'+esc(g.latin)+'</em>'+(g.ru&&g.ru!==g.latin?' '+esc(g.ru):'')+'</span><button class="tm-gstudy" data-tm-genus="'+esc(g.id)+'"'+(ctx.own&&use?'':' disabled')+'>Учить род</button></h4>'+sp.map(c=>T.speciesRow(c.birdId,'')).join('')+'</section>';}).join('');
 body.scrollTop=keep;}
const parentOf=o=>o.parent;
function panel(){const o=L.byId.get(focusId)||L.top,ctx=A.context(),usable=o.ids.filter(id=>A.available(id)).length;
 const name=o.genus?(o.n.ru&&o.n.ru!==o.n.latin?o.n.ru:'Род'):o.name,sub=(o.genus?'Род · '+o.n.latin+' · '+o.ids.length+' '+C.word(o.ids.length):RANK[o.rank]+' · '+o.sub);
 root.querySelector('.tm-focus').innerHTML='<strong>'+esc(name)+'</strong><em>'+esc(sub)+'</em>';
 root.querySelector('[data-tm="up"]').disabled=!parentOf(o);
 const st=root.querySelector('[data-tm="study"]');st.disabled=!ctx.own||!usable;st.textContent=o===L.top?'Учить всех':'Учить ветку';}

// ---- render ----
function shell(){root.innerHTML='<div class="tree-heading"><div><p class="eyebrow">СХЕМА · ПРИБЛИЖАЙ ВЕТКИ</p><h2 id="mapTitle">Схема птиц</h2><p class="tree-subtitle">Двигай и приближай пальцами или колесом мыши. Нажми на ветку, чтобы приблизить её, на вид — чтобы открыть карточку.</p></div></div>'+
 '<div class="tm-bar"><div class="tm-focus" aria-live="polite"></div><div class="tm-tools"><button data-tm="up" aria-label="На уровень выше">↑</button><button data-tm="all">Обзор</button><button data-tm="out" aria-label="Отдалить">−</button><button data-tm="in" aria-label="Приблизить">+</button><button class="tm-study" data-tm="study">Учить ветку</button></div></div>'+
 '<div class="tm-filters" role="group" aria-label="Какие виды показать на схеме">'+Object.entries(MF).map(([k,t])=>'<label class="tf-chip"><input type="checkbox" data-mf="'+k+'"'+(mf[k]?' checked':'')+'><span>'+t+'</span></label>').join('')+'</div>'+
 '<ul class="tm-legend" aria-label="Цвет показывает ранг">'+Object.entries(RANK).map(([r,t])=>'<li class="tm-l-'+r+'"><i aria-hidden="true"></i>'+t+'</li>').join('')+'</ul>'+
 '<div class="tm-view"><svg class="tm-svg" role="group" aria-label="Схема родства птиц"><defs><radialGradient id="tmShine" cx="34%" cy="28%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient></defs><style class="tm-lod"></style><g class="tm-world"></g></svg><p class="tm-empty" hidden>Птицы не найдены. Измени поиск или галочки.</p>'+
 '<aside class="tm-sheet" hidden aria-label="Роды и виды семейства"><div class="tm-sheet-head"><div class="tm-sheet-title"></div><button class="tm-sheet-close" data-tm-close aria-label="Закрыть список">×</button></div><div class="tm-sheet-body"></div></aside></div>'+
 '<details class="tree-explanation"><summary>Как читать схему</summary><p>Сверху вниз: класс птиц, отряды, у воробьинообразных — подотряды и крупные группы, затем семейства. Под каждым семейством перечислены его роды (латынь, курсив) и виды. Цвет и размер рамки показывают ранг: все отряды одного цвета и размера, все семейства тоже, и каждый ранг меньше вышестоящего. У воробьинообразных между отрядом и семейством три ранга: подотряд (Tyranni, Passeri), инфраотряд (Corvides, Passerides) и парвотряд (Sylviida, Muscicapida, Passerida). Мелкие подписи появляются при приближении.</p><p>Кружок у вида показывает прогресс в текущем режиме: серый — новое, голубой — изучаю, жёлтый — повторяю, зелёный — выучено; пустой — нет фото или записи.</p><p>Схема показывает все виды сайта. Галочка «Только Польша» оставляет виды национального списка Польши (категории A и C, вместе с редкими залётами), «Только воробьиные» — отряд воробьинообразных; вместе они дают всех воробьинообразных Польши. Поиск выше тоже действует на схему.</p></details>';
 bind();}
function render(){
 if(root.hidden){dirty=true;return;}dirty=false;
 if(!root.querySelector('.tm-svg'))shell();
 const tree=source(),empty=!tree;root.querySelector('.tm-empty').hidden=!empty;svg().style.display=empty?'none':'';
 if(empty){root.querySelector('.tm-focus').innerHTML='';return;}
 const key=leaves(tree).join(',');L=layout(tree);draw();
 if(key!==lastKey){lastKey=key;lodCut=null;focus(L.byId.has(focusId)?focusId:L.top.id,true);}else{lodCut=null;apply();panel();const o=sheetFor&&L.byId.get(sheetFor);sheet(o||null);markBerry();}
}

// ---- input ----
function bind(){const s=svg();
 const ptr=new Map();let start=null,moved=false;
 const pos=e=>{const r=s.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 s.addEventListener('pointerdown',e=>{cancelAnimationFrame(anim);ptr.set(e.pointerId,pos(e));moved=false;start=snapshot();});
 function snapshot(){const p=[...ptr.values()];if(p.length===1)return {p0:p[0],v:{...view}};if(p.length>=2){const [a,b]=p;return {mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},d:Math.hypot(a.x-b.x,a.y-b.y)||1,v:{...view}};}return null;}
 s.addEventListener('pointermove',e=>{if(!ptr.has(e.pointerId)||!start)return;ptr.set(e.pointerId,pos(e));const p=[...ptr.values()];
  if(p.length===1&&start.p0){const dx=p[0].x-start.p0.x,dy=p[0].y-start.p0.y;if(!moved&&Math.hypot(dx,dy)<6)return;
   if(!moved){moved=true;try{s.setPointerCapture(e.pointerId);}catch(_){}}view={...view,x:start.v.x+dx,y:start.v.y+dy};apply();}
  else if(p.length>=2&&start.mid){moved=true;const [a,b]=p,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},d=Math.hypot(a.x-b.x,a.y-b.y);
   const k=clampK(start.v.k*d/start.d),wx=(start.mid.x-start.v.x)/start.v.k,wy=(start.mid.y-start.v.y)/start.v.k;view={k,x:mid.x-k*wx,y:mid.y-k*wy};apply();}});
 const up=e=>{ptr.delete(e.pointerId);start=snapshot();};
 s.addEventListener('pointerup',up);s.addEventListener('pointercancel',up);
 s.addEventListener('wheel',e=>{e.preventDefault();cancelAnimationFrame(anim);const p=pos(e);zoomAt(p.x,p.y,Math.exp(-e.deltaY*(e.deltaMode===1?0.05:0.0016)));},{passive:false});
 s.addEventListener('click',e=>{if(moved){moved=false;return;}activate(e.target);});
 s.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e.target);}});
 root.querySelector('.tm-filters').addEventListener('change',e=>{const c=e.target.closest('[data-mf]');if(!c)return;mf[c.dataset.mf]=c.checked;try{localStorage.setItem(MF_KEY,JSON.stringify(mf));}catch(_){}render();});
 root.querySelector('.tm-sheet').addEventListener('click',e=>{if(e.target.closest('[data-tm-close]')){const o=L.byId.get(sheetFor);focus(o&&o.parent?o.parent.id:L.top.id);return;}
  const g=e.target.closest('[data-tm-genus]');if(g&&!g.disabled){const o=L.byId.get(sheetFor),n=o&&(o.n.children||[]).find(c=>c.id===g.dataset.tmGenus);if(n)A.study(leaves(n),(n.ru&&n.ru!==n.latin?n.ru+' · ':'Род ')+n.latin);}});
 root.querySelector('.tm-tools').addEventListener('click',e=>{const b=e.target.closest('[data-tm]');if(!b||b.disabled)return;const a=b.dataset.tm,sz=size();
  if(a==='all')focus(L.top.id);else if(a==='in')zoomAt(sz.w/2,sz.h/2,1.6);else if(a==='out')zoomAt(sz.w/2,sz.h/2,1/1.6);
  else if(a==='up'){const o=L.byId.get(focusId);if(o&&parentOf(o))focus(parentOf(o).id);}
  else if(a==='study'){const o=L.byId.get(focusId)||L.top;A.study(o.ids,o===L.top?'Все птицы':o.genus?(o.n.ru&&o.n.ru!==o.n.latin?o.n.ru+' · ':'Род ')+o.n.latin:o.name);}});
}
function activate(t){const sp=t.closest&&t.closest('[data-map-sp]');if(sp){A.detail(sp.dataset.mapSp);return;}const n=t.closest&&t.closest('[data-map]');if(n)focus(n.dataset.map);}

// Full-width section, like the species board.
const pageWidth=()=>document.documentElement.style.setProperty('--page-w',document.documentElement.clientWidth+'px');
pageWidth();window.addEventListener('resize',()=>{pageWidth();if(L&&!root.hidden)apply();});
window.addEventListener('birdatlas:render',render);
// On this view the page's Poland chips and filter panel are hidden: the map has its own check boxes.
const mark=v=>document.body.classList.toggle('map-view',v==='map');
window.addEventListener('birdatlas:view',e=>{mark(e.detail);if(e.detail==='map'&&dirty)render();});mark(T.view);
window.BirdMap={get view(){return {...view};},focus:id=>focus(id,true),get focusId(){return focusId;},get filters(){return {...mf};}};
if(T.view==='map')render();
})();
