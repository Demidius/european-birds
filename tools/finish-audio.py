import json,pathlib,urllib.request,urllib.parse,re,html,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
birds=json.loads((ROOT/'media-manifest.json').read_text())
h={'User-Agent':'EuropeanBirdsLearning/1.0 (open-license educational flashcards)'}
def get(host,p):
 with urllib.request.urlopen(urllib.request.Request('https://'+host+'/w/api.php?'+urllib.parse.urlencode(p),headers=h),timeout=40) as r:return json.load(r)
def clean(s):return html.unescape(re.sub('<[^>]*>','',s or '')).strip()
missing=[b for b in birds if not b['audio']]
try:
 d=get('en.wikipedia.org',dict(action='query',titles='|'.join(b['wikipedia'] for b in missing),prop='images',imlimit=500,format='json',redirects=1))
 redirects={x['from']:x['to'] for x in d.get('query',{}).get('redirects',[])}
 candidates={}
 for b in missing:
  title=redirects.get(b['wikipedia'],b['wikipedia']);p=next((p for p in d.get('query',{}).get('pages',{}).values() if p['title']==title),{})
  fs=[im['title'] for im in p.get('images',[]) if im['title'].lower().endswith(('.ogg','.oga','.mp3','.wav'))]
  # Exclude pronunciation audio and recordings that don't identify this taxon.
  fs=[f for f in fs if b['latin'].lower().replace(' ','_') in f.lower().replace(' ','_') or b['wikipedia'].lower().replace(' ','_') in f.lower().replace(' ','_')]
  if fs:candidates[b['id']]=fs[0]
 if candidates:
  time.sleep(2)
  d=get('commons.wikimedia.org',dict(action='query',titles='|'.join(candidates.values()),prop='imageinfo',iiprop='url|extmetadata|mime|size',format='json'))
  normalized={x['from']:x['to'] for x in d.get('query',{}).get('normalized',[])}
  pages={x['title']:x for x in d.get('query',{}).get('pages',{}).values()}
  for b in missing:
   f=candidates.get(b['id'],'');p=pages.get(normalized.get(f,f),{})
   if not p.get('imageinfo'):continue
   i=p['imageinfo'][0];meta=i.get('extmetadata',{});val=lambda k:clean(meta.get(k,{}).get('value',''));lic=val('LicenseShortName');desc=val('ImageDescription')
   if not (lic.startswith('CC BY') or lic in ['CC0','Public domain','PD']) or i.get('size',0)>8_000_000 or not i['mime'].startswith('audio'):continue
   ext='.'+f.rsplit('.',1)[1].lower();src='assets/audio/'+b['id']+ext
   try:
    with urllib.request.urlopen(urllib.request.Request(i['url'],headers=h),timeout=30) as r:body=r.read()
    (ROOT/src).write_bytes(body)
    b['audio']=[dict(src=src,url=i['url'],original=i['url'],source=i['descriptionurl'],author=val('Artist'),license=lic,licenseUrl=val('LicenseUrl'),description=desc,mime=i['mime'],file=p['title'],kind='song' if ('song' in desc.lower() or 'sing' in desc.lower() or 'песн' in desc.lower()) else 'voice')]
    print('AUDIO',b['id'],len(body),flush=True)
   except Exception as e:print('FAILED',b['id'],str(e),flush=True)
   time.sleep(.5)
except Exception as e:print('AUDIO BATCH FAILED',str(e),flush=True)
(ROOT/'media-manifest.json').write_text(json.dumps(birds,ensure_ascii=False,indent=2))
print('AUDIO TOTAL',sum(bool(b['audio']) for b in birds))
