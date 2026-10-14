import json,pathlib,urllib.request,urllib.parse,re,html,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
birds=json.loads((ROOT/'media-manifest.json').read_text())
headers={'User-Agent':'EuropeanBirdsLearning/1.0 (educational; open-license attribution)'}
def get(host,p):
 u='https://'+host+'/w/api.php?'+urllib.parse.urlencode(p)
 with urllib.request.urlopen(urllib.request.Request(u,headers=headers),timeout=40) as r:return json.load(r)
def clean(s):return html.unescape(re.sub('<[^>]*>','',s or '')).strip()
missing=[b for b in birds if not b['photos']]
try:
 d=get('en.wikipedia.org',dict(action='query',titles='|'.join(b['wikipedia'] for b in missing),prop='pageimages',piprop='name',format='json',redirects=1))
 redirects={x['from']:x['to'] for x in d.get('query',{}).get('redirects',[])}
 pages={x['title']:x for x in d.get('query',{}).get('pages',{}).values()}
 files={}
 for b in missing:
  title=redirects.get(b['wikipedia'],b['wikipedia']);p=pages.get(title,{})
  if p.get('pageimage'):files[b['id']]='File:'+p['pageimage']
 time.sleep(2)
 d=get('commons.wikimedia.org',dict(action='query',titles='|'.join(files.values()),prop='imageinfo',iiprop='url|extmetadata|mime',iiurlwidth=960,format='json'))
 media={x['title']:x for x in d.get('query',{}).get('pages',{}).values()}
 normalized={x['from']:x['to'] for x in d.get('query',{}).get('normalized',[])}
 for b in missing:
  file=files.get(b['id'],'');p=media.get(normalized.get(file,file),{})
  if not p.get('imageinfo'):print('NO PHOTO',b['id']);continue
  i=p['imageinfo'][0];m=i.get('extmetadata',{});val=lambda k:clean(m.get(k,{}).get('value',''));lic=val('LicenseShortName')
  if not (lic.startswith('CC BY') or lic in ['CC0','Public domain','PD']):print('UNSUPPORTED LICENSE',b['id'],lic);continue
  ext='.jpg' if i['mime']=='image/jpeg' else '.png' if i['mime']=='image/png' else '.webp'
  src='assets/photos/'+b['id']+ext
  try:
   with urllib.request.urlopen(urllib.request.Request(i.get('thumburl',i['url']),headers=headers),timeout=30) as r:body=r.read()
   (ROOT/src).write_bytes(body)
   b['photos']=[dict(src=src,url=i.get('thumburl',i['url']),original=i['url'],source=i['descriptionurl'],author=val('Artist'),license=lic,licenseUrl=val('LicenseUrl'),description=val('ImageDescription'),mime=i['mime'],file=p['title'])]
   print('PHOTO',b['id'],len(body),flush=True)
  except Exception as e:print('DOWNLOAD FAILED',b['id'],str(e),flush=True)
  time.sleep(.5)
except Exception as e:print('BATCH FAILED',str(e),flush=True)
(ROOT/'media-manifest.json').write_text(json.dumps(birds,ensure_ascii=False,indent=2))
print('TOTAL',len(birds),'PHOTOS',sum(bool(b['photos']) for b in birds),'AUDIO',sum(bool(b['audio']) for b in birds))
