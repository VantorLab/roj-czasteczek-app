
/* ============================================================
   (11) Music: bass envelope, beats, pulse, beat-synced morphs
   ============================================================ */
const ENV_HZ = 60;
const audio = { file: null, el: null, buf: null, env: null, beats: [], ctx: null, dest: null, offline: false, t0: 0, lastT: -1, lastBeatMorph: -9 };
async function loadAudio(file) {
  try {
    busy.show('Muzyka', 'Analizuję rytm…');
    audio.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    const arr = await file.arrayBuffer();
    audio.buf = await audio.ctx.decodeAudioData(arr.slice(0));
    const sr = 22050, off = new OfflineAudioContext(1, Math.ceil(audio.buf.duration * sr), sr);
    const src = off.createBufferSource(); src.buffer = audio.buf;
    const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    src.connect(lp); lp.connect(off.destination); src.start();
    const low = (await off.startRendering()).getChannelData(0);
    const win = Math.floor(sr / ENV_HZ), n = Math.floor(low.length / win), env = new Float32Array(n);
    let mx = 1e-6;
    for (let i = 0; i < n; i++) { let a = 0; for (let k = 0; k < win; k++) { const v = low[i * win + k]; a += v * v; } env[i] = Math.sqrt(a / win); if (env[i] > mx) mx = env[i]; }
    for (let i = 0; i < n; i++) env[i] = env[i] / mx;
    for (let i = 1; i < n; i++) env[i] = Math.max(env[i], env[i - 1] * 0.9);   // fast attack, smooth release
    const beats = []; let avg = env[0] || 0, last = -1;
    for (let i = 1; i < n; i++) {
      avg = avg * 0.985 + env[i] * 0.015;
      if (env[i] > 0.3 && env[i] > avg * 1.3 && env[i] > env[i - 1] && i / ENV_HZ - last > 0.4) { beats.push(i / ENV_HZ); last = i / ENV_HZ; }
    }
    audio.env = env; audio.beats = beats; audio.file = file;
    if (audio.el) audio.el.pause();
    audio.el = new Audio(URL.createObjectURL(file));
    const node = audio.ctx.createMediaElementSource(audio.el);
    audio.dest = audio.ctx.createMediaStreamDestination();
    node.connect(audio.ctx.destination); node.connect(audio.dest);
    audio.el.onended = () => $('audioPlay').textContent = 'Odtwórz';
    $('audioName').textContent = file.name.slice(0, 28) + ` · ${audio.buf.duration.toFixed(1)} s`;
    $('beatCount').textContent = beats.length;
    $('audioPlay').disabled = $('audioClear').disabled = false;
    drawWave();
    toast(`Muzyka gotowa: ${beats.length} uderzeń`);
  } catch (e) { console.warn(e); toast('Nie udało się odczytać pliku audio'); }
  finally { busy.hide(); }
}
function drawWave() {
  const c = $('audioWave'), x = c.getContext('2d'); c.width = c.clientWidth * (devicePixelRatio || 1); c.height = 56 * (devicePixelRatio || 1);
  x.clearRect(0, 0, c.width, c.height); if (!audio.env) return;
  x.fillStyle = '#86a7ab';
  const n = audio.env.length;
  for (let px = 0; px < c.width; px++) { const v = audio.env[Math.floor(px / c.width * n)]; const h = v * c.height * 0.9; x.fillRect(px, (c.height - h) / 2, 1, h); }
  x.fillStyle = '#8ff3e6';
  audio.beats.forEach(b => x.fillRect(b / (n / ENV_HZ) * c.width, 0, 1, c.height));
}
function audioTime() {
  if (!audio.env) return null;
  if (audio.offline) return T - audio.t0;
  if (audio.el && !audio.el.paused) return audio.el.currentTime;
  return null;
}
function audioLevelAt(t) { if (!audio.env || t == null || t < 0) return 0; return audio.env[Math.min(audio.env.length - 1, Math.floor(t * ENV_HZ))] || 0; }
function extraAudioTracks() { return audio.dest && $('audioInSeq').checked ? audio.dest.stream.getAudioTracks() : []; }
hooks.tick.push(() => {
  const t = audioTime(), lvl = audioLevelAt(t) * P.pulse;
  if (sim) sim.uPulse.value = reduced ? 0 : lvl;
  renderUniforms.uSizeBoost.value = 1 + lvl * 0.35;
  bloomPass.strength += lvl * 0.3;
  if (t != null && $('beatMorph').checked && shapes.length > 1) {
    const prev = audio.lastT;
    if (audio.beats.some(b => b > prev && b <= t) && T - audio.lastBeatMorph > Math.max(0.8, P.morphTime * 0.7)) { audio.lastBeatMorph = T; goTo((shownIdx() + 1) % shapes.length); }
  }
  audio.lastT = t == null ? -1 : t;
});
hooks.seqStart.push(() => { audio.lastT = -1; if (!audio.offline && audio.el && $('audioInSeq').checked) { audio.ctx.resume(); audio.el.currentTime = 0; audio.el.play(); $('audioPlay').textContent = 'Pauza'; } });
hooks.seqStop.push(() => { if (!audio.offline && audio.el && $('audioInSeq').checked) { audio.el.pause(); $('audioPlay').textContent = 'Odtwórz'; } });
$('audioFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadAudio(f); };
$('audioPlay').onclick = () => { if (!audio.el) return; audio.ctx.resume(); if (audio.el.paused) { audio.el.play(); $('audioPlay').textContent = 'Pauza'; } else { audio.el.pause(); $('audioPlay').textContent = 'Odtwórz'; } };
$('audioClear').onclick = () => { if (audio.el) audio.el.pause(); Object.assign(audio, { file: null, el: null, buf: null, env: null, beats: [], dest: null }); $('audioName').textContent = 'brak pliku'; $('beatCount').textContent = 0; $('audioPlay').disabled = $('audioClear').disabled = true; drawWave(); };

/* ============================================================
   (12) Hand control via MediaPipe (camera)
   ============================================================ */
const hand = { on: false, lm: null, stream: null, lastPinch: 0, prev: null };
$('handBtn').onclick = async () => {
  if (hand.on) { stopHand(); return; }
  try {
    busy.show('Sterowanie dłonią', 'Uruchamiam kamerę i model dłoni…');
    hand.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
    const v = $('handVideo'); v.srcObject = hand.stream; v.hidden = false; await v.play();
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    const fs = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    hand.lm = await vision.HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 });
    hand.on = true; $('handBtn').textContent = 'Wyłącz sterowanie dłonią'; $('handBtn').classList.add('live');
    toast('Pokaż dłoń do kamery');
  } catch (e) {
    console.warn(e); stopHand();
    toast(e?.name === 'NotAllowedError' || e?.name === 'NotFoundError' ? 'Brak dostępu do kamery. W podglądzie Claude kamera jest zablokowana: otwórz plik HTML w przeglądarce.' : 'Nie udało się uruchomić sterowania dłonią.', 6000);
  } finally { busy.hide(); }
};
function stopHand() {
  hand.on = false; hand.stream?.getTracks().forEach(t => t.stop()); hand.stream = null;
  $('handVideo').hidden = true; $('handBtn').textContent = 'Włącz kamerę i steruj dłonią'; $('handBtn').classList.remove('live');
  ptr.active = false; ptr.world.copy(FAR);
}
hooks.tick.push(() => {
  if (!hand.on || !hand.lm) return;
  const v = $('handVideo'); if (v.readyState < 2) return;
  const res = hand.lm.detectForVideo(v, performance.now());
  const lm = res.landmarks?.[0];
  if (!lm) { ptr.active = false; ptr.world.copy(FAR); return; }
  const tip = lm[8], thumb = lm[4];
  const r = renderer.domElement.getBoundingClientRect();
  const fake = { clientX: r.left + (1 - tip.x) * r.width, clientY: r.top + tip.y * r.height };
  const w = pointerWorld(fake);
  if (w) { if (!ptr.active) { ptr.last.copy(w); ptr.active = true; } ptr.world.copy(w); }
  const pinch = Math.hypot(tip.x - thumb.x, tip.y - thumb.y) < 0.05;
  if (pinch && performance.now() - hand.lastPinch > 600 && w) { hand.lastPinch = performance.now(); shock(w); }
});

