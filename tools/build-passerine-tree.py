"""Build a European-only tree from saved Avibase and AviList source extracts.
Usage: python tools/build-passerine-tree.py REGIONAL_JSON TAXONOMY_JSON OUTPUT_JS
Source extraction and filtering are recorded in README.md.
"""
import json,re,sys
from pathlib import Path
regional=json.loads(Path(sys.argv[1]).read_text())
taxonomy=json.loads(Path(sys.argv[2]).read_text())
by_latin={r['Scientific_name']:r for r in taxonomy if r['Taxon_rank']=='species'}
families={}
ru={'Tyrannidae':'Тиранновые','Vireonidae':'Виреоновые','Oriolidae':'Иволговые','Laniidae':'Сорокопутовые','Corvidae':'Врановые','Remizidae':'Ремезовые','Paridae':'Синицевые','Panuridae':'Усатые синицы','Alaudidae':'Жаворонковые','Cisticolidae':'Цистиколовые','Acrocephalidae':'Камышовковые','Locustellidae':'Сверчковые','Hirundinidae':'Ласточковые','Aegithalidae':'Длиннохвостые синицы','Cettiidae':'Ширококрылые камышевки','Phylloscopidae':'Пеночковые','Pycnonotidae':'Бюльбюлевые','Sylviidae':'Славковые','Paradoxornithidae':'Суторовые','Leiothrichidae':'Кустарницевые','Regulidae':'Корольковые','Bombycillidae':'Свиристелевые','Tichodromidae':'Стенолазовые','Sittidae':'Поползневые','Certhiidae':'Пищуховые','Troglodytidae':'Крапивниковые','Mimidae':'Пересмешниковые','Sturnidae':'Скворцовые','Cinclidae':'Оляпковые','Turdidae':'Дроздовые','Muscicapidae':'Мухоловковые','Passeridae':'Воробьиные','Prunellidae':'Завирушковые','Ploceidae':'Ткачиковые','Estrildidae':'Вьюрковые ткачики','Motacillidae':'Трясогузковые','Fringillidae':'Вьюрковые','Calcariidae':'Подорожниковые','Emberizidae':'Овсянковые','Passerellidae':'Американские воробьи','Icteridae':'Трупиаловые','Parulidae':'Древесницевые','Cardinalidae':'Кардиналовые'}
excluded=[]
for b in regional:
 if 'Неопределенное происхождение' in b['status']:
  excluded.append(b['latin']);continue
 t=by_latin[b['latin']];assert t['Order']=='Passeriformes' and t['Family']==b['family']
 fam=b['family'];genus=b['latin'].split()[0]
 f=families.setdefault(fam,{'id':fam,'rank':'family','latin':fam,'ru':ru.get(fam,t['Family_English_name']),'children':{}})
 g=f['children'].setdefault(genus,{'id':genus,'rank':'genus','latin':genus,'ru':'','children':[]})
 g['children'].append({'id':b['latin'].replace(' ','_'),'rank':'species','latin':b['latin'],'ru':b['ru'] or t['English_name_AviList'],'en':t['English_name_AviList'],'vagrant':'Редкий/Случайный' in b['status'],'introduced':'Чужеродные' in b['status']})
for f in families.values():f['children']=list(f['children'].values())
def group(latin,label,children):return {'id':latin,'rank':'group','latin':latin,'ru':label,'children':children}
def ff(names):return [families[n] for n in names.split() if n in families]
# Major evolutionary lineages follow Oliveros et al. (2019).
# Family lists within these lineages, and genus/species membership, are not
# reconstructed as resolved sister pairs.
root={'id':'Passeriformes','rank':'order','latin':'Passeriformes','ru':'Воробьинообразные','children':[
 group('Tyranni','Кричащие воробьинообразные',ff('Tyrannidae')),
 group('Passeri','Певчие воробьинообразные',[
  group('Corvides','Corvides',ff('Vireonidae Oriolidae Laniidae Corvidae')),
  group('Passerides','Passerides',[
   group('Sylviida','Sylviida',ff('Remizidae Paridae Panuridae Alaudidae Cisticolidae Acrocephalidae Locustellidae Hirundinidae Aegithalidae Cettiidae Phylloscopidae Pycnonotidae Sylviidae Paradoxornithidae Leiothrichidae')),
   group('Muscicapida','Muscicapida',ff('Regulidae Bombycillidae Tichodromidae Sittidae Certhiidae Troglodytidae Mimidae Sturnidae Cinclidae Turdidae Muscicapidae')),
   group('Passerida','Passerida',ff('Passeridae Prunellidae Ploceidae Estrildidae Motacillidae Fringillidae Calcariidae Emberizidae Passerellidae Icteridae Parulidae Cardinalidae'))
  ])
 ])
]}
def walk(n):
 yield n
 for c in n.get('children',[]):yield from walk(c)
nodes=list(walk(root));assert {n['latin'] for n in nodes if n['rank']=='family'}==set(families)
counts={rank:sum(n['rank']==rank for n in nodes) for rank in ['family','genus','species']}
assert counts=={'family':43,'genus':157,'species':423}
d={'root':root,'counts':counts,'region':'Europe (Avibase)','checkedAt':'2026-10-14','excludedUncertainOrigin':excluded,'sources':[{'title':'Avibase / Birds Canada: Europe, AviList','url':'https://avibase.bsc-eoc.org/checklist.jsp?region=eur&list=avilist&lang=RU'},{'title':'AviList Core Team, 2026: v2025b','url':'https://www.avilist.org/checklist/v2025b/','license':'CC BY 4.0'},{'title':'Oliveros et al., 2019: major passerine lineages','url':'https://doi.org/10.1073/pnas.1813206116'}]}
Path(sys.argv[3]).write_text('// European occurrence: Avibase / Birds Canada, checked 2026-10-14.\n// Taxonomy and scientific/English names: AviList v2025b, CC BY 4.0.\n// Major lineages: Oliveros et al. (2019); nested taxonomic membership is unresolved.\nwindow.PASSERINE_TREE = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')
print(counts)
