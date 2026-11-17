# Builds app.html (claude.ai artifact) and docs/ (home-screen web app) from src/.
import os, json, hashlib
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')

# ---- deck: three sections, interleaved so new cards arrive mixed ----
secs = {}; cur = None
for line in open('src/deck.txt', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#'): continue
    if line.startswith('[') and line.endswith(']'): cur = line[1:-1]; secs[cur] = []; continue
    f = [x.strip() for x in line.split('|')]
    assert len(f) == 5, 'bad line: ' + line
    secs[cur].append(f)
ids = [f[0] for s in secs.values() for f in s]
dups = {i for i in ids if ids.count(i) > 1}
assert not dups, 'duplicate cards: %s' % dups
order = []
lists = [secs['v'], secs['n'], secs['x']]
while any(lists):
    for l in lists:
        if l: order.append(l.pop(0))
deck = json.dumps(order, ensure_ascii=False, separators=(',', ':'))

head = open('src/head.html', encoding='utf-8').read()
js = open('src/app.js', encoding='utf-8').read().replace('/*@DECK@*/[]', deck)
out0 = head + '\n<script>\n' + js + '\n</script>\n'
build = hashlib.sha1(out0.encode()).hexdigest()[:7]
out = out0.replace('__BUILD__', build)
open('app.html', 'w', encoding='utf-8').write(out)
open('_test.html', 'w', encoding='utf-8').write('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + out)
print('built app.html', len(out), 'bytes,', len(order), 'cards, build', build)

# ---- home-screen web app (serve /docs from any static host) ----
os.makedirs('docs', exist_ok=True)
page = '''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#2745c4">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Poco a Poco">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
''' + out.replace('<div id="app"></div>', '</head><body>\n<div id="app"></div>', 1) + '''
<script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>
</body></html>
'''
open('docs/index.html', 'w', encoding='utf-8').write(page)
json.dump({"name": "Poco a Poco", "short_name": "Poco a Poco", "start_url": ".", "scope": ".", "display": "standalone",
           "orientation": "portrait", "background_color": "#eef1f8", "theme_color": "#2745c4",
           "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]},
          open('docs/manifest.webmanifest', 'w'), indent=1)
open('docs/sw.js', 'w').write('''const CACHE='pap-%s';
const CORE=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('index.html',cp));return r;}).catch(()=>caches.match('index.html')));return;}
 e.respondWith(caches.match(e.request).then(hit=>{const net=fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return r;}).catch(()=>hit);return hit||net;}));});
''' % build)
print('web app built in docs/')
