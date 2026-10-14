import urllib.request,urllib.parse,json,re,html,time,concurrent.futures,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
UA={'User-Agent':'EuropeanBirdsLearning/1.0 (open-license educational flashcards; Wikimedia attribution preserved)'}
def api(host,params):
 url='https://'+host+'/w/api.php?'+urllib.parse.urlencode(params)
 for n in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=25) as r:return json.load(r)
  except Exception:
   if n==2:raise
   time.sleep(1)
def clean(s):return html.unescape(re.sub('<[^>]*>','',s or '')).strip()
def media(file):
 d=api('commons.wikimedia.org',dict(action='query',titles=file,prop='imageinfo',iiprop='url|extmetadata|size|mime',iiurlwidth=960,format='json'))
 p=next(iter(d['query']['pages'].values()))
 if not p.get('imageinfo'):return None
 i=p['imageinfo'][0];m=i.get('extmetadata',{});get=lambda k:clean(m.get(k,{}).get('value',''))
 license=get('LicenseShortName')
 if not (license.startswith('CC BY') or license in ['CC0','Public domain','PD']):return None
 return dict(url=i['url'] if i['mime'].startswith('audio') else i.get('thumburl',i['url']),original=i['url'],source=i['descriptionurl'],author=get('Artist'),license=license,licenseUrl=get('LicenseUrl'),description=get('ImageDescription'),mime=i['mime'],file=p['title'])
def download(m,path):
 if not path.exists():
  with urllib.request.urlopen(urllib.request.Request(m['url'],headers=UA),timeout=40) as r:path.write_bytes(r.read())
 m['src']=str(path.relative_to(ROOT));return m
rows='''great-tit|Большая синица|Great Tit|Parus major|Bogatka|garden|Great tit
blue-tit|Обыкновенная лазоревка|Eurasian Blue Tit|Cyanistes caeruleus|Modraszka|garden|Eurasian blue tit
coal-tit|Московка|Coal Tit|Periparus ater|Sosnówka|forest|Coal tit
marsh-tit|Черноголовая гаичка|Marsh Tit|Poecile palustris|Sikora uboga|forest|Marsh tit
willow-tit|Буроголовая гаичка|Willow Tit|Poecile montanus|Czarnogłówka|forest|Willow tit
long-tailed-tit|Длиннохвостая синица|Long-tailed Tit|Aegithalos caudatus|Raniuszek|forest|Long-tailed tit
nuthatch|Обыкновенный поползень|Eurasian Nuthatch|Sitta europaea|Kowalik|forest|Eurasian nuthatch
treecreeper|Обыкновенная пищуха|Eurasian Treecreeper|Certhia familiaris|Pełzacz leśny|forest|Eurasian treecreeper
wren|Крапивник|Eurasian Wren|Troglodytes troglodytes|Strzyżyk|garden|Eurasian wren
robin|Зарянка|European Robin|Erithacus rubecula|Rudzik|garden|European robin
chaffinch|Зяблик|Common Chaffinch|Fringilla coelebs|Zięba|garden|Common chaffinch
greenfinch|Обыкновенная зеленушка|European Greenfinch|Chloris chloris|Dzwoniec|garden|European greenfinch
goldfinch|Черноголовый щегол|European Goldfinch|Carduelis carduelis|Szczygieł|garden|European goldfinch
house-sparrow|Домовый воробей|House Sparrow|Passer domesticus|Wróbel|urban|House sparrow
tree-sparrow|Полевой воробей|Eurasian Tree Sparrow|Passer montanus|Mazurek|urban|Eurasian tree sparrow
blackbird|Чёрный дрозд|Common Blackbird|Turdus merula|Kos|garden|Common blackbird
song-thrush|Певчий дрозд|Song Thrush|Turdus philomelos|Drozd śpiewak|forest|Song thrush
chiffchaff|Пеночка-теньковка|Common Chiffchaff|Phylloscopus collybita|Pierwiosnek|forest|Common chiffchaff
willow-warbler|Пеночка-весничка|Willow Warbler|Phylloscopus trochilus|Piecuszek|forest|Willow warbler
starling|Обыкновенный скворец|Common Starling|Sturnus vulgaris|Szpak|urban|Common starling
magpie|Сорока|Eurasian Magpie|Pica pica|Sroka|corvid|Eurasian magpie
hooded-crow|Серая ворона|Hooded Crow|Corvus cornix|Wrona siwa|corvid|Hooded crow
rook|Грач|Rook|Corvus frugilegus|Gawron|corvid|Rook (bird)
jackdaw|Галка|Western Jackdaw|Coloeus monedula|Kawka|corvid|Western jackdaw
raven|Ворон|Common Raven|Corvus corax|Kruk|corvid|Common raven
jay|Сойка|Eurasian Jay|Garrulus glandarius|Sójka|corvid|Eurasian jay
woodpigeon|Вяхирь|Common Wood Pigeon|Columba palumbus|Grzywacz|urban|Common wood pigeon
rock-dove|Сизый голубь|Rock Dove|Columba livia|Gołąb skalny|urban|Rock dove
collared-dove|Кольчатая горлица|Eurasian Collared Dove|Streptopelia decaocto|Sierpówka|urban|Eurasian collared dove
great-spotted-woodpecker|Большой пёстрый дятел|Great Spotted Woodpecker|Dendrocopos major|Dzięcioł duży|forest|Great spotted woodpecker
green-woodpecker|Зелёный дятел|European Green Woodpecker|Picus viridis|Dzięcioł zielony|forest|European green woodpecker
mallard|Кряква|Mallard|Anas platyrhynchos|Krzyżówka|water|Mallard
coot|Лысуха|Eurasian Coot|Fulica atra|Łyska|water|Eurasian coot
mute-swan|Лебедь-шипун|Mute Swan|Cygnus olor|Łabędź niemy|water|Mute swan
grey-heron|Серая цапля|Grey Heron|Ardea cinerea|Czapla siwa|water|Grey heron
lapwing|Чибис|Northern Lapwing|Vanellus vanellus|Czajka|wetland|Northern lapwing
buzzard|Обыкновенный канюк|Common Buzzard|Buteo buteo|Myszołów|raptor|Common buzzard
kestrel|Обыкновенная пустельга|Common Kestrel|Falco tinnunculus|Pustułka|raptor|Common kestrel'''
birds=[]
for row in rows.splitlines():
 id,ru,en,lat,pl,group,page=row.split('|');birds.append(dict(id=id,ru=ru,en=en,latin=lat,pl=pl,group=group,wikipedia=page,photos=[],audio=[]))
