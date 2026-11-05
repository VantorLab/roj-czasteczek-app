
/* ============================================================
   PARALLAX — tilt the phone (gyroscope) or move the mouse and the 3D scene
   turns with you, like the reference site. Works with every effect;
   depth (particles, relief, voxels, glass) is what makes it feel 3D.
   ============================================================ */
const par = { on: false, gyro: false, lastGyro: 0, gx: 0, gy: 0, mx: 0, my: 0, b0: null, g0: null, x: 0, y: 0, applied: new THREE.Vector3(), _s: new THREE.Spherical(), _t: new THREE.Vector3() };
function onOrient(e) {
  if (e.beta == null || e.gamma == null) return;
  if (par.b0 == null) { par.b0 = e.beta; par.g0 = e.gamma; }           // the pose when switched on = neutral
  const landscape = Math.abs(window.orientation || screen.orientation?.angle || 0) === 90;
  let dx = e.gamma - par.g0, dy = e.beta - par.b0;
  if (landscape) [dx, dy] = [dy, -dx];
  par.gx = Math.max(-1, Math.min(1, dx / 28)); par.gy = Math.max(-1, Math.min(1, dy / 28));
  par.gyro = true; par.lastGyro = performance.now();
}
async function parallaxOn() {
  // iPhone asks permission, and only from a tap
  try {
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') toast('Bez zgody na czujnik ruchu paralaksa działa kursorem/dotykiem');
    }
  } catch { /* desktop or blocked: mouse parallax still works */ }
  addEventListener('deviceorientation', onOrient);
  par.on = true; par.b0 = par.g0 = null;
}
function parallaxOff() { removeEventListener('deviceorientation', onOrient); par.on = false; }
$('parallaxOn').addEventListener('change', () => $('parallaxOn').checked ? parallaxOn() : parallaxOff());
$('parallaxReset').onclick = () => { par.b0 = par.g0 = null; toast('Ustawiono obecne położenie telefonu jako środek'); };
cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); par.mx = ((e.clientX - r.left) / r.width) * 2 - 1; par.my = ((e.clientY - r.top) / r.height) * 2 - 1; });
cv.addEventListener('pointerleave', () => { par.mx = par.my = 0; });

const camScripted = () => seq.playing && $('camMove').value !== 'none';
hooks.tick.push(() => {                       // before OrbitControls: take last frame's offset back out
  if (!camScripted()) camera.position.sub(par.applied);
  par.applied.set(0, 0, 0);
});
hooks.post = hooks.post || [];
hooks.post.push(dt => {                       // after OrbitControls: add this frame's tilt
  if (!par.on || rendering || reduced) { par.x = par.y = 0; return; }
  const useGyro = par.gyro && performance.now() - par.lastGyro < 1000;
  const tx = useGyro ? par.gx : par.mx * 0.6, ty = useGyro ? par.gy : par.my * 0.6;
  const k = 1 - Math.exp(-dt * 6); par.x += (tx - par.x) * k; par.y += (ty - par.y) * k;
  const amt = P.parallaxAmt;
  par._t.copy(controls.target);
  const rel = camera.position.clone().sub(par._t); par._s.setFromVector3(rel);
  par._s.theta -= par.x * 0.45 * amt; par._s.phi = Math.min(Math.PI - 0.1, Math.max(0.1, par._s.phi - par.y * 0.3 * amt));
  const np = new THREE.Vector3().setFromSpherical(par._s).add(par._t);
  par.applied.copy(np).sub(camera.position);
  camera.position.copy(np); camera.lookAt(par._t);
});
