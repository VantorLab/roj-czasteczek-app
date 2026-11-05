import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

/* ============================================================
   Utilities
   ============================================================ */
const $ = id => document.getElementById(id);
const hooks = { tick: [], draw: [], seqStart: [], seqStop: [], step: [], args: {}, goto: [], scatter: [], reform: [] };
const PRISTINE_MARKUP = [...document.querySelectorAll('.app, #maskModal, #toast')].map(e => e.outerHTML).join('\n');
const stage = $('stage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

function toast(msg, ms = 2800) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); }
const busy = {
  show(title, text = '', prog = null) { $('busy').hidden = false; $('busyTitle').textContent = title; $('busyText').textContent = text; const p = $('busyProg'); if (prog == null) p.removeAttribute('value'); else p.value = prog; },
  hide() { $('busy').hidden = true; }
};

let downloadsNS = null;
(async () => { try { if (window.claude?.use) downloadsNS = await window.claude.use('downloads'); } catch {} })();
async function saveFile(blob, filename) {
  if (downloadsNS) {
    try { await downloadsNS.save({ filename, data: blob }); toast('Zapisano: ' + filename); return; }
    catch (e) { if (e?.code === 'declined') { toast('Zapis anulowany'); return; } if (e?.code === 'rate_limited') { toast('Poczekaj chwilę i spróbuj ponownie'); return; } }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Pobieranie: ' + filename);
}

/* ============================================================
   Panel: tabs + slider params
   ============================================================ */
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.pane').forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab);
}));
const P = {};
function bindRange(el) {
  const out = el.parentElement.querySelector('output');
  const upd = () => { P[el.id] = parseFloat(el.value); if (out) out.textContent = (+el.value).toFixed(+el.step < 0.01 ? 3 : (+el.step < 1 ? 2 : 0)); };
  el.addEventListener('input', upd); upd();
}
document.querySelectorAll('.pane input[type=range]').forEach(bindRange);
function setRange(id, v) { const el = $(id); el.value = v; el.dispatchEvent(new Event('input')); }

/* ============================================================
   Renderer / scene
   ============================================================ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
} catch (e) {
  stage.insertAdjacentHTML('beforeend', '<div class="err">Ta przeglądarka nie obsługuje WebGL2. Otwórz stronę w aktualnym Chrome, Edge lub Safari.</div>');
  throw e;
}
renderer.domElement.classList.add('gl');
stage.appendChild(renderer.domElement);
const floatOK = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
camera.position.set(0, 0, 6.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06; controls.enablePan = false;
controls.minDistance = 1.2; controls.maxDistance = 16; controls.autoRotateSpeed = 0.6;

const bgUniforms = { uTime: { value: 0 }, uTop: { value: new THREE.Color('#14576a') }, uBottom: { value: new THREE.Color('#020a0f') }, uRays: { value: 1 } };
const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: bgUniforms, depthTest: false, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.); }`,
  fragmentShader: `varying vec2 vUv; uniform float uTime,uRays; uniform vec3 uTop,uBottom;
    void main(){ vec3 c=mix(uBottom,uTop,pow(vUv.y,1.6));
      float r=0.; for(int i=0;i<4;i++){ float f=float(i); float x=vUv.x+(1.-vUv.y)*(f-1.5)*0.12;
        r+=pow(0.5+0.5*sin(x*(6.+f*3.7)+uTime*0.13*(f+1.)+f*2.1),14.); }
      c+=uTop*r*smoothstep(0.25,1.,vUv.y)*0.35*uRays;
      gl_FragColor=vec4(c,1.); }`
}));
bgMesh.frustumCulled = false; bgMesh.renderOrder = -10; scene.add(bgMesh);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 0.12);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

/* ============================================================
   Image → particle sampling (detail weighting, de-glare, depth)
   ============================================================ */
const SPAN = 3.4;
function boxBlur(src, w, h, ch, r) { // separable box blur, ch channels, in place-ish
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let c = 0; c < ch; c++) {
    let acc = 0; const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[(row + Math.min(w - 1, Math.max(0, x))) * ch + c];
    for (let x = 0; x < w; x++) {
      tmp[(row + x) * ch + c] = acc / (2 * r + 1);
      acc += src[(row + Math.min(w - 1, x + r + 1)) * ch + c] - src[(row + Math.max(0, x - r)) * ch + c];
    }
  }
  for (let x = 0; x < w; x++) for (let c = 0; c < ch; c++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * ch + c];
    for (let y = 0; y < h; y++) {
      out[(y * w + x) * ch + c] = acc / (2 * r + 1);
      acc += tmp[(Math.min(h - 1, y + r + 1) * w + x) * ch + c] - tmp[(Math.max(0, y - r) * w + x) * ch + c];
    }
  }
  return out;
}

/* d: RGBA Uint8ClampedArray (w*h). opt: {mode, th, depth, detail, deglare, depthArr} */
function sampleData(d, w, h, N, opt) {
  const M = w * h;
  const R = new Float32Array(M), G = new Float32Array(M), B = new Float32Array(M), A = new Float32Array(M), L = new Float32Array(M);
  for (let i = 0; i < M; i++) { R[i] = d[i * 4] / 255; G[i] = d[i * 4 + 1] / 255; B[i] = d[i * 4 + 2] / 255; A[i] = d[i * 4 + 3] / 255; L[i] = .299 * R[i] + .587 * G[i] + .114 * B[i]; }

  // (4) de-glare: inpaint blown, colourless highlights from their surroundings
  if (opt.deglare > 0) {
    const hw = new Float32Array(M), wrgb = new Float32Array(M * 4);
    for (let i = 0; i < M; i++) {
      const mx = Math.max(R[i], G[i], B[i]), mn = Math.min(R[i], G[i], B[i]);
      const sat = mx > 0 ? (mx - mn) / mx : 0;
      hw[i] = smooth(0.72, 0.97, L[i]) * (1 - smooth(0.15, 0.45, sat)) * A[i];
      const k = (1 - hw[i]) * A[i];
      wrgb[i * 4] = R[i] * k; wrgb[i * 4 + 1] = G[i] * k; wrgb[i * 4 + 2] = B[i] * k; wrgb[i * 4 + 3] = k;
    }
    let bl = boxBlur(wrgb, w, h, 4, Math.max(3, Math.round(Math.max(w, h) / 30)));
    bl = boxBlur(bl, w, h, 4, Math.max(2, Math.round(Math.max(w, h) / 50)));
    for (let i = 0; i < M; i++) {
      const k = bl[i * 4 + 3]; if (k < 1e-4) continue;
      const t = hw[i] * opt.deglare;
      R[i] = lerp(R[i], bl[i * 4] / k, t); G[i] = lerp(G[i], bl[i * 4 + 1] / k, t); B[i] = lerp(B[i], bl[i * 4 + 2] / k, t);
      L[i] = .299 * R[i] + .587 * G[i] + .114 * B[i];
    }
  }

  // (2) detail map: Sobel gradient of luminance → more particles on edges and texture
  let E = null;
  if (opt.detail > 0) {
    E = new Float32Array(M); let mx = 1e-6;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1];
      const gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1];
      E[i] = Math.hypot(gx, gy); if (E[i] > mx) mx = E[i];
    }
    const sc = 1 / Math.min(mx, 1.2);
    for (let i = 0; i < M; i++) E[i] = Math.min(1, E[i] * sc);
  }

  const cdf = new Float64Array(M); let tot = 0, cover = 0;
  for (let i = 0; i < M; i++) {
    let wgt = A[i];
    if (opt.mode === 'dark') wgt *= smooth(opt.th, opt.th + 0.12, L[i]);
    else if (opt.mode === 'light') wgt *= smooth(opt.th, opt.th + 0.12, 1 - L[i]);
    cover += wgt;
    if (E) wgt *= 1 + opt.detail * 5 * E[i];
    tot += wgt; cdf[i] = tot;
  }
  const uniform = tot <= 1e-6; if (uniform) { tot = M; cover = M; }
  const dens = Math.min(1, Math.max(0.12, (cover / M) * 1.5));
  const pos = new Float32Array(N * 4), col = new Uint8Array(N * 4);
  const sx = SPAN * (w / Math.max(w, h)), sy = SPAN * (h / Math.max(w, h));
  const Z = opt.depthArr;
  for (let n = 0; n < N; n++) {
    let idx;
    if (uniform) idx = Math.floor(Math.random() * M);
    else { const u = Math.random() * tot; let lo = 0, hi = M - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; } idx = lo; }
    const x = (idx % w) + Math.random(), y = Math.floor(idx / w) + Math.random();
    const z = Z ? Z[idx] : L[idx];
    pos[n * 4] = (x / w - 0.5) * sx;
    pos[n * 4 + 1] = -(y / h - 0.5) * sy;
    pos[n * 4 + 2] = (z - 0.5) * opt.depth * (Z ? 1.6 : 1) + (Math.random() - 0.5) * 0.04;
    pos[n * 4 + 3] = Math.random();
    col[n * 4] = R[idx] * 255; col[n * 4 + 1] = G[idx] * 255; col[n * 4 + 2] = B[idx] * 255; col[n * 4 + 3] = opt.resin ? opt.resin(R[idx], G[idx], B[idx], L[idx]) * 255 : 0;
  }
  return { pos, col, dens, sx, sy };
}

