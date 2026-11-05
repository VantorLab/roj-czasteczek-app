
/* ============================================================
   MOVES + SCENARIOS — "what should happen?"
   New moves: tornado, implode & burst, blow away like sand, laser scan, fireworks.
   A gallery of ready scenarios fills the timeline with one click.
   ============================================================ */
const mv = { vortex: 0, vortexT: 0, attract: 0, attractT: 0, blow: 0, blowDir: 1, blowT: 0, scan: -9, scanT: -1, fireT: 0 };
function moveVortex() { mv.vortexT = 2.6; }
function moveImplode() { mv.attractT = 1.1; }
function moveBlow() { mv.blowT = 0.0001; mv.blowDir = Math.random() < .5 ? 1 : -1; }
function moveScan() { reform('cloud'); mv.scanT = 0; }
function moveFireworks() { anim.scatter = Math.max(anim.scatter, .55); mv.fireT = 2.4; }
hooks.tick.push(dt => {
  // tornado: ramps in, spins, lets go
  if (mv.vortexT > 0) { mv.vortexT -= dt; mv.vortex = Math.min(1, mv.vortex + dt * 2); } else mv.vortex = Math.max(0, mv.vortex - dt * 1.2);
  // implode, then burst
  if (mv.attractT > 0) { mv.attractT -= dt; mv.attract = Math.min(1, mv.attract + dt * 2.5); if (mv.attractT <= 0) { mv.attract = 0; anim.scatter = 1; sim && (sim.uShockOrigin.value.set(0, 0, 0), sim.uShock.value = 1.2); } }
  // blow away (0→1 over 2 s), hold, come back (1→0 over 2.2 s)
  if (mv.blowT > 0) { mv.blowT += dt; const t = mv.blowT; mv.blow = t < 2 ? t / 2 : t < 3.2 ? 1 : Math.max(0, 1 - (t - 3.2) / 2.2); if (t > 5.4) { mv.blowT = 0; mv.blow = 0; } }
  // laser scan left → right over 3 s
  if (mv.scanT >= 0) { mv.scanT += dt; const half = SPAN / 2 + .25; mv.scan = -half + (mv.scanT / 3) * half * 2; if (mv.scanT > 3.4) { mv.scanT = -1; mv.scan = -9; } }
  // fireworks: a short burst of gravity after the scatter
  if (mv.fireT > 0) mv.fireT -= dt;
  if (sim) {
    sim.uVortex.value = reduced ? 0 : mv.vortex; sim.uAttract.value = mv.attract; sim.uBlow.value = mv.blow; sim.uScan.value = mv.scan;
    sim.uBlowDir.value.set(mv.blowDir, 0, 0);
    if (mv.fireT > 0) sim.uGravity.value += 4.5 * Math.min(1, mv.fireT);
  }
  renderUniforms.uScan.value = mv.scan;
});
hooks.seqStart.push(() => { Object.assign(mv, { vortex: 0, vortexT: 0, attract: 0, attractT: 0, blow: 0, blowT: 0, scan: -9, scanT: -1, fireT: 0 }); });

/* timeline actions (Doradca AI sees these too) */
Object.assign(ACTS, { vortex: 'Tornado', implode: 'Implozja i wybuch', blow: 'Rozwiej jak piasek', scan: 'Skan laserowy', fireworks: 'Fajerwerki' });
hooks.step.push(s => {
  if (s.act === 'vortex') { FX.mode === 'particles' ? moveVortex() : scatterPulse(); }
  else if (s.act === 'implode') { FX.mode === 'particles' ? moveImplode() : scatterPulse(); }
  else if (s.act === 'blow') { FX.mode === 'particles' ? moveBlow() : scatterPulse(); }
  else if (s.act === 'scan') { FX.mode === 'particles' ? moveScan() : reform('cloud'); }
  else if (s.act === 'fireworks') { FX.mode === 'particles' ? moveFireworks() : scatterPulse(); }
});

