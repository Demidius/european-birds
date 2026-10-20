// Zoomable bird tree drawn as a diagram: Birds → orders → passerine groups → families as pills joined by
// arrows, with genera and species listed under each family. Every rank has its own size and colour: all orders
// alike, all families alike, and each rank smaller than the one above it. Drag, pinch or scroll to move and
// zoom; tap a branch to zoom into it, a species to open its card.
// Families of one parent hang off a trunk in two columns (like the drill-down tree), so a big group such as
// Sylviida grows down instead of stretching the map sideways.
// The map always starts from every species on the site; its own check boxes keep only Polish species or
// only passerines. The page's search applies; the page's Poland filters do not.
// The map is not part of the page: the «Схема» button opens it over the page on the whole screen (the browser's
// full screen where it is allowed, otherwise the section covers the window, as on iPhone); the × button or Esc
// closes it and the page stays where it was.
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

// ---- layout (world units; the smallest text is about 11 units) ----
let L=null,view={x:0,y:0,k:1},focusId=null,lastKey='',anim=0,dirty=true;
function layout(tree){
 const byId=new Map(),objs=[];
 function make(n,parent){
  const ids=leaves(n),rank=rankOf(n,parent),f=SIZE[rank]||SIZE.family,name=nameOf(n),lat=n.latin&&n.latin!==name?n.latin:'';
  const sub=(lat?lat+' · ':'')+ids.length+' '+C.word(ids.length),pad=f*0.75,groups=(parent?parent.groups:0)+(n.rank==='group'?1:0);
  const o={n,id:n.id,ids,f,rank,groups,parent,name,sub,kids:[],w:Math.max(measure(name,f),measure(sub,f*0.42,500))+pad*2,h:f*2.1};
  byId.set(o.id,o);objs.push(o);
  if(n.rank==='family')o.list=listRows(o);
  else o.kids=(n.children||[]).filter(c=>c.rank!=='species'&&c.rank!=='genus').map(c=>make(c,o));
  return o;
 }
 function listRows(o){
  const f=o.f,col=Math.max(o.w,f*8),rows=[],gS=f*0.62,sS=f*0.5,lS=f*0.4,indent=f*0.9,inner=col-f*0.6;
  for(const g of o.n.children||[]){
   const gl=wrap(g.latin+(g.ru&&g.ru!==g.latin?'  '+g.ru:''),gS,inner,600,true);
   const go={id:g.id,n:g,ids:leaves(g),genus:true,lines:gl,size:gS,h:gl.length*gS*1.3+f*0.25,parent:o};byId.set(go.id,go);rows.push(go);
   for(const sp of g.children||[]){if(sp.rank!=='species')continue;const b=birds.get(sp.birdId);if(!b)continue;
    const nl=wrap(b.ru,sS,inner-indent-sS,600,false),ll=wrap(b.latin,lS,inner-indent-sS,500,true);
    rows.push({id:b.id,bird:b,lines:nl,latin:ll,size:sS,lsize:lS,indent,h:nl.length*sS*1.25+ll.length*lS*1.25+f*0.3,genusRow:go});}
  }
  o.col=col;return rows;
 }
 const top=make(tree,null);
 // subtree widths, then positions
 const forked=o=>o.kids.length>1&&o.kids.every(k=>k.list);
 function width(o){if(o.list)return o.sw=o.col;
  if(forked(o)){o.fork=true;o.colW=Math.max(...o.kids.map(width));o.forkGap=o.kids[0].f*1.6;o.kw=o.colW*2+o.forkGap;return o.sw=Math.max(o.w,o.kw);}
  const kw=o.kids.reduce((a,k,i)=>a+width(k)+(i?gap(o.kids[i-1],k):0),0);o.kw=kw;return o.sw=Math.max(o.w,kw);}
 const gap=(a,b)=>(a.f+b.f)*0.45;
 width(top);
 function place(o,left,y){o.y=y;o.cx=left+o.sw/2;o.x=o.cx-o.w/2;
  if(o.list){let ry=y+o.h+o.f*0.7;const lx=left;o.listX=lx;o.listTop=ry-o.f*0.35;
   for(const r of o.list){r.x=lx+(r.genus?o.f*0.3:o.f*0.3+r.indent);r.y=ry;ry+=r.h;}o.bottom=ry+o.f*0.2;
   for(const r of o.list)if(r.genus){const sp=o.list.filter(s=>s.genusRow===r);const last=sp[sp.length-1]||r;r.box={x:lx,y:r.y-o.f*0.1,w:o.col,h:last.y+last.h-r.y+o.f*0.1};}
   o.box={x:left,y,w:o.col,h:o.bottom-y};return o.bottom;}
  if(o.fork){const cx=left+o.sw/2,kf=o.kids[0].f,step=kf*1.9,half=o.forkGap/2+o.colW/2;let top=y+o.h+step,bottom=y+o.h;o.rows=[];
   for(let i=0;i<o.kids.length;i+=2){const pair=o.kids.slice(i,i+2);let rb=top;
    if(pair.length===2){rb=Math.max(place(pair[0],cx-half-pair[0].sw/2,top),place(pair[1],cx+half-pair[1].sw/2,top));}
    else rb=place(pair[0],cx-pair[0].sw/2,top);
    o.rows.push({y:top,kids:pair});bottom=Math.max(bottom,rb);top=rb+step;}
   o.box={x:left,y,w:o.sw,h:bottom-y};o.bottom=bottom;return bottom;}
  let x=left+(o.sw-o.kw)/2,bottom=y+o.h;const ky=y+o.h+o.f*1.3;
  o.kids.forEach((k,i)=>{if(i)x+=gap(o.kids[i-1],k);bottom=Math.max(bottom,place(k,x,ky));x+=k.sw;});
  o.box={x:left,y,w:o.sw,h:bottom-y};o.bottom=bottom;return bottom;}
 place(top,0,0);
 return {top,byId,objs,w:top.sw,h:top.bottom};
}

