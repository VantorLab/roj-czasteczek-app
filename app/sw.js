const CACHE = 'roj-1.3.0';
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./vendor/fflate.js", "./vendor/gifenc.esm.js", "./vendor/mp4-muxer.mjs", "./vendor/qrcode.js", "./vendor/three/build/three.module.js", "./vendor/three/examples/jsm/controls/OrbitControls.js", "./vendor/three/examples/jsm/loaders/GLTFLoader.js", "./vendor/three/examples/jsm/math/MeshSurfaceSampler.js", "./vendor/three/examples/jsm/misc/GPUComputationRenderer.js", "./vendor/three/examples/jsm/postprocessing/EffectComposer.js", "./vendor/three/examples/jsm/postprocessing/MaskPass.js", "./vendor/three/examples/jsm/postprocessing/OutputPass.js", "./vendor/three/examples/jsm/postprocessing/Pass.js", "./vendor/three/examples/jsm/postprocessing/RenderPass.js", "./vendor/three/examples/jsm/postprocessing/ShaderPass.js", "./vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js", "./vendor/three/examples/jsm/shaders/CopyShader.js", "./vendor/three/examples/jsm/shaders/LuminosityHighPassShader.js", "./vendor/three/examples/jsm/shaders/OutputShader.js", "./vendor/three/examples/jsm/utils/BufferGeometryUtils.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'api.anthropic.com') return;                       // never cache AI calls
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok && (u.origin === location.origin || /jsdelivr|gstatic|googleapis/.test(u.hostname))) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => hit)));
});
