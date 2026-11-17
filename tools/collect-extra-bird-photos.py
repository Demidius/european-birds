"""Collect one distinct, freely licensed quiz photo per species.

Run from the repository root via the extra-bird-photos workflow, or run
collect SHARD TOTAL OUT, then merge OUT (merged per-shard output).
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, unquote, urlsplit
from urllib.request import Request, urlopen
import hashlib
import json
import re
import runpy
import subprocess
import sys
import threading
import time

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DEST = Path('assets/extra-bird-photos')
MANIFEST = ROOT / 'data-extra-photos.js'
PREFIX = 'window.BIRD_EXTRA_PHOTOS = '
WIKI = runpy.run_path(str(ROOT / 'tools/collect-wiki-photos.py'))
LICENSES = {'cc0': 'CC0', 'cc-by': 'CC BY', 'cc-by-sa': 'CC BY-SA'}
INA = 'https://api.inaturalist.org/v1/observations'
TODAY = date.today().isoformat()
BINOMIAL = re.compile(r'^[A-Z][a-z]+ [a-z][a-z-]+$')
NON_PHOTO = re.compile(r'\b(eggs?|nest|map|range|distribution|illustration|drawing|painting|stamp|museum|specimen|skull|skeleton|plate|sighting|collage|montage|sound|song|sonogram)\b', re.I)
# A replacement needs visual review before it is added.
MANUAL_REVIEW_SPECIES = {'Turdus_iliacus'}
LOCK = threading.Lock()
next_inat_request = 0.0


def birds():
    code = """
const fs=require('node:fs'), vm=require('node:vm');
const ctx=vm.createContext({window:{}});
for(const file of ['data-birds.js','data-passerines.js','data-regions.js','data-photos.js',
 'data-poland-additions.js','study-data.js']) vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
