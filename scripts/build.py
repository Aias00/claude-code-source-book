#!/usr/bin/env python3
"""Build a dependency-free EPUB 3 and static reader from the archived source."""
from pathlib import Path
import collections, hashlib, html, json, shutil, zipfile
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'site'
TITLE='Claude Code 源码阅读：架构导读与完整源码'
esc=lambda s:html.escape(s,quote=True)
def page(title,body):
 return '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN" xml:lang="zh-CN"><head><meta charset="utf-8"/><title>'+esc(title)+'</title><link rel="stylesheet" href="style.css"/></head><body>'+body+'</body></html>'
def main():
 if OUT.exists():shutil.rmtree(OUT)
 OUT.mkdir();(OUT/'data').mkdir();(OUT/'downloads').mkdir()
 guides=json.loads((ROOT/'book/guide.json').read_text())
 files=[]
 for p in sorted((ROOT/'source').rglob('*')):
  if p.suffix not in ('.ts','.tsx','.js'):continue
  raw=p.read_bytes();rel=p.relative_to(ROOT/'source').as_posix();text=raw.decode('utf-8')
  fid='s'+hashlib.sha256(rel.encode()).hexdigest()[:16]
  item=dict(id=fid,path=rel,module=rel.split('/')[0] if '/' in rel else '核心入口',bytes=len(raw),lines=len(text.splitlines()),sha256=hashlib.sha256(raw).hexdigest())
  files.append(item);(OUT/'data'/f'{fid}.json').write_text(json.dumps(dict(**item,text=text),ensure_ascii=False))
 known={f['path'] for f in files}
 for g in guides:
  missing=[p for p in g['paths'] if p not in known]
  if missing:raise ValueError(f"Invalid guide references: {g['id']}: {missing}")
 shards=[]
 for offset in range(0,len(files),32):
  batch=files[offset:offset+32];name=f'search-{offset//32:03}.json'
  records=[dict(id=f['id'],text=(ROOT/'source'/f['path']).read_bytes().decode('utf-8')) for f in batch]
  (OUT/'data'/name).write_text(json.dumps(records,ensure_ascii=False))
  shards.append(dict(path='data/'+name,ids=[f['id'] for f in batch]))
 manifest=dict(searchShards=shards,title=TITLE,version='2.1.88',source='package/src-extracted/src',count=len(files),lines=sum(f['lines'] for f in files),bytes=sum(f['bytes'] for f in files),files=files)
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 (OUT/'data/guides.json').write_text(json.dumps(guides,ensure_ascii=False))
 for p in (ROOT/'web').iterdir():shutil.copy(p,OUT/p.name)
 (OUT/'.nojekyll').touch()
 entries={};spine=[];nav=[]
 def add(eid,title,body):
  name=eid+'.xhtml';entries[name]=page(title,body);spine.append((eid,name));return name
 source_links={f['path']:'source-'+f['id']+'.xhtml' for f in files}
 for g in guides:
  body='<section><h1>'+esc(g['title'])+'</h1>'+''.join('<p>'+esc(p)+'</p>' for p in g['text'].split('\n\n'))+'<h2>源码入口</h2><ul>'+''.join('<li><a href="'+source_links[p]+'">src/'+esc(p)+'</a></li>' for p in g['paths'])+'</ul></section>'
  nav.append((g['title'],add('guide-'+g['id'],g['title'],body),[]))
 modules=collections.defaultdict(list)
 for f in files:modules[f['module']].append(f)
 for module,items in sorted(modules.items()):
  children=[]
  for f in items:
   text=(ROOT/'source'/f['path']).read_bytes().decode('utf-8')
   # Keep each document small enough for typical ebook readers; retain every character.
   chunks=[];chunk=''
   for line in text.splitlines(keepends=True):
    if chunk and len(chunk)+len(line)>24000:chunks.append(chunk);chunk=''
    chunk+=line
   if chunk:chunks.append(chunk)
   if not chunks:chunks=['']
   for i,part in enumerate(chunks):
    eid='source-'+f['id']+('' if i==0 else '-'+str(i+1))
    label='src/'+f['path']+(f'（{i+1}/{len(chunks)}）' if len(chunks)>1 else '')
    body='<section><h1>'+esc(label)+'</h1><p>'+str(f['lines'])+' 行 · SHA-256: '+f['sha256']+'</p><pre><code>'+esc(part)+'</code></pre></section>'
    name=add(eid,label,body)
    if i==0:children.append((f['path'],name,[]))
  nav.append(('源码 · '+module,children[0][1],children))
 def navlist(items):
  return '<ol>'+''.join('<li><a href="'+name+'">'+esc(label)+'</a>'+(navlist(kids) if kids else '')+'</li>' for label,name,kids in items)+'</ol>'
 entries['nav.xhtml']=page('目录','<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc" id="toc"><h1>目录</h1>'+navlist(nav)+'</nav>')
 entries['style.css']='body{font-family:serif;line-height:1.7;margin:5%;}h1{font-size:1.5em;overflow-wrap:anywhere;}p{overflow-wrap:anywhere;}pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;font-size:.78em;line-height:1.45;}code{font-family:monospace;}a{color:#17635b;}li{margin:.3em 0;}'
 uid='urn:sha256:'+hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()
 opf='<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="zh-CN"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">'+uid+'</dc:identifier><dc:title>'+TITLE+'</dc:title><dc:language>zh-CN</dc:language><dc:creator>Aias00 · 编排与导读</dc:creator><dc:rights>Original source © Anthropic PBC. Original terms apply. Unofficial annotated edition.</dc:rights><dc:description>中文架构导读及 Claude Code 2.1.88 完整业务源码附录。</dc:description><meta property="dcterms:modified">2026-10-21T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>'+''.join('<item id="'+eid+'" href="'+name+'" media-type="application/xhtml+xml"/>' for eid,name in spine)+'</manifest><spine>'+''.join('<itemref idref="'+eid+'"/>' for eid,_ in spine)+'</spine></package>'
 target=OUT/'downloads/claude-code-source-book.epub'
 with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  z.writestr('mimetype','application/epub+zip',compress_type=zipfile.ZIP_STORED)
  z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
  z.writestr('EPUB/package.opf',opf)
  for name,data in entries.items():z.writestr('EPUB/'+name,data)
 print(json.dumps(dict(files=len(files),lines=manifest['lines'],chapters=len(guides),epub_documents=len(spine),epub_bytes=target.stat().st_size),ensure_ascii=False))
if __name__=='__main__':main()