const work = document.createElement('canvas');
const wctx = work.getContext('2d', { willReadFrequently: true });
function sizeFor(src, maxS = 640) { const s = Math.min(1, maxS / Math.max(src.width, src.height)); return [Math.max(2, Math.round(src.width * s)), Math.max(2, Math.round(src.height * s))]; }

/* Build the masked working image for a shape (polygon and/or AI alpha). Returns {d,w,h}. */
function shapePixels(s, maxS = 640) {
  const [w, h] = sizeFor(s.img, maxS);
  work.width = w; work.height = h; wctx.clearRect(0, 0, w, h);
  wctx.drawImage(s.img, 0, 0, w, h);
  if (s.aiMask) { wctx.globalCompositeOperation = 'destination-in'; wctx.drawImage(s.aiMask, 0, 0, w, h); }
  if (s.poly && s.poly.length > 2) {
    wctx.globalCompositeOperation = 'destination-in'; wctx.beginPath();
    s.poly.forEach(([px, py], i) => i ? wctx.lineTo(px * w, py * h) : wctx.moveTo(px * w, py * h));
    wctx.closePath(); wctx.fillStyle = '#000'; wctx.fill();
  }
  wctx.globalCompositeOperation = 'source-over';
  return { d: wctx.getImageData(0, 0, w, h).data, w, h };
}
function depthArrFor(s, w, h) {
  if ($('depthMode').value !== 'ai' || !s.depthMap) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(s.depthMap, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i * 4] / 255;
  return out;
}

function textCanvas(str) {
  const c = document.createElement('canvas'); c.width = 1400; c.height = 700;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  const words = str.trim().split(/\s+/);
  const lines = words.length > 1 && str.length > 9 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [str.trim()];
  let fs = 300; x.textAlign = 'center'; x.textBaseline = 'middle';
  const font = s => `800 ${s}px "Bricolage Grotesque", "Arial Black", sans-serif`;
  x.font = font(fs); while (Math.max(...lines.map(l => x.measureText(l).width)) > c.width * 0.9 && fs > 40) { fs -= 10; x.font = font(fs); }
  const g = x.createLinearGradient(0, 0, c.width, c.height); g.addColorStop(0, '#8ff3e6'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#ff9b7a');
  x.fillStyle = g;
  lines.forEach((l, i) => x.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * fs * 1.02));
  return c;
}

function flowerCanvas() { /* bundled example picture */
  const c = document.createElement('canvas'); c.width = c.height = 900; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 900, 900); x.translate(450, 450);
  const ring = (n, len, wid, rot, c1, c2) => { for (let i = 0; i < n; i++) { x.save(); x.rotate(rot + i * Math.PI * 2 / n);
    const g = x.createLinearGradient(0, 0, 0, -len); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g;
    x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(wid, -len * 0.35, wid * 0.6, -len * 0.9, 0, -len); x.bezierCurveTo(-wid * 0.6, -len * 0.9, -wid, -len * 0.35, 0, 0); x.fill(); x.restore(); } };
  ring(14, 400, 120, 0, '#ff6a4d', '#ffd1a8'); ring(10, 300, 110, 0.3, '#ff8a5b', '#fff2d6'); ring(8, 190, 80, 0.1, '#ffb36b', '#ffffff');
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 85); g.addColorStop(0, '#fff6a0'); g.addColorStop(0.6, '#f0b23c'); g.addColorStop(1, '#a55a1e');
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 85, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 260; i++) { const a = i * 2.39996, r = 6 * Math.sqrt(i); x.fillStyle = `rgba(90,40,10,${0.35 + 0.4 * Math.random()})`; x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, 2.2, 0, 7); x.fill(); }
  return c;
}

function proc(type, N) {
  const pos = new Float32Array(N * 4), col = new Uint8Array(N * 4);
  const put = (n, x, y, z, r, g, b) => { pos[n * 4] = x; pos[n * 4 + 1] = y; pos[n * 4 + 2] = z; pos[n * 4 + 3] = Math.random(); col[n * 4] = r; col[n * 4 + 1] = g; col[n * 4 + 2] = b; col[n * 4 + 3] = 0; };
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const cyan = [143, 243, 230], pink = [255, 155, 190], white = [240, 250, 255], coral = [255, 155, 122], blue = [70, 110, 255], gold = [255, 214, 140];
  for (let n = 0; n < N; n++) {
    const u = Math.random();
    if (type === 'sphere') {
      const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 1.45 + randn() * 0.03, s = Math.sqrt(1 - z * z);
      put(n, Math.cos(a) * s * r, z * r, Math.sin(a) * s * r, ...mix3(blue, cyan, (z + 1) / 2));
    } else if (type === 'ring') {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 2, rr = 0.13 * Math.sqrt(Math.random()), R = 1.55 + Math.cos(b) * rr;
      put(n, Math.cos(a) * R, Math.sin(b) * rr, Math.sin(a) * R, ...mix3(coral, cyan, 0.5 + 0.5 * Math.sin(a)));
    } else if (type === 'galaxy') {
      const arm = n % 3, r = Math.pow(Math.random(), 1.6) * 2.2 + 0.05, a = r * 2.4 + arm * Math.PI * 2 / 3 + randn() * 0.22 / (r + 0.3);
      put(n, Math.cos(a) * r, randn() * 0.06 * (2.3 - r), Math.sin(a) * r, ...mix3(gold, cyan, Math.min(1, r / 2)));
    } else { /* jelly */
      if (u < 0.58) {
        const th = Math.acos(1 - Math.random() * 0.75), ph = Math.random() * Math.PI * 2, rr = 1.25 + randn() * 0.02, wav = 1 + 0.05 * Math.sin(ph * 8);
        put(n, Math.sin(th) * Math.cos(ph) * rr * wav, Math.cos(th) * rr * 0.75 + 0.35, Math.sin(th) * Math.sin(ph) * rr * wav, ...mix3(white, pink, th / 1.4));
      } else if (u < 0.66) {
        const a = Math.random() * Math.PI * 2, r = 0.25 * Math.sqrt(Math.random());
        put(n, Math.cos(a) * r * (1 + 0.4 * Math.sin(a * 4)), 0.75 + randn() * 0.05, Math.sin(a) * r, 255, 120, 150);
      } else {
        const k = n % 28, a0 = k / 28 * Math.PI * 2, t = Math.random(), inner = k % 4 === 0;
        const R = inner ? 0.18 : 0.95, y = 0.55 - t * (inner ? 1.6 : 2.6), sw = Math.sin(t * 9 + k) * 0.08 * t;
        put(n, Math.cos(a0) * R * (1 - t * 0.2) + sw, y, Math.sin(a0) * R * (1 - t * 0.2) + sw * 0.6, ...mix3(white, inner ? coral : cyan, t));
      }
    }
  }
  return { pos, col, dens: 0.6 };
}

