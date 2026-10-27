// Four distinct names, prioritising the deepest shared branch of the canonical tree.
// Siblings are equally ranked: the tree does not claim a finer species phylogeny.
(()=>{
'use strict';
const paths=new Map();
(function visit(node,path=[]){
 const next=[...path,node.id];
 if(node.rank==='species')paths.set(node.birdId,path);
 else (node.children||[]).forEach(child=>visit(child,next));
})(window.STUDY_TREE);
function proximity(a,b){
 const left=paths.get(a.id)||[],right=paths.get(b.id)||[];
 let i=0;while(i<left.length&&left[i]===right[i])i++;
 return i;
}
const label=(bird,language)=>String(bird[language]||'').trim();
const nameKey=(bird,language)=>label(bird,language).normalize('NFC').toLocaleLowerCase();
function options(bird,language,random=Math.random){
 if(!label(bird,language))return [];
 const used=new Set([nameKey(bird,language)]),selected=[bird];
 // Shuffle before a stable sort to rotate equally close relatives.
 const candidates=window.BirdStudy.shuffle(window.BIRD_DATA.filter(b=>b.id!==bird.id&&label(b,language)),random)
  .map(b=>({bird:b,rank:proximity(bird,b)})).sort((a,b)=>b.rank-a.rank);
 for(const candidate of candidates){
  const b=candidate.bird,k=nameKey(b,language);if(used.has(k))continue;
  used.add(k);selected.push(b);if(selected.length===4)break;
 }
 return selected.length===4?window.BirdStudy.shuffle(selected,random):[];
}
window.BirdPractice={options,label,proximity};
})();
