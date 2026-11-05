
/* ============================================================
   CURSOR — what happens when you hover over and click the picture
   ============================================================ */
const PALETTES = [['#ff2bd6', '#29f0ff'], ['#1b4dff', '#8ff3e6'], ['#ff6a00', '#ffe29a'], ['#00c853', '#e8ff7a'], ['#7b2cff', '#ff9bd2']];
let palIdx = 0;
shock = function (at) {                       // replaces the core click handler
  if (reduced || !sim) return;
  const m = +$('clickMode').value;
  if (m === 7) return;
  if (m === 5) { goTo((shownIdx() + 1) % shapes.length); sim.uShockMode.value = 0; sim.uShockOrigin.value.copy(at); sim.uShock.value = .5; return; }
  if (m === 6) { const [a, b] = PALETTES[palIdx++ % PALETTES.length]; $('colorMode').value = '1'; $('tint1').value = a; $('tint2').value = b; applyLook(); sim.uShockMode.value = 3; sim.uShockOrigin.value.copy(at); sim.uShock.value = 1; return; }
  sim.uShockMode.value = m; sim.uShockOrigin.value.copy(at);
  sim.uShock.value = 1;
  if (m === 2) cursorFx.hole = 1.1;            // pull in for a second, then spit out
  if (m === 4) mv.fireT = Math.max(mv.fireT, 2);
};
const cursorFx = { hole: 0 };
hooks.tick.push(dt => {
  if (!sim) return;
  const hm = +$('hoverMode').value;
  sim.uHoverMode.value = hm >= 5 ? 9 : hm;           // 5 = glow only, 6 = nothing: no force
  if (hm > 0 && hm < 5) sim.uPointerStrength.value = reduced ? 0 : P.pStrength * (0.9 + ptr.energy * 1.2);
  if (cursorFx.hole > 0) { cursorFx.hole -= dt; sim.uShock.value = 1; if (cursorFx.hole <= 0) sim.uShock.value = -1.2; }
  if (sim.uShockMode.value === 2 && sim.uShock.value < 0) sim.uShock.value *= Math.exp(-dt * 2);
  renderUniforms.uPointerR.value.copy(ptr.active ? ptr.world : FAR);
  renderUniforms.uHoverGlow.value = $('hoverGlow').checked && hm !== 6 ? 1 : 0;
  renderUniforms.uHoverR.value = P.pRadius;
});