/* ---------- scenario gallery ---------- */
const P0 = { t: 0, act: 'effect', arg: 'particles' };
const SCENARIOS = [
  { id: 'classic', name: 'Rozpad i złożenie', desc: 'Rój składa się z chmury, rozsypuje i wraca.', steps: () => [P0, { t: 0, act: 'reform', arg: 'cloud' }, { t: 5, act: 'scatter' }], tail: 4 },
  { id: 'pour', name: 'Wylewanie jak żywica', desc: 'Strumień spływa z góry i rozlewa się w kształt.', steps: () => [P0, { t: 0, act: 'reform', arg: 'pour' }, { t: 8, act: 'sweep' }], tail: 3 },
  { id: 'rise', name: 'Wzrost z podłogi', desc: 'Pył podnosi się z ziemi i buduje obiekt.', steps: () => [P0, { t: 0, act: 'reform', arg: 'floor' }, { t: 6.5, act: 'sweep' }], tail: 3, cam: 'rise' },
  { id: 'tornado', name: 'Tornado', desc: 'Obiekt zaczyna wirować jak trąba powietrzna i wraca.', steps: () => [P0, { t: 0, act: 'reform', arg: 'cloud' }, { t: 3.5, act: 'vortex' }, { t: 8, act: 'sweep' }], tail: 3 },
  { id: 'implode', name: 'Implozja i wybuch', desc: 'Wszystko zapada się do punktu, potem eksploduje.', steps: () => [P0, { t: 0, act: 'reform', arg: 'cloud' }, { t: 3.5, act: 'implode' }], tail: 5 },
  { id: 'blow', name: 'Rozwianie jak piasek', desc: 'Produkt rozsypuje się w pył od jednej strony i wraca.', steps: () => [P0, { t: 0, act: 'reform', arg: 'cloud' }, { t: 3.5, act: 'blow' }], tail: 6 },
  { id: 'scan', name: 'Skan laserowy', desc: 'Linia światła przesuwa się i buduje produkt.', steps: () => [P0, { t: 0.3, act: 'scan' }, { t: 5, act: 'sweep' }], tail: 3 },
  { id: 'fireworks', name: 'Fajerwerki', desc: 'Rój wystrzeliwuje i opada, potem się składa.', steps: () => [P0, { t: 0, act: 'reform', arg: 'cloud' }, { t: 3.5, act: 'fireworks' }], tail: 5 },
  { id: 'photo', name: 'Zdjęcie → rój → zdjęcie', desc: 'Prawdziwe zdjęcie rozpuszcza się w cząsteczki.', run: () => $('btnSeqPhoto').click() },
  { id: 'glass', name: 'Rozbite szkło', desc: 'Zdjęcie pęka na odłamki 3D, które wracają.', steps: () => [{ t: 0, act: 'effect', arg: 'glass' }, { t: 2.5, act: 'scatter' }], tail: 6 },
  { id: 'voxrain', name: 'Deszcz klocków', desc: 'Klocki spadają z góry i budują produkt.', steps: () => [{ t: 0, act: 'effect', arg: 'voxels' }, { t: 0.1, act: 'reform', arg: 'pour' }, { t: 7, act: 'scatter' }], tail: 5 },
  { id: 'relief', name: 'Relief z połyskiem', desc: 'Bryła 3D z przelotem światła i najazdem kamery.', steps: () => [{ t: 0, act: 'effect', arg: 'relief' }, { t: 2, act: 'sweep' }, { t: 6, act: 'sweep' }], tail: 3, cam: 'dolly' },
  { id: 'resin', name: 'Kolory żywicy', desc: 'Ten sam stół w kilku kolorach żywicy.', run: () => $('btnSeqResin').click() },
  { id: 'liquid', name: 'Płynna żywica', desc: 'Relief, na który wylewa się płyn.', steps: () => [{ t: 0, act: 'effect', arg: 'relief' }, { t: 1.5, act: 'fluid' }, { t: 6, act: 'fluid' }], tail: 3, fluid: true },
];
$('scenarios').innerHTML = SCENARIOS.map(s => `<button type="button" class="scenario" data-id="${s.id}"><b>${s.name}</b><span>${s.desc}</span></button>`).join('');
$('scenarios').addEventListener('click', e => {
  const b = e.target.closest('.scenario'); if (!b) return;
  const sc = SCENARIOS.find(x => x.id === b.dataset.id);
  histBegin(`Scenariusz „${sc.name}” — zostawić?`);
  if (sc.run) { sc.run(); playSeq(); return; }
  if (sc.fluid && !$('fluidOn').checked) { $('fluidOn').checked = true; flClear(); }
  if (sc.cam) $('camMove').value = sc.cam;
  steps = sc.steps(); setRange('seqTail', sc.tail); renderSteps();
  [...$('scenarios').children].forEach(x => x.classList.toggle('on', x === b));
  playSeq();
});
