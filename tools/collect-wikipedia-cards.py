"""Refresh Wikipedia sources for species cards.

From the repository root, with Pillow and mwparserfromhell installed:
python tools/collect-wikipedia-cards.py /path/to/request-cache
"""
import hashlib
import json
import re
import runpy
import sys
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import unquote, urlencode, urlsplit
from urllib.request import Request, urlopen

import mwparserfromhell
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
EXTRA = runpy.run_path(str(ROOT / 'tools/collect-extra-bird-photos.py'))
WIKI = EXTRA['WIKI']
TODAY = date.today().isoformat()
LANGUAGES = ('en', 'pl', 'ru', 'de')
DEST = Path('assets/wikipedia-cards')
BINOMIAL = re.compile(r'[A-Z][a-zë-]+ [a-zë-]+')
FILE = re.compile(r'\.(?:jpe?g|png|webp|tiff?)$', re.I)
NON_PORTRAIT = re.compile(r'\b(?:range|distribution|map|karte|egg|eggs|skeleton|skull|illustration|specimen|stamp|sonogram|museum|nest)\b', re.I)
NEST = re.compile(r'\b(?:nests?|nido|nid|gni[ae][zź]d\w*|гн[её]зд\w*|vogelnest|nistmulde|nestbau)\b', re.I)
BOX_ONLY = re.compile(r'nest.?box|bird.?house|nistkasten|budk[aię]|скворечник', re.I)
IN_NEST = re.compile(r'\b(?:in|on|inside|feeding|chicks?|young|eggs?|incubat\w*|sitting|в гнезде|на гнезде|w gnieździe|auf dem nest)\b', re.I)
BOX_CONTENTS = re.compile(r'\b(?:inside|nestlings?|chicks?|eggs?|nesting|incubating|птенц\w+|яйц\w+|wysiaduje|pisklęta|jaja|brütet|jungvögel)\b', re.I)
EXCLUDE_NEST = re.compile(
    r'(?:(?:collecting|gathering|carrying) (?:mud|grass|material|twigs)|nest(?:ing)? material|'
    r'nest(?:ing)? (?:site|habitat|grounds|range|season|distribution|colonies)|nesting boxes|'
    r'nest[- ]box installation|parasite|\btick\b|hyalomma|\bflea\b|\bmite\b|predation|'
    r'(?:next to|near|away from|out of|leaving|just left) (?:the |their |a |its |her |his )?nest|'
    r'мест[аох]+ гнезд|сбор материала|покинувш|после вылета|opuszczeniu gniazda|poza gniazdo|wydaliny)',
    re.I,
)
NEST_CONTENTS = re.compile(
    r'(?:chicks?|young|eggs?|nestlings?)\b.{0,40}\b(?:in|inside) (?:the |a )?nest|'
    r'nest (?:of .{0,20} )?with (?:chicks?|young|eggs?|nestlings?)|'
    r'гнезд\w* с (?:птенц\w*|яйц\w*|выводком)|(?:im|auf dem) nest|gniazdo z (?:jajami|pisklętami)',
    re.I,
)
ART = re.compile(r'\b(?:drawings?|illustrations?|paintings?|lithographs?|engraving|aquarelle|watercolou?r|grönvold|naumann|gould|lilford)\b', re.I)
PHOTO_MIME = {'image/jpeg', 'image/png', 'image/webp', 'image/tiff'}
LOCK = threading.Lock()
request_slots = {}


def norm(value):
    return ' '.join(unquote(value).replace('_', ' ').strip().split())


def plain(value):
    return ' '.join(mwparserfromhell.parse(str(value)).strip_code().split())


def batches(values, size):
    values = list(dict.fromkeys(values))
    return [values[i:i + size] for i in range(0, len(values), size)]


class Wikimedia:
    def __init__(self, cache):
        self.cache = cache
        cache.mkdir(parents=True, exist_ok=True)

    def get(self, url):
        host = urlsplit(url).hostname
        pace = .55 if host.endswith('wikipedia.org') or host in ('commons.wikimedia.org', 'www.wikidata.org') else .36
        for attempt in range(4):
            with LOCK:
                slot = max(time.monotonic(), request_slots.get(host, 0.0))
                request_slots[host] = slot + pace
            time.sleep(max(0, slot - time.monotonic()))
            try:
                with urlopen(Request(url, headers=WIKI['UA']), timeout=24) as response:
                    return response.read(16_000_001)
            except HTTPError as exc:
                if exc.code not in (429, 500, 502, 503, 504) or attempt == 3:
                    raise
                retry_after = exc.headers.get('Retry-After', '')
                time.sleep(min(60, int(retry_after)) if retry_after.isdigit() else attempt * 3 + 1)
            except OSError:
                if attempt == 3:
                    raise
                time.sleep(attempt * 2 + 1)

    def api(self, host, **params):
        url = 'https://' + host + '/w/api.php?' + urlencode(dict(format='json', formatversion=2, maxlag=5, **params))
        key = self.cache / (hashlib.sha256(url.encode()).hexdigest() + '.json')
        if key.exists():
            return json.loads(key.read_bytes())
        for attempt in range(4):
            raw = self.get(url)
            value = json.loads(raw)
            if value.get('error', {}).get('code') == 'maxlag':
                time.sleep(5 * (attempt + 1))
                continue
            if value.get('error'):
                raise ValueError(value['error'])
            key.write_bytes(raw)
            return value
        raise ValueError('Wikimedia API replication lag')