/* ============================================================
   (13) Client kiosk mode + QR code
   ============================================================ */
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function drawQR(text) {
  if (!window.qrcode) await loadScript('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js');
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), c = $('qrCanvas'), x = c.getContext('2d'), m = 2, cell = Math.floor(c.width / (n + m * 2));
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#04121a';
  const off = (c.width - cell * n) / 2;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect(off + k * cell, off + r * cell, cell, cell);
}
$('kioskBtn').onclick = async () => {
  document.querySelector('.app').classList.add('kiosk-mode'); $('kiosk').hidden = false;
  try { await drawQR(location.href); } catch { document.querySelector('.kiosk-qr').hidden = true; }
};
$('kioskExit').onclick = () => { document.querySelector('.app').classList.remove('kiosk-mode'); $('kiosk').hidden = true; };
$('kioskFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  await loadImageToShape(0, f); fromIdx = toIdx = 0; uploadPair(); anim.morph = anim.morphTarget = 1; reform('pour');
};
function fileToImage(file) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); }); }
async function loadImageToShape(i, file) {
  const img = await fileToImage(file), s = shapes[i];
  Object.assign(s, { type: 'image', img, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18), fileName: file.name, poly: null, aiMask: null, depthMap: null });
  if ($('depthMode').value === 'ai') { try { await aiDepth(s); } catch (e) { aiFail(e); } finally { busy.hide(); } }
  refreshShape(i); renderShapeCards();
}

