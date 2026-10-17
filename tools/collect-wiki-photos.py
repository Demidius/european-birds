"""Photos from Wikipedia for species that have none yet.

Usage (repository root): python3 tools/collect-wiki-photos.py sources/missing-photos-20261018.json

For every species in the list that has no entry in data-photos.js:
  1. find its Wikidata item: the Wikipedia article reached by the scientific name (en, pl, ru, de;
     redirects from synonyms count), else Wikidata items whose taxon name (P225) is the scientific name;
  2. take the lead photo of its Wikipedia articles (en, pl, ru, de, in that order) and the
     Wikidata image (P18);
  3. keep the first one that is a JPEG on Wikimedia Commons under CC0, public domain, CC BY or
     CC BY-SA, at least 600 px wide; range maps, eggs, skulls and drawings are tried last;
  4. save it as assets/bird-photos/<id>.jpg (at most 1280 px) and add author, licence and source
     to data-photos.js. The card shows them like every other photo.
Species without a usable photo are listed in sources/wiki-photos-report.json with the reason.
Runs in the GitHub Action .github/workflows/wiki-photos.yml (the sandbox has no Wikipedia access).
"""
import json, re, sys, time, html, urllib.parse, urllib.request
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
UA = {'User-Agent': 'EuropeanBirdsLearning/0.5 (https://github.com/Demidius/european-birds; educational bird flashcards; attribution kept)'}
WIKIS = ['en', 'pl', 'ru', 'de']
FREE = re.compile(r'^(cc0|cc[- ]by(-sa)?([- ][\d.]+)?([- ].*)?|public domain|pd([- ].*)?)$', re.I)
LAST = re.compile(r'(map|range|distribution|verbreitung|area|ar[eé]al|egg|eier|\bei\b|skull|skelet|specimen|museum|stamp|illustration|drawing|plate|painting|gould|naumann|audubon|lilford|\bsvg\b)', re.I)
TODAY = time.strftime('%Y-%m-%d')
_last = [0.0]


