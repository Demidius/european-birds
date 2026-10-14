"""Match a national checklist snapshot to the current tree by scientific name.
Usage: python3 tools/build-region-tags.py TREE_JS POLAND_JSON OUTPUT_JS
Only accepted modern/wild categories A and C receive the Poland tag.
"""
import json, re, sys
from pathlib import Path

tree = json.loads(Path(sys.argv[1]).read_text().split('window.PASSERINE_TREE = ', 1)[1].rstrip().removesuffix(';'))
source = json.loads(Path(sys.argv[2]).read_text())
species = {}
def walk(node):
    if node['rank'] == 'species':
        species[node['latin']] = node['id']
    for child in node.get('children', []):
        walk(child)
walk(tree['root'])
records = source['records']
assert len(records) == len({r['latin'] for r in records}) == 186
selected, historical, outside = {}, [], []
for r in records:
    if r['category'] not in ['A', 'C']:
        historical.append(r['latin'])
        continue
    if r['latin'] not in species:
        outside.append(r['latin'])
        continue
    selected[species[r['latin']]] = {'latin': r['latin'], 'category': r['category'], 'status': r['status'], 'rare': bool(re.search('[Zz]', r['status']))}
data = {'poland': {'source': source['source'], 'legend': source['legend'], 'sourceDate': source['sourceDate'], 'checkedAt': source['checkedAt'], 'species': selected, 'historicalExcluded': historical, 'outsideCurrentTree': outside}}
Path(sys.argv[3]).write_text('// Poland occurrence: Komisja Faunistyczna, national checklist 2026-06-01.\n// Matching to the current European tree; A/C only, Z/z are regional vagrants.\nwindow.BIRD_REGIONS = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')
print('Poland:', len(selected), 'without rare vagrants:', sum(not r['rare'] for r in selected.values()))
