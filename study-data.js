// Share taxonomy and media with the learning collection; keep existing progress IDs.
(()=>{
 const birds=window.BIRD_DATA,byLatin=new Map(birds.map(b=>[b.latin,b]));
 function walk(n,family){
  if(n.rank==='family')family=n;
  if(n.rank==='species'){
   let b=byLatin.get(n.latin);
   if(!b){const photo=window.BIRD_PHOTOS?.[n.id];b={id:n.id,ru:n.ru,en:n.en,latin:n.latin,pl:n.pl,group:family?.latin==='Corvidae'?'corvid':'forest',photos:photo?[photo]:[],audio:[],tip:''};birds.push(b);byLatin.set(n.latin,b);}
   n.birdId=b.id;b.treeId=n.id;
  }
  (n.children||[]).forEach(c=>walk(c,family));
 }
 walk(window.PASSERINE_TREE.root);
 const present=new Set();function collect(n){if(n.birdId)present.add(n.birdId);(n.children||[]).forEach(collect);}collect(window.PASSERINE_TREE.root);
 window.STUDY_TREE={id:'Aves',rank:'class',ru:'Птицы Европы',latin:'Aves',children:[window.PASSERINE_TREE.root,{id:'other-birds',rank:'collection',ru:'Другие птицы коллекции',latin:'',children:birds.filter(b=>!present.has(b.id)).map(b=>({id:b.id,birdId:b.id,rank:'species',ru:b.ru,en:b.en,pl:b.pl,latin:b.latin}))}]};
})();