// ---- drawing ----
const svgEl=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);return e;};
const bucket=size=>'z'+Math.max(0,Math.floor(Math.log2(size)));
function draw(){
 const world=root.querySelector('.tm-world');world.textContent='';
 const edges=svgEl('g',{class:'tm-edges'}),nodes=svgEl('g',{class:'tm-nodes'});world.append(edges,nodes);
 for(const o of L.objs){
  if(o.fork){const kf=o.kids[0].f,sw=kf*0.12,bar=r=>r.y-kf*0.95,last=o.rows[o.rows.length-1];
   let d='M'+o.cx+' '+(o.y+o.h)+'V'+bar(last);
   for(const r of o.rows){const by=bar(r);if(r.kids.length===2)d+='M'+r.kids[0].cx+' '+by+'H'+r.kids[1].cx;r.kids.forEach(k=>{d+='M'+k.cx+' '+by+'V'+(k.y-k.f*0.32*0.9);});}
   edges.append(svgEl('path',{d,class:'tm-edge','stroke-width':sw}));
   o.kids.forEach(k=>{const a=k.f*0.32;edges.append(svgEl('path',{d:'M'+(k.cx-a*0.75)+' '+(k.y-a)+'L'+k.cx+' '+k.y+'L'+(k.cx+a*0.75)+' '+(k.y-a)+'Z',class:'tm-arrow'}));});}
  else if(o.kids.length){const sw=o.f*0.08,busY=o.y+o.h+o.f*0.6,ah=o.kids.map(k=>k.f*0.32);
   let d='M'+o.cx+' '+(o.y+o.h)+'V'+busY;
   if(o.kids.length>1)d+='M'+o.kids[0].cx+' '+busY+'H'+o.kids[o.kids.length-1].cx;
   o.kids.forEach((k,i)=>{d+='M'+k.cx+' '+busY+'V'+(k.y-ah[i]*0.9);});
   edges.append(svgEl('path',{d,class:'tm-edge','stroke-width':sw}));
   o.kids.forEach((k,i)=>{const a=ah[i];edges.append(svgEl('path',{d:'M'+(k.cx-a*0.75)+' '+(k.y-a)+'L'+k.cx+' '+k.y+'L'+(k.cx+a*0.75)+' '+(k.y-a)+'Z',class:'tm-arrow'}));});}
  const g=svgEl('g',{class:'tm-node tm-r-'+o.rank+(o.list?' tm-family':''),'data-map':o.id,'data-rank':o.rank,tabindex:'0',role:'button','aria-label':RANK[o.rank]+' '+o.name+', '+o.sub});
  if(o.list)g.append(svgEl('rect',{x:o.box.x,y:o.listTop,width:o.col,height:o.bottom-o.listTop,class:'tm-col'}));
  g.append(svgEl('rect',{x:o.x,y:o.y,width:o.w,height:o.h,rx:o.h/2,class:'tm-pill'}));
  const t=svgEl('text',{x:o.cx,y:o.y+o.h*0.47,'font-size':o.f,class:'tm-name '+bucket(o.f)});t.textContent=o.name;g.append(t);
  const s=svgEl('text',{x:o.cx,y:o.y+o.h*0.47+o.f*0.62,'font-size':o.f*0.42,class:'tm-sub '+bucket(o.f*0.42)});s.textContent=o.sub;g.append(s);
  nodes.append(g);
  if(o.list){const list=svgEl('g',{class:'tm-list'});
   for(const r of o.list){
    if(r.genus){const gg=svgEl('g',{class:'tm-genus','data-map':r.id,tabindex:'0',role:'button','aria-label':'Род '+r.n.latin});
      gg.append(svgEl('rect',{x:r.box.x,y:r.box.y,width:r.box.w,height:r.box.h,class:'tm-hit'}));
      r.lines.forEach((ln,i)=>{const e=svgEl('text',{x:r.x,y:r.y+r.size*(1+i*1.3),'font-size':r.size,class:'tm-gname '+bucket(r.size)});e.textContent=ln;gg.append(e);});
      list.append(gg);continue;}
    const sg=svgEl('g',{class:'tm-sp','data-map-sp':r.id,tabindex:'0',role:'button','aria-label':r.bird.ru+', '+r.bird.latin});
    sg.append(svgEl('rect',{x:r.x-r.size*1.1,y:r.y,width:o.col-(r.x-o.box.x)+r.size*1.1-o.f*0.15,height:r.h,class:'tm-hit'}));
    sg.append(svgEl('circle',{cx:r.x-r.size*0.6,cy:r.y+r.size*0.62,r:r.size*0.26,class:'tm-dot '+tone(r.id)}));
    let yy=r.y;r.lines.forEach(ln=>{yy+=r.size*1.0;const e=svgEl('text',{x:r.x,y:yy,'font-size':r.size,class:'tm-sname '+bucket(r.size)});e.textContent=ln;sg.append(e);yy+=r.size*0.25;});
    r.latin.forEach(ln=>{yy+=r.lsize*1.0;const e=svgEl('text',{x:r.x,y:yy,'font-size':r.lsize,class:'tm-slat '+bucket(r.lsize)});e.textContent=ln;sg.append(e);yy+=r.lsize*0.25;});
    list.append(sg);}
   nodes.append(list);}
 }
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
function fitBox(b,listLike,minK,anchor){const s=size(),pad=0.06,kW=s.w/(b.w*(1+2*pad)),kH=s.h/(b.h*(1+2*pad));
 const k=clampK(Math.max(Math.min(K_MAX,listLike?kW:Math.min(kW,kH)),minK||0));let x=s.w/2-k*(b.x+b.w/2);
 if(b.w*k>s.w*(1-2*pad)&&anchor!=null)x=Math.min(s.w*pad-k*b.x,Math.max(s.w*(1-pad)-k*(b.x+b.w),s.w/2-k*anchor));
 const y=b.h*k<s.h?s.h/2-k*(b.y+b.h/2):s.h*pad-k*b.y;return {x,y,k};}
const READ_PX=11;
function animateTo(t){cancelAnimationFrame(anim);const s={...view},t0=performance.now(),D=450;
 if(/jsdom/i.test(navigator.userAgent)){view=t;apply();return;}
 const step=now=>{const p=Math.min(1,(now-t0)/D),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
  // interpolate in log-zoom so the motion feels even
  const k=Math.exp(Math.log(s.k)+(Math.log(t.k)-Math.log(s.k))*e);const f=(k-s.k)/((t.k-s.k)||1);
  view={k,x:s.x+(t.x-s.x)*(t.k===s.k?e:f),y:s.y+(t.y-s.y)*(t.k===s.k?e:f)};apply();if(p<1)anim=requestAnimationFrame(step);};
 anim=requestAnimationFrame(step);}
function focus(id,instant){const o=L.byId.get(id)||L.top;focusId=o.id;
 const kidF=o!==L.top&&o.kids&&o.kids.length?Math.min(...o.kids.map(c=>c.f)):0;
 const t=fitBox(o.box||{x:o.x,y:o.y,w:o.w,h:o.h},!!(o.list||o.genus),kidF?READ_PX/kidF:0,o.genus?null:o.cx);instant?(view=t,apply()):animateTo(t);panel();}
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
 '<div class="tm-view"><svg class="tm-svg" role="group" aria-label="Схема родства птиц"><style class="tm-lod"></style><g class="tm-world"></g></svg>'+
 '<button type="button" class="tm-full-btn" data-tm-close aria-label="Закрыть схему" title="Закрыть">'+ICON+'</button><p class="tm-empty" hidden>Птицы не найдены. Измени поиск или галочки.</p></div>'+
 '<details class="tree-explanation"><summary>Как читать схему</summary><p>Сверху вниз: класс птиц, отряды, у воробьинообразных — подотряды и крупные группы, затем семейства. Семейства одной ветви висят на общем стволе в две колонки. Под каждым семейством перечислены его роды (латынь, курсив) и виды. Цвет и размер рамки показывают ранг: все отряды одного цвета и размера, все семейства тоже, и каждый ранг меньше вышестоящего. У воробьинообразных между отрядом и семейством три ранга: подотряд (Tyranni, Passeri), инфраотряд (Corvides, Passerides) и парвотряд (Sylviida, Muscicapida, Passerida). Мелкие подписи появляются при приближении.</p><p>Кружок у вида показывает прогресс в текущем режиме: серый — новое, голубой — изучаю, жёлтый — повторяю, зелёный — выучено; пустой — нет фото или записи.</p><p>Схема показывает все виды сайта. Галочка «Только Польша» оставляет виды национального списка Польши (категории A и C, вместе с редкими залётами), «Только воробьиные» — отряд воробьинообразных; вместе они дают всех воробьинообразных Польши. Поиск выше тоже действует на схему.</p></details>';
 bind();}
