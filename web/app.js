'use strict';
const $=s=>document.querySelector(s);
const safeStore={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
let guides=[],files=[],entries=[],current='',serial=0,cache=new Map(),shards=[],font=Number(safeStore.get('font'))||18,searchSerial=0;
document.documentElement.style.setProperty('--size',font+'px');
if(safeStore.get('theme')==='dark')document.body.classList.add('dark');
$('#theme').onclick=()=>{document.body.classList.toggle('dark');safeStore.set('theme',document.body.classList.contains('dark')?'dark':'light')};
for(const [id,delta] of [['smaller',-1],['larger',1]])$('#'+id).onclick=()=>{font=Math.min(26,Math.max(12,font+delta));document.documentElement.style.setProperty('--size',font+'px');safeStore.set('font',font)};
$('#menu').onclick=()=>{const open=$('#sidebar').classList.toggle('open');$('#menu').setAttribute('aria-expanded',String(open))};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function link(entry){const a=el('a',entry.title);a.href='#'+entry.key;if(entry.key===current)a.setAttribute('aria-current','page');return a}
function toc(){const nav=$('#toc');nav.replaceChildren();const q=$('#search').value.trim().toLowerCase(),module=$('#module').value;
const gs=guides.filter(g=>!module&&(!q||(g.title+' '+g.text).toLowerCase().includes(q)));
if(gs.length){nav.append(el('h2','架构导读'));for(const g of gs)nav.append(link({...g,key:'guide/'+g.id}))}
const groups=new Map();for(const f of files){if(module&&module!==f.module)continue;if(q&&!f.path.toLowerCase().includes(q))continue;if(!groups.has(f.module))groups.set(f.module,[]);groups.get(f.module).push(f)}
if(groups.size)nav.append(el('h2','完整源码附录'));
for(const [name,items] of groups){const d=el('details'),s=el('summary',name+' · '+items.length);d.append(s);d.open=!!q||!!module||items.some(f=>'source/'+f.id===current);for(const f of items)d.append(link({title:f.path,key:'source/'+f.id}));nav.append(d)}
if(!gs.length&&!groups.size)nav.append(el('p','没有匹配的章节或路径。'));}
async function source(f){if(cache.has(f.id))return cache.get(f.id);const r=await fetch('data/'+f.id+'.json');if(!r.ok)throw new Error('源码加载失败：'+r.status);const data=await r.json();cache.set(f.id,data);return data}
async function read(){const key=location.hash.slice(1)||'guide/preface',token=++serial,article=$('#content');current=key;article.replaceChildren(el('p','正在加载…'));toc();$('#sidebar').classList.remove('open');$('#menu').setAttribute('aria-expanded','false');
try{const [kind,id]=key.split('/');let title;
if(kind==='guide'){const g=guides.find(g=>g.id===id);if(!g)throw new Error('章节不存在');title=g.title;article.replaceChildren(el('h1',title));for(const p of g.text.split('\n\n'))article.append(el('p',p));article.append(el('h2','源码入口'));const ul=el('ul');for(const p of g.paths){const f=files.find(f=>f.path===p);if(f){const li=el('li');li.append(link({title:'src/'+p,key:'source/'+f.id}));ul.append(li)}}article.append(ul);
}else if(kind==='source'){const f=files.find(f=>f.id===id);if(!f)throw new Error('源码文件不存在');const data=await source(f);if(token!==serial)return;title='src/'+f.path;article.replaceChildren(el('h1',title));article.append(el('p',`${f.lines.toLocaleString()} 行 · ${f.bytes.toLocaleString()} 字节 · SHA-256: ${f.sha256}`,'source-meta'));const controls=el('div','', 'source-meta'),wrap=el('button','自动换行'),raw=el('a','查看原始源码');raw.href='https://github.com/Aias00/claude-code-source-book/blob/main/source/'+f.path;raw.target='_blank';raw.rel='noopener';controls.append(raw,wrap);article.append(controls);const pre=el('pre'),code=el('code',data.text);pre.append(code);article.append(pre);wrap.onclick=()=>{pre.classList.toggle('wrap');wrap.setAttribute('aria-pressed',String(pre.classList.contains('wrap')))};
}else throw new Error('无效的阅读地址');
if(token!==serial)return;document.title=title+' · Claude Code 源码阅读';safeStore.set('last',key);const idx=entries.findIndex(e=>e.key===key);$('#position').textContent=(idx+1)+' / '+entries.length;$('#prev').disabled=idx<=0;$('#next').disabled=idx<0||idx===entries.length-1;window.scrollTo(0,Number(safeStore.get('scroll:'+key))||0);
}catch(e){if(token===serial)article.replaceChildren(el('h1','暂时无法打开'),el('p',e.message),link({title:'返回前言',key:'guide/preface'}))}}
$('#prev').onclick=()=>{const i=entries.findIndex(e=>e.key===current);if(i>0)location.hash=entries[i-1].key};$('#next').onclick=()=>{const i=entries.findIndex(e=>e.key===current);if(i>=0&&i<entries.length-1)location.hash=entries[i+1].key};
let scrollTimer;window.addEventListener('scroll',()=>{const key=current,pos=window.scrollY;clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>safeStore.set('scroll:'+key,pos),200)});
$('#search').oninput=()=>{searchSerial++;$('#search-status').textContent='';toc()};$('#module').onchange=()=>{searchSerial++;toc()};
$('#search-form').onsubmit=async event=>{event.preventDefault();if(!$('#fulltext').checked){toc();return}const q=$('#search').value.trim().toLowerCase();if(!q){toc();return}const token=++searchSerial,module=$('#module').value,candidates=files.filter(f=>!module||f.module===module),results=[];let done=0,failed=0;$('#toc').replaceChildren();$('#search-status').textContent='正在加载并搜索源码…';
const wanted=new Map(candidates.map(f=>[f.id,f])),jobs=shards.filter(s=>s.ids.some(id=>wanted.has(id)));let cursor=0;
async function worker(){while(cursor<jobs.length){if(token!==searchSerial)return;const job=jobs[cursor++],needed=job.ids.filter(id=>wanted.has(id));try{let data;if(needed.every(id=>cache.has(id))){data=needed.map(id=>cache.get(id))}else{const response=await fetch(job.path);if(!response.ok)throw new Error('搜索数据加载失败');data=await response.json();for(const item of data)cache.set(item.id,item)}if(token!==searchSerial)return;for(const item of data)if(wanted.has(item.id)&&item.text.toLowerCase().includes(q))results.push(wanted.get(item.id))}catch{failed+=needed.length}done+=needed.length;if(token===searchSerial)$('#search-status').textContent=`检索 ${done} / ${candidates.length}，匹配 ${results.length}`}}
await Promise.all(Array.from({length:8},worker));if(token!==searchSerial)return;$('#search-status').textContent=`找到 ${results.length} 个文件`+(failed?`；${failed} 个文件加载失败，请重试`:'');for(const f of results.sort((a,b)=>a.path.localeCompare(b.path)))$('#toc').append(link({title:f.path,key:'source/'+f.id}));if(!results.length)$('#toc').append(el('p','没有找到匹配的源码。'));};
async function init(){try{const [m,g]=await Promise.all([fetch('manifest.json'),fetch('data/guides.json')]);if(!m.ok||!g.ok)throw new Error('目录加载失败');const manifest=await m.json();files=manifest.files;shards=manifest.searchShards;guides=await g.json();entries=[...guides.map(g=>({title:g.title,key:'guide/'+g.id})),...files.map(f=>({title:f.path,key:'source/'+f.id}))];$('#stats').textContent=`${guides.length} 篇导读 · ${files.length.toLocaleString()} 个源码文件 · ${manifest.lines.toLocaleString()} 行`;for(const name of [...new Set(files.map(f=>f.module))].sort()){$('#module').append(new Option(name,name))}window.addEventListener('hashchange',read);if(!location.hash&&safeStore.get('last'))location.hash=safeStore.get('last');else await read()}catch(e){$('#content').replaceChildren(el('h1','书籍加载失败'),el('p',e.message+'。请通过 HTTP 服务或在线站点访问本书。'))}}
init();

