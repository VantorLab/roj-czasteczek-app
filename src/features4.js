
/* ============================================================
   EFFECTS · main-effect modes (particles / relief / voxels / …)
   ============================================================ */
const FX = { mode: 'particles', modes: {} };
function setMode(m) {
  if (!FX.modes[m]) m = 'particles';
  if (m === FX.mode) return;
  FX.modes[FX.mode]?.exit?.();
  FX.mode = m; $('fxMode').value = m;
  document.querySelectorAll('.fx-opts').forEach(el => el.hidden = el.dataset.for !== m);
  FX.modes[m]?.enter?.();
}
$('fxMode').addEventListener('change', () => setMode($('fxMode').value));
document.querySelectorAll('.fx-opts').forEach(el => el.hidden = el.dataset.for !== $('fxMode').value);
hooks.tick.push(dt => { if (points) points.visible = FX.mode === 'particles'; if (FX.mode !== 'particles') bloomPass.strength *= 0.45; FX.modes[FX.mode]?.tick?.(dt); });
hooks.scatter.push(() => FX.modes[FX.mode]?.scatter?.());
hooks.reform.push(kind => { if (kind !== 'still') FX.modes[FX.mode]?.reform?.(kind); });
hooks.goto.push(k => FX.modes[FX.mode]?.shape?.(k));
FX.modes.particles = {};

function resinUniforms() { return { uResinColor: { value: new THREE.Color() }, uWoodHSV: { value: new THREE.Vector3() }, uResinMix: { value: 0 }, uEdge: { value: .26 } }; }
function syncResin(u) {   // copy the live resin state (colour fades, mix, wood colour, edge) into a material
  u.uResinColor.value.copy(renderUniforms.uResinColor.value); u.uResinMix.value = renderUniforms.uResinMix.value; u.uEdge.value = P.resinEdge;
  const w = new THREE.Color($('woodColor').value).convertLinearToSRGB(), hsv = rgb2hsv(w.r, w.g, w.b); u.uWoodHSV.value.set(hsv[0], hsv[1], hsv[2]);
}
/* the current shape as a picture (+ depth) for picture-based effects */
function shapeCanvas(i) {
  const d = shapes[i].data; if (d.photo) return d.photo;
  if (d._raster) return d._raster;
  // non-photo shapes (text, forms, models): rasterise the particle cloud
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  const N = d.pos.length / 4, step = Math.max(1, Math.floor(N / 120000));
  for (let n = 0; n < N; n += step) { x.fillStyle = `rgb(${d.col[n * 4]},${d.col[n * 4 + 1]},${d.col[n * 4 + 2]})`; x.fillRect(512 + d.pos[n * 4] / SPAN * 1000 - 1, 512 - d.pos[n * 4 + 1] / SPAN * 1000 - 1, 3, 3); }
  d._raster = c; d.sx = d.sx || SPAN; d.sy = d.sy || SPAN; return c;
}
function shapeDepth(i) {
  const s = shapes[i], src = shapeCanvas(i);
  const [w, h] = sizeFor(src, 320);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
  if (s.depthMap && $('depthMode').value === 'ai') { x.drawImage(s.depthMap, 0, 0, w, h); return c; }
  x.drawImage(src, 0, 0, w, h);
  const id = x.getImageData(0, 0, w, h), d = id.data, L = new Float32Array(w * h);
  for (let i2 = 0; i2 < w * h; i2++) L[i2] = (.299 * d[i2 * 4] + .587 * d[i2 * 4 + 1] + .114 * d[i2 * 4 + 2]) / 255 * (d[i2 * 4 + 3] / 255);
  const b = boxBlur(boxBlur(L, w, h, 1, 3), w, h, 1, 2);
  for (let i2 = 0; i2 < w * h; i2++) { const v = b[i2] * 255; d[i2 * 4] = d[i2 * 4 + 1] = d[i2 * 4 + 2] = v; d[i2 * 4 + 3] = 255; }
  x.putImageData(id, 0, 0); return c;
}

/* ============================================================
   (1) RELIEF 3D — the photo becomes a lit height-field mesh
   ============================================================ */