/* (5) GLB/GLTF → surface samples with texture/vertex/material colour */
function sampleModel(root, N) {
  root.updateMatrixWorld(true);
  const parts = [];
  root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).build();
    const area = sampler.distribution[sampler.distribution.length - 1] || 0;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    let tex = null;
    const im = mat?.map?.image;
    if (im && im.width) { const c = document.createElement('canvas'); c.width = Math.min(1024, im.width); c.height = Math.min(1024, im.height); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, c.width, c.height); tex = { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, flipY: mat.map.flipY }; }
    parts.push({ sampler, area, color: mat?.color ? mat.color.clone() : new THREE.Color(1, 1, 1), tex, hasVC: !!g.attributes.color });
  });
  if (!parts.length) throw new Error('W pliku nie ma żadnej siatki 3D.');
  const total = parts.reduce((s, p) => s + p.area, 0) || 1;
  const pos = new Float32Array(N * 4), col = new Uint8Array(N * 4);
  const v = new THREE.Vector3(), nrm = new THREE.Vector3(), c = new THREE.Color(), uv = new THREE.Vector2();
  const box = new THREE.Box3();
  let n = 0;
  parts.forEach((p, pi) => {
    const cnt = pi === parts.length - 1 ? N - n : Math.round(N * p.area / total);
    for (let k = 0; k < cnt && n < N; k++, n++) {
      p.sampler.sample(v, nrm, c, uv);
      let r = p.color.r, g = p.color.g, b = p.color.b;
      if (p.hasVC) { r *= c.r; g *= c.g; b *= c.b; }
      if (p.tex) {
        const tx = Math.floor(((uv.x % 1) + 1) % 1 * (p.tex.w - 1)), ty0 = ((uv.y % 1) + 1) % 1, ty = Math.floor((p.tex.flipY === false ? ty0 : 1 - ty0) * (p.tex.h - 1));
        const i = (ty * p.tex.w + tx) * 4; r *= p.tex.d[i] / 255; g *= p.tex.d[i + 1] / 255; b *= p.tex.d[i + 2] / 255;
      }
      pos[n * 4] = v.x; pos[n * 4 + 1] = v.y; pos[n * 4 + 2] = v.z; pos[n * 4 + 3] = Math.random();
      box.expandByPoint(v);
      // colours from three are linear; store as sRGB bytes
      const s = new THREE.Color(r, g, b).convertLinearToSRGB();
      col[n * 4] = s.r * 255; col[n * 4 + 1] = s.g * 255; col[n * 4 + 2] = s.b * 255; col[n * 4 + 3] = 0;
    }
  });
  const ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), sc = SPAN / Math.max(sz.x, sz.y, sz.z, 1e-6);
  for (let i = 0; i < N; i++) { pos[i * 4] = (pos[i * 4] - ctr.x) * sc; pos[i * 4 + 1] = (pos[i * 4 + 1] - ctr.y) * sc; pos[i * 4 + 2] = (pos[i * 4 + 2] - ctr.z) * sc; }
  return { pos, col, dens: 0.55 };
}

/* ============================================================
   AI models (transformers.js). Loaded lazily from the CDN.
   ============================================================ */
let TF = null, depthPipe = null, segModel = null, segProc = null;
async function tf() {
  if (!TF) { TF = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2'); TF.env.allowLocalModels = false; }
  return TF;
}
const aiProgress = label => p => { if (p.status === 'progress' && p.total) busy.show(label, `Pobieram model AI: ${p.file?.split('/').pop() || ''} ${Math.round(p.loaded / 1048576)} / ${Math.round(p.total / 1048576)} MB`, p.loaded / p.total); };
async function tryDevices(make) {
  const opts = navigator.gpu ? [['webgpu', 'fp16'], ['wasm', 'q8'], ['wasm', 'fp32']] : [['wasm', 'q8'], ['wasm', 'fp32']];
  let last;
  for (const [device, dtype] of opts) { try { return await make(device, dtype); } catch (e) { last = e; } }
  throw last;
}
async function rawFromCanvas(c) { const { RawImage } = await tf(); return RawImage.fromCanvas ? RawImage.fromCanvas(c) : RawImage.fromURL(c.toDataURL()); }
function canvasOf(img, maxS = 1024) { const [w, h] = sizeFor(img, maxS); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); return c; }
function aiFail(e) {
  console.warn(e);
  const msg = String(e?.message || e);
  if (/fetch|network|Failed to load|import|CSP|NetworkError/i.test(msg)) toast('AI niedostępne tutaj: otwórz plik HTML w Chrome/Edge z internetem (podgląd w Claude blokuje pobieranie modeli).', 6000);
  else toast('AI nie poradziło sobie z tym zdjęciem (za mało pamięci?). Użyj ręcznego obrysu albo mniejszego zdjęcia.', 6000);
}

async function aiDepth(s) {
  const { pipeline } = await tf();
  busy.show('Głębia AI', 'Ładuję model Depth Anything…');
  depthPipe ??= await tryDevices((device, dtype) => pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { device, dtype: dtype === 'fp16' ? 'fp16' : dtype === 'q8' ? 'q8' : 'fp32', progress_callback: aiProgress('Głębia AI') }));
  busy.show('Głębia AI', 'Liczę mapę głębi…');
  const { depth } = await depthPipe(await rawFromCanvas(canvasOf(s.img, 768)));
  s.depthMap = depth.toCanvas();
}

async function aiCutout(s) {
  const { AutoModel, AutoProcessor, RawImage } = await tf();
  busy.show('Wycinanie tła AI', 'Ładuję model BiRefNet…');
  segProc ??= await AutoProcessor.from_pretrained('onnx-community/BiRefNet_lite-ONNX');
  const c = canvasOf(s.img, 1024), raw = await rawFromCanvas(c);
  const { pixel_values } = await segProc(raw);
  // fp16 is half the download but some CPUs cannot run it: fall back to fp32 on failure
  const combos = navigator.gpu ? [['webgpu', 'fp16'], ['wasm', 'fp16'], ['wasm', 'fp32']] : [['wasm', 'fp16'], ['wasm', 'fp32']];
  let output_image = null, last;
  for (const [device, dtype] of combos) {
    try {
      if (!segModel || segModel._k !== device + dtype) {
        segModel = await AutoModel.from_pretrained('onnx-community/BiRefNet_lite-ONNX', { device, dtype, progress_callback: aiProgress('Wycinanie tła AI') });
        segModel._k = device + dtype;
      }
      busy.show('Wycinanie tła AI', 'Szukam obiektu na zdjęciu…');
      ({ output_image } = await segModel({ input_image: pixel_values }));
      break;
    } catch (e) { last = e; segModel = null; }
  }
  if (!output_image) throw last;
  const mask = await RawImage.fromTensor(output_image[0].sigmoid().mul(255).to('uint8')).resize(c.width, c.height);
  const mc = document.createElement('canvas'); mc.width = c.width; mc.height = c.height;
  const mx = mc.getContext('2d'), id = mx.createImageData(c.width, c.height);
  const md = mask.data, ch = mask.channels || 1;
  for (let i = 0; i < c.width * c.height; i++) { id.data[i * 4 + 3] = md[i * ch]; }
  mx.putImageData(id, 0, 0);
  s.aiMask = mc;
}

/* ============================================================
   Shapes (up to 6)
   ============================================================ */
const TYPES = { image: 'Zdjęcie / logo', text: 'Napis', model: 'Model 3D', jelly: 'Meduza', sphere: 'Kula', ring: 'Pierścień', galaxy: 'Galaktyka' };
const MAX_SHAPES = 6;
const shapes = [
  { type: 'image', img: flowerCanvas(), name: 'przykład', text: 'AI BIZNES' },
  { type: 'jelly', name: 'meduza', text: 'AI BIZNES' },
];
let SIZE = 256;

function computeShape(s) {
  const N = SIZE * SIZE;
  if (s.type === 'image' && s.img) {
    const { d, w, h } = shapePixels(s);
    const data = sampleData(d, w, h, N, { mode: $('bgMode').value, th: P.bgTh, depth: P.depth, detail: P.detail, deglare: P.deglare, depthArr: depthArrFor(s, w, h), resin: resinClassifier() });
    data.photo = photoCanvasFor(s);
    return data;
  }
  if (s.type === 'text') {
    const c = textCanvas(s.text || 'AI'); const [w, h] = sizeFor(c);
    work.width = w; work.height = h; wctx.drawImage(c, 0, 0, w, h);
    return sampleData(wctx.getImageData(0, 0, w, h).data, w, h, N, { mode: 'dark', th: 0.08, depth: P.depth * 0.4, detail: 0, deglare: 0 });
  }
  if (s.type === 'model' && s.model) return sampleModel(s.model, N);
  return proc(s.type === 'image' || s.type === 'model' ? 'sphere' : s.type, N);
}
function buildShape(i) { shapes[i].data = computeShape(shapes[i]); drawThumb(i); }

