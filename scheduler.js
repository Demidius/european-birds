(function(root){
'use strict';
const DAY=86400000;
function initial(){return {level:0,interval:0,ease:2.5,due:0,reps:0,lapses:0,updatedAt:0};}
function clean(s){const x=initial(),v=s&&typeof s==='object'?s:{};for(const k of Object.keys(x))if(Number.isFinite(v[k]))x[k]=v[k];x.level=Math.max(0,Math.min(10,Math.floor(x.level)));x.interval=Math.max(0,Math.min(365,x.interval));x.ease=Math.max(1.3,Math.min(3.5,x.ease));x.reps=Math.max(0,Math.floor(x.reps));x.lapses=Math.max(0,Math.floor(x.lapses));x.due=Math.max(0,x.due);x.updatedAt=Math.max(0,x.updatedAt);return x;}
// Anki-like SM-2, the same rules as the English site: the 0-10 level follows the interval.
const MIN=60000,MAX_IVL=365;
function levelFor(interval){if(interval>=180)return 10;if(interval>=90)return 9;if(interval>=45)return 8;if(interval>=25)return 7;if(interval>=14)return 6;if(interval>=7)return 5;if(interval>=4)return 4;if(interval>=2)return 3;if(interval>=1)return 2;return 1;}
function schedule(previous,rating,now=Date.now()){
 if(!['again','hard','good','easy','known'].includes(rating))throw new Error('Unknown rating');
 const s=clean(previous),old=s.interval;s.reps++;s.updatedAt=now;
 if(rating==='again'){s.interval=0;s.ease=Math.max(1.3,s.ease-.2);s.due=now+10*MIN;s.lapses++;s.level=1;return s;}
 if(rating==='known'){s.interval=Math.max(old,180);s.due=now+s.interval*DAY;s.level=10;return s;}
 let ivl;
 if(rating==='hard'){ivl=old?Math.max(1,old*1.2):.5;s.ease=Math.max(1.3,s.ease-.15);}
 else if(rating==='good')ivl=old?Math.max(old+1,old*s.ease):1;
 else{ivl=old?Math.max(old+1,old*s.ease*1.3):4;s.ease=Math.min(3.5,s.ease+.15);}
 s.ease=Math.round(s.ease*100)/100;s.interval=Math.min(MAX_IVL,Math.round(ivl*10)/10);s.due=now+s.interval*DAY;s.level=levelFor(s.interval);return s;
}
function ivlLabel(ms){if(ms<60*MIN)return Math.max(1,Math.round(ms/MIN))+' мин';if(ms<DAY*.9)return Math.round(ms/36e5)+' ч';const d=ms/DAY;if(d<1.5)return '1 дн.';if(d<30)return Math.round(d)+' дн.';if(d<365)return Math.round(d/30)+' мес.';return (Math.round(d/36.5)/10)+' г.';}
function normalizeAnswer(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ё/g,'е').replace(/ł/g,'l').replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
// Approximate Russian reading of scientific Latin, without inferred stress.
// Uses the continental convention common in Russian biology teaching.
function word(n,forms=['вид','вида','видов']){const a=n%10,b=n%100;return b>=11&&b<=14?forms[2]:a===1?forms[0]:a>=2&&a<=4?forms[1]:forms[2];}
function nameVariants(b){return [b.ru,b.en,b.latin,b.pl,...(Array.isArray(b.aliases)?b.aliases:Object.values(b.aliases||{}).flat())].filter(Boolean);}
function searchNames(b){return nameVariants(b).join(' ');}
function matchesName(b,query){const q=normalizeAnswer(query);return nameVariants(b).some(name=>normalizeAnswer(name).includes(q));}
function latinReading(value){
 const letters={a:'а',b:'б',c:'к',d:'д',e:'е',f:'ф',g:'г',h:'г',i:'и',j:'й',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'к',r:'р',s:'с',t:'т',u:'у',v:'в',w:'в',x:'кс',y:'и',z:'з'};
 return String(value||'').replace(/[A-Za-zÀ-ž]+/g,word=>{
  let t=word.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  t=t.replace(/caerule/g,'церуле').replace(/coele/g,'целе')
   .replace(/ch/g,'х').replace(/ph/g,'ф').replace(/th/g,'т').replace(/rh/g,'р').replace(/qu/g,'кв')
   .replace(/c(?=ae|oe|[eiy])/g,'ц').replace(/^(ae|oe)/,'э').replace(/ae|oe/g,'е')
   .replace(/([aeiouy])s(?=[aeiouy])/g,'$1з')
   .replace(/(^|[aeiouy])i(?=[aeou])/g,'$1й')
   .replace(/(^|[^stx])ti(?=[aeou])/g,'$1ци');
  t=t.replace(/[a-z]/g,c=>letters[c]||c);
  return /^[A-Z]/.test(word)?t.charAt(0).toUpperCase()+t.slice(1):t;
 });
}
function latinLabel(value){return value?value+' ('+latinReading(value)+')':'';}
function status(s){return s.reps===0?'new':s.level>=10?'mastered':s.level>=5?'review':'learning';}
function progress(states){
 const out={n:states.length,new:0,learning:0,review:0,mastered:0,pct:0,status:'new'};
 let levels=0;for(const s of states){out[status(s)]++;levels+=s.level;}
 if(out.n){out.pct=Math.round(levels/(10*out.n)*100);out.status=out.new===out.n?'new':out.mastered===out.n?'mastered':out.review+out.mastered===out.n?'review':'learning';}
 return out;
}
function due(s,now=Date.now()){return s&&s.reps>0&&s.due<=now;}
function shuffle(a,rand=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function queue(birds,states,key,kind,now=Date.now(),limit=20){let a=birds.filter(b=>kind==='new'?!states[key(b)]||states[key(b)].reps===0:due(states[key(b)],now));if(kind==='new')a=shuffle(a);else a.sort((a,b)=>states[key(a)].due-states[key(b)].due);return a.slice(0,limit);}
const api={DAY,initial,clean,schedule,levelFor,ivlLabel,normalizeAnswer,word,searchNames,matchesName,latinReading,latinLabel,status,progress,due,shuffle,queue};root.BirdStudy=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
