
/* ============================================================
   PREMIUM LOOKS + FIRST IMPRESSION
   - your own sign or logo as the particle shape
   - neon contour and hologram scenarios
   - a self-playing demo through the example shapes until the first click
   ============================================================ */
const sprite = { img: null };
const spriteCanvas = document.createElement('canvas'); spriteCanvas.width = spriteCanvas.height = 128;
const spriteTex = new THREE.CanvasTexture(spriteCanvas); spriteTex.minFilter = THREE.LinearFilter; spriteTex.generateMipmaps = false;
renderUniforms.tSprite.value = spriteTex;
function drawSprite() {
  const x = spriteCanvas.getContext('2d'); x.clearRect(0, 0, 128, 128);
  if (sprite.img) {
    const s = Math.min(112 / sprite.img.width, 112 / sprite.img.height), w = sprite.img.width * s, h = sprite.img.height * s;
    x.drawImage(sprite.img, (128 - w) / 2, (128 - h) / 2, w, h);
    // keep the logo's shape, paint it white so each particle can carry its own colour
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); x.globalCompositeOperation = 'source-over';
  } else {
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 100px "Bricolage Grotesque", "Segoe UI Symbol", "Apple Color Emoji", sans-serif';
    x.fillText(($('spriteChar').value || '★').slice(0, 3), 64, 70, 120);
  }
  spriteTex.needsUpdate = true;
}
STYLES.push(['8', 'Własny znak / logo']); STYLE_SCALE[8] = 2.4;
$('pStyle').insertAdjacentHTML('beforeend', '<option value="8">Własny znak / logo</option>');
$('spriteChar').addEventListener('input', () => { sprite.img = null; drawSprite(); if ($('pStyle').value !== '8') { $('pStyle').value = '8'; applyStyle(); } });
$('spriteFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { sprite.img = await fileToImage(f); drawSprite(); $('pStyle').value = '8'; applyStyle(); toast('Twoje logo jest teraz kształtem każdej cząsteczki'); } catch { toast('Nie udało się odczytać obrazu'); } };
drawSprite();
document.fonts?.ready.then(drawSprite);

/* neon contour: rebuild picture shapes when switched */
$('contourOnly').addEventListener('change', () => refreshAllImages());

/* more scenarios */
const PREMIUM = [
  { id: 'neon', name: 'Neonowy kontur', desc: 'Same świecące krawędzie produktu, rysowane laserem.', look: { contourOnly: true, colorMode: '1', tint1: '#ff2bd6', tint2: '#29f0ff', additive: true, bg: 'black', bloom: 1.6, opacity: 0.7, pStyle: '0' }, steps: () => [P0, { t: 0.3, act: 'scan' }, { t: 5.5, act: 'vortex' }, { t: 10, act: 'sweep' }], tail: 3 },
  { id: 'holo', name: 'Hologram', desc: 'Niebieska projekcja z liniami skanu i migotaniem.', look: { retroMode: '6', additive: true, bg: 'black', pStyle: '0', contourOnly: false }, steps: () => [P0, { t: 0, act: 'reform', arg: 'rain' }, { t: 7, act: 'blow' }], tail: 6, cam: 'orbit' },
  { id: 'mylogo', name: 'Rój z Twojego logo', desc: 'Każda cząsteczka ma kształt Twojego znaku (★ albo wgrane logo).', look: { pStyle: '8', styleLen: 1.2, contourOnly: false }, steps: () => [P0, { t: 0, act: 'style', arg: '8' }, { t: 0, act: 'reform', arg: 'pour' }, { t: 8, act: 'fireworks' }], tail: 5 },
];
SCENARIOS.push(...PREMIUM);
$('scenarios').insertAdjacentHTML('beforeend', PREMIUM.map(s => `<button type="button" class="scenario" data-id="${s.id}"><b>${s.name}</b><span>${s.desc}</span></button>`).join(''));
$('scenarios').addEventListener('click', e => {
  const b = e.target.closest('.scenario'); const sc = b && PREMIUM.find(x => x.id === b.dataset.id); if (!sc) return;
  for (const [k, v] of Object.entries(sc.look || {})) setCtl(k, v);
  applyLook(); applyStyle();
}, true);

/* ---------- first impression: a self-playing tour of the example shapes ---------- */
const demo = { on: false };
function demoSteps() {
  const st = [{ t: 0, act: 'reform', arg: 'cloud' }];
  let t = 3.6;
  for (let i = 1; i < shapes.length; i++, t += 3.4) st.push({ t, act: 'goto', arg: i });
  st.push({ t, act: 'goto', arg: 0 }, { t: t + 3, act: 'scatter', arg: '' });
  return st;
}
function demoLoop() {
  if (!demo.on || rendering) return;
  steps = demoSteps(); renderSteps(); setRange('seqTail', 3.2);
  playSeq(() => { if (demo.on) setTimeout(demoLoop, 600); });
}
function demoStop() {
  if (!demo.on) return;
  demo.on = false; if (seq.playing) stopSeq();
  steps = DEFAULT_STEPS(); renderSteps(); setRange('seqTail', 3.6);
  hist.cur = histSnap(); hist.undo.length = 0; histUI();       // the tour is not part of the user's history
  $('demoNote').hidden = true;
}
['pointerdown', 'keydown', 'wheel', 'dragover'].forEach(ev => addEventListener(ev, demoStop, { capture: true, once: false }));
if (!window.ROJ_EMBED) setTimeout(() => {
  let restored = false; try { restored = !!localStorage.getItem('roj-demo-seen'); } catch {}
  demo.on = true; $('demoNote').hidden = false; demoLoop();
  try { localStorage.setItem('roj-demo-seen', '1'); } catch {}
}, 1800);