function drawThumb(i) {
  const card = $('shapes').children[i]; if (!card) return;
  if (!shapes[i].data) return;
  const cv = card.querySelector('canvas'); if (!cv) return;
  const x = cv.getContext('2d'), { pos, col } = shapes[i].data;
  x.fillStyle = '#04121a'; x.fillRect(0, 0, 160, 160);
  const N = pos.length / 4, step = Math.max(1, Math.floor(N / 9000));
  for (let n = 0; n < N; n += step) { x.fillStyle = `rgb(${col[n * 4]},${col[n * 4 + 1]},${col[n * 4 + 2]})`; x.fillRect(80 + pos[n * 4] * 40, 80 - pos[n * 4 + 1] * 40, 1.2, 1.2); }
}

function renderShapeCards() {
  const host = $('shapes'); host.innerHTML = '';
  shapes.forEach((s, i) => {
    const el = document.createElement('div'); el.className = 'shape';
    el.innerHTML = `
      <button type="button" class="thumb" title="Przemień w kształt ${i + 1}"><canvas width="160" height="160"></canvas><span class="ix">${i + 1}</span><span class="nm"></span></button>
      <select aria-label="Rodzaj kształtu ${i + 1}">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <input type="text" maxlength="24" aria-label="Napis kształtu ${i + 1}" placeholder="Twój napis">
      <div class="mini">
        <span class="file-btn"><button type="button" tabindex="-1">Wgraj</button><input type="file" accept="image/*,.glb,.gltf" aria-label="Wgraj plik do kształtu ${i + 1}"></span>
        <button type="button" class="mask">Obrysuj</button>
      </div>`;
    const thumb = el.querySelector('.thumb'), sel = el.querySelector('select'), txt = el.querySelector('input[type=text]'), file = el.querySelector('input[type=file]'), mask = el.querySelector('.mask');
    el.querySelector('.nm').textContent = s.name;
    sel.value = s.type; txt.value = s.text || ''; txt.hidden = s.type !== 'text'; mask.disabled = s.type !== 'image' || !s.img;
    if (shapes.length > 2) { const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.textContent = '×'; rm.setAttribute('aria-label', `Usuń kształt ${i + 1}`); rm.onclick = e => { e.stopPropagation(); removeShape(i); }; thumb.appendChild(rm); }
    thumb.onclick = () => goTo(i);
    sel.onchange = () => { s.type = sel.value; s.name = s.type === 'image' && s.img ? (s.fileName || 'zdjęcie') : s.type === 'model' && s.model ? (s.fileName || 'model') : TYPES[s.type].toLowerCase(); if (s.type === 'model' && !s.model) toast('Wgraj plik .glb, aby użyć modelu 3D'); refreshShape(i); renderShapeCards(); };
    let tT; txt.oninput = () => { clearTimeout(tT); tT = setTimeout(() => { s.text = txt.value; refreshShape(i); }, 350); };
    file.onchange = () => { loadFileInto(i, file.files[0]); file.value = ''; };
    mask.onclick = () => openMask(i);
    host.appendChild(el);
    drawThumb(i);
  });
  if (shapes.length < MAX_SHAPES) {
    const add = document.createElement('button'); add.type = 'button'; add.className = 'add-shape'; add.textContent = '+ Dodaj kształt';
    add.onclick = () => { shapes.push({ type: ['sphere', 'ring', 'galaxy', 'text'][shapes.length % 4], name: '', text: 'AI BIZNES' }); const k = shapes.length - 1; shapes[k].name = TYPES[shapes[k].type].toLowerCase(); buildShape(k); renderShapeCards(); refreshStepArgs(); };
    host.appendChild(add);
  }
  markActive();
}
function removeShape(i) {
  shapes.splice(i, 1);
  steps.forEach(s => { if (s.act === 'goto' && +s.arg >= shapes.length) s.arg = 0; });
  fromIdx = Math.min(fromIdx, shapes.length - 1); toIdx = Math.min(toIdx, shapes.length - 1);
  renderShapeCards(); uploadPair(); renderSteps();
}
function markActive() { [...$('shapes').querySelectorAll('.thumb')].forEach((t, i) => t.classList.toggle('active', i === toIdx)); }

async function loadFileInto(i, file) {
  if (!file) return;
  const s = shapes[i];
  const nm = file.name.replace(/\.[^.]+$/, '').slice(0, 18);
  if (/\.(glb|gltf)$/i.test(file.name)) {
    try {
      busy.show('Model 3D', 'Wczytuję ' + file.name);
      const buf = await file.arrayBuffer();
      const gltf = await new GLTFLoader().parseAsync(buf, '');
      s.type = 'model'; s.model = gltf.scene; s.modelBuf = buf; s.name = s.fileName = nm;
      refreshShape(i); renderShapeCards(); goTo(i); toast('Wczytano model 3D do kształtu ' + (i + 1));
    } catch (e) { console.warn(e); toast('Nie udało się wczytać modelu: ' + e.message); }
    finally { busy.hide(); }
    return;
  }
  if (!file.type.startsWith('image/')) { toast('Wgraj zdjęcie (JPG, PNG, WebP) albo model GLB'); return; }
  const img = new Image();
  img.onload = async () => {
    Object.assign(s, { type: 'image', img, name: nm, fileName: nm, poly: null, aiMask: null, depthMap: null });
    if ($('depthMode').value === 'ai') { try { await aiDepth(s); } catch (e) { aiFail(e); } finally { busy.hide(); } }
    refreshShape(i); renderShapeCards(); goTo(i); toast('Wczytano do kształtu ' + (i + 1));
  };
  img.onerror = () => toast('Nie udało się odczytać obrazu');
  img.src = URL.createObjectURL(file);
}

/* ============================================================
   GPGPU simulation
   ============================================================ */
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
 vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
 vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
 float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
 vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
 return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
vec3 snoiseVec3(vec3 x){return vec3(snoise(x),snoise(vec3(x.y-19.1,x.z+33.4,x.x+47.2)),snoise(vec3(x.z+74.2,x.x-124.4,x.y+99.4)));}
vec3 curl(vec3 p){const float e=.1;vec3 dx=vec3(e,0.,0.),dy=vec3(0.,e,0.),dz=vec3(0.,0.,e);
 vec3 x0=snoiseVec3(p-dx),x1=snoiseVec3(p+dx),y0=snoiseVec3(p-dy),y1=snoiseVec3(p+dy),z0=snoiseVec3(p-dz),z1=snoiseVec3(p+dz);
 vec3 c=vec3(y1.z-y0.z-z1.y+z0.y, z1.x-z0.x-x1.z+x0.z, x1.y-x0.y-y1.x+y0.x);
 return c/(length(c)+1e-5);}
