(function(root){
'use strict';
const DAY=86400000;
function initial(){return {level:0,interval:0,ease:2.5,due:0,reps:0,lapses:0,updatedAt:0};}
function clean(s){const x=initial(),v=s&&typeof s==='object'?s:{};for(const k of Object.keys(x))if(Number.isFinite(v[k]))x[k]=v[k];x.level=Math.max(0,Math.min(10,Math.floor(x.level)));x.interval=Math.max(0,Math.min(365,x.interval));x.ease=Math.max(1.3,Math.min(3.5,x.ease));x.reps=Math.max(0,Math.floor(x.reps));x.lapses=Math.max(0,Math.floor(x.lapses));x.due=Math.max(0,x.due);x.updatedAt=Math.max(0,x.updatedAt);return x;}
function schedule(previous,rating,now=Date.now()){
 if(!['again','hard','good','easy'].includes(rating))throw new Error('Unknown rating');
 const s=clean(previous),old=clean(previous);s.reps++;s.updatedAt=now;
 if(rating==='again'){s.level=Math.max(0,s.level-2);s.interval=0;s.due=now+600000;s.ease=Math.max(1.3,s.ease-.2);s.lapses++;}
 else if(rating==='hard'){s.level=Math.min(10,s.level+1);s.interval=old.interval?Math.min(365,Math.max(1,old.interval*1.2)):0;s.due=now+(s.interval?s.interval*DAY:600000);s.ease=Math.max(1.3,s.ease-.15);}
 else{const bonus=rating==='easy';s.level=Math.min(10,s.level+(bonus?2:1));s.interval=old.interval?Math.min(365,Math.max(1,Math.round(old.interval*(bonus?old.ease*1.3:old.ease)))):(bonus?4:1);s.due=now+s.interval*DAY;if(bonus)s.ease=Math.min(3.5,s.ease+.15);}
 return s;
}
function normalizeAnswer(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ё/g,'е').replace(/ł/g,'l').replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function due(s,now=Date.now()){return s&&s.reps>0&&s.due<=now;}
function shuffle(a,rand=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// Sample unique labels before shuffling all six positions, including the correct answer.
function answerChoices(correct,birds,field='ru',count=6,rand=Math.random){
 const seenIds=new Set([correct.id]),seenLabels=new Set([normalizeAnswer(correct[field])]),others=[];
 for(const b of shuffle(birds,rand)){const label=normalizeAnswer(b[field]);if(!label||seenIds.has(b.id)||seenLabels.has(label))continue;seenIds.add(b.id);seenLabels.add(label);others.push(b);if(others.length===count-1)break;}
 return shuffle([correct,...others],rand);
}
function queue(birds,states,key,kind,now=Date.now(),limit=20){let a=birds.filter(b=>kind==='new'?!states[key(b)]||states[key(b)].reps===0:due(states[key(b)],now));if(kind==='new')a=shuffle(a);else a.sort((a,b)=>states[key(a)].due-states[key(b)].due);return a.slice(0,limit);}
const api={DAY,initial,clean,schedule,normalizeAnswer,due,shuffle,answerChoices,queue};root.BirdStudy=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
