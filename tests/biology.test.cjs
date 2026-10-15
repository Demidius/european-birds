const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function data(){const c={window:{}};for(const f of ['data-birds.js','data-passerines.js','data-regions.js','data-photos.js','study-data.js','data-biology.js','biology.js'])vm.runInNewContext(read(f),c);return c.window;}
test('Every current species has a nonempty habitat, source accounts and species-specific listening links',()=>{
const w=data(),birds=w.BIRD_DATA,bio=w.BIRD_BIOLOGY;assert.equal(birds.length,435);assert.equal(Object.keys(bio).length,435);
for(const b of birds){const d=b.biology;assert.ok(d,b.latin);assert.ok(/[А-Яа-яЁё]/.test(d.habitat),b.latin);assert.ok(d.habitat.length>35,b.latin);assert.doesNotMatch(d.habitat,/MISSING|TODO|undefined/);assert.ok(d.sources.length>0,b.latin);for(const s of d.sources)assert.match(s.url,/^https:\/\/(?:en|ru)\.wikipedia\.org\//);const query=new URL(d.listenUrl).searchParams.get('query');assert.ok(query.includes('gen:'+b.latin.split(' ')[0]));assert.ok(query.includes('sp:'+b.latin.split(' ')[1]));assert.ok(w.BirdBiology.render(b).includes('Типичный биотоп'));}
});
test('Embedded recordings preserve identity, attribution and a reusable licence; restrictive licences remain reference links',()=>{
const w=data();let count=0;
for(const [latin,d]of Object.entries(w.BIRD_BIOLOGY)){
for(const r of d.recordings){count++;assert.match(r.src,/^https:\/\//);assert.match(r.source,/^https:\/\//);assert.ok(r.author,latin);assert.ok(r.license,latin);assert.doesNotMatch(r.license,/NC|ND/);assert.ok(['song','call','voice','mechanical'].includes(r.kind));if(r.provider==='iNaturalist'){assert.equal(r.qualityGrade,'research');assert.ok(r.identificationName===latin||r.identificationName.startsWith(latin+' '));}if(r.provider==='xeno-canto')assert.equal(r.embedAllowed,true);}
if(d.reference){assert.match(d.reference.source,/^https:\/\/xeno-canto\.org\/\d+$/);assert.ok(d.reference.identificationName===latin||d.reference.identificationName.startsWith(latin+' '));}
}
assert.ok(count>100,'Expected a substantial collection of checked recordings');
});
test('Species detail and answer panels show biology, while audio tests use the checked shared recordings',()=>{
const dom=new JSDOM(read('study.html'),{url:'https://example.org/?offline=1',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.localStorage.setItem('europeanBirds:filters',JSON.stringify({typicalPoland:false,onlyPoland:false}));
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLMediaElement.prototype.pause=function(){};
try{
for(const f of ['scheduler.js','data-birds.js','data-passerines.js','data-regions.js','data-photos.js','study-data.js','data-biology.js','biology.js','app.js','study-tree.js'])w.eval(read(f));
w.BirdAtlas.detail('great-tit');assert.match(d.getElementById('infoBody').textContent,/Типичный биотоп/);assert.match(d.getElementById('infoBody').textContent,/Пение и голос/);assert.ok(d.querySelector('.bird-biology audio[preload="none"]'));assert.ok(d.querySelector('.biology-sources a[href^="https:"]'));d.getElementById('closeInfo').click();
d.querySelector('[data-mode="audio"]').click();assert.equal(Number(d.getElementById('newCount').textContent),w.BIRD_DATA.filter(b=>b.audio.length).length);
}finally{w.close()}
});