`;
/* (9) transition styles: each particle's start time inside the morph depends on the style */
const STAGGER = `
float hash13(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
float stagKey(vec3 a, float r){
  if(uTrans<.5) return r;                                                          // wir: random
  if(uTrans<1.5) return clamp(dot(vec2(.83,-.55),a.xy)/3.6+.5,0.,1.)*.85+r*.15;    // fala od rogu
  if(uTrans<2.5) return clamp(.5-a.y/3.6,0.,1.)*.75+r*.25;                        // piasek: z góry
  if(uTrans<3.5) return clamp(a.y/3.6+.5,0.,1.)*.85+r*.15;                        // rozpuszczanie od dołu
  return hash13(floor(a*2.4))*.85+r*.15;                                          // odłamki
}
float morphOf(vec3 a, float r){ float k=stagKey(a,r); return smoothstep(k*.55,k*.55+.45,uMorph); }
`;
const velShader = `
uniform float uTime,uDelta,uMorph,uSpring,uDamping,uNoise,uFlight,uScatter,uWave,uPointerRadius,uPointerStrength,uShock,uTrans,uWind,uGravity,uPour,uPourY,uPulse,uFlat;
uniform vec3 uPointer,uPointerVel,uShockOrigin;
uniform sampler2D tFrom,tTo;
${NOISE}
${STAGGER}
void main(){
  vec2 uv=gl_FragCoord.xy/resolution.xy;
  vec3 p=texture2D(texturePosition,uv).xyz; vec3 v=texture2D(textureVelocity,uv).xyz;
  vec4 ta=texture2D(tFrom,uv); vec4 tb=texture2D(tTo,uv);
  float r=ta.w;
  float m=morphOf(ta.xyz,r);
  float tr=sin(3.14159265*m);
  vec3 target=mix(ta.xyz,tb.xyz,m);
  target.z+=sin(uTime*1.3+target.x*2.2+target.y*1.7)*uWave*.12*(1.-uFlat);
  target.y+=cos(uTime*.9+target.x*1.5)*uWave*.04*(1.-uFlat);
  target.z*=1.-uFlat;
  float hold=1.-uScatter;
  vec3 acc=(target-p)*uSpring*12.*hold;
  float curlAmt=uNoise*.8*(1.-uFlat)+uScatter*5.;
  if(uTrans<.5) curlAmt+=tr*uFlight*6.;
  else if(uTrans<1.5){ curlAmt+=tr*uFlight*2.; acc+=vec3(0.,0.,1.)*tr*uFlight*5.; }
  else if(uTrans<2.5){ acc+=vec3(0.,-1.,0.)*tr*uFlight*14.; curlAmt+=tr*uFlight; }
  else if(uTrans<3.5){ acc+=vec3(0.,1.,0.)*tr*uFlight*6.; curlAmt+=tr*uFlight*3.; }
  else { vec3 cell=floor(ta.xyz*2.4); vec3 h=vec3(hash13(cell),hash13(cell+7.1),hash13(cell+3.3))-.5; acc+=(normalize(cell+.5+1e-3)*.6+h)*tr*uFlight*14.; }
  acc+=curl(p*.65+vec3(0.,uTime*.12,uTime*.05))*curlAmt;
  acc+=normalize(p+1e-4)*uScatter*7.*(.35+r);
  acc+=vec3(uWind,-uGravity,0.)*(1.-uFlat);
  acc+=normalize(p+1e-4)*uPulse*4.;
  vec3 d=p-uPointer; float dist=length(d);
  float f=1.-smoothstep(0.,uPointerRadius,dist); f*=f;
  acc+=d/(dist+1e-4)*f*uPointerStrength*28.+uPointerVel*f*35.;
  vec3 ds=p-uShockOrigin; float sd=length(ds);
  acc+=ds/(sd+1e-4)*uShock*exp(-sd*1.4)*55.;
  if(uPour>.5 && p.y>uPourY) acc=vec3(0.,-12.,0.)+curl(p*.4+uTime*.2)*.6;   // (10) pour: free fall until the stream reaches the shape
  v+=acc*uDelta;
  v*=pow(uDamping,uDelta*60.);
  gl_FragColor=vec4(v,1.);
}`;
const posShader = `
uniform float uDelta;
void main(){ vec2 uv=gl_FragCoord.xy/resolution.xy; vec4 p=texture2D(texturePosition,uv); vec3 v=texture2D(textureVelocity,uv).xyz; p.xyz+=v*uDelta; gl_FragColor=p; }`;

let gpu, posVar, velVar, sim, points, texFrom, texTo, colFrom, colTo;
let fromIdx = 0, toIdx = 0;
const renderUniforms = {
  tPos: { value: null }, tVel: { value: null }, tFrom: { value: null }, tColFrom: { value: null }, tColTo: { value: null },
  uMorph: { value: 1 }, uTrans: { value: 0 }, uSize: { value: 0.015 }, uViewH: { value: 800 }, uFovK: { value: 0.7279 }, uOpacity: { value: 0.45 }, uTime: { value: 0 },
  uColorMode: { value: 0 }, uTint1: { value: new THREE.Color('#1b4dff') }, uTint2: { value: new THREE.Color('#8ff3e6') }, uInk: { value: 0 },
  uDensFrom: { value: 1 }, uDensTo: { value: 1 }, uSizeBoost: { value: 1 },
  uResinColor: { value: new THREE.Color('#0d6e6a') }, uResinMix: { value: 0 }, uHide: { value: 0 }
};
const pointsMat = new THREE.ShaderMaterial({
  uniforms: renderUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform sampler2D tPos,tVel,tFrom,tColFrom,tColTo; uniform float uMorph,uTrans,uSize,uViewH,uFovK,uTime,uColorMode,uDensFrom,uDensTo,uSizeBoost,uResinMix; uniform vec3 uTint1,uTint2,uResinColor;
    attribute vec2 ref; varying vec3 vColor; varying float vAlpha; varying float vDens;
    ${STAGGER}
    void main(){
      vec3 p=texture2D(tPos,ref).xyz; vec4 fa=texture2D(tFrom,ref);
      float r=fa.w; float m=morphOf(fa.xyz,r);
      vec4 ca=texture2D(tColFrom,ref), cb=texture2D(tColTo,ref);
      vec3 c=mix(ca.rgb,cb.rgb,m); float resin=mix(ca.a,cb.a,m);
      vDens=mix(uDensFrom,uDensTo,m);
      float l=dot(c,vec3(.2126,.7152,.0722));
      vec3 rc=mix(uResinColor*.3,uResinColor*1.35,smoothstep(0.,.45,l))+vec3(max(0.,l-.72)*1.6);
      c=mix(c,rc,resin*uResinMix);
      if(uColorMode>.5&&uColorMode<1.5) c=mix(uTint1,uTint2,smoothstep(0.,.8,l));
      else if(uColorMode>1.5) c=uTint2*(.35+l);
      float speed=length(texture2D(tVel,ref).xyz);
      c+=vec3(.6,.8,1.)*min(speed*.05,.6);
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=uSize*uSizeBoost*(.55+r*.9)*uViewH/(uFovK*-mv.z);
      vColor=c; vAlpha=.7+.3*sin(uTime*2.+r*60.);
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vAlpha; varying float vDens; uniform float uOpacity,uInk,uHide;
    void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;
      float a=pow(1.-d*2.,1.6)*vAlpha*uOpacity*vDens; if(uInk>.5) a=smoothstep(.5,.35,d)*uOpacity;
      a*=1.-uHide;
      gl_FragColor=vec4(vColor,a); }`
});

function dataTex(arr, type) { const t = new THREE.DataTexture(arr, SIZE, SIZE, THREE.RGBAFormat, type); t.needsUpdate = true; return t; }

function startTexture(mode) {
  const t = gpu.createTexture(), a = t.image.data, N = a.length / 4;
  for (let n = 0; n < N; n++) {
    const i = n * 4, r = Math.random();
    if (mode === 'still') { const d = shapes[toIdx].data.pos; a[i] = d[i]; a[i + 1] = d[i + 1]; a[i + 2] = d[i + 2]; }
    else if (mode === 'pour') { a[i] = randn() * 0.1; a[i + 1] = 2.6 + r * 16; a[i + 2] = randn() * 0.1; }
    else if (mode === 'floor') { a[i] = (Math.random() - .5) * 10; a[i + 1] = -3.2 - Math.random() * .3; a[i + 2] = (Math.random() - .5) * 6; }
    else { const z = Math.random() * 2 - 1, ph = Math.random() * Math.PI * 2, rr = 4 + r * 5, s = Math.sqrt(1 - z * z); a[i] = Math.cos(ph) * s * rr; a[i + 1] = z * rr; a[i + 2] = Math.sin(ph) * s * rr - 2; }
    a[i + 3] = 1;
  }
  return t;
}

function buildSim(startMode = 'cloud') {
  if (gpu) gpu.dispose();
  if (points) { scene.remove(points); points.geometry.dispose(); }
  [texFrom, texTo, colFrom, colTo].forEach(t => t && t.dispose());
  const N = SIZE * SIZE;
  shapes.forEach((_, i) => buildShape(i));
  gpu = new GPUComputationRenderer(SIZE, SIZE, renderer);
  if (!floatOK) gpu.setDataType(THREE.HalfFloatType);
  posVar = gpu.addVariable('texturePosition', posShader, startTexture(startMode));
  velVar = gpu.addVariable('textureVelocity', velShader, gpu.createTexture());
  gpu.setVariableDependencies(posVar, [posVar, velVar]);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);
  texFrom = dataTex(new Float32Array(N * 4), THREE.FloatType); texTo = dataTex(new Float32Array(N * 4), THREE.FloatType);
  colFrom = dataTex(new Uint8Array(N * 4), THREE.UnsignedByteType); colTo = dataTex(new Uint8Array(N * 4), THREE.UnsignedByteType);
  colFrom.colorSpace = colTo.colorSpace = THREE.SRGBColorSpace;
  sim = {
    uTime: { value: 0 }, uDelta: { value: 0.016 }, uMorph: { value: 1 }, uSpring: { value: .6 }, uDamping: { value: .92 }, uNoise: { value: .35 },
    uFlight: { value: 1 }, uScatter: { value: 0 }, uWave: { value: .6 }, uPointerRadius: { value: .5 }, uPointerStrength: { value: 0 }, uShock: { value: 0 },
    uTrans: { value: 0 }, uWind: { value: 0 }, uGravity: { value: 0 }, uPour: { value: 0 }, uPourY: { value: 2.2 }, uPulse: { value: 0 }, uFlat: { value: 0 },
    uPointer: { value: new THREE.Vector3(99, 99, 99) }, uPointerVel: { value: new THREE.Vector3() }, uShockOrigin: { value: new THREE.Vector3(99, 99, 99) },
    tFrom: { value: texFrom }, tTo: { value: texTo }
  };
  velVar.material.uniforms = sim;
  posVar.material.uniforms = { uDelta: sim.uDelta };
  const err = gpu.init();
  if (err) { stage.insertAdjacentHTML('beforeend', `<div class="err">Symulacja nie wystartowała: ${err}. Wybierz mniejszą liczbę cząsteczek.</div>`); return; }
  const g = new THREE.BufferGeometry(), ref = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { ref[i * 2] = ((i % SIZE) + .5) / SIZE; ref[i * 2 + 1] = (Math.floor(i / SIZE) + .5) / SIZE; }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('ref', new THREE.BufferAttribute(ref, 2));
  points = new THREE.Points(g, pointsMat); points.frustumCulled = false; scene.add(points);
  renderUniforms.tFrom.value = texFrom; renderUniforms.tColFrom.value = colFrom; renderUniforms.tColTo.value = colTo;
  uploadPair();
  $('hudCount').textContent = N.toLocaleString('pl-PL');
}

