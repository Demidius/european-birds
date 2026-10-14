const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../scheduler.js'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data-birds.js'),'utf8'),context);
const birds=context.window.BIRD_DATA;
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('Every bird gets six distinct answers with exactly one correct option in each language',()=>{
 for(const field of ['ru','en','latin','pl'])for(const bird of birds){
  const options=C.answerChoices(bird,birds,field,6,random(72));
  assert.equal(options.length,6);assert.equal(options.filter(x=>x.id===bird.id).length,1);
  assert.equal(new Set(options.map(x=>x.id)).size,6);
  assert.equal(new Set(options.map(x=>C.normalizeAnswer(x[field]))).size,6);
 }
});
test('Repeated questions vary distractors and can place the right answer in all six positions',()=>{
 const rand=random(817),positions=new Set(),sets=new Set(),order=birds.map(b=>b.id).join(',');
 for(let i=0;i<120;i++){const options=C.answerChoices(birds[0],birds,'ru',6,rand);positions.add(options.findIndex(b=>b.id===birds[0].id));sets.add(options.filter(b=>b.id!==birds[0].id).map(b=>b.id).sort().join(','));}
 assert.equal(positions.size,6);assert.ok(sets.size>100);assert.equal(birds.map(b=>b.id).join(','),order);
});
test('Duplicate labels and repeated species cannot create ambiguous choices',()=>{
 const pool=Array.from({length:9},(_,i)=>({id:String(i),en:'Bird '+i})),correct=pool[0];
 pool.push({id:'duplicate-label',en:'BIRD 0!'},correct,{id:'blank',en:''});
 const options=C.answerChoices(correct,pool,'en',6,random(12));
 assert.equal(options.length,6);assert.equal(options.filter(b=>C.normalizeAnswer(b.en)==='bird 0').length,1);
 assert.ok(!options.some(b=>!b.en));
});
