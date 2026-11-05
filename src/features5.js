
/* ============================================================
   (3) GLASS — the picture cracks into 3D shards that fly and return
   ============================================================ */
const glass = { mesh: null, t: 0, target: 0, start: -9, hold: -1, idx: -1 };
function glassBuild(i) {
  glassDispose();
  const d = shapes[i].data, src = shapeCanvas(i), sx = d.sx, sy = d.sy;
  // alpha lookup to skip empty (cut-out) areas
  const aw = 64, ah = Math.max(2, Math.round(64 * sy / sx)), ac = document.createElement('canvas'); ac.width = aw; ac.height = ah;
  const ax = ac.getContext('2d', { willReadFrequently: true }); ax.drawImage(src, 0, 0, aw, ah); const ad = ax.getImageData(0, 0, aw, ah).data;
  const alphaAt = (u, v) => ad[(Math.min(ah - 1, Math.floor((1 - v) * ah)) * aw + Math.min(aw - 1, Math.floor(u * aw))) * 4 + 3] / 255;
  const cols = 22, rows = Math.max(6, Math.round(cols * sy / sx));
  const P2 = []; for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const edge = r === 0 || c === 0 || r === rows || c === cols, j = edge ? 0 : 0.38;
    P2.push([(c + (Math.random() - .5) * j) / cols, (r + (Math.random() - .5) * j) / rows]);
  }
  const pos = [], uvs = [], ctr = [], rnd = [], bar = [];
  const vtx = (r, c) => P2[r * (cols + 1) + c];
  const tri = (a, b, c) => {
    const cu = (a[0] + b[0] + c[0]) / 3, cvv = (a[1] + b[1] + c[1]) / 3;
    if (alphaAt(cu, cvv) < 0.35) return;
    const C = [(cu - .5) * sx, (cvv - .5) * sy, 0], R = [Math.random() - .5, Math.random() - .5, Math.random() - .5, Math.random()];
    [a, b, c].forEach((p, k) => { pos.push((p[0] - .5) * sx, (p[1] - .5) * sy, 0); uvs.push(p[0], p[1]); ctr.push(...C); rnd.push(...R); bar.push(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0); });
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = vtx(r, c), b = vtx(r, c + 1), e = vtx(r + 1, c), f = vtx(r + 1, c + 1);
    if (Math.random() < .5) { tri(a, b, f); tri(a, f, e); } else { tri(a, b, e); tri(b, f, e); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(ctr, 3)); g.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 4)); g.setAttribute('aBary', new THREE.Float32BufferAttribute(bar, 3));
  const tex = new THREE.CanvasTexture(src); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true,
    uniforms: { map: { value: tex }, uT: { value: 0 }, uCrack: { value: 0 }, uImpact: { value: new THREE.Vector3(0, 0, 0) }, uSpread: { value: Math.max(sx, sy) }, ...resinUniforms() },
    vertexShader: `uniform float uT,uSpread; uniform vec3 uImpact; attribute vec3 aCenter,aBary; attribute vec4 aRand; varying vec2 vUv; varying vec3 vBary,vN; varying float vT;
      mat3 rot(vec3 a,float g){ a=normalize(a+1e-4); float s=sin(g),c=cos(g),o=1.-c;
        return mat3(o*a.x*a.x+c,o*a.x*a.y+a.z*s,o*a.z*a.x-a.y*s, o*a.x*a.y-a.z*s,o*a.y*a.y+c,o*a.y*a.z+a.x*s, o*a.z*a.x+a.y*s,o*a.y*a.z-a.x*s,o*a.z*a.z+c); }
      void main(){ float dl=length(aCenter.xy-uImpact.xy)/uSpread; float t=clamp((uT-dl*.45)/(.55),0.,1.); float e=t*t*(3.-2.*t);
        vec3 dir=normalize(vec3(aCenter.xy-uImpact.xy,0.)+vec3(aRand.xy*.6,.8));
        mat3 R=rot(aRand.xyz,e*(2.+aRand.w*7.));
        vec3 p=R*(position-aCenter)+aCenter+dir*e*(1.2+aRand.w*2.6)+vec3(0.,-1.,0.)*e*e*1.6;
        vUv=uv; vBary=aBary; vN=R*vec3(0.,0.,1.); vT=t;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `uniform sampler2D map; uniform float uCrack; varying vec2 vUv; varying vec3 vBary,vN; varying float vT;