def collect(b):
 try:
  d=api('en.wikipedia.org',dict(action='query',titles=b['wikipedia'],prop='pageimages',piprop='name',format='json',redirects=1))
  p=next(iter(d['query']['pages'].values()))
  m=media('File:'+p['pageimage'])
  if m:
   ext='.jpg' if m['mime']=='image/jpeg' else '.png' if m['mime']=='image/png' else '.webp'
   b['photos']=[download(m,ROOT/'assets/photos'/f"{b['id']}{ext}")]
  # Audio is from a species-specific Commons category; never fabricate an asset.
  d=api('commons.wikimedia.org',dict(action='query',list='categorymembers',cmtitle='Category:Audio files of '+b['latin'],cmnamespace=6,cmlimit=50,format='json'))
  files=[x['title'] for x in d.get('query',{}).get('categorymembers',[]) if x['title'].lower().endswith(('.ogg','.oga','.mp3','.wav'))]
  files.sort(key=lambda f:(('song' not in f.lower()),len(f)))
  for f in files[:6]:
   m=media(f)
   if not m:continue
   # Downloads limited to small recordings.
   ext='.'+f.rsplit('.',1)[1].lower()
   path=ROOT/'assets/audio'/f"{b['id']}{ext}"
   try:
    download(m,path)
    if path.stat().st_size>8_000_000:path.unlink();continue
    m['kind']='song' if 'song' in m['description'].lower() or 'песн' in m['description'].lower() or 'sing' in m['description'].lower() else 'voice'
    b['audio']=[m];break
   except Exception:continue
  print(b['id'],len(b['photos']),len(b['audio']),flush=True)
 except Exception as e:print('ERROR',b['id'],str(e),flush=True)
 return b
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:birds=list(ex.map(collect,birds))
(ROOT/'media-manifest.json').write_text(json.dumps(birds,ensure_ascii=False,indent=2))
print('TOTAL',len(birds),'PHOTOS',sum(bool(b['photos']) for b in birds),'AUDIO',sum(bool(b['audio']) for b in birds),flush=True)