/* ============================================================
   (15) Overlay: title, subtitle/price, CTA, logo  (+29 watermark later)
   ============================================================ */
const ov = { canvas: document.createElement('canvas'), logo: null };
ov.ctx = ov.canvas.getContext('2d');
ov.tex = new THREE.CanvasTexture(ov.canvas); ov.tex.colorSpace = THREE.SRGBColorSpace;
const ovScene = new THREE.Scene(), ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const ovMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ov.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
ovMesh.frustumCulled = false; ovScene.add(ovMesh);
const overlayDrawers = [];   // extra layers (watermark, safe zones…) register here
function roundRect(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function drawOverlay(x, w, h, alpha) {
  if ($('ovOn').checked && alpha > 0) {
    const k = Math.min(w, h * 0.75) / 1080 * P.ovSize, pad = w * 0.07;
    const tFs = 76 * k, sFs = 40 * k, cFs = 36 * k;
    const blockH = tFs * 1.15 + sFs * 1.5 + cFs * 2.6;
    const pos = $('ovPos').value;
    let y = pos === 'top' ? h * 0.12 : pos === 'center' ? (h - blockH) / 2 : h * 0.80 - blockH;
    x.save(); x.globalAlpha = alpha; x.textBaseline = 'top'; x.textAlign = 'center';
    x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 18 * k;
    x.fillStyle = $('ovColor').value;
    x.font = `800 ${tFs}px "Bricolage Grotesque", "Arial Black", sans-serif`;
    const title = $('ovTitle').value; x.fillText(title, w / 2, y, w - pad * 2); y += tFs * 1.15;
    x.font = `600 ${sFs}px Manrope, "Segoe UI", sans-serif`; x.globalAlpha = alpha * 0.92;
    x.fillText($('ovSub').value, w / 2, y, w - pad * 2); y += sFs * 1.5;
    const cta = $('ovCta').value;
    if (cta) {
      x.globalAlpha = alpha; x.shadowBlur = 0;
      x.font = `700 ${cFs}px Manrope, "Segoe UI", sans-serif`;
      const tw = Math.min(x.measureText(cta).width, w - pad * 2), bw = tw + cFs * 1.6, bh = cFs * 1.9;
      x.fillStyle = $('ovCtaBg').value; roundRect(x, (w - bw) / 2, y, bw, bh, bh / 2); x.fill();
      const c = new THREE.Color($('ovCtaBg').value); const lum = .299 * c.r + .587 * c.g + .114 * c.b;
      x.fillStyle = lum > 0.55 ? '#111' : '#fff'; x.textBaseline = 'middle'; x.fillText(cta, w / 2, y + bh / 2 + 1, w - pad * 2);
    }
    x.restore();
  }
  if (ov.logo) {
    const lw = w * P.logoSize, lh = lw * ov.logo.height / ov.logo.width, m = Math.min(w, h) * 0.045, p = $('logoPos').value;
    const lx = p.includes('l') ? m : w - m - lw, ly = p.includes('t') ? m : h - m - lh;
    x.save(); x.globalAlpha = 0.95; x.drawImage(ov.logo, lx, ly, lw, lh); x.restore();
  }
}
function overlayAlpha() {
  if (!seq.playing) return 1;
  const t = T - seq.t0; return smooth(P.ovFrom, P.ovFrom + 0.6, t);
}
hooks.draw.push(() => {
  const any = $('ovOn').checked || ov.logo || overlayDrawers.some(d => d.active());
  if (!any) return;
  const w = Math.round(view.w * view.pr), h = Math.round(view.h * view.pr);
  if (ov.canvas.width !== w || ov.canvas.height !== h) { ov.canvas.width = w; ov.canvas.height = h; ov.tex.dispose(); }
  ov.ctx.clearRect(0, 0, w, h);
  drawOverlay(ov.ctx, w, h, overlayAlpha());
  overlayDrawers.forEach(d => d.active() && d.draw(ov.ctx, w, h));
  ov.tex.needsUpdate = true;
  renderer.autoClear = false; renderer.render(ovScene, ovCam); renderer.autoClear = true;
});
$('logoFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { ov.logo = await fileToImage(f); ov.logoFile = f; $('logoClear').disabled = false; toast('Logo dodane'); } catch { toast('Nie udało się odczytać logo'); } };
$('logoClear').onclick = () => { ov.logo = null; ov.logoFile = null; $('logoClear').disabled = true; };

/* ============================================================
   (14)(19) Offline frame-perfect renderer → MP4 (WebCodecs) or GIF
   ============================================================ */
let rendering = false;
function renderDims(kind) {
  const ar = FR[$('frame').value] || 16 / 9;
  const base = kind === 'gif' ? 480 : +$('rRes').value;
  let w, h; if (ar >= 1) { h = base; w = Math.round(base * ar); } else { w = base; h = Math.round(base / ar); }
  return [w - w % 2, h - h % 2];
}
async function pickVideoCodec(w, h, fps, bitrate) {
  if (!window.VideoEncoder) return null;
  const c = [['avc', 'avc1.640034'], ['avc', 'avc1.640033'], ['avc', 'avc1.640028'], ['avc', 'avc1.4d0034'], ['avc', 'avc1.42003e'], ['vp9', 'vp09.00.51.08'], ['vp9', 'vp09.00.41.08']];
  for (const [mux, codec] of c) {
    const cfg = { codec, width: w, height: h, bitrate, framerate: fps, ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) return { mux, cfg }; } catch {}
  }
  return null;
}
async function audioForRender(dur) {
  const music = audio.buf && $('audioInSeq').checked ? audio.buf : null, vbuf = voice.buf;
  if (!music && !vbuf) return null;
  const sr = 48000, ch = 2;
  const off = new OfflineAudioContext(ch, Math.ceil(dur * sr), sr);
  const master = off.createGain(); master.connect(off.destination);
  master.gain.setValueAtTime(1, Math.max(0, dur - 0.6)); master.gain.linearRampToValueAtTime(0, dur);
  if (music) {
    const src = off.createBufferSource(); src.buffer = music; const g = off.createGain(); src.connect(g); g.connect(master); src.start();
    if (vbuf) {   // (28) duck the music under the voice-over
      const a = P.voiceAt, b = P.voiceAt + vbuf.duration, low = 1 - P.duck;
      g.gain.setValueAtTime(1, Math.max(0, a - 0.3)); g.gain.linearRampToValueAtTime(low, a); g.gain.setValueAtTime(low, b); g.gain.linearRampToValueAtTime(1, b + 0.4);
    }
  }
  if (vbuf) { const v = off.createBufferSource(); v.buffer = vbuf; v.connect(master); v.start(P.voiceAt); }
  const buf = await off.startRendering();
  for (const codec of ['mp4a.40.2', 'opus']) {
    const cfg = { codec, sampleRate: sr, numberOfChannels: ch, bitrate: 192000 };
    try { if (window.AudioEncoder && (await AudioEncoder.isConfigSupported(cfg)).supported) return { buf, cfg, mux: codec === 'opus' ? 'opus' : 'aac' }; } catch {}
  }
  return null;
}
const voice = { buf: null };
const yieldUI = () => new Promise(r => setTimeout(r, 0));

/* Renders the current sequence. Returns a Blob, or null when cancelled/unsupported. */
async function renderOffline(kind = 'mp4', opts = {}) {
  if (rendering) return null;
  rendering = true;
  const fps = kind === 'gif' ? 15 : +$('rFps').value;
  const simFps = kind === 'gif' ? 30 : fps, every = simFps / fps;
  const [w, h] = renderDims(kind);
  const dur = seqDuration() + (opts.preroll || 0), frames = Math.ceil(seqDuration() * fps);
  const saved = { w: view.w, h: view.h, pr: view.pr, pos: camera.position.clone(), fov: camera.fov };
  let blob = null;
  try {
    loop.paused = true; ptr.active = false; ptr.world.copy(FAR);
    busy.show(kind === 'gif' ? 'Render GIF' : 'Render MP4', `${w}×${h}, ${fps} kl./s`, 0);
    setRenderSize(w, h, 1, false);
    camera.position.setLength(fitCameraDistance());
    fromIdx = toIdx = 0; uploadPair(); anim.morph = anim.morphTarget = 1; anim.scatter = 0;
    let enc, muxer, target, aEnc, gif, g2;
    if (kind === 'mp4') {
      const mbps = (w * h >= 3840 * 2000 ? 45 : w * h >= 1900 * 1000 ? 16 : 8) * (fps > 30 ? 1.5 : 1);
      const vc = await pickVideoCodec(w, h, fps, mbps * 1e6);
      if (!vc) { toast('Ta przeglądarka nie koduje wideo klatka po klatce. Użyj „Nagraj sekwencję” albo Chrome/Edge.', 6000); return null; }
      const ac = await audioForRender(seqDuration());
      const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs');
      target = new ArrayBufferTarget();
      muxer = new Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset', video: { codec: vc.mux, width: w, height: h, frameRate: fps }, ...(ac ? { audio: { codec: ac.mux, numberOfChannels: ac.cfg.numberOfChannels, sampleRate: ac.cfg.sampleRate } } : {}) });
      enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => console.warn(e) });
      enc.configure(vc.cfg);
      if (ac) {
        aEnc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => console.warn(e) });
        aEnc.configure(ac.cfg);
        const ch = ac.cfg.numberOfChannels, len = ac.buf.length, step = 1024;
        for (let i = 0; i < len; i += step) {
          const k = Math.min(step, len - i), data = new Float32Array(k * ch);
          for (let c = 0; c < ch; c++) data.set(ac.buf.getChannelData(c).subarray(i, i + k), c * k);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: ac.cfg.sampleRate, numberOfFrames: k, numberOfChannels: ch, timestamp: Math.round(i / ac.cfg.sampleRate * 1e6), data });
          aEnc.encode(ad); ad.close();
        }
      }
    } else {
      const { GIFEncoder } = await import('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js');
      gif = GIFEncoder(); g2 = document.createElement('canvas'); g2.width = w; g2.height = h;
    }
    const gifLib = kind === 'gif' ? await import('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js') : null;
    audio.offline = true; audio.t0 = T; audio.lastT = -1;
    if (opts.beforePlay) await opts.beforePlay();
    // optional pre-roll (perfect loop): settle the swarm before frame 0
    if (opts.preroll) { const n = Math.round(opts.preroll * simFps); for (let i = 0; i < n; i++) tick(1 / simFps); audio.t0 = T; }
    seq.noReform = !!opts.noReform;
    playSeq();
    // (25) perfect loop: render K extra frames, drop the first K, cross-fade the last K into them
    const K = opts.loopK || 0, total = frames + K, head = [];
    const blend = document.createElement('canvas'); blend.width = w; blend.height = h; const bctx = blend.getContext('2d');
    for (let f = 0, sf = 0, out = 0; f < total; sf++) {
      tick(1 / simFps);
      if (sf % every !== 0) continue;
      draw();
      if (f < K) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h); head.push(c); f++; continue; }
      let src = renderer.domElement;
      if (K && f >= total - K) { const i = f - (total - K); bctx.globalAlpha = 1; bctx.drawImage(renderer.domElement, 0, 0, w, h); bctx.globalAlpha = (i + 1) / (K + 1); bctx.drawImage(head[i], 0, 0, w, h); src = blend; }
      if (kind === 'mp4') {
        const vf = new VideoFrame(src, { timestamp: Math.round(out * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: out % (fps * 2) === 0 }); vf.close();
        while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      } else {
        const x = g2.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
        const { data } = x.getImageData(0, 0, w, h);
        const pal = gifLib.quantize(data, 256), idx = gifLib.applyPalette(data, pal);
        gif.writeFrame(idx, w, h, { palette: pal, delay: Math.round(1000 / fps) });
      }
      f++; out++;
      if (out % 5 === 0) { busy.show(kind === 'gif' ? 'Render GIF' : 'Render MP4', `Klatka ${out} / ${frames} · ${w}×${h}`, out / frames); await yieldUI(); }
    }
    if (seq.playing) stopSeq();
    if (kind === 'mp4') {
      await enc.flush(); if (aEnc) await aEnc.flush();
      muxer.finalize(); blob = new Blob([target.buffer], { type: 'video/mp4' });
    } else { gif.finish(); blob = new Blob([gif.bytes()], { type: 'image/gif' }); }
  } catch (e) { console.warn(e); toast('Render przerwany: ' + (e?.message || e), 6000); }
  finally {
    audio.offline = false; seq.noReform = false; seq.playing && stopSeq();
    camera.position.copy(saved.pos); camera.fov = saved.fov; camera.updateProjectionMatrix();
    setRenderSize(saved.w, saved.h, saved.pr, true); resize();
    loop.paused = false; rendering = false; busy.hide();
  }
  return blob;
}
let lastRender = null;
$('btnRender').onclick = async () => {
  const b = await renderOffline('mp4', renderOpts()); if (!b) return;
  lastRender = b; showVideo(b, 'mp4', `Render gotowy: <b>${(b.size / 1048576).toFixed(1)} MB</b>, MP4, ${renderDims('mp4').join('×')}, ${$('rFps').value} kl./s.`);
  $('preview').scrollIntoView({ block: 'nearest' });
};
$('btnGif').onclick = async () => {
  const b = await renderOffline('gif', renderOpts()); if (!b) return;
  saveFile(b, `roj-czasteczek-${Date.now()}.gif`);
};
function renderOpts() { return {}; }   // extended by perfect-loop (25)