uniform vec3 uResinColor,uWoodHSV; uniform float uResinMix,uEdge;
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
vec3 resinize(vec3 lin){ if(uResinMix<.001) return lin;
  vec3 h=rgb2hsv(pow(max(lin,0.),vec3(1./2.2))); float dh=abs(h.x-uWoodHSV.x); dh=min(dh,1.-dh)*2.;
  float dd=sqrt(dh*dh*1.4+(h.y-uWoodHSV.y)*(h.y-uWoodHSV.y)*.35+(h.z-uWoodHSV.z)*(h.z-uWoodHSV.z)*1.1);
  float glare=(h.y<.12&&h.z>.85)?1.:0.; float rw=(1.-glare)*smoothstep(uEdge,uEdge+.12,dd);
  float l=dot(lin,vec3(.2126,.7152,.0722)); vec3 rc=mix(uResinColor*.3,uResinColor*1.35,smoothstep(0.,.45,l))+vec3(max(0.,l-.72)*1.6);
  return mix(lin,rc,rw*uResinMix); }
      void main(){ vec4 c=texture2D(map,vUv); if(c.a<.3) discard; c.rgb=resinize(c.rgb);
        float edge=1.-smoothstep(0.,.035,min(vBary.x,min(vBary.y,vBary.z)));
        float sh=.55+.45*abs(dot(normalize(vN),normalize(vec3(.4,.6,1.))));
        float glint=pow(abs(dot(normalize(vN),normalize(vec3(-.3,.5,1.)))),24.)*vT;
        vec3 col=c.rgb*mix(1.,sh,smoothstep(0.,.15,vT))+vec3(1.)*(edge*max(uCrack,vT)*.75+glint*.6);
        gl_FragColor=vec4(col,c.a); }`
  });
  glass.mesh = new THREE.Mesh(g, mat); glass.mesh.frustumCulled = false; scene.add(glass.mesh); glass.idx = i;
}
function glassDispose() { if (!glass.mesh) return; scene.remove(glass.mesh); glass.mesh.geometry.dispose(); glass.mesh.material.uniforms.map.value.dispose(); glass.mesh.material.dispose(); glass.mesh = null; }
function glassBreak(at) {
  if (!glass.mesh) return;
  glass.mesh.material.uniforms.uImpact.value.copy(at || new THREE.Vector3((Math.random() - .5) * .6, (Math.random() - .5) * .6, 0));
  glass.start = T; glass.target = 1; glass.hold = P.voxHold + 1.8;
}
FX.modes.glass = {
  enter() { glassBuild(shownIdx()); glass.t = 0; glass.target = 0; },
  exit() { glassDispose(); },
  shape(k) { glassBuild(k); glass.t = glass.target = 0; },
  scatter() { glassBreak(); },
  reform() { glass.target = 0; glass.hold = -1; },
  tick(dt) {
    if (!glass.mesh) return;
    if (glass.hold > 0) { glass.hold -= dt; if (glass.hold <= 0) glass.target = 0; }
    const since = T - glass.start, crackPhase = glass.target === 1 && since < 0.35;
    if (!crackPhase) glass.t += Math.sign(glass.target - glass.t) * Math.min(Math.abs(glass.target - glass.t), dt / (glass.target ? 1.8 : 1.4));
    const u = glass.mesh.material.uniforms; syncResin(u); u.uT.value = glass.t; u.uCrack.value = glass.target === 1 ? Math.min(1, since * 4) : Math.max(0, u.uCrack.value - dt * 2);
  }
};
// clicking the glass breaks it where you click
cv.addEventListener('pointerup', e => { if (FX.mode !== 'glass' || glass.t > 0.05) return; const w = pointerWorld(e); if (w) glassBreak(w); });
{ const o = document.createElement('option'); o.value = 'glass'; o.textContent = 'Rozbite szkło'; $('fxMode').appendChild(o); }

/* ============================================================
   (5) RETRO & PRINT — ASCII, halftone, dither, glitch, melt (pixel-sort look)
   ============================================================ */
const GLYPHS = ' .,:;irsXA253hMHGS#9B&@';
const glyphTex = (() => {
  const n = GLYPHS.length, c = document.createElement('canvas'); c.width = n * 32; c.height = 32; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.font = '700 28px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < n; i++) x.fillText(GLYPHS[i], i * 32 + 16, 17);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
})();
const retroPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tGlyph: { value: glyphTex }, uN: { value: GLYPHS.length }, uMode: { value: 0 }, uCell: { value: 10 }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uMono: { value: 0 }, uInk: { value: new THREE.Color('#111') }, uPaper: { value: new THREE.Color('#f2ece0') }, uAmt: { value: .5 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse,tGlyph; uniform float uN,uMode,uCell,uTime,uMono,uAmt; uniform vec2 uRes; uniform vec3 uInk,uPaper; varying vec2 vUv;
    float lum(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    float bayer(vec2 p){ vec2 q=mod(floor(p),4.); int i=int(q.x+q.y*4.);
      float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
      for(int k=0;k<16;k++) if(k==i) return m[k]/16.; return 0.; }
    void main(){ vec2 px=vUv*uRes; float cs=uCell*uRes.y/1080.+1.; vec3 col=texture2D(tDiffuse,vUv).rgb;
      if(uMode<1.5){ // ASCII
        vec2 cell=floor(px/cs); vec3 c=texture2D(tDiffuse,(cell+.5)*cs/uRes).rgb; float l=clamp(lum(c)*1.15,0.,.999);
        vec2 g=fract(px/cs); float gl=texture2D(tGlyph,vec2((floor(l*uN)+g.x)/uN,g.y)).r;
        col=uMono>.5?mix(uPaper,uInk,gl):c*gl*1.6;
      } else if(uMode<2.5){ // halftone (45°)
        mat2 R=mat2(.7071,-.7071,.7071,.7071); vec2 p=R*px; vec2 cell=floor(p/cs)+.5; vec2 cpx=transpose(R)*(cell*cs);
        vec3 c=texture2D(tDiffuse,cpx/uRes).rgb; float l=lum(c); float d=length(p-cell*cs);
        if(uMono>.5){ float r=sqrt(1.-l)*cs*.62; col=mix(uPaper,uInk,1.-smoothstep(r-1.,r+.5,d)); }
        else { float r=sqrt(l)*cs*.62; col=c*1.25*(1.-smoothstep(r-1.,r+.5,d)); }
      } else if(uMode<3.5){ // ordered dither
        float ps=max(1.,cs*.35); vec2 q=floor(px/ps); vec3 c=texture2D(tDiffuse,(q+.5)*ps/uRes).rgb; float b=bayer(q)-.5;
        if(uMono>.5) col=lum(c)+b*.6>.5?uPaper:uInk; else col=floor(c*4.+b*1.)/3.;
      } else if(uMode<4.5){ // glitch
        float band=floor(vUv.y*40.); float tt=floor(uTime*10.); float g=step(1.-uAmt*.35,h(vec2(band,tt)));
        vec2 uv=vUv+vec2((h(vec2(band,tt+1.))-.5)*.12*g,0.);
        float sp=.006*uAmt+.02*g*uAmt;
        col=vec3(texture2D(tDiffuse,uv+vec2(sp,0.)).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-vec2(sp,0.)).b);
        col*=.88+.12*sin(px.y*3.14159*.5); if(g>.5&&h(vec2(band,tt+2.))>.7) col=1.-col;
      } else if(uMode>5.5){ // hologram: cyan projection, scanlines, flicker, sweeping light band, jitter
        float band=floor(vUv.y*90.); float jit=(h(vec2(floor(uTime*14.),band))-.5)*.01*step(.9,h(vec2(floor(uTime*4.),floor(band*.2))))*uAmt*2.;
        vec3 c=texture2D(tDiffuse,vUv+vec2(jit,0.)).rgb; float l=lum(c);
        vec3 holo=mix(vec3(.02,.25,.5),vec3(.6,1.,1.),smoothstep(0.,.8,l))*(.3+l*1.5);
        float scan=.72+.28*sin(px.y*1.7-uTime*24.); float flick=.9+.1*sin(uTime*47.)*sin(uTime*13.);
        float sweep=1.-smoothstep(0.,.02,abs(fract(vUv.y+uTime*.17)-.5));
        col=holo*scan*flick+vec3(.35,1.,1.)*sweep*.35*step(.03,l)+vec3(texture2D(tDiffuse,vUv+vec2(.005,0.)).r,0.,0.)*.12;
      } else { // melt / pixel-sort look: bright pixels smear downward
        float thr=.55-uAmt*.3; vec3 best=col; float bl=lum(col);
        for(int i=1;i<28;i++){ vec3 s=texture2D(tDiffuse,vUv+vec2(0.,float(i)*cs/uRes.y)).rgb; float l=lum(s); if(l>thr&&l>bl){ best=s; bl=l; } }
        col=mix(col,best,.85);
      }
      gl_FragColor=vec4(col,1.); }`
});
retroPass.enabled = false;
composer.addPass(retroPass);
hooks.tick.push(() => {
  const m = +$('retroMode').value; retroPass.enabled = m > 0;
  const u = retroPass.uniforms; u.uMode.value = m; u.uCell.value = P.retroCell; u.uRes.value.set(view.w * view.pr, view.h * view.pr);
  u.uTime.value = T; u.uMono.value = $('retroMono').checked ? 1 : 0; u.uInk.value.set($('retroInk').value); u.uPaper.value.set($('retroPaper').value); u.uAmt.value = P.retroAmt;
});
Object.assign(ACTS, { retro: 'Styl retro' });
hooks.args.retro = () => [...$('retroMode').options].map(o => [o.value, o.textContent]);
hooks.step.push(s => { if (s.act === 'retro') $('retroMode').value = s.arg; });