const reliefMat = () => new THREE.ShaderMaterial({
  side: THREE.DoubleSide, transparent: true, extensions: { derivatives: true },
  uniforms: { map: { value: null }, tDepth: { value: null }, uHeight: { value: .9 }, uTime: { value: 0 }, uWave: { value: .3 }, uRipple: { value: 0 }, uRippleT: { value: 0 }, uGrow: { value: 1 }, uOpacity: { value: 1 }, uShade: { value: .6 }, uLightDir: { value: new THREE.Vector3(.5, .7, .9) }, ...resinUniforms() },
  vertexShader: `uniform sampler2D tDepth; uniform float uHeight,uTime,uWave,uRipple,uRippleT,uGrow; varying vec2 vUv; varying vec3 vPos;
    void main(){ vUv=uv; float d=texture2D(tDepth,uv).r; vec3 p=position;
      float z=(d-.5)*uHeight*uGrow;
      z+=sin(uv.x*9.+uTime*1.2)*cos(uv.y*7.-uTime)*uWave*.05;
      float r=length(p.xy); z+=sin(r*10.-uRippleT*9.)*exp(-pow(r-uRippleT*1.8,2.)*2.5)*uRipple*.4;
      p.z=z; vec4 wp=modelMatrix*vec4(p,1.); vPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 uLightDir; uniform float uOpacity,uShade; varying vec2 vUv; varying vec3 vPos;
uniform vec3 uResinColor,uWoodHSV; uniform float uResinMix,uEdge;
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
vec3 resinize(vec3 lin){ if(uResinMix<.001) return lin;
  vec3 h=rgb2hsv(pow(max(lin,0.),vec3(1./2.2))); float dh=abs(h.x-uWoodHSV.x); dh=min(dh,1.-dh)*2.;
  float dd=sqrt(dh*dh*1.4+(h.y-uWoodHSV.y)*(h.y-uWoodHSV.y)*.35+(h.z-uWoodHSV.z)*(h.z-uWoodHSV.z)*1.1);
  float glare=(h.y<.12&&h.z>.85)?1.:0.; float rw=(1.-glare)*smoothstep(uEdge,uEdge+.12,dd);
  float l=dot(lin,vec3(.2126,.7152,.0722)); vec3 rc=mix(uResinColor*.3,uResinColor*1.35,smoothstep(0.,.45,l))+vec3(max(0.,l-.72)*1.6);
  return mix(lin,rc,rw*uResinMix); }
    void main(){ vec4 c=texture2D(map,vUv); if(c.a<.4) discard; c.rgb=resinize(c.rgb);
      vec3 n=normalize(cross(dFdx(vPos),dFdy(vPos))); vec3 L=normalize(uLightDir);
      float dif=abs(dot(n,L)); vec3 v=normalize(cameraPosition-vPos); vec3 h=normalize(L+v); float sp=pow(max(abs(dot(n,h)),0.),48.);
      vec3 col=c.rgb*(1.-uShade+uShade*(.3+.9*dif))+vec3(sp)*uShade*.45;
      gl_FragColor=vec4(col,c.a*uOpacity); }`
});
const relief = { cur: null, old: null, ripple: 0, rippleT: 0, idx: -1 };
function reliefMesh(i) {
  const d = shapes[i].data, src = shapeCanvas(i);
  const ar = d.sx / d.sy, seg = 300, sx = ar >= 1 ? seg : Math.round(seg * ar), sy = ar >= 1 ? Math.round(seg / ar) : seg;
  const mat = reliefMat();
  const tex = new THREE.CanvasTexture(src); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const dt = new THREE.CanvasTexture(shapeDepth(i)); dt.minFilter = THREE.LinearFilter;
  mat.uniforms.map.value = tex; mat.uniforms.tDepth.value = dt;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(d.sx, d.sy, sx, sy), mat); m.frustumCulled = false;
  m.userData.grow = 0; m.userData.fade = 0;
  scene.add(m); return m;
}
function reliefDispose(m) { if (!m) return; scene.remove(m); m.geometry.dispose(); m.material.uniforms.map.value?.dispose(); m.material.uniforms.tDepth.value?.dispose(); m.material.dispose(); }
function reliefShow(i, grow = true) {
  if (relief.old) reliefDispose(relief.old);
  relief.old = relief.cur; relief.cur = reliefMesh(i); relief.idx = i;
  relief.cur.userData.grow = grow ? 0 : 1; relief.cur.userData.fade = grow ? 0 : 1;
}
FX.modes.relief = {
  enter() { reliefShow(toIdx); },
  exit() { reliefDispose(relief.cur); reliefDispose(relief.old); relief.cur = relief.old = null; },
  shape(k) { reliefShow(k); },
  scatter() { relief.ripple = 1; relief.rippleT = 0; },
  reform() { if (relief.cur) relief.cur.userData.grow = 0; },
  tick(dt) {
    relief.rippleT += dt; relief.ripple *= Math.exp(-dt * 0.9);
    for (const m of [relief.cur, relief.old]) {
      if (!m) continue;
      const u = m.material.uniforms, isCur = m === relief.cur;
      m.userData.grow = Math.min(1, m.userData.grow + dt / 1.6);
      m.userData.fade = isCur ? Math.min(1, m.userData.fade + dt / 0.9) : Math.max(0, m.userData.fade - dt / 0.9);
      u.uGrow.value = ease(m.userData.grow); u.uOpacity.value = m.userData.fade;
      u.uHeight.value = P.reliefH * 1.4; u.uShade.value = P.reliefShade; u.uWave.value = reduced ? 0 : P.reliefWave;
      u.uTime.value = T; u.uRipple.value = relief.ripple; u.uRippleT.value = relief.rippleT;
      u.uLightDir.value.set(Math.sin(T * .25) * .6 + .3, .7, .9);
      syncResin(u);
    }
    if (relief.old && relief.old.userData.fade <= 0) { reliefDispose(relief.old); relief.old = null; }
  }
};
['reliefH'].forEach(id => $(id).addEventListener('input', () => {}));
['depthMode'].forEach(id => $(id).addEventListener('change', () => { if (FX.mode === 'relief') setTimeout(() => reliefShow(shownIdx(), false), 400); }));