/* BEGIN AIAS SHARED READER */
/* Aias Reader 1.0. Shared preference across books on aias00.github.io. */
(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'aias-reader-theme';
  const read = () => { try { return localStorage.getItem(key); } catch { return null; } };
  let theme = read() === 'dark' ? 'dark' : 'light';
  let control;
  function apply() {
    root.dataset.theme = theme;
    if (document.body) document.body.classList.toggle('dark', theme === 'dark');
    const palette = document.querySelector('[data-md-component="palette"]');
    if (palette) {
      const scheme = theme === 'dark' ? 'slate' : 'default';
      document.body.dataset.mdColorScheme = scheme;
      const selected = palette.querySelector(`input[data-md-color-scheme="${scheme}"]`);
      if (selected) {
        selected.checked = true;
        palette.querySelectorAll('label[for]').forEach(label => { label.hidden = label.htmlFor === selected.id; });
      }
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1c1f24' : '#f7f7f3');
    if (!control) return;
    if (control.tagName === 'SELECT') {
      control.value = theme;
    } else {
      control.textContent = theme === 'dark' ? '切换浅色' : '切换深色';
      control.setAttribute('aria-pressed', String(theme === 'dark'));
    }
    control.setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
  }
  apply();
  function initialize() {
    const palette = document.querySelector('[data-md-component="palette"]');
    if (palette) {
      palette.addEventListener('change', event => {
        theme = event.target.dataset.mdColorScheme === 'slate' ? 'dark' : 'light';
        try { localStorage.setItem(key, theme); } catch { /* Optional persistence. */ }
        apply();
      });
      apply();
      return;
    }
    control = document.querySelector('#theme-toggle, #theme, select[name="theme"]');
    if (!control) {
      const bar = document.createElement('div');
      bar.className = 'aias-reader-tools';
      const home = document.createElement('a');
      home.href = 'https://aias00.github.io/#books';
      home.textContent = 'Aias · 电子书架';
      control = document.createElement('button');
      control.type = 'button';
      bar.append(home, control);
      (document.querySelector('main') || document.body).prepend(bar);
    }
    control.hidden = false;
    control.classList.add('aias-reader-theme');
    if (control.tagName === 'SELECT') {
      control.replaceChildren(...['light', 'dark'].map(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value === 'light' ? '浅色' : '深色';
        return option;
      }));
    }
    const eventName = control.tagName === 'SELECT' ? 'change' : 'click';
    // Capture before legacy handlers; all other reader controls keep working.
    document.addEventListener(eventName, event => {
      if (!control.contains(event.target)) return;
      event.stopImmediatePropagation();
      if (eventName === 'click') event.preventDefault();
      theme = control.tagName === 'SELECT' ? control.value : theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, theme); } catch { /* Reading works without storage. */ }
      apply();
    }, true);
    apply();
  }
  // Legacy initializers finish first; the shared preference is applied last.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initialize, 0), { once: true });
  } else {
    setTimeout(initialize, 0);
  }
  addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    theme = event.newValue === 'dark' ? 'dark' : 'light';
    apply();
  });
})();
/* END AIAS SHARED READER */
