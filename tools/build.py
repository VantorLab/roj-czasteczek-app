"""Build every flavour of Rój Cząsteczek from src/.

  dist/roj-czasteczek.html  — page body for the claude.ai Artifact (CDN libraries)
  dist/index.html           — standalone online file (CDN libraries)
  app/index.html            — Windows (Tauri) + iPhone (PWA) app: libraries bundled, works offline
"""
import pathlib, re, json

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
ORDER = ['app.js', 'features2.js', 'features3.js', 'features4.js', 'features5.js', 'features6.js', 'boot.js']
VERSION = (ROOT / 'VERSION').read_text().strip() if (ROOT / 'VERSION').exists() else '1.0.0'

css = (SRC / 'style.css').read_text()
body = (SRC / 'body.html').read_text()
js = ''.join((SRC / n).read_text() for n in ORDER if (SRC / n).exists())

FONTS = '''<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=Manrope:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">'''
CDN_MAP = {"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
           "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}
LOCAL_MAP = {"three": "./vendor/three/build/three.module.js", "three/addons/": "./vendor/three/examples/jsm/"}

def page(imap, script):
    return ('<title>Rój Cząsteczek</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + FONTS + '\n'
            + '<style id="roj-style">\n' + css + '</style>\n\n' + body + '\n'
            + '<script type="importmap" id="roj-imap">\n' + json.dumps({"imports": imap}, indent=1) + '\n</script>\n'
            + '<script type="module" id="roj-app">\n' + script + '</script>\n')

def wrap(inner, head_extra=''):
    return ('<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + head_extra + '</head>\n<body>\n' + inner + '</body>\n</html>\n')

dist = ROOT / 'dist'; dist.mkdir(exist_ok=True)
online = page(CDN_MAP, js)
(dist / 'roj-czasteczek.html').write_text(online)
(dist / 'index.html').write_text(wrap(online))

# ---- offline app (Tauri + PWA): bundled libraries, manifest, service worker ----
app_js = (js.replace('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs', './vendor/mp4-muxer.mjs')
            .replace('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js', './vendor/gifenc.esm.js')
            .replace('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js', './vendor/fflate.js')
            .replace('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', './vendor/qrcode.js'))
app_js += '''
/* app shell: service worker for offline use on iPhone / browsers (not inside the Windows app) */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
'''
head = f'''<meta name="theme-color" content="#04121a">
<meta name="application-name" content="Rój Cząsteczek">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Rój">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
'''
app_page = page(LOCAL_MAP, app_js).replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
(ROOT / 'app' / 'index.html').write_text(wrap(app_page, head))

# service worker: precache the shell, cache other GETs as they are used
assets = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png']
assets += ['./' + p.relative_to(ROOT / 'app').as_posix() for p in sorted((ROOT / 'app' / 'vendor').rglob('*')) if p.is_file()]
sw = f'''const CACHE = 'roj-{VERSION}';
const SHELL = {json.dumps(assets)};
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'api.anthropic.com') return;                       // never cache AI calls
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {{
    if (res.ok && (u.origin === location.origin || /jsdelivr|gstatic|googleapis/.test(u.hostname))) {{ const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }}
    return res;
  }}).catch(() => hit)));
}});
'''
(ROOT / 'app' / 'sw.js').write_text(sw)
print('built', VERSION, '| online', len(online), '| app', len(app_page), '| sw assets', len(assets))
