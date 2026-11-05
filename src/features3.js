
/* ============================================================
   (21) Project save / load + settings autosave
   ============================================================ */
hooks.projectApplied = [];
$('btnSaveProj').onclick = async () => {
  busy.show('Projekt', 'Zapisuję zdjęcia i ustawienia…');
  try {
    const pr = await serializeProject();
    const name = (($('ovTitle').value || 'projekt').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/gi, 'l').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projekt');
    saveFile(new Blob([JSON.stringify(pr)], { type: 'application/json' }), `roj-${name}.json`);
  } catch (e) { toast('Zapis nie powiódł się: ' + e.message); }
  finally { busy.hide(); }
};
$('projFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { await applyProject(JSON.parse(await f.text())); toast('Projekt wczytany'); }
  catch (err) { busy.hide(); toast('Nie udało się wczytać projektu: ' + err.message, 5000); }
};
function applyControls(ctl) {
  Object.entries(ctl || {}).forEach(([id, v]) => { const el = $(id); if (!el || el.type === 'file') return; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; if (el.type === 'range') el.dispatchEvent(new Event('input')); });
  if (+$('count').value !== SIZE) { SIZE = +$('count').value; buildSim('still'); } else refreshAllImages();
  applyLook(); applyTrans(); resize(); controls.autoRotate = $('autoRot').checked;
  hooks.projectApplied.forEach(f => f());
}
let autosaveSnap = '';
setInterval(() => {
  if (rendering) return;
  const snap = JSON.stringify({ controls: Object.fromEntries(controlIds().map(id => [id, getCtl(id)])), steps });
  if (snap === autosaveSnap) return; autosaveSnap = snap;
  try { localStorage.setItem('roj-autosave', snap); } catch {}
}, 4000);
(() => { try { const s = localStorage.getItem('roj-autosave'); if (s) { $('btnRestore').hidden = false; $('btnRestore').onclick = () => { const o = JSON.parse(s); steps = o.steps || steps; renderSteps(); applyControls(o.controls); toast('Przywrócono ostatnie ustawienia'); }; } } catch {} })();

/* ============================================================
   (22) Auto performance: fewer particles when the device can't keep up
   ============================================================ */
const COUNTS = [128, 256, 320, 400, 512];
const perf = { t0: performance.now(), frames: 0, low: 0, high: 0, userSize: SIZE };
$('count').addEventListener('change', () => { perf.userSize = +$('count').value; });
hooks.tick.push(() => {
  const busyNow = rendering || loop.paused || seq.playing || (rec.mr && rec.mr.state === 'recording') || document.hidden;
  if (busyNow || !$('autoPerf').checked || T < 6) { perf.t0 = performance.now(); perf.frames = 0; return; }   // ignore the loading burst
  perf.frames++;
  const el = performance.now() - perf.t0; if (el < 2500) return;
  const fps = perf.frames * 1000 / el; perf.t0 = performance.now(); perf.frames = 0;
  const i = COUNTS.indexOf(SIZE);
  if (fps < 24 && i > 0) { if (++perf.low >= 2) { perf.low = 0; changeCount(COUNTS[i - 1], fps); } } else perf.low = 0;
  if (fps > 57 && SIZE < perf.userSize && i < COUNTS.length - 1) { if (++perf.high >= 3) { perf.high = 0; changeCount(COUNTS[i + 1], fps); } } else perf.high = 0;
});
function changeCount(n, fps) {
  SIZE = n; $('count').value = String(n); buildSim('still'); applyTrans();
  toast(`Auto-wydajność: ${Math.round(fps)} kl./s → ${(n * n).toLocaleString('pl-PL')} cząsteczek`);
}

/* ============================================================
   (23) Safe zones for Reels / TikTok (preview only, never recorded)
   ============================================================ */
function updateSafe() {
  const on = $('safeZones').checked && $('frame').value === '9:16' && !document.querySelector('.app').classList.contains('embed-mode');
  const el = $('safe'); el.hidden = !on; if (!on) return;
  const c = renderer.domElement; Object.assign(el.style, { left: c.style.left, top: c.style.top, width: c.style.width, height: c.style.height });
}
['safeZones', 'frame'].forEach(id => $(id).addEventListener('change', () => setTimeout(updateSafe, 0)));
new ResizeObserver(() => setTimeout(updateSafe, 0)).observe(stage);

/* ============================================================
   (24) Photo → swarm: the real photo dissolves into particles and back
   ============================================================ */
