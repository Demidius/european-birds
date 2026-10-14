const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../scheduler.js'),read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
// A small DOM fixture exercises the real application handlers without a browser process.
function fixture(){
 const nodes=new Map(),storage=new Map(),modeButtons=[];let last;
 class Element{
  constructor(id='',dataset={}){this.id=id;this.dataset=dataset;this.value='';this.hidden=false;this.disabled=false;this.events={};this.children=[];this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  fire(name,event={}){for(const fn of this.events[name]||[])fn({target:this,preventDefault(){},...event});}
  click(){if(!this.disabled)this.fire('click');}
  closest(selector){return selector==='[data-answer]'&&this.dataset.answer?this:null;}
  setAttribute(){} focus(){} pause(){} showModal(){this.open=true;}close(){this.open=false;}
  set innerHTML(html){this.html=html;this.children=[];for(const match of html.matchAll(/<button[^>]*data-answer="([^"]+)"[^>]*>([^<]*)<\/button>/g)){const b=new Element('',{answer:match[1]});b.textContent=match[2];b.addEventListener('click',e=>this.fire('click',e));this.children.push(b);}this.media=/<(?:img|audio)\b/.test(html)?new Element():null;}
  get innerHTML(){return this.html||'';}
  querySelectorAll(selector){return selector==='button'?this.children:[];}
  querySelector(selector){return selector==='button'?this.children[0]:this.media;}
 }
 for(const match of read('study.html').matchAll(/id="([^"]+)"/g))nodes.set(match[1],new Element(match[1]));
 const $=id=>nodes.get(id);$('statusFilter').value='all';$('language').value='latin';
 for(const mode of ['photo','audio','names'])modeButtons.push(new Element('',{mode}));
 const document=new Element();document.getElementById=$;document.querySelectorAll=s=>s==='[data-mode]'?modeButtons:[];document.activeElement=$('learnBtn');
 const window=new Element(),ctx={window,document,BirdStudy:{...C,answerChoices:(...args)=>{const options=C.answerChoices(...args);last={correct:args[0],options};return options;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{search:'?offline=1'},URLSearchParams,CustomEvent:class{},console};
 window.dispatchEvent=()=>{};vm.createContext(ctx);vm.runInContext(read('data-birds.js'),ctx);vm.runInContext(read('app.js'),ctx);
 return {$,modeButtons,last:()=>last,progress:()=>JSON.parse(storage.get('europeanBirds:v1:progress:guest')||'{}')};
}
test('Photo, audio and three name modes score once, preserve progress on skip, and finish',()=>{
 for(const [mode,language] of [['photo','ru'],['audio','ru'],['names','latin'],['names','en'],['names','pl']]){
  const f=fixture(),$=f.$;f.modeButtons.find(b=>b.dataset.mode===mode).click();if(mode==='names'){$('language').value=language;$('language').fire('change');}$('learnBtn').click();
  const q=f.last(),key=q.correct.id+'__'+(mode==='names'?'names-'+language:mode),buttons=$('answerChoices').children;
  assert.equal(buttons.length,6);assert.ok(buttons.every(b=>b.textContent===q.options.find(x=>x.id===b.dataset.answer)[mode==='names'?language:'ru']));
  const correct=buttons.find(b=>b.dataset.answer===q.correct.id);correct.click();
  assert.equal(f.progress()[key].level,1);assert.equal(f.progress()[key].reps,1);assert.ok(buttons.every(b=>b.disabled));assert.ok(correct.classes.has('correct'));
  correct.fire('click');assert.equal(f.progress()[key].reps,1,'Duplicate event does not save twice');
  $('nextCard').click();const wrong=f.last(),wrongKey=wrong.correct.id+'__'+(mode==='names'?'names-'+language:mode);
  $('answerChoices').children.find(b=>b.dataset.answer!==wrong.correct.id).click();assert.equal(f.progress()[wrongKey].lapses,1);assert.equal(f.progress()[wrongKey].level,0);
  $('nextCard').click();if(mode!=='names'){const before=JSON.stringify(f.progress());$('cardMedia').media.fire('error');assert.ok($('answerChoices').children.every(b=>b.disabled));assert.equal($('nextCard').textContent,'Пропустить');$('nextCard').click();assert.equal(JSON.stringify(f.progress()),before);}
  let limit=0;while($('sessionDone').hidden&&limit++<50){if(!$('nextCard').hidden)$('nextCard').click();else $('answerChoices').children.find(b=>b.dataset.answer===f.last().correct.id).click();}
  assert.equal($('sessionDone').hidden,false);assert.ok($('answerChoices').hidden);assert.ok($('nextCard').hidden);
 }
});
