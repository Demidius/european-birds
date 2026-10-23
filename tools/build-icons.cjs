// Rasterize the existing SVG for Android/WebAPK installation.
// BIRD_CHROMIUM may point to a system Chrome executable.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BIRD_CHROMIUM||undefined});
 try{
  const page=await browser.newPage({deviceScaleFactor:1});
  const svg=fs.readFileSync(path.join(root,'icon.svg'),'utf8');
  for(const size of [192,512]){
   await page.setViewportSize({width:size,height:size});
   await page.setContent('<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>'+svg);
   await page.screenshot({path:path.join(root,'icon-'+size+'.png')});
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