function photoCanvasFor(s) {
  const { w, h } = shapePixels(s, 1400);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(work, 0, 0); return c;
}
const photo = { v: 0, target: 0, flat: 0, flatTarget: 0, formAt: -1, mesh: null, tex: null, key: null };
const photoMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uPhoto: { value: 0 } }, transparent: true, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D map; uniform float uPhoto; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
    void main(){ vec4 c=texture2D(map,vUv);
      float n=vn(vUv*9.)*.55+vn(vUv*31.)*.3+h(vUv*700.)*.15;
      float th=1.-uPhoto, a=smoothstep(th,th+.035,n);
      float edge=a-smoothstep(th+.035,th+.11,n);
      vec3 col=c.rgb+vec3(1.,.78,.45)*edge*1.8*step(uPhoto,.995);
      gl_FragColor=vec4(col,c.a*a); }`
});
function ensurePhotoMesh() {
  const i = shownIdx(), d = shapes[i].data;
  if (!d || !d.photo) return false;
  if (photo.key !== d) {
    photo.key = d;
    photo.tex?.dispose(); photo.tex = new THREE.CanvasTexture(d.photo); photo.tex.colorSpace = THREE.SRGBColorSpace;
    photoMat.uniforms.map.value = photo.tex;
    if (photo.mesh) { scene.remove(photo.mesh); photo.mesh.geometry.dispose(); }
    photo.mesh = new THREE.Mesh(new THREE.PlaneGeometry(d.sx, d.sy), photoMat); photo.mesh.renderOrder = -1; scene.add(photo.mesh);
  }
  return true;
}
function photoShow() { fromIdx = toIdx; uploadPair(); anim.morph = anim.morphTarget = 1; if (!ensurePhotoMesh()) { toast('Krok „zdjęcie” wymaga kształtu ze zdjęciem'); return; } photo.v = photo.target = 1; photo.flat = photo.flatTarget = 1; reform('still'); }
function photoBreak() { photo.target = 0; photo.formAt = -1; photo.flatTarget = 0; anim.scatter = Math.max(anim.scatter, 0.35); }
function photoForm() { if (!ensurePhotoMesh()) { toast('Krok „zdjęcie” wymaga kształtu ze zdjęciem'); return; } photo.flatTarget = 1; photo.formAt = T + 1.2; }
hooks.tick.push(dt => {
  if (photo.formAt > 0 && T >= photo.formAt) { photo.formAt = -1; ensurePhotoMesh(); photo.target = 1; }
  photo.v += Math.sign(photo.target - photo.v) * Math.min(Math.abs(photo.target - photo.v), dt / 1.3);
  photo.flat += Math.sign(photo.flatTarget - photo.flat) * Math.min(Math.abs(photo.flatTarget - photo.flat), dt / (photo.flatTarget ? 0.7 : 1.6));
  if (sim) sim.uFlat.value = photo.flat;
  renderUniforms.uHide.value = Math.pow(photo.v, 1.5);
  photoMat.uniforms.uPhoto.value = photo.v;
  if (photo.mesh) photo.mesh.visible = photo.v > 0.002;
});

/* ============================================================
   (26) Resin recolouring (wood stays, resin changes colour)
   ============================================================ */
const RESINS = [['Czarna', '#0b0b0d'], ['Turkus', '#0fa3a0'], ['Szmaragd', '#157a4a'], ['Granat', '#13306b'], ['Bursztyn', '#c7741b'], ['Rubin', '#8e1830'], ['Perła', '#e8e6df']];
const resin = { mix: 0, target: new THREE.Color($('resinColor').value) };
function rgb2hsv(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; } return [h, mx ? d / mx : 0, mx]; }
function resinClassifier() {
  if (!$('resinOn').checked) return null;
  const wc = new THREE.Color($('woodColor').value); const [hw, sw, vw] = rgb2hsv(...wc.convertLinearToSRGB().toArray());
  const edge = P.resinEdge;
  return (r, g, b) => {
    const [h, s, v] = rgb2hsv(r, g, b);
    let dh = Math.abs(h - hw); dh = Math.min(dh, 1 - dh) * 2;
    const d = Math.sqrt(dh * dh * 1.4 + (s - sw) * (s - sw) * 0.35 + (v - vw) * (v - vw) * 1.1);
    const glare = s < 0.12 && v > 0.85 ? 1 : 0;
    return (1 - glare) * smooth(edge, edge + 0.12, d);
  };
}
function setResinTarget(hex) { resin.target.set(hex); $('resinColor').value = hex; markSwatch(hex); }
function markSwatch(hex) { [...$('resinSwatches').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.c === hex)); }
$('resinSwatches').innerHTML = RESINS.map(([n, c]) => `<button type="button" data-c="${c}" style="background:${c}" title="${n}" aria-label="Żywica: ${n}" aria-pressed="false"></button>`).join('');
$('resinSwatches').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (!$('resinOn').checked) { $('resinOn').checked = true; refreshAllImages(); } setResinTarget(b.dataset.c); };
$('resinColor').addEventListener('input', () => setResinTarget($('resinColor').value));
let resinT;
['resinOn', 'woodColor', 'resinEdge'].forEach(id => $(id).addEventListener(id === 'resinOn' ? 'change' : 'input', () => { clearTimeout(resinT); resinT = setTimeout(refreshAllImages, 200); }));
hooks.tick.push(dt => {
  const want = $('resinOn').checked ? P.resinMix : 0;
  resin.mix += (want - resin.mix) * Math.min(1, dt * 4);
  renderUniforms.uResinMix.value = resin.mix;
  renderUniforms.uResinColor.value.lerp(resin.target, Math.min(1, dt * 2.6));
});

/* timeline actions for (24) and (26) */
Object.assign(ACTS, { 'photo-show': 'Pokaż zdjęcie', 'photo-break': 'Rozbij zdjęcie', 'photo-form': 'Złóż w zdjęcie', resin: 'Kolor żywicy' });
hooks.args.resin = () => RESINS.map(([n, c]) => [c, n]);
hooks.step.push(s => {
  if (s.act === 'photo-show') photoShow();
  else if (s.act === 'photo-break') photoBreak();
  else if (s.act === 'photo-form') photoForm();
  else if (s.act === 'resin') { if (!$('resinOn').checked) { $('resinOn').checked = true; refreshAllImages(); } setResinTarget(s.arg || RESINS[1][1]); }
});
hooks.seqStart.push(() => { photo.v = photo.target = 0; photo.flat = photo.flatTarget = 0; photo.formAt = -1; });
const firstImageIdx = () => Math.max(0, shapes.findIndex(s => s.type === 'image' && s.img));
$('btnSeqPhoto').onclick = () => {
  const i = firstImageIdx(), other = shapes.findIndex((s, k) => k !== i);
  steps = [{ t: 0, act: 'goto', arg: i }, { t: 0.05, act: 'photo-show', arg: '' }, { t: 1.6, act: 'photo-break', arg: '' }];
  if (other >= 0) steps.push({ t: 4.6, act: 'goto', arg: other }, { t: 8, act: 'goto', arg: i });
  steps.push({ t: other >= 0 ? 10.8 : 6, act: 'photo-form', arg: '' });
  setRange('seqTail', 2.6); renderSteps(); toast('Szablon: zdjęcie → rój → zdjęcie');
};
$('btnSeqResin').onclick = () => {
  const i = firstImageIdx();
  steps = [{ t: 0, act: 'reform', arg: 'cloud' }, { t: 0.1, act: 'goto', arg: i }, { t: 3.5, act: 'resin', arg: '#0fa3a0' }, { t: 6, act: 'resin', arg: '#c7741b' }, { t: 8.5, act: 'resin', arg: '#157a4a' }, { t: 11, act: 'resin', arg: '#0b0b0d' }];
  if (!$('resinOn').checked) { $('resinOn').checked = true; refreshAllImages(); }
  setRange('seqTail', 2.5); renderSteps(); toast('Szablon: przegląd kolorów żywicy');
};

/* (25) perfect loop options for the renderer */
renderOpts = () => $('loopOn').checked ? { preroll: 2.5, loopK: Math.round(0.6 * (+$('rFps').value || 30)), noReform: true } : {};

/* ============================================================
   (27) A/B variants → ZIP
   ============================================================ */
const VARIANTS = [
  { key: 'A', label: 'wir + najazd', trans: '0', camMove: 'dolly', start: 'cloud' },
  { key: 'B', label: 'odłamki + obrót 360°', trans: '4', camMove: 'orbit', start: 'pour', resin: '#0fa3a0' },
  { key: 'C', label: 'fala + przelot', trans: '1', camMove: 'fly', start: 'photo', resin: '#c7741b' },
  { key: 'D', label: 'piasek + wznoszenie', trans: '2', camMove: 'rise', start: 'floor', resin: '#157a4a' },
  { key: 'E', label: 'rozpuszczanie + vertigo', trans: '3', camMove: 'vertigo', start: 'cloud', resin: '#13306b' },
];
$('btnAB').onclick = async () => {
  const n = +$('abCount').value, saved = { ctl: Object.fromEntries(controlIds().map(id => [id, getCtl(id)])), steps: JSON.parse(JSON.stringify(steps)) };
  const hasPhoto = shapes.some(s => s.type === 'image' && s.img);
  const files = {}, readme = ['Warianty do testu A/B (Rój Cząsteczek)', ''];
  try {
    for (const v of VARIANTS.slice(0, n)) {
      steps = JSON.parse(JSON.stringify(saved.steps));
      $('trans').value = v.trans; applyTrans(); $('camMove').value = v.camMove;
      const start = v.start === 'photo' && !hasPhoto ? 'cloud' : v.start;
      if (start === 'photo') steps = [{ t: 0, act: 'goto', arg: firstImageIdx() }, { t: 0.05, act: 'photo-show', arg: '' }, { t: 1.4, act: 'photo-break', arg: '' }, ...steps.filter(s => s.act !== 'reform').map(s => ({ ...s, t: s.t + 1.4 }))];
      else { const r = steps.find(s => s.act === 'reform'); if (r) r.arg = start; else steps.unshift({ t: 0, act: 'reform', arg: start }); }
      if (v.resin && hasPhoto) { $('resinOn').checked = true; refreshAllImages(); setResinTarget(v.resin); resin.mix = P.resinMix; renderUniforms.uResinColor.value.set(v.resin); }
      else { $('resinOn').checked = saved.ctl.resinOn; }
      toast(`Wariant ${v.key}: ${v.label}`);
      const b = await renderOffline('mp4', renderOpts()); if (!b) break;
      const fname = `wariant-${v.key}.mp4`;
      files[fname] = new Uint8Array(await b.arrayBuffer());
      readme.push(`${fname}: przejście ${v.label}, start: ${({ cloud: 'z chmury', pour: 'wylewanie', floor: 'z podłogi', photo: 'prawdziwe zdjęcie' })[start]}${v.resin && hasPhoto ? ', kolor żywicy ' + RESINS.find(r => r[1] === v.resin)?.[0] : ''}`);
    }
  } finally {
    steps = saved.steps; renderSteps(); applyControls(saved.ctl); if ($('resinOn').checked) setResinTarget($('resinColor').value);
  }
  if (!Object.keys(files).length) return;
  readme.push('', 'Jak testować: wrzuć wszystkie warianty do jednego zestawu reklam z tym samym tekstem i budżetem; po 3–5 dniach zostaw ten z najniższym kosztem kliknięcia.');
  files['README.txt'] = new TextEncoder().encode(readme.join('\n'));
  const { zipSync } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
  saveFile(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), `roj-warianty-ab-${Object.keys(files).length - 1}.zip`);
};

/* ============================================================
   (28) Voice-over track (mixed into the MP4 with music ducking)
   ============================================================ */
$('voiceFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    audio.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    voice.buf = await audio.ctx.decodeAudioData(await f.arrayBuffer());
    $('voiceName').textContent = f.name.slice(0, 24) + ` · ${voice.buf.duration.toFixed(1)} s`; $('voiceClear').disabled = false;
    toast('Lektor dodany: trafi do renderu MP4');
  } catch { toast('Nie udało się odczytać nagrania lektora'); }
};
$('voiceClear').onclick = () => { voice.buf = null; $('voiceName').textContent = 'brak pliku'; $('voiceClear').disabled = true; };

/* ============================================================
   (29) Watermark burned into the frame
   ============================================================ */
overlayDrawers.push({
  active: () => $('wmOn').checked && $('wmText').value.trim(),
  draw: (x, w, h) => {
    const txt = $('wmText').value.trim(), a = P.wmAlpha;
    x.save(); x.fillStyle = '#ffffff'; x.globalAlpha = a; x.textBaseline = 'middle';
    if ($('wmStyle').value === 'tile') {
      const fs = Math.round(Math.min(w, h) * 0.04); x.font = `700 ${fs}px Manrope, "Segoe UI", sans-serif`;
      const step = x.measureText(txt).width + fs * 3;
      x.translate(w / 2, h / 2); x.rotate(-Math.PI / 7);
      const R = Math.hypot(w, h);
      for (let yy = -R; yy < R; yy += fs * 4) for (let xx = -R + ((yy / (fs * 4)) % 2) * step / 2; xx < R; xx += step) x.fillText(txt, xx, yy);
    } else {
      const fs = Math.round(Math.min(w, h) * 0.026); x.font = `600 ${fs}px Manrope, "Segoe UI", sans-serif`;
      x.globalAlpha = Math.min(1, a * 3); x.textAlign = 'left'; x.fillText(txt, Math.min(w, h) * 0.045, h - Math.min(w, h) * 0.045);
    }
    x.restore();
  }
});

/* ============================================================
   (30) White-label: your client's name and colour in the app
   ============================================================ */
function applyBrand() {
  const name = $('appName').value.trim() || 'Rój Cząsteczek';
  $('brandName').textContent = name; document.title = name;
  document.documentElement.style.setProperty('--glow', $('appAccent').value);
}
['appName', 'appAccent'].forEach(id => $(id).addEventListener('input', applyBrand));
hooks.projectApplied.push(applyBrand, () => { if ($('resinOn').checked) setResinTarget($('resinColor').value); updateSafe(); });