def wiki_pages(api, lang, titles):
    response = api.api(lang + '.wikipedia.org', action='query', titles='|'.join(titles), redirects=1,
                       prop='pageprops|pageimages|revisions', ppprop='wikibase_item|disambiguation',
                       pilimit='max', piprop='name', pifree=1, rvprop='ids|content', rvslots='main')
    query = response.get('query', {})
    pages = {norm(p['title']): p for p in query.get('pages', []) if p.get('revisions') and
             'disambiguation' not in p.get('pageprops', {})}
    redirects = {norm(r['from']): norm(r['to']) for r in query.get('normalized', []) + query.get('redirects', [])}
    result = {}
    for raw in titles:
        key = norm(raw)
        visited = set()
        while key in redirects and key not in visited:
            visited.add(key)
            key = redirects[key]
        if key in pages:
            result[raw] = pages[key]
    return result


def wiki_sitelinks(api, ids):
    data = api.api('www.wikidata.org', action='wbgetentities', ids='|'.join(ids), props='sitelinks',
                   sitefilter='|'.join(l + 'wiki' for l in LANGUAGES))
    return {qid: item.get('sitelinks', {}) for qid, item in data.get('entities', {}).items()}


def filename(value):
    value = norm(str(value))
    if ':' in value:
        namespace, rest = value.split(':', 1)
        if namespace.lower() in {'file', 'image', 'bild', 'datei', 'plik', 'файл', 'изображение'}:
            value = norm(rest)
    return value if FILE.search(value) else None


def inspect(page, lang):
    revision = page['revisions'][0]
    source = revision['slots']['main']['content']
    parsed = mwparserfromhell.parse(source)
    latin, portraits, nests = None, [], {}
    lead = filename(page.get('pageimage', ''))
    if lead:
        portraits.append(lead)

    def nest_candidate(name, description):
        name = filename(name)
        if not name:
            return
        caption = plain(description)
        label = re.sub('[_-]', ' ', name + ' ' + caption)
        if not NEST.search(label) or EXCLUDE_NEST.search(label) or ART.search(label) or BOX_ONLY.search(label) and not BOX_CONTENTS.search(caption):
            return
        score = 5 * bool(NEST_CONTENTS.search(caption)) + 3 * bool(NEST.search(caption)) + 2 * bool(NEST.search(name)) + bool(IN_NEST.search(caption))
        nests[name] = max(nests.get(name, 0), score)

    for template in parsed.filter_templates(recursive=False):
        key = plain(template.name).lower()
        is_taxobox = any(x in key for x in ('speciesbox', 'taxobox', 'таксон', 'taxon', 'zwierzę infobox'))
        if not is_taxobox:
            continue
        params = {plain(p.name).lower(): p.value for p in template.params}
        for field in ('taxon', 'binomial', 'binominal', 'latin', 'name latin', 'nazwa łacińska', 'nazwa naukowa', 'wissenschaftlicher name', 'научное название'):
            candidate = plain(params.get(field, ''))
            if BINOMIAL.fullmatch(candidate):
                latin = candidate
                break
        if not latin:
            combo = plain(params.get('genus', '')) + ' ' + plain(params.get('species', ''))
            if BINOMIAL.fullmatch(combo):
                latin = combo
        for media_field, caption_field in (('image', 'image_caption'), ('image2', 'image2_caption'), ('image', 'caption'),
                                           ('grafika', 'opis grafiki'), ('image file', 'image description'), ('изображение', 'подпись')):
            name = filename(params.get(media_field, ''))
            if not name:
                continue
            if name not in portraits:
                portraits.append(name)
            nest_candidate(name, params.get(caption_field, ''))
    for link in parsed.filter_wikilinks():
        if ':' in str(link.title) and filename(link.title):
            nest_candidate(link.title, link.text or '')
    for gallery in parsed.filter_tags(matches=lambda tag: str(tag.tag).lower() == 'gallery'):
        for line in str(gallery.contents).splitlines():
            name, _, description = line.partition('|')
            nest_candidate(name, description)

    revision_url = 'https://' + lang + '.wikipedia.org/w/index.php?oldid=' + str(revision['revid'])
    return dict(latin=latin, portraits=portraits, nests=nests, qid=page.get('pageprops', {}).get('wikibase_item'),
                article=revision_url, title=page['title'], lang=lang, source=source)