function render(){
 if(root.hidden){dirty=true;return;}dirty=false;
 if(!root.querySelector('.tm-svg'))shell();
 const tree=source(),empty=!tree;root.querySelector('.tm-empty').hidden=!empty;svg().style.display=empty?'none':'';
 if(empty){root.querySelector('.tm-focus').innerHTML='';return;}
 const key=leaves(tree).join(',');L=layout(tree);draw();
 if(key!==lastKey){lastKey=key;lodCut=null;focus(L.byId.has(focusId)?focusId:L.top.id,true);}else{lodCut=null;apply();panel();}
}

// ---- full screen ----
const ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const fsNow=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
let native=false;
const isFull=()=>root.classList.contains('tm-full');
function setFull(on){if(on===isFull())return;
 root.classList.toggle('tm-full',on);document.documentElement.classList.toggle('tm-full-page',on);root.hidden=!on;
 const open=$('mapView');if(open)open.setAttribute('aria-pressed',String(on));
 if(on&&dirty)render();
 if(on){const req=root.requestFullscreen||root.webkitRequestFullscreen;
  if(req)try{const p=req.call(root);if(p&&p.catch)p.catch(()=>{});}catch(_){}}
 else if(fsNow()===root){const ex=document.exitFullscreen||document.webkitExitFullscreen;try{const p=ex&&ex.call(document);if(p&&p.catch)p.catch(()=>{});}catch(_){}}
 const f=on?root.querySelector('[data-tm-close]'):open;if(f)f.focus({preventScroll:true});}
