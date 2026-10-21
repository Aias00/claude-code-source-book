#!/usr/bin/env python3
"""Check source fidelity, EPUB completeness, navigation and static-reader assets."""
from pathlib import Path
from xml.etree import ElementTree as ET
import hashlib,json,zipfile,posixpath
ROOT=Path(__file__).resolve().parents[1];SITE=ROOT/'site'
ns={'h':'http://www.w3.org/1999/xhtml','o':'http://www.idpf.org/2007/opf'}
m=json.loads((SITE/'manifest.json').read_text());expected={p.relative_to(ROOT/'source').as_posix() for p in (ROOT/'source').rglob('*') if p.suffix in ('.ts','.tsx','.js')}
assert len(m['files'])==len(expected)==1902
assert {f['path'] for f in m['files']}==expected
with zipfile.ZipFile(SITE/'downloads/claude-code-source-book.epub') as z:
 assert z.infolist()[0].filename=='mimetype' and z.infolist()[0].compress_type==0
 assert z.read('mimetype')==b'application/epub+zip'
 names=set(z.namelist());docs={n:ET.fromstring(z.read(n)) for n in names if n.endswith(('.xhtml','.opf','.xml'))}
 for n,doc in docs.items():
  for node in doc.iter():
   href=node.get('href') or node.get('src')
   if href and not href.startswith(('http:','https:','#')):
    assert posixpath.normpath(posixpath.join(posixpath.dirname(n),href.split('#')[0])) in names,(n,href)
 for f in m['files']:
  raw=(ROOT/'source'/f['path']).read_bytes();assert hashlib.sha256(raw).hexdigest()==f['sha256']
  online=json.loads((SITE/'data'/f"{f['id']}.json").read_text())
  assert online['text'].encode()==raw
  base='EPUB/source-'+f['id'];parts=[];i=1
  while True:
   n=base+('' if i==1 else '-'+str(i))+'.xhtml'
   if n not in docs:break
   code=docs[n].find('.//h:code',ns);parts.append(code.text or '');i+=1
  assert ''.join(parts).encode()==raw,f['path']
 opf=docs['EPUB/package.opf'];ids={i.get('id') for i in opf.findall('o:manifest/o:item',ns)}
 assert all(i.get('idref') in ids for i in opf.findall('o:spine/o:itemref',ns))
search_records={}
for shard in m['searchShards']:
 for record in json.loads((SITE/shard['path']).read_text()):
  assert record['id'] not in search_records
  search_records[record['id']]=record['text']
assert set(search_records)=={f['id'] for f in m['files']}
for f in m['files']:assert search_records[f['id']].encode()==(ROOT/'source'/f['path']).read_bytes()
for f in ['index.html','app.js','style.css','data/guides.json','.nojekyll']:assert (SITE/f).exists()
print(f"PASS: {len(expected)} source files byte-for-byte identical in website and EPUB; XML, local links, manifest and spine valid.")
