(function(root){
'use strict';
const DAY=86400000;
// Manual progress: the learner sets each species' status and level by hand.
// Statuses: unknown (не знаю), learning (изучаю), known (знаю). Level 0-10 is independent of the status.
const STATUSES=['unknown','learning','known'],LABELS={unknown:'Не знаю',learning:'Изучаю',known:'Знаю'};
function initial(){return {status:'unknown',level:0,seen:0,today:0,day:0,lastSeen:0,updatedAt:0};}
// Older saves came from the Anki scheduler (reps, interval, due...): never studied -> unknown, level 10 -> known, otherwise learning.
function clean(s){const x=initial(),v=s&&typeof s==='object'?s:{};
 for(const k of ['level','seen','today','day','lastSeen','updatedAt'])if(Number.isFinite(v[k]))x[k]=v[k];
 if(!Number.isFinite(v.seen)&&Number.isFinite(v.reps))x.seen=v.reps;
 x.level=Math.max(0,Math.min(10,Math.round(x.level)));x.seen=Math.max(0,Math.floor(x.seen));x.today=Math.max(0,Math.floor(x.today));x.day=Math.max(0,Math.floor(x.day));x.lastSeen=Math.max(0,x.lastSeen);x.updatedAt=Math.max(0,x.updatedAt);
 if(STATUSES.includes(v.status))x.status=v.status;else if(Number.isFinite(v.reps)&&v.reps>0)x.status=x.level>=10?'known':'learning';
 return x;}
// Local calendar day as YYYYMMDD: "today" resets at the learner's midnight.
function dayKey(now=Date.now()){const d=new Date(now);return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();}
function todayCount(s,now=Date.now()){return s&&s.day===dayKey(now)?s.today:0;}
function setStatus(prev,status,now=Date.now()){if(!STATUSES.includes(status))throw new Error('Unknown status');const s=clean(prev);s.status=status;s.updatedAt=now;return s;}
function setLevel(prev,level,now=Date.now()){const s=clean(prev);s.level=Math.max(0,Math.min(10,Math.round(Number(level)||0)));s.updatedAt=now;return s;}
function markSeen(prev,now=Date.now()){const s=clean(prev),d=dayKey(now);s.today=s.day===d?s.today+1:1;s.day=d;s.seen++;s.lastSeen=now;s.updatedAt=now;return s;}
// Draw weight: every view today makes a species much less likely (1, 1/4, 1/9...);
// species not shown for a while get up to twice the chance, never-shown ones the full bonus.
function weight(s,now=Date.now()){const t=todayCount(s,now),days=s&&s.lastSeen?Math.min(14,Math.max(0,(now-s.lastSeen)/DAY)):14;return 1/((1+t)*(1+t))*(1+days/14);}
function pick(birds,states,key,status,now=Date.now(),rand=Math.random,avoid=null){
 let pool=birds.filter(b=>!status||clean(states[key(b)]).status===status);
 if(pool.length>1&&avoid)pool=pool.filter(b=>b.id!==avoid);
 if(!pool.length)return null;
 const w=pool.map(b=>weight(states[key(b)]&&clean(states[key(b)]),now)),sum=w.reduce((a,b)=>a+b,0);let r=rand()*sum;
 for(let i=0;i<pool.length;i++){r-=w[i];if(r<0)return pool[i];}return pool[pool.length-1];}
function normalizeAnswer(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ё/g,'е').replace(/ł/g,'l').replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
// Approximate Russian reading of scientific Latin, without inferred stress.
// Uses the continental convention common in Russian biology teaching.
function word(n,forms=['вид','вида','видов']){const a=n%10,b=n%100;return b>=11&&b<=14?forms[2]:a===1?forms[0]:a>=2&&a<=4?forms[1]:forms[2];}
function nameVariants(b){return [b.ru,b.en,b.latin,b.pl,...(Array.isArray(b.aliases)?b.aliases:Object.values(b.aliases||{}).flat())].filter(Boolean);}
function searchNames(b){return nameVariants(b).join(' ');}
function matchesName(b,query){const q=normalizeAnswer(query);return nameVariants(b).some(name=>normalizeAnswer(name).includes(q));}
function latinReading(value){
 const letters={a:'а',b:'б',c:'к',d:'д',e:'е',f:'ф',g:'г',h:'г',i:'и',j:'й',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'к',r:'р',s:'с',t:'т',u:'у',v:'в',w:'в',x:'кс',y:'и',z:'з'};
 return String(value||'').replace(/[A-Za-zÀ-ž]+/g,word=>{
  let t=word.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
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
function status(s){return clean(s).status;}
// CSS tone shared by the tree, the map and the catalog.
function tone(s){return ({unknown:'new',learning:'learning',known:'mastered'})[status(s)];}
function progress(states){
 const out={n:states.length,unknown:0,learning:0,known:0,levels:0,pct:0,status:'unknown'};
 for(const s of states){const x=clean(s);out[x.status]++;out.levels+=x.level;}
 if(out.n){out.pct=Math.round(out.levels/(10*out.n)*100);out.status=out.unknown===out.n?'unknown':out.known===out.n?'known':'learning';}
 return out;
}
function shuffle(a,rand=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const api={DAY,STATUSES,LABELS,initial,clean,dayKey,todayCount,setStatus,setLevel,markSeen,weight,pick,normalizeAnswer,word,searchNames,matchesName,latinReading,latinLabel,status,tone,progress,shuffle};root.BirdStudy=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
