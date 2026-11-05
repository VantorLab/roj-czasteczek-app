/* ============================================================
   Boot + realtime loop
   ============================================================ */
buildSim(); applyLook(); applyTrans(); resize(); renderSteps(); renderShapeCards();
fromIdx = toIdx = 0; uploadPair(); markActive();
reform('cloud');
if (window.ROJ_EMBED) bootEmbed(window.ROJ_EMBED).catch(e => { console.warn(e); toast('Nie udało się wczytać projektu strony'); });
let lastNow = performance.now(), fpsAcc = 0, fpsN = 0, uiAcc = 0;
const loop = { paused: false };
function frame(now) {
  requestAnimationFrame(frame);
  if (loop.paused) { lastNow = now; return; }
  const dt = Math.min((now - lastNow) / 1000, 1 / 30); lastNow = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { $('hudFps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  tick(dt); draw();
  uiAcc += dt;
  if (uiAcc > 0.1) {
    uiAcc = 0;
    const m = $('morph'); if (document.activeElement !== m) { m.value = anim.morph; m.nextElementSibling.textContent = anim.morph.toFixed(3); }
    const sI = shownIdx();
    $('hudShape').textContent = anim.morph >= 1 || anim.morph <= 0 ? `${sI + 1} · ${shapes[sI].name}` : `${fromIdx + 1} → ${toIdx + 1}  ${Math.round(anim.morph * 100)}%`;
  }
  if (rec.mr && rec.mr.state === 'recording') $('recTime').textContent = `REC ${((performance.now() - rec.start) / 1000).toFixed(1)} s`;
  if (wantPng) { wantPng = false; renderer.domElement.toBlob(b => b && saveFile(b, `roj-czasteczek-${Date.now()}.png`), 'image/png'); }
}
requestAnimationFrame(frame);