/* ============================================================
   (2) VOXELS — cubes with simple rigid-body-ish physics
   ============================================================ */
scene.add(new THREE.HemisphereLight(0xdfeeff, 0x1a1410, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 5); scene.add(sun);
const vox = { mesh: null, N: 0, pos: null, vel: null, rot: null, av: null, tgt: null, col: null, colT: null, st: null, delay: null, cell: 0.05, floor: -2, hold: -1 };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function voxTargets(k) {
  const d = shapes[k].data, M = d.pos.length / 4, N = vox.N;
  const res = Math.round(Math.sqrt(N) * 1.25); vox.cell = SPAN / res;
  let minY = Infinity;
  for (let i = 0; i < N; i++) {
    const j = Math.floor((i + Math.random()) / N * M) % M;   // stratified pick
    for (let a = 0; a < 3; a++) vox.tgt[i * 3 + a] = Math.round(d.pos[j * 4 + a] / vox.cell) * vox.cell;
    if (vox.tgt[i * 3 + 1] < minY) minY = vox.tgt[i * 3 + 1];
    _c.setRGB(d.col[j * 4] / 255, d.col[j * 4 + 1] / 255, d.col[j * 4 + 2] / 255, THREE.SRGBColorSpace);
    vox.colT[i * 3] = _c.r; vox.colT[i * 3 + 1] = _c.g; vox.colT[i * 3 + 2] = _c.b;
  }
  vox.floor = minY - 0.7;
}
function voxBuild() {
  voxDispose();
  const N = vox.N = +$('voxCount').value;
  vox.pos = new Float32Array(N * 3); vox.vel = new Float32Array(N * 3); vox.rot = new Float32Array(N * 3); vox.av = new Float32Array(N * 3);
  vox.tgt = new Float32Array(N * 3); vox.col = new Float32Array(N * 3); vox.colT = new Float32Array(N * 3);
  vox.st = new Uint8Array(N); vox.delay = new Float32Array(N);
  vox.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .42, metalness: .06 }), N);
  vox.mesh.frustumCulled = false; vox.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < N; i++) vox.mesh.setColorAt(i, _c.setRGB(1, 1, 1));
  scene.add(vox.mesh);
  voxTargets(shownIdx());
  vox.col.set(vox.colT);
  voxReform('cloud');
}
function voxDispose() { if (!vox.mesh) return; scene.remove(vox.mesh); vox.mesh.geometry.dispose(); vox.mesh.material.dispose(); vox.mesh = null; }
function voxReform(kind) {
  const N = vox.N; vox.hold = -1;
  for (let i = 0; i < N; i++) {
    const tx = vox.tgt[i * 3], ty = vox.tgt[i * 3 + 1], tz = vox.tgt[i * 3 + 2];
    if (kind === 'pour') { vox.pos[i * 3] = tx; vox.pos[i * 3 + 1] = ty + 3 + Math.random() * 7; vox.pos[i * 3 + 2] = tz; vox.st[i] = 2; }
    else if (kind === 'floor') { vox.pos[i * 3] = (Math.random() - .5) * 7; vox.pos[i * 3 + 1] = vox.floor + vox.cell / 2; vox.pos[i * 3 + 2] = (Math.random() - .5) * 4; vox.st[i] = 0; }
    else { const z = Math.random() * 2 - 1, ph = Math.random() * 6.283, r = 4 + Math.random() * 4, s = Math.sqrt(1 - z * z); vox.pos[i * 3] = Math.cos(ph) * s * r; vox.pos[i * 3 + 1] = z * r; vox.pos[i * 3 + 2] = Math.sin(ph) * s * r; vox.st[i] = 0; }
    vox.vel.fill(0, i * 3, i * 3 + 3);
    for (let a = 0; a < 3; a++) { vox.rot[i * 3 + a] = (Math.random() - .5) * 6; vox.av[i * 3 + a] = 0; }
    vox.delay[i] = Math.random() * 0.8;
  }
}
function voxScatter() {
  for (let i = 0; i < vox.N; i++) {
    const x = vox.pos[i * 3], y = vox.pos[i * 3 + 1], z = vox.pos[i * 3 + 2], l = Math.hypot(x, y, z) + .2, f = 2 + Math.random() * 3.5;
    vox.vel[i * 3] = x / l * f + (Math.random() - .5); vox.vel[i * 3 + 1] = 2 + Math.random() * 4.5; vox.vel[i * 3 + 2] = z / l * f + 1.5 * Math.random();
    for (let a = 0; a < 3; a++) vox.av[i * 3 + a] = (Math.random() - .5) * 14;
    vox.st[i] = 1;
  }
  vox.hold = P.voxHold + 1.2;
}
function voxStep(dt) {
  const N = vox.N, k = 110 * P.spring, c = 1.8 * Math.sqrt(k), half = vox.cell * P.voxSize / 2;
  if (vox.hold > 0) { vox.hold -= dt; if (vox.hold <= 0) { for (let i = 0; i < N; i++) { vox.st[i] = 0; vox.delay[i] = Math.random() * 0.9; } } }
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    if (vox.st[i] === 0) {           // spring home (after a stagger delay)
      if (vox.delay[i] > 0) { vox.delay[i] -= dt; if (vox.st[i] === 0 && vox.pos[i3 + 1] <= vox.floor + half + 1e-3) continue; }
      for (let a = 0; a < 3; a++) {
        const ax = (vox.tgt[i3 + a] - vox.pos[i3 + a]) * k - vox.vel[i3 + a] * c;
        vox.vel[i3 + a] += ax * dt; vox.pos[i3 + a] += vox.vel[i3 + a] * dt;
        vox.rot[i3 + a] *= Math.exp(-dt * 6);
      }
    } else {                          // 1 = falling with floor bounce, 2 = rain until it reaches its slot
      vox.vel[i3 + 1] -= 9.8 * dt;
      vox.vel[i3] += P.wind * dt;
      for (let a = 0; a < 3; a++) { vox.pos[i3 + a] += vox.vel[i3 + a] * dt; vox.rot[i3 + a] += vox.av[i3 + a] * dt; }
      if (vox.st[i] === 2 && vox.pos[i3 + 1] <= vox.tgt[i3 + 1]) { vox.st[i] = 0; vox.delay[i] = 0; vox.vel[i3 + 1] *= 0.2; }
      else if (vox.st[i] === 1 && vox.pos[i3 + 1] < vox.floor + half) {
        vox.pos[i3 + 1] = vox.floor + half;
        if (vox.vel[i3 + 1] < 0) vox.vel[i3 + 1] *= -0.33;
        vox.vel[i3] *= 0.82; vox.vel[i3 + 2] *= 0.82;
        for (let a = 0; a < 3; a++) vox.av[i3 + a] *= 0.7;
        if (Math.abs(vox.vel[i3 + 1]) < 0.3) { vox.vel[i3 + 1] = 0; for (let a = 0; a < 3; a++) vox.rot[i3 + a] = Math.round(vox.rot[i3 + a] / (Math.PI / 2)) * (Math.PI / 2) * 0.15 + vox.rot[i3 + a] * 0.85; }
      }
    }
    for (let a = 0; a < 3; a++) vox.col[i3 + a] += (vox.colT[i3 + a] - vox.col[i3 + a]) * Math.min(1, dt * 3);
  }
}
function voxUpload() {
  const s = vox.cell * P.voxSize;
  _s.set(s, s, s);
  for (let i = 0; i < vox.N; i++) {
    const i3 = i * 3;
    _v.set(vox.pos[i3], vox.pos[i3 + 1], vox.pos[i3 + 2]); _q.setFromEuler(_e.set(vox.rot[i3], vox.rot[i3 + 1], vox.rot[i3 + 2]));
    vox.mesh.setMatrixAt(i, _m4.compose(_v, _q, _s));
    vox.mesh.setColorAt(i, _c.setRGB(vox.col[i3], vox.col[i3 + 1], vox.col[i3 + 2]));
  }
  vox.mesh.instanceMatrix.needsUpdate = true; vox.mesh.instanceColor.needsUpdate = true;
}
FX.modes.voxels = {
  enter() { voxBuild(); },
  exit() { voxDispose(); },
  shape(k) { voxTargets(k); for (let i = 0; i < vox.N; i++) { vox.st[i] = 0; vox.delay[i] = Math.random() * 0.8; } vox.hold = -1; },
  scatter() { voxScatter(); },
  reform(kind) { voxReform(kind); },
  tick(dt) { if (!vox.mesh) return; const n = dt > 1 / 45 ? 2 : 1; for (let k = 0; k < n; k++) voxStep(dt / n); voxUpload(); }
};
$('voxCount').addEventListener('change', () => { if (FX.mode === 'voxels') voxBuild(); });