/* ============================================================
   (16) Batch: many product photos → ZIP of videos
   ============================================================ */
$('batchFiles').onchange = async e => {
  const files = [...e.target.files].filter(f => f.type.startsWith('image/')); e.target.value = '';
  if (!files.length) return;
  const out = {}; let ok = 0;
  for (let i = 0; i < files.length; i++) {
    toast(`Film ${i + 1} z ${files.length}: ${files[i].name}`);
    await loadImageToShape(0, files[i]);
    const b = await renderOffline('mp4', renderOpts());
    if (!b) break;
    out[files[i].name.replace(/\.[^.]+$/, '') + '.mp4'] = new Uint8Array(await b.arrayBuffer()); ok++;
  }
  if (!ok) return;
  const { zipSync } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
  saveFile(new Blob([zipSync(out, { level: 0 })], { type: 'application/zip' }), `roj-katalog-${ok}-filmow.zip`);
};

/* ============================================================
   (17) Style presets (built-in + saved in this browser)
   ============================================================ */
const PRESETS = {
  'Luksus złoty': { bg: 'black', additive: false, colorMode: '0', bloom: 0.35, size: 0.010, opacity: 0.95, noise: 0.12, wave: 0.35, trans: '0', camMove: 'dolly', ovColor: '#ffffff', ovCtaBg: '#e8b45a' },
  'Głębia oceanu': { bg: 'abyss', additive: true, colorMode: '1', tint1: '#1b4dff', tint2: '#8ff3e6', bloom: 0.9, size: 0.015, opacity: 0.45, noise: 0.35, wave: 0.6, trans: '0', camMove: 'none', ovColor: '#dcefee', ovCtaBg: '#8ff3e6' },
  'Neon': { bg: 'black', additive: true, colorMode: '1', tint1: '#ff2bd6', tint2: '#29f0ff', bloom: 1.6, size: 0.012, opacity: 0.5, noise: 0.5, wave: 0.8, trans: '4', camMove: 'orbit', ovColor: '#ffffff', ovCtaBg: '#ff2bd6' },
  'Minimal biały': { bg: 'paper', additive: false, colorMode: '2', tint2: '#20262b', bloom: 0, size: 0.011, opacity: 0.9, noise: 0.2, wave: 0.3, trans: '1', camMove: 'none', ovColor: '#15191c', ovCtaBg: '#15191c' },
};
const PRESET_KEYS = ['bg', 'additive', 'colorMode', 'tint1', 'tint2', 'bloom', 'size', 'opacity', 'noise', 'wave', 'trans', 'camMove', 'ovColor', 'ovCtaBg', 'spring', 'damping', 'flight', 'morphTime', 'depth', 'detail'];
function setCtl(id, v) {
  const el = $(id); if (!el) return;
  if (el.type === 'checkbox') { el.checked = !!v; el.dispatchEvent(new Event('change')); el.dispatchEvent(new Event('input')); }
  else { el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input')); if (el.tagName === 'SELECT' || el.type === 'color') el.dispatchEvent(new Event('input')); }
}
function getCtl(id) { const el = $(id); return el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value; }
function userPresets() { try { return JSON.parse(localStorage.getItem('roj-presets') || '{}'); } catch { return {}; } }
function fillPresets() {
  const sel = $('preset'), up = userPresets();
  sel.innerHTML = '<option value="">Wybierz…</option>' + Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('') + Object.keys(up).map(k => `<option value="u:${k}">★ ${k}</option>`).join('');
}
$('preset').onchange = () => {
  const v = $('preset').value; if (!v) return;
  const p = v.startsWith('u:') ? userPresets()[v.slice(2)] : PRESETS[v];
  Object.entries(p || {}).forEach(([k, val]) => setCtl(k, val));
  toast('Styl: ' + v.replace(/^u:/, ''));
};
$('presetSave').onclick = () => {
  const name = $('presetName').value.trim(); if (!name) { toast('Wpisz nazwę stylu'); return; }
  const up = userPresets(); up[name] = Object.fromEntries(PRESET_KEYS.map(k => [k, getCtl(k)]));
  try { localStorage.setItem('roj-presets', JSON.stringify(up)); fillPresets(); $('preset').value = 'u:' + name; toast('Zapisano styl: ' + name); }
  catch { toast('Ta przeglądarka nie pozwala zapisać stylu'); }
};
fillPresets();

/* ============================================================
   Project (de)serialisation — used by (18) web export and (21) save/load
   ============================================================ */
const CTL_SKIP = new Set(['caption', 'presetName', 'preset', 'morph']);
function controlIds() { return [...document.querySelectorAll('.pane input[id], .pane select[id], .pane textarea[id]')].filter(e => e.type !== 'file' && !CTL_SKIP.has(e.id)).map(e => e.id); }
function imgToDataURL(img, maxS = 1600, type = 'image/jpeg') {
  const [w, h] = sizeFor(img, maxS); const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h); return c.toDataURL(type, 0.88);
}
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = str => { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
async function serializeProject() {
  const out = { app: 'roj-czasteczek', v: 1, controls: {}, shapes: [], steps: JSON.parse(JSON.stringify(steps)), logo: null };
  controlIds().forEach(id => out.controls[id] = getCtl(id));
  for (const s of shapes) {
    const o = { type: s.type, name: s.name, text: s.text, poly: s.poly || null };
    if (s.img) o.img = imgToDataURL(s.img, 1600, s.fileName && /png|webp/i.test(s.fileName) ? 'image/png' : 'image/jpeg');
    if (s.aiMask) o.aiMask = s.aiMask.toDataURL('image/png');
    if (s.depthMap) o.depthMap = s.depthMap.toDataURL('image/png');
    if (s.modelBuf) o.model = b64(s.modelBuf);
    out.shapes.push(o);
  }
  if (ov.logo) out.logo = imgToDataURL(ov.logo, 800, 'image/png');
  return out;
}
const urlToImage = u => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
async function urlToCanvas(u) { const im = await urlToImage(u); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c; }
async function applyProject(pr) {
  if (!pr || pr.app !== 'roj-czasteczek') throw new Error('To nie jest projekt Roju Cząsteczek');
  busy.show('Projekt', 'Wczytuję…');
  const ids = Object.keys(pr.controls || {});
  ids.forEach(id => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = !!pr.controls[id]; else el.value = pr.controls[id]; if (el.type === 'range') el.dispatchEvent(new Event('input')); });
  const list = [];
  for (const o of pr.shapes || []) {
    const s = { type: o.type, name: o.name, text: o.text, poly: o.poly };
    if (o.img) { s.img = await urlToImage(o.img); s.fileName = s.name; }
    if (o.aiMask) s.aiMask = await urlToCanvas(o.aiMask);
    if (o.depthMap) s.depthMap = await urlToCanvas(o.depthMap);
    if (o.model) { s.modelBuf = unb64(o.model); s.model = (await new GLTFLoader().parseAsync(s.modelBuf, '')).scene; }
    list.push(s);
  }
  if (list.length >= 1) { shapes.length = 0; shapes.push(...list); }
  steps = pr.steps || DEFAULT_STEPS();
  ov.logo = pr.logo ? await urlToImage(pr.logo) : null; $('logoClear').disabled = !ov.logo;
  SIZE = +$('count').value; fromIdx = toIdx = 0;
  buildSim(); applyLook(); applyTrans(); resize(); renderSteps(); renderShapeCards();
  controls.autoRotate = $('autoRot').checked;
  anim.morph = anim.morphTarget = 1; reform('cloud');
  (hooks.projectApplied || []).forEach(f => f());
  busy.hide();
}