function uploadPair() {
  const a = shapes[fromIdx].data, b = shapes[toIdx].data;
  texFrom.image.data.set(a.pos); texFrom.needsUpdate = true;
  texTo.image.data.set(b.pos); texTo.needsUpdate = true;
  colFrom.image.data.set(a.col); colFrom.needsUpdate = true;
  colTo.image.data.set(b.col); colTo.needsUpdate = true;
  renderUniforms.uDensFrom.value = a.dens; renderUniforms.uDensTo.value = b.dens;
}
function refreshShape(i) { buildShape(i); if (i === fromIdx || i === toIdx) uploadPair(); }
function refreshAllImages() { shapes.forEach((s, i) => { if (s.type === 'image' || s.type === 'text') buildShape(i); }); uploadPair(); }

function reform(mode = 'cloud') {
  const t = startTexture(mode);
  gpu.renderTexture(t, posVar.renderTargets[0]); gpu.renderTexture(t, posVar.renderTargets[1]);
  const z = gpu.createTexture();
  gpu.renderTexture(z, velVar.renderTargets[0]); gpu.renderTexture(z, velVar.renderTargets[1]);
  t.dispose(); z.dispose();
  anim.pour = mode === 'pour' ? 9 : 0;
  hooks.reform.forEach(f => f(mode));
}

/* ============================================================
   Morphing between shapes (8)
   ============================================================ */
const anim = { morph: 1, morphTarget: 1, scatter: 0, pour: 0, prev: 1 };
function shownIdx() { return anim.morph >= 0.5 ? toIdx : fromIdx; }
function goTo(k) {
  k = Math.max(0, Math.min(shapes.length - 1, k));
  const cur = shownIdx();
  if (k === cur && anim.morph >= 1) return;
  anim.prev = cur;
  fromIdx = cur; toIdx = k; uploadPair();
  anim.morph = 0; anim.morphTarget = 1;
  markActive();
  hooks.goto.forEach(f => f(k));
}
function scatterPulse() { anim.scatter = 1; hooks.scatter.forEach(f => f()); }

/* ============================================================
   Sizing / framing
   ============================================================ */
const FR = { full: null, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9 };
const view = { w: 2, h: 2, pr: 1 };
function resize() {
  const W = stage.clientWidth, H = stage.clientHeight, ar = FR[$('frame').value];
  let w = W, h = H;
  if (ar) { const m = 20; w = W - m * 2; h = w / ar; if (h > H - m * 2) { h = H - m * 2; w = h * ar; } }
  w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
  const cv = renderer.domElement; cv.style.left = ((W - w) / 2) + 'px'; cv.style.top = ((H - h) / 2) + 'px';
  stage.classList.toggle('framed', !!ar);
  const pr = Math.min(window.devicePixelRatio || 1, 2) * (+$('quality').value === 2 ? 1 : 0.75);
  setRenderSize(w, h, pr);
}
function setRenderSize(w, h, pr, updateStyle = true) {
  Object.assign(view, { w, h, pr });
  renderer.setPixelRatio(pr); renderer.setSize(w, h, updateStyle); composer.setPixelRatio(pr); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderUniforms.uViewH.value = h * pr;
}
function fitCameraDistance() { const ar = camera.aspect; return ar < 0.8 ? 8.4 : (ar < 1 ? 7.8 : 6.2); }
new ResizeObserver(() => { const before = camera.aspect; resize(); if (Math.abs(before - camera.aspect) > 0.01 && !seq.playing) { camera.position.setLength(fitCameraDistance()); } }).observe(stage);

/* ============================================================
   Pointer
   ============================================================ */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
const FAR = new THREE.Vector3(99, 99, 99);
const ptr = { world: FAR.clone(), last: FAR.clone(), vel: new THREE.Vector3(), energy: 0, active: false, down: null };
function pointerWorld(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), new THREE.Vector3());
  return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
}
const cv = renderer.domElement;
cv.addEventListener('pointermove', e => { const w = pointerWorld(e); if (!w) return; if (!ptr.active) { ptr.last.copy(w); ptr.active = true; } ptr.world.copy(w); });
cv.addEventListener('pointerleave', () => { ptr.active = false; ptr.world.copy(FAR); });
cv.addEventListener('pointerdown', e => { ptr.down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
cv.addEventListener('pointerup', e => {
  const d = ptr.down; ptr.down = null; if (!d) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 350) { const w = pointerWorld(e); if (w) shock(w); }
  if (e.pointerType !== 'mouse') { ptr.active = false; ptr.world.copy(FAR); }
});
function shock(at) { if (reduced) return; sim.uShockOrigin.value.copy(at); sim.uShock.value = 1; }

/* ============================================================
   Sequence / timeline (6) + camera moves (7)
   ============================================================ */
const ACTS = { goto: 'Przemień w', scatter: 'Rozsyp', reform: 'Złóż od nowa', shock: 'Fala uderzeniowa', trans: 'Zmień przejście' };
const REFORM = { cloud: 'z chmury', pour: 'wylewanie z góry', floor: 'z podłogi' };
const TRANS = ['wir', 'fala od rogu', 'piasek', 'rozpuszczanie', 'odłamki'];
const DEFAULT_STEPS = () => [
  { t: 0, act: 'reform', arg: 'cloud' }, { t: 4.2, act: 'goto', arg: 1 }, { t: 7.6, act: 'goto', arg: 0 }, { t: 10.6, act: 'scatter', arg: '' }
];
let steps = DEFAULT_STEPS();
function argOptions(act) {
  if (act === 'goto') return shapes.map((s, i) => [i, `${i + 1} · ${s.name}`]);
  if (act === 'reform') return Object.entries(REFORM);
  if (act === 'trans') return TRANS.map((n, i) => [i, n]);
  if (hooks.args[act]) return hooks.args[act]();
  return [['', '—']];
}
function seqDuration() { return Math.max(0, ...steps.map(s => +s.t || 0)) + P.seqTail; }
function renderSteps() {
  const host = $('steps'); host.innerHTML = '';
  steps.sort((a, b) => a.t - b.t).forEach((s, i) => {
    const row = document.createElement('div'); row.className = 'step';
    row.innerHTML = `<input type="number" min="0" max="120" step="0.1" aria-label="Czas kroku ${i + 1} w sekundach"><select aria-label="Akcja kroku ${i + 1}">${Object.entries(ACTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select aria-label="Parametr kroku ${i + 1}"></select><button type="button" class="rm" aria-label="Usuń krok ${i + 1}">×</button>`;
    const [tIn, aSel, pSel, rm] = row.children;
    tIn.value = s.t; aSel.value = s.act;
    const fillArgs = () => { pSel.innerHTML = argOptions(s.act).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''); pSel.value = s.arg; if (pSel.selectedIndex < 0) { pSel.selectedIndex = 0; s.arg = pSel.value; } pSel.disabled = s.act === 'scatter' || s.act === 'shock'; };
    fillArgs();
    tIn.onchange = () => { s.t = Math.max(0, +tIn.value || 0); renderSteps(); };
    aSel.onchange = () => { s.act = aSel.value; s.arg = ''; fillArgs(); updSeqLen(); };
    pSel.onchange = () => { s.arg = pSel.value; };
    rm.onclick = () => { steps.splice(steps.indexOf(s), 1); renderSteps(); };
    host.appendChild(row);
  });
  updSeqLen();
}
function refreshStepArgs() { renderSteps(); }
function updSeqLen() { $('seqLen').textContent = seqDuration().toFixed(1) + ' s'; }
$('seqTail').addEventListener('input', updSeqLen);
$('btnAddStep').onclick = () => { const t = steps.length ? Math.max(...steps.map(s => s.t)) + 2 : 0; steps.push({ t: +t.toFixed(1), act: 'goto', arg: 0 }); renderSteps(); };
$('btnSeqDefault').onclick = () => { steps = DEFAULT_STEPS(); renderSteps(); };