console.log(JSON.stringify(ctx.window.BIRD_DATA));
"""
    return json.loads(subprocess.check_output(['node', '-e', code], cwd=ROOT))


def read_manifest():
    return json.loads(MANIFEST.read_text(encoding='utf8').split(PREFIX, 1)[1].strip().removesuffix(';'))


def get(url, params=None, *, inat=False):
    global next_inat_request
    if params:
        url += '?' + urlencode(params)
    for attempt in range(3):
        if inat:
            with LOCK:
                slot = max(time.monotonic(), next_inat_request)
                next_inat_request = slot + 4.2
            time.sleep(max(0, slot - time.monotonic()))
        try:
            with urlopen(Request(url, headers=WIKI['UA']), timeout=25) as response:
                data = response.read(12_000_001)
            if len(data) > 12_000_000:
                raise ValueError('download above 12 MB')
            return data
        except HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            delay = exc.headers.get('Retry-After', '')
            time.sleep(min(int(delay), 60) if delay.isdigit() else (attempt + 1) * 3)
        except (TimeoutError, OSError):
            if attempt == 2:
                raise
            time.sleep((attempt + 1) * 2)


def identities(photo):
    keys = set()
    for attr in ('photoPage', 'source', 'original', 'url', 'file'):
        url = photo.get(attr, '')
        if not url:
            continue
        path = unquote(urlsplit(url).path)
        match = re.search(r'/photos/(\d+)(?:/|$)', path)
        if match:
            keys.add('inat:' + match[1])
        elif attr == 'file' or 'wikimedia.org' in url:
            if '/thumb/' in path:
                path = path.rsplit('/', 1)[0]
            keys.add('commons:' + path.rsplit('/', 1)[-1].removeprefix('File:').replace('_', ' ').casefold())
    if photo.get('photoId'):
        keys.add('inat:' + str(photo['photoId']))
    return keys


def fingerprint(image):
    image = ImageOps.exif_transpose(image).convert('L')
    pixels = list(image.resize((9, 8), Image.Resampling.LANCZOS).getdata())
    diff = 0
    for row in range(8):
        for col in range(8):
            i = row * 9 + col
            diff = (diff << 1) | (pixels[i] < pixels[i + 1])
    return diff


def inat_candidates(bird, accepted):
    ids = list(dict.fromkeys(p['taxonId'] for p in bird['photos']
                            if p.get('provider') == 'iNaturalist' and p.get('taxonId') and p.get('taxonName') == bird['latin']))
    queries = [{'taxon_name': name} for name in accepted]
    if ids:
        queries.insert(0, {'taxon_id': ','.join(map(str, ids))})
    seen = set()
    for query in queries:
        params = dict(query, quality_grade='research', photos='true', captive='false',
                      photo_license='cc0,cc-by,cc-by-sa', per_page=15, order_by='votes')
        for obs in json.loads(get(INA, params, inat=True)).get('results', []):
            taxon = obs.get('taxon') or {}
            name = taxon.get('name', '')
            identified = name in accepted or any(name.startswith(n + ' ') for n in accepted) and taxon.get('rank') == 'subspecies'
            if not identified or obs.get('quality_grade') != 'research' or obs.get('captive') or obs.get('captive_flag'):
                continue
            if not taxon.get('id') or obs.get('community_taxon_id') != taxon['id']:
                continue
            for photo in obs.get('photos', []):
                code, photo_id, url = photo.get('license_code'), photo.get('id'), photo.get('url', '')
                dims = photo.get('original_dimensions') or {}
                if code not in LICENSES or not photo_id or not url or photo.get('hidden') or photo.get('flags') or photo_id in seen:
                    continue
                if min(dims.get('width', 0), dims.get('height', 0)) < 300:
                    continue
                seen.add(photo_id)
                page = 'https://www.inaturalist.org/photos/' + str(photo_id)
                author = photo.get('attribution') or page
                yield {
                    'url': re.sub(r'/square(\.[^/?]+)(?:\?.*)?$', r'/large\1', url),
                    'source': 'https://www.inaturalist.org/observations/' + str(obs['id']),
                    'photoPage': page, 'photoId': photo_id, 'observationId': obs['id'],
                    'author': author, 'license': LICENSES[code], 'licenseCode': code, 'licenseUrl': page,
                    'provider': 'iNaturalist', 'identificationName': name, 'identificationRank': taxon.get('rank'),
                    'qualityGrade': 'research', 'taxonId': taxon['id'], 'communityTaxonId': obs['community_taxon_id'],
                }


def commons_candidates(bird, accepted):
    api = WIKI['api']
    get_text = WIKI['text']
    qid = next((p['wikidata'] for p in bird['photos'] if p.get('wikidata')), None)
    if qid:
        item = WIKI['entity'](qid)
    else:
        item, _ = WIKI['find_item'](bird['latin'])
    claims = WIKI['claims']
    categories = list(accepted)
    names = list(accepted)
    if item:
        names += claims(item, 'P225')
        categories += claims(item, 'P373')
        sitelink = item.get('sitelinks', {}).get('commonswiki', {}).get('title', '')
        if sitelink.startswith('Category:'):
            categories.append(sitelink.removeprefix('Category:'))
    params = dict(action='query', prop='imageinfo', iiprop='url|size|mime|sha1|extmetadata',
                  iiurlwidth=960, iiextmetadatafilter='Artist|Credit|LicenseShortName|LicenseUrl|NonFree|ImageDescription')
    queries = [dict(generator='categorymembers', gcmtitle='Category:' + name, gcmtype='file', gcmlimit=24)
               for name in dict.fromkeys(categories) if name]
    if item:
        queries += [dict(generator='search', gsrsearch='haswbstatement:P180=' + item['id'], gsrnamespace=6, gsrlimit=24)]
    queries.extend(dict(generator='search', gsrsearch='"' + name + '" filetype:bitmap',
                        gsrnamespace=6, gsrlimit=24, _match=name) for name in dict.fromkeys(names))
    seen = set()
    for query in queries:
        match = query.pop('_match', None)
        result = api('commons', **params, **query)
        pages = result.get('query', {}).get('pages', [])
        for page in pages:
            title = page.get('title', '').removeprefix('File:')
            images = page.get('imageinfo') or []
            if not images or not title or NON_PHOTO.search(re.sub('[_-]', ' ', title)) or title in seen:
                continue
            info = images[0]
            meta = info.get('extmetadata', {})
            license_name = get_text(meta, 'LicenseShortName')
            if info.get('mime') not in ('image/jpeg', 'image/png', 'image/webp') or not WIKI['FREE'].fullmatch(license_name):
                continue
            if get_text(meta, 'NonFree').lower() == 'true' or min(info.get('width', 0), info.get('height', 0)) < 300:
                continue
            if match and match.casefold() not in (title + ' ' + get_text(meta, 'ImageDescription')).replace('_', ' ').casefold():
                continue
            seen.add(title)
            source = info['descriptionurl']
            yield {
                'url': info.get('thumburl') or info['url'], 'original': info['url'],
                'source': source, 'photoPage': source, 'file': title, 'sourceSha1': info.get('sha1'),
                'author': get_text(meta, 'Artist') or get_text(meta, 'Credit') or 'Автор указан на странице файла',
                'license': license_name, 'licenseCode': license_name.lower().replace(' ', '-'),
                'licenseUrl': get_text(meta, 'LicenseUrl') or source, 'provider': 'Wikimedia Commons',
                'taxonMatch': match or query.get('gcmtitle') or query.get('gsrsearch'),
            }


def collect_one(bird, output):
    latin = bird['latin']
    paths = [ROOT / p['src'] for p in bird['photos']]
    keys = set().union(*(identities(p) for p in bird['photos']))
    hashes = set()
    pixels = []
    for path in paths:
        with Image.open(path) as reference:
            pixels.append(fingerprint(reference))
        hashes.add(hashlib.sha256(path.read_bytes()).hexdigest())
    options = [latin]
    for p in bird['photos']:
        for field in ('identificationName', 'taxonName'):
            name = p.get(field, '')
            if BINOMIAL.fullmatch(name) and name not in options:
                options.append(name)

    errors = []
    identity = bird['treeId']
    destination = DEST / (identity + '.jpg')
    for provider in (inat_candidates, commons_candidates):
        try:
            for candidate in provider(bird, options):
                if keys & identities(candidate):
                    continue
                try:
                    raw = get(candidate['url'])
                    if hashlib.sha256(raw).hexdigest() in hashes:
                        continue
                    with Image.open(BytesIO(raw)) as raw_image:
                        if min(raw_image.size) < 300 or max(raw_image.size) < 600:
                            continue
                        image = ImageOps.exif_transpose(raw_image).convert('RGB')
                    if any((fingerprint(image) ^ value).bit_count() <= 5 for value in pixels):
                        continue
                    # Keep the aspect ratio; record the derivative for the original's attribution.
                    image.thumbnail((960, 960), Image.Resampling.LANCZOS)
                    image.save(output / destination, 'JPEG', quality=85, optimize=True, progressive=True)
                    metadata = dict(candidate, src=destination.as_posix(), taxonName=latin, mime='image/jpeg',
                                    dimensions=dict(zip(('width', 'height'), image.size)), checkedAt=TODAY,
                                    modified='Размер уменьшен, файл перекодирован в JPEG.')
                    return identity, metadata, None
                except (OSError, ValueError) as exc:
                    errors.append(str(exc)[:180])
        except (OSError, ValueError, KeyError) as exc:
            errors.append(provider.__name__ + ': ' + str(exc)[:180])
    return identity, None, dict(id=identity, latin=latin, errors=errors[-4:])


def collect(shard, total, output):
    (output / DEST).mkdir(parents=True, exist_ok=True)
    existing = read_manifest()
    todo = [b for b in sorted(birds(), key=lambda b: b['treeId']) if b['treeId'] not in existing and b['treeId'] not in MANUAL_REVIEW_SPECIES][shard::total]
    photos, missing = {}, []

    def run(bird):
        try:
            return collect_one(bird, output)
        except (OSError, KeyError, ValueError) as exc:
            return bird['treeId'], None, dict(id=bird['treeId'], latin=bird['latin'], errors=[str(exc)[:240]])

    with ThreadPoolExecutor(max_workers=3) as pool:
        for number, (identity, metadata, problem) in enumerate(pool.map(run, todo), 1):
            if metadata:
                photos[identity] = metadata
            else:
                missing.append(problem)
            if number % 20 == 0 or number == len(todo):
                print(f'{number}/{len(todo)}: {len(photos)} added, {len(missing)} missing', flush=True)
    (output / 'results.json').write_text(json.dumps(dict(photos=photos, missing=missing), ensure_ascii=False), encoding='utf8')


def merge(directory):
    all_birds = {b['treeId']: b for b in birds()}
    photos, missing = read_manifest(), {}
    for results in sorted(directory.glob('*/results.json')):
        data = json.loads(results.read_text(encoding='utf8'))
        for reason in data['missing']:
            missing[reason['id']] = reason
        for identity, photo in data['photos'].items():
            bird = all_birds[identity]
            assert identity not in photos and photo['taxonName'] == bird['latin']
            assert photo['author'] and photo['license'] and photo['licenseUrl'] and photo['source']
            image = results.parent / photo['src']
            with Image.open(image) as proof:
                assert proof.format == 'JPEG'
                proof.verify()
            target = ROOT / photo['src']
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(image.read_bytes())
            photos[identity] = photo
    for photo in photos.values():
        assert (ROOT / photo['src']).is_file()
    MANIFEST.write_text('// Licensed additional quiz photographs by tree species ID.\n' + PREFIX +
                        json.dumps(photos, ensure_ascii=False, indent=2, sort_keys=True) + ';\n', encoding='utf8')
    report = dict(checkedAt=TODAY, added=len(photos), species=len(all_birds),
                  missing=[missing.get(k, dict(id=k, latin=all_birds[k]['latin'], errors=['Shard did not complete']))
                           for k in sorted(all_birds.keys() - photos.keys())])
    (ROOT / 'sources/extra-bird-photos-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f"{report['added']}/{report['species']} species have an extra photo", flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'collect':
        collect(int(sys.argv[2]), int(sys.argv[3]), Path(sys.argv[4]))
    elif sys.argv[1] == 'merge':
        merge(Path(sys.argv[2]))
    else:
        raise SystemExit('Expected collect SHARD TOTAL OUT or merge OUT')
