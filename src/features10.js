
/* ============================================================
   PARTICLE LOOK — dots, dashes, motion streaks, Matrix digits, stars, pixels, rings
   + Matrix rain and extra "rich" scenarios.
   ============================================================ */
const STYLES = [['0', 'Kropki (świetliki)'], ['1', 'Kreski poziome'], ['2', 'Kreski pionowe'], ['3', 'Smugi ruchu'], ['4', 'Cyfry Matrix'], ['5', 'Gwiazdki'], ['6', 'Piksele'], ['7', 'Pierścienie']];
const STYLE_SCALE = { 0: 1, 1: 2.6, 2: 2.6, 3: 3.2, 4: 2.2, 5: 2.2, 6: 1.1, 7: 1.8 };
$('pStyle').innerHTML = STYLES.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
renderUniforms.tDigits.value = (() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 640, 64); x.fillStyle = '#fff'; x.font = '700 54px "IBM Plex Mono", ui-monospace, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < 10; i++) x.fillText(String(i), i * 64 + 32, 35);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
})();
function applyStyle() {
  const v = +$('pStyle').value;
  renderUniforms.uStyle.value = v; renderUniforms.uStyleScale.value = (STYLE_SCALE[v] || 1) * P.styleLen;
  pointsMat.blending = ($('additive').checked && $('bg').value !== 'paper') ? THREE.AdditiveBlending : THREE.NormalBlending;
}
['pStyle', 'styleLen'].forEach(id => $(id).addEventListener('input', applyStyle));
$('pStyle').addEventListener('change', applyStyle);
hooks.projectApplied.push(applyStyle);

/* Matrix rain: particles fall straight down their own column into place */
const rain = { t: 0 };
hooks.reform.push(kind => { rain.t = kind === 'rain' ? 9 : 0; });
hooks.tick.push(dt => { if (rain.t > 0) rain.t -= dt; if (sim) sim.uRain.value = rain.t > 0 ? 1 : 0; });

/* timeline: change the look mid-video */
Object.assign(ACTS, { style: 'Wygląd cząsteczek' });
hooks.args.style = () => STYLES;
hooks.step.push(s => { if (s.act === 'style') { $('pStyle').value = s.arg || '0'; applyStyle(); } });

/* rich scenarios — they join the "Co ma się dziać?" gallery */
const RICH = [
  { id: 'matrix', name: 'Deszcz Matrix', desc: 'Zielone cyfry spadają kolumnami i składają produkt.', look: { pStyle: '4', colorMode: '2', tint2: '#39ff6a', bg: 'black', additive: true }, steps: () => [P0, { t: 0, act: 'style', arg: '4' }, { t: 0.05, act: 'reform', arg: 'rain' }, { t: 8.5, act: 'style', arg: '0' }], tail: 3.5 },
  { id: 'hlines', name: 'Linie skanera', desc: 'Poziome kreski i laser budują obraz linia po linii.', look: { pStyle: '1' }, steps: () => [P0, { t: 0, act: 'style', arg: '1' }, { t: 0.3, act: 'scan' }, { t: 5, act: 'blow' }], tail: 6 },
  { id: 'vlines', name: 'Kurtyna z kresek', desc: 'Pionowe kreski opadają jak deszcz i układają kształt.', look: { pStyle: '2' }, steps: () => [P0, { t: 0, act: 'style', arg: '2' }, { t: 0.05, act: 'reform', arg: 'rain' }, { t: 8, act: 'scatter' }], tail: 4 },
  { id: 'hyper', name: 'Hiperprzestrzeń', desc: 'Smugi światła wciągane do środka, potem wybuch.', look: { pStyle: '3' }, steps: () => [P0, { t: 0, act: 'style', arg: '3' }, { t: 0, act: 'reform', arg: 'cloud' }, { t: 3.2, act: 'implode' }, { t: 7, act: 'vortex' }], tail: 4, cam: 'vertigo' },
  { id: 'stardust', name: 'Gwiezdny pył', desc: 'Migoczące gwiazdki wirują jak galaktyka.', look: { pStyle: '5', bg: 'night', additive: true }, steps: () => [P0, { t: 0, act: 'style', arg: '5' }, { t: 0, act: 'reform', arg: 'cloud' }, { t: 3.5, act: 'vortex' }, { t: 8, act: 'sweep' }], tail: 3, cam: 'orbit' },
  { id: 'pixels', name: 'Piksele 8-bit', desc: 'Kwadratowe piksele w stylu retro, rozsypka i powrót.', look: { pStyle: '6' }, steps: () => [P0, { t: 0, act: 'style', arg: '6' }, { t: 0, act: 'reform', arg: 'floor' }, { t: 6, act: 'fireworks' }], tail: 5 },
];
SCENARIOS.push(...RICH);
$('scenarios').insertAdjacentHTML('beforeend', RICH.map(s => `<button type="button" class="scenario" data-id="${s.id}"><b>${s.name}</b><span>${s.desc}</span></button>`).join(''));
// apply the look of a rich scenario before the generic handler plays it
$('scenarios').addEventListener('click', e => {
  const b = e.target.closest('.scenario'); const sc = b && RICH.find(x => x.id === b.dataset.id); if (!sc) return;
  for (const [k, v] of Object.entries(sc.look || {})) setCtl(k, v);
  applyLook(); applyStyle();
}, true);
