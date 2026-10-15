// Canonical names, tree membership and learning media share one record per species.
(()=>{
 const birds=window.BIRD_DATA,regions=window.BIRD_REGIONS.poland.species;
 const crow=birds.find(b=>b.id==='hooded-crow');
 if(crow){crow.aliases=[crow.ru,crow.en,crow.latin,crow.pl,'Серая ворона','Чёрная ворона','Черная ворона','Wrona siwa','Czarnowron'];crow.latin='Corvus corone';crow.tip='По AviList серая и чёрная вороны относятся к одному виду Corvus corone. Серая форма: Corvus corone cornix (ранее Corvus cornix). В тестах проверяется вид; окраска форм различается.';}
 const byLatin=new Map(birds.map(b=>[b.latin,b]));
 function link(n,family){
  if(n.rank==='family')family=n;
  if(n.rank==='species'){
   let b=byLatin.get(n.latin);const photo=window.BIRD_PHOTOS?.[n.id];
   if(!b){b={id:n.id,group:family?.latin==='Corvidae'?'corvid':'unclassified',photos:photo?[photo]:[],audio:[],tip:''};birds.push(b);byLatin.set(n.latin,b);}
   const aliases=[...(Array.isArray(b.aliases)?b.aliases:Object.values(b.aliases||{}).flat()),...(n.aliases||[]),b.ru,b.en,b.pl,n.latin];
   Object.assign(b,{ru:n.ru,en:n.en,pl:n.pl,latin:n.latin,treeId:n.id});
   b.aliases=[...new Set(aliases.filter(Boolean))];n.aliases=b.aliases;n.birdId=b.id;
   if(n.latin==='Corvus corone'&&photo&&!b.photos.some(p=>p.src===photo.src))b.photos.push(photo);
  }
  (n.children||[]).forEach(c=>link(c,family));
 }
 link(window.PASSERINE_TREE.root);
 const definitions=[
 ['Columbiformes','Голубеобразные','Columbidae','Голубиные','Columba','Голуби',['Columba palumbus','Columba livia']],
 ['Columbiformes','Голубеобразные','Columbidae','Голубиные','Streptopelia','Горлицы',['Streptopelia decaocto']],
 ['Piciformes','Дятлообразные','Picidae','Дятловые','Dendrocopos','Пёстрые дятлы',['Dendrocopos major']],
 ['Piciformes','Дятлообразные','Picidae','Дятловые','Picus','Зелёные дятлы',['Picus viridis']],
 ['Anseriformes','Гусеобразные','Anatidae','Утиные','Anas','Речные утки',['Anas platyrhynchos']],
 ['Anseriformes','Гусеобразные','Anatidae','Утиные','Cygnus','Лебеди',['Cygnus olor']],
 ['Gruiformes','Журавлеобразные','Rallidae','Пастушковые','Fulica','Лысухи',['Fulica atra']],
 ['Pelecaniformes','Пеликанообразные','Ardeidae','Цаплевые','Ardea','Цапли',['Ardea cinerea']],
 ['Charadriiformes','Ржанкообразные','Charadriidae','Ржанковые','Vanellus','Чибисы',['Vanellus vanellus']],
 ['Accipitriformes','Ястребообразные','Accipitridae','Ястребиные','Buteo','Канюки',['Buteo buteo']],
 ['Falconiformes','Соколообразные','Falconidae','Соколиные','Falco','Соколы',['Falco tinnunculus']]
 ];
 const orders=new Map();
 function branch(parent,id,ru,rank){let n=parent.find(x=>x.id===id);if(!n){n={id,latin:id,ru,rank,children:[]};parent.push(n);}return n;}
 for(const [order,orderRu,family,familyRu,genus,genusRu,species]of definitions){
  if(!orders.has(order))orders.set(order,{id:order,latin:order,ru:orderRu,rank:'order',children:[]});
  const f=branch(orders.get(order).children,family,familyRu,'family'),g=branch(f.children,genus,genusRu,'genus');
  for(const latin of species){const b=byLatin.get(latin),id=latin.replaceAll(' ','_');if(!b)continue;
   b.treeId=id;g.children.push({id,rank:'species',birdId:b.id,ru:b.ru,en:b.en,pl:b.pl,latin,aliases:b.aliases||[],vagrant:false});
   if(!regions[id])regions[id]={latin,category:latin==='Columba livia'?'C':'A',status:'L',rare:false,seasons:{breeding:true,passage:null,winter:null},evidence:{breeding:{url:'https://komisjafaunistyczna.pl/lista/',basis:latin==='Columba livia'?'National list: Columba livia forma urbana, category C, breeding L':'National list 2026-06-01: breeding status L'}}};
  }
 }
 window.STUDY_TREE={id:'Aves',rank:'class',ru:'Птицы Европы',latin:'Aves',children:[window.PASSERINE_TREE.root,...orders.values()]};
 window.BIRD_ID_ALIASES={Corvus_corone:'hooded-crow'};
 const region=n=>regions[n.treeId||n.id];
 const leaves=n=>n.rank==='species'?[n.birdId]:(n.children||[]).flatMap(leaves);
 window.BirdTaxonomy={leaves,region,isTypical:n=>region(n)?.rare===false};
})();