function runStep(s) {
  if (s.act === 'goto') goTo(+s.arg);
  else if (s.act === 'scatter') scatterPulse();
  else if (s.act === 'reform') { if (!seq.noReform) reform(s.arg || 'cloud'); }
  else if (s.act === 'shock') sim && (sim.uShockOrigin.value.set(0, 0, 0.5), sim.uShock.value = 1);
  else if (s.act === 'trans') { $('trans').value = s.arg; applyTrans(); }
  else hooks.step.forEach(f => f(s));
}

const seq = { playing: false, t0: 0, done: new Set(), dur: 0, onEnd: null, sph0: new THREE.Spherical(), fov0: 40 };
function playSeq(onEnd = null) {
  seq.playing = true; seq.t0 = T; seq.done = new Set(); seq.dur = seqDuration(); seq.onEnd = onEnd;
  seq.sph0.setFromVector3(camera.position); seq.fov0 = camera.fov;
  if ($('camMove').value !== 'none') controls.enabled = false;
  anim.morph = anim.morphTarget = 1;
  hooks.seqStart.forEach(f => f());
}
function stopSeq() {
  if (!seq.playing) return;
  seq.playing = false; controls.enabled = true;
  if ($('camMove').value === 'vertigo') { camera.fov = seq.fov0; camera.updateProjectionMatrix(); }
  hooks.seqStop.forEach(f => f());
  const cb = seq.onEnd; seq.onEnd = null; cb && cb();
}
function seqTick() {
  if (!seq.playing) return;
  const t = T - seq.t0;
  steps.forEach((s, i) => { if (!seq.done.has(i) && t >= s.t) { seq.done.add(i); runStep(s); } });
  applyCamera(clamp01(t / seq.dur));
  if (t >= seq.dur) stopSeq();
}
function applyCamera(p) {
  const mv = $('camMove').value; if (mv === 'none') return;
  const s0 = seq.sph0, e = ease(p), sp = new THREE.Spherical(s0.radius, s0.phi, s0.theta);
  if (mv === 'dolly') sp.radius = s0.radius * lerp(1.15, 0.68, e);
  else if (mv === 'orbit') sp.theta = s0.theta + Math.PI * 2 * e;
  else if (mv === 'fly') { sp.theta = s0.theta + lerp(-0.6, 0.6, e); sp.phi = lerp(0.95, 1.35, Math.sin(p * Math.PI)); sp.radius = s0.radius * lerp(1.05, 0.8, e); }
  else if (mv === 'rise') { sp.phi = lerp(2.1, Math.PI / 2, e); sp.radius = s0.radius * lerp(0.85, 1, e); }
  else if (mv === 'vertigo') {
    sp.radius = s0.radius * lerp(1.6, 0.75, e);
    const hgt = 2 * s0.radius * Math.tan(THREE.MathUtils.degToRad(seq.fov0) / 2);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(hgt / (2 * sp.radius))); camera.updateProjectionMatrix();
  }
  camera.position.setFromSpherical(sp); camera.lookAt(0, 0, 0);
}
$('btnPlay').onclick = () => playSeq();
$('btnStop').onclick = () => stopSeq();

/* ============================================================
   Controls wiring
   ============================================================ */
$('btnMorph').onclick = () => goTo(anim.prev);
$('btnScatter').onclick = scatterPulse;
$('btnReformCloud').onclick = () => reform('cloud');
$('btnReformPour').onclick = () => reform('pour');
$('btnReformFloor').onclick = () => reform('floor');
$('morph').addEventListener('input', () => { anim.morph = anim.morphTarget = P.morph; });
function applyTrans() { const v = +$('trans').value; if (sim) sim.uTrans.value = v; renderUniforms.uTrans.value = v; }
$('trans').addEventListener('change', applyTrans);
addEventListener('keydown', e => {
  if (e.target.matches('input[type=text],input[type=number],textarea,select')) return;
  if (!$('maskModal').hidden) return;
  if (e.key === 'm' || e.key === 'M') goTo(anim.prev);
  if (/^[1-6]$/.test(e.key)) goTo(+e.key - 1);
  if (e.code === 'Space') { e.preventDefault(); scatterPulse(); }
});
let imgT;
['bgMode', 'depthMode'].forEach(id => $(id).addEventListener('change', async () => {
  if (id === 'depthMode' && $('depthMode').value === 'ai') {
    try { for (const s of shapes) if (s.type === 'image' && s.img && !s.depthMap) await aiDepth(s); }
    catch (e) { aiFail(e); $('depthMode').value = 'lum'; }
    finally { busy.hide(); }
  }
  refreshAllImages();
}));
['bgTh', 'depth', 'detail', 'deglare'].forEach(id => $(id).addEventListener('input', () => { clearTimeout(imgT); imgT = setTimeout(refreshAllImages, 220); }));
$('count').addEventListener('change', e => { SIZE = +e.target.value; buildSim(); applyTrans(); });
['frame', 'quality'].forEach(id => $(id).addEventListener('change', () => { resize(); camera.position.setLength(fitCameraDistance()); }));
$('autoRot').addEventListener('change', e => controls.autoRotate = e.target.checked);
const BG = { abyss: ['#14576a', '#020a0f', 1], black: ['#000000', '#000000', 0], night: ['#0d1a3a', '#03050d', 0], paper: ['#f3f1ec', '#dcd8cf', 0] };
function applyLook() {
  const b = BG[$('bg').value]; bgUniforms.uTop.value.set(b[0]); bgUniforms.uBottom.value.set(b[1]); bgUniforms.uRays.value = b[2];
  const paper = $('bg').value === 'paper';
  const add = $('additive').checked && !paper;
  pointsMat.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending; pointsMat.needsUpdate = true;
  renderUniforms.uInk.value = add ? 0 : 1;
  renderUniforms.uColorMode.value = +$('colorMode').value;
  renderUniforms.uTint1.value.set($('tint1').value); renderUniforms.uTint2.value.set($('tint2').value);
}
['bg', 'additive', 'colorMode', 'tint1', 'tint2'].forEach(id => $(id).addEventListener('input', applyLook));

const drop = $('drop');
stage.addEventListener('dragover', e => { e.preventDefault(); drop.hidden = false; });
stage.addEventListener('dragleave', e => { if (e.target === drop) drop.hidden = true; });
stage.addEventListener('drop', e => { e.preventDefault(); drop.hidden = true; dropFile(e.dataTransfer.files[0]); });
addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) dropFile(f); });
function dropFile(f) { if (!f) return; let i = shapes.findIndex(s => s.name === 'przykład'); if (i < 0) { if (shapes.length < MAX_SHAPES) { shapes.push({ type: 'image', name: '', text: '' }); i = shapes.length - 1; } else i = 0; } loadFileInto(i, f); }

/* ============================================================
   (3) Mask editor: manual polygon + AI cut-out
   ============================================================ */