def commons_files(api, names):
    data = api.api('commons.wikimedia.org', action='query', titles='|'.join('File:' + x for x in names),
                   prop='imageinfo', iiprop='url|size|mime|extmetadata', iiextmetadatafilter='Artist|Credit|LicenseShortName|LicenseUrl|NonFree|Categories',
                   iiurlwidth=800, redirects=1)
    query = data.get('query', {})
    aliases = {norm(r['from']).casefold(): norm(r['to']).casefold()
               for r in query.get('normalized', []) + query.get('redirects', [])}
    infos = {}
    for page in query.get('pages', []):
        if not page.get('imageinfo'):
            continue
        info = page['imageinfo'][0]
        meta = info.get('extmetadata', {})
        license_name = WIKI['text'](meta, 'LicenseShortName')
        if ART.search(page['title']) or ART.search(WIKI['text'](meta, 'Categories').replace('_', ' ')):
            continue
        if not WIKI['FREE'].fullmatch(license_name) or WIKI['text'](meta, 'NonFree').lower() == 'true':
            continue
        if info.get('mime') not in PHOTO_MIME or min(info['width'], info['height']) < 250:
            continue
        source = info['descriptionurl']
        infos[norm(page['title']).casefold()] = dict(
            file=norm(page['title']).removeprefix('File:'), source=source,
            url=info.get('thumburl') or info['url'], original=info['url'], mime=info['mime'], size=info.get('size', 0),
            author=WIKI['text'](meta, 'Artist') or WIKI['text'](meta, 'Credit') or 'Автор указан на странице файла',
            license=license_name, licenseUrl=WIKI['text'](meta, 'LicenseUrl') or source)
    output = {}
    for name in names:
        key = norm('File:' + name).casefold()
        seen = set()
        while key in aliases and key not in seen:
            seen.add(key)
            key = aliases[key]
        if key in infos:
            output[name] = infos[key]
    return output


def source_options(api, birds, pool):
    entries = defaultdict(list)

    def resolve(lang, lookups, permit_rename):
        def get_group(group):
            return wiki_pages(api, lang, group)
        inspected = {}
        for group in pool.map(get_group, batches(lookups.keys(), 20)):
            for alias, page in group.items():
                if page['pageid'] not in inspected:
                    inspected[page['pageid']] = inspect(page, lang)
                info = inspected[page['pageid']]
                for bird in lookups[alias]:
                    if info['latin'] == bird['latin'] or (permit_rename and info['latin'] and
                            re.search(r'\b' + re.escape(bird['latin']) + r'\b', info['source'], re.I)):
                        if not any(x['lang'] == lang for x in entries[bird['treeId']]):
                            entries[bird['treeId']].append(info)

    for lang, field in [('en', 'latin'), ('en', 'en'), ('pl', 'pl'), ('ru', 'ru'), ('de', 'latin')]:
        pending = defaultdict(list)
        for bird in birds:
            title = bird.get(field)
            if title and not entries.get(bird['treeId']):
                pending[norm(title)].append(bird)
        if pending:
            resolve(lang, pending, permit_rename=field in ('latin', 'en'))
        print('matched articles:', len(entries), 'after', lang, field, flush=True)

    matched = defaultdict(set)
    for bird in birds:
        if entries.get(bird['treeId']):
            qid = entries[bird['treeId']][0]['qid']
            if qid:
                matched[qid].add(bird['treeId'])
    # When Wikipedia lumps several catalogue species in one article, link only the article's named species.
    for bird in birds:
        options = entries.get(bird['treeId'])
        if options and len(matched[options[0]['qid']]) > 1 and options[0]['latin'] != bird['latin']:
            entries.pop(bird['treeId'])

    for group in pool.map(lambda group: wiki_sitelinks(api, group), batches(matched.keys(), 35)):
        for qid, links in group.items():
            for identity in matched[qid]:
                if not entries.get(identity):
                    continue
                for lang in LANGUAGES:
                    site = links.get(lang + 'wiki')
                    if site and not any((p[0] if isinstance(p, tuple) else p['lang']) == lang for p in entries[identity]):
                        entries[identity].append((lang, norm(site['title'])))

    for lang in LANGUAGES:
        titles = [item[1] for options in entries.values() for item in options if isinstance(item, tuple) and item[0] == lang]
        articles = {}
        for group in pool.map(lambda group: wiki_pages(api, lang, group), batches(titles, 20)):
            articles.update({title: inspect(page, lang) for title, page in group.items()})
        for options in entries.values():
            options[:] = [articles.get(x[1]) if isinstance(x, tuple) and x[0] == lang else x for x in options]
        print(lang, 'additional articles:', len(articles), flush=True)
    return {k: [x for x in v if x and x['qid'] == v[0]['qid']] for k, v in entries.items()}


