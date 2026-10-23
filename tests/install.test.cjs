const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Install manifest provides real PNG icons and preserves the published app identity',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
 const base='https://demidius.github.io/european-birds/';
 assert.equal(new URL(manifest.start_url,base).href,base);
 assert.equal(new URL(manifest.scope,base).href,base);
 assert.equal(new URL(manifest.id||manifest.start_url,base).href,base);
 assert.equal(manifest.display,'standalone');
 for(const size of [192,512]){
  const icon=manifest.icons.find(i=>i.type==='image/png'&&i.sizes===`${size}x${size}`);
  assert.ok(icon,`install icon ${size}`);
  const data=fs.readFileSync(path.join(root,icon.src));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);
 }
 for(const file of ['index.html','study.html']){
  assert.match(fs.readFileSync(path.join(root,file),'utf8'),/rel="manifest" href="manifest.webmanifest\?v=20261023-1"/);
 }
});
