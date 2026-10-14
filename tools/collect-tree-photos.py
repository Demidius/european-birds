"""Collect locally hosted photo assets, with source/licence/provenance per species.
Usage: python3 tools/collect-tree-photos.py SPECIES_JSON REUSE_JSON CACHE_DIR REPO_ROOT
Requires Pillow. Collects up to 75 missing species per run; repeat to complete.
Public iNaturalist requests are serialized at <=55/min; images use the photo CDN.
"""
import concurrent.futures,json,time,threading,urllib.request,urllib.parse,re,sys
from pathlib import Path
from PIL import Image
species=json.loads(Path(sys.argv[1]).read_text());reuse=json.loads(Path(sys.argv[2]).read_text());cache=Path(sys.argv[3]);root=Path(sys.argv[4]);cache.mkdir(parents=True,exist_ok=True);(root/'assets/bird-photos').mkdir(parents=True,exist_ok=True)
UA={'User-Agent':'EuropeanBirdsLearning/0.4 (educational open-license photo cards; source and attribution preserved)'}
lock=threading.Lock();next_api=0.;done=0;manifest=json.loads((cache/'manifest.json').read_text()) if (cache/'manifest.json').exists() else {};errors=[]
if not manifest and (root/'data-photos.js').exists():
 manifest=json.loads((root/'data-photos.js').read_text().split('window.BIRD_PHOTOS = ',1)[1].rstrip().removesuffix(';'))
def api(params,endpoint="observations"):
 global next_api
 with lock:
  wait=max(0,next_api-time.monotonic());next_api=max(next_api,time.monotonic())+1.1
 if wait:time.sleep(wait)
 url='https://api.inaturalist.org/v1/'+endpoint+'?'+urllib.parse.urlencode(params)
 with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=30) as r:return json.load(r)
def candidates(b,exact_id=None):
 p=cache/(b['id']+'.json')
 if exact_id is None and p.exists() and json.loads(p.read_text()):return json.loads(p.read_text())
 params=dict(quality_grade='research',photos='true',photo_license='cc0,cc-by,cc-by-sa',per_page=12,order_by='votes')
 params.update({'taxon_id':exact_id} if exact_id else {'taxon_name':b['latin']})
 data=api(params)
 out=[]
 for r in data.get('results',[]):
  t=r.get('taxon') or {}
  if not (t.get('name')==b['latin'] or (t.get('rank')=='subspecies' and t.get('name','').startswith(b['latin']+' '))) or r.get('quality_grade')!='research' or r.get('community_taxon_id')!=t.get('id'):continue
  if r.get('captive') or r.get('captive_flag'):continue
  for ph in r.get('photos',[]):
   code=ph.get('license_code');dims=ph.get('original_dimensions') or {}
   if code not in ['cc0','cc-by','cc-by-sa'] or ph.get('hidden') or ph.get('flags') or not ph.get('url'):continue
   if max(dims.get('width',0),dims.get('height',0))<600 or min(dims.get('width',0),dims.get('height',0))<300:continue
   if not (0.35<=dims.get('width',1)/max(1,dims.get('height',1))<=3):continue
   photo_url=re.sub(r'/square\.(\w+)(?:\?.*)?$',r'/large.\1',ph['url'])
   out.append({'url':photo_url,'source':'https://www.inaturalist.org/observations/'+str(r['id']),'photoPage':'https://www.inaturalist.org/photos/'+str(ph['id']),'author':(r.get('user',{}).get('name') or r.get('user',{}).get('login','')) if code=='cc0' else (ph.get('attribution') or r.get('user',{}).get('login','')),'license':{'cc0':'CC0','cc-by':'CC BY','cc-by-sa':'CC BY-SA'}[code],'licenseCode':code,'licenseUrl':'https://www.inaturalist.org/photos/'+str(ph['id']),'provider':'iNaturalist','photoId':ph['id'],'observationId':r['id'],'taxonId':t['id'],'taxonName':b['latin'],'identificationName':t['name'],'identificationRank':t['rank'],'qualityGrade':'research','communityTaxonId':r['community_taxon_id'],'dimensions':dims,'checkedAt':'2026-10-14'})
   break
  if len(out)>=3:break
 if not out and exact_id is None:
  taxa=api(dict(q=b['latin'],rank='species',per_page=30),'taxa').get('results',[])
  exact=next((t for t in taxa if t.get('name')==b['latin'] and t.get('rank')=='species'),None)
  if exact:return candidates(b,exact['id'])
 p.write_text(json.dumps(out,ensure_ascii=False,indent=2));return out

def one(b):
 global done
 try:
  if b['id'] in manifest and (root/manifest[b['id']]['src']).exists():
   m=manifest[b['id']];Image.open(root/m['src']).verify()
  elif b['id'] in reuse:
   m={**reuse[b['id']],'provider':'Wikimedia Commons','taxonName':b['latin'],'checkedAt':'2026-10-14'}
   Image.open(root/m['src']).verify()
  else:
   opts=candidates(b)
   if not opts:raise ValueError('No eligible species/subspecies Research Grade photo')
   m=None
   for opt in opts:
    suffix=Path(urllib.parse.urlparse(opt['url']).path).suffix.lower()
    if suffix not in ['.jpg','.jpeg','.png','.webp']:continue
    dest=root/'assets/bird-photos'/(b['id']+suffix)
    try:
     if not dest.exists():
      raw=urllib.request.urlopen(urllib.request.Request(opt['url'],headers=UA),timeout=40).read();dest.write_bytes(raw)
     with Image.open(dest) as im:
      im.verify()
     if dest.stat().st_size>4_000_000:dest.unlink();continue
     m={**opt,'src':str(dest.relative_to(root))};break
    except Exception:
     dest.unlink(missing_ok=True)
   if m is None:raise ValueError('Photo download failed')
  with lock:manifest[b['id']]=m
 except Exception as e:
  with lock:errors.append({'id':b['id'],'latin':b['latin'],'error':str(e)})
 finally:
  with lock:
   done+=1
   if done%20==0 or done==len(species):
    (cache/'progress.json').write_text(json.dumps({'done':done,'photos':len(manifest),'errors':errors},ensure_ascii=False));print('PHOTOS',done,len(manifest),'ERRORS',len(errors),flush=True)
   (cache/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(one,[b for b in species if b['id'] not in manifest][:75]))
(root/'data-photos.js').write_text('// Photos are genuine, licence-filtered assets. Attribution and provenance are retained.\nwindow.BIRD_PHOTOS = '+json.dumps(manifest,ensure_ascii=False,indent=2)+';\n')
(cache/'errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2));print('FINISHED',len(manifest),'/',len(species),flush=True)
