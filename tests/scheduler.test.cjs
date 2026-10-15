const {test}=require('node:test');const assert=require('node:assert/strict');const C=require('../scheduler.js');
// Same Anki-like rules as the English site: the 0-10 level follows the interval.
test('first answers on a new card: again 10 min, hard half a day, good 1 day, easy 4 days',()=>{const now=1000000,o=C.initial();
 const a=C.schedule(o,'again',now),h=C.schedule(o,'hard',now),g=C.schedule(o,'good',now),e=C.schedule(o,'easy',now);
 assert.equal(a.due,now+10*60000);assert.equal(a.interval,0);assert.equal(a.level,1);assert.equal(a.lapses,1);
 assert.equal(h.interval,0.5);assert.equal(h.due,now+0.5*C.DAY);assert.equal(h.level,1);
 assert.equal(g.interval,1);assert.equal(g.due,now+C.DAY);assert.equal(g.level,2);
 assert.equal(e.interval,4);assert.equal(e.due,now+4*C.DAY);assert.equal(e.level,4);assert.equal(e.ease,2.65);
 assert.equal(o.level,0);assert.equal(o.reps,0);for(const s of [a,h,g,e])assert.equal(s.reps,1);});
test('good multiplies the interval by ease; hard by 1.2 and lowers ease; easy adds a 1.3 bonus',()=>{const s={...C.initial(),reps:3,interval:10,ease:2.5,level:5};
 assert.equal(C.schedule(s,'good',0).interval,25);const h=C.schedule(s,'hard',0);assert.equal(h.interval,12);assert.equal(h.ease,2.35);assert.equal(C.schedule(s,'easy',0).interval,32.5);});
test('again resets the interval, keeps the card in reviews and lowers ease, never below 1.3',()=>{const a=C.schedule({level:10,reps:9,interval:45,ease:1.4},'again',1000);
 assert.equal(a.level,1);assert.equal(a.interval,0);assert.equal(a.ease,1.3);assert.equal(C.due(a,600999),false);assert.equal(C.due(a,601000),true);
 const birds=[{id:'robin'}];assert.equal(C.queue(birds,{robin:a},b=>b.id,'new',0).length,0);assert.equal(C.queue(birds,{robin:a},b=>b.id,'due',601000).length,1);});
test('level 10 needs a half-year interval; the interval is capped at a year',()=>{let s=C.initial(),t=0;for(let i=0;i<12;i++){s=C.schedule(s,'easy',t);t=s.due;}
 assert.equal(s.interval,365);assert.equal(s.level,10);const g=C.schedule({...C.initial(),reps:1,interval:100,ease:2.5},'good',0);assert.equal(g.interval,250);assert.equal(g.level,10);
 assert.equal(C.schedule({...C.initial(),reps:1,interval:60,ease:2.5},'good',0).level,9);assert.equal(C.schedule({...C.initial(),reps:1,interval:30,ease:2.5},'good',0).level,8);});
test('known (typed Latin name) marks the card learned for at least half a year',()=>{const k=C.schedule(C.initial(),'known',5);assert.equal(k.level,10);assert.equal(k.interval,180);assert.equal(k.due,5+180*C.DAY);
 assert.equal(C.schedule({...C.initial(),reps:4,interval:300,ease:2.5},'known',0).interval,300);assert.throws(()=>C.schedule(C.initial(),'perfect',0));});
test('interval labels read like Anki buttons',()=>{assert.equal(C.ivlLabel(10*60000),'10 мин');assert.equal(C.ivlLabel(0.5*C.DAY),'12 ч');assert.equal(C.ivlLabel(C.DAY),'1 дн.');assert.equal(C.ivlLabel(4*C.DAY),'4 дн.');assert.equal(C.ivlLabel(90*C.DAY),'3 мес.');assert.equal(C.ivlLabel(365*C.DAY),'1 г.');});
test('queue only selects available due/new items with a limit',()=>{const birds=['a','b','c'].map(id=>({id})),states={a:{...C.initial(),reps:1,due:1},b:{...C.initial(),reps:1,due:300}};assert.deepEqual(C.queue(birds,states,b=>b.id,'due',2).map(b=>b.id),['a']);assert.deepEqual(C.queue(birds,states,b=>b.id,'new',2).map(b=>b.id),['c']);});
test('Latin answers ignore case, diacritics, punctuation and spacing',()=>{assert.equal(C.normalizeAnswer('  Łabędź niemy! '),'labedz niemy');assert.equal(C.normalizeAnswer('Чёрный дрозд'),'черныи дрозд');assert.equal(C.normalizeAnswer('Sitta europaea'),C.normalizeAnswer(' sitta   EUROPAEA.'));});
test('import normalization rejects invalid numeric values and clamps ranges',()=>{const s=C.clean({level:100,interval:-1,ease:0,due:NaN,reps:-5,lapses:Infinity,updatedAt:-1});assert.equal(s.level,10);assert.equal(s.interval,0);assert.equal(s.ease,1.3);assert.equal(s.due,0);assert.equal(s.reps,0);});