def get(url, params=None, raw=False, tries=4):
    if params:
        url += '?' + urllib.parse.urlencode(params)
    for attempt in range(tries):
        wait = 0.35 - (time.monotonic() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.monotonic()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                data = r.read()
            return data if raw else json.loads(data)
        except Exception as e:  # 429 / timeouts: back off and retry
            if attempt == tries - 1:
                raise
            time.sleep(3 * (attempt + 1))


def api(wiki, **params):
    host = 'www.wikidata.org' if wiki == 'wikidata' else 'commons.wikimedia.org' if wiki == 'commons' else wiki + '.wikipedia.org'
    return get('https://' + host + '/w/api.php', {'format': 'json', 'formatversion': '2', **params})


def claims(item, prop):
    return [c['mainsnak'].get('datavalue', {}).get('value') for c in item.get('claims', {}).get(prop, []) if c['mainsnak'].get('datavalue')]


def entity(qid):
    e = api('wikidata', action='wbgetentities', ids=qid, props='claims|sitelinks').get('entities', {}).get(qid)
    return e if e and 'missing' not in e else None


def find_item(latin):
    """Wikidata item of the species and how it was found."""
    for wiki in WIKIS:
        q = api(wiki, action='query', titles=latin, redirects=1, prop='pageprops', ppprop='wikibase_item')
        for p in q.get('query', {}).get('pages', []):
            qid = p.get('pageprops', {}).get('wikibase_item')
            if not qid:
                continue
            e = entity(qid)
            if not e:
                continue
            names = claims(e, 'P225')
            if latin in names:
                return e, wiki + 'wiki: ' + p['title']
            # A synonym redirecting to a species article is the same bird under its current name.
            if any(isinstance(r, dict) and r.get('id') == 'Q7432' for r in claims(e, 'P105')):
                return e, wiki + 'wiki: ' + p['title'] + ' (redirect from ' + latin + ', taxon ' + ', '.join(names) + ')'
    s = api('wikidata', action='query', list='search', srsearch='haswbstatement:"P225=' + latin + '"', srlimit=5)
    for hit in s.get('query', {}).get('search', []):
        e = entity(hit['title'])
        if e and latin in claims(e, 'P225'):
            return e, 'wikidata P225'
    return None, None


def page_image(wiki, title):
    q = api(wiki, action='query', titles=title, prop='pageimages', piprop='name')
    for p in q.get('query', {}).get('pages', []):
        if p.get('pageimage'):
            return p['pageimage']
    return None


def commons_info(name):
    q = api('commons', action='query', titles='File:' + name, prop='imageinfo', iiprop='url|size|mime|extmetadata', iiurlwidth=1280)
    pages = q.get('query', {}).get('pages', [])
    if not pages or pages[0].get('missing') or not pages[0].get('imageinfo'):
        return None
    return pages[0]['imageinfo'][0]


def text(meta, key):
    v = (meta.get(key) or {}).get('value', '')
    v = re.sub(r'<[^>]+>', '', str(v))
    return re.sub(r'\s+', ' ', html.unescape(v)).strip()


def candidates(item):
    links = item.get('sitelinks', {})
    seen, out = set(), []
    def add(name, via):
        if name:
            name = name.replace('_', ' ')
            if name not in seen:
                seen.add(name); out.append((name, via))
    for wiki in WIKIS:
        if wiki + 'wiki' in links:
            add(page_image(wiki, links[wiki + 'wiki']['title']), wiki + '.wikipedia.org: ' + links[wiki + 'wiki']['title'])
        if wiki == 'en':
            for f in claims(item, 'P18'):
                add(f, 'Wikidata ' + item['id'] + ' (P18)')
    return sorted(out, key=lambda c: bool(LAST.search(c[0])))  # stable: wiki order kept, maps and drawings last


def choose(item):
    tried = []
    for name, via in candidates(item):
        info = commons_info(name)
        if not info:
            tried.append(name + ': not on Commons'); continue
        meta = info.get('extmetadata', {})
        lic = text(meta, 'LicenseShortName')
        if info.get('mime') != 'image/jpeg':
            tried.append(name + ': ' + str(info.get('mime'))); continue
        if not FREE.match(lic) or text(meta, 'NonFree').lower() == 'true':
            tried.append(name + ': licence ' + lic); continue
        if min(info.get('width', 0), info.get('height', 0)) < 400 or max(info.get('width', 0), info.get('height', 0)) < 600:
            tried.append(name + ': too small'); continue
        return name, via, info, meta, lic, tried
    return None, None, None, None, None, tried


def main():
    species = json.loads(Path(sys.argv[1]).read_text(encoding='utf8'))['species']
    photos_js = ROOT / 'data-photos.js'
    head, body = photos_js.read_text(encoding='utf8').split('window.BIRD_PHOTOS = ', 1)
    manifest = json.loads(body.rstrip().removesuffix(';'))
    report = {'checkedAt': TODAY, 'added': [], 'missing': []}
    for i, b in enumerate(species, 1):
        if b['id'] in manifest:
            continue
        try:
            item, found = find_item(b['latin'])
            if not item:
                report['missing'].append({'id': b['id'], 'latin': b['latin'], 'reason': 'no Wikipedia/Wikidata entry found'}); continue
            name, via, info, meta, lic, tried = choose(item)
            if not name:
                report['missing'].append({'id': b['id'], 'latin': b['latin'], 'wikidata': item['id'], 'reason': 'no free JPEG photo', 'tried': tried}); continue
            raw = get(info.get('thumburl') or info['url'], raw=True)
            with Image.open(BytesIO(raw)) as im:
                im = ImageOps.exif_transpose(im).convert('RGB')
                im.thumbnail((1280, 1280), Image.LANCZOS)
                dest = ROOT / 'assets' / 'bird-photos' / (b['id'] + '.jpg')
                im.save(dest, 'JPEG', quality=85, optimize=True, progressive=True)
                w, h = im.size
            author = text(meta, 'Artist') or text(meta, 'Credit') or 'Автор указан на странице файла'
            lic_url = text(meta, 'LicenseUrl') or info['descriptionurl']
            manifest[b['id']] = {
                'url': info.get('thumburl') or info['url'], 'source': info['descriptionurl'], 'photoPage': info['descriptionurl'],
                'author': author[:200], 'license': lic, 'licenseCode': lic.lower().replace(' ', '-'), 'licenseUrl': lic_url,
                'provider': 'Wikimedia Commons', 'via': via, 'file': name, 'wikidata': item['id'], 'taxonMatch': found,
                'taxonName': b['latin'], 'dimensions': {'width': info.get('width'), 'height': info.get('height')},
                'checkedAt': TODAY, 'src': 'assets/bird-photos/' + b['id'] + '.jpg'}
            report['added'].append({'id': b['id'], 'latin': b['latin'], 'file': name, 'via': via, 'taxonMatch': found, 'size': [w, h]})
        except Exception as e:
            report['missing'].append({'id': b['id'], 'latin': b['latin'], 'reason': 'error: ' + str(e)[:200]})
        if i % 20 == 0:
            print('species', i, '/', len(species), 'added', len(report['added']), 'missing', len(report['missing']), flush=True)
    photos_js.write_text(head + 'window.BIRD_PHOTOS = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n', encoding='utf8')
    (ROOT / 'sources' / 'wiki-photos-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    print('FINISHED added', len(report['added']), 'missing', len(report['missing']), flush=True)


if __name__ == '__main__':
    main()