const onFs=()=>{if(fsNow()===root)native=true;else if(native){native=false;setFull(false);}};
document.addEventListener('fullscreenchange',onFs);document.addEventListener('webkitfullscreenchange',onFs);
// Esc closes the covering mode; with an open card the key closes the card first.
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isFull()&&!document.querySelector('dialog[open]'))setFull(false);});
// When the map changes size (full screen, rotation) the same spot stays in the middle.
let lastBox=null;
function watchSize(){if(!window.ResizeObserver)return;new ResizeObserver(()=>{const r=svg().getBoundingClientRect();if(!r.width||!r.height)return;
 if(L&&lastBox&&(r.width!==lastBox.w||r.height!==lastBox.h)){view={...view,x:view.x+(r.width-lastBox.w)/2,y:view.y+(r.height-lastBox.h)/2};apply();}
 lastBox={w:r.width,h:r.height};}).observe(svg());}

// ---- input ----
function bind(){const s=svg();watchSize();
 root.querySelector('[data-tm-close]').addEventListener('click',()=>setFull(false));
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
// «Схема» is not a page tab: it only opens the map, and the tab switch of study-tree.js never sees the click.
window.addEventListener('click',e=>{if(!e.target.closest||!e.target.closest('#mapView'))return;e.stopPropagation();setFull(true);},true);
window.addEventListener('birdatlas:view',()=>{if(isFull())setFull(false);});
// A page saved on the old map tab opens on the tree.
if(T.view==='map'&&$('treeView'))$('treeView').click();
window.BirdMap={get view(){return {...view};},get isOpen(){return isFull();},open:()=>setFull(true),close:()=>setFull(false),focus:id=>focus(id,true),get focusId(){return focusId;},get filters(){return {...mf};}};
})();