/* ============================================================
   (18) Website export: standalone scroll-driven hero page
   ============================================================ */
$('btnEmbed').onclick = async () => {
  busy.show('Strona WWW', 'Pakuję projekt…');
  try {
    const cfg = await serializeProject();
    const fonts = document.querySelector('link[href*="fonts.googleapis.com/css2"]')?.outerHTML || '';
    // the desktop/phone app bundles its libraries locally; an exported page must load them from the CDN
    const toCDN = s => s.split('./vendor/three/build/three.module.js').join('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js')
      .split('./vendor/three/examples/jsm/').join('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/')
      .split('./vendor/mp4-muxer.mjs').join('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs')
      .split('./vendor/gifenc.esm.js').join('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js')
      .split('./vendor/fflate.js').join('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js')
      .split('./vendor/qrcode.js').join('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js')
      .replace("navigator.serviceWorker.register('./sw.js')", 'Promise.resolve()');
    const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${(cfg.controls.ovTitle || 'Rój Cząsteczek').replace(/</g, '&lt;')}</title>
${fonts}
<style>${$('roj-style').textContent}</style></head><body>
${PRISTINE_MARKUP}
<script>window.ROJ_EMBED=${JSON.stringify(cfg).replace(/</g, '\\u003c')};<\/script>
${toCDN($('roj-imap').outerHTML)}
<script type="module">${toCDN($('roj-app').textContent)}<\/script>
</body></html>`;
    saveFile(new Blob([html], { type: 'text/html' }), 'strona-roj-czasteczek.html');
  } catch (e) { console.warn(e); toast('Eksport nie powiódł się: ' + e.message); }
  finally { busy.hide(); }
};
async function bootEmbed(cfg) {
  const app = document.querySelector('.app'); app.classList.add('embed-mode');
  document.documentElement.style.height = 'auto'; document.body.style.height = 'auto'; document.body.style.overflow = 'auto';
  app.style.position = 'sticky'; app.style.top = '0'; app.style.height = '100vh';
  await applyProject(cfg);
  $('frame').value = 'full'; resize();
  const spacer = document.createElement('div'); spacer.style.height = (Math.max(2, shapes.length) * 100) + 'vh'; document.body.appendChild(spacer);
  let lastIdx = 0, scattered = false;
  addEventListener('scroll', () => {
    const p = clamp01(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
    const idx = Math.min(shapes.length - 1, Math.floor(p * shapes.length * 0.999));
    if (idx !== lastIdx) { lastIdx = idx; goTo(idx); }
    if (p > 0.97 && !scattered) { scattered = true; scatterPulse(); } else if (p < 0.9) scattered = false;
  }, { passive: true });
}

/* ============================================================
   (20) Publishing pack: caption + hashtags
   ============================================================ */
function slugTag(w) { return '#' + w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]/g, ''); }
$('btnCaption').onclick = () => {
  const t = $('ovTitle').value.trim(), s = $('ovSub').value.trim(), c = $('ovCta').value.trim();
  const words = t.split(/[\s&,·-]+/).filter(w => w.length > 3).slice(0, 3).map(slugTag);
  const tags = [...new Set([...words, '#handmade', '#design', '#wnetrza', '#meble', '#rekodzielo', '#reels'])].join(' ');
  $('caption').value = `${t} ✨\n${s}\n\n${c ? c + ' — napisz w wiadomości prywatnej.' : ''}\n\n${tags}`.replace(/\n{3,}/g, '\n\n');
};
$('btnCopyCap').onclick = async () => {
  try { await navigator.clipboard.writeText($('caption').value); toast('Skopiowano opis'); }
  catch { $('caption').select(); toast('Zaznaczono opis: skopiuj Ctrl+C'); }
};
