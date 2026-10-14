(()=>{
'use strict';
const data=window.PARIDAE_TREE,root=document.getElementById('familyTree');
if(!data||!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const genera=new Map(data.genera.map(g=>[g.latin,g]));
function genus(name){const g=genera.get(name);return '<li class="phylo-genus" data-genus="'+esc(name)+'"><details open><summary><span class="genus-name">'+esc(name)+'</span><span class="genus-count">'+g.species.length+' '+(g.species.length===1?'вид':g.species.length<5?'вида':'видов')+'</span></summary><ul class="species-list">'+g.species.map(s=>'<li data-species="'+esc(s.latin)+'"><span class="species-latin">'+esc(s.latin)+'</span><span class="species-name">'+esc(s.ru||s.en)+'</span></li>').join('')+'</ul></details></li>';}
function branch(node){if(typeof node==='string')return genus(node);return '<li class="phylo-branch"><span class="ancestor-dot" aria-hidden="true"></span><span class="sr-only">Общий предок следующих ветвей</span><ul class="phylo-children">'+node.map(branch).join('')+'</ul></li>';}
root.innerHTML='<div class="family-root"><span class="root-dot" aria-hidden="true"></span><div><strong>'+esc(data.family.ru)+'</strong><span>'+esc(data.family.latin)+'</span></div></div><ul class="phylo-top">'+data.topology.map(branch).join('')+'</ul>';
const details=()=>Array.from(root.querySelectorAll('.phylo-genus>details'));
function syncDepth(){const list=details(),allClosed=list.every(d=>!d.open),allOpen=list.every(d=>d.open);document.getElementById('showGenera').setAttribute('aria-pressed',String(allClosed));document.getElementById('showSpecies').setAttribute('aria-pressed',String(allOpen));}
function depth(open){details().forEach(d=>d.open=open);syncDepth();}
document.getElementById('showGenera').addEventListener('click',()=>depth(false));
document.getElementById('showSpecies').addEventListener('click',()=>depth(true));
root.addEventListener('toggle',syncDepth,true);
syncDepth();
})();