const mask = { i: -1, pts: [], drag: -1, scale: 1 };
const mcv = $('maskCanvas'), mctx = mcv.getContext('2d');
function openMask(i) {
  const s = shapes[i]; if (!s.img) return;
  mask.i = i; mask.pts = s.poly ? s.poly.map(p => [...p]) : []; mask.ai = s.aiMask || null;
  $('maskModal').hidden = false;
  const wrap = mcv.parentElement.getBoundingClientRect();
  const sc = Math.min(1, (wrap.width - 4) / s.img.width, (wrap.height - 4) / s.img.height);
  mcv.width = Math.round(s.img.width * sc); mcv.height = Math.round(s.img.height * sc);
  drawMask();
}
function drawMask() {
  const s = shapes[mask.i], w = mcv.width, h = mcv.height;
  mctx.clearRect(0, 0, w, h); mctx.drawImage(s.img, 0, 0, w, h);
  mctx.save(); mctx.fillStyle = 'rgba(4,18,26,.62)';
  if (mask.pts.length > 2 || mask.ai) {
    const off = document.createElement('canvas'); off.width = w; off.height = h; const o = off.getContext('2d');
    o.fillStyle = 'rgba(4,18,26,.66)'; o.fillRect(0, 0, w, h); o.globalCompositeOperation = 'destination-out';
    if (mask.ai) o.drawImage(mask.ai, 0, 0, w, h);
    if (mask.pts.length > 2) { if (mask.ai) { /* polygon further restricts: punch only intersection */ } o.beginPath(); mask.pts.forEach(([x, y], k) => k ? o.lineTo(x * w, y * h) : o.moveTo(x * w, y * h)); o.closePath(); if (!mask.ai) o.fill(); }
    mctx.drawImage(off, 0, 0);
  }
  mctx.restore();
  mctx.strokeStyle = '#8ff3e6'; mctx.lineWidth = 2; mctx.beginPath();
  mask.pts.forEach(([x, y], k) => k ? mctx.lineTo(x * w, y * h) : mctx.moveTo(x * w, y * h)); if (mask.pts.length > 2) mctx.closePath(); mctx.stroke();
  mask.pts.forEach(([x, y]) => { mctx.fillStyle = '#04121a'; mctx.beginPath(); mctx.arc(x * w, y * h, 6, 0, 7); mctx.fill(); mctx.strokeStyle = '#8ff3e6'; mctx.stroke(); });
}
function maskPt(e) { const r = mcv.getBoundingClientRect(); return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)]; }
mcv.addEventListener('pointerdown', e => {
  const p = maskPt(e), r = mcv.getBoundingClientRect();
  mask.drag = mask.pts.findIndex(([x, y]) => Math.hypot((x - p[0]) * r.width, (y - p[1]) * r.height) < 12);
  if (mask.drag < 0) { mask.pts.push(p); mask.drag = mask.pts.length - 1; }
  mcv.setPointerCapture(e.pointerId); drawMask();
});
mcv.addEventListener('pointermove', e => { if (mask.drag >= 0 && e.buttons) { mask.pts[mask.drag] = maskPt(e); drawMask(); } });
mcv.addEventListener('pointerup', () => mask.drag = -1);
$('maskUndo').onclick = () => { mask.pts.pop(); drawMask(); };
$('maskClear').onclick = () => { mask.pts = []; mask.ai = null; drawMask(); };
$('maskCancel').onclick = () => { $('maskModal').hidden = true; };
$('maskApply').onclick = () => {
  const s = shapes[mask.i]; s.poly = mask.pts.length > 2 ? mask.pts : null; s.aiMask = mask.ai;
  if (s.poly || s.aiMask) $('bgMode').value = 'none';
  $('maskModal').hidden = true; refreshAllImages(); toast('Obrys zastosowany');
};
$('maskAI').onclick = async () => {
  const s = shapes[mask.i];
  try { await aiCutout(s); mask.ai = s.aiMask; drawMask(); toast('AI wycięło obiekt. Popraw obrysem, jeśli trzeba.'); }
  catch (e) { aiFail(e); }
  finally { busy.hide(); }
};

/* ============================================================
   Real-time recording + PNG
   ============================================================ */
const rec = { mr: null, chunks: [], start: 0, blob: null, ext: 'webm' };
function pickMime() {
  const c = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
function showVideo(blob, ext, note) {
  rec.blob = blob; rec.ext = ext;
  const v = $('preview'); v.src = URL.createObjectURL(blob); v.hidden = false; v.play().catch(() => {});
  $('saveRow').hidden = false;
  $('recNote').innerHTML = note || `Gotowe: <b>${(blob.size / 1048576).toFixed(1)} MB</b>, format ${ext.toUpperCase()}.`;
}
function startRec() {
  if (!window.MediaRecorder) { toast('Ta przeglądarka nie nagrywa wideo z płótna'); return false; }
  const mime = pickMime(); const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  const stream = renderer.domElement.captureStream(60);
  extraAudioTracks().forEach(t => stream.addTrack(t));
  rec.mr = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 18_000_000 });
  rec.chunks = []; rec.mr.ondataavailable = e => e.data.size && rec.chunks.push(e.data);
  rec.mr.onstop = () => {
    showVideo(new Blob(rec.chunks, { type: mime || 'video/webm' }), ext);
    $('recBadge').hidden = true; $('btnRec').textContent = 'Nagrywaj ręcznie'; $('btnRec').classList.remove('live');
  };
  rec.mr.start(200); rec.start = performance.now(); $('recBadge').hidden = false; return true;
}
function stopRec() { if (rec.mr && rec.mr.state !== 'inactive') rec.mr.stop(); }
$('btnRec').onclick = () => {
  if (rec.mr && rec.mr.state === 'recording') { stopRec(); return; }
  if (startRec()) { $('btnRec').textContent = 'Zatrzymaj nagrywanie'; $('btnRec').classList.add('live'); }
};
$('btnSeqRec').onclick = () => { if (rec.mr && rec.mr.state === 'recording') return; if (startRec()) playSeq(() => stopRec()); };
$('btnSaveVid').onclick = () => rec.blob && saveFile(rec.blob, `roj-czasteczek-${Date.now()}.${rec.ext}`);
let wantPng = false; $('btnPng').onclick = () => wantPng = true;

/* ============================================================
   Simulation step (virtual time T) + render
   ============================================================ */
let T = 0;
function tick(dt) {
  T += dt;
  seqTick();
  const dir = Math.sign(anim.morphTarget - anim.morph);
  if (dir) { anim.morph += dir * dt / P.morphTime; if ((anim.morphTarget - anim.morph) * dir < 0) anim.morph = anim.morphTarget; }
  anim.scatter *= Math.exp(-dt * 1.6); if (anim.scatter < 0.002) anim.scatter = 0;
  if (anim.pour > 0) anim.pour = Math.max(0, anim.pour - dt);
  if (ptr.active) { ptr.vel.subVectors(ptr.world, ptr.last).divideScalar(Math.max(dt, 1e-3)); ptr.last.copy(ptr.world); }
  else ptr.vel.multiplyScalar(0.8);
  ptr.energy = Math.min(1, ptr.energy * Math.exp(-dt * 1.2) + ptr.vel.length() * dt * 0.25);
  if (sim) {
    sim.uTime.value = T; sim.uDelta.value = dt; sim.uMorph.value = anim.morph;
    sim.uSpring.value = P.spring; sim.uDamping.value = P.damping; sim.uNoise.value = reduced ? 0 : P.noise;
    sim.uFlight.value = P.flight; sim.uScatter.value = Math.min(1, anim.scatter * 1.4); sim.uWave.value = reduced ? 0 : P.wave;
    sim.uWind.value = P.wind; sim.uGravity.value = P.gravity; sim.uPour.value = anim.pour > 0 ? 1 : 0;
    sim.uPointer.value.copy(ptr.active ? ptr.world : FAR);
    sim.uPointerVel.value.copy(ptr.vel).multiplyScalar(0.02).clampLength(0, 1.5);
    sim.uPointerRadius.value = P.pRadius; sim.uPointerStrength.value = reduced ? 0 : P.pStrength * (0.25 + ptr.energy * 1.8);
    sim.uShock.value *= Math.exp(-dt * 5);
    gpu.compute();
    renderUniforms.tPos.value = gpu.getCurrentRenderTarget(posVar).texture;
    renderUniforms.tVel.value = gpu.getCurrentRenderTarget(velVar).texture;
  }
  renderUniforms.uMorph.value = anim.morph; renderUniforms.uTime.value = T;
  renderUniforms.uSize.value = P.size; renderUniforms.uOpacity.value = P.opacity;
  renderUniforms.uFovK.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  bloomPass.strength = $('bg').value === 'paper' ? 0 : P.bloom;
  bgUniforms.uTime.value = T;
  hooks.tick.forEach(f => f(dt));
  if (controls.enabled) controls.update(dt);
  (hooks.post || []).forEach(f => f(dt));
}
function draw() { composer.render(); hooks.draw.forEach(f => f()); }