def common_media(api, candidates, bird, identity, role, metadata):
    for title, article in candidates:
        info = metadata.get(title)
        if not info:
            continue
        path = DEST / (identity + ('-nest' if role == 'nest' else '') + '.webp')
        if role == 'portrait':
            shared = next((p for p in bird['photos'] if (ROOT / p['src']).is_file() and
                           EXTRA['identities'](info) & EXTRA['identities'](p)), None)
            if shared:
                return {**info, 'src': shared['src'], 'article': article, 'mime': shared.get('mime', '')}
        cache_name = hashlib.sha256(info['source'].encode()).hexdigest() + '.webp'
        cached_image = api.cache / cache_name
        target = ROOT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if cached_image.is_file():
            target.write_bytes(cached_image.read_bytes())
            return {**info, 'src': path.as_posix(), 'article': article, 'modified': 'Преобразовано в WebP.', 'mime': 'image/webp'}
        urls = list(dict.fromkeys([info['url']] + ([info['original']] if info['size'] < 8_000_000 else [])))
        for url in urls:
            try:
                raw = api.get(url)
                if len(raw) > 16_000_000:
                    continue
                with Image.open(BytesIO(raw)) as original:
                    image = ImageOps.exif_transpose(original).convert('RGB')
                image.thumbnail((850, 850), Image.Resampling.LANCZOS)
                image.save(target, 'WEBP', quality=85, method=5)
                cached_image.write_bytes(target.read_bytes())
                return {**info, 'src': path.as_posix(), 'article': article, 'modified': 'Преобразовано в WebP.', 'mime': 'image/webp'}
            except (OSError, ValueError, Image.DecompressionBombError) as exc:
                print('download:', identity, title, str(exc)[:140], flush=True)
    return None


def main(cache):
    api = Wikimedia(cache)
    birds = EXTRA['birds']()
    with ThreadPoolExecutor(max_workers=6) as pool:
        articles = source_options(api, birds, pool)
        wanted = {}
        for bird in birds:
            identity = bird['treeId']
            options = articles.get(identity, [])
            lead = [(title, page['article']) for page in options for title in page['portraits']
                    if not NON_PORTRAIT.search(re.sub('[_-]', ' ', title))]
            nest = sorted(((score, title, page['article']) for page in options for title, score in page['nests'].items()),
                          key=lambda option: -option[0])
            wanted[identity] = (lead, [(title, article) for _, title, article in nest])
        files = {title for roles in wanted.values() for candidates in roles for title, _ in candidates}
        metadata = {}
        for group in pool.map(lambda group: commons_files(api, group), batches(sorted(files), 35)):
            metadata.update(group)
        print(len(metadata), 'licensed article files out of', len(files), 'candidates', flush=True)

        def collect(bird):
            identity = bird['treeId']
            if not articles.get(identity):
                return identity, None
            source = articles[identity][0]
            portraits, nests = wanted[identity]
            portrait = common_media(api, portraits, bird, identity, 'portrait', metadata)
            if portrait:
                nests = [(title, page) for title, page in nests if metadata.get(title, {}).get('source') != portrait['source']]
            nest = common_media(api, nests, bird, identity, 'nest', metadata)
            item = {k: source[k] for k in ('latin', 'article', 'lang', 'title')}
            if portrait:
                item['photo'] = portrait
            if nest:
                item['nest'] = nest
            return identity, item

        result, missing, different = {}, defaultdict(list), []
        for number, ((identity, entry), bird) in enumerate(zip(pool.map(collect, birds), birds), 1):
            if entry:
                result[identity] = entry
                if entry['latin'] != bird['latin']:
                    different.append(dict(id=identity, catalogue=bird['latin'], wikipedia=entry['latin'], article=entry['article']))
            for field in ('article', 'photo', 'nest'):
                if not (entry or {}).get(field):
                    missing[field].append(identity)
            if number % 50 == 0:
                print('processed', number, '/', len(birds), flush=True)
    counts = Counter(field for item in result.values() for field in ('article', 'photo', 'nest') if field in item)
    report = dict(checkedAt=TODAY, species=len(birds), counts=dict(counts), differentNames=different,
                  missingArticle=missing['article'], missingPortrait=missing['photo'])
    (ROOT / 'data-wikipedia-cards.js').write_text('// Wikipedia article revisions and freely licensed card photos.\nwindow.BIRD_WIKIPEDIA_CARDS = ' +
                                                json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + ';\n', encoding='utf8')
    (ROOT / 'sources/wikipedia-cards-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({k: v for k, v in report.items() if k not in ('differentNames', 'missingArticle', 'missingPortrait')}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main(Path(sys.argv[1]))