/* ============================================================
   (4) FLUID — stable-fluids solver on the GPU, composited as a post pass
   ============================================================ */
const FL = { sim: 128, dye: 512, quad: null, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene: new THREE.Scene(), pour: 0, autoT: 0, lastPtr: null, hue: 0 };
FL.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); FL.quad.frustumCulled = false; FL.scene.add(FL.quad);
const flRT = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
const flDouble = (w, h) => ({ a: flRT(w, h), b: flRT(w, h), swap() { const t = this.a; this.a = this.b; this.b = t; } });
FL.vel = flDouble(FL.sim, FL.sim); FL.dyeT = flDouble(FL.dye, FL.dye); FL.prs = flDouble(FL.sim, FL.sim);
FL.div = flRT(FL.sim, FL.sim); FL.curl = flRT(FL.sim, FL.sim);
const FLV = `varying vec2 vUv,vL,vR,vT,vB; uniform vec2 texel; void main(){ vUv=uv; vL=uv-vec2(texel.x,0.); vR=uv+vec2(texel.x,0.); vT=uv+vec2(0.,texel.y); vB=uv-vec2(0.,texel.y); gl_Position=vec4(position.xy,0.,1.); }`;
const flMat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FLV, fragmentShader: 'precision highp float; varying vec2 vUv,vL,vR,vT,vB;\n' + frag, uniforms: { texel: { value: new THREE.Vector2(1 / FL.sim, 1 / FL.sim) }, ...uniforms }, depthTest: false, depthWrite: false });
const FM = {
  splat: flMat(`uniform sampler2D uTarget; uniform float aspect,radius; uniform vec3 color; uniform vec2 point; void main(){ vec2 p=vUv-point; p.x*=aspect; vec3 s=exp(-dot(p,p)/radius)*color; gl_FragColor=vec4(texture2D(uTarget,vUv).xyz+s,1.); }`, { uTarget: { value: null }, aspect: { value: 1 }, radius: { value: .002 }, color: { value: new THREE.Vector3() }, point: { value: new THREE.Vector2() } }),
  advect: flMat(`uniform sampler2D uVelocity,uSource; uniform vec2 simTexel; uniform float dt,dissipation; void main(){ vec2 c=vUv-dt*texture2D(uVelocity,vUv).xy*simTexel; gl_FragColor=texture2D(uSource,c)/(1.+dissipation*dt); }`, { uVelocity: { value: null }, uSource: { value: null }, simTexel: { value: new THREE.Vector2(1 / FL.sim, 1 / FL.sim) }, dt: { value: .016 }, dissipation: { value: .2 } }),
  div: flMat(`uniform sampler2D uVelocity; void main(){ float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y; vec2 C=texture2D(uVelocity,vUv).xy; if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.); }`, { uVelocity: { value: null } }),
  curl: flMat(`uniform sampler2D uVelocity; void main(){ float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x; gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.); }`, { uVelocity: { value: null } }),
  vort: flMat(`uniform sampler2D uVelocity,uCurl; uniform float curl,dt; void main(){ float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x; vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+.0001; f*=curl*C; f.y*=-1.; vec2 v=texture2D(uVelocity,vUv).xy+f*dt; gl_FragColor=vec4(clamp(v,-1000.,1000.),0.,1.); }`, { uVelocity: { value: null }, uCurl: { value: null }, curl: { value: 22 }, dt: { value: .016 } }),
  clear: flMat(`uniform sampler2D uTex; uniform float value; void main(){ gl_FragColor=value*texture2D(uTex,vUv); }`, { uTex: { value: null }, value: { value: .8 } }),
  prs: flMat(`uniform sampler2D uPressure,uDivergence; void main(){ float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x; float d=texture2D(uDivergence,vUv).x; gl_FragColor=vec4((L+R+B+T-d)*.25,0.,0.,1.); }`, { uPressure: { value: null }, uDivergence: { value: null } }),
  grad: flMat(`uniform sampler2D uPressure,uVelocity; void main(){ float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x; vec2 v=texture2D(uVelocity,vUv).xy-vec2(R-L,T-B); gl_FragColor=vec4(v,0.,1.); }`, { uPressure: { value: null }, uVelocity: { value: null } }),
};
function flRun(mat, target) { FL.quad.material = mat; renderer.setRenderTarget(target); renderer.render(FL.scene, FL.cam); }
function flSplat(x, y, dx, dy, color, r = 0.0025) {
  const asp = view.w / Math.max(1, view.h);
  const u = FM.splat.uniforms; u.aspect.value = asp; u.point.value.set(x, y); u.radius.value = r * (asp > 1 ? asp : 1);
  u.uTarget.value = FL.vel.a.texture; u.color.value.set(dx, dy, 0); flRun(FM.splat, FL.vel.b); FL.vel.swap();
  u.uTarget.value = FL.dyeT.a.texture; u.color.value.copy(color); flRun(FM.splat, FL.dyeT.b); FL.dyeT.swap();
}
function flColor() {
  const m = $('fluidColor').value;
  if (m === 'clear') return new THREE.Vector3(0, 0, 0);
  if (m === 'gold') return new THREE.Vector3(.9, .62, .22).multiplyScalar(.5);
  if (m === 'rainbow') { FL.hue = (FL.hue + .07) % 1; const c = new THREE.Color().setHSL(FL.hue, .9, .5); return new THREE.Vector3(c.r, c.g, c.b).multiplyScalar(.5); }
  const c = new THREE.Color($('resinColor').value); return new THREE.Vector3(c.r, c.g, c.b).multiplyScalar(.6);
}
function flStep(dt) {
  const prev = renderer.getRenderTarget();
  FM.curl.uniforms.uVelocity.value = FL.vel.a.texture; flRun(FM.curl, FL.curl);
  Object.assign(FM.vort.uniforms, {}); FM.vort.uniforms.uVelocity.value = FL.vel.a.texture; FM.vort.uniforms.uCurl.value = FL.curl.texture; FM.vort.uniforms.dt.value = dt; flRun(FM.vort, FL.vel.b); FL.vel.swap();
  FM.div.uniforms.uVelocity.value = FL.vel.a.texture; flRun(FM.div, FL.div);
  FM.clear.uniforms.uTex.value = FL.prs.a.texture; FM.clear.uniforms.value.value = .8; flRun(FM.clear, FL.prs.b); FL.prs.swap();
  FM.prs.uniforms.uDivergence.value = FL.div.texture;
  for (let i = 0; i < 20; i++) { FM.prs.uniforms.uPressure.value = FL.prs.a.texture; flRun(FM.prs, FL.prs.b); FL.prs.swap(); }
  FM.grad.uniforms.uPressure.value = FL.prs.a.texture; FM.grad.uniforms.uVelocity.value = FL.vel.a.texture; flRun(FM.grad, FL.vel.b); FL.vel.swap();
  const ad = FM.advect.uniforms; ad.dt.value = dt;
  ad.uVelocity.value = FL.vel.a.texture; ad.uSource.value = FL.vel.a.texture; ad.dissipation.value = .25; flRun(FM.advect, FL.vel.b); FL.vel.swap();
  ad.uVelocity.value = FL.vel.a.texture; ad.uSource.value = FL.dyeT.a.texture; ad.dissipation.value = P.fluidFade; flRun(FM.advect, FL.dyeT.b); FL.dyeT.swap();
  renderer.setRenderTarget(prev);
}
function flClear() { const prev = renderer.getRenderTarget(); for (const t of [FL.vel.a, FL.vel.b, FL.dyeT.a, FL.dyeT.b, FL.prs.a, FL.prs.b]) { renderer.setRenderTarget(t); renderer.setClearColor(0x000000, 0); renderer.clear(); } renderer.setRenderTarget(prev); renderer.setClearColor(0x000000, 1); }
// screen-space pointer for the fluid
cv.addEventListener('pointermove', e => {
  if (!$('fluidOn').checked) return;
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
  if (FL.lastPtr) { const dx = x - FL.lastPtr[0], dy = y - FL.lastPtr[1]; if (Math.abs(dx) + Math.abs(dy) > 1e-4) FL.queue.push([x, y, dx * 6000, dy * 6000]); }
  FL.lastPtr = [x, y];
});
cv.addEventListener('pointerleave', () => FL.lastPtr = null);
FL.queue = [];
function fluidPour() { if (!$('fluidOn').checked) { $('fluidOn').checked = true; } FL.pour = 2.6; FL.pourT = 0; FL.pourX = 0.35 + Math.random() * 0.3; }
hooks.tick.push(dt => {
  if (!$('fluidOn').checked) return;
  const col = flColor();
  while (FL.queue.length) { const [x, y, dx, dy] = FL.queue.shift(); flSplat(x, y, dx, dy, col); }
  if (FL.pour > 0) {   // a stream of resin pouring down from the top, wobbling
    FL.pour -= dt; FL.pourT += dt;
    const x = FL.pourX + Math.sin(FL.pourT * 3.1) * 0.08, y = 1.02 - Math.min(0.55, FL.pourT * 0.45);
    flSplat(x, y, Math.cos(FL.pourT * 4) * 220, -900, col.clone().multiplyScalar(0.9), 0.004);
  }
  if ($('fluidAuto').checked) { FL.autoT -= dt; if (FL.autoT <= 0) { FL.autoT = 0.9 + Math.random() * 1.2; const a = Math.random() * 6.283; flSplat(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, Math.cos(a) * 700, Math.sin(a) * 700, col.clone().multiplyScalar(0.35), 0.003); } }
  flStep(Math.min(dt, 1 / 30));
});
const fluidPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDye: { value: null }, tVel: { value: null }, uDistort: { value: 1 }, uDye: { value: .9 }, uTexel: { value: new THREE.Vector2(1 / FL.dye, 1 / FL.dye) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse,tDye,tVel; uniform float uDistort,uDye; uniform vec2 uTexel; varying vec2 vUv;
    float lum(vec3 c){ return dot(c,vec3(.333)); }
    void main(){ vec2 v=texture2D(tVel,vUv).xy; vec4 c=texture2D(tDiffuse,vUv-v*uDistort*.00018);
      vec3 dye=texture2D(tDye,vUv).rgb; float l=lum(dye), a=clamp(l*2.2*uDye,0.,1.);
      float lx=lum(texture2D(tDye,vUv+vec2(uTexel.x,0.)).rgb)-l, ly=lum(texture2D(tDye,vUv+vec2(0.,uTexel.y)).rgb)-l;
      vec3 n=normalize(vec3(-lx*40.,-ly*40.,1.)); float sp=pow(max(dot(n,normalize(vec3(.35,.55,1.))),0.),36.);
      vec3 hue=dye/(max(max(dye.r,dye.g),dye.b)+1e-4);
      vec3 col=mix(c.rgb,hue*min(1.,l*2.5+.25),a*.82)+sp*a*.9;
      gl_FragColor=vec4(col,1.); }`
});
fluidPass.enabled = false;
hooks.tick.push(() => {
  fluidPass.enabled = $('fluidOn').checked;
  fluidPass.uniforms.tDye.value = FL.dyeT.a.texture; fluidPass.uniforms.tVel.value = FL.vel.a.texture;
  fluidPass.uniforms.uDistort.value = P.fluidDistort; fluidPass.uniforms.uDye.value = $('fluidColor').value === 'clear' ? 0 : P.fluidDye;
});
$('btnFluidPour').onclick = fluidPour;
$('btnFluidClear').onclick = flClear;
$('fluidOn').addEventListener('change', () => { if ($('fluidOn').checked) flClear(); });

/* ============================================================
   (6) CINEMATIC LIGHT — gloss sweep, tilt-shift, grain, vignette, chroma
   ============================================================ */
const lightPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uSweep: { value: -9 }, uSweepAmt: { value: .9 }, uSweepW: { value: .16 }, uSweepAng: { value: -.6 }, uGrain: { value: 0 }, uVig: { value: 0 }, uCA: { value: 0 }, uTilt: { value: 0 }, uFocus: { value: .5 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime,uSweep,uSweepAmt,uSweepW,uSweepAng,uGrain,uVig,uCA,uTilt,uFocus; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    vec3 smp(vec2 uv){ vec2 cc=uv-.5; if(uCA<=0.) return texture2D(tDiffuse,uv).rgb;
      return vec3(texture2D(tDiffuse,uv+cc*uCA*.012).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-cc*uCA*.012).b); }
    void main(){ vec2 uv=vUv, cc=uv-.5; vec3 col=smp(uv);
      if(uTilt>0.){ float r=uTilt*smoothstep(.06,.45,abs(uv.y-uFocus))*7.;
        if(r>.05){ vec3 acc=col; for(int i=0;i<16;i++){ float a=float(i)*2.39996; vec2 o=vec2(cos(a),sin(a))*sqrt(float(i+1)/16.)*r/uRes*vec2(uRes.y/720.); acc+=smp(uv+o); } col=acc/17.; } }
      vec2 dir=vec2(cos(uSweepAng),sin(uSweepAng)); float s=dot(cc*vec2(uRes.x/uRes.y,1.),dir);
      float band=exp(-pow((s-uSweep)/uSweepW,2.)); float l=dot(col,vec3(.299,.587,.114));
      col+=band*uSweepAmt*(.12+l*1.3)*vec3(1.,.96,.88);
      col*=1.-uVig*.85*smoothstep(.25,.85,length(cc*vec2(1.,.9)));
      col+=(h(uv*uRes+fract(uTime*7.)*91.)-.5)*uGrain*.16;
      gl_FragColor=vec4(col,1.); }`
});
const light = { t: -1, nextAt: 0 };
function sweepNow() { light.t = 0; }
hooks.tick.push(dt => {
  if (P.sweepEvery > 0) { light.nextAt -= dt; if (light.nextAt <= 0) { light.nextAt = P.sweepEvery; sweepNow(); } }
  const u = lightPass.uniforms;
  if (light.t >= 0) { light.t += dt; const W = view.w / Math.max(1, view.h); u.uSweep.value = lerp(-0.9 * Math.max(1, W), 0.9 * Math.max(1, W), ease(Math.min(1, light.t / 1.5))); if (light.t > 1.6) light.t = -1; }
  else u.uSweep.value = -9;
  u.uSweepAmt.value = P.sweepAmt; u.uGrain.value = P.grain; u.uVig.value = P.vignette; u.uCA.value = P.chroma; u.uTilt.value = P.tilt; u.uTime.value = T;
  u.uRes.value.set(view.w * view.pr, view.h * view.pr);
  lightPass.enabled = light.t >= 0 || P.grain > 0 || P.vignette > 0 || P.chroma > 0 || P.tilt > 0;
});
$('btnSweep').onclick = sweepNow;
composer.addPass(fluidPass); composer.addPass(lightPass);

/* timeline actions */
Object.assign(ACTS, { effect: 'Efekt główny', sweep: 'Połysk', fluid: 'Wylej płyn' });
hooks.args.effect = () => Object.entries({ particles: 'Cząsteczki', relief: 'Relief 3D', voxels: 'Klocki', ...(FX.modes.glass ? { glass: 'Rozbite szkło' } : {}) });
hooks.step.push(s => {
  if (s.act === 'effect') setMode(s.arg || 'particles');
  else if (s.act === 'sweep') sweepNow();
  else if (s.act === 'fluid') fluidPour();
});
hooks.seqStart.push(() => { light.nextAt = P.sweepEvery; });
hooks.projectApplied.push(() => { const m = $('fxMode').value; FX.mode = 'particles'; setMode(m); });
